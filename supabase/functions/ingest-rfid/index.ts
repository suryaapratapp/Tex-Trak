// Tex-Trak · RFID reader ingestion.
//
// Point a reader's "HTTP POST / server URL" setting at ONE of these:
//   1. Per reader (recommended):   https://<project>.supabase.co/functions/v1/ingest-rfid?reader=<CODE>&key=<READER KEY>
//   2. Platform-wide secret:       same URL with ?token=<INGEST_TOKEN>  (or header x-ingest-token / Bearer / Basic password)
// The body can be JSON in almost any shape (Impinj, Zebra, Chainway, custom), a JSON array of hex tags, or plain text with one tag per line.
// A signed-in Super Admin may also call it (the "Send a test read" button).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { inferStatus, parsePayload } from './logic.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-ingest-token, x-reader-key', 'access-control-allow-methods': 'POST, GET, OPTIONS' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'content-type': 'application/json' } })

function secretFrom(req: Request, q: URLSearchParams): string | null {
  const h = req.headers.get('x-ingest-token'); if (h) return h
  const a = req.headers.get('authorization') ?? ''
  if (/^basic /i.test(a)) { try { return atob(a.slice(6)).split(':').slice(1).join(':') } catch { return null } }
  if (/^bearer /i.test(a) && a.split('.').length !== 3) return a.slice(7) // a JWT has three parts; anything else is treated as a secret
  return q.get('token')
}
async function isSuperAdmin(req: Request) {
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''); if (!bearer || bearer.split('.').length !== 3) return false
  const { data } = await db.auth.getUser(bearer); if (!data.user) return false
  const { data: p } = await db.from('profiles').select('role,active').eq('id', data.user.id).maybeSingle()
  return !!p && p.active && p.role === 'superadmin'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const url = new URL(req.url); const q = url.searchParams
  if (req.method === 'GET') return json({ ok: true, service: 'tex-trak rfid ingest', usage: 'POST tag reads to this URL with ?reader=<code>&key=<reader key>' })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const raw = await req.text(); if (raw.length > 2_000_000) return json({ error: 'payload too large' }, 413)
  const parsed = parsePayload(req.headers.get('content-type') ?? '', raw, q)

  // Who is calling, and which reader is it?
  let reader: { id: string; code: string; label: string; site_id: string; zone_id: string | null } | null = null
  const readerKey = q.get('key') ?? req.headers.get('x-reader-key')
  if (readerKey) {
    const { data } = await db.from('readers').select('id,code,label,site_id,zone_id').eq('ingest_key', readerKey).maybeSingle()
    if (!data) return json({ error: 'unknown reader key' }, 401)
    if (parsed.reader && parsed.reader !== data.code && q.get('reader') && q.get('reader') !== data.code) return json({ error: 'the key does not belong to that reader' }, 403)
    reader = data
  } else {
    const secret = Deno.env.get('INGEST_TOKEN'); const given = secretFrom(req, q)
    if (!((secret && given && given === secret) || (await isSuperAdmin(req)))) return json({ error: 'unauthorised' }, 401)
    const code = parsed.reader; if (!code) return json({ error: 'which reader? add ?reader=<code> to the URL' }, 400)
    const { data: found } = await db.from('readers').select('id,code,label,site_id,zone_id').eq('code', code)
    reader = found?.[0] ?? null
    if (found && found.length > 1) { const { data: s } = await db.from('sites').select('id').eq('code', q.get('site') ?? '').maybeSingle(); reader = found.find((r) => r.site_id === s?.id) ?? null; if (!reader) return json({ error: `reader code ${code} exists at several sites: add ?site=<site code>` }, 409) }
    if (!reader) return json({ error: `unknown reader ${code}. Register it first (Super Admin → RFID readers)` }, 404)
  }

  const reads = parsed.reads.slice(0, 2000)
  await db.from('readers').update({ last_seen: new Date().toISOString(), online: true }).eq('id', reader.id)
  if (!reads.length) return json({ ok: true, reader: reader.code, heartbeat: true, stored: 0, unknown: 0, skipped: 0 })

  const { data: site } = await db.from('sites').select('id,org_id,name').eq('id', reader.site_id).maybeSingle()
  const { data: zone } = reader.zone_id ? await db.from('zones').select('id,name,kind').eq('id', reader.zone_id).maybeSingle() : { data: null }

  let stored = 0, unknown = 0, skipped = 0
  for (const r of reads) {
    const when = r.ts ?? new Date().toISOString()
    let qy = db.from('items').select('id,org_id,status').eq('epc', r.epc); if (site?.org_id) qy = qy.eq('org_id', site.org_id)
    const { data: items } = await qy.limit(1); const item = items?.[0]
    if (!item) {
      unknown++
      if (site?.org_id) { const { data: seen } = await db.from('item_events').select('id').eq('epc', r.epc).eq('type', 'unknown_read').eq('org_id', site.org_id).gte('created_at', new Date(Date.now() - 3600e3).toISOString()).limit(1)
        if (!seen?.length) await db.from('item_events').insert({ org_id: site.org_id, epc: r.epc, type: 'unknown_read', detail: `Tag not in the item list, seen at ${reader.label || reader.code}`, reader_code: reader.code, site_id: reader.site_id, zone_id: reader.zone_id, created_at: when }) }
      continue
    }
    const since = new Date(new Date(when).getTime() - 10_000).toISOString()
    const { data: dup } = await db.from('item_events').select('id').eq('item_id', item.id).eq('reader_code', reader.code).gte('created_at', since).limit(1)
    if (dup?.length) { skipped++; continue }
    const next = inferStatus(zone?.kind, item.status)
    await db.from('items').update({ site_id: reader.site_id, zone_id: reader.zone_id, last_seen_at: when, last_reader: reader.code, status: next }).eq('id', item.id)
    const place = `${reader.label || reader.code}${zone ? ` · ${zone.name}` : ''}`
    await db.from('item_events').insert([
      ...(item.status === 'missing' ? [{ org_id: item.org_id, item_id: item.id, epc: r.epc, type: 'found', status: next, detail: `Found again at ${place}`, reader_code: reader.code, site_id: reader.site_id, zone_id: reader.zone_id, created_at: when }] : []),
      { org_id: item.org_id, item_id: item.id, epc: r.epc, type: 'read', status: next, detail: place, reader_code: reader.code, site_id: reader.site_id, zone_id: reader.zone_id, created_at: when },
    ])
    stored++
  }
  return json({ ok: true, reader: reader.code, stored, unknown, skipped })
})
