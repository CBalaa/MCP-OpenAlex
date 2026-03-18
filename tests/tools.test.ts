import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleToolCall } from "../src/tools.js";
import type { OpenAlexClient } from "../src/openalex.js";

describe("tool handlers", () => {
  it("merges the cites filter for citing works queries", async () => {
    const calls: Array<{
      path: string;
      query: Record<string, unknown>;
      options?: Record<string, unknown>;
    }> = [];

    const fakeClient: Pick<OpenAlexClient, "getJson"> = {
      async getJson(path, query, options) {
        calls.push({ path, query, options });
        return {
          data: { meta: { count: 1 }, results: [{ id: "W2" }] },
          path,
          url: "https://api.openalex.org/works?filter=publication_year:2024,cites:W123",
          status: 200,
          rateLimit: {},
        };
      },
    };

    const result = await handleToolCall(
      "openalex_get_citing_works",
      {
        work_id: "https://openalex.org/W123",
        filter: { publication_year: 2024 },
        per_page: 5,
      },
      { client: fakeClient as OpenAlexClient },
    );

    assert.equal(result.isError, false);
    assert.equal(calls[0]?.path, "/works");
    assert.equal(
      calls[0]?.query.filter,
      "publication_year:2024,cites:W123",
    );
    assert.equal(calls[0]?.query.per_page, 5);
  });

  it("returns an MCP error result for invalid raw paths", async () => {
    const fakeClient: Pick<OpenAlexClient, "getJson"> = {
      async getJson() {
        throw new Error("should not be called");
      },
    };

    const result = await handleToolCall(
      "openalex_raw_request",
      { path: "works" },
      { client: fakeClient as OpenAlexClient },
    );

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /must start with "\/"/);
  });
});
