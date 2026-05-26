import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create a new mission briefing.
 */
export const create = mutation({
  args: {
    name: v.string(),
    handler: v.string(),
    date: v.optional(v.string()),
    location: v.optional(v.string()),
    mapUrl: v.optional(v.string()),
    leader: v.optional(v.id("operators")),
    operators: v.array(v.id("operators")),
    briefing: v.object({
      situation: v.optional(v.string()),
      mission: v.optional(v.string()),
      execution: v.optional(v.string()),
      logistics: v.optional(v.string()),
      command: v.optional(v.string()),
    }),
    modlistUrl: v.optional(v.string()),
    modlistStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const missionId = await ctx.db.insert("missions", {
      name: args.name,
      handler: args.handler.toUpperCase(),
      date: args.date,
      location: args.location,
      mapUrl: args.mapUrl,
      leader: args.leader,
      operators: args.operators,
      briefing: args.briefing,
      status: "PRE-FLIGHT",
      timestamp: Date.now(),
      objectives: [],
      modlistUrl: args.modlistUrl,
      modlistStatus: args.modlistStatus || "WIP",
    });
    return missionId;
  },
});

/**
 * Update an existing mission briefing (Only by the original handler).
 */
export const update = mutation({
  args: {
    missionId: v.id("missions"),
    name: v.string(),
    handler: v.string(),
    date: v.optional(v.string()),
    location: v.optional(v.string()),
    mapUrl: v.optional(v.string()),
    leader: v.optional(v.id("operators")),
    operators: v.array(v.id("operators")),
    status: v.optional(v.string()),
    briefing: v.object({
      situation: v.optional(v.string()),
      mission: v.optional(v.string()),
      execution: v.optional(v.string()),
      logistics: v.optional(v.string()),
      command: v.optional(v.string()),
    }),
    modlistUrl: v.optional(v.string()),
    modlistStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const mission = await ctx.db.get(args.missionId);
    if (!mission) throw new Error("Mission not found");
    
    if (mission.handler !== args.handler.toUpperCase()) {
      throw new Error("ACCESS DENIED: You can only edit your own missions.");
    }

    await ctx.db.patch(args.missionId, {
      name: args.name,
      date: args.date,
      location: args.location,
      mapUrl: args.mapUrl,
      leader: args.leader,
      operators: args.operators,
      briefing: args.briefing,
      status: args.status ?? mission.status,
      modlistUrl: args.modlistUrl ?? mission.modlistUrl,
      modlistStatus: args.modlistStatus ?? mission.modlistStatus,
    });
  },
});

/**
 * Generate a upload URL for modlist files.
 */
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

/**
 * Get the download URL for a modlist file.
 */
export const getModlistUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Remove a mission briefing.
 */
export const remove = mutation({
  args: { 
    missionId: v.id("missions"),
    handler: v.string(),
  },
  handler: async (ctx, args) => {
    const mission = await ctx.db.get(args.missionId);
    if (!mission) throw new Error("Mission not found");
    
    if (mission.handler !== args.handler.toUpperCase()) {
      throw new Error("ACCESS DENIED: You can only delete your own missions.");
    }

    // Also clean up assignments
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_mission", (q) => q.eq("missionId", args.missionId))
      .collect();
    for (const a of assignments) {
      await ctx.db.delete(a._id);
    }

    await ctx.db.delete(args.missionId);
  },
});

/**
 * Update mission objectives.
 */
export const updateObjectives = mutation({
  args: {
    missionId: v.id("missions"),
    objectives: v.array(v.object({ text: v.string(), status: v.string() })),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.missionId, { objectives: args.objectives });
  },
});

/**
 * Set an operator's role and loadout for a mission.
 */
