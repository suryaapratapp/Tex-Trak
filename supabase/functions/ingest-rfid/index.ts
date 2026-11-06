// Tex-Trak · RFID reader ingestion.
// A reader (or the middleware next to it) posts the tags it saw:
//   POST /functions/v1/ingest-rfid
//   header  x-ingest-token: <INGEST_TOKEN>
//   body    { "reader": "R-DOCK-01", "site": "<optional site code, if reader codes repeat>", "reads": [{ "epc": "E280...", "ts": "2026-11-06T09:30:00Z", "rssi": -52 }] }
// A signed-in Super Admin may also call it (used by the "Send a test read" button in the app).
import { createClient } from 'npm:@supabase/supabase-js@2'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-ingest-token', 'access-control-allow-methods': 'POST, OPTIONS' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'content-type': 'application/json' } })

async function authorised(req: Request) {
  const secret = Deno.env.get('INGEST_TOKEN'); const token = req.headers.get('x-ingest-token')
  if (secret && token && token === secret) return true
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!bearer) return false
  const { data } = await db.auth.getUser(bearer); if (!data.user) return false
  const { data: p } = await db.from('profiles').select('role,active').eq('id', data.user.id).maybeSingle()
  return !!p && p.active && p.role === 'superadmin'
}

// What being read in a kind of zone usually means for an item's state.
function inferStatus(zoneKind: string | null | undefined, current: string): string {
  switch (zoneKind) {
    case 'dirty': return current === 'in_cage' ? current : 'in_cage'
    case 'processing': return 'processing'
    case 'clean': case 'store': return ['processing', 'in_transit', 'missing', 'clean'].includes(current) ? 'in_stock' : current
    case 'clinical': return ['in_stock', 'clean'].includes(current) ? 'in_use' : current
    default: return current === 'missing' ? 'in_stock' : current
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!(await authorised(req))) return json({ error: 'unauthorised' }, 401)

  let body: { reader?: string; site?: string; reads?: { epc?: string; ts?: string; rssi?: number }[] }
  try { body = await req.json() } catch { return json({ error: 'bad payload' }, 400) }
  const code = String(body.reader ?? '').trim(); const reads = Array.isArray(body.reads) ? body.reads.slice(0, 2000) : []
  if (!code || reads.length === 0) return json({ error: 'reader and reads are required' }, 400)

  // Which reader is it?
  const { data: found } = await db.from('readers').select('id,code,label,site_id,zone_id,online').eq('code', code)
  let reader = found?.[0]
  if (found && found.length > 1) {
    const { data: site } = await db.from('sites').select('id').eq('code', String(body.site ?? '')).maybeSingle()
    reader = found.find((r) => r.site_id === site?.id)
    if (!reader) return json({ error: `reader code ${code} exists at several sites: send "site" as well` }, 409)
  }
  if (!reader) return json({ error: `unknown reader ${code}. Register it first (Super Admin → RFID readers)` }, 404)
  const { data: site } = await db.from('sites').select('id,org_id,name').eq('id', reader.site_id).maybeSingle()
  const { data: zone } = reader.zone_id ? await db.from('zones').select('id,name,kind').eq('id', reader.zone_id).maybeSingle() : { data: null }

  await db.from('readers').update({ last_seen: new Date().toISOString(), online: true }).eq('id', reader.id)

  let stored = 0, unknown = 0, skipped = 0
  const seen = new Set<string>()
  for (const r of reads) {
    const epc = String(r.epc ?? '').trim().toUpperCase().replace(/[^0-9A-F]/g, '')
    if (epc.length < 8 || seen.has(epc)) { skipped++; continue }
    seen.add(epc)
    const when = r.ts && !Number.isNaN(Date.parse(r.ts)) ? new Date(r.ts).toISOString() : new Date().toISOString()

    let q = db.from('items').select('id,org_id,status').eq('epc', epc)
    if (site?.org_id) q = q.eq('org_id', site.org_id)
    const { data: items } = await q.limit(1); const item = items?.[0]
    if (!item) {
      unknown++
      if (site?.org_id) await db.from('item_events').insert({ org_id: site.org_id, epc, type: 'unknown_read', detail: `Tag not in the item list, seen at ${reader.label || reader.code}`, reader_code: reader.code, site_id: reader.site_id, zone_id: reader.zone_id, created_at: when })
      continue
    }
    // ignore the same tag at the same reader within 10 seconds
    const since = new Date(new Date(when).getTime() - 10_000).toISOString()
    const { data: dup } = await db.from('item_events').select('id').eq('item_id', item.id).eq('reader_code', reader.code).gte('created_at', since).limit(1)
    if (dup?.length) { skipped++; continue }

    const next = inferStatus(zone?.kind, item.status)
    await db.from('items').update({ site_id: reader.site_id, zone_id: reader.zone_id, last_seen_at: when, last_reader: reader.code, status: next }).eq('id', item.id)
    const placeText = `${reader.label || reader.code}${zone ? ` · ${zone.name}` : ''}`
    await db.from('item_events').insert([
      ...(item.status === 'missing' ? [{ org_id: item.org_id, item_id: item.id, epc, type: 'found', status: next, detail: `Found again at ${placeText}`, reader_code: reader.code, site_id: reader.site_id, zone_id: reader.zone_id, created_at: when }] : []),
      { org_id: item.org_id, item_id: item.id, epc, type: 'read', status: next, detail: placeText, reader_code: reader.code, site_id: reader.site_id, zone_id: reader.zone_id, created_at: when },
    ])
    stored++
  }
  return json({ reader: reader.code, stored, unknown, skipped })
})
