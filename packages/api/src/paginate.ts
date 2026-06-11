export interface PaginateOptions {
  limit?: number;
  startPageToken?: string;
}

export async function* paginate<TItem>(
  fetchPage: (pageToken?: string) => Promise<{ items: TItem[]; nextPageToken?: string }>,
  options?: PaginateOptions,
): AsyncGenerator<TItem[], void, unknown> {
  let pageToken = options?.startPageToken;
  let collected = 0;
  const limit = options?.limit;

  for (;;) {
    if (limit !== undefined && collected >= limit) break;

    const page = await fetchPage(pageToken);
    const items = page.items;

    if (items.length === 0) break;

    if (limit !== undefined) {
      const remaining = limit - collected;
      if (items.length > remaining) {
        yield items.slice(0, remaining);
        return;
      }
    }

    yield items;
    collected += items.length;
    pageToken = page.nextPageToken;

    if (!pageToken) break;
  }
}

export async function paginateAll<TItem>(
  fetchPage: (pageToken?: string) => Promise<{ items: TItem[]; nextPageToken?: string }>,
  options?: PaginateOptions,
): Promise<{ items: TItem[]; nextPageToken?: string }> {
  const limit = options?.limit;
  const allItems: TItem[] = [];
  let pageToken = options?.startPageToken;

  // Track the continuation token directly here rather than delegating to the
  // `paginate` generator, which yields item arrays and therefore cannot surface
  // the page token when it stops. Returning a usable token lets callers resume
  // a limited list (e.g. `--limit N --next-page <token>`).
  for (;;) {
    const page = await fetchPage(pageToken);
    const items = page.items;

    // No items: exhausted (or an empty page). Nothing left to resume from.
    if (items.length === 0) {
      return { items: allItems, nextPageToken: undefined };
    }

    if (limit !== undefined && allItems.length + items.length >= limit) {
      // This page reaches the limit. Take exactly what's needed and stop.
      const remaining = limit - allItems.length;
      allItems.push(...items.slice(0, remaining));
      // Page-granular continuation: resume from the page after this one. If the
      // limit truncated this page mid-way, the remainder is not included in the
      // continuation -- use the no-limit / auto-paginate path for gapless
      // traversal. This matches the Google API's page-token model.
      return { items: allItems, nextPageToken: page.nextPageToken };
    }

    allItems.push(...items);

    // Genuinely exhausted: the last page carried no continuation token.
    if (!page.nextPageToken) {
      return { items: allItems, nextPageToken: undefined };
    }
    pageToken = page.nextPageToken;
  }
}

/**
 * Fetch multiple known pages in parallel.
 * Useful when page tokens are predictable or when pre-fetching subsequent pages
 * after an initial sequential fetch reveals the token pattern.
 *
 * @param fetchPage - Function that fetches a page given a token
 * @param pageTokens - Array of page tokens to fetch concurrently
 * @param concurrency - Max concurrent requests (default: 4)
 */
export async function paginateParallel<TItem>(
  fetchPage: (pageToken?: string) => Promise<{ items: TItem[]; nextPageToken?: string }>,
  pageTokens: string[],
  concurrency = 4,
): Promise<{ items: TItem[]; nextPageToken?: string }> {
  const allItems: TItem[] = [];
  let lastNextPageToken: string | undefined;

  // Process in batches of `concurrency`
  for (let i = 0; i < pageTokens.length; i += concurrency) {
    const batch = pageTokens.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((token) => fetchPage(token)));

    for (const result of results) {
      allItems.push(...result.items);
      if (result.nextPageToken) {
        lastNextPageToken = result.nextPageToken;
      }
    }
  }

  return { items: allItems, nextPageToken: lastNextPageToken };
}
