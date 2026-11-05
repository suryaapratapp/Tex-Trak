# Tex-Trak — through-life product & material intelligence

QR → RFID → GNSS data-fusion platform (STELLAR-HEALTH demonstrator, TRL 5 → 7). Tracks reusable healthcare textiles
and high-value assets from point of use, through decontamination, to recycling — with auditable provenance and
CSRD-ready ISO 14040 LCA metrics.

## What's in the box
| Area | Where |
|---|---|
| Web app (React + Vite + Tailwind + Leaflet) | `app/` |
| Simulation + rule/prediction engine (deterministic, scrubbable) | `app/src/sim`, `app/src/lib/insights.ts` |
| Teltonika **TAT240** TCP gateway (Codec 8/8E, CRC-checked) | `gateway/` |
| Supabase edge function `ingest-tracker` | `supabase/functions/ingest-tracker` |
| Database schema, RLS, hash-chained custody ledger | Supabase project `qhxdqgkpebmpzzuzqcla` (migrations `textrak_core_schema`, `textrak_seed_reference_data`) |

## Run the app
```bash
cd app && npm install && npm run dev      # http://localhost:5173
```
Use the clock at the top: play/pause, scrub, change speed, or **Jump to scenario** (morning delivery, diverted recycling run,
scanner leaving site, evening collection, decon processing…).

## Views
- **Command Centre** — KPIs, live map, intelligence recommendations, alert + event stream
- **Live Fleet Map** — TAT240-tracked vehicles on real roads, ETA vs plan, telemetry, inherited item visibility, "follow into the building"
- **Facility Digital Twin** — hospital & decon-plant floor plans with ceiling RFID readers at every entrance/exit and the dirty-cage bay
- **Lifecycle Flow** — clean delivery → departments → dirty cages → collection → decon → back; per-item passport, fusion confidence, hash-linked custody
- **Laundry Planner** — arrival board, capacity vs arrivals, crew recommendation
- **Shipments** — Amazon-style tracking for laundry, recycling, courier and parcels
- **High-value Assets** — community scanners, geofences, battery, loan state
- **Provenance & Custody** — did the recycling truck really reach the recycler? Verified vs broken chain
- **Alerts & Incidents** — 12-rule engine, risk scores, evidence, incident case files
- **Sustainability · CSRD** — LCA metrics, verified-recycled vs withheld, CSV/JSON export

## Connecting the physical TAT240 (IMEI 862129084785066, S/N 1159593094)
1. Set the edge-function secret (once): `supabase secrets set INGEST_TOKEN=<long-random> --project-ref qhxdqgkpebmpzzuzqcla`
2. Run the gateway on a host with a public IP / open TCP port:
   ```bash
   cd gateway && npm test
   INGEST_URL=https://qhxdqgkpebmpzzuzqcla.supabase.co/functions/v1/ingest-tracker INGEST_TOKEN=<same> npm start
   ```
3. Teltonika Configurator → System/GPRS: server = gateway host, port 5027, TCP, **Codec 8 Extended**; APN for your SIM.
   Moving period ≈ 30 s, stationary ≈ 60 min.
4. First fix appears live on the Fleet Map and the top-bar pill (Supabase Realtime).

> TAT240 I/O element IDs (battery, signal) differ from FMB-series — verify against the Teltonika wiki and adjust the mapping in the edge function.

## Notes / roadmap
- The demo world is simulated deterministically on the client so every scenario is repeatable; live hardware overlays on top of it.
- RLS currently allows anonymous **read** for demo dashboards; all writes go through the service-role edge function. Add Supabase Auth + per-organisation policies before production.
- Map tiles default to OpenStreetMap; set `VITE_TILE_URL` for a commercial provider.
- Next: persist simulated events to Postgres, mobile QR-scan PWA, RFID reader webhooks, multi-tenant orgs, ML ETA/loss models, EU digital product passport export.
