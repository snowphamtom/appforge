/**
 * Convex mutations/queries for projects & generations.
 * Activate with `npx convex dev` once CONVEX_DEPLOYMENT is available.
 */
import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query('projects')
      .withIndex('by_created')
      .order('desc')
      .take(limit);
  },
});

export const get = query({
  args: { id: v.id('projects') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    prompt: v.string(),
    title: v.string(),
    kind: v.string(),
    html: v.string(),
    sourceUrl: v.optional(v.string()),
    ownerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert('projects', {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateHtml = mutation({
  args: {
    id: v.id('projects'),
    html: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});
