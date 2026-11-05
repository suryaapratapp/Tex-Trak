import { useEffect } from 'react'
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { getWorld, vehicleAt } from '../sim/engine'
import { SITES, VEH_BY_ID } from '../sim/world'
import { useStore } from '../store'

const pin = (label: string, color: string) => L.divIcon({ className: '', iconSize: [0, 0], html: `<div style="transform:translate(-50%,-100%);background:${color};color:#fff;font:700 11px 'Plus Jakarta Sans',sans-serif;padding:3px 9px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3)">${label}</div>` })
const truck = (reg: string, color: string, onboard: boolean) => L.divIcon({ className: '', iconSize: [0, 0], html: `<div style="transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center"><div style="width:34px;height:34px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.4);display:grid;place-items:center;color:#fff;font-size:16px">🚚</div><span style="margin-top:4px;background:#1c1917;color:#fff;font:700 10px 'Plus Jakarta Sans',sans-serif;padding:2px 7px;border-radius:6px;white-space:nowrap">${reg}${onboard ? ' · item onboard' : ''}</span></div>` })
function Fit({ pts }: { pts: [number, number][] }) {
  const map = useMap()
  useEffect(() => { map.fitBounds(L.latLngBounds(pts), { padding: [36, 36] }); setTimeout(() => map.invalidateSize(), 60) }, [pts])
  return null
}

/** Map of ONE trip (a leg): full route, the part already driven, and the truck now. */
export function LegMap({ legId, height = 340, itemOnboardFrom, itemOnboardTo }: { legId: string; height?: number; itemOnboardFrom?: number; itemOnboardTo?: number }) {
  const t = useStore((s) => s.t); const w = getWorld()
  const leg = w.legs.find((l) => l.id === legId)!; const v = VEH_BY_ID[leg.veh]
  const st = vehicleAt(w.legs, leg.veh, Math.min(Math.max(t, leg.depart), leg.arrive - 0.01))
  const started = t >= leg.depart, finished = t >= leg.arrive
  const dIdx = leg.cum.findIndex((c) => c > leg.meters * (finished ? 1 : started ? st.progress : 0))
  const done = started ? [...leg.pts.slice(0, Math.max(1, dIdx < 0 ? leg.pts.length : dIdx)), st.pos] : []
  const pos = finished ? leg.pts[leg.pts.length - 1] : started ? st.pos : leg.pts[0]
  const onboard = itemOnboardFrom !== undefined && t >= itemOnboardFrom && (itemOnboardTo === undefined || t <= itemOnboardTo)
  const from = SITES[leg.from], to = SITES[leg.to]
  return (
    <MapContainer center={from.pos} zoom={11} style={{ height, width: '100%' }} scrollWheelZoom={false}>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url={import.meta.env.VITE_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} />
      <Fit pts={leg.pts as [number, number][]} />
      <Polyline positions={leg.pts} pathOptions={{ color: '#a8a29e', weight: 5, opacity: 0.8, dashArray: '2 9' }} />
      <Polyline positions={done} pathOptions={{ color: v.color, weight: 6 }} />
      <Circle center={from.pos} radius={from.radius} pathOptions={{ color: '#57534e', weight: 1, fillOpacity: 0.08 }} />
      <Circle center={to.pos} radius={to.radius} pathOptions={{ color: '#57534e', weight: 1, fillOpacity: 0.08 }} />
      <Marker position={from.pos} icon={pin(`START · ${from.short}`, '#57534e')} interactive={false} />
      <Marker position={to.pos} icon={pin(`END · ${to.short}`, '#1c1917')} interactive={false} />
      <Marker position={pos} icon={truck(v.reg, v.color, onboard)} zIndexOffset={900} />
    </MapContainer>
  )
}
