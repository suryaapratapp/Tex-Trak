import { fmtT, getWorld, itemAt, scannerAt, scannerValue, SCANNERS, type Consignment } from '../sim/engine'
import { SITES, VEH_BY_ID, ZONE_NAME } from '../sim/world'
import type { Snap } from '../sim/snap'
import { fmtDur } from '../sim/snap'
import { consFor } from './scope'
import type { Role } from '../sim/registry'

export type Tone = 'good' | 'warn' | 'bad' | 'info'
export interface Finding { tone: Tone; title: string; body: string; page?: string }
export interface Tile { label: string; value: string; sub?: string; tone?: 'default' | 'good' | 'bad' | 'warn' }
export interface Section { id: string; title: string; page: string; tiles: Tile[]; findings: Finding[]; bars?: { label: string; v: number; color?: string }[]; barsTitle?: string }

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

export function laundry(t: number, snap: Snap): Section {
  const w = getWorld(); const legs = w.legs.filter((l) => l.kind.startsWith('laundry') || l.kind === 'empty_return' || l.kind === 'collection_run')
  const done = legs.filter((l) => l.arrive <= t); const late = done.filter((l) => l.arrive - l.planArrive > 8)
  const missing = w.items.filter((i) => i.missing && t >= i.missing.t)
  const value = missing.reduce((a, i) => a + i.type.unitValue, 0)
  const hot: Record<string, number> = {}; missing.forEach((i) => { const z = ZONE_NAME[i.missing!.lastZone]; hot[z] = (hot[z] ?? 0) + 1 })
  const eol = w.items.filter((i) => !i.missing && i.type.maxCycles - itemAt(i, t).cycles <= 2)
  const life = w.items.reduce((a, i) => a + itemAt(i, t).cycles / i.type.maxCycles, 0) / w.items.length
  const next = w.legs.filter((l) => l.to === 'HOSP' && l.depart > t - 5 && l.arrive > t && l.kind !== 'curtain_delivery').sort((a, b) => a.arrive - b.arrive)[0]
  const f: Finding[] = []
  if (next) f.push({ tone: next.arrive - next.planArrive > 8 ? 'warn' : 'info', title: `Next delivery to the hospital arrives ${fmtT(next.arrive).slice(0, 5)}`, body: `In ${fmtDur(next.arrive - t)} · ${next.arrive - next.planArrive >= 0 ? '+' : ''}${Math.round(next.arrive - next.planArrive)} min vs plan. Free the dock and brief goods-in before then.`, page: 'planner' })
  if (missing.length) f.push({ tone: 'bad', title: `${missing.length} items unaccounted for · £${value}`, body: `Most likely loss point: ${Object.entries(hot).sort((a, b) => b[1] - a[1])[0][0]}. A handheld RFID sweep of that area is the quickest recovery.`, page: 'lifecycle' })
  else if (t < 1110) f.push({ tone: 'info', title: 'End-of-day reconciliation at 18:30', body: 'Items issued are compared with items back in the dirty cages. Nothing is missing so far.' })
  if (eol.length) f.push({ tone: 'info', title: `${eol.length} items within 2 washes of end of life`, body: 'They will go to the next recycling load instead of back on the ward.', page: 'inventory' })
  if (late.length) f.push({ tone: 'warn', title: `${late.length} of ${done.length} truck runs ran late`, body: 'Late arrivals push back the wash line. Build 15 minutes of buffer into the evening collection.', page: 'planner' })
  else if (done.length) f.push({ tone: 'good', title: 'Every truck run so far has been on time', body: 'ETA from the trackers matched the plan within 8 minutes.' })
  const zones: [string, number][] = [['Linen store', snap.byZone.LINEN ?? 0], ['On wards', ['THEATRES', 'ICU', 'WARD', 'MAT', 'AE', 'OPD'].reduce((a, z) => a + (snap.byZone[z] ?? 0), 0)], ['Dirty cages', snap.byZone.DIRTY ?? 0], ['On trucks', snap.byZone['V:V1'] ?? 0], ['In the plant', snap.byStatus.processing ?? 0]]
  return { id: 'laundry', title: 'Laundry & arrivals', page: 'planner',
    tiles: [{ label: 'On-time runs', value: done.length ? `${pct(done.length - late.length, done.length)}%` : '–', tone: late.length ? 'warn' : 'good', sub: `${done.length} runs finished` }, { label: 'Items lost today', value: String(missing.length), tone: missing.length ? 'bad' : 'good', sub: `£${value} at risk` }, { label: 'Average life used', value: `${Math.round(life * 100)}%`, sub: `${eol.length} near end of life` }],
    findings: f, barsTitle: 'Where the 72 tagged items are right now', bars: zones.map(([label, v]) => ({ label, v })) }
}

