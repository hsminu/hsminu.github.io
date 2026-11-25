# frozen_string_literal: true

require "digest"

class WorkspaceTagNavigation < Jekyll::Generator
  safe true
  priority :lowest

  COLORS = %w[red orange yellow green blue purple gray].freeze

  def generate(site)
    overrides = site.data["tag_colors"] || {}
    tags = Array(site.config["archives"]).filter_map do |archive|
      next unless archive.type == "tag"

      posts = archive.posts.select do |post|
        post.published? && !post.draft? && post.data["hidden"] != true && post.date <= site.time
      end.uniq
      archive.data["workspace_tag_posts"] = posts

      name = archive.title
      color = overrides[name]
      unless COLORS.include?(color)
        digest = Digest::SHA256.digest(name.unicode_normalize(:nfc))
        color = COLORS[digest.unpack1("N") % COLORS.size]
      end
      tag = { "name" => name, "url" => archive.url, "count" => posts.size, "color" => color }
      archive.data["workspace_tag"] = tag
      tag unless posts.empty?
    end

    # One name order for Finder rows, post-count ties, and the sidebar.
    alphabetized_tags = tags.sort_by do |tag|
      name = tag.fetch("name")
      folded_name = name.downcase(:fold).unicode_normalize(:nfd).gsub(/\p{M}/, "").unicode_normalize(:nfc)
      [folded_name, name]
    end
    alphabetized_tags.each_with_index { |tag, index| tag["name_order"] = index }
    site.data["workspace_tags"] = tags.sort_by { |tag| [-tag.fetch("count"), tag.fetch("name_order")] }
  end
end
