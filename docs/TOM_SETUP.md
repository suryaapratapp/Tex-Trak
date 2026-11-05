# Bringing the TAT240 online (for whoever holds the device)

**Device:** Teltonika TAT240 · IMEI `862129084785066` · S/N `1159593094`
**You need:** the device, a laptop, a micro-USB data cable (or the Teltonika Configurator mobile app over Bluetooth), and a **nano-SIM with mobile data** (any carrier; roaming SIMs work). The device is battery powered — no vehicle wiring.

The project owner will send you two values: `SERVER_HOST` and `SERVER_PORT` (5027), plus the public dashboard link.

## Steps
1. Install **Teltonika Configurator** (free, from the Teltonika Telematics wiki) and connect the TAT240 by USB. Update firmware if the Configurator offers it.
2. **System / GPRS**
   - APN: from your SIM carrier (leave user/password blank unless the carrier says otherwise)
   - Server domain / IP: `SERVER_HOST`
   - Port: `SERVER_PORT`
   - Protocol: **TCP**
   - Data protocol / codec: **Codec 8 Extended** (Codec 8 also works)
3. **Data acquisition** (names vary slightly by firmware)
   - Periodic interval: **360 s (6 min)** for both moving and stationary. This is Teltonika's documented minimum periodic interval; shorter intervals (e.g. 30 s) cut battery life sharply, so do not use them as the default
   - Enable *send on movement* and keep sleep mode on (saves battery)
4. Save to device, unplug, put the SIM in (if not already) and take it **outside with open sky**. First GPS fix can take a few minutes.
5. Open the dashboard link → **Devices** page. The **Remote test checklist** ticks itself off:
   1. database reachable → 2. first message → 3. recent → 4. valid GPS fix → 5. movement → 6. battery.
6. Walk or drive for ~20 minutes (reports arrive every 6 minutes, so “movement” needs a few of them). Then message the project owner a screenshot of the checklist.

## If something stays red
| Symptom | Likely cause |
|---|---|
| Nothing arrives | Wrong host/port, SIM has no data, APN wrong, or the gateway is not running |
| Arrives but no valid fix | Device indoors — go outside, wait 5 min |
| Battery never shows | Device uses a different I/O ID for battery — owner adjusts the edge function mapping |

> Alternative (no laptop): some Teltonika devices accept an SMS config command such as `  setparam 2004:SERVER_HOST;2005:5027;2006:0`. This is documented for FMB-series; **verify the TAT240 supports it** in the Teltonika wiki before relying on it.

---

# For the project owner — what to do before Tom tests

1. **Prove the pipeline without the device** (already passing): `cd gateway && npm test` runs a simulated TAT240 → gateway → ingest.
2. **Set the secret:** `supabase secrets set INGEST_TOKEN=<random> --project-ref qhxdqgkpebmpzzuzqcla`
3. **Host the gateway** on something with a public TCP port (Vercel can’t — it only serves HTTP). Fly.io config is ready: see `gateway/fly.toml` (`fly ips allocate-v4` is required for raw TCP).
4. **Rehearse with the simulator against the real host** (this lights up the checklist exactly like the device will):
   `cd gateway && npm run simulate -- SERVER_HOST 5027 862129084785066 20`
5. **Deploy the dashboard** to Vercel (see `vercel.json`) and send Tom the link + `SERVER_HOST`/`5027`.
