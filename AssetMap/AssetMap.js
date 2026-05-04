// ================================================================
//  LUXOR ASSET MAP  —  GM CONFIGURATION
//  Edit DEPLOYMENTS and ROUTES below to update the map.
//  No other changes needed.
// ================================================================

// Default player clearance shown on load (1–5).
// Players can also change it via the UI buttons.
let PLAYER_CLEARANCE = 1;

// Animation speed multiplier.
// 300 = vehicles move 300x faster than real life.
// Raise this number to make vehicles cross the map faster.
const TIME_SCALE = 300;

// ----------------------------------------------------------------
//  DEPLOYMENTS
//  Add objects to this array to place a ping on the map.
//
//  Fields:
//    id        — unique string, used internally
//    name      — shown on hover if clearance is met; else REDACTED
//    lat/lng   — GPS coordinates (decimal degrees)
//    clearance — 1-5: minimum level needed to see name & notes
//    type      — 'hq' | 'ground' | 'outpost' | 'naval'
//    status    — 'active' | 'inactive' | 'compromised' | 'unknown'
//    notes     — optional detail shown on hover (clearance-gated)
// ----------------------------------------------------------------
const DEPLOYMENTS = [
    {
        id: 'luxor-hq',
        name: 'LUXOR HQ',
        lat: 46.946876, lng: 7.448668,
        clearance: 1,
        type: 'hq',
        status: 'active',
        notes: 'Primary command. Secure comms only.'
    },
    {
        id: 'alpha-1',
        name: 'Team Alpha',
        lat: 51.5074, lng: -0.1278,       // London
        clearance: 2,
        type: 'ground',
        status: 'active',
        notes: 'Surveillance op. Check-in every 6 hrs.'
    },
    {
        id: 'bravo-1',
        name: 'Team Bravo',
        lat: 40.7128, lng: -74.0060,      // New York
        clearance: 3,
        type: 'ground',
        status: 'active',
        notes: 'Asset extraction in progress.'
    },
    {
        id: 'outpost-kestrel',
        name: 'Outpost Kestrel',
        lat: 35.6762, lng: 139.6503,      // Tokyo
        clearance: 4,
        type: 'outpost',
        status: 'unknown',
        notes: 'Signal lost 48 hrs ago. Priority investigate.'
    },
    {
        id: 'sigma-naval',
        name: 'Maritime Unit Sigma',
        lat: 36.8969, lng: 10.1873,       // Tunis
        clearance: 5,
        type: 'naval',
        status: 'active',
        notes: 'Covert maritime interdiction. Eyes only.'
    },
    {
        id: 'delta-standby',
        name: 'Team Delta',
        lat: -33.8688, lng: 151.2093,     // Sydney
        clearance: 2,
        type: 'ground',
        status: 'inactive',
        notes: 'Standby. Awaiting activation orders.'
    },
    {
        id: 'echo-station',
        name: 'Echo Station',
        lat: 55.7558, lng: 37.6173,       // Moscow
        clearance: 4,
        type: 'outpost',
        status: 'compromised',
        notes: 'COMPROMISED. Do not transmit to this node.'
    }
];

// ----------------------------------------------------------------
//  ROUTES
//  Add objects here to animate a vehicle between two points.
//
//  Fields:
//    id        — unique string
//    name      — callsign shown on hover (clearance-gated)
//    type      — 'helicopter' | 'plane'
//    from      — [lat, lng] departure point
//    to        — [lat, lng] destination point
//    clearance — 1-5
//    speedKmh  — real-world speed (helicopter ~240-300, plane ~800-900)
//    loop      — true = back-and-forth continuously; false = one-way
//    showPath  — true = draw animated dashed route line on the map
// ----------------------------------------------------------------
const ROUTES = [
    {
        id: 'kingfisher-1',
        name: 'KINGFISHER-1',
        type: 'helicopter',
        from: [48.8566,  2.3522],          // Paris -> London
        to:   [51.5074, -0.1278],
        clearance: 2,
        speedKmh: 60,
        loop: true,
        showPath: true
    },
    {
        id: 'condor-7',
        name: 'CONDOR-7',
        type: 'plane',
        from: [48.8566,   2.3522],         // Paris -> New York
        to:   [40.7128, -74.0060],
        clearance: 1,
        speedKmh: 870,
        loop: true,
        showPath: true
    },
    {
        id: 'osprey-run',
        name: 'OSPREY Supply',
        type: 'helicopter',
        from: [36.8969, 10.1873],          // Tunis -> Paris
        to:   [48.8566,  2.3522],
        clearance: 3,
        speedKmh: 240,
        loop: true,
        showPath: false
    }
];

// ================================================================
//  IMPLEMENTATION — no editing needed below this line
// ================================================================

// maxBounds + maxBoundsViscosity stops the map from scrolling into
// repeated world copies. noWrap on the tile layer prevents ghost tiles.
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
    const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
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

