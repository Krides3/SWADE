import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get all operators for the roster.
 */
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("operators").collect();
  },
});

/**
 * Find an operator by their callsign.
 */
export const getByCallsign = query({
  args: { callsign: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("operators")
      .withIndex("by_callsign", (q) => q.eq("callsign", args.callsign.toUpperCase()))
      .unique();
  },
});

/**
 * Create a new operator.
 */
export const create = mutation({
  args: {
    callsign: v.string(),
    role: v.string(),
    clearance: v.number(),
    isRestricted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("operators")
      .withIndex("by_callsign", (q) => q.eq("callsign", args.callsign.toUpperCase()))
      .unique();
    if (existing) throw new Error("Operator with this callsign already exists.");

    return await ctx.db.insert("operators", {
      callsign: args.callsign.toUpperCase(),
      role: args.role,
      clearance: args.clearance,
      isRestricted: args.isRestricted,
    });
  },
});

/**
 * Update an existing operator.
 */
export const update = mutation({
  args: {
    id: v.id("operators"),
    role: v.optional(v.string()),
    clearance: v.optional(v.number()),
    isRestricted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

/**
 * Update an operator's role preferences.
 */
export const setPreferences = mutation({
  args: {
    callsign: v.string(),
    roles: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const op = await ctx.db
      .query("operators")
      .withIndex("by_callsign", (q) => q.eq("callsign", args.callsign.toUpperCase()))
      .unique();
    if (!op) throw new Error("Operator not found");

    await ctx.db.patch(op._id, { preferredRoles: args.roles });
  },
});

/**
 * Delete an operator.
 */
export const remove = mutation({
  args: { id: v.id("operators") },
  handler: async (ctx, args) => {
    const op = await ctx.db.get(args.id);
    if (op?.callsign === "OVERLORD") throw new Error("CANNOT TERMINATE OVERLORD");
    await ctx.db.delete(args.id);
  },
});

/**
 * Initialize default roster if empty.
 */
export const seed = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("operators").collect();
    if (existing.length > 0) return;

    const defaults = [
      { callsign: "OVERLORD", role: "admin", clearance: 5, isRestricted: false },
      { callsign: "HADES", role: "admin", clearance: 5, isRestricted: true },
      { callsign: "HEEST", role: "player", clearance: 1, isRestricted: true },
      { callsign: "BINGO", role: "player", clearance: 1, isRestricted: true },
      { callsign: "CINDER", role: "player", clearance: 1, isRestricted: true },
      { callsign: "RIG", role: "player", clearance: 1, isRestricted: true },
      { callsign: "HARMLESS", role: "player", clearance: 1, isRestricted: true },
      { callsign: "JOKER", role: "player", clearance: 1, isRestricted: true },
      { callsign: "LANCE", role: "player", clearance: 1, isRestricted: true },
      { callsign: "LIBRE", role: "player", clearance: 1, isRestricted: true },
      { callsign: "ZED", role: "player", clearance: 1, isRestricted: true },
    ];

    for (const op of defaults) {
      await ctx.db.insert("operators", op);
    }
  },
});
