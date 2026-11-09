// Pure helpers for the RFID ingest function (no network, so they can be unit-tested).
export interface Read { epc: string; ts?: string; rssi?: number }
export interface Parsed { reader?: string; reads: Read[] }

const EPC_KEYS = ['epc', 'epchex', 'epc_hex', 'idhex', 'id_hex', 'tag', 'tagid', 'tag_id', 'tagepc', 'rfid', 'uid']
const READER_KEYS = ['reader', 'readername', 'reader_name', 'readercode', 'reader_code', 'readerid', 'reader_id', 'hostname', 'devicename', 'device_name', 'device', 'deviceid', 'device_id']
const TS_KEYS = ['ts', 'timestamp', 'time', 'firstseentimestamp', 'firstseen', 'first_seen', 'lastseentimestamp', 'lastseen', 'last_seen', 'seen', 'datetime']
const RSSI_KEYS = ['rssi', 'peakrssi', 'peak_rssi', 'signal']

export const cleanEpc = (v: unknown): string => String(v ?? '').trim().replace(/^0x/i, '').toUpperCase().replace(/[^0-9A-F]/g, '')
const validEpc = (e: string) => e.length >= 8 && e.length <= 48

/** Readers send time as ISO text, seconds, milliseconds or microseconds. */
export function toIso(v: unknown): string | undefined {
  if (v == null || v === '') return undefined
  let n = typeof v === 'number' ? v : /^\d+(\.\d+)?$/.test(String(v)) ? Number(v) : NaN
  if (!Number.isNaN(n)) { if (n > 1e15) n /= 1000; else if (n < 1e11) n *= 1000; const d = new Date(n); return Number.isNaN(d.getTime()) ? undefined : d.toISOString() }
  const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}
const pick = (o: Record<string, unknown>, keys: string[]) => { for (const k of Object.keys(o)) if (keys.includes(k.toLowerCase())) return o[k]; return undefined }

/** Walk any JSON shape and collect tag reads from whatever field names the reader uses. */
function walk(node: unknown, out: Read[], found: { reader?: string }, inherit: { ts?: string }) {
  if (Array.isArray(node)) { for (const x of node) { if (typeof x === 'string' || typeof x === 'number') { const e = cleanEpc(x); if (validEpc(e)) out.push({ epc: e, ts: inherit.ts }) } else walk(x, out, found, inherit) } return }
  if (!node || typeof node !== 'object') return
  const o = node as Record<string, unknown>
  const r = pick(o, READER_KEYS); if (typeof r === 'string' && r.trim() && !found.reader) found.reader = r.trim()
  const epc = pick(o, EPC_KEYS)
  if (epc !== undefined && typeof epc !== 'object') {
    const e = cleanEpc(epc); if (validEpc(e)) { const rs = Number(pick(o, RSSI_KEYS)); out.push({ epc: e, ts: toIso(pick(o, TS_KEYS)) ?? inherit.ts, rssi: Number.isFinite(rs) ? rs : undefined }); return }
  }
  const ts = toIso(pick(o, TS_KEYS)); const next = ts ? { ts } : inherit
  for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, out, found, next)
}

export function parsePayload(contentType: string, raw: string, query: URLSearchParams): Parsed {
  const out: Read[] = []; const found: { reader?: string } = {}
  const text = raw.trim()
  if (/json/i.test(contentType) || text.startsWith('{') || text.startsWith('[')) {
    try { walk(JSON.parse(text), out, found, {}) } catch { /* not JSON: fall through to text */ }
  }
  if (!out.length && text && !text.startsWith('{') && !text.startsWith('[')) {
    // plain text or CSV: one tag per line, optional timestamp after it
    for (const line of text.split(/\r?\n/)) { const parts = line.split(/[,;\t ]+/).filter(Boolean); const e = parts.map(cleanEpc).find(validEpc); if (e) out.push({ epc: e, ts: toIso(parts.find((p) => p !== parts[0] && /\d{4}-\d{2}-\d{2}|^\d{10,}$/.test(p))) }) }
  }
  const dedup = new Map<string, Read>(); for (const r of out) if (!dedup.has(r.epc)) dedup.set(r.epc, r)
  return { reader: (query.get('reader') ?? found.reader)?.trim() || undefined, reads: [...dedup.values()] }
}

/** What being read in a kind of zone usually means for an item's state. */
export function inferStatus(zoneKind: string | null | undefined, current: string): string {
  switch (zoneKind) {
    case 'dirty': return 'in_cage'
    case 'processing': return 'processing'
    case 'clean': case 'store': return ['processing', 'in_transit', 'missing', 'clean'].includes(current) ? 'in_stock' : current
    case 'clinical': return ['in_stock', 'clean'].includes(current) ? 'in_use' : current
    default: return current === 'missing' ? 'in_stock' : current
  }
}
