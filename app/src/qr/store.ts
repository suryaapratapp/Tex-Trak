import { useEffect } from 'react'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useStore } from '../store'
import { isNetworkError, kvGet, kvSet, useNet } from '../lib/offline'
import { App as CapApp } from '@capacitor/app'
import { isNative } from '../lib/offline'

export type Status = 'registered' | 'in_use' | 'removed' | 'retired'
export type Reason = 'expired' | 'soiled' | 'damage'
export const REASONS: { value: Reason; label: string; help: string }[] = [
  { value: 'expired', label: 'Expired', help: 'Reached its change-due date' },
  { value: 'soiled', label: 'Soiled', help: 'Needs washing early' },
  { value: 'damage', label: 'Damaged', help: 'Torn, stained or broken' },
]
export interface Hospital { id: string; name: string; code: string }
export interface Loc { id: string; hospitalId: string; floor: string; ward: string; bay: string }
export interface Place { hospitalId: string; floor?: string; ward?: string; bay?: string }
export interface Product { code: string; productCode: string; type: string; size?: string; colour?: string; batch?: string; status: Status; registeredAt: number; dueDays: number; installedAt?: number; dueAt?: number; place?: Place; notes?: string }
export interface Hist { id: number; ts: number; type: 'registered' | 'installed' | 'removed' | 'retired'; code: string; hospitalId?: string; where?: string; reason?: Reason; notes?: string; by: string; replaces?: string }
export interface CodeFormat { prefix: string; letters: number; digits: number }
export interface Batch { id: number; ts: number; productCode: string; name: string; count: number; first: string; last: string; registered: boolean; start: number; fmt: CodeFormat; prefix: string }
export interface Result { ok: boolean; message: string }

const DAY = 86400000
export const DEFAULT_DUE_DAYS = 7
export const DEFAULT_FORMAT: CodeFormat = { prefix: 'RZC', letters: 3, digits: 3 }
const L26 = (n: number, len: number) => { let s = ''; for (let i = 0; i < len; i++) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) } return s }
/** Serial n (from 1) → letters + digits, e.g. 1 → AAA001, 999 → AAA999, 1000 → AAB001. Matches the database. */
export const serialCode = (n: number, f: CodeFormat) => { const per = 10 ** f.digits - 1; const block = Math.floor((n - 1) / per); const d = ((n - 1) % per) + 1; return L26(block, f.letters) + String(d).padStart(f.digits, '0') }
export const capacity = (f: CodeFormat) => (10 ** f.digits - 1) * 26 ** f.letters
export const seriesKey = (f: CodeFormat, product: string) => `${f.prefix}-${product}|${f.letters}x${f.digits}`
export const normalise = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '')

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const toProduct = (r: Row): Product => ({ code: r.code, productCode: r.product_code, type: r.type, size: r.size ?? undefined, colour: r.colour ?? undefined, batch: r.batch ?? undefined, status: r.status, registeredAt: new Date(r.registered_at).getTime(), dueDays: r.due_days, installedAt: r.installed_at ? new Date(r.installed_at).getTime() : undefined, dueAt: r.due_at ? new Date(r.due_at).getTime() : undefined, place: r.hospital_id ? { hospitalId: r.hospital_id, floor: r.floor ?? undefined, ward: r.ward ?? undefined, bay: r.bay ?? undefined } : undefined, notes: r.notes ?? undefined })
const toBatch = (r: Row): Batch => ({ id: r.id, ts: new Date(r.created_at).getTime(), productCode: r.product_code, name: r.name, count: r.count, first: r.first_code, last: r.last_code, registered: r.registered, start: r.start, prefix: r.prefix, fmt: { prefix: r.prefix, letters: r.letters, digits: r.digits } })

