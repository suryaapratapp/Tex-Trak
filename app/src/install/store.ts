import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CStatus = 'stock' | 'on_site' | 'installed' | 'taken_down' | 'in_transit' | 'reprocessing'
export const STATUS: Record<CStatus, { label: string; color: string; short: string }> = {
  stock: { label: 'At Synergy facility', short: 'Ready', color: '#64748b' },
  on_site: { label: 'Delivered to hospital', short: 'Delivered', color: '#0ea5e9' },
  installed: { label: 'Installed', short: 'Installed', color: '#10b981' },
  taken_down: { label: 'Taken down', short: 'Taken down', color: '#f59e0b' },
  in_transit: { label: 'On the van', short: 'On van', color: '#6366f1' },
  reprocessing: { label: 'Reprocessing', short: 'Reprocessing', color: '#ec4899' },
}
export const WARDS = [
  { f: 3, code: '3A', name: 'Ward 3A', n: 6 }, { f: 3, code: '3B', name: 'Ward 3B', n: 6 },
  { f: 2, code: '2A', name: 'Ward 2A', n: 8 }, { f: 2, code: '2B', name: 'Ward 2B', n: 8 },
  { f: 1, code: '1A', name: 'Surgical Ward 1A', n: 8 }, { f: 1, code: '1B', name: 'Cardiology 1B', n: 6 },
]
export interface Bay { id: string; floor: number; wardCode: string; ward: string; n: number; label: string }
export const BAYS: Bay[] = WARDS.flatMap((w) => Array.from({ length: w.n }, (_, i) => ({ id: `F${w.f}-${w.code}-B${String(i + 1).padStart(2, '0')}`, floor: w.f, wardCode: w.code, ward: w.name, n: i + 1, label: `${w.name} · Bay ${i + 1}` })))
export const BAY: Record<string, Bay> = Object.fromEntries(BAYS.map((b) => [b.id, b]))
export const JOB_FLOOR = 2
export const DUE_DAYS = 28
const DAY = 86400000

export interface Curtain { id: string; type: string; cycles: number; status: CStatus; bay?: string; installedAt?: number }
export type Mode = 'install' | 'takedown' | 'dispatch' | 'receive'
export interface InstEv { id: number; ts: number; mode: Mode | 'batch'; curtain?: string; bay?: string; level: 'ok' | 'warn' | 'error'; title: string; detail: string }
export interface ScanResult { level: 'ok' | 'warn' | 'error'; title: string; detail: string; curtain?: string; bay?: string; next?: string }

export const MODES: Record<Mode, { label: string; dir: string; blurb: string }> = {
  install: { label: 'Install', dir: 'Incoming to ward', blurb: 'Scan the bay label, then the new curtain' },
  takedown: { label: 'Take down', dir: 'Outgoing from ward', blurb: 'Scan the curtain you removed' },
  dispatch: { label: 'Dispatch', dir: 'Out of Synergy facility', blurb: 'Scan each clean curtain as it is loaded' },
  receive: { label: 'Receive', dir: 'Back at Synergy facility', blurb: 'Scan each curtain as it arrives back' },
}

function seed(): { curtains: Record<string, Curtain>; seedTs: number } {
  const now = Date.now(); const curtains: Record<string, Curtain> = {}
  BAYS.forEach((b, i) => { const id = `CUR-${1001 + i}`; const age = b.floor === JOB_FLOOR ? 29 + (i % 5) : 3 + ((i * 7) % 22); curtains[id] = { id, type: b.wardCode === '3A' ? 'Privacy screen' : 'Bed curtain', cycles: 3 + ((i * 5) % 15), status: 'installed', bay: b.id, installedAt: now - age * DAY } })
  for (let i = 0; i < 40; i++) { const id = `CUR-${2001 + i}`; curtains[id] = { id, type: i % 9 === 8 ? 'Window curtain' : 'Bed curtain', cycles: 2 + (i % 9), status: i < 16 ? 'on_site' : 'stock' } }
  for (let i = 0; i < 12; i++) { const id = `CUR-${3001 + i}`; curtains[id] = { id, type: 'Bed curtain', cycles: 5 + i, status: 'reprocessing' } }
  return { curtains, seedTs: now }
}
const parse = (raw: string): { kind: 'curtain' | 'bay'; id: string } | null => {
  const s = raw.trim()
  let m = s.match(/^TT:C:(.+)$/i) ?? s.match(/^(CUR-\d+)$/i); if (m) return { kind: 'curtain', id: m[1].toUpperCase() }
  m = s.match(/^TT:B:(.+)$/i) ?? s.match(/^(F\d-[A-Z0-9]+-B\d+)$/i); if (m) return { kind: 'bay', id: m[1].toUpperCase() }
  return null
}
export const curtainCode = (id: string) => `TT:C:${id}`
export const bayCode = (id: string) => `TT:B:${id}`

