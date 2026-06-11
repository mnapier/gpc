import { describe, it, expect } from "vitest";
import { annotateListResult, moreResultsFooter, formatMoney, formatOutput } from "../src/output.js";

describe("annotateListResult", () => {
  it("adds meta.count matching the items length and preserves the descriptive key", () => {
    const result = annotateListResult({ users: [{ email: "a" }, { email: "b" }] }, "users", "none");
    expect(result["users"]).toHaveLength(2);
    expect(result["meta"]).toEqual({ count: 2 });
  });

  it("normalizes nextPageToken to null when absent", () => {
    const result = annotateListResult({ reviews: [{ id: 1 }] }, "reviews", "none");
    expect(result["nextPageToken"]).toBeNull();
  });

  it("preserves a present nextPageToken", () => {
    const result = annotateListResult(
      { reviews: [{ id: 1 }], nextPageToken: "CIDA" },
      "reviews",
      "none",
    );
    expect(result["nextPageToken"]).toBe("CIDA");
  });

  it("adds a message only when the result set is empty", () => {
    const empty = annotateListResult({ reviews: [] }, "reviews", "No reviews found");
    expect(empty["message"]).toBe("No reviews found");
    expect(empty["meta"]).toEqual({ count: 0 });

    const nonEmpty = annotateListResult({ reviews: [{ id: 1 }] }, "reviews", "No reviews found");
    expect(nonEmpty["message"]).toBeUndefined();
  });

  it("treats a missing items key as empty", () => {
    const result = annotateListResult({}, "items", "Nothing here");
    expect(result["meta"]).toEqual({ count: 0 });
    expect(result["message"]).toBe("Nothing here");
  });
});

describe("moreResultsFooter", () => {
  it("returns undefined when there is no continuation token", () => {
    expect(moreResultsFooter(undefined)).toBeUndefined();
    expect(moreResultsFooter(null)).toBeUndefined();
    expect(moreResultsFooter("")).toBeUndefined();
  });

  it("returns an actionable footer naming the token when present", () => {
    const footer = moreResultsFooter("CIDA123");
    expect(footer).toContain("--next-page CIDA123");
    expect(footer).toContain("More results available");
  });
});

describe("formatMoney", () => {
  it("uses 2 decimals for common currencies (USD)", () => {
    expect(formatMoney("4", 990000000, "USD")).toBe("4.99");
  });

  it("uses 0 decimals for JPY (no minor unit)", () => {
    expect(formatMoney("100", 0, "JPY")).toBe("100");
  });

  it("uses 3 decimals for KWD/BHD", () => {
    expect(formatMoney("1", 500000000, "KWD")).toBe("1.500");
    expect(formatMoney("2", 250000000, "BHD")).toBe("2.250");
  });

  it("is case-insensitive on the currency code", () => {
    expect(formatMoney("100", 0, "jpy")).toBe("100");
  });

  it("defaults to 2 decimals when the currency is unknown or omitted", () => {
    expect(formatMoney("5", 0)).toBe("5.00");
    expect(formatMoney("5", 0, "ZZZ")).toBe("5.00");
  });

  it("handles missing units/nanos", () => {
    expect(formatMoney(undefined, undefined, "USD")).toBe("0.00");
  });
});

describe("CSV/TSV formula-injection guard", () => {
  it("prefixes formula-leading cells with a single quote in CSV", () => {
    expect(formatOutput([{ text: "=HYPERLINK(1)" }], "csv")).toContain("'=HYPERLINK(1)");
    expect(formatOutput([{ a: "+1" }], "csv")).toContain("'+1");
    expect(formatOutput([{ a: "-cmd" }], "csv")).toContain("'-cmd");
    expect(formatOutput([{ a: "@x" }], "csv")).toContain("'@x");
  });

  it("guards formula-leading cells in TSV too", () => {
    expect(formatOutput([{ a: "=cmd" }], "tsv")).toContain("'=cmd");
  });

  it("leaves ordinary text and the header row unquoted", () => {
    const out = formatOutput([{ name: "hello" }], "csv");
    expect(out).toContain("hello");
    expect(out).not.toContain("'hello");
    expect(out).not.toContain("'name"); // header keys are code-controlled
  });
});
