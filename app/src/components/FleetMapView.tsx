import { useEffect, useMemo } from 'react'
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { getWorld, scannerAt, SCANNERS } from '../sim/engine'
import { ROUTES, SITES, VEH_BY_ID } from '../sim/world'
import { useSnap } from '../sim/snap'
import { useStore } from '../store'
import type { LL } from '../lib/geo'

const vehIcon = (color: string, heading: number, reg: string, selected: boolean, dark: boolean) => L.divIcon({
  className: 'veh-icon', iconSize: [0, 0],
  html: `<div style="position:relative;transform:translate(-50%,-50%)"><div style="width:${selected ? 38 : 32}px;height:${selected ? 38 : 32}px;border-radius:50%;background:${dark ? '#94a3b8' : color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:grid;place-items:center;${selected ? `outline:3px solid ${color}55;` : ''}"><svg width="16" height="16" viewBox="0 0 24 24" style="transform:rotate(${heading}deg)"><path d="M12 2 20 21l-8-4-8 4z" fill="#fff"/></svg></div><div style="position:absolute;left:50%;top:40px;transform:translateX(-50%);background:#0b1f33;color:#fff;font:600 10px Inter,sans-serif;padding:1px 6px;border-radius:5px;white-space:nowrap">${reg}${dark ? ' · NO SIGNAL' : ''}</div></div>`,
})
const scIcon = (color: string, label: string) => L.divIcon({ className: '', iconSize: [0, 0], html: `<div style="transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center"><div style="width:14px;height:14px;border-radius:4px;background:${color};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4);transform:rotate(45deg)"></div><span style="margin-top:3px;background:#fff;border:1px solid #d6dee8;border-radius:4px;padding:0 4px;font:600 9px Inter,sans-serif;color:#0b1f33">${label}</span></div>` })
const siteIcon = (name: string, color: string) => L.divIcon({ className: '', iconSize: [0, 0], html: `<div style="transform:translate(-50%,-50%);background:${color};color:#fff;font:600 10px Inter,sans-serif;padding:2px 7px;border-radius:6px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.3)">${name}</div>` })
const SITE_COLOR: Record<string, string> = { hospital: '#0e7490', decon: '#1d4ed8', recycler: '#15803d', port: '#be123c', incinerator: '#be123c', hub: '#6d28d9', community: '#b45309' }

function Follow({ pos, on }: { pos: LL | null; on: boolean }) {
  const map = useMap()
  useEffect(() => { if (on && pos) map.panTo(pos, { animate: true, duration: 0.25 }) }, [pos?.[0], pos?.[1], on])
  return null
}
function Fit({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap()
  useEffect(() => { if (bounds) map.fitBounds(bounds, { padding: [40, 40] }) }, [JSON.stringify(bounds)])
  useEffect(() => { setTimeout(() => map.invalidateSize(), 50) }, [])
  return null
}

export function FleetMapView({ vehIds, height = 480, selected, onSelect, follow = false, scanners = false, sites, bounds }: { vehIds: string[]; height?: number | string; selected?: string; onSelect?: (id: string) => void; follow?: boolean; scanners?: boolean; sites?: string[]; bounds?: L.LatLngBoundsExpression }) {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const live = useStore((s) => s.live)
  const siteList = sites ?? Object.keys(SITES)
  const autoBounds = useMemo(() => {
    if (bounds) return bounds
    const pts: LL[] = siteList.map((s) => SITES[s].pos)
    return L.latLngBounds(pts as L.LatLngTuple[])
  }, [bounds, siteList.join()])

  const els = vehIds.map((id) => {
    const v = VEH_BY_ID[id], st = snap.veh[id]
    const mine = w.legs.filter((l) => l.veh === id)
    const leg = st.leg ?? [...mine].reverse().find((l) => l.arrive <= t) ?? mine[0]
    const next = !st.leg ? mine.find((l) => l.depart > t) : null
    const showLeg = st.leg ?? next ?? leg
    const planned = ROUTES[showLeg.planKey].pts
    const actualDiffers = showLeg.planKey !== showLeg.routeKey
    const done = leg ? (leg.arrive <= t ? leg.pts : (() => { const k = leg.cum.findIndex((c) => c > leg.meters * st.progress); return [...leg.pts.slice(0, Math.max(1, k)), st.pos] })()) : []
    return { v, st, leg, planned, actualDiffers, done, showLeg }
  })
  const fol = follow && selected ? snap.veh[selected] : null
  return (
    <MapContainer center={[51.53, -0.1]} zoom={11} style={{ height, width: '100%' }} zoomControl={true} scrollWheelZoom>
      <TileLayer attribution='&copy; OpenStreetMap contributors' url={import.meta.env.VITE_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} />
      <Fit bounds={follow ? null : autoBounds} />
      <Follow pos={fol ? fol.pos : null} on={!!fol} />
      {siteList.map((id) => { const s = SITES[id]; return (
        <span key={id}>
          <Circle center={s.pos} radius={s.radius} pathOptions={{ color: s.restricted ? '#e11d48' : SITE_COLOR[s.kind], weight: 1.5, fillOpacity: s.restricted ? 0.1 : 0.12, dashArray: s.restricted ? '5 4' : undefined }} />
          <Marker position={s.pos} icon={siteIcon(s.short + (s.restricted ? ' ⚠' : ''), SITE_COLOR[s.kind])} interactive={false} />
        </span>) })}
      {els.map(({ v, planned, done, actualDiffers, showLeg }) => (
        <span key={v.id}>
          <Polyline positions={planned} pathOptions={{ color: '#64748b', weight: 3, dashArray: '2 8', opacity: 0.7 }} />
          {actualDiffers && <Polyline positions={showLeg.pts} pathOptions={{ color: v.color, weight: 2, opacity: 0.25 }} />}
          <Polyline positions={done} pathOptions={{ color: v.color, weight: 5, opacity: 0.9 }} />
        </span>
      ))}
      {els.map(({ v, st }) => (
        <span key={v.id + 'm'}>
          {st.dark && <Circle center={st.pos} radius={400 + Math.max(0, t - st.lastFixT) * 60} pathOptions={{ color: '#e11d48', weight: 1, dashArray: '4 4', fillOpacity: 0.08 }} />}
          <Marker position={st.pos} icon={vehIcon(v.color, st.heading, v.reg, selected === v.id, st.dark)} eventHandlers={{ click: () => onSelect?.(v.id) }} zIndexOffset={1000}>
            <Tooltip direction="top" offset={[0, -18]}>{v.reg} · {v.role}</Tooltip>
          </Marker>
        </span>
      ))}
      {scanners && SCANNERS.map((sc) => { const s = scannerAt(w.legs, sc, t); if (s.veh) return null
        return <span key={sc.id}><Circle center={sc.id === 'SC-004' && s.mode !== 'at_hub' ? SITES.COMM.pos : sc.pos} radius={sc.geofence} pathOptions={{ color: '#7c3aed', weight: 1, fillOpacity: 0.06 }} />
          <Marker position={s.pos} icon={scIcon(s.outside ? '#e11d48' : '#7c3aed', sc.id)}><Tooltip>{sc.name}<br />{sc.holder}</Tooltip></Marker></span> })}
      {live && <Marker position={[live.lat, live.lng]} icon={scIcon('#16a34a', 'TAT240 LIVE')} zIndexOffset={2000}><Tooltip>Physical TAT240 · {new Date(live.ts).toLocaleString()}</Tooltip></Marker>}
    </MapContainer>
  )
}
