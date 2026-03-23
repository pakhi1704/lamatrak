> **IMPORTANT:** After making any code change, adding a feature, fixing a bug, or changing architecture — you MUST update this file to reflect the new state before ending your response. Use `/sync-claude-md` if you need a structured prompt to guide the update.

# LamaTrak — Ranger Patrol Management PWA

Offline-first PWA for Lama Lama Indigenous rangers on Cape York, managing patrols across ~300,000 hectares from 4 base stations: Port Stewart, Silver Plains, Lilyvale, and Marina Plains.

## Setup & Commands

- `npm install` — install dependencies (express, sql.js, multer, cors)
- `npm start` — start server on port 3000 (override with `PORT` env var)
- No build step — frontend files served as-is from `public/`
- `lamatrak.db` auto-created on first start; `uploads/` created at runtime (both git-ignored)

## Architecture

Single HTML file SPA, no framework, no bundler, no TypeScript:

```
public/
  index.html    — All screen markup (6 screens in one file)
  app.js        — All frontend logic (App, Nav, Patrol, GPS, PatrolMap, Safety, RecordForm)
  db.js         — IndexedDB wrapper (5 stores)
  sync.js       — Background sync engine + Toast notifications
  sw.js         — Service Worker (stale-while-revalidate for app shell, network-only for /api/*)
  styles.css    — All styles
  manifest.json — PWA manifest
server.js       — Express + SQL.js (WASM SQLite) + REST API
```

## Frontend Code Style

- Module-level globals use `var` (e.g. `var App = {...}`) — do not convert to `const`/`class`
- All features namespaced as objects: `App`, `Nav`, `Patrol`, `GPS`, `PatrolMap`, `Safety`, `RecordForm`, `LocalDB`, `SyncEngine`, `Toast`
- No imports/exports — all scripts loaded globally via `<script>` tags
- Screen switching: `Nav.go('screen-name')` hides/shows `<div id="screen-*">` elements
- DOM manipulation via vanilla JS only (`getElementById`, `querySelector`)
- Animations: toggle CSS classes, not inline styles

## Backend Code Style

- All routes in `server.js` — no router files
- SQL.js is WASM-based SQLite — NOT `better-sqlite3`. Syntax differs.
- **CRITICAL:** Call `saveDB()` after every write operation to persist to disk
- Multer handles photo uploads to `uploads/`

## Data Storage

Dual-layer offline-first:
1. Every write goes to **IndexedDB immediately** (never block UI on network)
2. `SyncEngine` auto-pushes unsynced records every 30s via `POST /api/sync`
3. Records have `synced` flag: `0` = pending, `1` = uploaded
4. Conflict resolution: newer `updated_at` wins

**IndexedDB stores** (mirrored as SQLite tables):
- `patrols` — sessions (type: land/sea/cultural_site, status, GPS start/end)
- `patrol_tracks` — GPS breadcrumb points (every 10–15s during active patrol)
- `observations` — sightings (5 types, `data` field is JSON, `is_restricted` for Elder-only)
- `checkins` — safety check-ins (status: ok | help | sos | missed)
- `users` — cached ranger profiles

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/users` | List rangers |
| POST | `/api/users` | Create ranger |
| GET | `/api/patrols` | Query patrols (filter: ranger_id, status) |
| POST | `/api/patrols` | Create patrol |
| PUT | `/api/patrols/:id` | Update patrol |
| POST | `/api/tracks` | Bulk insert GPS points |
| GET | `/api/tracks/:patrolId` | Get patrol trail |
| GET | `/api/observations` | Query observations (filter: patrol_id, type) |
| POST | `/api/observations` | Create observation |
| POST | `/api/upload` | Photo upload (multipart → returns `/uploads/{filename}`) |
| GET | `/api/checkins` | Query check-ins |
| POST | `/api/checkins` | Create check-in |
| POST | `/api/sync` | Bulk sync: `{patrols, observations, tracks, checkins}` |
| GET | `/api/reports/niaa` | NIAA monthly report (JSON) |
| GET | `/api/stats` | Dashboard stats |

## Screens

| Screen ID | Status |
|-----------|--------|
| `screen-login` | Done — user/site selection, no PIN validation yet |
| `screen-dashboard` | Done — safety radar (simulated), coverage, species rings, timeline, feed |
| `screen-map` | Done — Leaflet.js, trails, heatmap, gap detection, 4 base station markers |
| `screen-record` | Done — 5 observation types with full forms |
| `screen-safety` | Placeholder only ("next build") |
| `screen-more` | Done — account info, logout |

## Key Behaviours to Preserve

- **Offline-first:** Every action writes to IndexedDB first. Never await network before updating UI.
- **GPS tracking:** `GPS.startTracking(patrolId)` uses `watchPosition` during active patrols, saving points every 10–15s.
- **Safety timer:** 90-min countdown (`checkinIntervalMs = 90*60*1000`). Resets on `Safety.checkIn()`. Missed check-in auto-logs.
- **Photos:** `<input type="file" accept="image/*" capture="environment">` → stored as base64 in IndexedDB → uploaded as multipart on sync.
- **Simulated weather:** `App.simUV()`, `App.simTemp()`, `App.simWind()` are hour-based deterministic simulations — not real APIs yet.
- **Demo seed:** `App.seedDemo()` auto-populates sample data on first launch (if stores empty).
- **Session:** Stored in `localStorage` as `lamatrak_user` and `lamatrak_site`. Restored on reload via `App.init()`.

## What's Incomplete (Next Build)

- PIN authentication (login has no validation)
- Safety Centre screen (full check-in flow, interval selector)
- Report generator UI (NIAA JSON works; PDF export not built)
- Elder Portal (role-gated cultural site data — currently all roles see all data)
- Real weather/UV API (replace `App.simUV/simTemp/simWind`)
- Analytics screen (trend charts, coverage heatmap over time)

## Role System

Three roles (set at login, stored in localStorage, no server enforcement yet):
- **Ranger** — patrol, observations, safety check-ins
- **Senior Ranger** — all ranger + report access
- **Elder** — governance view; should see `is_restricted=1` observations (not enforced just yet)

Seeded users on first start: Karen Liddy (elder), Senior Ranger, Ranger 1, Ranger 2.