export function assets(t: number): Section {
  const w = getWorld(); const rows = SCANNERS.map((s) => ({ s, st: scannerAt(w.legs, s, t) }))
  const off = rows.filter((r) => r.st.outside); const low = rows.filter((r) => r.st.battery < 20); const stale = rows.filter((r) => (t - r.st.lastSeen) / 60 > 24)
  const val = rows.reduce((a, r) => a + scannerValue(r.s), 0); const risk = [...off, ...stale].reduce((a, r) => a + scannerValue(r.s), 0)
  const f: Finding[] = []
  off.forEach((r) => f.push({ tone: 'bad', title: `${r.s.id} is ${(r.st.distFromHome / 1000).toFixed(1)} km from its site`, body: `${r.s.name} · £${scannerValue(r.s).toLocaleString('en-GB')} · holder ${r.s.holder}. Call the holder, lock the app licence, escalate to police after 2 hours.`, page: 'assets' }))
  stale.forEach((r) => f.push({ tone: 'warn', title: `${r.s.id} has not checked in for ${Math.round((t - r.st.lastSeen) / 60)} h`, body: 'Probably in a shielded cabinet or moved without a scan. Ask the holder to scan it back in.', page: 'assets' }))
  low.forEach((r) => f.push({ tone: 'info', title: `${r.s.id} tracker battery ${Math.round(r.st.battery)}%`, body: 'Swap the battery within two days to avoid a tracking gap.', page: 'assets' }))
  if (!f.length) f.push({ tone: 'good', title: 'All assets accounted for', body: 'Every device is inside its permitted site and reporting.' })
  const inTransit = rows.filter((r) => r.st.mode === 'in_transit').length
  return { id: 'assets', title: 'Community assets', page: 'assets',
    tiles: [{ label: 'Value tracked', value: `£${val.toLocaleString('en-GB')}`, sub: `${rows.length} devices` }, { label: 'Value at risk', value: `£${risk.toLocaleString('en-GB')}`, tone: risk ? 'bad' : 'good', sub: `${off.length} off-site · ${stale.length} silent` }, { label: 'In transit now', value: String(inTransit), sub: 'riding on a courier tracker' }],
    findings: f, barsTitle: 'Battery level by device', bars: rows.map((r) => ({ label: r.s.id, v: Math.round(r.st.battery), color: r.st.battery < 20 ? '#e11d48' : '#6e5cef' })) }
}