function lerp(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// ---- SVG icon HTML ----

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

// ---- Leaflet icon factories ----

function makeDeployIcon(d) {
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

// bearing is baked into the icon HTML so the correct orientation is
// shown from frame 1, and survives any Leaflet DOM rebuild (e.g. on
// direction reversal when setIcon is called).
function makeVehicleIcon(type, bearing) {
    const svg  = type === 'helicopter' ? heliSVG() : planeSVG();
    const size = type === 'helicopter' ? [28, 42] : [34, 34];
    return L.divIcon({
        html: `<div class="veh-wrap" style="transform:rotate(${bearing}deg)">${svg}</div>`,
        className: '',
        iconSize:   size,
        iconAnchor: [size[0] / 2, size[1] / 2],
        tooltipAnchor: [size[0] / 2 + 4, 0]
    });
}

// ---- Tooltip content builders ----

function deployTT(d) {
    const ok = PLAYER_CLEARANCE >= d.clearance;
    const sc = { active:'#00ffe7', inactive:'#666', compromised:'#ff3333', unknown:'#ff9900' }[d.status];
    return `<div>
    <div class="${ok ? 'tt-name' : 'tt-redact'}">${ok ? d.name : '████ REDACTED ████'}</div>
    <div class="tt-row">TYPE: <b>${d.type.toUpperCase()}</b></div>
    <div class="tt-row">STATUS: <b style="color:${sc}">${d.status.toUpperCase()}</b></div>
    ${ok && d.notes ? `<div class="tt-notes">${d.notes}</div>` : ''}
    <div class="tt-clr">CLR REQUIRED: ${d.clearance}</div>
  </div>`;
}

function vehicleTT(route, forward) {
    const ok  = PLAYER_CLEARANCE >= route.clearance;
    const dir = forward ? '→' : '←';
    const type = route.type === 'helicopter' ? 'HELICOPTER' : 'AIRCRAFT';
    return `<div>
    <div class="${ok ? 'tt-name' : 'tt-redact'}">${dir} ${ok ? route.name : '████ REDACTED'}</div>
    <div class="tt-row">TYPE: <b>${type}</b></div>
    <div class="tt-row">SPEED: <b>${ok ? route.speedKmh + ' km/h' : '—'}</b></div>
    <div class="tt-clr">CLR REQUIRED: ${route.clearance}</div>
  </div>`;
}

// ---- Build deployment markers ----

const deployMarkers = {};

function buildDeployments() {
    Object.values(deployMarkers).forEach(m => m.remove());
    DEPLOYMENTS.forEach(d => {
        const m = L.marker([d.lat, d.lng], { icon: makeDeployIcon(d) })
            .bindTooltip(deployTT(d), { className: 'lx-tt', direction: 'top', offset: [0, -4] })
            .addTo(map);
        deployMarkers[d.id] = m;
    });
}

// ---- Vehicle animation class ----

const vehicles = [];

class Vehicle {
    constructor(route) {
        this.route    = route;
        this.forward  = true;
        this.progress = Math.random(); // stagger start positions
        this.lastTs   = null;
        this.done     = false;

        const distKm       = haversineKm(route.from, route.to);
        const realMs       = (distKm / route.speedKmh) * 3600000;
        this.progressPerMs = TIME_SCALE / realMs;

        if (route.showPath) {
            this.pathLine = L.polyline([route.from, route.to], {
                color: '#00ffe7',
                weight: 1,
                opacity: 0.18,
                className: 'lx-route'
            }).addTo(map);
        }

        // Calculate the correct bearing from the start so the icon is
        // oriented properly on frame 1, before tick() ever runs.
        const initBearing = bearingDeg(route.from, route.to);
        const initPos     = lerp(route.from, route.to, this.progress);

        this.marker = L.marker(initPos, { icon: makeVehicleIcon(route.type, initBearing), zIndexOffset: 500 })
            .bindTooltip(vehicleTT(route, this.forward), { className: 'lx-tt', direction: 'top', offset: [0, -4] })
            .addTo(map);
    }

    tick(ts) {
        if (this.done) return;
        if (this.lastTs === null) { this.lastTs = ts; return; }

        const dt = ts - this.lastTs;
        this.lastTs = ts;

        const prevForward = this.forward;
        this.progress += this.progressPerMs * dt * (this.forward ? 1 : -1);

        if (this.progress >= 1) {
            if (this.route.loop) { this.forward = false; this.progress = 1; }
            else { this.progress = 1; this.done = true; }
        } else if (this.progress <= 0) {
            this.forward  = true;
            this.progress = 0;
        }

        const from = this.forward ? this.route.from : this.route.to;
        const to   = this.forward ? this.route.to   : this.route.from;
        const pos  = lerp(this.route.from, this.route.to, this.progress);
        const brng = bearingDeg(from, to);

        this.marker.setLatLng(pos);

        if (this.forward !== prevForward) {
            // Rebuild the icon with the new bearing baked in so it survives
            // any future DOM recreation by Leaflet.
            this.marker.setIcon(makeVehicleIcon(this.route.type, brng));
            this.marker.setTooltipContent(vehicleTT(this.route, this.forward));
        } else {
            // Fast path: poke the DOM directly without a full icon rebuild.
            const el = this.marker.getElement();
            if (el) {
                const wrap = el.querySelector('.veh-wrap');
                if (wrap) wrap.style.transform = `rotate(${brng}deg)`;
            }
        }
    }

    refreshTooltip() {
        this.marker.setTooltipContent(vehicleTT(this.route, this.forward));
    }
}

function buildVehicles() {
    ROUTES.forEach(r => vehicles.push(new Vehicle(r)));
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
    DEPLOYMENTS.forEach(d => {
        if (deployMarkers[d.id]) deployMarkers[d.id].setTooltipContent(deployTT(d));
    });
    vehicles.forEach(v => v.refreshTooltip());
}

document.querySelectorAll('.cl-btn').forEach(b =>
    b.addEventListener('click', () => setClearance(+b.dataset.level))
);

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

// ---- Boot ----
buildDeployments();
buildVehicles();
requestAnimationFrame(animLoop);