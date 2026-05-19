// ================================================================
//  LUXOR ASSET MAP  —  GM CONFIGURATION
//  Edit DEPLOYMENTS and ROUTES below, or use the [+] panel in-browser.
//  Custom entries added in-browser persist via localStorage.
// ================================================================

// Default player clearance — overridden by auth session below.
let PLAYER_CLEARANCE = 1;

// ── Auth: set clearance from session, lock panel for non-admin ──
(function () {
    if (!window.LuxorAuth) return;
    const session = LuxorAuth.getSession();
    if (!session) return;
    if (!LuxorAuth.isAdmin()) {
        PLAYER_CLEARANCE = session.clearance || 1;
        document.addEventListener('DOMContentLoaded', function () {
            const label = document.querySelector('#clearance-panel .panel-label');
            if (label) label.textContent = 'Clearance: ' + PLAYER_CLEARANCE;
            document.querySelectorAll('.cl-btn').forEach(b => {
                b.disabled = true;
                b.style.cursor = 'default';
                b.style.pointerEvents = 'none';
                if (+b.dataset.level !== PLAYER_CLEARANCE) b.style.opacity = '0.22';
            });
        });
    } else {
        PLAYER_CLEARANCE = 5;
        document.addEventListener('DOMContentLoaded', function () {
            const label = document.querySelector('#clearance-panel .panel-label');
            if (label) label.textContent = 'Preview Clearance';
        });
    }
})();

// Animation speed multiplier — read from admin settings (luxorAssetMapSettings.timeScale).
// 5 = vehicles move 5× real-world speed (Paris→NY ≈ 80 min on-screen).
let TIME_SCALE = (function () {
    try { const c = JSON.parse(localStorage.getItem('luxorAssetMapSettings') || '{}'); return typeof c.timeScale === 'number' ? c.timeScale : 5; } catch { return 5; }
})();

function setTimeScale(val) {
    TIME_SCALE = Math.max(0.1, Math.min(500, +val || 5));
    try {
        const c = JSON.parse(localStorage.getItem('luxorAssetMapSettings') || '{}');
        c.timeScale = TIME_SCALE;
        localStorage.setItem('luxorAssetMapSettings', JSON.stringify(c));
    } catch {}
}

// ----------------------------------------------------------------
//  DEPLOYMENTS  — place a ping on the map
//
//  id        — unique string
//  name      — shown on hover if clearance met; else REDACTED
//  lat/lng   — GPS decimal degrees
//  clearance — 1–5: minimum level to see name & notes
//  type      — 'hq' | 'ground' | 'outpost' | 'naval'
//  status    — 'active' | 'inactive' | 'compromised' | 'unknown'
//  notes     — optional detail (clearance-gated)
// ----------------------------------------------------------------
const DEPLOYMENTS = [

    // ── HEADQUARTERS ──────────────────────────────────────────────
    {
        id: 'luxor-hq',
        name: 'LUXOR HQ',
        lat: 46.9481, lng: 7.4474,            // Bern, Switzerland
        clearance: 1, type: 'hq', status: 'active',
        notes: 'Primary command. 24/7 ops center. Secure comms only.'
    },

    // ── EUROPE ────────────────────────────────────────────────────
    {
        id: 'london-stn',
        name: 'London Station',
        lat: 51.5074, lng: -0.1278,
        clearance: 2, type: 'ground', status: 'active',
        notes: 'Cover: import/export consultancy. Active surveillance op.'
    },
    {
        id: 'paris-safe',
        name: 'Paris Safehouse',
        lat: 48.8566, lng: 2.3522,
        clearance: 2, type: 'ground', status: 'active',
        notes: 'Secondary extraction point. 3-person capacity. Clean.'
    },
    {
        id: 'madrid-relay',
        name: 'Madrid Relay',
        lat: 40.4168, lng: -3.7038,
        clearance: 2, type: 'outpost', status: 'active',
        notes: 'Signal relay node. Comms bridge to Morocco assets.'
    },
    {
        id: 'oslo-stn',
        name: 'Oslo Station',
        lat: 59.9139, lng: 10.7522,
        clearance: 1, type: 'ground', status: 'active',
        notes: 'Northern Europe hub. Shipping company cover. Clean.'
    },
    {
        id: 'warsaw-stn',
        name: 'Warsaw Station',
        lat: 52.2297, lng: 21.0122,
        clearance: 3, type: 'ground', status: 'active',
        notes: 'Eastern Europe intelligence collection. Double-layer cover.'
    },
    {
        id: 'prague-contact',
        name: 'Prague Contact',
        lat: 50.0755, lng: 14.4378,
        clearance: 4, type: 'outpost', status: 'unknown',
        notes: 'Handler dark 72 hrs. Last known: central district. Investigate.'
    },
    {
        id: 'athens-out',
        name: 'Athens Outpost',
        lat: 37.9838, lng: 23.7275,
        clearance: 2, type: 'outpost', status: 'active',
        notes: 'Mediterranean observation post. Port traffic monitoring.'
    },
    {
        id: 'istanbul-cross',
        name: 'Istanbul Crossing',
        lat: 41.0082, lng: 28.9784,
        clearance: 3, type: 'ground', status: 'active',
        notes: 'East-West transit hub. Assets pass through regularly.'
    },
    {
        id: 'moscow-echo',
        name: 'Echo Station',
        lat: 55.7558, lng: 37.6173,
        clearance: 4, type: 'outpost', status: 'compromised',
        notes: 'COMPROMISED. Do not transmit to this node. Evacuation failed.'
    },
    {
        id: 'berlin-asset',
        name: 'Berlin Asset',
        lat: 52.5200, lng: 13.4050,
        clearance: 2, type: 'ground', status: 'active',
        notes: 'Deep cover. Contact via dead drop only. Last check-in: 48h ago.'
    },
    {
        id: 'vienna-stn',
        name: 'Vienna Station',
        lat: 48.2082, lng: 16.3738,
        clearance: 3, type: 'ground', status: 'active',
        notes: 'Financial intelligence. Diplomatic cover maintained.'
    },
    {
        id: 'rome-relay',
        name: 'Rome Relay',
        lat: 41.9028, lng: 12.4964,
        clearance: 2, type: 'outpost', status: 'active',
        notes: 'Vatican-adjacent observation. Long-term placement.'
    },
    {
        id: 'amsterdam-cntct',
        name: 'Amsterdam Contact',
        lat: 52.3676, lng: 4.9041,
        clearance: 1, type: 'ground', status: 'active',
        notes: 'Port intelligence. Diamond trade monitoring active.'
    },
    {
        id: 'copenhagen-relay',
        name: 'Copenhagen Relay',
        lat: 55.6761, lng: 12.5683,
        clearance: 2, type: 'outpost', status: 'active',
        notes: 'Scandinavian bridge. Low-risk. Tech export monitoring.'
    },
    {
        id: 'stockholm-obs',
        name: 'Stockholm Observation',
        lat: 59.3293, lng: 18.0686,
        clearance: 2, type: 'ground', status: 'active',
        notes: 'Embassy row monitoring. Nordic intelligence liaison.'
    },

    // ── MIDDLE EAST / NORTH AFRICA ────────────────────────────────
    {
        id: 'cairo-intel',
        name: 'Cairo Intelligence',
        lat: 30.0444, lng: 31.2357,
        clearance: 3, type: 'ground', status: 'active',
        notes: 'Regional hub. Access to multiple client networks.'
    },
    {
        id: 'dubai-transit',
        name: 'Dubai Transit',
        lat: 25.2048, lng: 55.2708,
        clearance: 2, type: 'ground', status: 'active',
        notes: 'Financial conduit. Asset laundering monitoring. VIP access.'
    },
    {
        id: 'riyadh-asset',
        name: 'Riyadh Asset',
        lat: 24.7136, lng: 46.6753,
        clearance: 3, type: 'ground', status: 'active',
        notes: 'Embedded in energy sector. High-value placement.'
    },
    {
        id: 'tehran-intercept',
        name: 'Tehran Intercept',
        lat: 35.6892, lng: 51.3890,
        clearance: 5, type: 'ground', status: 'compromised',
        notes: 'BURN NOTICE ISSUED. Do not attempt contact. Sources burned.'
    },
    {
        id: 'algiers-watch',
        name: 'Algiers Watch',
        lat: 36.7372, lng: 3.0869,
        clearance: 3, type: 'ground', status: 'active',
        notes: 'North Africa corridor. Smuggling route monitoring.'
    },
    {
        id: 'casablanca-safe',
        name: 'Casablanca Safehouse',
        lat: 33.5731, lng: -7.5898,
        clearance: 2, type: 'ground', status: 'active',
        notes: 'Western fallback position. Stocked for 2 weeks.'
    },
    {
        id: 'tripoli-covert',
        name: 'Tripoli Covert',
        lat: 32.8872, lng: 13.1913,
        clearance: 5, type: 'outpost', status: 'unknown',
        notes: 'Status unconfirmed. Last contact 11 days ago.'
    },
    {
        id: 'beirut-contact',
        name: 'Beirut Contact',
        lat: 33.8938, lng: 35.5018,
        clearance: 4, type: 'ground', status: 'unknown',
        notes: 'Freelance asset. Reliability flagged. Use with caution.'
    },

    // ── SUB-SAHARAN AFRICA ────────────────────────────────────────
    {
        id: 'nairobi-field',
        name: 'Nairobi Field Office',
        lat: -1.2921, lng: 36.8219,
        clearance: 2, type: 'ground', status: 'active',
        notes: 'East Africa hub. NGO cover active. 6-month deployment.'
    },
    {
        id: 'lagos-obs',
        name: 'Lagos Observation',
        lat: 6.5244, lng: 3.3792,
        clearance: 3, type: 'outpost', status: 'active',
        notes: 'Port monitoring. Oil sector intelligence collection.'
    },
    {
        id: 'joburg-base',
        name: 'Johannesburg Base',
        lat: -26.2041, lng: 28.0473,
        clearance: 2, type: 'ground', status: 'inactive',
        notes: 'Standby. Mining sector cover ready. Awaiting activation.'
    },

    // ── ASIA ──────────────────────────────────────────────────────
    {
        id: 'tokyo-kestrel',
        name: 'Outpost Kestrel',
        lat: 35.6762, lng: 139.6503,
        clearance: 4, type: 'outpost', status: 'unknown',
        notes: 'Signal lost 48 hrs ago. Priority investigation requested.'
    },
    {
        id: 'seoul-relay',
        name: 'Seoul Relay',
        lat: 37.5665, lng: 126.9780,
        clearance: 2, type: 'ground', status: 'active',
        notes: 'Peninsula monitoring. Tech sector embedded. Clean comms.'
    },
    {
        id: 'beijing-watch',
        name: 'Beijing Watch',
        lat: 39.9042, lng: 116.4074,
        clearance: 5, type: 'outpost', status: 'compromised',
        notes: 'CRITICAL: Sources burned. Extract order pending approval.'
    },
    {
        id: 'hongkong-relay',
        name: 'HK Relay',
        lat: 22.3193, lng: 114.1694,
        clearance: 4, type: 'ground', status: 'unknown',
        notes: 'Cover intact but access degraded. Status review overdue.'
    },
    {
        id: 'singapore-hub',
        name: 'Singapore Hub',
        lat: 1.3521, lng: 103.8198,
        clearance: 3, type: 'outpost', status: 'active',
        notes: 'SE Asia coordination. Shipping intelligence primary mission.'
    },
    {
        id: 'bangkok-transit',
        name: 'Bangkok Transit',
        lat: 13.7563, lng: 100.5018,
        clearance: 3, type: 'outpost', status: 'active',
        notes: 'Asset transit point. Grey market monitoring secondary.'
    },
    {
        id: 'mumbai-port',
        name: 'Mumbai Port Watch',
        lat: 18.9667, lng: 72.8333,
        clearance: 3, type: 'naval', status: 'active',
        notes: 'Indian Ocean access. Contraband interdiction support.'
    },
    {
        id: 'karachi-surv',
        name: 'Karachi Surveillance',
        lat: 24.8607, lng: 67.0011,
        clearance: 4, type: 'ground', status: 'active',
        notes: 'Difficult environment. Handler: FOXGLOVE. Check-in 12h.'
    },

    // ── AMERICAS ──────────────────────────────────────────────────
    {
        id: 'newyork-office',
        name: 'New York Office',
        lat: 40.7128, lng: -74.0060,
        clearance: 3, type: 'ground', status: 'active',
        notes: 'Asset extraction in progress. UN access maintained.'
    },
    {
        id: 'dc-contact',
        name: 'Washington Contact',
        lat: 38.9072, lng: -77.0369,
        clearance: 4, type: 'ground', status: 'active',
        notes: 'Beltway asset. Highly sensitive. Eyes-only comms only.'
    },
    {
        id: 'mexico-relay',
        name: 'Mexico City Relay',
        lat: 19.4326, lng: -99.1332,
        clearance: 2, type: 'ground', status: 'active',
        notes: 'Central America corridor. Cartel intel secondary mission.'
    },
    {
        id: 'bogota-stn',
        name: 'Bogotá Station',
        lat: 4.7110, lng: -74.0721,
        clearance: 3, type: 'ground', status: 'active',
        notes: 'South America hub. Drug trade intel feeds DC directly.'
    },
    {
        id: 'saopaulo-hub',
        name: 'São Paulo Hub',
        lat: -23.5505, lng: -46.6333,
        clearance: 3, type: 'outpost', status: 'active',
        notes: 'Financial intelligence. Offshore account monitoring active.'
    },
    {
        id: 'buenosaires-cntct',
        name: 'Buenos Aires Contact',
        lat: -34.6037, lng: -58.3816,
        clearance: 2, type: 'ground', status: 'active',
        notes: 'Southern cone hub. Clean diplomatic channel available.'
    },
    {
        id: 'vancouver-stn',
        name: 'Vancouver Station',
        lat: 49.2827, lng: -123.1207,
        clearance: 1, type: 'ground', status: 'active',
        notes: 'Pacific Rim liaison. Low-profile. Tech monitoring primary.'
    },

    // ── NAVAL / MARITIME ──────────────────────────────────────────
    {
        id: 'sigma-naval',
        name: 'Maritime Unit Sigma',
        lat: 36.8969, lng: 10.1873,
        clearance: 5, type: 'naval', status: 'active',
        notes: 'Covert maritime interdiction. Mediterranean theater. Eyes only.'
    },
    {
        id: 'malta-fleet',
        name: 'Mediterranean Fleet',
        lat: 35.9375, lng: 14.3754,
        clearance: 3, type: 'naval', status: 'active',
        notes: 'Central Med rapid response. 48hr full deployment window.'
    },
    {
        id: 'natl-patrol',
        name: 'North Atlantic Patrol',
        lat: 45.0, lng: -35.0,
        clearance: 4, type: 'naval', status: 'active',
        notes: 'Deep water surveillance. Submerged assets in vicinity.'
    },
    {
        id: 'scs-watch',
        name: 'South China Sea Watch',
        lat: 13.0, lng: 114.0,
        clearance: 5, type: 'naval', status: 'active',
        notes: 'Eyes only. Platform identity classified above clearance 5.'
    },

    // ── OCEANIA ───────────────────────────────────────────────────
    {
        id: 'sydney-delta',
        name: 'Team Delta',
        lat: -33.8688, lng: 151.2093,
        clearance: 2, type: 'ground', status: 'inactive',
        notes: 'Standby. Awaiting Pacific theater activation orders.'
    },

    // ── CLEARANCE 1 — PATROL / GUARD DETAILS ─────────────────────
    {
        id: 'guard-rotterdam',
        name: 'Guard Post Rotterdam',
        lat: 51.9244, lng: 4.4777,
        clearance: 1, type: 'outpost', status: 'active',
        notes: 'Port cargo facility. 6-man rotation. 12hr shifts. No incidents.'
    },
    {
        id: 'patrol-libya',
        name: 'Patrol Unit Jackal',
        lat: 31.2001, lng: 14.5502,
        clearance: 1, type: 'ground', status: 'active',
        notes: 'Coastal road sweep. 2 vehicles, 8 contractors. Daily 0600-1800.'
    },
    {
        id: 'checkpoint-balkan',
        name: 'Checkpoint Bravo-4',
        lat: 44.8025, lng: 20.4651,
        clearance: 1, type: 'outpost', status: 'active',
        notes: 'Road access control for client compound. Low threat. Routine.'
    },
    {
        id: 'escort-colombia',
        name: 'Escort Detail Condor',
        lat: 4.7110, lng: -74.0721,
        clearance: 1, type: 'ground', status: 'active',
        notes: 'Executive protection. Mining exec client. Bogotá metro area.'
    },
    {
        id: 'perimeter-iraq',
        name: 'Perimeter Team Wolf',
        lat: 33.3152, lng: 44.3661,
        clearance: 1, type: 'outpost', status: 'active',
        notes: 'Outer perimeter, energy facility. 4-post rotation. Quiet sector.'
    },
    {
        id: 'patrol-kenya',
        name: 'Patrol Unit Osprey',
        lat: 1.2921, lng: 40.1200,
        clearance: 1, type: 'ground', status: 'active',
        notes: 'Rural sweep route. NGO convoy protection. Weekly schedule.'
    },
    {
        id: 'guard-frankfurt',
        name: 'Guard Detail Eagle',
        lat: 50.0379, lng: 8.5622,
        clearance: 1, type: 'outpost', status: 'active',
        notes: 'Private terminal security. VIP client logistics hub. Low-key.'
    },
    {
        id: 'checkpoint-sinai',
        name: 'Checkpoint Sierra-2',
        lat: 30.0131, lng: 33.0458,
        clearance: 1, type: 'outpost', status: 'inactive',
        notes: 'Standby. Contract pending renewal. Equipment cached on-site.'
    },
    {
        id: 'extract-nairobi',
        name: 'Overwatch Team Kilo',
        lat: -1.2921, lng: 36.8219,
        clearance: 1, type: 'outpost', status: 'active',
        notes: 'Armed escort contract. Client: regional logistics firm. 3-man team. Rotating 48h shifts.'
    },
    {
        id: 'convoy-warsaw',
        name: 'Convoy Detail Bravo',
        lat: 52.2297, lng: 21.0122,
        clearance: 1, type: 'ground', status: 'active',
        notes: 'High-value cargo escort. Eastern Europe route. Daily 0800-2000.'
    },
    {
        id: 'perimeter-ras',
        name: 'Site Security Delta',
        lat: 25.2048, lng: 55.2708,
        clearance: 1, type: 'outpost', status: 'active',
        notes: 'Facility perimeter. Energy sector client. 6-post rotation. No incidents.'
    },
    {
        id: 'close-prot-london',
        name: 'Close Protection Alpha',
        lat: 51.5074, lng: -0.1278,
        clearance: 1, type: 'ground', status: 'active',
        notes: 'Executive protection. Finance sector client. 2-man detail. London metro.'
    }
];

