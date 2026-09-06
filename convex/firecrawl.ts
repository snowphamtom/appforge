/**
 * Firecrawl action stub — scrape a URL and return markdown for remix seeding.
 * Requires FIRECRAWL_API_KEY in Convex environment.
 */
import { action } from './_generated/server';
import { v } from 'convex/values';

export const scrapeForSeed = action({
  args: { url: v.string() },
  handler: async (_ctx, args) => {
    const key = process.env.FIRECRAWL_API_KEY;
    if (!key) {
      return {
        ok: false as const,
        error:
          'FIRECRAWL_API_KEY not set. Add it in the Convex dashboard, then retry.',
        url: args.url,
      };
    }

    // Real Firecrawl call — enabled once key + convex codegen exist.
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: args.url,
        formats: ['markdown'],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false as const, error: text.slice(0, 400), url: args.url };
    }

    const data = (await res.json()) as {
      data?: { markdown?: string; metadata?: { title?: string } };
    };
    const markdown = data.data?.markdown ?? '';
    const title = data.data?.metadata?.title ?? args.url;
    const promptHint = `A landing page inspired by "${title}": ${markdown.slice(0, 280)}`;

    return {
      ok: true as const,
      url: args.url,
      title,
      markdown: markdown.slice(0, 8000),
      promptHint,
    };
  },
});
