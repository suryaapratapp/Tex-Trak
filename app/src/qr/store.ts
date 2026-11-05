import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Status = 'registered' | 'in_use' | 'removed' | 'retired'
export type Reason = 'expired' | 'soiled' | 'damage'
export const REASONS: { value: Reason; label: string; help: string }[] = [
  { value: 'expired', label: 'Expired', help: 'Reached its change-due date' },
  { value: 'soiled', label: 'Soiled', help: 'Needs washing early' },
  { value: 'damage', label: 'Damaged', help: 'Torn, stained or broken' },
]
export type UserRole = 'admin' | 'synergy' | 'synergy_field' | 'hospital' | 'guest'
export const ROLE_LABELS: Record<UserRole, string> = { admin: 'Administrator', synergy: 'Synergy', synergy_field: 'Synergy field', hospital: 'Hospital', guest: 'Guest' }
export const ROLE_HELP: Record<UserRole, string> = {
  admin: 'Full access, including QR labels and user management', synergy: 'All sites and all products, including reports',
  synergy_field: 'All sites for install and take-down work, without reports', hospital: 'One hospital only: its own products and installations', guest: 'Install and take down only, under a typed name',
}

export interface Hospital { id: string; name: string; code: string }
export interface Loc { id: string; hospitalId: string; floor: string; ward: string; bay: string }
export interface Place { hospitalId: string; floor?: string; ward?: string; bay?: string }
export interface Product { code: string; productCode: string; type: string; size?: string; colour?: string; batch?: string; status: Status; registeredAt: number; installedAt?: number; dueAt?: number; place?: Place; notes?: string }
export interface Hist { id: number; ts: number; type: 'registered' | 'installed' | 'removed' | 'retired'; code: string; hospitalId?: string; where?: string; reason?: Reason; notes?: string; by: string; replaces?: string }
export interface User { id: string; name: string; username: string; role: UserRole; hospitalId?: string }
export interface CodeFormat { prefix: string; letters: number; digits: number }
export interface Batch { id: number; ts: number; productCode: string; name: string; count: number; first: string; last: string; registered: boolean; start: number; fmt: CodeFormat; prefix: string }

const DAY = 86400000
const SPEC: [string, string, string, [string, string, string[]][]][] = [
  ['qmh', 'Queen Mary Hospital', 'QMH', [['Ground', 'Emergency Ward', ['E1', 'E2', 'E3', 'E4', 'E5', 'E6']], ['Level 1', 'Surgical Ward', ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']], ['Level 2', 'Medical Ward', ['M1', 'M2', 'M3', 'M4', 'M5']], ['Level 3', 'Maternity Ward', ['N1', 'N2', 'N3', 'N4', 'N5']]]],
  ['rai', 'Royal Albert Infirmary', 'RAI', [['Ground', 'Outpatients', ['O1', 'O2', 'O3']], ['Level 1', 'Respiratory Ward', ['RP1', 'RP2', 'RP3', 'RP4', 'RP5']], ['Level 2', 'Cardiology Ward', ['C1', 'C2', 'C3', 'C4']]]],
  ['stg', 'St Thomas General Hospital', 'STG', [['Ground', 'Day Surgery', ['D1', 'D2', 'D3', 'D4']], ['Level 1', 'Orthopaedic Ward', ['OR1', 'OR2', 'OR3', 'OR4', 'OR5', 'OR6']], ['Level 2', 'Paediatric Ward', ['P1', 'P2', 'P3', 'P4', 'P5']]]],
]
const HOSPITALS: Hospital[] = SPEC.map(([id, name, code]) => ({ id, name, code }))
const LOCS: Loc[] = SPEC.flatMap(([h, , , fl]) => fl.flatMap(([floor, ward, bays]) => bays.map((bay) => ({ id: `${h}|${floor}|${ward}|${bay}`, hospitalId: h, floor, ward, bay }))))

export const DEFAULT_FORMAT: CodeFormat = { prefix: 'RZC', letters: 3, digits: 3 }
const L26 = (n: number, len: number) => { let s = ''; for (let i = 0; i < len; i++) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) } return s }
/** Serial n (from 1) → letters + digits, e.g. 1 → AAA001, 999 → AAA999, 1000 → AAB001. Never issues …000. */
export const serialCode = (n: number, f: CodeFormat) => { const per = 10 ** f.digits - 1; const block = Math.floor((n - 1) / per); const d = ((n - 1) % per) + 1; return L26(block, f.letters) + String(d).padStart(f.digits, '0') }
export const capacity = (f: CodeFormat) => (10 ** f.digits - 1) * 26 ** f.letters
export const seriesKey = (f: CodeFormat, product: string) => `${f.prefix}-${product}|${f.letters}x${f.digits}`
export const normalise = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '')

