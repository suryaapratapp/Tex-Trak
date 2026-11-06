// Tex-Trak · TAT240 ingestion. Called by the Teltonika TCP gateway with decoded AVL records.
// Auth: shared secret in header `x-ingest-token` (set with: supabase secrets set INGEST_TOKEN=...)
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

interface Rec { ts: string; lat: number; lng: number; alt?: number; heading?: number; sats?: number; speed?: number; io?: Record<string, number | string> }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const secret = Deno.env.get('INGEST_TOKEN')
  if (!secret) return json({ error: 'INGEST_TOKEN not configured' }, 503)
  if (req.headers.get('x-ingest-token') !== secret) return json({ error: 'unauthorised' }, 401)

  const { imei, records } = (await req.json()) as { imei: string; records: Rec[] }
  if (!imei || !Array.isArray(records) || records.length === 0 || records.length > 1000) return json({ error: 'bad payload' }, 400)

  const { data: tracker } = await supabase.from('trackers').select('imei,active').eq('imei', imei).maybeSingle()
  if (!tracker || tracker.active === false) return json({ error: 'unknown or inactive IMEI' }, 403)

  const rows = records.map((r) => {
    const io = (r.io ?? {}) as Record<string, number>
    const valid = (r.sats ?? 0) > 0 && !(r.lat === 0 && r.lng === 0)
    return {
      imei, ts: r.ts, lat: r.lat, lng: r.lng, speed_kmh: r.speed ?? 0, heading: r.heading ?? 0, altitude_m: r.alt ?? null,
      satellites: r.sats ?? null, fix_valid: valid,
      battery_mv: typeof io['67'] === 'number' ? io['67'] : typeof io['66'] === 'number' ? io['66'] : null, // verify IO ids for TAT240 in the Teltonika wiki
      gsm_signal: typeof io['21'] === 'number' ? io['21'] : null, io: r.io ?? {},
    }
  })
  const { error } = await supabase.from('tracker_positions').insert(rows)
  if (error) return json({ error: error.message }, 500)

  const last = rows.filter((r) => r.fix_valid).sort((a, b) => a.ts.localeCompare(b.ts)).pop()
  await supabase.from('trackers').update({ last_seen: new Date().toISOString(), battery_mv: last?.battery_mv ?? null }).eq('imei', imei)

  // Server-side rule: entry into a restricted site (port / incinerator / landfill) raises a critical alert (de-duplicated 6 h)
  let alerts = 0
  if (last) {
    const { data: sites } = await supabase.from('sites').select('id,name,lat,lng,radius_m,kind').in('kind', ['port', 'incinerator', 'landfill'])
    for (const s of sites ?? []) {
      if (haversine([last.lat, last.lng], [s.lat, s.lng]) <= s.radius_m) {
        const since = new Date(Date.now() - 6 * 3600e3).toISOString()
        const { data: open } = await supabase.from('alerts').select('id').eq('rule_code', 'RESTRICTED_GEOFENCE').eq('subject_ref', imei).eq('site_id', s.id).gte('created_at', since).limit(1)
        if (!open?.length) {
          await supabase.from('alerts').insert({ rule_code: 'RESTRICTED_GEOFENCE', severity: 'critical', title: `Tracker ${imei.slice(-6)} entered ${s.name}`, detail: 'Consignment entered a restricted export/disposal geofence.', subject_type: 'vehicle', subject_ref: imei, site_id: s.id, lat: last.lat, lng: last.lng, risk_score: 88, evidence: { speed_kmh: last.speed_kmh, ts: last.ts } })
          alerts++
        }
      }
    }
  }
  return json({ stored: rows.length, alerts })
})
