import { ZoomHint } from '../components/ZoomHint'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ChevronLeft, ChevronRight, Download, Laptop, Radio, Smartphone, Truck, UserRound } from 'lucide-react'
import { Card, CardHead } from '../components/ui'
import { ClickToActivate } from '../components/FleetMapView'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ago, ageMin, describeDevice, volts, type DeviceNote } from '../lib/status'
import { useStore } from '../store'
import { useInfra } from '../lib/infra'
import { KIND_COLOR, KIND_GLYPH, KIND_LABEL } from '../sim/registry'
import { ukAddDays, ukDayKey, ukStartOf } from '../lib/tz'

interface Dev { imei: string; name: string; kind: 'tracker' | 'phone'; model: string; org_id: string | null; active: boolean; battery_pct: number | null; last_seen: string | null }
interface Latest { imei: string; seen_at: string | null; fix_valid: boolean | null; satellites: number | null; battery_mv: number | null; gsm_signal: number | null; lat: number | null; lng: number | null; fix_ts: string | null; speed_kmh: number | null }
type Day = { count: number; distance_m: number; moving_s: number; first_ts: string | null; last_ts: string | null; max_speed_kmh: number; points: [string, number, number, number][] }
const colour = (age: number) => (age < 10 ? '#16a34a' : age < 60 ? '#e0a030' : '#94a3b8')
const dayKey = (d: Date) => ukDayKey(d)
const startOf = (key: string) => ukStartOf(key)
const hm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '–')
const dur = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.round(s / 60)} min`)
const HISTORY_DAYS = 30
const COLORS = ['#6759e4', '#0e8f7e', '#e0a030', '#e5586b', '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316']
type Cat = 'tracker' | 'vehicle' | 'phone' | 'laptop' | 'person'
const SVG: Record<Cat, string> = {
  tracker: '<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>',
  vehicle: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  laptop: '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
  person: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
}
/** Each kind of thing has its own colour, shape and picture, so they can never be mistaken for one another. */
const CAT: Record<Cat, { label: string; one: string; color: string; radius: string; Icon: typeof Radio; empty: string }> = {
  tracker: { label: 'GNSS trackers', one: 'tracker', color: '#0e8f7e', radius: '50%', Icon: Radio, empty: 'No stand-alone GNSS trackers yet. Trackers are added under Super Admin.' },
  vehicle: { label: 'Vehicles', one: 'vehicle', color: '#6759e4', radius: '9px', Icon: Truck, empty: 'No vehicles yet. Vehicles are added under Super Admin, with the tracker fitted to each.' },
  phone: { label: 'Mobile phones', one: 'phone', color: '#3b82f6', radius: '11px', Icon: Smartphone, empty: 'No phones yet. A phone appears here the moment someone signs in on the Android app.' },
  laptop: { label: 'Laptops and browsers', one: 'laptop', color: '#e0a030', radius: '6px', Icon: Laptop, empty: 'No laptops or browsers yet. One appears when someone allows location in the web app.' },
  person: { label: 'People', one: 'person', color: '#e5586b', radius: '50%', Icon: UserRound, empty: 'No people yet. People appear when they sign in on a phone or browser and allow location.' },
}
const CATS: Cat[] = ['tracker', 'vehicle', 'phone', 'laptop', 'person']
const icon = (name: string, ring: string, cat: Cat, sel: boolean) => { const z = sel ? 42 : 34; const k = CAT[cat]; return L.divIcon({ className: '', iconSize: [0, 0], html: `<div style="transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center"><div style="width:${cat === 'laptop' ? z + 8 : z}px;height:${z}px;border-radius:${k.radius};background:${k.color};border:4px solid ${ring};box-shadow:0 2px 8px rgba(0,0,0,.35);display:grid;place-items:center"><svg width="${Math.round(z * 0.5)}" height="${Math.round(z * 0.5)}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${SVG[cat]}</svg></div><span style="margin-top:3px;background:#1c2236;color:#fff;font:500 10.5px Inter,sans-serif;padding:1px 7px;border-radius:5px;white-space:nowrap">${name.replace(/[<>&"]/g, '')}</span></div>` }) }

