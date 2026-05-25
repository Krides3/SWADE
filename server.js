/**
 * LUXOR Sync Server
 * ------------------
 * Serves all game files AND provides a real-time sync API so the Evidence
 * Board (and any other shared state) stays in sync across different browsers
 * and machines on the same local network.
 *
 * SETUP:
 *   1. npm install   (installs express)
 *   2. node server.js
 *   3. Open http://localhost:3000 in all browsers / on all machines
 *      (use the machine's LAN IP, e.g. http://192.168.1.x:3000, for other devices)
 *
 * The server stores evidence state in evidence-sync.json next to this file.
 * It also forwards changes to all connected SSE clients for instant updates.
 */

'use strict';

const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const app      = express();

const PORT      = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'evidence-sync.json');

// ── In-memory store ────────────────────────────────────────────────────────
let store = loadStore();

function loadStore() {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
    catch { return { cfg: null, state: null, version: 0, ts: 0 }; }
}

function persistStore() {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2)); }
    catch (e) { console.error('Could not write evidence-sync.json:', e.message); }
}

// ── SSE clients for instant push ───────────────────────────────────────────
const clients = new Set();

function broadcast(data) {
    const payload = 'data: ' + JSON.stringify(data) + '\n\n';
    clients.forEach(res => { try { res.write(payload); } catch {} });
}

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));        // serve all game files

// ── API: health ping ───────────────────────────────────────────────────────
app.get('/api/ping', (req, res) => {
    res.json({ ok: true, version: store.version });
});

// ── API: GET full store ────────────────────────────────────────────────────
app.get('/api/evidence', (req, res) => {
    res.json({ ok: true, version: store.version, ts: store.ts, cfg: store.cfg, state: store.state });
});

// ── API: POST update a key ─────────────────────────────────────────────────
app.post('/api/evidence', (req, res) => {
    const { key, value } = req.body || {};
    if (key !== 'cfg' && key !== 'state') {
        return res.status(400).json({ ok: false, error: 'key must be cfg or state' });
    }
    store[key]     = value;
    store.version  = (store.version || 0) + 1;
    store.ts       = Date.now();
    persistStore();
    broadcast({ key, version: store.version, ts: store.ts });
    res.json({ ok: true, version: store.version });
});

// ── API: SSE stream for instant updates ───────────────────────────────────
app.get('/api/evidence/stream', (req, res) => {
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Send current version so client can detect stale state on connect
    res.write('data: ' + JSON.stringify({ type: 'hello', version: store.version }) + '\n\n');

    clients.add(res);
    req.on('close', () => clients.delete(res));
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    const ifaces = require('os').networkInterfaces();
    const ips    = Object.values(ifaces).flat()
        .filter(i => i.family === 'IPv4' && !i.internal)
        .map(i => i.address);

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║   LUXOR Sync Server — ONLINE                 ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Local:   http://localhost:${PORT}               ║`);
    ips.forEach(ip => {
        const padded = `http://${ip}:${PORT}`.padEnd(44);
        console.log(`║  Network: ${padded}║`);
    });
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║  Open the NETWORK address on other machines  ║');
    console.log('║  All players use the same URL — no setup     ║');
    console.log('╚══════════════════════════════════════════════╝\n');
});
