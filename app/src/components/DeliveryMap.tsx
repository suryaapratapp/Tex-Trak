import { useEffect, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Maximize2, Radar } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ZoomHint } from './ZoomHint'
import { FullMapDialog } from './FullMapDialog'

interface Site { name: string; lat: number; lng: number; radius: number }
interface Live { tracked: boolean; live?: boolean; done?: boolean; reason?: string; status: string; arrived_at?: string | null; name?: string; last?: { lat: number; lng: number; ts: string; speed: number | null } | null; trail?: [number, number, string][]; manual?: [number, number, string, string][]; from?: Site | null; to?: Site | null }

function Fit({ pts }: { pts: [number, number][] }) {
  const map = useMap()
  useEffect(() => { if (pts.length) { map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [40, 60], paddingBottomRight: [40, 28], maxZoom: 16 }); setTimeout(() => map.invalidateSize(), 80) } }, [JSON.stringify(pts)]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 2 ? 'just now' : m < 90 ? `${m} minutes ago` : `${Math.round(m / 60)} hours ago` }

/** Live position of one delivery on a map, refreshed every 15 seconds, with the From and To areas drawn. */
export function DeliveryMap({ id, status, height = 280, token }: { id: string; status: string; height?: number; token?: string }) {
  const [d, setD] = useState<Live | null>(null); const [err, setErr] = useState(''); const [full, setFull] = useState(false)
  useEffect(() => {
    let off = false; const run = async () => { const { data, error } = token ? await supabase.rpc('public_shipment_live', { p_token: token }) : await supabase.rpc('shipment_live', { p_id: id }); if (off) return; if (error) setErr(error.message); else { setD(data as Live); setErr('') } }
    void run(); const t = setInterval(() => void run(), 15000); return () => { off = true; clearInterval(t) }
  }, [id, status])
  if (err) return <p className="mt-4 rounded-xl bg-stone-50 p-3 text-[14px] text-stone-500">Live tracking is not available right now.</p>
  if (!d) return <div className="mt-4 h-24 animate-pulse rounded-2xl bg-stone-100" />
  if (!d.tracked || !d.live) return <p className="mt-4 flex items-center gap-2 rounded-xl bg-stone-50 p-3 text-[14px] text-stone-500"><Radar size={16} className="shrink-0" />{d.reason ?? 'Live tracking is not available.'}</p>
  const manual = (d.manual ?? []).map((p) => ({ pos: [p[0], p[1]] as [number, number], ts: p[2], by: p[3] })); const last = d.last; const trail = (d.trail ?? []).map((p) => [p[0], p[1]] as [number, number])
  const pts: [number, number][] = [...trail, ...manual.map((m) => m.pos), ...(last ? [[last.lat, last.lng] as [number, number]] : []), ...(d.from ? [[d.from.lat, d.from.lng] as [number, number]] : []), ...(d.to ? [[d.to.lat, d.to.lng] as [number, number]] : [])]
  const state = d.done ? 'Delivered' : d.arrived_at ? 'Arrived' : last ? `Updated ${ago(last.ts)}${last.speed ? ` · ${Math.round(last.speed)} km/h` : ''}` : 'Waiting for its first position'
  const layers = (<>
    {d.from && <><Circle center={[d.from.lat, d.from.lng]} radius={d.from.radius} pathOptions={{ color: '#64748b', weight: 1.5, fillOpacity: 0.08 }} /><CircleMarker center={[d.from.lat, d.from.lng]} radius={6} pathOptions={{ color: '#475569', fillColor: '#94a3b8', fillOpacity: 1 }}><Tooltip permanent direction="top" offset={[0, -6]}>From: {d.from.name}</Tooltip></CircleMarker></>}
    {d.to && <><Circle center={[d.to.lat, d.to.lng]} radius={d.to.radius} pathOptions={{ color: '#059669', weight: 1.5, fillOpacity: 0.12 }} /><CircleMarker center={[d.to.lat, d.to.lng]} radius={6} pathOptions={{ color: '#047857', fillColor: '#10b981', fillOpacity: 1 }}><Tooltip permanent direction="top" offset={[0, -6]}>To: {d.to.name}</Tooltip></CircleMarker></>}
    {trail.length > 1 && <Polyline positions={trail} pathOptions={{ color: '#6759e4', weight: 4, opacity: 0.7 }} />}
    {manual.length > 1 && <Polyline positions={manual.map((m) => m.pos)} pathOptions={{ color: '#d97706', weight: 3, opacity: 0.9, dashArray: '8 8' }} />}
    {manual.map((m, i) => <CircleMarker key={i} center={m.pos} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#d97706', fillOpacity: 1 }}><Tooltip direction="top" offset={[0, -8]}>Entered manually · {new Date(m.ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{m.by ? ` · by ${m.by}` : ''}</Tooltip></CircleMarker>)}
    {last && <CircleMarker center={[last.lat, last.lng]} radius={10} pathOptions={{ color: '#fff', weight: 3, fillColor: '#6759e4', fillOpacity: 1 }}><Tooltip direction="top" offset={[0, -10]}>{d.done ? 'Last position' : (d.name ?? 'Delivery')}</Tooltip></CircleMarker>}
  </>)
  return (
    <div className="mt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-stone-600"><Radar size={14} /> {d.done ? 'Route followed' : 'Live tracking'}</h3>
        <span className="text-[13px] font-semibold text-stone-700">{state}</span></div>
      <div className="overflow-hidden rounded-2xl border border-stone-200" style={{ height }}>
        <MapContainer center={pts[0] ?? [51.5, -0.1]} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer attribution="&copy; OpenStreetMap" url={import.meta.env.VITE_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} />
          <ZoomHint /><Fit pts={pts} />
          {layers}
        </MapContainer></div>
      <button type="button" onClick={() => setFull(true)} aria-haspopup="dialog" className="mt-2 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-cyan-300 bg-white px-5 text-[17px] font-bold text-cyan-900 hover:bg-cyan-50 sm:ml-auto sm:w-auto"><Maximize2 size={19} />Open full map</button>
      {full && <FullMapDialog title={d.done ? 'Route followed' : 'Delivery map'} subtitle={state} pts={pts} focus={last ? [last.lat, last.lng] : null} focusLabel={d.done || d.arrived_at ? 'Last position' : 'Where it is now'} fromName={d.from?.name} toName={d.to?.name} manualCount={manual.length} onClose={() => setFull(false)}>{layers}</FullMapDialog>}
      {manual.length > 0 && <p className="mt-2 flex items-center gap-2 text-[12.5px] font-semibold text-amber-700"><i className="inline-block h-0 w-6 border-t-[3px] border-dashed border-amber-600" />Orange dashed route: {manual.length} point{manual.length === 1 ? '' : 's'} entered manually, not reported by the tracker.</p>}
      {(d.from || d.to) && <dl className="mt-2 space-y-1 text-[12.5px] text-stone-500">{([['From', d.from], ['To', d.to]] as const).map(([k, p]) => <div key={k} className="flex flex-wrap gap-x-1.5"><dt className="font-bold text-stone-600">{k}:</dt><dd>{p ? <>{p.name} <span className="mono">({p.lat.toFixed(6)}, {p.lng.toFixed(6)})</span></> : 'not a marked site, so it is not drawn'}</dd></div>)}</dl>}
      {!d.from && !d.to && <p className="mt-2 text-[12.5px] text-stone-400">The From and To places are not marked sites, so they are not drawn.</p>}
    </div>)
}
