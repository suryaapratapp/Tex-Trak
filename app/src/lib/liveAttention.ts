// Things that need a person's attention, worked out from real data only (never the demo world).
import { supabase } from './supabase'
import { ago, describeDevice, readerHealth } from './status'

export interface Attn { id: string; tone: 'bad' | 'warn' | 'info'; title: string; body: string; page?: string; at?: string }

export async function loadAttention(isSuper: boolean): Promise<Attn[]> {
  const out: Attn[] = []
  const since = new Date(Date.now() - 24 * 3600e3).toISOString()
  const [trk, lat, rdr, al, missing, unk, exc, rhy, arr] = await Promise.all([
    supabase.from('trackers').select('imei,name,kind,active,last_seen').eq('active', true).eq('kind', 'tracker'),
    supabase.rpc('device_latest'),
    isSuper ? supabase.from('readers').select('id,code,label,last_seen') : Promise.resolve({ data: [] as { id: string; code: string; label: string; last_seen: string | null }[] }),
    supabase.from('alerts').select('id,title,detail,severity,created_at,state').neq('state', 'resolved').order('created_at', { ascending: false }).limit(20),
    supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'missing'),
    supabase.from('item_events').select('id', { count: 'exact', head: true }).eq('type', 'unknown_read').gte('created_at', since),
    supabase.from('shipments').select('id,ref,to_name', { count: 'exact' }).eq('status', 'exception').limit(5),
    supabase.rpc('device_rhythm'),
    supabase.from('shipments').select('id,ref,to_name,customer_org_id', { count: 'exact' }).eq('status', 'in_transit').not('arrived_at', 'is', null).limit(5),
  ])
  const rhythm = Object.fromEntries(((rhy.data ?? []) as { imei: string; interval_min: string }[]).map((x) => [x.imei, Number(x.interval_min)]))
  const latest = Object.fromEntries(((lat.data ?? []) as { imei: string; fix_ts: string | null; seen_at: string | null }[]).map((x) => [x.imei, x]))
  for (const t of (trk.data ?? []) as { imei: string; name: string; kind: 'tracker'; last_seen: string | null }[]) {
    const l = latest[t.imei]; const nm = t.name || `Tracker ${t.imei.slice(-6)}`; const n = describeDevice({ kind: 'tracker', lastSeen: t.last_seen, intervalMin: rhythm[t.imei], fixTs: l?.fix_ts, hasPosition: !!l })
    if (n.level === 'ok') continue
    out.push({ id: `trk-${n.level}-${t.imei}`, tone: n.level === 'bad' ? (t.last_seen ? 'bad' : 'warn') : 'warn', title: n.label === 'Offline' ? `${nm} is offline` : n.label === 'Never heard from' ? `${nm} has never reported` : `${nm}: no GPS position`, body: n.level === 'bad' ? `${n.connection}. ${n.advice}` : n.advice, page: isSuper ? 'status' : 'map', at: t.last_seen ?? undefined })
  }
  if ((arr.count ?? 0) > 0) out.push({ id: 'ship-arrived', tone: 'warn', title: `${arr.count} deliver${arr.count === 1 ? 'y has' : 'ies have'} arrived`, body: ((arr.data ?? []) as { ref: string; to_name: string }[]).map((s) => `${s.ref} at ${s.to_name}`).join(', ') + '. Waiting for the receiver to confirm.', page: 'shipments' })
  for (const r of (rdr.data ?? []) as { id: string; code: string; label: string; last_seen: string | null }[]) {
    if (readerHealth(r.last_seen) === 'offline' && r.last_seen) out.push({ id: `rdr-${r.id}`, tone: 'warn', title: `Reader ${r.code} has been silent for over a day`, body: `Last read ${ago(r.last_seen)}${r.label ? ` (${r.label})` : ''}. Check its power and network.`, page: 'status' })
  }
  for (const a of (al.data ?? []) as { id: string; title: string; detail: string; severity: string; created_at: string }[]) out.push({ id: `al-${a.id}`, tone: a.severity === 'critical' || a.severity === 'high' ? 'bad' : 'warn', title: a.title, body: a.detail, page: 'map', at: a.created_at })
  if ((exc.count ?? 0) > 0) out.push({ id: 'ship-exc', tone: 'bad', title: `${exc.count} shipment${exc.count === 1 ? ' has' : 's have'} a problem`, body: ((exc.data ?? []) as { ref: string; to_name: string }[]).map((s) => `${s.ref} to ${s.to_name}`).join(', '), page: 'shipments' })
  if ((missing.count ?? 0) > 0) out.push({ id: 'items-missing', tone: 'warn', title: `${missing.count} item${missing.count === 1 ? ' is' : 's are'} marked missing`, body: 'If a reader sees one again it is marked found automatically.', page: 'inventory' })
  if ((unk.count ?? 0) > 0) out.push({ id: 'unknown-reads', tone: 'info', title: `${unk.count} read${unk.count === 1 ? '' : 's'} of unknown tags in the last 24 hours`, body: 'A reader saw tags that are not on the item list. Add them in Inventory.', page: 'inventory' })
  return out.sort((a, b) => ({ bad: 0, warn: 1, info: 2 }[a.tone] - { bad: 0, warn: 1, info: 2 }[b.tone]))
}
