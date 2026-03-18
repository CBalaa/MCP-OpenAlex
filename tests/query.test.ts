import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildUrl } from "../src/query.js";

describe("buildUrl", () => {
  it("builds query strings with structured filters and arrays", () => {
    const url = buildUrl(
      "https://api.openalex.org",
      "/works",
      {
        filter: {
          publication_year: 2024,
          type: ["article", "book"],
        },
        select: ["id", "display_name"],
        per_page: 25,
      },
      "secret-key",
    );

    assert.equal(
      url,
      "https://api.openalex.org/works?filter=publication_year%3A2024%2Ctype%3Aarticle%7Cbook&select=id%2Cdisplay_name&per_page=25&api_key=secret-key",
    );
  });

  it("rejects non-absolute api paths", () => {
    assert.throws(() => {
      buildUrl("https://api.openalex.org", "works", {});
    });
  });
});
