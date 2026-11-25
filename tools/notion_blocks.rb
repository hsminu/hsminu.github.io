# frozen_string_literal: true

require "cgi"
require "json"
require "net/http"
require "uri"

module NotionPublish
  class GitHubRepositories
    def initialize
      @repositories = {}
    end

    def public_repository(owner, name)
      return unless owner.match?(BlockRenderer::GITHUB_OWNER) && name.match?(BlockRenderer::GITHUB_REPOSITORY) && !%w[. ..].include?(name)

      key = "#{owner}/#{name}"
      @repositories.fetch(key.downcase) { @repositories[key.downcase] = fetch_repository(key) }
    end

    private

    def fetch_repository(key)
      uri = URI("https://api.github.com/repos/#{key}")
      request = Net::HTTP::Get.new(uri, { "Accept" => "application/vnd.github+json", "User-Agent" => "notion-jekyll-publisher" })
      Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 4, read_timeout: 6, max_retries: 0) do |http|
        http.request(request) do |response|
          warn "GitHub public repository metadata rate limit reached." if response["x-ratelimit-remaining"] == "0" && response.code == "403"
          return unless response.is_a?(Net::HTTPSuccess)

          bytes = +""
          response.read_body do |chunk|
            return if bytes.bytesize + chunk.bytesize > 256 * 1024

            bytes << chunk
          end
          repo = JSON.parse(bytes)
          return unless repo.is_a?(Hash) && repo["private"] == false && repo["visibility"] == "public"
          return unless repo["full_name"].to_s.casecmp?(key)

          return repo.slice("full_name", "description", "language")
        end
      end
    rescue SystemCallError, IOError, Timeout::Error, OpenSSL::SSL::SSLError, SocketError, JSON::ParserError
      nil
    end
  end

  class BlockRenderer
    EXTERNAL_TYPES = %w[bookmark embed link_preview video audio].freeze
    NOTION_HOSTS = %w[app.notion.com www.notion.so notion.so].freeze
    GITHUB_HOSTS = %w[github.com www.github.com].freeze
    YOUTUBE_HOSTS = %w[youtube.com www.youtube.com m.youtube.com www.youtube-nocookie.com youtu.be].freeze
    FIGMA_HOSTS = %w[figma.com www.figma.com embed.figma.com].freeze
    PUBLIC_HOST = /\A(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}\z/i
    GITHUB_OWNER = /\A[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?\z/i
    GITHUB_REPOSITORY = /\A[a-z\d_.-]{1,100}\z/i
    UUID_FRAGMENT = /\A(?:[a-f\d]{32}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})\z/i

    def initialize(client, links: {}, github: GitHubRepositories.new)
      @client = client
      @links = links
      @github = github
      @blocks = {}
    end

    # Called on Markdown outside fenced code. Keep inline XML in prose and code samples intact.
    def render(markdown, page_id)
      markdown = markdown.gsub(/^([ \t]*)<(unknown|link-preview|bookmark|embed|video|audio)\b([^<>\r\n]*?)(?:\/>|>(.*?)<\/\2>)[ \t]*\r?$/m) do
        indent, tag, attributes, caption = Regexp.last_match.captures
        source = attribute(attributes, tag.match?(/\A(?:unknown|link-preview)\z/) ? "url" : "source")
        rendered = tag == "unknown" ? render_unknown(source, page_id) : render_external(source, tag, caption)
        rendered ? "#{indent}#{rendered}" : "#{indent}#{unavailable}"
      end
      render_containers(markdown)
    end

    def self.block_id(source)
      uri = URI.parse(source.to_s)
      return unless uri.is_a?(URI::HTTPS) && uri.userinfo.nil? && uri.port == 443 && NOTION_HOSTS.include?(uri.host.to_s.downcase)

      token = uri.fragment || uri.path.split("/").last
      NotionPublish.normalize_uuid(token) if token&.match?(UUID_FRAGMENT)
    rescue URI::InvalidURIError
      nil
    end

    private

    def render_unknown(source, page_id)
      id = self.class.block_id(source)
      return unless id

      block = @blocks.fetch(id) { @blocks[id] = lookup_block(id) }
      type = block&.fetch("type", nil)
      details = block&.fetch(type, nil)
      if EXTERNAL_TYPES.include?(type) && details.is_a?(Hash) && belongs_to_post?(block, page_id)
        url = %w[video audio].include?(type) ? details.dig("external", "url") : details["url"]
        if url.is_a?(String) && !url.empty?
          caption = Array(details["caption"]).filter_map { |text| text["plain_text"] }.join
          return render_external(url, type, caption) || notion_link(source)
        end
      end

      # These URLs are explicitly supplied by the author, keyed to this page and block.
      override = @links.dig(page_id, id.delete("-"), "url")
      (override && render_external(override, "link_preview", nil)) || notion_link(source)
    end

    def lookup_block(id)
      @client.block(id)
    rescue Error => error
      warn "Notion block #{id}: #{error.message}"
      nil
    end

    def belongs_to_post?(block, page_id)
      12.times do
        parent = block&.fetch("parent", nil)
        return false unless parent.is_a?(Hash)
        return parent["page_id"] == page_id if parent["type"] == "page_id"
        return false unless parent["type"] == "block_id" && parent["block_id"].to_s.match?(UUID_FRAGMENT)

        id = NotionPublish.normalize_uuid(parent["block_id"])
        block = @blocks.fetch(id) { @blocks[id] = lookup_block(id) }
      end
      false
    end

    def render_external(source, type, caption)
      uri = public_url(source)
      return unless uri

      host = uri.host.downcase
      return github_link(uri) if GITHUB_HOSTS.include?(host)
      return youtube(uri) if YOUTUBE_HOSTS.include?(host)
      return spotify(uri) if host == "open.spotify.com"
      return figma(uri) if FIGMA_HOSTS.include?(host)
      return if %w[video audio].include?(type) || host.match?(/(?:\A|\.)(?:amazonaws\.com|notion-static\.com)\z/i)

      title = CGI.unescapeHTML(caption.to_s).split.join(" ")
      external_link(clean_url(uri), title.empty? ? host : title, type == "bookmark" ? "Bookmark" : "External link")
    end

    def github_link(uri)
      owner, name, *rest = uri.path.split("/").reject(&:empty?)
      return unless owner&.match?(GITHUB_OWNER) && name&.match?(GITHUB_REPOSITORY) && !%w[. ..].include?(name)

      repo = @github.public_repository(owner, name)
      return unless repo

      return external_link(clean_url(uri), repo["full_name"], "GitHub") unless rest.empty?

      description = repo["description"].to_s.strip
      language = repo["language"].to_s.strip
      subtitle = language.empty? ? "GitHub" : "GitHub · #{language}"
      summary = description.empty? ? "" : %(<span>#{escape(description)}</span>)
      %(<div class="notion-preview"><a class="notion-preview-link" href="https://github.com/#{escape(repo.fetch('full_name'))}" rel="noopener noreferrer"><small>#{escape(subtitle)}</small><strong>#{escape(repo.fetch('full_name'))}</strong>#{summary}</a></div>)
    end

    def youtube(uri)
      id = if uri.host.downcase == "youtu.be"
        uri.path.delete_prefix("/")
      elsif uri.path == "/watch"
        URI.decode_www_form(uri.query.to_s).find { |key, _| key == "v" }&.last
      else
        uri.path[%r{\A/(?:embed|shorts|live)/([^/]+)\z}, 1]
      end
      return unless id&.match?(/\A[a-z\d_-]{11}\z/i)

      player("https://www.youtube-nocookie.com/embed/#{id}", "https://www.youtube.com/watch?v=#{id}", "YouTube", "youtube")
    rescue ArgumentError
      nil
    end

    def spotify(uri)
      match = uri.path.match(%r{\A/(?:intl-[a-z]{2}/)?(?:embed/)?(track|album|artist|playlist|episode|show)/([a-zA-Z0-9]{22})/?\z})
      return unless match

      path = "#{match[1]}/#{match[2]}"
      player("https://open.spotify.com/embed/#{path}", "https://open.spotify.com/#{path}", "Spotify", "spotify")
    end

    def figma(uri)
      match = uri.path.match(%r{\A/(design|file|proto|board|slides)/([a-zA-Z0-9]{6,64})(?:/|\z)})
      return unless match

      external_link("https://www.figma.com/#{match[1]}/#{match[2]}", "Open in Figma", "Figma")
    end

    def player(embed, url, name, service)
      %(<div class="notion-preview notion-player notion-player-#{service}"><iframe src="#{escape(embed)}" title="#{name} player" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe><a href="#{escape(url)}" rel="noopener noreferrer">Open on #{name}</a></div>)
    end

    def external_link(url, title, label)
      %(<div class="notion-preview"><a class="notion-preview-link" href="#{escape(url)}" rel="noopener noreferrer"><small>#{escape(label)}</small><strong>#{escape(title)}</strong></a></div>)
    end

    def notion_link(source)
      uri = public_url(source)
      return unless uri && NOTION_HOSTS.include?(uri.host.downcase)

      uri.query = nil
      uri.fragment = nil unless uri.fragment&.match?(UUID_FRAGMENT)
      external_link(uri.to_s, "View block in Notion", "Notion")
    end

    def render_containers(markdown)
      markdown = markdown.gsub(/^([ \t]*)<(callout|toggle)(\b[^>\r\n]*)>([^\r\n]*?)<\/\2>[ \t]*\r?$/, "\\1<\\2\\3>\\4\n\\1</\\2>")
      markdown = markdown.gsub(/^([ \t]*)<callout\b([^>\r\n]*)>([^\r\n]*)/) do
        indent, attributes, title = Regexp.last_match.captures
        color = attribute(attributes, "color").to_s.split(/[_-]/).first
        tone = { "green" => "tip", "yellow" => "warning", "orange" => "warning", "red" => "danger", "purple" => "important" }.fetch(color, "note")
        %(#{indent}<blockquote class="prompt-#{tone}" markdown="1">\n#{indent}#{title})
      end
      markdown = markdown.gsub(/^([ \t]*)<\/callout>[ \t]*\r?$/, '\1</blockquote>')
      markdown = markdown.gsub(/^([ \t]*<toggle\b[^>\r\n]*>)[ \t]*\r?\n([^\r\n]+)(?=\r?$)/) do |opening|
        tag, next_line = Regexp.last_match.captures
        next_line.strip == "</toggle>" ? opening : "#{tag}#{next_line.strip}"
      end
      markdown = markdown.gsub(/^([ \t]*)<toggle\b[^>\r\n]*>([^\r\n]*)/) do
        indent, title = Regexp.last_match.captures
        title = "Details" if title.strip.empty? || title.strip == "<p />"
        # A summary is generated HTML, so render its title as escaped plain text.
        title = title.gsub(%r{</?(?:b|i|s|u|code)>}, "")
        %(#{indent}<details class="notion-toggle" markdown="1">\n#{indent}<summary>#{escape(CGI.unescapeHTML(title))}</summary>\n)
      end
      markdown = markdown.gsub(/^([ \t]*)<\/toggle>[ \t]*\r?$/, '\1</details>')
      markdown = markdown.gsub(/^([ \t]*)<synced-block(?:-reference)?\b([^<>\r\n]*?)(?:\/>|>[ \t]*\r?\n[ \t\r\n]*<\/synced-block(?:-reference)?>)/) do
        indent, attributes = Regexp.last_match.captures
        "#{indent}#{notion_link(attribute(attributes, 'url')) || unavailable}"
      end
      markdown.gsub(/^([ \t]*)<\/?synced-block(?:-reference)?\b[^>\r\n]*>[ \t]*\r?$/, '')
    end

    def attribute(attributes, name)
      value = attributes.match(/(?:\A|\s)#{Regexp.escape(name)}\s*=\s*(?:"([^"]*)"|'([^']*)')/)
      CGI.unescapeHTML(value[1] || value[2]) if value
    end

    def public_url(source)
      uri = URI.parse(source.to_s)
      host = uri.host.to_s.downcase
      return unless uri.is_a?(URI::HTTPS) && uri.userinfo.nil? && uri.port == 443 && host.match?(PUBLIC_HOST)
      return if host.match?(/\.(?:localhost|local|internal|lan|home|test|invalid|onion)\z/i)

      uri
    rescue URI::InvalidURIError
      nil
    end

    def clean_url(uri)
      uri.dup.tap { |url| url.query = url.fragment = nil }.to_s
    end

    def escape(value)
      CGI.escapeHTML(value.to_s)
    end

    def unavailable
      '<p class="notion-preview-unavailable">Embedded content unavailable.</p>'
    end
  end
end
