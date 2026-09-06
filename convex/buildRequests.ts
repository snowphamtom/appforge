import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const ingest = mutation({
  args: {
    fromEmail: v.string(),
    subject: v.string(),
    body: v.string(),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('buildRequests', {
      fromEmail: args.fromEmail,
      subject: args.subject,
      body: args.body,
      prompt: args.prompt,
      status: args.prompt ? 'accepted' : 'rejected',
      receivedAt: Date.now(),
    });
  },
});

export const pending = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('buildRequests')
      .withIndex('by_status', (q) => q.eq('status', 'accepted'))
      .take(50);
  },
});