interface S {
  curtains: Record<string, Curtain>; events: InstEv[]; seedTs: number; pendingBay: string | null; pendingCurtain: string | null; user: string
  scan: (mode: Mode, raw: string) => ScanResult
  handToDriver: () => number; finishReprocessing: () => number; reset: () => void; clearPending: () => void
}
export const useInst = create<S>()(persist((set, get) => ({
  ...seed(), events: [], pendingBay: null, pendingCurtain: null, user: 'Amir Syed · Synergy',
  clearPending: () => set({ pendingBay: null, pendingCurtain: null }),
  reset: () => set({ ...seed(), events: [], pendingBay: null, pendingCurtain: null }),
  handToDriver: () => {
    const cs = { ...get().curtains }; let n = 0
    Object.values(cs).forEach((c) => { if (c.status === 'taken_down') { cs[c.id] = { ...c, status: 'in_transit' }; n++ } })
    set((s) => ({ curtains: cs, events: [{ id: s.events.length + 1, ts: Date.now(), mode: 'batch', level: 'ok', title: 'Handed to driver', detail: `${n} taken-down curtains loaded onto the van` }, ...s.events] })); return n
  },
  finishReprocessing: () => {
    const cs = { ...get().curtains }; let n = 0
    Object.values(cs).forEach((c) => { if (c.status === 'reprocessing') { cs[c.id] = { ...c, status: 'stock', cycles: c.cycles + 1 }; n++ } })
    set((s) => ({ curtains: cs, events: [{ id: s.events.length + 1, ts: Date.now(), mode: 'batch', level: 'ok', title: 'Reprocessing complete', detail: `${n} curtains cleaned and ready for the next delivery` }, ...s.events] })); return n
  },
  scan: (mode, raw) => {
    const s = get(); const p = parse(raw); const cs = { ...s.curtains }
    const out = (r: ScanResult, patch: Partial<S> = {}) => { set((st) => ({ ...patch, events: [{ id: st.events.length + 1, ts: Date.now(), mode, curtain: r.curtain, bay: r.bay, level: r.level, title: r.title, detail: r.detail }, ...st.events].slice(0, 300) })); return r }
    if (!p) return out({ level: 'error', title: 'Code not recognised', detail: 'This is not a Tex-Trak label. Try again.' })
    const bayName = (id?: string) => (id && BAY[id] ? BAY[id].label : '')
    const finishInstall = (bayId: string, cid: string): ScanResult => {
      const c = cs[cid]; const old = Object.values(cs).find((x) => x.bay === bayId && x.status === 'installed')
      if (old) cs[old.id] = { ...old, status: 'taken_down', bay: undefined }
      cs[cid] = { ...c, status: 'installed', bay: bayId, installedAt: Date.now() }
      return out({ level: 'ok', title: `Installed in ${bayName(bayId)}`, detail: old ? `${cid} fitted. Old curtain ${old.id} moved to “Taken down”.` : `${cid} fitted.`, curtain: cid, bay: bayId, next: 'Scan the next bay' }, { curtains: cs, pendingBay: null, pendingCurtain: null })
    }
    if (mode === 'install') {
      if (p.kind === 'bay') {
        if (!BAY[p.id]) return out({ level: 'error', title: 'Unknown bay', detail: p.id })
        if (s.pendingCurtain) return finishInstall(p.id, s.pendingCurtain)
        return out({ level: 'ok', title: bayName(p.id), detail: 'Bay selected.', bay: p.id, next: 'Now scan the new curtain' }, { pendingBay: p.id })
      }
      const c = cs[p.id]
      if (!c) return out({ level: 'error', title: 'Unknown curtain', detail: p.id })
      if (c.status === 'installed') return out({ level: 'warn', title: 'Already installed', detail: `${c.id} is in ${bayName(c.bay)}.`, curtain: c.id })
      if (c.status !== 'on_site') return out({ level: 'error', title: 'Not delivered yet', detail: `${c.id} is “${STATUS[c.status].label}”. Only delivered curtains can be installed.`, curtain: c.id })
      if (s.pendingBay) return finishInstall(s.pendingBay, c.id)
      return out({ level: 'ok', title: `${c.id} ready`, detail: c.type, curtain: c.id, next: 'Now scan the bay label' }, { pendingCurtain: c.id })
    }
    let cid = p.kind === 'curtain' ? p.id : Object.values(cs).find((x) => x.bay === p.id && x.status === 'installed')?.id
    if (!cid || !cs[cid]) return out({ level: 'error', title: p.kind === 'bay' ? 'Nothing installed here' : 'Unknown curtain', detail: p.id })
    const c = cs[cid]
    if (mode === 'takedown') {
      if (c.status !== 'installed') return out({ level: 'warn', title: 'Not installed', detail: `${c.id} is “${STATUS[c.status].label}”.`, curtain: c.id })
      const b = c.bay; cs[cid] = { ...c, status: 'taken_down', bay: undefined }
      return out({ level: 'ok', title: `Taken down from ${bayName(b)}`, detail: `${c.id} is now waiting for collection.`, curtain: c.id, bay: b, next: 'Scan the next curtain' }, { curtains: cs })
    }
    if (mode === 'dispatch') {
      if (c.status !== 'stock') return out({ level: 'error', title: 'Cannot dispatch', detail: `${c.id} is “${STATUS[c.status].label}”.`, curtain: c.id })
      cs[cid] = { ...c, status: 'on_site' }
      return out({ level: 'ok', title: 'Loaded for delivery', detail: `${c.id} is on its way to the hospital.`, curtain: c.id, next: 'Scan the next curtain' }, { curtains: cs })
    }
    if (c.status !== 'taken_down' && c.status !== 'in_transit') return out({ level: 'error', title: 'Cannot receive', detail: `${c.id} is “${STATUS[c.status].label}”.`, curtain: c.id })
    cs[cid] = { ...c, status: 'reprocessing' }
    return out({ level: 'ok', title: 'Received at facility', detail: `${c.id} has gone into reprocessing.`, curtain: c.id, next: 'Scan the next curtain' }, { curtains: cs })
  },
}), { name: 'textrak-install-v2', version: 1 }))

export const ageDays = (c: Curtain) => (c.installedAt ? (Date.now() - c.installedAt) / DAY : 0)
export const isDue = (c: Curtain) => c.status === 'installed' && ageDays(c) >= DUE_DAYS
