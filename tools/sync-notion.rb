# frozen_string_literal: true

require "cgi"
require "digest"
require "fileutils"
require "json"
require "net/http"
require "pathname"
require "time"
require "tmpdir"
require "yaml"

module NotionPublish
  class Error < StandardError; end

  REQUESTED_AT = "발행 요청 시각"
  SLUG = /\A[a-z0-9]+(?:-[a-z0-9]+)*\z/
  POSTS = Pathname("_posts/notion")
  IMAGES = Pathname("assets/img/posts/notion")
  FRONT_MATTER = /\A---\r?\n(.*?)\r?\n---(?:\r?\n|\z)/m

  class Client
    API = "https://api.notion.com/v1"
    VERSION = "2026-03-11"
    MAX_IMAGE_BYTES = 100 * 1024 * 1024
    IMAGE_EXTENSIONS = {
      "image/png" => ".png",
      "image/jpeg" => ".jpg",
      "image/gif" => ".gif",
      "image/webp" => ".webp",
      "image/avif" => ".avif"
    }.freeze

    def initialize(token)
      @token = token
    end

    def requested_pages(data_source)
      return enum_for(__method__, data_source) unless block_given?

      parameters = {
        "filter" => {
          "property" => REQUESTED_AT,
          "date" => { "on_or_before" => Time.now.utc.iso8601 }
        }
      }

      loop do
        result = api("/data_sources/#{data_source}/query", parameters)
        result.fetch("results").each { |page| yield page }
        break unless result.fetch("has_more")

        parameters["start_cursor"] = result.fetch("next_cursor")
      end
    end

    def markdown(page_id)
      result = api("/pages/#{page_id}/markdown?markdown_version=v2")
      if result["truncated"] || !result.fetch("unknown_block_ids", []).empty?
        raise Error, "Notion omitted blocks from page #{page_id}. Check page access and unsupported blocks."
      end

      result.fetch("markdown")
    end

    def image_download_uri(source)
      if source.start_with?("notion-file-block://")
        block_id = NotionPublish.normalize_uuid(source.delete_prefix("notion-file-block://").split("/", 2).first || "")
        url = api("/blocks/#{block_id}").dig("image", "file", "url")
        uri = URI(url) if url
        raise Error, "Notion did not return a download URL for image block #{block_id}." unless uri && notion_image?(uri)

        return uri
      end

      uri = URI(source)
      uri if notion_image?(uri)
    end

    def download_image(uri, directory)
      request = Net::HTTP::Get.new(uri)
      temporary = directory.join("download")
      extension = nil
      digest = Digest::SHA256.new
      bytes = 0

      connection(uri) do |http|
        http.request(request) do |response|
          raise Error, "Notion image download returned HTTP #{response.code}." unless response.is_a?(Net::HTTPSuccess)

          content_type = response["content-type"].to_s.split(";").first.to_s.strip.downcase
          extension = IMAGE_EXTENSIONS[content_type]
          if extension.nil? && content_type == "application/octet-stream"
            extension = File.extname(uri.path).downcase
            extension = ".jpg" if extension == ".jpeg"
          end
          unless IMAGE_EXTENSIONS.value?(extension)
            raise Error, "Unsupported Notion image format. Use PNG, JPEG, GIF, WebP or AVIF."
          end

          temporary.open("wb") do |file|
            response.read_body do |chunk|
              bytes += chunk.bytesize
              raise Error, "A Notion image exceeds GitHub's 100 MiB file limit." if bytes > MAX_IMAGE_BYTES

              digest.update(chunk)
              file.write(chunk)
            end
          end
        end
      end

      raise Error, "Notion returned an empty image." if bytes.zero?

      filename = "#{digest.hexdigest}#{extension}"
      File.rename(temporary, directory.join(filename))
      filename
    rescue SystemCallError, IOError, Timeout::Error, OpenSSL::SSL::SSLError, SocketError
      raise Error, "Unable to download a Notion image. Try publishing again."
    end

    private

    def notion_image?(uri)
      host = uri.host.to_s.downcase
      return false unless uri.is_a?(URI::HTTPS) && uri.userinfo.nil? && uri.port == 443

      host == "file.notion.so" ||
        host == "notion-static.com" || host.end_with?(".notion-static.com") ||
        (host.match?(/\A(?:[a-z0-9-]+\.)*s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com\z/) &&
          uri.query.to_s.match?(/(?:\A|&)X-Amz-Signature=/i))
    end

    def connection(uri, &block)
      Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 10, read_timeout: 30, &block)
    end

    def api(path, body = nil)
      uri = URI("#{API}#{path}")
      request = body ? Net::HTTP::Post.new(uri) : Net::HTTP::Get.new(uri)
      request["Authorization"] = "Bearer #{@token}"
      request["Notion-Version"] = VERSION
      if body
        request["Content-Type"] = "application/json"
        request.body = JSON.generate(body)
      end

      response = nil
      3.times do |attempt|
        response = connection(uri) { |http| http.request(request) }
        return JSON.parse(response.body) if response.is_a?(Net::HTTPSuccess)
        break unless attempt < 2 && (response.code == "429" || response.is_a?(Net::HTTPServerError))

        sleep(response["retry-after"].to_i.clamp(1, 30))
      end
      raise Error, "Notion API returned HTTP #{response.code} for #{path}. Check the connection and database properties."
    rescue SystemCallError, IOError, Timeout::Error, OpenSSL::SSL::SSLError, SocketError
      raise Error, "Unable to reach the Notion API. Try publishing again."
    end
  end

  class Sync
    PreparedPost = Data.define(:path, :content, :slug, :images)

    def initialize(client, root: Pathname.pwd)
      @client = client
      @root = root
    end

    def run(data_source)
      categories = @root.glob("_tabs/*.md").filter_map { |file| front_matter(file)["category"] }
      published, occupied = existing_posts

      Dir.mktmpdir("notion-posts-") do |temporary|
        prepared = @client.requested_pages(data_source).filter_map do |page|
          page_id = NotionPublish.normalize_uuid(page.fetch("id"))
          old_post = published[page_id]
          request = properties(page, REQUESTED_AT, "date")
          next unless request

          requested_at = timestamp(request.fetch("start"))
          next if requested_at > Time.now
          next if old_post && requested_at <= timestamp(old_post.last.fetch("notion_publish_requested_at"))

          post = prepare(page, page_id, requested_at, old_post, categories, occupied, Pathname(temporary))
          occupied[post.slug] << post.path
          post
        rescue Error => error
          raise Error, "Notion page #{page_id}: #{error.message}"
        end

        prepared.each { |post| write(post) }
        prepared.size
      end
    end

    private

    def front_matter(path)
      match = FRONT_MATTER.match(path.read(encoding: "UTF-8"))
      return {} unless match

      YAML.safe_load(match[1], permitted_classes: [Date, Time]) || {}
    end

    def existing_posts
      published = {}
      occupied = Hash.new { |addresses, slug| addresses[slug] = [] }
      @root.glob("_posts/**/*").each do |path|
        filename = /\A\d{4}-\d{2}-\d{2}-(.+)\.(?:md|markdown|html)\z/i.match(path.basename.to_s)
        next unless path.file? && filename

        metadata = front_matter(path)
        slug = (metadata["slug"] || filename[1]).downcase
        occupied[slug] << path
        permalink = %r{\A/posts/([^/]+)/?\z}.match(metadata["permalink"].to_s)
        occupied[permalink[1].downcase] << path if permalink
        next unless path.dirname == @root.join(POSTS) && metadata["notion_page_id"]

        page_id = NotionPublish.normalize_uuid(metadata.fetch("notion_page_id"))
        raise Error, "More than one generated post uses Notion page #{page_id}." if published.key?(page_id)

        published[page_id] = [path, metadata]
      end
      [published, occupied]
    end

    def properties(page, name, type)
      property = page.fetch("properties").fetch(name, nil)
      raise Error, "Set the Notion property '#{name}' to type '#{type}'." unless property&.fetch("type") == type

      property.fetch(type)
    end

    def plain_text(parts)
      parts.map { |part| part.fetch("plain_text") }.join.strip
    end

    def timestamp(value)
      Time.iso8601(value)
    rescue ArgumentError, TypeError
      raise Error, "'#{REQUESTED_AT}' must include a date and time. Use the Notion publish button."
    end

    def prepare(page, page_id, requested_at, old_post, categories, occupied, temporary)
      title_property = page.fetch("properties").values.find { |entry| entry["type"] == "title" }
      title = plain_text(title_property&.fetch("title") || [])
      raise Error, "Enter the article title." if title.empty?

      category = properties(page, "카테고리", "select")&.fetch("name")
      unless categories.include?(category)
        raise Error, "Choose one of the blog categories: #{categories.join(', ')}."
      end

      tags = properties(page, "태그", "multi_select").map { |tag| tag.fetch("name") }
      description = plain_text(properties(page, "소개", "rich_text"))
      previous_path, previous_metadata = old_post
      slug = previous_metadata ? previous_metadata.fetch("slug") : plain_text(properties(page, "주소", "rich_text"))
      raise Error, "'주소' must contain lowercase letters, digits or hyphens, such as sogeding-2026." unless SLUG.match?(slug)
      if occupied[slug].any? { |path| path != previous_path }
        raise Error, "The address '/posts/#{slug}/' is already in use."
      end
      if !previous_path && @root.join(IMAGES, slug).exist?
        raise Error, "The managed image directory for '#{slug}' already exists."
      end

      date = requested_at.getlocal("+09:00")
      path = previous_path || @root.join(POSTS, "#{date.strftime('%F')}-#{slug}.md")
      metadata = {
        "title" => title,
        "date" => previous_metadata ? previous_metadata.fetch("date") : date.iso8601,
        "last_modified_at" => date.iso8601,
        "categories" => [category],
        "tags" => tags,
        "slug" => slug,
        "render_with_liquid" => false,
        "notion_page_id" => page_id,
        "notion_publish_requested_at" => requested_at.utc.iso8601(9)
      }
      metadata["description"] = description unless description.empty?

      images = temporary.join(slug)
      images.mkdir
      body = rewrite_images(@client.markdown(page_id), slug, images)
      PreparedPost.new(path, "#{YAML.dump(metadata)}---\n\n#{body.strip}\n", slug, images)
    end

    def rewrite_images(markdown, slug, directory)
      downloaded = {}
      replace = lambda do |source|
        return downloaded.fetch(source) if downloaded.key?(source)

        uri = @client.image_download_uri(CGI.unescapeHTML(source))
        return source unless uri

        filename = @client.download_image(uri, directory)
        downloaded[source] = "/#{IMAGES}/#{slug}/#{filename}"
      rescue URI::InvalidURIError
        raise Error, "A Notion image URL is malformed."
      end

      transform = lambda do |text|
        text = render_columns(text)
        text = text.gsub(/^([ \t]*!\[(?:\\.|[^\]\\\n])*\]\()<?(\S+?)>?(\)[ \t]*\r?$)/) do
          match = Regexp.last_match
          "#{match[1]}#{replace.call(match[2])}#{match[3]}"
        end
        text.gsub(/^([ \t]*)<image\b([^>\r\n]*?)(?:\/>|>(.*?)<\/image>)[ \t]*\r?$/m) do
          indentation, attributes, caption = Regexp.last_match.captures
          source = attributes[/(?:\A|\s)source="([^"]+)"/, 1]
          raise Error, "A Notion image is missing its source." unless source

          alt = CGI.unescapeHTML(caption.to_s).gsub(/[\\\[\]]/) { |character| "\\#{character}" }.split.join(" ")
          "#{indentation}![#{alt}](#{replace.call(source)})"
        end
      end

      result = +""
      paragraph = +""
      fence = nil
      markdown.each_line do |line|
        delimiter = line[/\A[ \t]*([~]{3,}|\x60{3,})/, 1]
        if fence
          result << line
          if delimiter && delimiter[0] == fence[0] && delimiter.length >= fence.length &&
             line.strip == delimiter
            fence = nil
          end
        elsif delimiter
          result << transform.call(paragraph) << line
          paragraph.clear
          fence = delimiter
        else
          paragraph << line
        end
      end
      result << transform.call(paragraph)
    end

    def render_columns(markdown)
      markdown = markdown.gsub(/^([ \t]*)<columns>[ \t]*\r?$/, '\1<div class="notion-columns" markdown="1">')
      markdown = markdown.gsub(/^([ \t]*)<column(?: ratio="(\d+(?:\.\d+)?)")?>[ \t]*\r?$/) do
        indentation, ratio = Regexp.last_match.captures
        width = ratio ? %( style="--notion-column-ratio: #{ratio}") : ""
        %(#{indentation}<div class="notion-column"#{width} markdown="1">)
      end
      markdown.gsub(/^([ \t]*)<\/columns?>[ \t]*\r?$/, '\1</div>')
    end

    def write(post)
      image_directory = @root.join(IMAGES, post.slug)
      if post.images.children.any?
        FileUtils.mkdir_p(image_directory)
        post.images.children.each { |image| FileUtils.cp(image, image_directory) }
      end

      FileUtils.mkdir_p(post.path.dirname)
      post.path.write(post.content, encoding: "UTF-8")

      return unless image_directory.directory?

      present = post.images.children.map(&:basename)
      image_directory.children.each do |image|
        next if present.include?(image.basename)
        next unless image.file? && image.basename.to_s.match?(/\A[0-9a-f]{64}\.(?:png|jpg|gif|webp|avif)\z/)

        image.delete
      end
      image_directory.rmdir if image_directory.children.empty?
    end
  end

  def self.normalize_uuid(value)
    compact = value.delete("-").downcase
    raise Error, "Expected a Notion UUID." unless compact.match?(/\A[0-9a-f]{32}\z/)

    [compact[0, 8], compact[8, 4], compact[12, 4], compact[16, 4], compact[20, 12]].join("-")
  end

  def self.run
    token = ENV.fetch("NOTION_TOKEN", "").strip
    source = ENV.fetch("NOTION_DATA_SOURCE_ID", "").strip
    raise Error, "Set NOTION_TOKEN and NOTION_DATA_SOURCE_ID before syncing." if token.empty? || source.empty?

    count = Sync.new(Client.new(token)).run(normalize_uuid(source))
    puts "Prepared #{count} Notion post(s)."
  end
end

if $PROGRAM_NAME == __FILE__
  begin
    NotionPublish.run
  rescue NotionPublish::Error => error
    abort error.message
  end
end
