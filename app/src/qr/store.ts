import { useEffect } from 'react'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useStore } from '../store'

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
    if (error || !data) break; out.push(...data); if (data.length < 1000) break
  }
  return out
}

interface S {
  org: string; loaded: boolean; error: string
  hospitals: Hospital[]; locs: Loc[]; products: Record<string, Product>; history: Hist[]; batches: Batch[]; format: CodeFormat; counters: Record<string, number>
  load: (org: string) => Promise<void>
  register: (codes: string[], meta: { batch?: string; size?: string; colour?: string; productCode?: string; type?: string; dueDays?: number }) => Promise<{ added: string[]; skipped: string[]; error?: string }>
  install: (code: string, place: Place, opts?: { replaces?: string }) => Promise<Result>
  takeDown: (code: string, reason: Reason, notes?: string) => Promise<Result & { place?: Place }>
  retire: (code: string, notes?: string) => Promise<Result>
  importLocations: (rows: { hospital: string; code?: string; floor?: string; ward: string; bay: string }[]) => Promise<{ added: number; hospitals: number; error?: string }>
  setFormat: (f: CodeFormat) => Promise<Result>
  generate: (productCode: string, name: string, count: number, register: boolean, dueDays?: number) => Promise<{ batch?: Batch; error?: string }>
}
const rpcErr = (e: { message: string }): Result => ({ ok: false, message: e.message })

export const useQr = create<S>((set, get) => ({
  org: '', loaded: false, error: '', hospitals: [], locs: [], products: {}, history: [], batches: [], format: DEFAULT_FORMAT, counters: {},
  load: async (org) => {
    if (!org) return
    const [h, l, p, hist, b, s, c] = await Promise.all([
      supabase.from('qr_hospitals').select('*').eq('org_id', org).order('name'), fetchAll('qr_locations', org, 'ward'), fetchAll('qr_products', org, 'code'),
      supabase.from('qr_history').select('*').eq('org_id', org).order('created_at', { ascending: false }).limit(1000),
      supabase.from('qr_batches').select('*').eq('org_id', org).order('created_at', { ascending: false }).limit(10),
      supabase.from('qr_settings').select('*').eq('org_id', org).maybeSingle(), supabase.from('qr_counters').select('*').eq('org_id', org),
    ])
    if (h.error) return set({ error: h.error.message, loaded: true, org })
    const products: Record<string, Product> = {}; for (const r of p) products[r.code] = toProduct(r)
    set({
      org, loaded: true, error: '', hospitals: (h.data ?? []).map((r: Row) => ({ id: r.id, name: r.name, code: r.code })), locs: l.map((r) => ({ id: r.id, hospitalId: r.hospital_id, floor: r.floor, ward: r.ward, bay: r.bay })), products,
      history: (hist.data ?? []).map((r: Row) => ({ id: r.id, ts: new Date(r.created_at).getTime(), type: r.type, code: r.code, hospitalId: r.hospital_id ?? undefined, where: r.where_text || undefined, reason: r.reason ?? undefined, notes: r.notes ?? undefined, by: r.by_name, replaces: r.replaces ?? undefined })),
      batches: (b.data ?? []).map(toBatch), format: s.data ? { prefix: s.data.prefix, letters: s.data.letters, digits: s.data.digits } : DEFAULT_FORMAT, counters: Object.fromEntries((c.data ?? []).map((r: Row) => [r.series, r.last])),
    })
  },
  register: async (codes, meta) => {
    const { data, error } = await supabase.rpc('qr_register', { p_org: get().org, p_codes: codes.map(normalise).filter(Boolean), p_batch: meta.batch ?? null, p_size: meta.size ?? null, p_colour: meta.colour ?? null, p_due_days: meta.dueDays ?? DEFAULT_DUE_DAYS, p_product: meta.productCode ?? 'MVN191', p_type: meta.type ?? 'Curtain' })
    if (error) return { added: [], skipped: [], error: error.message }
    await get().load(get().org); return { added: data.added ?? [], skipped: data.skipped ?? [] }
  },
  install: async (code, place, opts) => {
    const { data, error } = await supabase.rpc('qr_install', { p_org: get().org, p_code: code, p_hospital: place.hospitalId, p_floor: place.floor ?? null, p_ward: place.ward ?? null, p_bay: place.bay ?? null, p_replaces: opts?.replaces ?? null })
    if (error) return rpcErr(error); await get().load(get().org); return data as Result
  },
  takeDown: async (code, reason, notes) => {
    const { data, error } = await supabase.rpc('qr_takedown', { p_org: get().org, p_code: code, p_reason: reason, p_notes: notes ?? null })
    if (error) return rpcErr(error); await get().load(get().org)
    return { ok: data.ok, message: data.message, place: data.hospital_id ? { hospitalId: data.hospital_id, floor: data.floor ?? undefined, ward: data.ward ?? undefined, bay: data.bay ?? undefined } : undefined }
  },
  retire: async (code, notes) => { const { data, error } = await supabase.rpc('qr_retire', { p_org: get().org, p_code: code, p_notes: notes ?? null }); if (error) return rpcErr(error); await get().load(get().org); return data as Result },
  importLocations: async (rows) => { const { data, error } = await supabase.rpc('qr_import_locations', { p_org: get().org, p_rows: rows }); if (error) return { added: 0, hospitals: 0, error: error.message }; await get().load(get().org); return data },
  setFormat: async (f) => { const { data, error } = await supabase.rpc('qr_set_format', { p_org: get().org, p_prefix: f.prefix, p_letters: f.letters, p_digits: f.digits }); if (error) return rpcErr(error); await get().load(get().org); return { ok: data.ok, message: data.message ?? '' } },
  generate: async (productCode, name, count, register, dueDays = DEFAULT_DUE_DAYS) => {
    const { data, error } = await supabase.rpc('qr_generate', { p_org: get().org, p_product: productCode, p_name: name, p_count: count, p_register: register, p_due_days: dueDays })
    if (error) return { error: error.message }; if (!data.ok) return { error: data.message }
    await get().load(get().org); return { batch: get().batches.find((b) => b.id === data.id) }
  },
}))

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
