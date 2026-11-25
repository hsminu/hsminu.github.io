# frozen_string_literal: true

require_relative "sync-notion"

# Print a comparison without saving private page bodies, credentials, or outside URLs.
token = ENV.fetch("NOTION_TOKEN", "").strip
abort "Set NOTION_TOKEN in the local environment before running this diagnostic." if token.empty?
abort "Usage: ruby tools/notion_diagnose.rb PAGE_ID BLOCK_ID" unless ARGV.size == 2

begin
  page_id, block_id = ARGV.map { |id| NotionPublish.normalize_uuid(id) }
rescue NotionPublish::Error => error
  abort error.message
end
client = NotionPublish::Client.new(token)
report = { "notion_version" => NotionPublish::Client::VERSION, "block_id" => block_id }
report["markdown"] = %w[v1 v2].to_h do |version|
  result = client.markdown_response(page_id, version: version)
  urls = result.fetch("markdown").scan(/<unknown\b[^>]*\burl="([^"]+)"[^>]*>/).flatten
  [version, {
    "truncated" => result["truncated"],
    "unknown_block_count" => result.fetch("unknown_block_ids", []).length,
    "target_has_unknown_tag" => urls.any? { |url| NotionPublish::BlockRenderer.block_id(CGI.unescapeHTML(url)) == block_id }
  }]
rescue NotionPublish::Error => error
  [version, { "error" => error.message }]
end

begin
  block = client.block(block_id)
  type = block.fetch("type")
  attributes = block[type].is_a?(Hash) ? block[type] : {}
  report["block"] = { "type" => type, "has_children" => block["has_children"], "fields" => attributes.keys.sort }
  source = attributes["url"] || attributes.dig("external", "url")
  report["block"]["source_url_present"] = source.is_a?(String) && !source.empty?
  match = source.to_s.match(%r{\Ahttps://github\.com/([a-zA-Z0-9-]+)/([a-zA-Z0-9_.-]+)/?\z})
  if match && NotionPublish::GitHubRepositories.new.public_repository(match[1], match[2])
    report["block"]["public_github_url"] = source
  end
rescue NotionPublish::Error => error
  report["block"] = { "error" => error.message }
end

puts JSON.pretty_generate(report)
