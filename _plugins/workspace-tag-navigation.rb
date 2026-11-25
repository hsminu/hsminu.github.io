# frozen_string_literal: true

class WorkspaceTagNavigation < Jekyll::Generator
  safe true
  priority :lowest

  def generate(site)
    tags = Array(site.config["archives"]).filter_map do |archive|
      next unless archive.type == "tag"

      posts = archive.posts.select do |post|
        post.published? && !post.draft? && post.data["hidden"] != true && post.date <= site.time
      end.uniq
      archive.data["workspace_tag_posts"] = posts
      next if posts.empty?

      name = archive.title
      { "name" => name, "url" => archive.url, "count" => posts.size }
    end

    site.data["workspace_frequent_tags"] = tags.sort_by do |tag|
      [-tag.fetch("count"), tag.fetch("name").downcase, tag.fetch("name")]
    end.first(4)
  end
end
