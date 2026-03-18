import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeFilters, serializeFilter } from "../src/filter.js";

describe("serializeFilter", () => {
  it("serializes scalar, array, and operator values", () => {
    const filter = serializeFilter({
      publication_year: 2024,
      type: ["article", "book"],
      cited_by_count: { gt: 10 },
      is_oa: true,
      open_access_oa_status: { not: "closed" },
      cited_by_percentile_year: { range: [90, 100] },
    });

    assert.equal(
      filter,
      "publication_year:2024,type:article|book,cited_by_count:>10,is_oa:true,open_access_oa_status:!closed,cited_by_percentile_year:90-100",
    );
  });

  it("passes through trimmed string filters", () => {
    assert.equal(
      serializeFilter(" publication_year:2024,type:article "),
      "publication_year:2024,type:article",
    );
  });

  it("merges filter fragments with commas", () => {
    assert.equal(
      mergeFilters("publication_year:2024", {
        type: "article",
        cited_by_count: { gte: 5 },
      }),
      "publication_year:2024,type:article,cited_by_count:>=5",
    );
  });
});
