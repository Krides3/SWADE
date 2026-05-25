import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Operators (Team DAGGER + Handlers)
  operators: defineTable({
    callsign: v.string(),     // e.g., "OVERLORD", "HADES", "GHOST"
    role: v.string(),         // "admin" | "player"
    clearance: v.number(),    // 1-5
    preferredRoles: v.optional(v.array(v.string())), // 1st, 2nd, 3rd choice
    isRestricted: v.boolean(), // If true, only has access to the Briefing Tool
  }).index("by_callsign", ["callsign"]),

  // Mission Briefings
  missions: defineTable({
    name: v.string(),         // Required
    handler: v.string(),      // Callsign of the handler who created it
    status: v.string(),       // "PRE-FLIGHT" | "ACTIVE" | "ARCHIVED"
    date: v.optional(v.string()),
    location: v.optional(v.string()),
    mapUrl: v.optional(v.string()),
    
    // Structured Briefing (SMELC / OPORD style)
    briefing: v.object({
      situation: v.string(),  // Enemy forces, weather, terrain
      mission: v.string(),    // Clear statement of the task
      execution: v.string(),  // The 'how' - movement, phases
      logistics: v.string(),  // Ammo, medical, transport
      command: v.string(),    // Signal, frequencies, chain of command
    }),

    leader: v.optional(v.id("operators")),
    operators: v.array(v.id("operators")),
    timestamp: v.number(),
    objectives: v.optional(v.array(v.object({
      text: v.string(),
      status: v.string(), // "PENDING" | "COMPLETED" | "FAILED"
    }))),
    intelDrops: v.optional(v.array(v.object({
      timestamp: v.string(),
      text: v.string(),
      source: v.string(), // "HQ" | "FIELD" | "SIGNAL"
    }))),
  }).index("by_status", ["status"]),

  // Role Assignments for Team DAGGER
  assignments: defineTable({
    missionId: v.id("missions"),
    operatorId: v.id("operators"),
    assignedRole: v.string(), // e.g., "Point Man", "Netrunner", "Overwatch"
    loadout: v.string(),      // Equipment and assets
    isReady: v.boolean(),     // Operator readiness status
  }).index("by_mission", ["missionId"]),
});
