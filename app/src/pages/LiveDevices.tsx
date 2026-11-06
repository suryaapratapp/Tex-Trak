import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Smartphone, Truck } from 'lucide-react'
import { Card, CardHead } from '../components/ui'
import { ClickToActivate } from '../components/FleetMapView'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ago } from '../lib/liveData'
import { useStore } from '../store'

interface Dev { imei: string; name: string; kind: 'tracker' | 'phone'; model: string; org_id: string | null; active: boolean; battery_pct: number | null; last_seen: string | null }
interface Pos { imei: string; ts: string; lat: number; lng: number; speed_kmh: number | null; heading: number | null }
const RANGES: [string, number][] = [['Last hour', 1], ['Today', 16], ['24 hours', 24], ['3 days', 72]]
const colour = (age: number) => (age < 10 ? '#16a34a' : age < 60 ? '#e0a030' : '#94a3b8')
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
  const role = useStore((s) => s.role); const orgs = useAuth((s) => s.orgs)
  const [devs, setDevs] = useState<Dev[]>([]); const [pos, setPos] = useState<Pos[]>([]); const [hours, setHours] = useState(16); const [sel, setSel] = useState<string | null>(null); const [loaded, setLoaded] = useState(false)
  const load = useCallback(async () => {
    const since = new Date(Date.now() - hours * 3600e3).toISOString()
    const [d, p] = await Promise.all([supabase.from('trackers').select('imei,name,kind,model,org_id,active,battery_pct,last_seen').order('name'), supabase.from('tracker_positions').select('imei,ts,lat,lng,speed_kmh,heading').gte('ts', since).order('ts', { ascending: true }).limit(8000)])
    setDevs(((d.data ?? []) as Dev[]).filter((x) => x.active && (role === 'superadmin' || x.org_id === role))); setPos((p.data ?? []) as Pos[]); setLoaded(true)
  }, [hours, role])
  useEffect(() => { void load(); const id = setInterval(() => void load(), 10000); return () => clearInterval(id) }, [load])
  const trails = useMemo(() => { const m: Record<string, Pos[]> = {}; for (const x of pos) (m[x.imei] ??= []).push(x); return m }, [pos])
  const rows = devs.map((d, i) => { const t = trails[d.imei] ?? []; const last = t[t.length - 1]; return { d, last, trail: t, c: COLORS[i % COLORS.length], age: last ? (Date.now() - new Date(last.ts).getTime()) / 60000 : Infinity } })
  const placed = rows.filter((r) => r.last); const all = placed.map((r) => [r.last.lat, r.last.lng] as [number, number])
  const cur = rows.find((r) => r.d.imei === sel); const selPos = cur?.last ? ([cur.last.lat, cur.last.lng] as [number, number]) : null
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
      <Card className="overflow-hidden"><div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-5 py-3"><span className="text-[15px] font-semibold text-stone-900">Where everyone is</span>
        <div className="ml-auto flex rounded-lg bg-stone-100 p-0.5">{RANGES.map(([l, h]) => <button key={l} onClick={() => setHours(h)} className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${hours === h ? 'bg-white shadow-sm' : 'text-stone-500'}`}>{l}</button>)}</div></div>
        <MapContainer center={[54.5, -3]} zoom={6} style={{ height: 620, width: '100%' }} scrollWheelZoom={false}>
          <TileLayer attribution="&copy; OpenStreetMap contributors" url={import.meta.env.VITE_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} /><ClickToActivate /><Fit pts={all} sel={selPos} />
          {rows.map((r) => r.trail.length > 1 && <Polyline key={r.d.imei} positions={r.trail.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: r.c, weight: sel === r.d.imei ? 5 : 3, opacity: sel && sel !== r.d.imei ? 0.25 : 0.8 }} />)}
          {placed.map((r) => <Marker key={r.d.imei} position={[r.last.lat, r.last.lng]} icon={icon(r.d.name || r.d.imei, colour(r.age), r.d.kind === 'phone', sel === r.d.imei)} eventHandlers={{ click: () => setSel(r.d.imei) }} zIndexOffset={sel === r.d.imei ? 1000 : 0}><Tooltip direction="top" offset={[0, -18]}>{r.d.name} · {ago(r.last.ts)}</Tooltip></Marker>)}
        </MapContainer></Card>
      <Card><CardHead title="People and vehicles" sub={`${rows.length} registered · ${placed.length} with a position`} />
        <ul className="divide-y divide-stone-100">{!loaded && <li className="p-6 text-center text-stone-400">Loading…</li>}{loaded && rows.length === 0 && <li className="p-8 text-center text-[14px] text-stone-500">No devices yet. A phone appears here the moment someone signs in on the Android app. Trackers are added under Super Admin.</li>}
          {rows.map((r) => (
            <li key={r.d.imei}><button onClick={() => setSel(sel === r.d.imei ? null : r.d.imei)} className={`flex w-full items-center gap-3 px-5 py-3.5 text-left ${sel === r.d.imei ? 'bg-cyan-50' : 'hover:bg-stone-50'}`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white" style={{ background: r.c }}>{r.d.kind === 'phone' ? <Smartphone size={16} /> : <Truck size={16} />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-medium text-stone-900">{r.d.name || r.d.imei}{role === 'superadmin' && r.d.org_id ? <span className="font-normal text-stone-400"> · {orgs.find((o) => o.id === r.d.org_id)?.name}</span> : null}</span><span className="block truncate text-[12.5px] text-stone-500">{r.last ? `${ago(r.last.ts)}${r.last.speed_kmh ? ` · ${Math.round(r.last.speed_kmh)} km/h` : ''}` : r.d.last_seen ? `Seen ${ago(r.d.last_seen)}, no position in this period` : 'Never seen'}</span></span>
              <span className="flex flex-col items-end text-[12px] text-stone-400"><i className="mb-1 h-2.5 w-2.5 rounded-full" style={{ background: colour(r.age) }} />{r.d.battery_pct != null ? `${r.d.battery_pct}%` : ''}</span></button></li>))}</ul></Card>
    </div>)
}