// ----------------------------------------------------------------
//  ROUTES  — animate a vehicle along waypoints
//
//  id           — unique string
//  name         — callsign shown on hover (clearance-gated)
//  type         — 'helicopter' | 'plane' | 'ship'
//  waypoints    — array of { pos:[lat,lng], dwellMinutes:0, label:'NAME' }
//                 dwellMinutes: real-world minutes to pause at this stop
//                 (30 world-min = 30*60/TIME_SCALE ≈ 6s on-screen)
//  clearance    — 1–5
//  speedKmh     — real-world speed (heli ~240–280, plane ~820–880, ship ~25–35)
//  loop         — 'pingpong' / true  = bounce back and forth
//                 'circuit'          = wrap from last stop back to first
//                 false              = one-way, stops at end
//  showPath     — draw animated dashed route line
//
//  Backward-compatible: you can still use from:[lat,lng] + to:[lat,lng]
//  instead of waypoints and it will work automatically.
// ----------------------------------------------------------------
const ROUTES = [

    // ── EUROPE ────────────────────────────────────────────────────
    {
        id: 'kingfisher-1',
        name: 'KINGFISHER-1',
        type: 'helicopter',
        waypoints: [
            { pos: [48.8566,  2.3522], dwellMinutes: 20, label: 'PARIS' },
            { pos: [51.5074, -0.1278], dwellMinutes: 15, label: 'LONDON' }
        ],
        clearance: 2, speedKmh: 240, loop: 'pingpong', showPath: true
    },
    {
        id: 'phantom-run',
        name: 'PHANTOM-RUN',
        type: 'helicopter',
        waypoints: [
            { pos: [51.5074, -0.1278], dwellMinutes: 30, label: 'LONDON' },
            { pos: [55.6761, 12.5683], dwellMinutes: 20, label: 'COPENHAGEN' },
            { pos: [59.3293, 18.0686], dwellMinutes: 25, label: 'STOCKHOLM' },
            { pos: [60.1695, 24.9354], dwellMinutes: 0,  label: 'HELSINKI' }
        ],
        clearance: 3, speedKmh: 260, loop: 'circuit', showPath: true
    },
    {
        id: 'serpent-4',
        name: 'SERPENT-4',
        type: 'helicopter',
        waypoints: [
            { pos: [55.7558, 37.6173], dwellMinutes: 45, label: 'MOSCOW' },
            { pos: [41.0082, 28.9784], dwellMinutes: 30, label: 'ISTANBUL' },
            { pos: [37.9838, 23.7275], dwellMinutes: 20, label: 'ATHENS' },
            { pos: [41.9028, 12.4964], dwellMinutes: 0,  label: 'ROME' }
        ],
        clearance: 4, speedKmh: 270, loop: 'circuit', showPath: true
    },
    {
        id: 'north-sea',
        name: 'NORTHSEA',
        type: 'helicopter',
        waypoints: [
            { pos: [59.9139, 10.7522], dwellMinutes: 15, label: 'OSLO' },
            { pos: [55.6761, 12.5683], dwellMinutes: 10, label: 'COPENHAGEN' },
            { pos: [52.3676,  4.9041], dwellMinutes: 20, label: 'AMSTERDAM' },
            { pos: [51.5074, -0.1278], dwellMinutes: 0,  label: 'LONDON' }
        ],
        clearance: 1, speedKmh: 220, loop: 'circuit', showPath: true
    },
    {
        id: 'atlas-run',
        name: 'ATLAS',
        type: 'plane',
        waypoints: [
            { pos: [36.7372,  3.0869], dwellMinutes: 60, label: 'ALGIERS' },
            { pos: [41.9028, 12.4964], dwellMinutes: 45, label: 'ROME' },
            { pos: [48.2082, 16.3738], dwellMinutes: 30, label: 'VIENNA' },
            { pos: [52.2297, 21.0122], dwellMinutes: 0,  label: 'WARSAW' }
        ],
        clearance: 3, speedKmh: 820, loop: 'pingpong', showPath: true
    },

    // ── TRANSATLANTIC ─────────────────────────────────────────────
    {
        id: 'condor-7',
        name: 'CONDOR-7',
        type: 'plane',
        waypoints: [
            { pos: [48.8566,   2.3522], dwellMinutes: 90, label: 'PARIS' },
            { pos: [40.7128, -74.0060], dwellMinutes: 90, label: 'NEW YORK' }
        ],
        clearance: 1, speedKmh: 870, loop: 'pingpong', showPath: true
    },
    {
        id: 'viper-3',
        name: 'VIPER-3',
        type: 'plane',
        waypoints: [
            { pos: [40.7128,  -74.0060], dwellMinutes: 60, label: 'NEW YORK' },
            { pos: [19.4326,  -99.1332], dwellMinutes: 45, label: 'MEXICO CITY' },
            { pos: [4.7110,   -74.0721], dwellMinutes: 30, label: 'BOGOTÁ' },
            { pos: [-23.5505, -46.6333], dwellMinutes: 0,  label: 'SÃO PAULO' }
        ],
        clearance: 2, speedKmh: 850, loop: 'circuit', showPath: true
    },
    {
        id: 'sparrow-west',
        name: 'SPARROW',
        type: 'plane',
        waypoints: [
            { pos: [49.2827, -123.1207], dwellMinutes: 30, label: 'VANCOUVER' },
            { pos: [19.4326,  -99.1332], dwellMinutes: 45, label: 'MEXICO CITY' },
            { pos: [4.7110,   -74.0721], dwellMinutes: 0,  label: 'BOGOTÁ' }
        ],
        clearance: 2, speedKmh: 830, loop: 'pingpong', showPath: false
    },
    {
        id: 'chimera-south',
        name: 'CHIMERA',
        type: 'helicopter',
        waypoints: [
            { pos: [-34.6037, -58.3816], dwellMinutes: 20, label: 'BUENOS AIRES' },
            { pos: [-23.5505, -46.6333], dwellMinutes: 20, label: 'SÃO PAULO' }
        ],
        clearance: 2, speedKmh: 230, loop: 'pingpong', showPath: true
    },

    // ── MIDDLE EAST / AFRICA ──────────────────────────────────────
    {
        id: 'osprey-supply',
        name: 'OSPREY Supply',
        type: 'helicopter',
        waypoints: [
            { pos: [36.8969, 10.1873], dwellMinutes: 30, label: 'TUNIS' },
            { pos: [33.5731, -7.5898], dwellMinutes: 20, label: 'CASABLANCA' },
            { pos: [40.4168, -3.7038], dwellMinutes: 0,  label: 'MADRID' }
        ],
        clearance: 3, speedKmh: 240, loop: 'circuit', showPath: false
    },
    {
        id: 'raven-circuit',
        name: 'RAVEN',
        type: 'helicopter',
        waypoints: [
            { pos: [40.4168,  -3.7038], dwellMinutes: 20, label: 'MADRID' },
            { pos: [33.5731,  -7.5898], dwellMinutes: 15, label: 'CASABLANCA' },
            { pos: [36.7372,   3.0869], dwellMinutes: 25, label: 'ALGIERS' },
            { pos: [32.8872,  13.1913], dwellMinutes: 0,  label: 'TRIPOLI' }
        ],
        clearance: 4, speedKmh: 250, loop: 'circuit', showPath: true
    },
    {
        id: 'eagle-circuit',
        name: 'EAGLE',
        type: 'plane',
        waypoints: [
            { pos: [46.9481,   7.4474], dwellMinutes: 0,  label: 'BERN' },
            { pos: [30.0444,  31.2357], dwellMinutes: 60, label: 'CAIRO' },
            { pos: [-1.2921,  36.8219], dwellMinutes: 45, label: 'NAIROBI' },
            { pos: [-26.2041, 28.0473], dwellMinutes: 0,  label: 'JOHANNESBURG' }
        ],
        clearance: 3, speedKmh: 860, loop: 'pingpong', showPath: true
    },
    {
        id: 'griffin-loop',
        name: 'GRIFFIN',
        type: 'helicopter',
        waypoints: [
            { pos: [-1.2921,  36.8219], dwellMinutes: 30, label: 'NAIROBI' },
            { pos: [25.2048,  55.2708], dwellMinutes: 45, label: 'DUBAI' },
            { pos: [24.7136,  46.6753], dwellMinutes: 20, label: 'RIYADH' },
            { pos: [30.0444,  31.2357], dwellMinutes: 0,  label: 'CAIRO' }
        ],
        clearance: 3, speedKmh: 260, loop: 'circuit', showPath: true
    },
    {
        id: 'silk-road',
        name: 'SILK ROAD',
        type: 'plane',
        waypoints: [
            { pos: [41.0082, 28.9784], dwellMinutes: 60, label: 'ISTANBUL' },
            { pos: [35.6892, 51.3890], dwellMinutes: 0,  label: 'TEHRAN' },
            { pos: [25.2048, 55.2708], dwellMinutes: 45, label: 'DUBAI' },
            { pos: [18.9667, 72.8333], dwellMinutes: 0,  label: 'MUMBAI' }
        ],
        clearance: 5, speedKmh: 880, loop: 'circuit', showPath: false
    },
    {
        id: 'cobra-run',
        name: 'COBRA',
        type: 'plane',
        waypoints: [
            { pos: [35.6892, 51.3890], dwellMinutes: 0,  label: 'TEHRAN' },
            { pos: [24.8607, 67.0011], dwellMinutes: 30, label: 'KARACHI' },
            { pos: [18.9667, 72.8333], dwellMinutes: 0,  label: 'MUMBAI' }
        ],
        clearance: 5, speedKmh: 850, loop: 'circuit', showPath: false
    },

    // ── PACIFIC / ASIA ────────────────────────────────────────────
    {
        id: 'typhoon-run',
        name: 'TYPHOON',
        type: 'plane',
        waypoints: [
            { pos: [25.2048,  55.2708], dwellMinutes: 60, label: 'DUBAI' },
            { pos: [18.9667,  72.8333], dwellMinutes: 30, label: 'MUMBAI' },
            { pos: [1.3521,  103.8198], dwellMinutes: 45, label: 'SINGAPORE' },
            { pos: [22.3193, 114.1694], dwellMinutes: 0,  label: 'HONG KONG' }
        ],
        clearance: 3, speedKmh: 860, loop: 'circuit', showPath: true
    },
    {
        id: 'fang-circuit',
        name: 'FANG',
        type: 'helicopter',
        waypoints: [
            { pos: [35.6762, 139.6503], dwellMinutes: 30, label: 'TOKYO' },
            { pos: [37.5665, 126.9780], dwellMinutes: 20, label: 'SEOUL' },
            { pos: [22.3193, 114.1694], dwellMinutes: 25, label: 'HONG KONG' },
            { pos: [1.3521,  103.8198], dwellMinutes: 0,  label: 'SINGAPORE' }
        ],
        clearance: 3, speedKmh: 270, loop: 'circuit', showPath: true
    },
    {
        id: 'nighthawk-pac',
        name: 'NIGHTHAWK',
        type: 'plane',
        waypoints: [
            { pos: [-33.8688, 151.2093], dwellMinutes: 60, label: 'SYDNEY' },
            { pos: [1.3521,   103.8198], dwellMinutes: 45, label: 'SINGAPORE' },
            { pos: [13.7563,  100.5018], dwellMinutes: 0,  label: 'BANGKOK' }
        ],
        clearance: 2, speedKmh: 870, loop: 'pingpong', showPath: true
    },

    // ── NAVAL PATROLS ─────────────────────────────────────────────
    {
        id: 'sigma-patrol',
        name: 'SIGMA PATROL',
        type: 'ship',
        waypoints: [
            { pos: [36.8969, 10.1873], dwellMinutes: 120, label: 'TUNIS' },
            { pos: [35.9375, 14.3754], dwellMinutes: 60,  label: 'MALTA' },
            { pos: [37.9838, 23.7275], dwellMinutes: 90,  label: 'ATHENS' }
        ],
        clearance: 4, speedKmh: 30, loop: 'circuit', showPath: true
    },
    {
        id: 'atlas-sweep',
        name: 'ATLAS SWEEP',
        type: 'ship',
        waypoints: [
            { pos: [45.0, -35.0], dwellMinutes: 0,   label: 'NORTH ATLANTIC' },
            { pos: [50.0, -20.0], dwellMinutes: 120, label: 'MIDPOINT' },
            { pos: [55.0, -5.0],  dwellMinutes: 0,   label: 'NORTHEAST' }
        ],
        clearance: 4, speedKmh: 28, loop: 'pingpong', showPath: false
    }
];

