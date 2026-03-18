import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";
import { OpenAlexClient } from "../src/openalex.js";

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to resolve test server address"));
        return;
      }
      resolve(address.port);
    });
  });
}

describe("OpenAlexClient", () => {
  it("retries retryable responses and appends auth query params", async () => {
    let requestCount = 0;
    let lastUrl = "";
    let lastFromHeader = "";

    const server = http.createServer((req, res) => {
      requestCount += 1;
      lastUrl = req.url ?? "";
      lastFromHeader = String(req.headers.from ?? "");

      if (requestCount === 1) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "try again" }));
        return;
      }

      res.writeHead(200, {
        "content-type": "application/json",
        "x-ratelimit-limit": "10000",
        "x-ratelimit-remaining": "9998",
      });
      res.end(JSON.stringify({ meta: { count: 1 }, results: [{ id: "W1" }] }));
    });

    const port = await listen(server);

    try {
      const client = new OpenAlexClient({
        apiKey: "abc123",
        email: "me@example.com",
        baseUrl: `http://127.0.0.1:${port}`,
        timeoutMs: 1_000,
        maxRetries: 1,
        userAgent: "test-agent",
      });

      const response = await client.getJson("/works", { per_page: 1 });

      assert.equal(requestCount, 2);
      assert.match(lastUrl, /api_key=abc123/);
      assert.match(lastUrl, /per_page=1/);
      assert.equal(lastFromHeader, "me@example.com");
      assert.equal(response.rateLimit.remaining, 9998);
    } finally {
      server.close();
    }
  });

  it("requires OPENALEX_API_KEY for explicitly protected tools", async () => {
    const client = new OpenAlexClient({
      baseUrl: "https://api.openalex.org",
      timeoutMs: 1_000,
      maxRetries: 0,
      userAgent: "test-agent",
    });

    await assert.rejects(() =>
      client.getJson("/rate-limit", {}, { requiresApiKey: true }),
    );
  });
});
