import { create } from 'zustand'
import { T0, T1 } from './sim/engine'
import type { LiveFix } from './lib/useLive'
import type { Role } from './sim/registry'

const ROLE_KEY = 'textrak-role'
const loadRole = (): Role => { try { const r = localStorage.getItem(ROLE_KEY); return r === 'clientA' || r === 'superadmin' ? r : 'synergy' } catch { return 'synergy' } }

export const SPEEDS = [30, 60, 120, 300, 600, 1200]
interface S {
  t: number; playing: boolean; speed: number
  page: string; selItem: number | null; selVeh: string; selShip: string; selIncident: string | null
  twin: 'H' | 'D'; floor: 'G' | '1' | '2' | '3'; netMap: boolean; role: Role
  instTab: string
  live: LiveFix | null
  states: Record<string, 'ack' | 'resolved' | 'investigating'>
  set: (p: Partial<S>) => void
  tick: (dtMs: number) => void
  setAlert: (id: string, s: 'ack' | 'resolved' | 'investigating') => void
  setRole: (r: Role) => void
}
export const useStore = create<S>((set, get) => ({
  t: 330, playing: true, speed: 120, page: location.hash.slice(1) || 'command', selItem: 0, selVeh: 'V1', selShip: 'LND-0612-AM', selIncident: 'INC-2041', twin: 'H', floor: 'G', netMap: false, role: loadRole(), instTab: 'overview', live: null, states: {},
  set: (p) => set(p),
  tick: (dtMs) => { const s = get(); if (!s.playing) return; const t = s.t + ((s.speed / 60) * dtMs) / 1000; if (t >= T1) set({ t: T1, playing: false }); else set({ t }) },
  setRole: (role) => { try { localStorage.setItem(ROLE_KEY, role) } catch { /* private mode */ } set({ role, page: 'command' }); location.hash = 'command' },
  setAlert: (id, st) => set((s) => ({ states: { ...s.states, [id]: st } })),
}))
export const go = (page: string) => { location.hash = page; useStore.getState().set({ page }) }
export const jump = (t: number) => useStore.getState().set({ t: Math.max(T0, Math.min(T1, t)) })
if (import.meta.env.DEV) (window as unknown as { __tx: typeof useStore }).__tx = useStore
