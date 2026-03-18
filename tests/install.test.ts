import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderCodexConfigSnippet } from "../src/install.js";

describe("install helpers", () => {
  it("renders a codex config snippet", () => {
    const block = renderCodexConfigSnippet({
      command: "/usr/bin/node",
      args: ["/repo/dist/src/index.js"],
      cwd: "/repo",
      envVars: ["OPENALEX_API_KEY"],
    });

    assert.match(block, /\[mcp_servers\.openalex\]/);
    assert.match(block, /env_vars = \["OPENALEX_API_KEY"\]/);
    assert.match(block, /cwd = "\/repo"/);
    assert.doesNotMatch(block, /BEGIN openalex-mcp managed block/);
    assert.doesNotMatch(block, /END openalex-mcp managed block/);
  });
});