const siteIcon = (kind: string) => L.divIcon({ className: '', iconSize: [0, 0], html: `<div style="transform:translate(-50%,-50%);width:26px;height:26px;border-radius:8px;background:${KIND_COLOR[kind] ?? '#6759e4'};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35);display:grid;place-items:center;color:#fff;font-size:14px;line-height:1">${KIND_GLYPH[kind] ?? '●'}</div>` })
function Fit({ pts, sel }: { pts: [number, number][]; sel: [number, number] | null }) {
  const map = useMap()
  useEffect(() => { setTimeout(() => map.invalidateSize(), 50) }, [map])
  useEffect(() => { if (sel) map.setView(sel, Math.max(map.getZoom(), 14)) }, [sel?.[0], sel?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!sel && pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 15 }) }, [pts.length]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function LiveDevices() {
  const role = useStore((s) => s.role); const orgs = useAuth((s) => s.orgs); const focus = useStore((s) => s.focusDevice)
  const infra = useInfra(); useEffect(() => { void infra.load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const sites = useMemo(() => infra.sites.filter((x) => role === 'superadmin' || x.org_id === role || x.org_id === null), [infra.sites, role])
  const [rhythm, setRhythm] = useState<Record<string, number>>({}); const [cat, setCat] = useState<Cat>('tracker'); const [devs, setDevs] = useState<Dev[]>([]); const [latest, setLatest] = useState<Record<string, Latest>>({}); const [sel, setSel] = useState<string | null>(focus); const [loaded, setLoaded] = useState(false)
  const today = dayKey(new Date()); const [day, setDay] = useState(today); const [data, setData] = useState<Day | null>(null); const [dayBusy, setDayBusy] = useState(false); const [dayErr, setDayErr] = useState('')
  useEffect(() => { if (focus) useStore.getState().set({ focusDevice: null }) }, [focus])
  const oldest = dayKey(new Date(Date.now() - (HISTORY_DAYS - 1) * 86400e3))

  const load = useCallback(async () => {
    const [d, l, rh] = await Promise.all([supabase.from('trackers').select('imei,name,kind,model,org_id,active,battery_pct,last_seen').order('name'), supabase.rpc('device_latest'), supabase.rpc('device_rhythm')])
    setRhythm(Object.fromEntries(((rh.data ?? []) as { imei: string; interval_min: string }[]).map((x) => [x.imei, Number(x.interval_min)])))
    setDevs(((d.data ?? []) as Dev[]).filter((x) => x.active && (role === 'superadmin' || x.org_id === role)))
    setLatest(Object.fromEntries(((l.data ?? []) as Latest[]).map((x) => [x.imei, x]))); setLoaded(true)
  }, [role])
  useEffect(() => { void load(); const id = setInterval(() => void load(), 10000); return () => clearInterval(id) }, [load])

  const loadDay = useCallback(async () => {
    if (!sel) { setData(null); return }
    setDayBusy(true); const from = startOf(day); const to = startOf(ukAddDays(day, 1))
    const { data: r, error } = await supabase.rpc('tracker_day', { p_imei: sel, p_from: from.toISOString(), p_to: to.toISOString() })
    setDayBusy(false); if (error) { setDayErr(error.message); setData(null) } else { setDayErr(''); setData(r as Day) }
  }, [sel, day])
  useEffect(() => { void loadDay(); if (day !== today) return; const id = setInterval(() => void loadDay(), 30000); return () => clearInterval(id) }, [loadDay, day, today])

  const vehicles = useMemo(() => infra.vehicles.filter((v) => v.active && (role === 'superadmin' || v.org_id === role || v.org_id === null)), [infra.vehicles, role])
  const people = useAuth((a) => a.people)
  const fitted = useMemo(() => new Map(vehicles.filter((v) => v.tracker_imei).map((v) => [v.tracker_imei as string, v])), [vehicles])
  const catOf = useCallback((d: Dev): Cat => (d.kind === 'phone' ? (/web browser/i.test(d.model ?? '') ? 'laptop' : 'phone') : fitted.has(d.imei) ? 'vehicle' : 'tracker'), [fitted])
  interface Row { key: string; d?: Dev; label: string; sub: string; l?: Latest; hasPos: boolean; c: string; age: number; cat: Cat; note?: DeviceNote }
  const allRows = useMemo(() => {
    const mk = (key: string, d: Dev | undefined, label: string, sub: string, c: Cat, i: number): Row => { const l = d ? latest[d.imei] : undefined; const hasPos = !!l && l.lat != null && l.lng != null; return { key, d, label, sub, l, hasPos, c: COLORS[i % COLORS.length], age: ageMin(l?.fix_ts), cat: c, note: d ? describeDevice({ kind: d.kind, lastSeen: d.last_seen, intervalMin: rhythm[d.imei], fixTs: l?.fix_ts, hasPosition: hasPos }) : undefined } }
    const out: Record<Cat, Row[]> = { tracker: [], vehicle: [], phone: [], laptop: [], person: [] }
    devs.forEach((d, i) => { const c = catOf(d); if (c === 'tracker') out.tracker.push(mk(d.imei, d, d.name || d.imei, d.model || 'GNSS tracker', c, i)); if (c === 'phone' || c === 'laptop') out[c].push(mk(d.imei, d, d.name || d.imei, d.model || (c === 'phone' ? 'Mobile phone' : 'Browser'), c, i)) })
    vehicles.forEach((v, i) => { const d = v.tracker_imei ? devs.find((x) => x.imei === v.tracker_imei) : undefined; out.vehicle.push(mk(v.id, d, v.reg, [v.driver, v.role].filter(Boolean).join(' · ') || (v.tracker_imei ? 'Vehicle tracker' : 'No tracker fitted'), 'vehicle', i)) })
    const by = new Map<string, Dev[]>(); devs.filter((d) => d.kind === 'phone').forEach((d) => by.set((d.name || d.imei).toLowerCase(), [...(by.get((d.name || d.imei).toLowerCase()) ?? []), d]))
    let n = 0; for (const [nm, ds] of by) { const best = [...ds].sort((a, b) => (latest[b.imei]?.fix_ts ?? b.last_seen ?? '').localeCompare(latest[a.imei]?.fix_ts ?? a.last_seen ?? ''))[0]; const who = people.find((p) => p.username.toLowerCase() === nm); out.person.push(mk(`p:${nm}`, best, who?.full_name ?? ds[0].name, ds.length > 1 ? `${ds.length} devices · latest ${catOf(best) === 'laptop' ? 'browser' : 'phone'}` : catOf(best) === 'laptop' ? 'On a browser' : 'On a phone', 'person', n++)) }
    return out
  }, [devs, latest, rhythm, vehicles, people, catOf])
  const rows = allRows[cat]
  useEffect(() => { if (focus) { const d = devs.find((x) => x.imei === focus); if (d) setCat(catOf(d)) } }, [focus, devs.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (sel && !rows.some((r) => r.d?.imei === sel)) setSel(null) }, [cat]) // eslint-disable-line react-hooks/exhaustive-deps
  const placed = rows.filter((r) => r.hasPos); const all = [...placed.map((r) => [r.l!.lat!, r.l!.lng!] as [number, number]), ...sites.map((x) => [x.lat, x.lng] as [number, number])]
  const cur = rows.find((r) => r.d?.imei === sel); const trail = (data?.points ?? []).map((p) => [p[1], p[2]] as [number, number])
  const selPos: [number, number] | null = trail.length ? trail[trail.length - 1] : cur?.hasPos ? [cur.l!.lat!, cur.l!.lng!] : null
  const shift = (n: number) => { const k = ukAddDays(day, n); if (k >= oldest && k <= today) setDay(k) }
  const exportCsv = () => { if (!data) return; const name = (cur?.label || sel || 'device').replace(/[^\w-]+/g, '_'); const csv = 'time,latitude,longitude,speed_kmh\n' + data.points.map((p) => `${p[0]},${p[1]},${p[2]},${Math.round(p[3])}`).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `${name}-${day}.csv`; a.click(); URL.revokeObjectURL(a.href) }
  const pick = (imei: string) => { setSel(sel === imei ? null : imei); setDay(today) }
  const startIcon = L.divIcon({ className: '', iconSize: [14, 14], iconAnchor: [7, 7], html: '<div style="width:14px;height:14px;border-radius:50%;background:#16a34a;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>' })
  const endIcon = L.divIcon({ className: '', iconSize: [14, 14], iconAnchor: [7, 7], html: '<div style="width:14px;height:14px;border-radius:3px;background:#e5586b;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>' })
  return (
    <div>
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="What to show on the map">{CATS.map((k) => { const K = CAT[k]; const n = allRows[k].length; const on = cat === k; return <button key={k} role="tab" aria-selected={on} onClick={() => { setCat(k); setSel(null) }} className={`flex shrink-0 items-center gap-2 rounded-2xl border-2 px-3.5 py-2.5 text-[14px] font-bold transition ${on ? 'bg-white shadow-sm' : 'border-transparent bg-white/60 text-stone-600 hover:bg-white'}`} style={on ? { borderColor: K.color, color: K.color } : undefined}><span className="grid h-7 w-7 place-items-center text-white" style={{ background: K.color, borderRadius: K.radius === '50%' ? '50%' : '8px' }}><K.Icon size={15} /></span>{K.label}<span className="rounded-full bg-stone-100 px-2 text-[12px] font-bold text-stone-500">{n}</span></button> })}</div>
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Card className="overflow-hidden"><div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-5 py-3"><span className="text-[15px] font-semibold text-stone-900">{cur ? `${cur.label}: route for ${startOf(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}` : `${CAT[cat].label} on the map`}</span>
          {cur && <button onClick={() => setSel(null)} className="ml-auto rounded-full border border-stone-200 px-3 py-1.5 text-[13px] font-semibold text-stone-600 hover:bg-stone-50">Show all</button>}</div>
          <MapContainer center={[54.5, -3]} zoom={6} style={{ height: 560, width: '100%' }} scrollWheelZoom={false}>
      <ZoomHint />
            <TileLayer attribution="&copy; OpenStreetMap contributors" url={import.meta.env.VITE_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} /><ClickToActivate /><Fit pts={sel ? trail : all} sel={sel && !trail.length ? selPos : null} key={`${cat}:${sel ?? 'all'}`} />
            {sites.map((x) => <Circle key={`c${x.id}`} center={[x.lat, x.lng]} radius={x.radius_m} pathOptions={{ color: KIND_COLOR[x.kind] ?? '#6759e4', weight: 1.5, fillOpacity: 0.12 }} />)}
            {sites.map((x) => <Marker key={`s${x.id}`} position={[x.lat, x.lng]} icon={siteIcon(x.kind)} zIndexOffset={200}><Tooltip direction="top" offset={[0, -10]}><b>{x.name}</b><br />{KIND_LABEL[x.kind] ?? x.kind}{role === 'superadmin' && x.org_id ? ` · ${orgs.find((o) => o.id === x.org_id)?.name ?? x.org_id}` : ''} · {x.radius_m} m zone</Tooltip></Marker>)}
            {sel && trail.length > 1 && <Polyline positions={trail} pathOptions={{ color: cur?.c ?? '#6759e4', weight: 5, opacity: 0.85 }} />}
            {sel && trail.length > 0 && <Marker position={trail[0]} icon={startIcon} zIndexOffset={900}><Tooltip direction="top">Start · {hm(data!.first_ts)}</Tooltip></Marker>}
            {sel && trail.length > 1 && <Marker position={trail[trail.length - 1]} icon={endIcon} zIndexOffset={900}><Tooltip direction="top">End · {hm(data!.last_ts)}</Tooltip></Marker>}
            {(sel ? placed.filter((r) => r.d?.imei === sel && day === today) : placed).map((r) => <Marker key={r.key} position={[r.l!.lat!, r.l!.lng!]} icon={icon(r.label, r.note ? (r.note.level === 'ok' ? '#16a34a' : r.note.level === 'warn' ? '#e0a030' : '#94a3b8') : colour(r.age), r.cat, sel === r.d?.imei)} eventHandlers={{ click: () => r.d && pick(r.d.imei) }} zIndexOffset={sel === r.d?.imei ? 1000 : 0}><Tooltip direction="top" offset={[0, -18]}>{CAT[r.cat].one}: {r.label} · {r.note && r.note.level !== 'ok' ? `last known place, ${ago(r.l!.fix_ts)}` : ago(r.l!.fix_ts)}</Tooltip></Marker>)}
          </MapContainer></Card>

        {cur && <Card><div className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-5 py-3.5">
          <div className="flex items-center gap-1"><button onClick={() => shift(-1)} disabled={day <= oldest} aria-label="Previous day" className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-30"><ChevronLeft size={18} /></button>
            <input type="date" value={day} min={oldest} max={today} onChange={(e) => e.target.value && e.target.value >= oldest && e.target.value <= today && setDay(e.target.value)} className="h-10 rounded-full border border-stone-200 bg-white px-4 text-[14px] font-semibold text-stone-800 outline-none focus:border-cyan-500" />
            <button onClick={() => shift(1)} disabled={day >= today} aria-label="Next day" className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-30"><ChevronRight size={18} /></button></div>
          <div className="flex gap-1">{[['Today', 0], ['Yesterday', 1], ['2 days ago', 2]].map(([l, n]) => { const k = ukAddDays(today, -(n as number)); return <button key={l as string} onClick={() => setDay(k)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${day === k ? 'bg-cyan-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{l}</button> })}</div>
          <button onClick={exportCsv} disabled={!data?.count} className="ml-auto flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-[13px] font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"><Download size={15} /> Download day (CSV)</button></div>
          {dayErr ? <div className="p-5 text-[14px] font-semibold text-rose-700">Could not load this day: {dayErr}</div> : dayBusy && !data ? <div className="p-6 text-center text-stone-400">Loading route…</div> : !data || data.count === 0 ?
            <div className="p-6 text-center text-[14.5px] text-stone-500">No movement recorded on this day.{(cur.cat === 'tracker' || cur.cat === 'vehicle') && !cur.hasPos ? ' This tracker has not had a GPS fix yet. Take it outside with open sky.' : ''}</div> :
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">{[['Distance', `${(data.distance_m / 1000).toFixed(1)} km`], ['Moving for', dur(data.moving_s)], ['First and last point', `${hm(data.first_ts)} to ${hm(data.last_ts)}`], ['Top speed', `${Math.round(data.max_speed_kmh)} km/h`]].map(([l, v]) => <div key={l} className="rounded-2xl bg-stone-50 p-3.5"><div className="text-[12px] font-semibold uppercase tracking-wider text-stone-400">{l}</div><div className="mt-1 text-[19px] font-semibold text-stone-900">{v}</div></div>)}</div>}
          <div className="border-t border-stone-100 px-5 py-3 text-[12.5px] text-stone-400">Full detail is kept for {HISTORY_DAYS} days. After that only the coordinates (time, latitude, longitude) are kept. {data && data.count > 0 ? `${data.count.toLocaleString('en-GB')} points this day${data.points.length < data.count ? `, map shows ${data.points.length}` : ''}.` : ''}</div></Card>}
      </div>

      <div className="space-y-6"><Card><CardHead title={CAT[cat].label} sub={`${rows.length} ${rows.length === 1 ? 'is' : 'are'} here · ${placed.length} with a position. Click one to see its route.`} />
        <ul className="divide-y divide-stone-100">{!loaded && <li className="space-y-3 p-5" aria-busy="true"><div className="skeleton h-5 w-2/3" /><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-1/2" /></li>}{loaded && rows.length === 0 && <li className="p-8 text-center text-[14px] text-stone-500">{CAT[cat].empty}</li>}
          {rows.map((r) => { const K = CAT[r.cat]; const n = r.note; return (
            <li key={r.key}><button disabled={!r.d} onClick={() => r.d && pick(r.d.imei)} className={`flex w-full items-start gap-3 px-5 py-3.5 text-left ${sel && sel === r.d?.imei ? 'bg-cyan-50' : 'hover:bg-stone-50'} disabled:opacity-60`}>
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center text-white" style={{ background: K.color, borderRadius: K.radius === '50%' ? '50%' : '10px' }}><K.Icon size={17} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-semibold text-stone-900">{r.label}{role === 'superadmin' && r.d?.org_id ? <span className="font-normal text-stone-400"> · {orgs.find((o) => o.id === r.d?.org_id)?.name}</span> : null}</span>
                <span className="block truncate text-[12.5px] text-stone-500">{r.sub}</span>
                {n ? <span className={`mt-0.5 block text-[12.5px] font-semibold ${n.level === 'ok' ? 'text-emerald-700' : n.level === 'warn' ? 'text-amber-700' : 'text-rose-700'}`}>{n.label}: {n.level === 'bad' ? n.connection : n.position}{n.rhythm && n.level !== 'ok' ? ` · ${n.rhythm.toLowerCase()}` : ''}</span> : <span className="mt-0.5 block text-[12.5px] text-stone-400">No tracker fitted, so no position</span>}</span>
              <span className="flex flex-col items-end text-[12px] text-stone-400"><i className="mb-1 mt-1 h-2.5 w-2.5 rounded-full" style={{ background: !n ? '#94a3b8' : n.level === 'ok' ? '#16a34a' : n.level === 'warn' ? '#e0a030' : '#e5586b' }} />{r.d ? (r.d.kind === 'phone' ? (r.d.battery_pct != null ? `${r.d.battery_pct}%` : '') : volts(r.l?.battery_mv)) : ''}</span></button></li>) })}</ul></Card>
        <Card><CardHead title="Sites" sub={sites.length ? `${sites.length} on the map. A vehicle or phone entering a site's zone is how arrivals are recorded.` : 'No sites on the map yet.'} />
          <ul className="divide-y divide-stone-100">{sites.length === 0 && <li className="p-6 text-center text-[14px] text-stone-500">{role === 'superadmin' ? 'Add sites under Super Admin, then Sites.' : 'Your administrator has not added any sites for you yet.'}</li>}
            {sites.map((x) => <li key={x.id}><button onClick={() => setSel(null)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-stone-50"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[15px] text-white" style={{ background: KIND_COLOR[x.kind] ?? '#6759e4' }}>{KIND_GLYPH[x.kind] ?? '●'}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-medium text-stone-900">{x.name}</span><span className="block truncate text-[12.5px] text-stone-500">{KIND_LABEL[x.kind] ?? x.kind} · {x.radius_m} m zone{role === 'superadmin' && x.org_id ? ` · ${orgs.find((o) => o.id === x.org_id)?.name ?? x.org_id}` : ''}</span></span></button></li>)}</ul></Card></div>
    </div></div>)
}