function seed() {
  const now = Date.now(); const products: Record<string, Product> = {}; const history: Hist[] = []; let hid = 1
  const mk = (code: string, p: Partial<Product>): Product => ({ code, productCode: 'MVN191', type: 'Curtain', status: 'registered', registeredAt: now - 220 * DAY, batch: 'B-2026-01', ...p })
  LOCS.slice(0, 40).forEach((l, i) => {
    const code = `SYN-MVN191-${serialCode(i + 1, DEFAULT_FORMAT)}`
    const age = i % 11 === 3 ? 188 + (i % 5) * 4 : i % 7 === 2 ? 152 + (i % 4) * 7 : 20 + ((i * 17) % 120)
    const at = now - age * DAY
    products[code] = mk(code, { status: 'in_use', installedAt: at, dueAt: at + 180 * DAY, place: { hospitalId: l.hospitalId, floor: l.floor, ward: l.ward, bay: l.bay } })
    history.push({ id: hid++, ts: at, type: 'installed', code, hospitalId: l.hospitalId, where: `${l.ward} · ${l.bay}`, by: 'Synergy Team' })
  })
  for (let i = 0; i < 48; i++) { const code = `RZC-MVN191-${serialCode(i + 1, DEFAULT_FORMAT)}`; products[code] = mk(code, { registeredAt: now - 12 * DAY }); history.push({ id: hid++, ts: now - 12 * DAY, type: 'registered', code, by: 'Administrator' }) }
  for (let i = 0; i < 4; i++) { const code = `SYN-MVN191-${serialCode(60 + i, DEFAULT_FORMAT)}`; const at = now - (210 + i * 9) * DAY; products[code] = mk(code, { status: 'removed' }); history.push({ id: hid++, ts: at, type: 'installed', code, hospitalId: 'qmh', where: 'Surgical Ward · S1', by: 'Synergy Team' }, { id: hid++, ts: at + 185 * DAY, type: 'removed', code, hospitalId: 'qmh', where: 'Surgical Ward · S1', reason: 'expired', by: 'Synergy Team' }) }
  history.sort((a, b) => b.ts - a.ts); history.forEach((h, i) => (h.id = history.length - i))
  return { products, history }
}
const USERS: User[] = [
  { id: 'u1', name: 'Administrator', username: 'admin', role: 'admin' }, { id: 'u2', name: 'Synergy Team', username: 'synergy', role: 'synergy' },
  { id: 'u3', name: 'Queen Mary Hospital', username: 'queenmary', role: 'hospital', hospitalId: 'qmh' }, { id: 'u4', name: 'St Thomas General Hospital', username: 'stthomas', role: 'hospital', hospitalId: 'stg' },
  { id: 'u5', name: 'Synergy Ops Team', username: 'synergy2', role: 'synergy_field' }, { id: 'u6', name: 'Guest login (shared)', username: 'guest', role: 'guest' },
]
export interface Result { ok: boolean; message: string }
interface S {
  hospitals: Hospital[]; locs: Loc[]; products: Record<string, Product>; history: Hist[]; users: User[]; dueDays: number; format: CodeFormat; counters: Record<string, number>; batches: Batch[]
  register: (codes: string[], meta: { batch?: string; size?: string; colour?: string; productCode?: string; type?: string }) => { added: string[]; skipped: string[] }
  install: (code: string, place: Place, opts?: { replaces?: string }) => Result
  takeDown: (code: string, reason: Reason, notes?: string) => Result & { place?: Place }
  retire: (code: string, notes?: string) => Result
  importLocations: (rows: { hospital: string; code?: string; floor?: string; ward: string; bay: string }[]) => { added: number; hospitals: number }
  setDueDays: (n: number) => void; setFormat: (f: CodeFormat) => void
  generate: (productCode: string, name: string, count: number, register: boolean) => Batch
  addUser: (u: Omit<User, 'id'>) => void; removeUser: (id: string) => void
  reset: () => void
}
const hosp = (s: { hospitals: Hospital[] }, id?: string) => s.hospitals.find((h) => h.id === id)
export const placeText = (s: { hospitals: Hospital[] }, p?: Place) => (p ? [hosp(s, p.hospitalId)?.name, p.floor, p.ward, p.bay].filter(Boolean).join(' · ') : 'Not installed')
const BY = 'Administrator'
const nextId = (h: Hist[]) => (h[0]?.id ?? 0) + 1

