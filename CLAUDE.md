# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Local dev**: `npm run dev` (runs `wrangler dev`, serves at http://localhost:8787)
- **Deploy**: `npm run deploy` (runs `wrangler deploy` to Cloudflare Workers)

## Architecture

Single-page vanilla HTML/CSS/JS app with a Cloudflare Workers backend. No build step, no frameworks.

**Backend** (`src/worker.js`): Cloudflare Worker that proxies MTA GTFS-RT feed requests. The `/api?feed=<url>` endpoint validates the feed URL against an allowlist and returns protobuf binary data with 15-second cache headers. Static files from `public/` are served automatically via Wrangler's asset handling.

**Frontend** (`public/`): Vanilla JS app that decodes MTA GTFS-RT protobuf feeds client-side using protobuf.js (loaded from CDN). Trains are parsed from `StopTimeUpdate` entities, grouped by route, and displayed with MTA line colors.

**Key data model**: Stations are configured in `STATIONS` object in `app.js`. Each station has stop IDs (format: `{station}{direction}`, e.g. `D24N` = stop D24, northbound), associated GTFS feed keys, and a DOM container ID. The `mergeWith` property combines arrivals from multiple stations into one view (used for Times Sq + Bryant Park).

**Tab navigation**: The app uses a tab-based UI. Only the active station's feeds are fetched. The "+" tab shows a station picker list. Auto-refresh runs every 30 seconds for the active tab.
