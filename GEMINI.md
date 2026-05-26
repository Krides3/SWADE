# LUXOR Tactical Operations Terminal

## System Overview
LUXOR is a web-based tactical terminal for Arma 3 PMC roleplay, utilizing [Convex](https://convex.dev) as a real-time backend.

## Mission Briefing System
The briefing system (`briefing.html`, `briefing.js`) manages mission data, operator assignments, and tactical objectives.

### Architecture
- **Missions:** Stored in the `missions` table. Includes metadata (location, date, handler), tactical sections (SITUATION, MISSION, EXECUTION, etc.), and objectives.
- **Assignments:** Real-time role assignment and readiness tracking for operators in a mission.
- **Role Assignment:** Currently handled by `promptAssignment` in `briefing.js`. 
  - *Planned:* Standardize roles using a dropdown menu based on the 21-role tactical list.

### Operator Roles (Standardized)
The following roles are standardized across the dashboard and briefing tools:
- Ammo Bearer, Autorifleman, Breacher, Combat Life Saver, Comms Specialist, Engineer, Explosive Specialist, Fighter Pilot, Grenadier, Heavy Gunner, Helicopter Pilot, Marksman, Missile Specialist (AA), Missile Specialist (AT), Point Man, Rifleman, Scout, Sharpshooter (Sniper), Spotter, Team Leader, UAV/UGV.

## Core Mandates
- **Aesthetics:** Maintain cyberpunk terminal vibes (gold/purple, Share Tech Mono).
- **Backend:** All persistent data must flow through Convex mutations.