const slip = (c: Consignment) => { const l = getWorld().legs.find((x) => x.id === c.legId); return l ? l.arrive - l.planArrive : 0 }
export function shipments(t: number, role: Role): Section {
  const w = getWorld(); const list = consFor(role).filter((c) => c.legId); const started = list.filter((c) => w.legs.find((l) => l.id === c.legId)!.depart <= t)
  const fin = started.filter((c) => w.legs.find((l) => l.id === c.legId)!.arrive <= t); const late = fin.filter((c) => slip(c) > 8)
  const exc = started.filter((c) => c.verdict === 'diverted' && t >= 760)
  const live = started.filter((c) => w.legs.find((l) => l.id === c.legId)!.arrive > t && !(c.verdict === 'diverted' && t >= 760))
  const by: Record<string, { n: number; bad: number }> = {}; started.forEach((c) => { const k = c.carrier; by[k] ??= { n: 0, bad: 0 }; by[k].n++; if (exc.includes(c) || slip(c) > 8) by[k].bad++ })
  const f: Finding[] = []
  exc.forEach((c) => f.push({ tone: 'bad', title: `${c.ref} never reached ${SITES[c.to].short}`, body: `Carrier ${c.carrier}. Open the exception, freeze payment and ask the haulier for gate logs.`, page: 'shipments' }))
  live.forEach((c) => { const v = VEH_BY_ID[c.veh]; f.push({ tone: slip(c) > 8 ? 'warn' : 'info', title: `${c.ref} · ${v.reg} on its way`, body: `${SITES[c.from].short} → ${SITES[c.to].short}, ${slip(c) >= 0 ? '+' : ''}${Math.round(slip(c))} min vs plan.`, page: 'shipments' }) })
  if (late.length) f.push({ tone: 'warn', title: late.length > 1 ? `${late.length} deliveries arrived late` : '1 delivery arrived late', body: 'Late deliveries are listed under Shipments with the minutes lost.', page: 'shipments' })
  if (!f.length) f.push({ tone: 'good', title: 'No shipments in flight', body: 'Everything dispatched has been delivered.' })
  return { id: 'shipments', title: 'Shipments', page: 'shipments',
    tiles: [{ label: 'On-time rate', value: fin.length ? `${pct(fin.length - late.length, fin.length)}%` : '–', tone: late.length ? 'warn' : 'good', sub: `${fin.length} delivered` }, { label: 'In transit', value: String(live.length), sub: 'live tracking' }, { label: 'Exceptions', value: String(exc.length), tone: exc.length ? 'bad' : 'good', sub: 'need action' }],
    findings: f, barsTitle: 'Loads by carrier', bars: Object.entries(by).map(([label, c]) => ({ label, v: c.n, color: c.bad ? '#f59e0b' : '#6e5cef' })) }
}

export function recycling(t: number, role: Role): Section {
  const w = getWorld(); const list = consFor(role).filter((c) => c.kind === 'recycling'); const st = list.map((c) => { const ch = w.custody[c.ref].filter((e) => e.t <= t); return { c, broken: ch.some((e) => !e.ok), done: ch.length === w.custody[c.ref].length && !ch.some((e) => !e.ok) } })
  const ok = st.filter((x) => x.done), bad = st.filter((x) => x.broken)
  const kgOk = ok.reduce((a, x) => a + x.c.kg, 0), kgBad = bad.reduce((a, x) => a + x.c.kg, 0)
  const f: Finding[] = []
  bad.forEach((x) => f.push({ tone: 'bad', title: `${x.c.ref}: ${x.c.kg} kg not proven recycled`, body: `Carrier ${x.c.carrier}. The truck entered a port geofence instead of the recycler. Treat this carrier as high risk until audited.`, page: 'provenance' }))
  ok.forEach((x) => f.push({ tone: 'good', title: `${x.c.ref}: ${x.c.kg} kg proven recycled`, body: 'Tracker, weighbridge RFID and certificate all agree.', page: 'provenance' }))
  const wait = st.filter((x) => !x.done && !x.broken); if (wait.length) f.push({ tone: 'info', title: `${wait.length} load${wait.length > 1 ? 's' : ''} still on the road`, body: 'Proof is assembled automatically when the weighbridge reads the tags.' })
  const by: Record<string, { ok: number; all: number }> = {}; st.forEach((x) => { by[x.c.carrier] ??= { ok: 0, all: 0 }; by[x.c.carrier].all++; if (x.done) by[x.c.carrier].ok++ })
  return { id: 'recycling', title: 'Recycling proof', page: 'provenance',
    tiles: [{ label: 'Proven recycled', value: `${kgOk} kg`, tone: 'good', sub: `${ok.length} load${ok.length === 1 ? '' : 's'}` }, { label: 'Not proven', value: `${kgBad} kg`, tone: kgBad ? 'bad' : 'good', sub: `${bad.length} broken chain${bad.length === 1 ? '' : 's'}` }, { label: 'CO₂e credit secured', value: `${Math.round(kgOk * 1.5)} kg`, sub: 'fibre-to-fibre, ISO 14040' }],
    findings: f, barsTitle: 'Proof rate by carrier', bars: Object.entries(by).map(([label, c]) => ({ label, v: Math.round((c.ok / c.all) * 100), color: c.ok === c.all ? '#6e5cef' : '#e11d48' })) }
}
