/**
 * Convex schema stub — run `npx convex dev` after auth to activate.
 * Stores projects + generations for the builder backend.
 */
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  projects: defineTable({
    prompt: v.string(),
    title: v.string(),
    kind: v.string(),
    html: v.string(),
    sourceUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    ownerToken: v.optional(v.string()),
  }).index('by_created', ['createdAt']),

  buildRequests: defineTable({
    fromEmail: v.string(),
    subject: v.string(),
    body: v.string(),
    prompt: v.optional(v.string()),
    status: v.union(
      v.literal('pending'),
      v.literal('accepted'),
      v.literal('built'),
      v.literal('rejected'),
    ),
    projectId: v.optional(v.id('projects')),
    receivedAt: v.number(),
  }).index('by_status', ['status']),
});