export const useQr = create<S>()(persist((set, get) => ({
  hospitals: HOSPITALS, locs: LOCS, ...seed(), users: USERS, dueDays: 180, format: DEFAULT_FORMAT, counters: { [seriesKey(DEFAULT_FORMAT, 'MVN191')]: 49 }, batches: [],
  register: (codes, meta) => {
    const added: string[] = [], skipped: string[] = []; const st = get(); const products = { ...st.products }; const history = [...st.history]; const now = Date.now()
    codes.map(normalise).filter(Boolean).forEach((code) => {
      const ex = products[code]
      if (ex && ex.status !== 'removed') { skipped.push(code); return }
      products[code] = { code, productCode: meta.productCode ?? 'MVN191', type: meta.type ?? 'Curtain', size: meta.size || undefined, colour: meta.colour || undefined, batch: meta.batch || undefined, status: 'registered', registeredAt: now }
      history.unshift({ id: nextId(history), ts: now, type: 'registered', code, by: BY }); added.push(code)
    })
    set({ products, history }); return { added, skipped }
  },
  install: (raw, place, opts) => {
    const st = get(); const code = normalise(raw); const p = st.products[code]
    if (!p) return { ok: false, message: `${code} is not registered. Register the label first.` }
    if (p.status === 'in_use') return { ok: false, message: `${code} is already installed at ${placeText(st, p.place)}.` }
    if (p.status === 'retired') return { ok: false, message: `${code} has been retired and cannot be installed.` }
    if (p.status === 'removed') return { ok: false, message: `${code} was taken down. Register it again once it is back in stock.` }
    if (place.bay && !opts?.replaces) { const taken = Object.values(st.products).find((x) => x.status === 'in_use' && x.place?.hospitalId === place.hospitalId && x.place.floor === place.floor && x.place.ward === place.ward && x.place.bay === place.bay); if (taken) return { ok: false, message: `${place.bay} already has ${taken.code}. Take it down first, or use Take down to swap it.` } }
    const now = Date.now(); const where = [place.ward, place.bay].filter(Boolean).join(' · ') || 'hospital level'
    set({ products: { ...st.products, [code]: { ...p, status: 'in_use', installedAt: now, dueAt: now + st.dueDays * DAY, place } }, history: [{ id: nextId(st.history), ts: now, type: 'installed', code, hospitalId: place.hospitalId, where, by: BY, replaces: opts?.replaces }, ...st.history] })
    return { ok: true, message: `${code} installed at ${placeText(st, place)}` }
  },
  takeDown: (raw, reason, notes) => {
    const st = get(); const code = normalise(raw); const p = st.products[code]
    if (!p) return { ok: false, message: `${code} is not on the system.` }
    if (p.status !== 'in_use') return { ok: false, message: `${code} is not installed anywhere right now.` }
    const now = Date.now(); const where = [p.place?.ward, p.place?.bay].filter(Boolean).join(' · ') || 'hospital level'
    set({ products: { ...st.products, [code]: { ...p, status: 'removed', installedAt: undefined, dueAt: undefined, place: undefined } }, history: [{ id: nextId(st.history), ts: now, type: 'removed', code, hospitalId: p.place?.hospitalId, where, reason, notes: notes || undefined, by: BY }, ...st.history] })
    return { ok: true, message: `${code} taken down`, place: p.place }
  },
  retire: (raw, notes) => {
    const st = get(); const code = normalise(raw); const p = st.products[code]; if (!p) return { ok: false, message: 'Not found.' }
    if (p.status === 'in_use') return { ok: false, message: 'Take it down before retiring it.' }
    set({ products: { ...st.products, [code]: { ...p, status: 'retired' } }, history: [{ id: nextId(st.history), ts: Date.now(), type: 'retired', code, notes, by: BY }, ...st.history] }); return { ok: true, message: `${code} retired` }
  },
  importLocations: (rows) => {
    const st = get(); const hospitals = [...st.hospitals]; const locs = [...st.locs]; let added = 0, newH = 0
    rows.forEach((r) => {
      let h = hospitals.find((x) => x.name.toLowerCase() === r.hospital.trim().toLowerCase())
      if (!h) { h = { id: r.hospital.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: r.hospital.trim(), code: (r.code ?? r.hospital.split(/\s+/).map((w) => w[0]).join('')).toUpperCase().slice(0, 6) }; hospitals.push(h); newH++ }
      const floor = r.floor?.trim() || 'Ground'; const id = `${h.id}|${floor}|${r.ward.trim()}|${r.bay.trim()}`
      if (!locs.some((l) => l.id === id)) { locs.push({ id, hospitalId: h.id, floor, ward: r.ward.trim(), bay: r.bay.trim() }); added++ }
    })
    set({ hospitals, locs }); return { added, hospitals: newH }
  },
  setDueDays: (n) => set({ dueDays: Math.max(1, Math.round(n)) }),
  setFormat: (format) => set({ format }),
  generate: (productCode, name, count, register) => {
    const st = get(); const key = seriesKey(st.format, productCode); const start = (st.counters[key] ?? 0) + 1
    const code = (n: number) => `${st.format.prefix}-${productCode}-${serialCode(n, st.format)}`
    const batch: Batch = { id: (st.batches[0]?.id ?? 0) + 1, ts: Date.now(), productCode, name, count, first: code(start), last: code(start + count - 1), registered: register, start, fmt: st.format, prefix: st.format.prefix }
    set({ counters: { ...st.counters, [key]: start + count - 1 }, batches: [batch, ...st.batches].slice(0, 10) })
    if (register) get().register(Array.from({ length: count }, (_, i) => code(start + i)), { productCode, type: name, batch: `B-${new Date().getFullYear()}-${String(batch.id).padStart(2, '0')}` })
    return batch
  },
  addUser: (u) => set((s) => ({ users: [...s.users, { ...u, id: `u${Date.now()}` }] })),
  removeUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id || u.username === 'admin') })),
  reset: () => set({ hospitals: HOSPITALS, locs: LOCS, ...seed(), users: USERS, dueDays: 180, format: DEFAULT_FORMAT, counters: { [seriesKey(DEFAULT_FORMAT, 'MVN191')]: 49 }, batches: [] }),
}), { name: 'textrak-qr-v1', version: 1 }))

export const daysLeft = (p: Product) => (p.dueAt ? Math.ceil((p.dueAt - Date.now()) / DAY) : null)
export const isOverdue = (p: Product) => p.status === 'in_use' && (daysLeft(p) ?? 1) < 0
export const isDueSoon = (p: Product) => p.status === 'in_use' && (daysLeft(p) ?? 99) >= 0 && (daysLeft(p) ?? 99) <= 30
export const STATUS_LABEL: Record<Status, string> = { registered: 'In stock', in_use: 'In use', removed: 'Taken down', retired: 'Retired' }
export const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
export const fmtDateTime = (ts: number) => new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
export const SIZE_HINT = 'e.g. 3000 x 2000'

export const batchCodes = (b: Batch, from = 0, n = b.count) => Array.from({ length: Math.min(n, b.count - from) }, (_, i) => `${b.prefix}-${b.productCode}-${serialCode(b.start + from + i, b.fmt)}`)
export const REGISTER_CAP = 2000
