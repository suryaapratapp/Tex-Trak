import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ChevronLeft, ChevronRight, Download, Smartphone, Truck } from 'lucide-react'
import { Card, CardHead } from '../components/ui'
import { ClickToActivate } from '../components/FleetMapView'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ago, ageMin, trackerHealth, volts } from '../lib/status'
import { useStore } from '../store'

interface Dev { imei: string; name: string; kind: 'tracker' | 'phone'; model: string; org_id: string | null; active: boolean; battery_pct: number | null; last_seen: string | null }
interface Latest { imei: string; seen_at: string | null; fix_valid: boolean | null; satellites: number | null; battery_mv: number | null; gsm_signal: number | null; lat: number | null; lng: number | null; fix_ts: string | null; speed_kmh: number | null }
type Day = { count: number; distance_m: number; moving_s: number; first_ts: string | null; last_ts: string | null; max_speed_kmh: number; points: [string, number, number, number][] }
const colour = (age: number) => (age < 10 ? '#16a34a' : age < 60 ? '#e0a030' : '#94a3b8')
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const startOf = (key: string) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d) }
const hm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '–')
const dur = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.round(s / 60)} min`)
const HISTORY_DAYS = 30
const COLORS = ['#6759e4', '#0e8f7e', '#e0a030', '#e5586b', '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316']
const icon = (name: string, c: string, phone: boolean, sel: boolean) => L.divIcon({ className: '', iconSize: [0, 0], html: `<div style="transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center"><div style="width:${sel ? 40 : 32}px;height:${sel ? 40 : 32}px;border-radius:50%;background:${c};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:grid;place-items:center;color:#fff;font:600 ${phone ? 14 : 13}px Inter,sans-serif">${phone ? '●' : '▲'}</div><span style="margin-top:3px;background:#1c2236;color:#fff;font:500 10.5px Inter,sans-serif;padding:1px 7px;border-radius:5px;white-space:nowrap">${name}</span></div>` })

function Fit({ pts, sel }: { pts: [number, number][]; sel: [number, number] | null }) {
  const map = useMap()
  useEffect(() => { setTimeout(() => map.invalidateSize(), 50) }, [map])
  useEffect(() => { if (sel) map.setView(sel, Math.max(map.getZoom(), 14)) }, [sel?.[0], sel?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!sel && pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 15 }) }, [pts.length]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function LiveDevices() {
  const role = useStore((s) => s.role); const orgs = useAuth((s) => s.orgs); const focus = useStore((s) => s.focusDevice)
  const [devs, setDevs] = useState<Dev[]>([]); const [latest, setLatest] = useState<Record<string, Latest>>({}); const [sel, setSel] = useState<string | null>(focus); const [loaded, setLoaded] = useState(false)
  const today = dayKey(new Date()); const [day, setDay] = useState(today); const [data, setData] = useState<Day | null>(null); const [dayBusy, setDayBusy] = useState(false); const [dayErr, setDayErr] = useState('')
  useEffect(() => { if (focus) useStore.getState().set({ focusDevice: null }) }, [focus])
  const oldest = dayKey(new Date(Date.now() - (HISTORY_DAYS - 1) * 86400e3))

  const load = useCallback(async () => {
    const [d, l] = await Promise.all([supabase.from('trackers').select('imei,name,kind,model,org_id,active,battery_pct,last_seen').order('name'), supabase.rpc('device_latest')])
    setDevs(((d.data ?? []) as Dev[]).filter((x) => x.active && (role === 'superadmin' || x.org_id === role)))
    setLatest(Object.fromEntries(((l.data ?? []) as Latest[]).map((x) => [x.imei, x]))); setLoaded(true)
  }, [role])
  useEffect(() => { void load(); const id = setInterval(() => void load(), 10000); return () => clearInterval(id) }, [load])

  const loadDay = useCallback(async () => {
    if (!sel) { setData(null); return }
    setDayBusy(true); const from = startOf(day); const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)
    const { data: r, error } = await supabase.rpc('tracker_day', { p_imei: sel, p_from: from.toISOString(), p_to: to.toISOString() })
    setDayBusy(false); if (error) { setDayErr(error.message); setData(null) } else { setDayErr(''); setData(r as Day) }
  }, [sel, day])
  useEffect(() => { void loadDay(); if (day !== today) return; const id = setInterval(() => void loadDay(), 30000); return () => clearInterval(id) }, [loadDay, day, today])

  const rows = devs.map((d, i) => { const l = latest[d.imei]; const hasPos = !!l && l.lat != null && l.lng != null; return { d, l, hasPos, c: COLORS[i % COLORS.length], age: ageMin(l?.fix_ts) } })
  const placed = rows.filter((r) => r.hasPos); const all = placed.map((r) => [r.l!.lat!, r.l!.lng!] as [number, number])
  const cur = rows.find((r) => r.d.imei === sel); const trail = (data?.points ?? []).map((p) => [p[1], p[2]] as [number, number])
  const selPos: [number, number] | null = trail.length ? trail[trail.length - 1] : cur?.hasPos ? [cur.l!.lat!, cur.l!.lng!] : null
  const shift = (n: number) => { const x = startOf(day); x.setDate(x.getDate() + n); const k = dayKey(x); if (k >= oldest && k <= today) setDay(k) }
  const exportCsv = () => { if (!data) return; const name = (cur?.d.name || sel || 'device').replace(/[^\w-]+/g, '_'); const csv = 'time,latitude,longitude,speed_kmh\n' + data.points.map((p) => `${p[0]},${p[1]},${p[2]},${Math.round(p[3])}`).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `${name}-${day}.csv`; a.click(); URL.revokeObjectURL(a.href) }
  const pick = (imei: string) => { setSel(sel === imei ? null : imei); setDay(today) }
  const startIcon = L.divIcon({ className: '', iconSize: [14, 14], iconAnchor: [7, 7], html: '<div style="width:14px;height:14px;border-radius:50%;background:#16a34a;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>' })
  const endIcon = L.divIcon({ className: '', iconSize: [14, 14], iconAnchor: [7, 7], html: '<div style="width:14px;height:14px;border-radius:3px;background:#e5586b;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>' })
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Card className="overflow-hidden"><div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-5 py-3"><span className="text-[15px] font-semibold text-stone-900">{cur ? `${cur.d.name || cur.d.imei}: route for ${startOf(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Where everyone is'}</span>
          {cur && <button onClick={() => setSel(null)} className="ml-auto rounded-full border border-stone-200 px-3 py-1.5 text-[13px] font-semibold text-stone-600 hover:bg-stone-50">Show everyone</button>}</div>
          <MapContainer center={[54.5, -3]} zoom={6} style={{ height: 560, width: '100%' }} scrollWheelZoom={false}>
            <TileLayer attribution="&copy; OpenStreetMap contributors" url={import.meta.env.VITE_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} /><ClickToActivate /><Fit pts={sel ? trail : all} sel={sel && !trail.length ? selPos : null} key={sel ?? 'all'} />
            {sel && trail.length > 1 && <Polyline positions={trail} pathOptions={{ color: cur?.c ?? '#6759e4', weight: 5, opacity: 0.85 }} />}
            {sel && trail.length > 0 && <Marker position={trail[0]} icon={startIcon} zIndexOffset={900}><Tooltip direction="top">Start · {hm(data!.first_ts)}</Tooltip></Marker>}
            {sel && trail.length > 1 && <Marker position={trail[trail.length - 1]} icon={endIcon} zIndexOffset={900}><Tooltip direction="top">End · {hm(data!.last_ts)}</Tooltip></Marker>}
            {(sel ? placed.filter((r) => r.d.imei === sel && day === today) : placed).map((r) => <Marker key={r.d.imei} position={[r.l!.lat!, r.l!.lng!]} icon={icon(r.d.name || r.d.imei, colour(r.age), r.d.kind === 'phone', sel === r.d.imei)} eventHandlers={{ click: () => pick(r.d.imei) }} zIndexOffset={sel === r.d.imei ? 1000 : 0}><Tooltip direction="top" offset={[0, -18]}>{r.d.name || r.d.imei} · {ago(r.l!.fix_ts)}</Tooltip></Marker>)}
          </MapContainer></Card>

        {cur && <Card><div className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-5 py-3.5">
          <div className="flex items-center gap-1"><button onClick={() => shift(-1)} disabled={day <= oldest} aria-label="Previous day" className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-30"><ChevronLeft size={18} /></button>
            <input type="date" value={day} min={oldest} max={today} onChange={(e) => e.target.value && e.target.value >= oldest && e.target.value <= today && setDay(e.target.value)} className="h-10 rounded-full border border-stone-200 bg-white px-4 text-[14px] font-semibold text-stone-800 outline-none focus:border-cyan-500" />
            <button onClick={() => shift(1)} disabled={day >= today} aria-label="Next day" className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-30"><ChevronRight size={18} /></button></div>
          <div className="flex gap-1">{[['Today', 0], ['Yesterday', 1], ['2 days ago', 2]].map(([l, n]) => { const x = new Date(); x.setDate(x.getDate() - (n as number)); const k = dayKey(x); return <button key={l as string} onClick={() => setDay(k)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${day === k ? 'bg-cyan-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{l}</button> })}</div>
          <button onClick={exportCsv} disabled={!data?.count} className="ml-auto flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-[13px] font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"><Download size={15} /> Download day (CSV)</button></div>
          {dayErr ? <div className="p-5 text-[14px] font-semibold text-rose-700">Could not load this day: {dayErr}</div> : dayBusy && !data ? <div className="p-6 text-center text-stone-400">Loading route…</div> : !data || data.count === 0 ?
            <div className="p-6 text-center text-[14.5px] text-stone-500">No movement recorded on this day.{cur.d.kind === 'tracker' && !cur.hasPos ? ' This tracker has not had a GPS fix yet. Take it outside with open sky.' : ''}</div> :
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">{[['Distance', `${(data.distance_m / 1000).toFixed(1)} km`], ['Moving for', dur(data.moving_s)], ['First and last point', `${hm(data.first_ts)} to ${hm(data.last_ts)}`], ['Top speed', `${Math.round(data.max_speed_kmh)} km/h`]].map(([l, v]) => <div key={l} className="rounded-2xl bg-stone-50 p-3.5"><div className="text-[12px] font-semibold uppercase tracking-wider text-stone-400">{l}</div><div className="mt-1 text-[19px] font-semibold text-stone-900">{v}</div></div>)}</div>}
          <div className="border-t border-stone-100 px-5 py-3 text-[12.5px] text-stone-400">Full detail is kept for {HISTORY_DAYS} days. After that only the coordinates (time, latitude, longitude) are kept. {data && data.count > 0 ? `${data.count.toLocaleString('en-GB')} points this day${data.points.length < data.count ? `, map shows ${data.points.length}` : ''}.` : ''}</div></Card>}
      </div>

      <Card><CardHead title="People and vehicles" sub={`${rows.length} active · ${placed.length} with a position. Click one to see its route.`} />
        <ul className="divide-y divide-stone-100">{!loaded && <li className="p-6 text-center text-stone-400">Loading…</li>}{loaded && rows.length === 0 && <li className="p-8 text-center text-[14px] text-stone-500">No devices yet. A phone appears here the moment someone signs in on the Android app. Trackers are added under Super Admin.</li>}
          {rows.map((r) => { const h = trackerHealth(r.d.kind, r.d.last_seen); return (
            <li key={r.d.imei}><button onClick={() => pick(r.d.imei)} className={`flex w-full items-center gap-3 px-5 py-3.5 text-left ${sel === r.d.imei ? 'bg-cyan-50' : 'hover:bg-stone-50'}`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white" style={{ background: r.c }}>{r.d.kind === 'phone' ? <Smartphone size={16} /> : <Truck size={16} />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-medium text-stone-900">{r.d.name || r.d.imei}{role === 'superadmin' && r.d.org_id ? <span className="font-normal text-stone-400"> · {orgs.find((o) => o.id === r.d.org_id)?.name}</span> : null}</span>
                <span className="block truncate text-[12.5px] text-stone-500">{r.hasPos ? `Position ${ago(r.l!.fix_ts)}${r.l!.speed_kmh ? ` · ${Math.round(r.l!.speed_kmh)} km/h` : ''}` : r.d.last_seen ? `Heard ${ago(r.d.last_seen)}, waiting for a GPS fix` : 'Never heard from'}</span></span>
              <span className="flex flex-col items-end text-[12px] text-stone-400"><i className="mb-1 h-2.5 w-2.5 rounded-full" style={{ background: h === 'online' ? '#16a34a' : h === 'offline' ? '#e5586b' : '#94a3b8' }} />{r.d.kind === 'phone' ? (r.d.battery_pct != null ? `${r.d.battery_pct}%` : '') : volts(r.l?.battery_mv)}</span></button></li>) })}</ul></Card>
    </div>)
}
