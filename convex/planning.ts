import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getAvailability = query({
  args: {
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(),   // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("availability")
      .withIndex("by_date", (q) =>
        q.gte("date", args.startDate).lte("date", args.endDate)
      )
      .collect();

    // Map operator IDs to callsigns for the frontend hover info
    const operatorIds = [...new Set(records.map((r) => r.operatorId))];
    const operators = await Promise.all(
      operatorIds.map((id) => ctx.db.get(id))
    );
    const operatorMap = Object.fromEntries(
      operators.filter((o) => o !== null).map((o) => [o!._id, o!.callsign])
    );

    return records.map((r) => ({
      ...r,
      callsign: operatorMap[r.operatorId] || "Unknown",
    }));
  },
});

export const updateAvailability = mutation({
  args: {
    operatorId: v.id("operators"),
    date: v.string(), // YYYY-MM-DD
    slots: v.array(v.boolean()), // 48 slots
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("availability")
      .withIndex("by_operator_and_date", (q) =>
        q.eq("operatorId", args.operatorId).eq("date", args.date)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { slots: args.slots });
    } else {
      await ctx.db.insert("availability", {
        operatorId: args.operatorId,
        date: args.date,
        slots: args.slots,
      });
    }
  },
});

export const cleanupOldAvailability = mutation({
  args: {
    beforeDate: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const oldRecords = await ctx.db
      .query("availability")
      .withIndex("by_date", (q) => q.lt("date", args.beforeDate))
      .collect();

    for (const record of oldRecords) {
      await ctx.db.delete(record._id);
    }
    return oldRecords.length;
  },
});
