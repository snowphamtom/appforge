/**
 * Firecrawl integration — fetch-from-URL remix seeds.
 *
 * v0: stub that derives a prompt hint from the URL host/path (no API key).
 * Wire FIRECRAWL_API_KEY + Convex action `seedFromUrl` for real scrapes.
 *
 * @see https://docs.firecrawl.dev
 */

export interface UrlSeedResult {
  promptHint: string;
  message: string;
  sourceUrl: string;
  /** When Convex+Firecrawl are live, markdown/content lands here */
  contentPreview?: string;
}

export async function seedFromUrl(url: string): Promise<UrlSeedResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Enter a valid URL (https://…)');
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new Error('Only http(s) URLs are supported');
  }

  // Stub: no network scrape without API key / Convex action.
  // Shape the prompt so the local generator still produces something useful.
  const host = parsed.hostname.replace(/^www\./, '');
  const pathBits = parsed.pathname
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/[-_]/g, ' '))
    .slice(0, 3)
    .join(' ');

  const promptHint = pathBits
    ? `A landing page inspired by ${host} — ${pathBits}`
    : `A landing page inspired by ${host}`;

  return {
    sourceUrl: parsed.toString(),
    promptHint,
    message: 'URL seeded locally (Firecrawl stub). Wire convex/firecrawl.ts for live scrapes.',
  };
}
