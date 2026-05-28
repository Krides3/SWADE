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
    // Union allows migration and makes fields optional for quick creation
    briefing: v.union(
      v.string(), 
      v.object({
        situation: v.optional(v.string()),
        mission: v.optional(v.string()),
        execution: v.optional(v.string()),
        logistics: v.optional(v.string()),
        command: v.optional(v.string()),
      })
    ),

    leader: v.optional(v.id("operators")),
    operators: v.array(v.id("operators")),
    timestamp: v.number(),
    
    // Arma 3 Modlist Support
    modlistUrl: v.optional(v.string()), // Convex File ID or External URL
    modlistStatus: v.optional(v.string()), // "WIP" | "FINAL"

    // Multi-Image & Tactical Planning
    handlerImages: v.optional(v.array(v.string())), // Storage IDs from Handler
    leaderPlan: v.optional(v.string()),             // Markdown plan by Mission Leader
    leaderImages: v.optional(v.array(v.string())),  // Storage IDs from Mission Leader

    objectives: v.optional(v.array(v.object({
      text: v.string(),
      status: v.string(), // "PENDING" | "COMPLETED" | "FAILED"
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

  // Operator Loadouts (ACE Arsenal Exports)
  loadouts: defineTable({
    operatorId: v.id("operators"),
    name: v.string(),         // e.g., "CQB Specialist", "Desert Recon"
    content: v.string(),      // ACE Arsenal Export String
  }).index("by_operator", ["operatorId"]),

  // Operator Availability for Planning Tool
  availability: defineTable({
    operatorId: v.id("operators"),
    date: v.string(), // YYYY-MM-DD
    slots: v.array(v.boolean()), // 48 boolean values for 30-min increments (00:00 to 23:30)
  }).index("by_date", ["date"])
    .index("by_operator_and_date", ["operatorId", "date"]),
});