// ================================================================
//  IMPLEMENTATION — no editing needed below this line
// ================================================================

const map = L.map('map', {
    center: [30, 10],
    zoom: 3,
    minZoom: 2,
    zoomControl: false,
    attributionControl: true,
    maxBounds: [[-85, -180], [85, 180]],
    maxBoundsViscosity: 1.0
});

L.control.zoom({ position: 'topright' }).addTo(map);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
    noWrap: true
}).addTo(map);

// ---- Math helpers ----

function haversineKm(a, b) {
    const R = 6371;
    const dLat = (b[0] - a[0]) * Math.PI / 180;
    const dLng = (b[1] - a[1]) * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function bearingDeg(from, to) {
    const f1 = from[0] * Math.PI / 180;
    const f2 = to[0]   * Math.PI / 180;
    const dl = (to[1] - from[1]) * Math.PI / 180;
    const y  = Math.sin(dl) * Math.cos(f2);
    const x  = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Bearing that matches the SCREEN direction on the Mercator map (accounts for cos-latitude
// compression so the plane nose aligns with its visible path, not the geodetic great circle).
function screenBearing(from, to) {
    const avgLat = (from[0] + to[0]) / 2 * Math.PI / 180;
    const dLat = to[0] - from[0];
    const dLng = (to[1] - from[1]) * Math.cos(avgLat);
    return (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
}

function lerp(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function normalizeLoop(loop) {
    if (loop === true || loop === 'pingpong') return 'pingpong';
    if (loop === 'circuit') return 'circuit';
    return 'once';
}

// ---- SVG icons ----

function heliSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -20 28 42" width="28" height="42">
    <g class="rotor-blade">
      <ellipse cx="0" cy="-2" rx="13" ry="1.8" fill="#00ffe7" opacity="0.8"/>
      <ellipse cx="0" cy="-2" rx="1.8" ry="13" fill="#00ffe7" opacity="0.8"/>
      <circle cx="0" cy="-2" r="2.2" fill="#00ffe7" opacity="0.5"/>
    </g>
    <ellipse cx="0" cy="8" rx="4.5" ry="10" fill="#a09d09" stroke="#00ffe7" stroke-width="0.5"/>
    <ellipse cx="0" cy="0" rx="3.8" ry="3.2" fill="#00ffe7" opacity="0.15" stroke="#00ffe7" stroke-width="0.4"/>
    <rect x="-1.3" y="17" width="2.6" height="6" rx="0.6" fill="#777"/>
    <ellipse cx="0" cy="22.5" rx="5" ry="1.4" fill="#00ffe7" opacity="0.65"/>
  </svg>`;
}

function planeSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-17 -17 34 34" width="34" height="34">
    <ellipse cx="0" cy="0" rx="3.2" ry="14" fill="#a09d09" stroke="#00ffe7" stroke-width="0.5"/>
    <path d="M0,-5 L-16,7 L-2.5,4.5 Z"  fill="#a09d09" stroke="#00ffe7" stroke-width="0.4"/>
    <path d="M0,-5 L16,7 L2.5,4.5 Z"   fill="#a09d09" stroke="#00ffe7" stroke-width="0.4"/>
    <path d="M0,9 L-7,16 L-1.2,11 Z"   fill="#a09d09" stroke="#00ffe7" stroke-width="0.4"/>
    <path d="M0,9 L7,16 L1.2,11 Z"     fill="#a09d09" stroke="#00ffe7" stroke-width="0.4"/>
    <circle cx="-9.5" cy="5.5" r="1.6" fill="#00ffe7" opacity="0.55"/>
    <circle cx="9.5"  cy="5.5" r="1.6" fill="#00ffe7" opacity="0.55"/>
  </svg>`;
}

function shipSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -18 28 36" width="28" height="36">
    <path d="M-7,2 L-5,-5 L5,-5 L7,2 L0,9 Z" fill="#a09d09" stroke="#00ffe7" stroke-width="0.5"/>
    <rect x="-3.5" y="-11" width="7" height="6" rx="1" fill="#a09d09" stroke="#00ffe7" stroke-width="0.4"/>
    <line x1="0" y1="-11" x2="0" y2="-17" stroke="#00ffe7" stroke-width="0.9"/>
    <circle cx="0" cy="-17" r="1.6" fill="#00ffe7" opacity="0.7"/>
    <path d="M-7,4 Q-11,7 -9,11" stroke="#00ffe7" stroke-width="0.5" fill="none" opacity="0.4"/>
    <path d="M7,4 Q11,7 9,11" stroke="#00ffe7" stroke-width="0.5" fill="none" opacity="0.4"/>
  </svg>`;
}

// ---- Leaflet icon factories ----

function makeDeployIcon(d) {
    if (d.type === 'mission') {
        const sz = 18;
        const html = `<div class="dm-mission" style="width:${sz}px;height:${sz}px;"></div>`;
        return L.divIcon({ html, className: '', iconSize: [sz, sz], iconAnchor: [sz/2, sz/2], tooltipAnchor: [sz/2+4, 0] });
    }
    const cc = { active:'c-active', inactive:'c-inactive', compromised:'c-compr', unknown:'c-unknown' }[d.status] || 'c-active';
    const tc = { hq:'dm-hq', outpost:'dm-outpost', naval:'dm-naval', ground:'' }[d.type] || '';
    const sz = d.type === 'hq' ? 20 : 14;
    const pulse = (d.status === 'active' || d.status === 'compromised')
        ? '<div class="dm-ring"></div><div class="dm-ring-2"></div>' : '';
    return L.divIcon({
        html: `<div class="dm ${cc} ${tc}" style="width:${sz}px;height:${sz}px;">${pulse}<div class="dm-dot"></div></div>`,
        className: '',
        iconSize:   [sz, sz],
        iconAnchor: [sz / 2, sz / 2],
        tooltipAnchor: [sz / 2 + 4, 0]
    });
}

function makeVehicleIcon(type, bearing) {
    const svgs  = { helicopter: heliSVG, plane: planeSVG, ship: shipSVG };
    const sizes = { helicopter: [28, 42], plane: [34, 34], ship: [28, 36] };
    const svg   = (svgs[type] || planeSVG)();
    const size  = sizes[type] || [34, 34];
    return L.divIcon({
        html: `<div class="veh-wrap" style="transform:rotate(${bearing}deg)">${svg}</div>`,
        className: '',
        iconSize:   size,
        iconAnchor: [size[0] / 2, size[1] / 2],
        tooltipAnchor: [size[0] / 2 + 4, 0]
    });
}

// ---- Tooltip builders ----

function deployTT(d) {
    const redacted   = isNodeRedacted(d.id);
    const admin      = window.LuxorAuth && LuxorAuth.isAdmin();
    // Players see the name only when clearance is met AND node is not redacted
    const showName   = admin || (!redacted && PLAYER_CLEARANCE >= d.clearance);
    const sc = { active:'#00ffe7', inactive:'#666', compromised:'#ff3333', unknown:'#ff9900' }[d.status];
    const nameHtml   = admin
        ? `<div class="tt-name">${d.name}${redacted ? ' <span style="color:#c0392b;font-size:0.78em">[REDACTED]</span>' : ''}</div>`
        : `<div class="${showName ? 'tt-name' : 'tt-redact'}">${showName ? d.name : '████ REDACTED ████'}</div>`;
    return `<div>
    ${nameHtml}
    <div class="tt-row">TYPE: <b>${d.type.toUpperCase()}</b></div>
    <div class="tt-row">STATUS: <b style="color:${sc}">${d.status.toUpperCase()}</b></div>
    ${showName && d.notes ? `<div class="tt-notes">${d.notes}</div>` : ''}
    <div class="tt-clr">CLR REQUIRED: ${d.clearance}</div>
  </div>`;
}

function vehicleTT(v) {
    const route = v.route;
    const ok    = PLAYER_CLEARANCE >= route.clearance;
    const typeLabel = { helicopter:'HELICOPTER', plane:'AIRCRAFT', ship:'VESSEL' }[route.type] || 'UNKNOWN';

    let statusHtml = '';
    if (v.dwelling) {
        const wp = v.wps[v.dwellingAtWpIdx];
        const label = (wp && wp.label) ? wp.label : 'WAYPOINT';
        const remMin = Math.max(1, Math.ceil(v.dwellRemaining * TIME_SCALE / 60000));
        statusHtml = `<div class="tt-row">STATUS: <b style="color:#ff9900">⚓ HOLDING${ok ? ' @ ' + label : ''}</b></div>
                      ${ok ? `<div class="tt-row">DEPART IN: ~<b>${remMin} min</b></div>` : ''}`;
    } else {
        const fromWp = v.wps[v.direction === 1 ? v.segIdx : v.segIdx + 1];
        const toWp   = v.wps[v.direction === 1 ? v.segIdx + 1 : v.segIdx];
        if (ok && fromWp && toWp) {
            const fl = fromWp.label || '?';
            const tl = toWp.label   || '?';
            statusHtml = `<div class="tt-row">EN ROUTE: <b>${fl} → ${tl}</b></div>`;
        }
    }

    return `<div>
    <div class="${ok ? 'tt-name' : 'tt-redact'}">${ok ? route.name : '████ REDACTED ████'}</div>
    <div class="tt-row">TYPE: <b>${typeLabel}</b></div>
    ${statusHtml}
    <div class="tt-row">SPEED: <b>${ok ? route.speedKmh + ' km/h' : '—'}</b></div>
    ${ok && route.notes ? `<div class="tt-notes">${route.notes}</div>` : ''}
    <div class="tt-clr">CLR REQUIRED: ${route.clearance}</div>
  </div>`;
}

// ---- Deployment markers ----

const deployMarkers = {};

function canSeeDeployment(d) {
    return PLAYER_CLEARANCE >= d.clearance;
}

function buildDeployments() {
    Object.values(deployMarkers).forEach(m => m.remove());
    for (const k in deployMarkers) delete deployMarkers[k];

    DEPLOYMENTS.forEach(d => {
        if (!canSeeDeployment(d)) return;
        const m = L.marker([d.lat, d.lng], { icon: makeDeployIcon(d) })
            .bindTooltip(deployTT(d), { className: 'lx-tt', direction: 'top', offset: [0, -4] })
            .addTo(map);
        deployMarkers[d.id] = m;
    });
}

// Called when clearance or redacted state changes — show/hide without full rebuild
function updateDeployVisibility() {
    DEPLOYMENTS.forEach(d => {
        const show   = canSeeDeployment(d);
        const marker = deployMarkers[d.id];
        if (show && !marker) {
            const m = L.marker([d.lat, d.lng], { icon: makeDeployIcon(d) })
                .bindTooltip(deployTT(d), { className: 'lx-tt', direction: 'top', offset: [0, -4] })
                .addTo(map);
            deployMarkers[d.id] = m;
        } else if (show && marker) {
            marker.setTooltipContent(deployTT(d));
        } else if (!show && marker) {
            marker.remove();
            delete deployMarkers[d.id];
        }
    });
}

// ---- Vehicle class (multi-waypoint + dwell support) ----

const vehicles = [];

class Vehicle {
    constructor(route) {
        this.route = route;

        // Normalize old from/to format into waypoints
        this.wps = route.waypoints
            ? route.waypoints
            : [{ pos: route.from, dwellMinutes: 0 }, { pos: route.to, dwellMinutes: 0 }];

        this.numSegs  = this.wps.length - 1;
        this.loopMode = normalizeLoop(route.loop);
        this.direction = 1;
        this.segIdx    = this.numSegs > 1 ? Math.floor(Math.random() * this.numSegs) : 0;
        this.progress  = Math.random();

        this.dwelling       = false;
        this.dwellRemaining = 0;
        this.dwellingAtWpIdx = -1;
        this.lastTooltipUpdate = 0;
        this.lastTs  = null;
        this.done    = false;
        this._visible = null;  // null = unset, synced lazily in tick()

        // Precompute travel time (hours) per segment — TIME_SCALE applied dynamically in tick().
        this.segHours = this.wps.slice(0, -1).map((wp, i) => {
            const dist = haversineKm(wp.pos, this.wps[i + 1].pos);
            return Math.max(dist, 0.001) / route.speedKmh;
        });

        if (route.showPath) {
            this.pathLine = L.polyline(this.wps.map(w => w.pos), {
                color: '#00ffe7', weight: 1, opacity: 0.18, className: 'lx-route'
            }).addTo(map);
        }

        const fromPos    = this.wps[this.segIdx].pos;
        const toPos      = this.wps[this.segIdx + 1].pos;
        const initBrng   = screenBearing(fromPos, toPos);
        const initPos    = lerp(fromPos, toPos, this.progress);

        this.marker = L.marker(initPos, { icon: makeVehicleIcon(route.type, initBrng), zIndexOffset: 500 })
            .bindTooltip(vehicleTT(this), { className: 'lx-tt', direction: 'top', offset: [0, -4] })
            .addTo(map);
    }

    _canSee() {
        return PLAYER_CLEARANCE >= this.route.clearance;
    }

    updateVisibility() {
        const show = this._canSee();
        if (show === this._visible) return;
        this._visible = show;
        if (show) {
            if (this.marker   && !map.hasLayer(this.marker))   this.marker.addTo(map);
            if (this.pathLine && !map.hasLayer(this.pathLine)) this.pathLine.addTo(map);
        } else {
            if (this.marker)   this.marker.remove();
            if (this.pathLine) this.pathLine.remove();
        }
    }

    tick(ts) {
        if (this.done) return;
        // Hide vehicle when player clearance is insufficient
        const show = this._canSee();
        if (show !== this._visible) { this.updateVisibility(); }
        if (!show) return;
        if (this.lastTs === null) { this.lastTs = ts; return; }
        const dt = ts - this.lastTs;
        this.lastTs = ts;

        if (this.dwelling) {
            this.dwellRemaining -= dt;
            if (this.dwellRemaining <= 0) {
                this.dwelling = false;
                this.dwellingAtWpIdx = -1;
                this.refreshTooltip();
            } else {
                // Refresh countdown display ~once per second
                if (ts - this.lastTooltipUpdate > 1000) {
                    this.lastTooltipUpdate = ts;
                    this.refreshTooltip();
                }
            }
            return;
        }

        this.progress += (TIME_SCALE / ((this.segHours[this.segIdx] || 0.001) * 3600000)) * dt;

        if (this.progress >= 1) {
            this.progress = 0;

            // Which waypoint index did we just arrive at?
            let arrivedIdx = this.direction === 1 ? this.segIdx + 1 : this.segIdx;

            // Advance segment
            if (this.direction === 1) {
                this.segIdx++;
                if (this.segIdx >= this.numSegs) {
                    if      (this.loopMode === 'pingpong') { this.direction = -1; this.segIdx = this.numSegs - 1; }
                    else if (this.loopMode === 'circuit')  { this.segIdx = 0; }
                    else                                   { this.done = true; return; }
                }
            } else {
                this.segIdx--;
                if (this.segIdx < 0) {
                    this.direction = 1;
                    this.segIdx    = 0;
                    arrivedIdx     = 0;
                }
            }

            // Check dwell at arrived waypoint
            const arrivedWp = this.wps[arrivedIdx];
            const dwellMin  = arrivedWp ? (arrivedWp.dwellMinutes || 0) : 0;
            if (dwellMin > 0) {
                this.dwelling        = true;
                this.dwellRemaining  = dwellMin * 60000 / TIME_SCALE;
                this.dwellingAtWpIdx = arrivedIdx;
                this.marker.setLatLng(arrivedWp.pos);
                this.refreshTooltip();
                return;
            }
        }

        if (!this.done) {
            const fromPos = this.direction === 1 ? this.wps[this.segIdx].pos     : this.wps[this.segIdx + 1].pos;
            const toPos   = this.direction === 1 ? this.wps[this.segIdx + 1].pos : this.wps[this.segIdx].pos;
            if (!fromPos || !toPos) return;

            const pos  = lerp(fromPos, toPos, this.progress);
            const brng = screenBearing(fromPos, toPos);

            this.marker.setLatLng(pos);
            const el = this.marker.getElement();
            if (el) {
                const wrap = el.querySelector('.veh-wrap');
                if (wrap) wrap.style.transform = `rotate(${brng}deg)`;
            }
        }
    }

    refreshTooltip() {
        this.marker.setTooltipContent(vehicleTT(this));
    }

    remove() {
        this.done = true;
        this.marker.remove();
        if (this.pathLine) this.pathLine.remove();
    }
}

function buildVehicles() {
    ROUTES.forEach(r => {
        const wps = r.waypoints || [{ pos: r.from }, { pos: r.to }];
        if (wps.length < 2) return;
        vehicles.push(new Vehicle(r));
    });
}

// ---- Animation loop ----

function animLoop(ts) {
    vehicles.forEach(v => v.tick(ts));
    requestAnimationFrame(animLoop);
}

// ---- Clearance UI ----

function setClearance(level) {
    PLAYER_CLEARANCE = level;
    document.querySelectorAll('.cl-btn').forEach(b =>
        b.classList.toggle('active', +b.dataset.level === level)
    );
    updateDeployVisibility();
    vehicles.forEach(v => v.updateVisibility());
}

document.querySelectorAll('.cl-btn').forEach(b =>
    b.addEventListener('click', () => setClearance(+b.dataset.level))
);

// Cross-tab sync — update map when redaction state changes (e.g. hack win reveals a node)
window.addEventListener('storage', function (e) {
    if (e.key === LS_REDACTED) {
        updateDeployVisibility();
    }
});

// ---- UTC clock ----

function tickClock() {
    const n = new Date();
    const p = x => String(x).padStart(2, '0');
    document.getElementById('clock-time').textContent =
        `${p(n.getUTCHours())}:${p(n.getUTCMinutes())}:${p(n.getUTCSeconds())}`;
    document.getElementById('clock-date').textContent =
        n.toUTCString().slice(0, 16).toUpperCase();
}
setInterval(tickClock, 1000);
tickClock();

// ================================================================
//  LOCALSTORAGE — custom entry persistence
// ================================================================

const LS_DEPS          = 'luxor_custom_deployments';
const LS_RTES          = 'luxor_custom_routes';
const LS_REDACTED      = 'luxorAssetRedacted';
const LS_DEP_OVERRIDES = 'luxor_dep_overrides';  // { id: { name, lat, lng, type, status, clearance, notes } }
const LS_RTE_OVERRIDES = 'luxor_rte_overrides';  // { id: { name, clearance, speedKmh, loop } }
const LS_DEP_HIDDEN    = 'luxor_dep_hidden';      // [id, ...]
const LS_RTE_HIDDEN    = 'luxor_rte_hidden';      // [id, ...]

function getStoredDeps()     { try { return JSON.parse(localStorage.getItem(LS_DEPS)          || '[]'); } catch { return []; } }
function getStoredRtes()     { try { return JSON.parse(localStorage.getItem(LS_RTES)          || '[]'); } catch { return []; } }
function getRedactedMap()    { try { return JSON.parse(localStorage.getItem(LS_REDACTED)      || '{}'); } catch { return {}; } }
function getDepOverrides()   { try { return JSON.parse(localStorage.getItem(LS_DEP_OVERRIDES) || '{}'); } catch { return {}; } }
function getRteOverrides()   { try { return JSON.parse(localStorage.getItem(LS_RTE_OVERRIDES) || '{}'); } catch { return {}; } }
function getHiddenDeps()     { try { return JSON.parse(localStorage.getItem(LS_DEP_HIDDEN)    || '[]'); } catch { return []; } }
function getHiddenRtes()     { try { return JSON.parse(localStorage.getItem(LS_RTE_HIDDEN)    || '[]'); } catch { return []; } }

function isNodeRedacted(id) { return !!getRedactedMap()[id]; }

function setNodeRedacted(id, val) {
    const r = getRedactedMap();
    if (val) r[id] = true; else delete r[id];
    localStorage.setItem(LS_REDACTED, JSON.stringify(r));
}

function persistDep(d)  { const a = getStoredDeps(); a.push(d); localStorage.setItem(LS_DEPS, JSON.stringify(a)); }
function persistRte(r)  { const a = getStoredRtes(); a.push(r); localStorage.setItem(LS_RTES, JSON.stringify(a)); }

function removeDep(id) {
    localStorage.setItem(LS_DEPS, JSON.stringify(getStoredDeps().filter(d => d.id !== id)));
    const h = getHiddenDeps(); if (!h.includes(id)) { h.push(id); localStorage.setItem(LS_DEP_HIDDEN, JSON.stringify(h)); }
}
function removeRte(id) {
    localStorage.setItem(LS_RTES, JSON.stringify(getStoredRtes().filter(r => r.id !== id)));
    const h = getHiddenRtes(); if (!h.includes(id)) { h.push(id); localStorage.setItem(LS_RTE_HIDDEN, JSON.stringify(h)); }
}

function saveDepOverride(id, patch) {
    const ov = getDepOverrides(); ov[id] = Object.assign(ov[id] || {}, patch);
    localStorage.setItem(LS_DEP_OVERRIDES, JSON.stringify(ov));
    const d = DEPLOYMENTS.find(d => d.id === id); if (d) Object.assign(d, patch);
}
function saveRteOverride(id, patch) {
    const ov = getRteOverrides(); ov[id] = Object.assign(ov[id] || {}, patch);
    localStorage.setItem(LS_RTE_OVERRIDES, JSON.stringify(ov));
    const r = ROUTES.find(r => r.id === id); if (r) Object.assign(r, patch);
}

function loadCustomFromStorage() {
    const depOv     = getDepOverrides();
    const rteOv     = getRteOverrides();
    const hiddenDep = getHiddenDeps();
    const hiddenRte = getHiddenRtes();

    // Apply overrides + remove hidden built-ins
    for (let i = DEPLOYMENTS.length - 1; i >= 0; i--) {
        if (hiddenDep.includes(DEPLOYMENTS[i].id)) { DEPLOYMENTS.splice(i, 1); continue; }
        if (depOv[DEPLOYMENTS[i].id]) Object.assign(DEPLOYMENTS[i], depOv[DEPLOYMENTS[i].id]);
    }
    for (let i = ROUTES.length - 1; i >= 0; i--) {
        if (hiddenRte.includes(ROUTES[i].id)) { ROUTES.splice(i, 1); continue; }
        if (rteOv[ROUTES[i].id]) Object.assign(ROUTES[i], rteOv[ROUTES[i].id]);
    }

    getStoredDeps().forEach(d => DEPLOYMENTS.push(d));
    getStoredRtes().forEach(r => ROUTES.push(r));
}

// ================================================================
//  IN-BROWSER ADD UI
// ================================================================

// Map-click mode: when active, next map click fills a lat/lng pair
let _pickTarget = null; // { latEl, lngEl }

map.on('click', e => {
    if (!_pickTarget) return;
    _pickTarget.latEl.value = e.latlng.lat.toFixed(5);
    _pickTarget.lngEl.value = e.latlng.lng.toFixed(5);
    _pickTarget = null;
    map.getContainer().style.cursor = '';
    document.querySelectorAll('.lx-pick').forEach(b => b.classList.remove('picking'));
});

function activatePick(latEl, lngEl, btn) {
    _pickTarget = { latEl, lngEl };
    map.getContainer().style.cursor = 'crosshair';
    document.querySelectorAll('.lx-pick').forEach(b => b.classList.remove('picking'));
    btn.classList.add('picking');
}

// Waypoint rows state for route form
let _wps = [];

function wpRowHTML(i) {
    const w = _wps[i];
    return `<div class="lx-wp-row" id="lx-wp-${i}">
        <button class="lx-pick lx-pick-wp" data-idx="${i}" title="Click map to fill coords">⊕</button>
        <input class="lx-wp-lat" data-idx="${i}" type="number" step="any" placeholder="Lat" value="${w.lat}">
        <input class="lx-wp-lng" data-idx="${i}" type="number" step="any" placeholder="Lng" value="${w.lng}">
        <input class="lx-wp-dwell" data-idx="${i}" type="number" min="0" step="1" placeholder="Dwell" value="${w.dwell}">
        <input class="lx-wp-label" data-idx="${i}" type="text" placeholder="Label" value="${w.label}">
        ${_wps.length > 2 ? `<button class="lx-rm-wp" data-idx="${i}" title="Remove">✕</button>` : '<span></span>'}
    </div>`;
}

function renderWpRows() {
    const c = document.getElementById('lx-wps');
    if (!c) return;
    c.innerHTML = _wps.map((_, i) => wpRowHTML(i)).join('');
    // wire events
    c.querySelectorAll('.lx-wp-lat').forEach(el => el.addEventListener('input', () => { _wps[+el.dataset.idx].lat = el.value; }));
    c.querySelectorAll('.lx-wp-lng').forEach(el => el.addEventListener('input', () => { _wps[+el.dataset.idx].lng = el.value; }));
    c.querySelectorAll('.lx-wp-dwell').forEach(el => el.addEventListener('input', () => { _wps[+el.dataset.idx].dwell = el.value; }));
    c.querySelectorAll('.lx-wp-label').forEach(el => el.addEventListener('input', () => { _wps[+el.dataset.idx].label = el.value; }));
    c.querySelectorAll('.lx-pick-wp').forEach(btn => {
        btn.addEventListener('click', () => {
            const i   = +btn.dataset.idx;
            const row = document.getElementById(`lx-wp-${i}`);
            activatePick(row.querySelector('.lx-wp-lat'), row.querySelector('.lx-wp-lng'), btn);
        });
    });
    c.querySelectorAll('.lx-rm-wp').forEach(btn => {
        btn.addEventListener('click', () => {
            _wps.splice(+btn.dataset.idx, 1);
            renderWpRows();
        });
    });
}

function renderManageTab() {
    const c = document.getElementById('lx-mgr-list');
    if (!c) return;

    if (DEPLOYMENTS.length === 0 && ROUTES.length === 0) {
        c.innerHTML = '<div class="lx-mgr-empty">No entries on the map yet.</div>';
        return;
    }

    c.innerHTML = '';

    // Section: Deployments
    const depHdr = document.createElement('div');
    depHdr.style.cssText = 'font-size:9px;letter-spacing:2px;opacity:0.4;padding:8px 0 4px;';
    depHdr.textContent = 'DEPLOYMENTS';
    c.appendChild(depHdr);

    DEPLOYMENTS.forEach(d => {
        const row = document.createElement('div');
        row.className = 'lx-mgr-row';
        row.style.flexWrap = 'wrap';
        row.innerHTML = `
            <div style="flex:1;min-width:0;">
                <div class="lx-mgr-name">${d.name}</div>
                <div class="lx-mgr-sub">${d.type} · ${d.status} · CLR${d.clearance}</div>
            </div>
            <div style="display:flex;gap:5px;flex-shrink:0;">
                <button class="lx-mgr-edit" style="background:none;border:1px solid #00ffe750;color:#00ffe7;cursor:pointer;font-size:9px;letter-spacing:1px;padding:3px 7px;font-family:Consolas,monospace;" data-type="dep" data-id="${d.id}">EDIT</button>
                <button class="lx-mgr-del" data-type="dep" data-id="${d.id}">DELETE</button>
            </div>
            <div class="lx-edit-form" data-id="${d.id}" style="display:none;width:100%;padding:8px 0;display:none;flex-direction:column;gap:5px;">
                <input class="lx-field-inp" data-field="name" placeholder="Name" value="${(d.name||'').replace(/"/g,'&quot;')}" style="width:100%;background:rgba(0,255,231,0.04);border:1px solid #00ffe730;color:#00ffe7;font-family:Consolas,monospace;font-size:10px;padding:4px 6px;outline:none;box-sizing:border-box;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;">
                    <input class="lx-field-inp" data-field="lat" type="number" step="any" placeholder="Latitude" value="${d.lat||''}" style="background:rgba(0,255,231,0.04);border:1px solid #00ffe730;color:#00ffe7;font-family:Consolas,monospace;font-size:10px;padding:4px 6px;outline:none;">
                    <input class="lx-field-inp" data-field="lng" type="number" step="any" placeholder="Longitude" value="${d.lng||''}" style="background:rgba(0,255,231,0.04);border:1px solid #00ffe730;color:#00ffe7;font-family:Consolas,monospace;font-size:10px;padding:4px 6px;outline:none;">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;">
                    <select class="lx-field-inp" data-field="type" style="background:#050d10;border:1px solid #00ffe730;color:#00ffe7;font-family:Consolas,monospace;font-size:10px;padding:4px 6px;outline:none;">
                        ${['mission','ground','outpost','naval','hq'].map(t=>`<option value="${t}"${d.type===t?' selected':''}>${t}</option>`).join('')}
                    </select>
                    <select class="lx-field-inp" data-field="status" style="background:#050d10;border:1px solid #00ffe730;color:#00ffe7;font-family:Consolas,monospace;font-size:10px;padding:4px 6px;outline:none;">
                        ${['active','inactive','compromised','unknown'].map(s=>`<option value="${s}"${d.status===s?' selected':''}>${s}</option>`).join('')}
                    </select>
                    <select class="lx-field-inp" data-field="clearance" style="background:#050d10;border:1px solid #00ffe730;color:#00ffe7;font-family:Consolas,monospace;font-size:10px;padding:4px 6px;outline:none;">
                        ${[1,2,3,4,5].map(n=>`<option value="${n}"${d.clearance==n?' selected':''}>${n}</option>`).join('')}
                    </select>
                </div>
                <textarea class="lx-field-inp" data-field="notes" placeholder="Notes" rows="2" style="width:100%;background:rgba(0,255,231,0.04);border:1px solid #00ffe730;color:#00ffe7;font-family:Consolas,monospace;font-size:10px;padding:4px 6px;outline:none;resize:vertical;box-sizing:border-box;">${d.notes||''}</textarea>
                <button class="lx-save-dep" data-id="${d.id}" style="background:rgba(0,255,231,0.08);border:1px solid #00ffe7;color:#00ffe7;font-family:Consolas,monospace;font-size:10px;letter-spacing:1px;padding:5px;cursor:pointer;">SAVE CHANGES</button>
            </div>`;
        c.appendChild(row);
    });

    // Section: Routes
    const rteHdr = document.createElement('div');
    rteHdr.style.cssText = 'font-size:9px;letter-spacing:2px;opacity:0.4;padding:12px 0 4px;';
    rteHdr.textContent = 'ROUTES';
    c.appendChild(rteHdr);

    ROUTES.forEach(r => {
        const stops = (r.waypoints || []).length;
        const row   = document.createElement('div');
        row.className = 'lx-mgr-row';
        row.style.flexWrap = 'wrap';
        row.innerHTML = `
            <div style="flex:1;min-width:0;">
                <div class="lx-mgr-name">${r.name}</div>
                <div class="lx-mgr-sub">${r.type} · ${stops} stops · CLR${r.clearance}</div>
            </div>
            <div style="display:flex;gap:5px;flex-shrink:0;">
                <button class="lx-mgr-edit" style="background:none;border:1px solid #00ffe750;color:#00ffe7;cursor:pointer;font-size:9px;letter-spacing:1px;padding:3px 7px;font-family:Consolas,monospace;" data-type="rte" data-id="${r.id}">EDIT</button>
                <button class="lx-mgr-del" data-type="rte" data-id="${r.id}">DELETE</button>
            </div>
            <div class="lx-edit-form" data-id="${r.id}" style="display:none;width:100%;padding:8px 0;flex-direction:column;gap:5px;">
                <input class="lx-field-inp" data-field="name" placeholder="Callsign" value="${(r.name||'').replace(/"/g,'&quot;')}" style="width:100%;background:rgba(0,255,231,0.04);border:1px solid #00ffe730;color:#00ffe7;font-family:Consolas,monospace;font-size:10px;padding:4px 6px;outline:none;box-sizing:border-box;">
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;">
                    <select class="lx-field-inp" data-field="type" style="background:#050d10;border:1px solid #00ffe730;color:#00ffe7;font-family:Consolas,monospace;font-size:10px;padding:4px 6px;outline:none;">
                        ${['plane','helicopter','ship'].map(t=>`<option value="${t}"${r.type===t?' selected':''}>${t}</option>`).join('')}
                    </select>
                    <select class="lx-field-inp" data-field="clearance" style="background:#050d10;border:1px solid #00ffe730;color:#00ffe7;font-family:Consolas,monospace;font-size:10px;padding:4px 6px;outline:none;">
                        ${[1,2,3,4,5].map(n=>`<option value="${n}"${r.clearance==n?' selected':''}>${n}</option>`).join('')}
                    </select>
                    <select class="lx-field-inp" data-field="loop" style="background:#050d10;border:1px solid #00ffe730;color:#00ffe7;font-family:Consolas,monospace;font-size:10px;padding:4px 6px;outline:none;">
                        ${['pingpong','circuit','once'].map(l=>`<option value="${l}"${normalizeLoop(r.loop)===l?' selected':''}>${l}</option>`).join('')}
                    </select>
                </div>
                <input class="lx-field-inp" data-field="speedKmh" type="number" placeholder="Speed km/h" value="${r.speedKmh||''}" style="width:100%;background:rgba(0,255,231,0.04);border:1px solid #00ffe730;color:#00ffe7;font-family:Consolas,monospace;font-size:10px;padding:4px 6px;outline:none;box-sizing:border-box;">
                <textarea class="lx-field-inp" data-field="notes" placeholder="Route notes" rows="2" style="width:100%;background:rgba(0,255,231,0.04);border:1px solid #00ffe730;color:#00ffe7;font-family:Consolas,monospace;font-size:10px;padding:4px 6px;outline:none;resize:vertical;box-sizing:border-box;">${r.notes||''}</textarea>
                <button class="lx-save-rte" data-id="${r.id}" style="background:rgba(0,255,231,0.08);border:1px solid #00ffe7;color:#00ffe7;font-family:Consolas,monospace;font-size:10px;letter-spacing:1px;padding:5px;cursor:pointer;">SAVE CHANGES</button>
            </div>`;
        c.appendChild(row);
    });

    // Wire EDIT toggle
    c.querySelectorAll('.lx-mgr-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const form = c.querySelector(`.lx-edit-form[data-id="${btn.dataset.id}"]`);
            if (!form) return;
            const open = form.style.display === 'flex';
            c.querySelectorAll('.lx-edit-form').forEach(f => f.style.display = 'none');
            form.style.display = open ? 'none' : 'flex';
        });
    });

    // Wire DELETE
    c.querySelectorAll('.lx-mgr-del').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!confirm(`Delete "${btn.closest('.lx-mgr-row').querySelector('.lx-mgr-name').textContent}"?`)) return;
            if (btn.dataset.type === 'dep') {
                removeDep(btn.dataset.id);
                const idx = DEPLOYMENTS.findIndex(d => d.id === btn.dataset.id);
                if (idx >= 0) DEPLOYMENTS.splice(idx, 1);
                const m = deployMarkers[btn.dataset.id];
                if (m) { m.remove(); delete deployMarkers[btn.dataset.id]; }
            } else {
                removeRte(btn.dataset.id);
                const idx = ROUTES.findIndex(r => r.id === btn.dataset.id);
                if (idx >= 0) ROUTES.splice(idx, 1);
                const vi = vehicles.findIndex(v => v.route.id === btn.dataset.id);
                if (vi >= 0) { const v = vehicles[vi]; if (v.marker) v.marker.remove(); if (v.pathLine) v.pathLine.remove(); vehicles.splice(vi, 1); }
            }
            renderManageTab();
        });
    });

    // Wire SAVE deployment
    c.querySelectorAll('.lx-save-dep').forEach(btn => {
        btn.addEventListener('click', () => {
            const form = c.querySelector(`.lx-edit-form[data-id="${btn.dataset.id}"]`);
            if (!form) return;
            const patch = {};
            form.querySelectorAll('.lx-field-inp').forEach(inp => {
                const f = inp.dataset.field;
                patch[f] = (f === 'lat' || f === 'lng') ? parseFloat(inp.value) : (f === 'clearance' ? +inp.value : inp.value.trim());
            });
            const d = DEPLOYMENTS.find(d => d.id === btn.dataset.id);
            if (d) {
                if (d._custom) {
                    Object.assign(d, patch);
                    const stored = getStoredDeps(); const si = stored.findIndex(x => x.id === d.id);
                    if (si >= 0) { Object.assign(stored[si], patch); localStorage.setItem(LS_DEPS, JSON.stringify(stored)); }
                } else {
                    saveDepOverride(btn.dataset.id, patch);
                }
                buildDeployments();
                renderManageTab();
            }
        });
    });

    // Wire SAVE route
    c.querySelectorAll('.lx-save-rte').forEach(btn => {
        btn.addEventListener('click', () => {
            const form = c.querySelector(`.lx-edit-form[data-id="${btn.dataset.id}"]`);
            if (!form) return;
            const patch = {};
            form.querySelectorAll('.lx-field-inp').forEach(inp => {
                const f = inp.dataset.field;
                patch[f] = (f === 'clearance') ? +inp.value : (f === 'speedKmh') ? parseFloat(inp.value) : inp.value.trim();
            });
            const r = ROUTES.find(r => r.id === btn.dataset.id);
            if (r) {
                if (r._custom) {
                    Object.assign(r, patch);
                    const stored = getStoredRtes(); const si = stored.findIndex(x => x.id === r.id);
                    if (si >= 0) { Object.assign(stored[si], patch); localStorage.setItem(LS_RTES, JSON.stringify(stored)); }
                } else {
                    saveRteOverride(btn.dataset.id, patch);
                }
                const vi = vehicles.findIndex(v => v.route.id === r.id);
                if (vi >= 0) { const v = vehicles.splice(vi, 1)[0]; if (v.marker) v.marker.remove(); if (v.pathLine) v.pathLine.remove(); vehicles.push(new Vehicle(r)); }
                renderManageTab();
            }
        });
    });

    c.querySelectorAll('.lx-mgr-del').forEach(btn => {
        btn.addEventListener('click', () => {
            const id   = btn.dataset.id;
            const type = btn.dataset.type;
            if (type === 'dep') {
                removeDep(id);
                const idx = DEPLOYMENTS.findIndex(d => d.id === id);
                if (idx !== -1) DEPLOYMENTS.splice(idx, 1);
                buildDeployments();
            } else {
                removeRte(id);
                const vi = vehicles.findIndex(v => v.route.id === id);
                if (vi !== -1) { vehicles[vi].remove(); vehicles.splice(vi, 1); }
                const ri = ROUTES.findIndex(r => r.id === id);
                if (ri !== -1) ROUTES.splice(ri, 1);
            }
            renderManageTab();
        });
    });
}

function showMsg(el, text, ok) {
    el.textContent = text;
    el.className   = 'lx-msg ' + (ok ? 'ok' : 'err');
    setTimeout(() => { el.textContent = ''; el.className = 'lx-msg'; }, 3000);
}

function injectAddUI() {
    // ---- CSS ----
    const style = document.createElement('style');
    style.textContent = `
        #lx-add-btn {
            position:fixed; bottom:5.5em; left:1em; z-index:950;
            width:42px; height:42px;
            background:rgba(8,8,18,0.95); border:1px solid #00ffe7;
            color:#00ffe7; font-size:22px; cursor:pointer;
            font-family:'Consolas',monospace; border-radius:4px;
            box-shadow:0 0 12px rgba(0,255,231,0.2);
            transition:background 0.2s;
        }
        #lx-add-btn:hover { background:rgba(0,255,231,0.12); }
        #lx-add-panel {
            position:fixed; bottom:9em; left:1em; z-index:950;
            width:min(340px, calc(100vw - 1.5em)); max-height:78vh; display:flex; flex-direction:column;
            background:rgba(6,8,18,0.98); border:1px solid #00ffe7;
            font-family:'Consolas','Courier New',monospace; font-size:12px;
            color:#00ffe7; box-shadow:0 0 30px rgba(0,255,231,0.15);
        }
        #lx-add-panel.hidden { display:none; }
        .lx-ph {
            display:flex; justify-content:space-between; align-items:center;
            padding:8px 12px; border-bottom:1px solid #00ffe730;
            font-size:13px; letter-spacing:2px; font-weight:bold; flex-shrink:0;
        }
        .lx-ph-close { background:none; border:none; color:#00ffe7; cursor:pointer; font-size:15px; padding:0; }
        .lx-tabs { display:flex; border-bottom:1px solid #00ffe730; flex-shrink:0; }
        .lx-tab {
            flex:1; padding:7px 4px; background:none; border:none;
            border-right:1px solid #00ffe730; color:#00ffe750;
            font-family:'Consolas',monospace; font-size:10px; letter-spacing:1px; cursor:pointer;
            transition:all 0.15s;
        }
        .lx-tab:last-child { border-right:none; }
        .lx-tab.active { color:#00ffe7; background:rgba(0,255,231,0.07); }
        .lx-tab-body { overflow-y:auto; flex:1; }
        .lx-tc { padding:12px; }
        .lx-tc.hidden { display:none; }
        .lx-field { margin-bottom:9px; }
        .lx-field label { display:block; font-size:9px; letter-spacing:1px; opacity:0.6; margin-bottom:3px; }
        .lx-field input, .lx-field select, .lx-field textarea {
            width:100%; background:rgba(0,255,231,0.04); border:1px solid #00ffe730;
            color:#00ffe7; font-family:'Consolas',monospace; font-size:11px; padding:4px 6px;
            box-sizing:border-box; outline:none;
        }
        .lx-field input:focus, .lx-field select:focus { border-color:#00ffe7; }
        .lx-field select option { background:#050d0d; }
        .lx-field textarea { height:48px; resize:vertical; }
        .lx-row2 { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .lx-pick {
            padding:3px 7px; background:none; border:1px solid #00ffe740;
            color:#00ffe770; font-family:'Consolas',monospace; font-size:10px;
            cursor:pointer; white-space:nowrap; transition:all 0.15s;
        }
        .lx-pick:hover, .lx-pick.picking { color:#00ffe7; border-color:#00ffe7; background:rgba(0,255,231,0.1); }
        .lx-pick.picking { animation:lx-blink 0.6s ease-in-out infinite; }
        @keyframes lx-blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .lx-wps-label {
            display:grid; grid-template-columns:24px 1fr 1fr 70px 80px 20px;
            gap:3px; font-size:9px; opacity:0.45; letter-spacing:1px;
            padding:0 0 4px 0; border-bottom:1px solid #00ffe715; margin-bottom:4px;
        }
        .lx-wp-row {
            display:grid; grid-template-columns:24px 1fr 1fr 70px 80px 20px;
            gap:3px; margin-bottom:3px; align-items:center;
        }
        .lx-wp-row input {
            background:rgba(0,255,231,0.04); border:1px solid #00ffe720;
            color:#00ffe7; font-family:'Consolas',monospace; font-size:10px;
            padding:3px 4px; width:100%; box-sizing:border-box; outline:none;
        }
        .lx-wp-row input:focus { border-color:#00ffe760; }
        .lx-rm-wp {
            background:none; border:1px solid #ff333340; color:#ff3333;
            cursor:pointer; font-size:10px; width:20px; height:20px; padding:0;
            font-family:'Consolas',monospace;
        }
        .lx-rm-wp:hover { border-color:#ff3333; }
        .lx-add-wp-btn {
            background:none; border:1px solid #00ffe730; color:#00ffe760;
            cursor:pointer; font-size:10px; padding:4px 10px;
            font-family:'Consolas',monospace; margin-top:6px; letter-spacing:1px;
        }
        .lx-add-wp-btn:hover { color:#00ffe7; border-color:#00ffe7; }
        .lx-submit {
            width:100%; background:rgba(0,255,231,0.07); border:1px solid #00ffe7;
            color:#00ffe7; font-family:'Consolas',monospace; font-size:11px;
            letter-spacing:2px; padding:8px; cursor:pointer; margin-top:10px;
            transition:background 0.2s;
        }
        .lx-submit:hover { background:rgba(0,255,231,0.18); }
        .lx-msg { font-size:10px; padding:4px 0; letter-spacing:1px; min-height:18px; }
        .lx-msg.ok  { color:#00ffe7; }
        .lx-msg.err { color:#ff3333; }
        .lx-div { border-top:1px solid #00ffe715; margin:10px 0; }
        .lx-mgr-row {
            display:flex; justify-content:space-between; align-items:center;
            padding:6px 0; border-bottom:1px solid #00ffe715;
        }
        .lx-mgr-name { font-size:11px; letter-spacing:1px; }
        .lx-mgr-sub  { font-size:9px; opacity:0.45; margin-top:1px; }
        .lx-mgr-del  {
            background:none; border:1px solid #ff333360; color:#ff3333;
            cursor:pointer; font-size:9px; letter-spacing:1px; padding:3px 7px;
            font-family:'Consolas',monospace; flex-shrink:0;
        }
        .lx-mgr-del:hover { border-color:#ff3333; }
        .lx-mgr-empty { font-size:10px; opacity:0.45; line-height:1.6; padding:6px 0; }
        .lx-rdt-row {
            display:flex; justify-content:space-between; align-items:center;
            padding:5px 0; border-bottom:1px solid #00ffe715;
        }
        .lx-rdt-chk-wrap {
            display:flex; align-items:center; gap:5px; cursor:pointer;
            padding:2px 6px; border:1px solid #ff333340;
            transition:border-color 0.15s, background 0.15s;
        }
        .lx-rdt-chk-wrap:hover { border-color:#ff3333; background:rgba(255,51,51,0.06); }
        .lx-rdt-chk-wrap.is-redacted { border-color:#ff3333; background:rgba(255,51,51,0.08); }
        .lx-rdt-chk { width:auto !important; cursor:pointer; accent-color:#ff3333; }
        .lx-rdt-lbl { font-size:9px; letter-spacing:1px; color:#ff3333; }
        .lx-export {
            width:100%; background:none; border:1px solid #00ffe730; color:#00ffe760;
            font-family:'Consolas',monospace; font-size:10px; letter-spacing:1px;
            padding:6px; cursor:pointer; margin-top:12px; transition:all 0.15s;
        }
        .lx-export:hover { color:#00ffe7; border-color:#00ffe7; }
        .lx-note { font-size:9px; opacity:0.4; line-height:1.5; margin-bottom:8px; }

        /* ── Settings panel (time scale) ── */
        #lx-set-btn {
            position:fixed; bottom:9.5em; left:1em; z-index:950;
            width:42px; height:42px;
            background:rgba(8,8,18,0.95); border:1px solid #b8a80080;
            color:#b8a800; font-size:16px; cursor:pointer;
            font-family:'Consolas',monospace; border-radius:4px;
            box-shadow:0 0 8px rgba(184,168,0,0.15); transition:background 0.2s;
        }
        #lx-set-btn:hover { background:rgba(184,168,0,0.1); }
        #lx-set-panel {
            position:fixed; bottom:13.5em; left:1em; z-index:950;
            width:260px; padding:14px 16px;
            background:rgba(6,8,18,0.98); border:1px solid #b8a80060;
            font-family:'Consolas','Courier New',monospace; font-size:12px; color:#b8a800;
            box-shadow:0 0 20px rgba(184,168,0,0.12);
        }
        #lx-set-panel.hidden { display:none; }
        .lx-set-title {
            font-size:10px; letter-spacing:2px; font-weight:bold;
            border-bottom:1px solid #b8a80030; padding-bottom:7px; margin-bottom:12px;
        }
        .lx-set-row { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
        .lx-set-lbl { font-size:9px; letter-spacing:1px; opacity:0.6; min-width:90px; }
        .lx-set-inp {
            flex:1; background:rgba(184,168,0,0.05); border:1px solid #b8a80040;
            color:#b8a800; font-family:'Consolas',monospace; font-size:11px;
            padding:4px 6px; outline:none;
        }
        .lx-set-inp:focus { border-color:#b8a800; }
        .lx-set-note { font-size:9px; opacity:0.35; line-height:1.5; margin-top:4px; }
        .lx-set-apply {
            width:100%; background:rgba(184,168,0,0.07); border:1px solid #b8a80060;
            color:#b8a800; font-family:'Consolas',monospace; font-size:10px;
            letter-spacing:2px; padding:7px; cursor:pointer; margin-top:6px; transition:background 0.2s;
        }
        .lx-set-apply:hover { background:rgba(184,168,0,0.18); }
    `;
    document.head.appendChild(style);

    // ---- HTML ----
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <button id="lx-add-btn" title="Add deployment or route">+</button>
    <button id="lx-set-btn" title="Map speed settings">⚙</button>
    <div id="lx-set-panel" class="hidden">
        <div class="lx-set-title">⚙ MAP SETTINGS</div>
        <div class="lx-set-row">
            <span class="lx-set-lbl">TIME SCALE</span>
            <input class="lx-set-inp" id="lx-ts-inp" type="number" min="0.1" max="500" step="0.5" value="5">
        </div>
        <div class="lx-set-note">
            1× = real-time &nbsp;|&nbsp; 5× ≈ 80 min/transatlantic<br>
            10× ≈ 40 min/transatlantic &nbsp;|&nbsp; 300× ≈ 80 sec
        </div>
        <button class="lx-set-apply" id="lx-ts-apply">APPLY</button>
    </div>
    <div id="lx-add-panel" class="hidden">
        <div class="lx-ph">
            <span>⊕ ADD ASSET DATA</span>
            <button class="lx-ph-close" id="lx-close">✕</button>
        </div>
        <div class="lx-tabs">
            <button class="lx-tab active" data-tab="dep">DEPLOY</button>
            <button class="lx-tab"        data-tab="rte">ROUTE</button>
            <button class="lx-tab"        data-tab="mgr">MANAGE</button>
            <button class="lx-tab"        data-tab="rdt">REDACT</button>
        </div>
        <div class="lx-tab-body">

        <!-- ── DEPLOYMENT TAB ── -->
        <div class="lx-tc" id="lx-tc-dep">
            <div class="lx-field">
                <label>NAME / CALLSIGN</label>
                <input id="dep-name" type="text" placeholder="Team Alpha">
            </div>
            <div class="lx-row2">
                <div class="lx-field">
                    <label>LATITUDE</label>
                    <input id="dep-lat" type="number" step="any" placeholder="48.8566">
                </div>
                <div class="lx-field">
                    <label>LONGITUDE</label>
                    <input id="dep-lng" type="number" step="any" placeholder="2.3522">
                </div>
            </div>
            <button class="lx-pick" id="dep-pick">⊕ CLICK MAP TO PICK COORDS</button>
            <div style="height:8px"></div>
            <div class="lx-row2">
                <div class="lx-field">
                    <label>TYPE</label>
                    <select id="dep-type">
                        <option value="mission">⬧ Mission</option>
                        <option value="ground">Ground Unit</option>
                        <option value="outpost">Outpost</option>
                        <option value="naval">Naval</option>
                        <option value="hq">HQ</option>
                    </select>
                </div>
                <div class="lx-field">
                    <label>STATUS</label>
                    <select id="dep-status">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="compromised">Compromised</option>
                        <option value="unknown">Unknown</option>
                    </select>
                </div>
            </div>
            <div class="lx-field">
                <label>CLEARANCE (1–5)</label>
                <select id="dep-clr">
                    <option>1</option><option>2</option><option>3</option>
                    <option>4</option><option>5</option>
                </select>
            </div>
            <div class="lx-field">
                <label>NOTES (optional)</label>
                <textarea id="dep-notes" placeholder="Intel summary, handler callsign, etc."></textarea>
            </div>
            <div class="lx-msg" id="dep-msg"></div>
            <button class="lx-submit" id="dep-submit">⊕ ADD DEPLOYMENT</button>
        </div>

        <!-- ── ROUTE TAB ── -->
        <div class="lx-tc hidden" id="lx-tc-rte">
            <div class="lx-field">
                <label>CALLSIGN</label>
                <input id="rte-name" type="text" placeholder="CONDOR-7">
            </div>
            <div class="lx-row2">
                <div class="lx-field">
                    <label>VEHICLE TYPE</label>
                    <select id="rte-type">
                        <option value="plane">Plane</option>
                        <option value="helicopter">Helicopter</option>
                        <option value="ship">Ship</option>
                    </select>
                </div>
                <div class="lx-field">
                    <label>SPEED (km/h)</label>
                    <input id="rte-speed" type="number" min="1" placeholder="860">
                </div>
            </div>
            <div class="lx-row2">
                <div class="lx-field">
                    <label>CLEARANCE (1–5)</label>
                    <select id="rte-clr">
                        <option>1</option><option>2</option><option>3</option>
                        <option>4</option><option>5</option>
                    </select>
                </div>
                <div class="lx-field">
                    <label>LOOP MODE</label>
                    <select id="rte-loop">
                        <option value="pingpong">Ping-pong</option>
                        <option value="circuit">Circuit</option>
                        <option value="once">One-way</option>
                    </select>
                </div>
            </div>
            <div class="lx-field" style="display:flex;align-items:center;gap:8px">
                <input id="rte-path" type="checkbox" checked style="width:auto">
                <label for="rte-path" style="margin:0;font-size:10px;letter-spacing:1px">SHOW ROUTE PATH LINE</label>
            </div>
            <div class="lx-div"></div>
            <div style="font-size:9px;opacity:0.5;letter-spacing:1px;margin-bottom:6px">WAYPOINTS — add 2 or more</div>
            <div class="lx-wps-label"><span></span><span>LAT</span><span>LNG</span><span>DWELL min</span><span>LABEL</span><span></span></div>
            <div id="lx-wps"></div>
            <button class="lx-add-wp-btn" id="lx-add-wp">+ ADD STOP</button>
            <div class="lx-note" style="margin-top:8px">DWELL = real-world minutes parked at this stop before departing</div>
            <div class="lx-msg" id="rte-msg"></div>
            <button class="lx-submit" id="rte-submit">⊕ ADD ROUTE</button>
        </div>

        <!-- ── MANAGE TAB ── -->
        <div class="lx-tc hidden" id="lx-tc-mgr">
            <div class="lx-note">Custom entries only. Built-in data must be edited in AssetMap.js.</div>
            <div id="lx-mgr-list"></div>
            <button class="lx-export" id="lx-export">⬇ EXPORT CUSTOM JSON TO CLIPBOARD</button>
        </div>

        <!-- ── REDACT TAB ── -->
        <div class="lx-tc hidden" id="lx-tc-rdt">
            <div class="lx-note">Toggle NAME REDACTED per node. Redacted nodes stay on the map — players see ████ instead of the real name. Uncheck to reveal (e.g. after a successful hack).</div>
            <div id="lx-rdt-list"></div>
        </div>

        </div><!-- end tab-body -->
    </div>`;
    document.body.appendChild(wrap);

    // ---- Tab switching ----
    const panel = document.getElementById('lx-add-panel');
    const tabs  = ['dep','rte','mgr','rdt'];

    document.querySelectorAll('.lx-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.lx-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
            tabs.forEach(t => document.getElementById(`lx-tc-${t}`).classList.toggle('hidden', t !== tab));
            if (tab === 'mgr') renderManageTab();
            if (tab === 'rte') renderWpRows();
            if (tab === 'rdt') renderRedactTab();
        });
    });

    // ---- Redact tab renderer ----
    function renderRedactTab() {
        const c = document.getElementById('lx-rdt-list');
        if (!c) return;
        const redacted = getRedactedMap();
        c.innerHTML = '';
        DEPLOYMENTS.forEach(d => {
            const isRed = !!redacted[d.id];
            const row   = document.createElement('div');
            row.className = 'lx-rdt-row';
            const info  = document.createElement('div');
            info.innerHTML = `<div class="lx-mgr-name">${d.name}</div><div class="lx-mgr-sub">${d.id} · CLR ${d.clearance}</div>`;
            const label = document.createElement('label');
            label.className = 'lx-rdt-chk-wrap' + (isRed ? ' is-redacted' : '');
            const chk   = document.createElement('input');
            chk.type = 'checkbox'; chk.className = 'lx-rdt-chk';
            chk.checked = isRed;
            chk.addEventListener('change', () => {
                setNodeRedacted(d.id, chk.checked);
                label.classList.toggle('is-redacted', chk.checked);
                updateDeployVisibility();
            });
            const lbl = document.createElement('span');
            lbl.className = 'lx-rdt-lbl';
            lbl.textContent = 'REDACTED';
            label.appendChild(chk); label.appendChild(lbl);
            row.appendChild(info); row.appendChild(label);
            c.appendChild(row);
        });
    }

    // ---- Toggle open/close ----
    document.getElementById('lx-add-btn').addEventListener('click', () => {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            // Init default waypoints on first open
            if (_wps.length === 0) {
                _wps = [
                    { lat:'', lng:'', dwell:'0', label:'' },
                    { lat:'', lng:'', dwell:'0', label:'' }
                ];
            }
            renderWpRows();
        }
    });
    document.getElementById('lx-close').addEventListener('click', () => panel.classList.add('hidden'));

    // ---- Deployment: pick from map ----
    document.getElementById('dep-pick').addEventListener('click', function() {
        activatePick(document.getElementById('dep-lat'), document.getElementById('dep-lng'), this);
    });

    // ---- Add waypoint ----
    document.getElementById('lx-add-wp').addEventListener('click', () => {
        _wps.push({ lat:'', lng:'', dwell:'0', label:'' });
        renderWpRows();
    });

    // ---- Submit deployment ----
    document.getElementById('dep-submit').addEventListener('click', () => {
        const msg   = document.getElementById('dep-msg');
        const name  = document.getElementById('dep-name').value.trim();
        const lat   = parseFloat(document.getElementById('dep-lat').value);
        const lng   = parseFloat(document.getElementById('dep-lng').value);
        const type  = document.getElementById('dep-type').value;
        const status= document.getElementById('dep-status').value;
        const clr   = +document.getElementById('dep-clr').value;
        const notes = document.getElementById('dep-notes').value.trim();

        if (!name)              return showMsg(msg, 'NAME is required.', false);
        if (isNaN(lat) || isNaN(lng)) return showMsg(msg, 'Valid LAT and LNG are required.', false);

        const d = {
            id: 'custom-dep-' + Date.now(),
            name, lat, lng, type, status,
            clearance: clr,
            notes: notes || undefined,
            _custom: true
        };

        DEPLOYMENTS.push(d);
        persistDep(d);
        buildDeployments();
        showMsg(msg, `✓ ${name} added to map.`, true);

        // Reset form
        ['dep-name','dep-lat','dep-lng','dep-notes'].forEach(id => document.getElementById(id).value = '');
    });

    // ---- Submit route ----
    document.getElementById('rte-submit').addEventListener('click', () => {
        const msg  = document.getElementById('rte-msg');
        const name = document.getElementById('rte-name').value.trim();
        const type = document.getElementById('rte-type').value;
        const speed= parseFloat(document.getElementById('rte-speed').value);
        const clr  = +document.getElementById('rte-clr').value;
        const loop = document.getElementById('rte-loop').value;
        const showPath = document.getElementById('rte-path').checked;

        if (!name)     return showMsg(msg, 'CALLSIGN is required.', false);
        if (isNaN(speed) || speed <= 0) return showMsg(msg, 'Valid SPEED is required.', false);

        // Collect waypoints from current state
        const waypoints = _wps
            .map(w => ({
                pos: [parseFloat(w.lat), parseFloat(w.lng)],
                dwellMinutes: parseFloat(w.dwell) || 0,
                label: w.label.trim() || undefined
            }))
            .filter(w => !isNaN(w.pos[0]) && !isNaN(w.pos[1]));

        if (waypoints.length < 2) return showMsg(msg, 'Need at least 2 valid waypoints.', false);

        const r = {
            id: 'custom-rte-' + Date.now(),
            name, type, waypoints,
            clearance: clr,
            speedKmh: speed,
            loop,
            showPath,
            _custom: true
        };

        ROUTES.push(r);
        persistRte(r);
        vehicles.push(new Vehicle(r));
        showMsg(msg, `✓ ${name} now active on map.`, true);

        // Reset form
        document.getElementById('rte-name').value = '';
        document.getElementById('rte-speed').value = '';
        _wps = [
            { lat:'', lng:'', dwell:'0', label:'' },
            { lat:'', lng:'', dwell:'0', label:'' }
        ];
        renderWpRows();
    });

    // ---- Settings button ----
    const setPanel = document.getElementById('lx-set-panel');
    document.getElementById('lx-set-btn').addEventListener('click', () => {
        setPanel.classList.toggle('hidden');
        if (!setPanel.classList.contains('hidden')) {
            document.getElementById('lx-ts-inp').value = TIME_SCALE;
        }
        // Close add panel if open
        panel.classList.add('hidden');
    });
    document.getElementById('lx-ts-apply').addEventListener('click', () => {
        const v = parseFloat(document.getElementById('lx-ts-inp').value);
        if (isNaN(v) || v <= 0) return;
        setTimeScale(v);
        setPanel.classList.add('hidden');
    });

    // ---- Export ----
    document.getElementById('lx-export').addEventListener('click', () => {
        const data = {
            DEPLOYMENTS: getStoredDeps(),
            ROUTES: getStoredRtes()
        };
        const text = JSON.stringify(data, null, 2);
        navigator.clipboard.writeText(text).then(() => {
            document.getElementById('lx-export').textContent = '✓ COPIED TO CLIPBOARD';
            setTimeout(() => { document.getElementById('lx-export').textContent = '⬇ EXPORT CUSTOM JSON TO CLIPBOARD'; }, 2500);
        });
    });
}

// ================================================================
//  BOOT
// ================================================================

loadCustomFromStorage();
buildDeployments();
buildVehicles();
setClearance(PLAYER_CLEARANCE);
requestAnimationFrame(animLoop);
setTimeout(() => document.getElementById('map').classList.add('pulses-done'), 5000);
if (window.LuxorAuth && LuxorAuth.isAdmin()) injectAddUI();