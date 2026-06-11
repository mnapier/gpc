import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";

const mockReplyToReview = vi.fn();
const mockListReviews = vi.fn();

vi.mock("@gpc-cli/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@gpc-cli/core")>();
  return {
    ...actual,
    replyToReview: mockReplyToReview,
    listReviews: mockListReviews,
    getReview: vi.fn().mockResolvedValue({}),
    exportReviews: vi.fn().mockResolvedValue("[]"),
  };
});

vi.mock("@gpc-cli/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@gpc-cli/config")>();
  return {
    ...actual,
    loadConfig: vi.fn().mockResolvedValue({ app: "com.example.app" }),
  };
});

vi.mock("@gpc-cli/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@gpc-cli/auth")>();
  return {
    ...actual,
    resolveAuth: vi.fn().mockResolvedValue({
      getAccessToken: vi.fn().mockResolvedValue("token"),
      getClientEmail: vi.fn().mockReturnValue("test@example.iam.gserviceaccount.com"),
    }),
  };
});

vi.mock("@gpc-cli/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@gpc-cli/api")>();
  return {
    ...actual,
    createApiClient: vi.fn().mockReturnValue({}),
  };
});

describe("reviews reply command", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  function makeProgram() {
    const program = new Command();
    program
      .option("-a, --app <package>", "App package name")
      .option("-o, --output <format>", "Output format")
      .option("-j, --json", "JSON mode")
      .option("--dry-run", "Preview changes without executing")
      .option("--no-interactive", "Disable interactive prompts");
    return program;
  }

  it("sends reply and shows character count", async () => {
    mockReplyToReview.mockResolvedValue({ result: { replyText: "Great app!" } });

    const { registerReviewsCommands } = await import("../src/commands/reviews.js");
    const program = makeProgram();
    registerReviewsCommands(program);

    await program.parseAsync([
      "node",
      "gpc",
      "reviews",
      "reply",
      "review-123",
      "--text",
      "Thank you!",
      "--no-interactive",
    ]);

    expect(mockReplyToReview).toHaveBeenCalledWith(
      expect.anything(),
      "com.example.app",
      "review-123",
      "Thank you!",
    );

    const logCalls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
    const charCountLine = logCalls.find((c: unknown) => String(c).includes("/350 chars"));
    expect(charCountLine).toBeDefined();
    expect(charCountLine).toContain("10/350 chars");
  });

  it("shows dry-run output without calling API", async () => {
    const { registerReviewsCommands } = await import("../src/commands/reviews.js");
    const program = makeProgram();
    registerReviewsCommands(program);

    await program.parseAsync([
      "node",
      "gpc",
      "reviews",
      "reply",
      "review-456",
      "--text",
      "Thanks!",
      "--dry-run",
      "--no-interactive",
    ]);

    expect(mockReplyToReview).not.toHaveBeenCalled();
    const logCalls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
    expect(logCalls.some((c: unknown) => String(c).toLowerCase().includes("dry"))).toBe(true);
  });

  it("outputs JSON in JSON mode (no char count line)", async () => {
    mockReplyToReview.mockResolvedValue({ result: { replyText: "Thanks!" } });

    const { registerReviewsCommands } = await import("../src/commands/reviews.js");
    const program = makeProgram();
    registerReviewsCommands(program);

    await program.parseAsync([
      "node",
      "gpc",
      "reviews",
      "reply",
      "review-789",
      "--text",
      "Thanks!",
      "--output",
      "json",
      "--no-interactive",
    ]);

    const logCalls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
    // In JSON mode, no char count line should appear
    expect(logCalls.some((c: unknown) => String(c).includes("/350 chars"))).toBe(false);

    // Should have JSON output
    const jsonLine = logCalls.find((c: unknown) => {
      try {
        JSON.parse(String(c));
        return true;
      } catch {
        return false;
      }
    });
    expect(jsonLine).toBeDefined();
  });

  it("rejects with error when API call fails", async () => {
    mockReplyToReview.mockRejectedValue(new Error("API error"));

    const { registerReviewsCommands } = await import("../src/commands/reviews.js");
    const program = makeProgram();
    registerReviewsCommands(program);

    await expect(
      program.parseAsync([
        "node",
        "gpc",
        "reviews",
        "reply",
        "review-000",
        "--text",
        "Hello",
        "--no-interactive",
      ]),
    ).rejects.toThrow("API error");
  });
});

describe("reviews list command", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  function makeProgram() {
    const program = new Command();
    program
      .option("-a, --app <package>", "App package name")
      .option("-o, --output <format>", "Output format")
      .option("-j, --json", "JSON mode");
    return program;
  }

  const reviewWithReply = {
    reviewId: "r1",
    authorName: "Alice",
    comments: [
      {
        userComment: {
          text: "x".repeat(120),
          starRating: 5,
          reviewerLanguage: "en",
          thumbsUpCount: 3,
        },
      },
      { developerComment: { text: "Thanks!" } },
    ],
  };
  const reviewNoReply = {
    reviewId: "r2",
    authorName: "Bob",
    comments: [{ userComment: { text: "short", starRating: 2, reviewerLanguage: "fr" } }],
  };

  async function runList(args: string[], result: unknown) {
    mockListReviews.mockResolvedValue(result as never);
    const { registerReviewsCommands } = await import("../src/commands/reviews.js");
    const program = makeProgram();
    registerReviewsCommands(program);
    await program.parseAsync(["node", "gpc", "reviews", "list", ...args]);
    return (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().map(String).join("\n");
  }

  // CSV format is used (not table) because the table formatter truncates wide
  // cells for display, which would hide the marker; CSV exercises the same
  // row-building branch without truncating.
  it("shows hasReply, language, and a truncation marker in row output", async () => {
    const out = await runList(["--output", "csv"], {
      reviews: [reviewWithReply, reviewNoReply],
    });
    expect(out).toContain("[truncated]"); // long review text is marked
    expect(out).toContain("yes"); // r1 has a developer reply
    expect(out).toContain("en");
    expect(out).toContain("fr");
  });

  it("does not truncate when --full-text is set", async () => {
    const out = await runList(["--output", "csv", "--full-text"], {
      reviews: [reviewWithReply],
    });
    expect(out).not.toContain("[truncated]");
    expect(out).toContain("x".repeat(120));
  });

  it("wraps JSON output with meta.count and surfaces nextPageToken", async () => {
    const out = await runList(["--output", "json"], {
      reviews: [reviewNoReply],
      nextPageToken: "TKN",
    });
    const parsed = JSON.parse(out);
    expect(parsed.reviews).toHaveLength(1);
    expect(parsed.meta).toEqual({ count: 1 });
    expect(parsed.nextPageToken).toBe("TKN");
  });

  it("returns a message on empty JSON results", async () => {
    const out = await runList(["--output", "json"], { reviews: [] });
    const parsed = JSON.parse(out);
    expect(parsed.reviews).toEqual([]);
    expect(parsed.message).toBe("No reviews found");
    expect(parsed.meta).toEqual({ count: 0 });
  });
});
