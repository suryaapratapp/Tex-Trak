# Teltonika TAT240 with Tex-Trak: step-by-step (device in London)

## How the pieces fit

```
TAT240 (London)  --mobile network, raw TCP, port 5027-->  Fly.io gateway (London region, lhr)
                                                              |  HTTPS + shared secret (INGEST_TOKEN)
                                                              v
                                              Supabase function "ingest-tracker"
                                                              |
                                                              v
                                        Database -> Live map in Tex-Trak (web and app)
```

- The TAT240 does not speak HTTP. It sends Teltonika's binary protocol (Codec 8 / 8 Extended) over TCP.
- Supabase cannot accept raw TCP, so a small **gateway** (`gateway/`) runs on Fly.io in London (`lhr`). It decodes the data, acknowledges it so the tracker deletes it from its memory, and forwards positions to Supabase over HTTPS.
- The shared secret `INGEST_TOKEN` is how Supabase knows a request came from your gateway. It must be identical in Supabase and Fly.
- The tracker is only accepted if its **IMEI** is registered in Tex-Trak and switched on.

## Part 1: Deploy the gateway (once, on your Mac)

1. Install and sign in to the tools (skip what you have):
   ```
   brew install flyctl supabase/tap/supabase
   fly auth login
   supabase login
   ```
2. Fly needs a payment method on the account (Fly dashboard, Billing). A dedicated IPv4 address costs about 2 USD per month. Raw TCP on a custom port needs one.
3. Create one secret and set it in both places:
   ```
   TOKEN=$(openssl rand -hex 32)
   supabase secrets set INGEST_TOKEN=$TOKEN --project-ref qhxdqgkpebmpzzuzqcla
   cd /Users/surya/Tex-Trak/gateway
   fly secrets set INGEST_TOKEN=$TOKEN
   ```
4. Deploy and give it a public IPv4:
   ```
   fly deploy
   fly ips allocate-v4
   fly ips list
   fly status
   fly logs
   ```
   `fly.toml` already uses region `lhr` (London), keeps one machine always running, and exposes TCP port 5027. The logs should say it is listening on :5027.
5. Check the port is open from the internet:
   ```
   nc -vz textrak-gateway.fly.dev 5027
   ```
   If it fails, run `fly ips list`: there must be a **v4** row that is not "shared".

## Part 2: Register the tracker in Tex-Trak

1. Sign in as Super Admin. Set the top bar to **Live data**.
2. Super Admin, **Trackers**, **Add**.
3. Enter:
   - **IMEI**: the 15 digits printed on the device label (or shown in Configurator).
   - **Name**: for example `Van 1 London`.
   - **Client**: the client that owns it (for example Synergy). Only that client's admins see it.
   - Leave it **active**.
4. Save. Until this is done, the gateway accepts the connection but the server refuses the data.

## Part 3: SIM card (London)

1. Use a SIM that suits the device: the TAT240 is an LTE-class battery tracker, so use an IoT or data SIM that supports the network technology of your exact unit (check its datasheet or label: LTE Cat 1, Cat M1 or NB-IoT, with 2G fallback where offered).
2. UK mobile networks have switched off, or are switching off, 3G, and 2G is being phased out later, so do not rely on a 2G-only plan.
3. A **multi-network IoT SIM** (roams across EE, O2, Vodafone and Three) is the safest in London because the tracker can take whichever signal is best, indoors or in a depot. A single-network consumer SIM can have dead spots.
4. Ask the SIM provider for the **APN** (and any username or password). Do not guess it. Make sure data is enabled and there is no PIN on the SIM, or enter the PIN in Configurator.
5. Data use is tiny. At one record every 6 minutes you send roughly 240 records a day, so a few MB a month. Any IoT plan with a small allowance is enough.

## Part 4: Configure the TAT240 (Teltonika Configurator)

Menu names vary slightly between firmware versions. Look for the equivalent.

1. Install **Teltonika Configurator** on a Windows PC (Teltonika's website, Downloads, Configurator). Connect the TAT240 over USB (or Bluetooth if your unit supports it) and update to the latest firmware when offered.
2. Insert the SIM first, then connect.
3. **GPRS / Cellular** section:
   - APN: from your SIM provider.
   - APN username and password: only if the provider gave them.
4. **Server / Data protocol** section:
   - **Domain / server:** `textrak-gateway.fly.dev`. If the device fails to resolve names, use the IPv4 from `fly ips list` instead.
   - **Port:** `5027`
   - **Protocol:** `TCP` (not UDP)
   - **Codec:** `Codec 8 Extended` (Codec 8 also works)
5. **Data acquisition / sending:** set both the moving and the stationary record and send period to **360 seconds (6 minutes)**. Shorter periods drain the battery quickly, and 6 minutes is what Tex-Trak is planned around.
6. Make sure **GNSS / location** is enabled. Save to device.
7. Optional: set sleep or deep-sleep behaviour to match how you will use it (a sleeping device only reports when it wakes).

## Part 5: Test it outside, in London

1. Take the device **outside with open sky** (not indoors, not in a bag in a car boot). The first GPS fix (cold start) can take several minutes. Indoors it may never get one.
2. Wait one 6-minute interval after it has a fix.
3. Check the gateway:
   ```
   fly logs
   ```
   You should see a login with your IMEI, then records received and forwarded.
4. In Tex-Trak: **Live data**, **Live map**. The vehicle appears with its name, last seen time and battery. Move it and wait another interval to see a trail.
5. Times are stored in UTC and shown in your local time, so London's switch between GMT and BST needs no action.

## If it does not appear

| Symptom | Likely cause | Fix |
|---|---|---|
| Nothing in `fly logs` | Device is not connecting | Check SIM data and APN; check server name, port 5027 and TCP in Configurator; try the IPv4 address instead of the name; run `nc -vz` to check the port from your Mac |
| Logs show a login, but nothing on the map | IMEI not registered or switched off in Tex-Trak; or secret mismatch | Check Trackers; set the same `INGEST_TOKEN` in Supabase and Fly, redeploy gateway |
| Connects but position is 0,0 or old | No GPS fix | Move outside; wait several minutes |
| Appears late | Normal | One report every 6 minutes |
| Map is empty although data exists | Top bar is on Demo data | Switch to Live data |
| Worked, then stopped | Battery, SIM data allowance, or poor signal | Charge it; check SIM provider's portal |

## What stays your job

- Keep the `INGEST_TOKEN` private. To replace it, set the new value in Supabase and Fly and run `fly deploy`.
- Check `fly status` now and then; the gateway is set to stay running.
- The first live test with a real device is the only way to confirm the whole chain. Tell me what `fly logs` shows if anything differs and I will adjust the gateway.
