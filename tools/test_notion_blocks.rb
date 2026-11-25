# frozen_string_literal: true

require "minitest/autorun"
require_relative "sync-notion"

class NotionBlocksTest < Minitest::Test
  PAGE = "421ffcd8-6341-8079-be56-d91e4a8c18f7"
  BLOCK = "423ffcd8-6341-8086-8c67-c926c642c54d"
  SOURCE = "https://app.notion.com/p/#{PAGE.delete('-')}##{BLOCK.delete('-')}"
  UNKNOWN = %(<unknown url="#{SOURCE}" alt="external_object_instance" />)

  class FixtureClient < NotionPublish::Client
    attr_reader :requests

    def initialize(block)
      super("fixture")
      @block = { "parent" => { "type" => "page_id", "page_id" => PAGE } }.merge(block)
      @requests = []
    end

    private

    def api(path, _body = nil)
      @requests << path
      return @block if path.start_with?("/blocks/")

      { "markdown" => UNKNOWN, "truncated" => false, "unknown_block_ids" => [] }
    end
  end

  class FixtureGitHub
    attr_reader :requests

    def initialize
      @requests = []
    end

    def public_repository(owner, repo)
      @requests << [owner, repo]
      return unless repo == "public-repo"

      { "full_name" => "#{owner}/#{repo}", "language" => "Ruby", "description" => "public <img src=x onerror=bad()> & docs" }
    end
  end

  def setup
    @github = FixtureGitHub.new
  end

  def render(text, block: { "type" => "unsupported", "unsupported" => {} }, links: {})
    @client = FixtureClient.new(block)
    NotionPublish::BlockRenderer.new(@client, links: links, github: @github).render(text, PAGE)
  end

  def test_block_id_extraction_and_api_versions
    assert_equal BLOCK, NotionPublish::BlockRenderer.block_id(SOURCE)
    assert_equal BLOCK, NotionPublish::BlockRenderer.block_id("https://www.notion.so/#{BLOCK}")
    assert_nil NotionPublish::BlockRenderer.block_id("https://app.notion.com.invalid/p/#{BLOCK}")
    assert_nil NotionPublish::BlockRenderer.block_id("https://user@app.notion.com/p/#{BLOCK}")

    client = FixtureClient.new({ "type" => "unsupported" })
    client.markdown_response(PAGE, version: "v1")
    assert_equal UNKNOWN, client.markdown(PAGE)
    client.block(BLOCK.delete("-"))
    client.block(BLOCK)
    assert_equal ["/pages/#{PAGE}/markdown?markdown_version=v1", "/pages/#{PAGE}/markdown?markdown_version=v2", "/blocks/#{BLOCK}"], client.requests
  end

  def test_hybrid_reads_github_link_preview_and_escapes_public_metadata
    output = render(UNKNOWN, block: { "type" => "link_preview", "link_preview" => { "url" => "https://github.com/hsminu/public-repo" } })
    assert_includes output, 'href="https://github.com/hsminu/public-repo"'
    assert_includes output, "GitHub · Ruby"
    assert_includes output, "&lt;img src=x onerror=bad()&gt; &amp; docs"
    refute_includes output, "<img"
    assert_equal ["/blocks/#{BLOCK}"], @client.requests
  end

  def test_unverified_repository_is_not_exposed
    links = { PAGE => { BLOCK.delete("-") => { "url" => "https://github.com/hsminu/public-repo" } } }
    output = render(UNKNOWN, links: links, block: { "type" => "link_preview", "link_preview" => { "url" => "https://github.com/hsminu/private-repo" } })
    assert_includes output, "View block in Notion"
    refute_includes output, "private-repo"
    refute_includes output, "public-repo"

    assert_includes render(UNKNOWN, links: links), 'href="https://github.com/hsminu/public-repo"'
    assert_includes render(UNKNOWN), "View block in Notion"
  end

  def test_external_data_from_another_notion_page_is_not_copied
    block = {
      "type" => "embed",
      "embed" => { "url" => "https://example.org/private-notes" },
      "parent" => { "type" => "page_id", "page_id" => "a1044e38-2616-47c1-b751-1d4c6c29e38f" }
    }
    output = render(UNKNOWN, block: block)
    assert_includes output, "View block in Notion"
    refute_includes output, "private-notes"
  end

  def test_external_urls_use_per_provider_policy
    input = <<~MARKDOWN
      <link-preview url="https://www.youtube.com/watch?v=dQw4w9WgXcQ&amp;t=120" source="youtube" />

      <audio source="https://open.spotify.com/episode/7makk4oTQel546B0PZlDM5?si=secret" />

      <embed source="https://www.figma.com/design/ABC123xyz/File?token=secret" />

      <bookmark source="https://example.org/notes?access_token=secret">
      Example &amp; notes
      </bookmark>

      <embed source="https://example.org/player" />
    MARKDOWN
    output = render(input)
    assert_includes output, 'src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"'
    assert_includes output, 'src="https://open.spotify.com/embed/episode/7makk4oTQel546B0PZlDM5"'
    assert_includes output, 'href="https://www.figma.com/design/ABC123xyz"'
    assert_includes output, 'href="https://example.org/notes"'
    assert_includes output, "Example &amp; notes"
    assert_includes output, 'href="https://example.org/player"'
    assert_equal 2, output.scan("<iframe").length
    assert_equal 2, output.scan('sandbox="').length
    refute_includes output, "secret"
    assert_empty @client.requests
  end

  def test_invalid_and_signed_sources_are_not_rendered_or_fetched
    %w[javascript:alert(1) http://example.org/ https://127.0.0.1/ https://169.254.169.254/ https://a.internal/ https://notion.so@evil.org/ https://example.org:444/ https://bucket.s3.amazonaws.com/private?X-Amz-Signature=not-public].each do |source|
      output = render(%(<embed source="#{source}" />))
      assert_includes output, "Embedded content unavailable."
      refute_includes output, source
      assert_empty @client.requests
    end
    assert_empty @github.requests
  end

  def test_markdown_containers_keep_content_and_only_link_thin_synced_references
    input = <<~MARKDOWN
      <callout color="yellow_bg">
      Read this first.

      **Body**
      </callout>

      <toggle heading="h2">
      <b>Title</b> &lt;unsafe&gt;

      Toggle body
      </toggle>

      <synced-block url="#{SOURCE}">
      Included copy
      </synced-block>

      <synced-block-reference url="#{SOURCE}">
      </synced-block-reference>
    MARKDOWN
    output = render(input)
    assert_includes output, '<blockquote class="prompt-warning" markdown="1">'
    assert_includes output, '**Body**'
    assert_includes output, '<summary>Title &lt;unsafe&gt;</summary>'
    assert_includes output, "Toggle body"
    assert_includes output, "Included copy"
    assert_equal 1, output.scan("View block in Notion").length
    refute_match(/<\/?synced-block/, output)
    assert_empty @client.requests
  end

  def test_sync_does_not_transform_fenced_examples_and_keeps_columns
    client = FixtureClient.new({ "type" => "unsupported" })
    source = "<columns>\n<column ratio=\"50\">\nText\n</column>\n</columns>\n\n```html\n#{UNKNOWN}\n```\n"
    result = NotionPublish::Sync.new(client).send(:rewrite_blocks, source, PAGE, "fixture", nil)
    assert_includes result, 'class="notion-column" style="--notion-column-ratio: 50"'
    assert_includes result, "```html\n#{UNKNOWN}\n```"
    assert_empty client.requests
  end
end
