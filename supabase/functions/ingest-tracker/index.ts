// Tex-Trak · TAT240 ingestion. Called by the Teltonika TCP gateway with decoded AVL records.
// Auth: shared secret in header `x-ingest-token` (set with: supabase secrets set INGEST_TOKEN=...)
// Safe to call twice with the same records: duplicates (same IMEI and timestamp) are ignored.
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const R = 6371000
const rad = (d: number) => (d * Math.PI) / 180
const haversine = (a: [number, number], b: [number, number]) => {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1])
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } })
const same = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0 }

interface Rec { ts: string; lat: number; lng: number; alt?: number; heading?: number; sats?: number; speed?: number; io?: Record<string, number | string> }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const secret = Deno.env.get('INGEST_TOKEN')
  if (!secret) return json({ error: 'INGEST_TOKEN not configured' }, 503)
  if (!same(req.headers.get('x-ingest-token') ?? '', secret)) return json({ error: 'unauthorised' }, 401)

  let body: { imei?: string; records?: Rec[] }
  try { body = await req.json() } catch { return json({ error: 'bad payload' }, 400) }
  const { imei, records } = body
  if (!imei || !/^\d{15}$/.test(imei) || !Array.isArray(records) || records.length === 0 || records.length > 1000) return json({ error: 'bad payload' }, 400)

  const { data: tracker } = await supabase.from('trackers').select('imei,active').eq('imei', imei).maybeSingle()
  if (!tracker || tracker.active === false) return json({ error: 'unknown or inactive IMEI' }, 403)

  const now = Date.now()
  const rows = records.filter((r) => r && Number.isFinite(r.lat) && Number.isFinite(r.lng) && Math.abs(r.lat) <= 90 && Math.abs(r.lng) <= 180).map((r) => {
    const io = (r.io ?? {}) as Record<string, number | string>
    let t = new Date(r.ts).getTime(); const io2: Record<string, number | string> = { ...io }
    // A device that has lost its clock reports 1970 or a date far ahead: keep the reading, stamp it with the time we received it.
    if (!Number.isFinite(t) || t < Date.UTC(2020, 0, 1) || t > now + 24 * 3600e3) { io2.ts_device = String(r.ts); t = now }
    const valid = (r.sats ?? 0) > 0 && !(r.lat === 0 && r.lng === 0)
    const bat = typeof io['67'] === 'number' ? io['67'] : typeof io['66'] === 'number' ? io['66'] : null
    return {
      imei, ts: new Date(t).toISOString(), lat: r.lat, lng: r.lng, speed_kmh: r.speed ?? 0, heading: r.heading ?? 0, altitude_m: r.alt ?? null,
      satellites: r.sats ?? null, fix_valid: valid, battery_mv: bat, gsm_signal: typeof io['21'] === 'number' ? io['21'] : null, io: io2,
    }
  })
  if (rows.length === 0) return json({ error: 'bad payload' }, 400)

  const { error } = await supabase.from('tracker_positions').upsert(rows, { onConflict: 'imei,ts', ignoreDuplicates: true })
  if (error) return json({ error: error.message }, 500)

  // Last-seen is the time we heard from the device. Battery is only replaced when the newest reading actually carries one.
  const newest = [...rows].sort((a, b) => a.ts.localeCompare(b.ts)).pop()!
  const patch: Record<string, unknown> = { last_seen: new Date().toISOString() }
  if (newest.battery_mv != null) patch.battery_mv = newest.battery_mv
  await supabase.from('trackers').update(patch).eq('imei', imei)

  // Server-side rule: entry into a restricted site (port / incinerator / landfill) raises a critical alert (de-duplicated 6 h)
  const last = rows.filter((r) => r.fix_valid).sort((a, b) => a.ts.localeCompare(b.ts)).pop()
  let alerts = 0
  if (last && now - new Date(last.ts).getTime() < 3600e3) {
    const { data: sites } = await supabase.from('sites').select('id,name,lat,lng,radius_m,kind').in('kind', ['port', 'incinerator', 'landfill'])
    for (const s of sites ?? []) {
      if (haversine([last.lat, last.lng], [s.lat, s.lng]) <= s.radius_m) {
        const since = new Date(now - 6 * 3600e3).toISOString()
        const { data: open } = await supabase.from('alerts').select('id').eq('rule_code', 'RESTRICTED_GEOFENCE').eq('subject_ref', imei).eq('site_id', s.id).gte('created_at', since).limit(1)
        if (!open?.length) {
          await supabase.from('alerts').insert({ rule_code: 'RESTRICTED_GEOFENCE', severity: 'critical', title: `Tracker ${imei.slice(-6)} entered ${s.name}`, detail: 'Consignment entered a restricted export/disposal geofence.', subject_type: 'vehicle', subject_ref: imei, site_id: s.id, lat: last.lat, lng: last.lng, risk_score: 88, evidence: { speed_kmh: last.speed_kmh, ts: last.ts } })
          alerts++
        }
      }
    }
  }
  return json({ received: rows.length, alerts })
})
