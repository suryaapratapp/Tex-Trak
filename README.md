# Tex-Trak — through-life product & material intelligence

QR → RFID → GNSS data-fusion platform (STELLAR-HEALTH demonstrator, TRL 5 → 7). Tracks reusable healthcare textiles
and high-value assets from point of use, through decontamination, to recycling — with auditable provenance and
CSRD-ready ISO 14040 LCA metrics.

## Two use cases
1. **Reusable textiles (RFID + GPS)** — doorway RFID readers, QR scans on use, TAT240 GPS on trucks; hospital ⇄ Decon Plant, recycling proof.
2. **Curtain installations (QR) — Synergy** — curtains delivered, installed and taken down by QR scan (*Installations* tab): scan modes **Install** (incoming to ward), **Take down** (outgoing), **Dispatch** and **Receive** at the Synergy facility; floor/ward/bay map, per-curtain history, printable QR labels, van runs on the live map. Camera scanning uses the browser camera (HTTPS or localhost); demo scan buttons work everywhere. State is stored in the browser for the demo.

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
   Periodic record interval: **360 s (6 min)** — the Teltonika minimum for periodic recording on this battery-powered tracker. Faster GNSS reporting drains the battery; do not default to 30 s.
4. First fix appears live on the Fleet Map and the top-bar pill (Supabase Realtime).

> TAT240 I/O element IDs (battery, signal) differ from FMB-series — verify against the Teltonika wiki and adjust the mapping in the edge function.

## Deploy the dashboard on Vercel
`vercel.json` (repo root) publishes the `app/` service. Import the repo in Vercel (or `vercel` / `vercel dev`) — no env vars required
(the Supabase URL + publishable key default in code; override with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
The TAT240 **gateway is not on Vercel**: it needs a raw TCP socket, which Vercel Functions can't accept. Host it with `gateway/Dockerfile` / `gateway/fly.toml`.

## Testing the tracker pipeline without the device
```bash
cd gateway && npm test                                  # simulated TAT240 -> gateway -> mock ingest
npm run simulate -- <gateway-host> 5027 862129084785066 20   # drive the real pipeline; Devices page checklist turns green
```
Instructions for whoever holds the physical device: [`docs/TOM_SETUP.md`](docs/TOM_SETUP.md).

## Notes / roadmap
- The demo world is simulated deterministically on the client so every scenario is repeatable; live hardware overlays on top of it.
- RLS currently allows anonymous **read** for demo dashboards; all writes go through the service-role edge function. Add Supabase Auth + per-organisation policies before production.
- Map tiles default to OpenStreetMap; set `VITE_TILE_URL` for a commercial provider.
- Next: persist simulated events to Postgres, mobile QR-scan PWA, RFID reader webhooks, multi-tenant orgs, ML ETA/loss models, EU digital product passport export.


## Accounts and roles

The demo has three accounts, switched from the bottom of the sidebar:

| Account | Sees |
|---|---|
| **Synergy** | Laundry arrivals, inventory, curtain installations, shipments, recycling proof, facilities |
| **Client A** | Community assets, shipments, recycling proof |
| **Super Admin** | Everything, plus the admin console: clients, every site, every RFID reader, UK map, trackers |

Site, client and reader data lives in `app/src/sim/registry.ts`; the UK network (hospitals, decon plants, recyclers, ports, incinerators) is defined there.

## The four use cases

1. **Laundry arrivals** – what is reaching the hospital and the plant, when it can be used, and which departments are short.
2. **Community assets** – portable scanners on loan, geofences, battery and silence alerts.
3. **Shipments** – live ETA and tracking history for any consignment.
4. **Recycling proof** – declared destination versus the geofence the truck is really in; printable evidence certificate.

Field staff use **Scan station**; everyone else works from the dashboards.