async function fetchAll(table: string, org: string, order: string) {
  const out: Row[] = []
  for (let from = 0; from < 100000; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').eq('org_id', org).order(order).range(from, from + 999)
    if (error) throw error
    out.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  return out
}

export type OpKind = 'install' | 'takedown' | 'register' | 'retire'
export interface Op { id: string; org: string; kind: OpKind; at: number; code: string; args: Record<string, unknown>; text: string; state: 'pending' | 'failed'; error?: string; unverified?: boolean }
export interface LogEntry { id: string; ts: number; kind: OpKind; code: string; text: string; state: 'pending' | 'sent' | 'failed'; message?: string }
type Meta = { batch?: string; size?: string; colour?: string; productCode?: string; type?: string; dueDays?: number }

interface S {
  org: string; loaded: boolean; error: string; offline: boolean; flushing: boolean; ops: Op[]; log: LogEntry[]
  hospitals: Hospital[]; locs: Loc[]; products: Record<string, Product>; history: Hist[]; batches: Batch[]; format: CodeFormat; counters: Record<string, number>
  init: () => Promise<void>
  load: (org: string) => Promise<void>
  flush: () => Promise<void>
  retryOp: (id: string) => void
  discardOp: (id: string) => Promise<void>
  register: (codes: string[], meta: Meta) => Promise<{ added: string[]; skipped: string[]; error?: string; queued?: boolean }>
  install: (code: string, place: Place, opts?: { replaces?: string }) => Promise<Result & { queued?: boolean }>
  takeDown: (code: string, reason: Reason, notes?: string) => Promise<Result & { place?: Place; queued?: boolean }>
  retire: (code: string, notes?: string) => Promise<Result & { queued?: boolean }>
  importLocations: (rows: { hospital: string; code?: string; floor?: string; ward: string; bay: string }[]) => Promise<{ added: number; hospitals: number; error?: string }>
  setFormat: (f: CodeFormat) => Promise<Result>
  generate: (productCode: string, name: string, count: number, register: boolean, dueDays?: number) => Promise<{ batch?: Batch; error?: string }>
}
const rpcErr = (e: { message: string }): Result => ({ ok: false, message: e.message })
const needsNet = 'This needs a connection. Try again when you are back online.'
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

/** What an operation does to the local copy, so the phone shows the result straight away and keeps showing it until the server confirms. */
function applyOp(products: Record<string, Product>, op: Op): Record<string, Product> {
  const out = { ...products }; const at = op.at
  if (op.kind === 'register') { const codes = op.args.codes as string[]; const m = op.args.meta as Meta; for (const c of codes) out[c] = { code: c, productCode: m.productCode ?? 'MVN191', type: m.type ?? 'Curtain', size: m.size, colour: m.colour, batch: m.batch, status: 'registered', registeredAt: at, dueDays: m.dueDays ?? DEFAULT_DUE_DAYS } }
  const p = out[op.code]; if (!p) return out
  if (op.kind === 'install') out[op.code] = { ...p, status: 'in_use', installedAt: at, dueAt: at + p.dueDays * DAY, place: { hospitalId: op.args.hospital as string, floor: (op.args.floor as string) || undefined, ward: (op.args.ward as string) || undefined, bay: (op.args.bay as string) || undefined } }
  if (op.kind === 'takedown') out[op.code] = { ...p, status: 'removed', installedAt: undefined, dueAt: undefined, place: undefined }
  if (op.kind === 'retire') out[op.code] = { ...p, status: 'retired' }
  return out
}
const overlay = (products: Record<string, Product>, ops: Op[], org: string) => ops.filter((o) => o.org === org && o.state === 'pending').sort((a, b) => a.at - b.at).reduce((acc, o) => applyOp(acc, o), products)
const cacheKey = (org: string) => `qr-cache:${org}`

export const useQr = create<S>((set, get) => {
  const persist = () => { void kvSet('qr-ops', get().ops); void kvSet('qr-log', get().log.slice(0, 200)) }
  const push = (op: Op, entry?: Partial<LogEntry>) => {
    const st = get(); const log: LogEntry = { id: op.id, ts: op.at, kind: op.kind, code: op.code, text: op.text, state: 'pending', ...entry }
    set({ ops: [...st.ops, op], log: [log, ...st.log].slice(0, 200), products: applyOp(st.products, op) }); persist(); void get().flush()
  }
  const mark = (id: string, patch: Partial<LogEntry>) => set((s) => ({ log: s.log.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))
  return {
    org: '', loaded: false, error: '', offline: false, flushing: false, ops: [], log: [], hospitals: [], locs: [], products: {}, history: [], batches: [], format: DEFAULT_FORMAT, counters: {},
    init: async () => { const [ops, log] = await Promise.all([kvGet<Op[]>('qr-ops'), kvGet<LogEntry[]>('qr-log')]); set({ ops: ops ?? [], log: log ?? [] }) },
    load: async (org) => {
      if (!org) return
      let snap: Partial<S> | null = null
      try {
        const [h, l, p, hist, b, s, c] = await Promise.all([
          supabase.from('qr_hospitals').select('*').eq('org_id', org).order('name'), fetchAll('qr_locations', org, 'ward'), fetchAll('qr_products', org, 'code'),
          supabase.from('qr_history').select('*').eq('org_id', org).order('created_at', { ascending: false }).limit(1000),
          supabase.from('qr_batches').select('*').eq('org_id', org).order('created_at', { ascending: false }).limit(10),
          supabase.from('qr_settings').select('*').eq('org_id', org).maybeSingle(), supabase.from('qr_counters').select('*').eq('org_id', org),
        ])
        if (h.error) throw h.error
        const products: Record<string, Product> = {}; for (const r of p) products[r.code] = toProduct(r)
        snap = {
          hospitals: (h.data ?? []).map((r: Row) => ({ id: r.id, name: r.name, code: r.code })), locs: l.map((r) => ({ id: r.id, hospitalId: r.hospital_id, floor: r.floor, ward: r.ward, bay: r.bay })), products,
          history: (hist.data ?? []).map((r: Row) => ({ id: r.id, ts: new Date(r.created_at).getTime(), type: r.type, code: r.code, hospitalId: r.hospital_id ?? undefined, where: r.where_text || undefined, reason: r.reason ?? undefined, notes: r.notes ?? undefined, by: r.by_name, replaces: r.replaces ?? undefined })),
          batches: (b.data ?? []).map(toBatch), format: s.data ? { prefix: s.data.prefix, letters: s.data.letters, digits: s.data.digits } : DEFAULT_FORMAT, counters: Object.fromEntries((c.data ?? []).map((r: Row) => [r.series, r.last])),
        }
        void kvSet(cacheKey(org), snap); useNet.getState().set(true)
        set({ ...(snap as object), org, loaded: true, error: '', offline: false, products: overlay(snap.products as Record<string, Product>, get().ops, org) })
      } catch (e) {
        const err = e as { message?: string; code?: string }
        if (!isNetworkError(err) && useNet.getState().online) { const cached = await kvGet<Record<string, unknown>>(cacheKey(org)); if (!cached) return set({ error: err.message ?? 'Could not load the data.', loaded: true, org }) }
        if (isNetworkError(err)) useNet.getState().set(false)
        const cached = await kvGet<Record<string, unknown>>(cacheKey(org))
        if (!cached) return set({ error: 'You are offline and this phone has not loaded the curtain list yet. Connect once to download it.', loaded: true, org })
        set({ ...cached, org, loaded: true, error: '', offline: true, products: overlay(cached.products as Record<string, Product>, get().ops, org) })
      }
    },
    flush: async () => {
      if (get().flushing || !useNet.getState().online) return
      const queue = get().ops.filter((o) => o.state === 'pending').sort((a, b) => a.at - b.at); if (!queue.length) return
      const { data: sess } = await supabase.auth.getSession(); if (!sess.session) return // signed out or session lost: keep everything saved
      set({ flushing: true }); let progressed = false
      try {
        for (const op of queue) {
          const base = { p_op: op.id, p_at: new Date(op.at).toISOString() }
          const call = () => {
            const a = op.args
            if (op.kind === 'install') return supabase.rpc('qr_install', { p_org: op.org, p_code: op.code, p_hospital: a.hospital, p_floor: a.floor ?? null, p_ward: a.ward ?? null, p_bay: a.bay ?? null, p_replaces: a.replaces ?? null, ...base })
            if (op.kind === 'takedown') return supabase.rpc('qr_takedown', { p_org: op.org, p_code: op.code, p_reason: a.reason, p_notes: a.notes ?? null, ...base })
            if (op.kind === 'retire') return supabase.rpc('qr_retire', { p_org: op.org, p_code: op.code, p_notes: a.notes ?? null, ...base })
            const m = a.meta as Meta
            return supabase.rpc('qr_register', { p_org: op.org, p_codes: a.codes, p_batch: m.batch ?? null, p_size: m.size ?? null, p_colour: m.colour ?? null, p_due_days: m.dueDays ?? DEFAULT_DUE_DAYS, p_product: m.productCode ?? 'MVN191', p_type: m.type ?? 'Curtain', ...base })
          }
          let { data, error } = await call()
          if (error && (error.code === 'PGRST301' || /jwt/i.test(error.message))) { await supabase.auth.refreshSession(); ({ data, error } = await call()) }
          if (error && (isNetworkError(error) || error.code === 'PGRST301' || /jwt/i.test(error.message))) { if (isNetworkError(error)) useNet.getState().set(false); break }
          if (error || (data && data.ok === false)) {
            const msg = error?.message ?? data.message ?? 'The server refused it.'
            set((s) => ({ ops: s.ops.map((o) => (o.id === op.id ? { ...o, state: 'failed', error: msg } : o)) })); mark(op.id, { state: 'failed', message: msg }); progressed = true; continue
          }
          set((s) => ({ ops: s.ops.filter((o) => o.id !== op.id) })); mark(op.id, { state: 'sent', message: undefined }); progressed = true
        }
      } finally { set({ flushing: false }); persist() }
      if (progressed && get().org) await get().load(get().org)
    },
    retryOp: (id) => { set((s) => ({ ops: s.ops.map((o) => (o.id === id ? { ...o, state: 'pending', error: undefined } : o)), log: s.log.map((l) => (l.id === id ? { ...l, state: 'pending', message: undefined } : l)) })); persist(); void get().flush() },
    discardOp: async (id) => { set((s) => ({ ops: s.ops.filter((o) => o.id !== id), log: s.log.filter((l) => l.id !== id) })); persist(); if (get().org) await get().load(get().org) },

    register: async (codes, meta) => {
      const st = get(); const list = [...new Set(codes.map(normalise).filter(Boolean))]; const added: string[] = [], skipped: string[] = []
      for (const c of list) { const ex = st.products[c]; if (ex && ex.status !== 'removed') skipped.push(c); else added.push(c) }
      if (!added.length) return { added, skipped }
      const op: Op = { id: uid(), org: st.org, kind: 'register', at: Date.now(), code: added[0], args: { codes: added, meta }, text: added.length === 1 ? `${added[0]} registered` : `${added.length} labels registered`, state: 'pending' }
      push(op); return { added, skipped, queued: !useNet.getState().online }
    },
    install: async (code, place, opts) => {
      const st = get(); const c = normalise(code); const p = st.products[c]; const hosp = st.hospitals.find((h) => h.id === place.hospitalId)
      if (!hosp) return { ok: false, message: 'Choose the hospital first.' }
      const text = `${c} installed at ${placeText(st, place)}`; const online = useNet.getState().online
      if (!p) {
        if (online) { const { data, error } = await supabase.rpc('qr_install', { p_org: st.org, p_code: c, p_hospital: place.hospitalId, p_floor: place.floor ?? null, p_ward: place.ward ?? null, p_bay: place.bay ?? null, p_replaces: opts?.replaces ?? null, p_op: uid() }); if (error) return isNetworkError(error) ? { ok: false, message: 'No connection, and this phone does not know that code yet.' } : rpcErr(error); if (data.ok) await get().load(st.org); return data as Result }
        push({ id: uid(), org: st.org, kind: 'install', at: Date.now(), code: c, unverified: true, args: { code: c, hospital: place.hospitalId, floor: place.floor, ward: place.ward, bay: place.bay, replaces: opts?.replaces }, text, state: 'pending' })
        return { ok: true, message: `${c} saved. This phone does not know that code yet, so it will be checked when you are online.`, queued: true }
      }
      if (p.status === 'in_use') return { ok: false, message: `${c} is already installed at ${placeText(st, p.place)}.` }
      if (p.status === 'retired') return { ok: false, message: `${c} has been retired and cannot be installed.` }
      if (p.status === 'removed') return { ok: false, message: `${c} was taken down. Register it again once it is back in stock.` }
      if (place.bay && !opts?.replaces) { const taken = Object.values(st.products).find((x) => x.status === 'in_use' && x.place?.hospitalId === place.hospitalId && x.place.floor === place.floor && x.place.ward === place.ward && x.place.bay === place.bay); if (taken) return { ok: false, message: `${place.bay} already has ${taken.code}. Take it down first, or use Take down to swap it.` } }
      push({ id: uid(), org: st.org, kind: 'install', at: Date.now(), code: c, args: { code: c, hospital: place.hospitalId, floor: place.floor, ward: place.ward, bay: place.bay, replaces: opts?.replaces }, text, state: 'pending' })
      return { ok: true, message: text, queued: !online }
    },
    takeDown: async (code, reason, notes) => {
      const st = get(); const c = normalise(code); const p = st.products[c]; const online = useNet.getState().online
      if (!p) {
        if (online) { const { data, error } = await supabase.rpc('qr_takedown', { p_org: st.org, p_code: c, p_reason: reason, p_notes: notes ?? null, p_op: uid() }); if (error) return isNetworkError(error) ? { ok: false, message: 'No connection, and this phone does not know that code yet.' } : rpcErr(error); if (data.ok) await get().load(st.org); return { ok: data.ok, message: data.message, place: data.hospital_id ? { hospitalId: data.hospital_id, floor: data.floor ?? undefined, ward: data.ward ?? undefined, bay: data.bay ?? undefined } : undefined } }
        return { ok: false, message: `${c} is not on this phone’s list, and there is no connection to check it.` }
      }
      if (p.status !== 'in_use') return { ok: false, message: `${c} is not installed anywhere right now.` }
      const place = p.place
      push({ id: uid(), org: st.org, kind: 'takedown', at: Date.now(), code: c, args: { reason, notes }, text: `${c} taken down${place?.bay ? ` from ${[place.ward, place.bay].filter(Boolean).join(' · ')}` : ''}`, state: 'pending' })
      return { ok: true, message: `${c} taken down`, place, queued: !online }
    },
    retire: async (code, notes) => {
      const st = get(); const c = normalise(code); const p = st.products[c]; if (!p) return { ok: false, message: 'Not found.' }
      if (p.status === 'in_use') return { ok: false, message: 'Take it down before retiring it.' }
      push({ id: uid(), org: st.org, kind: 'retire', at: Date.now(), code: c, args: { notes }, text: `${c} retired`, state: 'pending' }); return { ok: true, message: `${c} retired`, queued: !useNet.getState().online }
    },
    importLocations: async (rows) => { if (!useNet.getState().online) return { added: 0, hospitals: 0, error: needsNet }; const { data, error } = await supabase.rpc('qr_import_locations', { p_org: get().org, p_rows: rows }); if (error) return { added: 0, hospitals: 0, error: error.message }; await get().load(get().org); return data },
    setFormat: async (f) => { if (!useNet.getState().online) return { ok: false, message: needsNet }; const { data, error } = await supabase.rpc('qr_set_format', { p_org: get().org, p_prefix: f.prefix, p_letters: f.letters, p_digits: f.digits }); if (error) return rpcErr(error); await get().load(get().org); return { ok: data.ok, message: data.message ?? '' } },
    generate: async (productCode, name, count, register, dueDays = DEFAULT_DUE_DAYS) => {
      if (!useNet.getState().online) return { error: needsNet }
      const { data, error } = await supabase.rpc('qr_generate', { p_org: get().org, p_product: productCode, p_name: name, p_count: count, p_register: register, p_due_days: dueDays })
      if (error) return { error: error.message }; if (!data.ok) return { error: data.message }
      await get().load(get().org); return { batch: get().batches.find((b) => b.id === data.id) }
    },
  }
})

/** Sends saved scans whenever the connection comes back, every so often, and when the app is reopened. */
let syncStarted = false
export function startQrSync() {
  if (syncStarted) return; syncStarted = true
  void useQr.getState().init().then(() => void useQr.getState().flush())
  useNet.subscribe((s, p) => { if (s.online && !p.online) void useQr.getState().flush() })
  setInterval(() => void useQr.getState().flush(), 20000)
  if (isNative) void CapApp.addListener('appStateChange', (s) => { if (s.isActive) void useQr.getState().flush() })
}

/** Which client's curtain data the current page is showing. Super Admin picks one; everyone else has their own. */
export function useQrOrg() {
  const role = useStore((s) => s.role); const qrOrg = useStore((s) => s.qrOrg); const orgs = useAuth((s) => s.orgs)
  return role !== 'superadmin' ? role : qrOrg || orgs.find((o) => o.id === 'synergy')?.id || orgs[0]?.id || ''
}
/** Loads the curtain data for the current client and refreshes it while a page is open. */
export function useQrLoad(everyMs = 30000) {
  const org = useQrOrg(); const load = useQr((s) => s.load)
  useEffect(() => { if (!org) return; void load(org); const id = setInterval(() => void load(org), everyMs); return () => clearInterval(id) }, [org, load, everyMs])
}

export const placeText = (s: { hospitals: Hospital[] }, p?: Place) => (p ? [s.hospitals.find((h) => h.id === p.hospitalId)?.name, p.floor, p.ward, p.bay].filter(Boolean).join(' · ') : 'Not installed')
export const daysLeft = (p: Product) => (p.dueAt ? Math.ceil((p.dueAt - Date.now()) / DAY) : null)
export const isOverdue = (p: Product) => p.status === 'in_use' && (daysLeft(p) ?? 1) < 0
export const isDueSoon = (p: Product) => p.status === 'in_use' && (daysLeft(p) ?? 99) >= 0 && (daysLeft(p) ?? 99) <= 30
export const STATUS_LABEL: Record<Status, string> = { registered: 'In stock', in_use: 'In use', removed: 'Taken down', retired: 'Retired' }
export const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
export const fmtDateTime = (ts: number) => new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
export const batchCodes = (b: Batch, from = 0, n = b.count) => Array.from({ length: Math.min(n, b.count - from) }, (_, i) => `${b.prefix}-${b.productCode}-${serialCode(b.start + from + i, b.fmt)}`)