export const setAssignment = mutation({
  args: {
    missionId: v.id("missions"),
    operatorId: v.id("operators"),
    assignedRole: v.string(),
    loadout: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if assignment exists
    const existing = await ctx.db
      .query("assignments")
      .withIndex("by_mission", (q) => q.eq("missionId", args.missionId))
      .filter((q) => q.eq(q.field("operatorId"), args.operatorId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        assignedRole: args.assignedRole,
        loadout: args.loadout,
      });
    } else {
      await ctx.db.insert("assignments", {
        missionId: args.missionId,
        operatorId: args.operatorId,
        assignedRole: args.assignedRole,
        loadout: args.loadout,
        isReady: false,
      });
    }
  },
});

/**
 * Toggle readiness status for an operator on a mission.
 */
export const toggleReady = mutation({
  args: {
    missionId: v.id("missions"),
    userCallsign: v.string(),
  },
  handler: async (ctx, args) => {
    const operator = await ctx.db
      .query("operators")
      .withIndex("by_callsign", (q) => q.eq("callsign", args.userCallsign.toUpperCase()))
      .unique();
    if (!operator) throw new Error("Operator not found");

    const assignment = await ctx.db
      .query("assignments")
      .withIndex("by_mission", (q) => q.eq("missionId", args.missionId))
      .filter((q) => q.eq(q.field("operatorId"), operator._id))
      .unique();

    if (assignment) {
      await ctx.db.patch(assignment._id, { isReady: !assignment.isReady });
    } else {
      // Create empty assignment just for readiness if none exists
      await ctx.db.insert("assignments", {
        missionId: args.missionId,
        operatorId: operator._id,
        assignedRole: "UNASSIGNED",
        loadout: "STANDARD",
        isReady: true,
      });
    }
  },
});

/**
 * List missions visible to a specific user.
 * Handlers see only their own missions (or any they created).
 * Operators see only missions they are assigned to.
 */
export const listVisible = query({
  args: { userCallsign: v.string() },
  handler: async (ctx, args) => {
    const callsign = args.userCallsign.toUpperCase();
    
    // 1. Get the operator record
    const operator = await ctx.db
      .query("operators")
      .withIndex("by_callsign", (q) => q.eq("callsign", callsign))
      .unique();

    // 2. Fetch missions that are not archived
    const preflight = await ctx.db
      .query("missions")
      .withIndex("by_status", (q) => q.eq("status", "PRE-FLIGHT"))
      .collect();
    const active = await ctx.db
      .query("missions")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .collect();
    
    const allMissions = [...preflight, ...active];

    // 3. Filter missions
    // Always include missions where the user is the handler (creator)
    const asHandler = allMissions.filter((m) => m.handler === callsign);
    
    // If operator record exists and is NOT an admin, only show assigned missions
    // But we still want them to see missions they created (if any)
    if (operator && operator.role === "player") {
      const asOperator = allMissions.filter((m) => m.operators.includes(operator._id));
      const combined = [...asHandler, ...asOperator];
      // Return unique missions
      return combined.filter((v, i, a) => a.findIndex(t => t._id === v._id) === i);
    }

    // Default: Return missions they created
    return asHandler;
  },
});

/**
 * Get mission details including resolved operator names.
 */
export const getDetails = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const mission = await ctx.db.get(args.missionId);
    if (!mission) return null;

    let leaderName = null;
    if (mission.leader) {
      const leaderOp = await ctx.db.get(mission.leader);
      leaderName = leaderOp?.callsign;
    }

    const resolvedOperators = await Promise.all(
      mission.operators.map(async (id) => {
        const op = await ctx.db.get(id);
        return { 
          id, 
          callsign: op?.callsign,
          preferredRoles: op?.preferredRoles || []
        };
      })
    );

    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_mission", (q) => q.eq("missionId", args.missionId))
      .collect();
    
    const fullAssignments = await Promise.all(
      assignments.map(async (a) => {
        const op = await ctx.db.get(a.operatorId);
        return { ...a, callsign: op?.callsign };
      })
    );

    return { 
      ...mission, 
      leaderName,
      operatorList: resolvedOperators,
      assignments: fullAssignments 
    };
  },
});