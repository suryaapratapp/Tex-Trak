import { useMemo } from 'react'
import { getWorld, itemAt, vehicleAt, type ItemLoc, type VehState } from './engine'
import { VEHICLES } from './world'
import { useStore } from '../store'

export interface Snap { t: number; veh: Record<string, VehState>; loc: ItemLoc[]; byStatus: Record<string, number>; byZone: Record<string, number> }
export function computeSnap(t: number): Snap {
  const w = getWorld()
  const veh: Record<string, VehState> = {}
  for (const v of VEHICLES) veh[v.id] = vehicleAt(w.legs, v.id, t)
  const loc = w.items.map((i) => itemAt(i, t))
  const byStatus: Record<string, number> = {}, byZone: Record<string, number> = {}
  for (const l of loc) {
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1
    const k = l.kind === 'vehicle' ? `V:${l.veh}` : l.zone ?? 'x'
    byZone[k] = (byZone[k] ?? 0) + 1
  }
  return { t, veh, loc, byStatus, byZone }
}
export function useSnap(): Snap {
  const t = useStore((s) => s.t)
  const q = Math.round(t * 10) / 10
  return useMemo(() => computeSnap(q), [q])
}
export const fmtDur = (m: number) => { const a = Math.abs(m); return a < 1 ? '<1 min' : a < 60 ? `${Math.round(a)} min` : `${Math.floor(a / 60)} h ${Math.round(a % 60)} m` }
