# LamaTrak — Ranger Patrol Management PWA

LamaTrak is an offline-first Progressive Web App (PWA) for Indigenous rangers on Cape York, managing patrols across ~300,000 hectares across 4 base stations: Port Stewart, Silver Plains, Lilyvale, and Marina Plains.

## Setup

- Node.js 18+ required
- Run `npm install` to install dependencies
- Start server: `npm start` (runs on port 3000, override with `PORT` env var)
- Database file `lamatrak.db` is auto-created on first start (excluded from git)
- `uploads/` directory is created at runtime for photo storage

## Architecture

**Single-page app — no framework, no build step.** All frontend files are served as-is from `public/`.

```
public/
  index.html   — Full SPA markup (all screens in one HTML file)
  app.js       — All frontend logic (App, Nav, Patrol, GPS, Safety, RecordForm objects)
  db.js        — IndexedDB wrapper (5 stores, matches server schema)
  sync.js      — Background sync engine (30s auto-sync when online)
  sw.js        — Service Worker for offline caching
  styles.css   — All styles (no preprocessor, no framework)
server.js      — Express backend, SQLite via sql.js, REST API
```

**No bundler, no TypeScript, no test framework.** JavaScript is plain ES5/ES6 with `var`-based module pattern (e.g. `var App = {...}`, `var Nav = {...}`).

## Frontend Code Style

- Use `var` for module-level objects, consistent with existing pattern
- All major features are namespaced as objects: `App`, `Nav`, `Patrol`, `GPS`, `Safety`, `RecordForm`, `LocalDB`, `SyncEngine`
- DOM manipulation via vanilla JS (`document.getElementById`, `querySelector`)
- No imports/exports — all scripts loaded globally via `<script>` tags in `index.html`
- Screen switching via `Nav.go('screen-name')` which hides/shows `<div id="screen-*">` elements
- Animations use CSS classes toggled via JS (not inline styles)

## Backend Code Style

- Express.js with REST conventions
- All routes defined in `server.js` (no router files)
- SQLite accessed via `sql.js` (WASM-based, not `better-sqlite3`)
- Database saved to disk manually: call `saveDB()` after every write operation
- JSON body parsing via `express.json()`
- File uploads via `multer` to `uploads/` directory

## Data Storage

**Dual-layer offline-first pattern:**

1. All data written to **IndexedDB immediately** (client-side, `db.js`)
2. Background sync pushes unsynced records to server via `POST /api/sync`
3. Records have a `synced` flag (0 = pending, 1 = uploaded)
4. Conflict resolution: newer `updated_at` timestamp wins

**IndexedDB stores** (mirrored on server as SQLite tables):
- `patrols` — patrol sessions with start/end time, type, location
- `patrol_tracks` — GPS breadcrumb points
- `observations` — sightings/recordings (5 types, data stored as JSON)
- `checkins` — safety checkins (status: ok | help | sos | missed)
- `users` — cached ranger profiles

## Observation Types

Five types, each with its own form fields:
- **Weed** — species (369 from Weed Action Plan), density, spread radius, GPS, photo
- **Feral Animal** — species (pig/cattle/dog/cane toad), count, behaviour, location
- **Marine** — species (dolphin/dugong/turtle), activity, count, TUMRA permit status
- **Water Quality** — pH, turbidity, temperature, dissolved oxygen, visual assessment
- **Cultural Site** — condition, access status, restricted data flag (Elder-only)

## Role-Based Access

Three roles with different permissions:
- **Ranger** — patrol recording, observations, safety check-ins
- **Senior Ranger** — all ranger permissions + report access
- **Elder** — read-only governance portal, sees culturally restricted site data

Session stored in `localStorage` keys `lamatrak_user` and `lamatrak_site`.

## API Conventions

All endpoints under `/api/`. Standard patterns:
- `GET /api/resource?param=value` for queries
- `POST /api/resource` for creation
- `PUT /api/resource/:id` for updates
- `POST /api/sync` accepts bulk unsynced data from client
- `POST /api/upload` for photo multipart upload (returns filename)
- Report endpoints: `GET /api/reports/niaa` (NIAA format)

## Key Behaviours to Preserve

- **Offline-first:** Every user action must save to IndexedDB first, then sync. Never block UI on network.
- **GPS tracking:** Active patrols continuously watch position via `GPS.startTracking()` every 10–15s.
- **Safety timers:** 90-min auto check-in timer resets on each `Safety.checkIn()` call. Missed check-in auto-logs.
- **Photo capture:** Observations support photo via `<input type="file" accept="image/*" capture="environment">`. Photos stored as base64 locally, uploaded to server on sync.
- **Simulated environmental data:** `App.simUV()`, `App.simTemp()`, `App.simWind()` simulate hazard readings — replace with real API integration when available.

## Screens

| Screen ID | Purpose |
|---|---|
| `screen-login` | User + base station selection |
| `screen-dashboard` | Overview, patrol start, coverage stats, safety radar |
| `screen-map` | Live patrol map (Leaflet.js — next build) |
| `screen-record` | 5-type observation recorder |
| `screen-safety` | Check-in, SOS, hydration reminders (next build) |
| `screen-more` | Settings, sync status, logout |

## What's Incomplete (Next Build)

- Full patrol map with Leaflet.js, GPS breadcrumbs, coverage heatmap, gap detection
- Safety Centre details (interval selector, full check-in flow)
- Report generator UI (NIAA, GBRMPA, QPWS PDF export)
- Analytics screen (coverage heatmap, trend charts)
- Elder Portal screen (cultural site time-lapse, restricted data view)
- PIN-based authentication (currently no validation on login)
- Role-gated data visibility for restricted cultural sites
- Real weather/UV API integration
