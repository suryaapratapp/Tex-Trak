import { useEffect, useMemo, useRef } from 'react'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useStore } from '../store'
import { App as CapApp } from '@capacitor/app'
import { isNative, isNetworkError, kvGet, kvSet, useNet } from '../lib/offline'

export type Status = 'available' | 'quarantine' | 'repair' | 'scrap'
export const STATUS_LABEL: Record<Status, string> = { available: 'Available', quarantine: 'Quarantine', repair: 'To repair', scrap: 'Beyond repair' }
export const STATUS_TONE: Record<Status, 'green' | 'amber' | 'blue' | 'red'> = { available: 'green', quarantine: 'amber', repair: 'blue', scrap: 'red' }
export type LocKind = 'warehouse' | 'zone' | 'shelf' | 'bin' | 'dock' | 'quarantine' | 'damage' | 'packing'
export const LOC_KINDS: LocKind[] = ['warehouse', 'zone', 'shelf', 'bin', 'dock', 'quarantine', 'damage', 'packing']
export const KIND_LABEL: Record<string, string> = { receive: 'Goods in', move: 'Move', issue: 'Goods out', pack: 'Packed', unpack: 'Unpacked', dispatch: 'Dispatched', damage: 'Damage', repair: 'Repair', quarantine: 'Quarantine', release: 'Released', adjust: 'Adjustment', count: 'Count', writeoff: 'Write-off' }
export const REASONS: { value: string; label: string }[] = [{ value: 'sale', label: 'Sale or customer' }, { value: 'production', label: 'Used in production' }, { value: 'sample', label: 'Sample or testing' }, { value: 'disposal', label: 'Disposal' }, { value: 'return_supplier', label: 'Return to supplier' }, { value: 'other', label: 'Other' }]

export interface Item { id: string; sku: string; name: string; description: string; category: string; uom: string; barcode: string; reorderPoint: number; reorderQty: number; leadDays: number; supplier: string; unitCost: number; trackExpiry: boolean; active: boolean; createdAt: string }
export interface Loc { id: string; code: string; name: string; kind: LocKind; parentId: string | null; capacity: number | null; active: boolean }
export interface Stock { itemId: string; locId: string; lot: string; status: Status; expiry: string | null; qty: number; updatedAt: string }
export interface CodeRow { code: string; itemId: string; kind: string; packQty: number }
export interface Partner { id: string; name: string; kind: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
const toItem = (r: Row): Item => ({ id: r.id, sku: r.sku, name: r.name, description: r.description ?? '', category: r.category ?? '', uom: r.uom ?? 'unit', barcode: r.barcode ?? '', reorderPoint: +r.reorder_point, reorderQty: +r.reorder_qty, leadDays: r.lead_time_days, supplier: r.supplier ?? '', unitCost: +r.unit_cost, trackExpiry: r.track_expiry, active: r.active, createdAt: r.created_at })
const toLoc = (r: Row): Loc => ({ id: r.id, code: r.code, name: r.name, kind: r.kind, parentId: r.parent_id, capacity: r.capacity == null ? null : +r.capacity, active: r.active })
const toStock = (r: Row): Stock => ({ itemId: r.item_id, locId: r.location_id, lot: r.lot, status: r.status, expiry: r.expiry, qty: +r.qty, updatedAt: r.updated_at })

async function fetchAll(table: string, org: string, orders: string[]) {
  const out: Row[] = []
  for (let from = 0; from < 200000; from += 1000) {
    let q = supabase.from(table).select('*').eq('org_id', org)
    for (const o of orders) q = q.order(o)
    const { data, error } = await q.range(from, from + 999)
    if (error) throw error
    out.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  return out
}

export interface Prefill { itemId?: string; locId?: string; orderNumber?: string; code?: string }
export interface WOp { id: string; org: string; name: string; args: Record<string, unknown>; at: number; text: string; state: 'pending' | 'failed'; error?: string }
/** Work that can be done with no signal. The rest (orders, edits, imports) needs a connection. */
const QUEUEABLE: Record<string, string> = { wh_receive: 'Goods in', wh_issue: 'Goods out', wh_pack: 'Pack order', wh_move: 'Move', wh_stock_action: 'Stock change', wh_count: 'Cycle count' }
interface Snap { items: Item[]; locs: Loc[]; base: Stock[]; codes: CodeRow[]; partners: Partner[] }
interface S extends Snap {
  org: string; loaded: boolean; error: string; offline: boolean; flushing: boolean
  stock: Stock[]; ops: WOp[]
  prefill: Prefill | null; orderFocus: string | null
  load: (org: string) => Promise<void>
  setPrefill: (p: Prefill | null) => void
  enqueue: (name: string, args: Record<string, unknown>) => void
  flush: () => Promise<void>
  retryOp: (id: string) => void
  discardOp: (id: string) => void
}

const skey = (s: { itemId: string; locId: string; lot: string; status: Status }) => `${s.itemId}|${s.locId}|${s.lot}|${s.status}`
const STATUS_OF: Record<string, Status> = { pass: 'available', hold: 'quarantine', repair: 'repair', scrap: 'scrap' }
const ACTION_MAP: Record<string, [Status, Status | null]> = { damage_repair: ['available', 'repair'], damage_scrap: ['available', 'scrap'], repair_ok: ['repair', 'available'], repair_fail: ['repair', 'scrap'], quarantine: ['available', 'quarantine'], release: ['quarantine', 'available'] }
/** What saved-but-unsent work does to the stock, so the screen shows the result straight away. The server repeats the same rules when it receives them. */
function overlay(base: Stock[], ops: WOp[], org: string): Stock[] {
  const pend = ops.filter((o) => o.org === org && o.state === 'pending'); if (!pend.length) return base
  const m = new Map<string, Stock>(base.map((s) => [skey(s), { ...s }]))
  const add = (itemId: string, locId: string, lot: string, status: Status, expiry: string | null, d: number) => {
    const k = skey({ itemId, locId, lot, status }); const cur = m.get(k)
    if (cur) cur.qty += d; else if (d > 0) m.set(k, { itemId, locId, lot, status, expiry, qty: d, updatedAt: new Date().toISOString() })
  }
  const today = new Date().toISOString().slice(0, 10)
  const pick = (itemId: string, qty: number, locId?: string | null, lot?: string | null) => {
    const rows = [...m.values()].filter((s) => s.itemId === itemId && s.status === 'available' && s.qty > 0 && (!locId || s.locId === locId) && (!lot || s.lot === lot) && (!s.expiry || s.expiry >= today))
      .sort((a, b) => (a.expiry ? 0 : 1) - (b.expiry ? 0 : 1) || (a.expiry ?? '').localeCompare(b.expiry ?? '') || a.updatedAt.localeCompare(b.updatedAt))
    let need = qty; for (const r of rows) { if (need <= 0) break; const t = Math.min(r.qty, need); r.qty -= t; need -= t }
  }
  type L = { item: string; qty: number; location?: string | null; lot?: string | null; expiry?: string | null; qc?: string; counted?: number }
  for (const o of pend) {
    const a = o.args as Record<string, unknown>; const lines = (a.p_lines as L[] | undefined) ?? []
    if (o.name === 'wh_receive') for (const l of lines) add(l.item, l.location!, (l.lot ?? '').toUpperCase(), STATUS_OF[l.qc ?? 'pass'] ?? 'available', l.expiry ?? null, +l.qty)
    else if (o.name === 'wh_issue' || o.name === 'wh_pack') for (const l of lines) pick(l.item, +l.qty, l.location, l.lot)
    else if (o.name === 'wh_move') { const lot = String(a.p_lot ?? '').toUpperCase(); const st = (a.p_status as Status) ?? 'available'; const src = m.get(skey({ itemId: a.p_item as string, locId: a.p_from as string, lot, status: st })); const q = +(a.p_qty as number); if (src) { src.qty -= q; add(a.p_item as string, a.p_to as string, lot, st, src.expiry, q) } }
    else if (o.name === 'wh_stock_action') {
      const act = a.p_action as string; const item = a.p_item as string; const loc = a.p_loc as string; const lot = String(a.p_lot ?? '').toUpperCase(); const q = +(a.p_qty as number)
      if (act === 'adjust') { const cur = m.get(skey({ itemId: item, locId: loc, lot, status: 'available' })); add(item, loc, lot, 'available', cur?.expiry ?? null, q) }
      else if (act === 'writeoff') { const cur = m.get(skey({ itemId: item, locId: loc, lot, status: (a.p_status as Status) ?? 'available' })); if (cur) cur.qty -= q }
      else { const [from, to] = ACTION_MAP[act] ?? ['available', null]; const cur = m.get(skey({ itemId: item, locId: loc, lot, status: from })); if (cur) { cur.qty -= q; if (to) add(item, loc, lot, to, cur.expiry, q) } }
    } else if (o.name === 'wh_count') for (const l of lines) { const lot = (l.lot ?? '').toUpperCase(); const k = skey({ itemId: l.item, locId: a.p_loc as string, lot, status: 'available' }); const cur = m.get(k); if (cur) cur.qty = +(l.counted ?? 0); else add(l.item, a.p_loc as string, lot, 'available', l.expiry ?? null, +(l.counted ?? 0)) }
  }
  return [...m.values()].filter((s) => s.qty > 0.0000001)
}
const cacheKey = (org: string) => `wh-cache:${org}`
const opText = (name: string, args: Record<string, unknown>) => { const n = Array.isArray(args.p_lines) ? (args.p_lines as unknown[]).length : 1; return `${QUEUEABLE[name] ?? name}${name === 'wh_move' || name === 'wh_stock_action' ? '' : ` · ${n} line${n === 1 ? '' : 's'}`}` }

export const useWh = create<S>((set, get) => {
  const persist = () => { void kvSet('wh-ops', get().ops) }
  const show = (base: Stock[], ops = get().ops, org = get().org) => ({ base, stock: overlay(base, ops, org) })
  return {
    org: '', loaded: false, error: '', offline: false, flushing: false, items: [], locs: [], base: [], stock: [], codes: [], partners: [], ops: [], prefill: null, orderFocus: null,
    setPrefill: (prefill) => set({ prefill }),
    load: async (org) => {
      if (!org) return
      try {
        const [i, l, s, c, p] = await Promise.all([fetchAll('wh_items', org, ['sku']), fetchAll('wh_locations', org, ['code']), fetchAll('wh_stock', org, ['item_id', 'location_id', 'lot', 'status']), fetchAll('wh_codes', org, ['code']), fetchAll('wh_partners', org, ['name'])])
        const snap: Snap = { items: i.map(toItem), locs: l.map(toLoc), base: s.map(toStock), codes: c.map((r) => ({ code: r.code, itemId: r.item_id, kind: r.kind, packQty: +r.pack_qty })), partners: p.map((r) => ({ id: r.id, name: r.name, kind: r.kind })) }
        void kvSet(cacheKey(org), snap); useNet.getState().set(true)
        set({ ...snap, ...show(snap.base, get().ops, org), org, loaded: true, error: '', offline: false })
      } catch (e) {
        const err = e as { message?: string }; const net = isNetworkError(err)
        if (net) useNet.getState().set(false)
        if (get().org === org && get().loaded) { if (net) set({ offline: true }); return } // keep showing what we have
        const cached = net ? await kvGet<Snap>(cacheKey(org)) : undefined
        if (cached) return set({ ...cached, ...show(cached.base, get().ops, org), org, loaded: true, error: '', offline: true })
        set({ org, loaded: true, error: net ? 'You are offline and this device has not loaded the warehouse yet. Connect once to download it.' : err.message ?? 'Could not load the warehouse data.' })
      }
    },
    enqueue: (name, args) => {
      const op: WOp = { id: (args.p_op as string) ?? uid(), org: get().org, name, args, at: Date.now(), text: opText(name, args), state: 'pending' }
      const ops = [...get().ops, op]; set({ ops, ...show(get().base, ops) }); persist()
    },
    flush: async () => {
      if (get().flushing || !useNet.getState().online) return
      const queue = get().ops.filter((o) => o.state === 'pending').sort((a, b) => a.at - b.at); if (!queue.length) return
      const { data: sess } = await supabase.auth.getSession(); if (!sess.session) return // signed out: keep everything saved
      set({ flushing: true }); let progressed = false
      try {
        for (const op of queue) {
          const { data, error } = await supabase.rpc(op.name, { p_org: op.org, ...op.args })
          if (!error) { progressed = true; set({ ops: get().ops.filter((o) => o.id !== op.id) }); persist(); continue }
          if (isNetworkError(error)) { useNet.getState().set(false); break }
          progressed = true; void data
          set({ ops: get().ops.map((o) => (o.id === op.id ? { ...o, state: 'failed', error: error.message } : o)) }); persist()
        }
      } finally { set({ flushing: false }) }
      if (progressed) await get().load(get().org)
    },
    retryOp: (id) => { set({ ops: get().ops.map((o) => (o.id === id ? { ...o, state: 'pending', error: undefined } : o)) }); persist(); set(show(get().base)); void get().flush() },
    discardOp: (id) => { set({ ops: get().ops.filter((o) => o.id !== id) }); persist(); set(show(get().base)) },
  }
})

let syncStarted = false
/** Loads saved work from the device, then sends it whenever the connection returns, every 20 seconds, and when the app is reopened. */
export function startWhSync() {
  if (syncStarted) return; syncStarted = true
  void kvGet<WOp[]>('wh-ops').then((ops) => { if (ops?.length) { useWh.setState({ ops }); useWh.setState({ stock: overlay(useWh.getState().base, ops, useWh.getState().org) }) } void useWh.getState().flush() })
  useNet.subscribe((s, p) => { if (s.online && !p.online) void useWh.getState().flush() })
  setInterval(() => void useWh.getState().flush(), 20000)
  if (isNative) void CapApp.addListener('appStateChange', (s) => { if (s.isActive) void useWh.getState().flush() })
}

export function useWhOrg() {
  const role = useStore((s) => s.role); const whOrg = useStore((s) => s.whOrg); const orgs = useAuth((s) => s.orgs)
  return role !== 'superadmin' ? role : whOrg || orgs[0]?.id || ''
}
export function useWhLoad(everyMs = 30000) {
  const org = useWhOrg(); const load = useWh((s) => s.load)
  useEffect(() => { if (!org) return; void load(org); const id = setInterval(() => void load(org), everyMs); return () => clearInterval(id) }, [org, load, everyMs])
}

export const friendly = (m: string) => (/Failed to fetch|NetworkError|network|Load failed/i.test(m) ? 'No connection. Nothing was saved, so you can safely try again when you are online.' : m)
export interface RpcResult { ok: boolean; message: string; data?: Row; queued?: boolean }
const SAVED = 'Saved on this device. It will be sent when you are back online.'
/** Calls a warehouse function for the current client. With no signal, everyday work is saved on the device and sent later. */
export async function whRpc(name: string, args: Record<string, unknown>): Promise<RpcResult> {
  const org = useWh.getState().org; const queueable = name in QUEUEABLE
  if (!useNet.getState().online) { if (queueable) { useWh.getState().enqueue(name, args); return { ok: true, message: SAVED, queued: true } } return { ok: false, message: 'This needs a connection. Try again when you are online.' } }
  try {
    const { data, error } = await supabase.rpc(name, { p_org: org, ...args })
    if (error) {
      if (isNetworkError(error)) { useNet.getState().set(false); if (queueable) { useWh.getState().enqueue(name, args); return { ok: true, message: SAVED, queued: true } } }
      return { ok: false, message: friendly(error.message) }
    }
    await useWh.getState().load(org)
    return { ok: true, message: (data?.message as string) ?? 'Saved.', data: data ?? {} }
  } catch (e) {
    if (queueable) { useNet.getState().set(false); useWh.getState().enqueue(name, args); return { ok: true, message: SAVED, queued: true } }
    return { ok: false, message: friendly((e as Error).message) }
  }
}
/** Direct table write (items, locations, codes, partners). */
export async function whWrite(p: PromiseLike<{ error: { message: string } | null }>): Promise<RpcResult> {
  const { error } = await p
  if (error) return { ok: false, message: /violates foreign key/i.test(error.message) ? 'This has stock or history, so it cannot be deleted. Switch it off instead.' : /duplicate key/i.test(error.message) ? 'That code or name is already in use.' : friendly(error.message) }
  await useWh.getState().load(useWh.getState().org)
  return { ok: true, message: 'Saved.' }
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
/** One id per submit. Reused if the save fails, so a retry can never double-count. */
export function useOp() { const r = useRef(uid()); return { op: () => r.current, renew: () => { r.current = uid() } } }

export const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '')
export function useIndex() {
  const items = useWh((s) => s.items); const locs = useWh((s) => s.locs); const stock = useWh((s) => s.stock); const codes = useWh((s) => s.codes)
  return useMemo(() => {
    const itemById = new Map(items.map((i) => [i.id, i])); const locById = new Map(locs.map((l) => [l.id, l])); const locByCode = new Map(locs.map((l) => [l.code, l]))
    const itemByCode = new Map<string, { item: Item; packQty: number }>()
    for (const c of codes) { const it = itemById.get(c.itemId); if (it) itemByCode.set(c.code, { item: it, packQty: c.packQty }) }
    const stockByItem = new Map<string, Stock[]>(); const stockByLoc = new Map<string, Stock[]>()
    for (const s of stock) { (stockByItem.get(s.itemId) ?? stockByItem.set(s.itemId, []).get(s.itemId)!).push(s); (stockByLoc.get(s.locId) ?? stockByLoc.set(s.locId, []).get(s.locId)!).push(s) }
    return { items, locs, stock, itemById, locById, locByCode, itemByCode, stockByItem, stockByLoc }
  }, [items, locs, stock, codes])
}
export type Index = ReturnType<typeof useIndex>

export type Resolved = { kind: 'item'; item: Item; packQty: number } | { kind: 'loc'; loc: Loc } | { kind: 'order'; number: string } | null
/** Works out what a scanned or typed code means: item, location or order. Understands our own QR labels (WH:I:, WH:L:, WH:O:) and barcodes with or without leading zeros. */
export function resolveCode(ix: Index, raw: string): Resolved {
  let c = norm(raw); if (!c) return null
  let hint = ''
  const m = /^WH:([ILO]):(.+)$/.exec(c); if (m) { hint = m[1]; c = m[2] }
  const vars = [c]; if (/^\d+$/.test(c)) { const t = c.replace(/^0+/, ''); for (const n of [t, ...[8, 12, 13, 14].map((len) => t.padStart(len, '0'))]) if (n && !vars.includes(n)) vars.push(n) }
  if (hint !== 'L' && hint !== 'O') for (const v of vars) { const hit = ix.itemByCode.get(v); if (hit) return { kind: 'item', item: hit.item, packQty: hit.packQty } }
  if (hint !== 'I' && hint !== 'O') for (const v of vars) { const l = ix.locByCode.get(v); if (l) return { kind: 'loc', loc: l } }
  if (hint === 'O' || /^(PK|GI|GO)-\d+$/.test(c)) return { kind: 'order', number: c }
  return null
}

export interface Pick { locId: string; lot: string; expiry: string | null; take: number }
/** Same rule as the database: first-expiry-first-out, then oldest stock; expired and held stock is never picked. */
export function planPick(ix: Index, itemId: string, qty: number, locId?: string, lot?: string): { picks: Pick[]; short: number } {
  const today = new Date().toISOString().slice(0, 10)
  const rows = (ix.stockByItem.get(itemId) ?? []).filter((s) => s.status === 'available' && (!locId || s.locId === locId) && (!lot || s.lot === lot) && (!s.expiry || s.expiry >= today))
    .sort((a, b) => (a.expiry ? 0 : 1) - (b.expiry ? 0 : 1) || (a.expiry ?? '').localeCompare(b.expiry ?? '') || a.updatedAt.localeCompare(b.updatedAt))
  let need = qty; const picks: Pick[] = []
  for (const r of rows) { if (need <= 0) break; const t = Math.min(r.qty, need); picks.push({ locId: r.locId, lot: r.lot, expiry: r.expiry, take: t }); need -= t }
  return { picks, short: Math.max(0, need) }
}
export const onHand = (ix: Index, itemId: string, status: Status = 'available') => (ix.stockByItem.get(itemId) ?? []).filter((s) => s.status === status).reduce((a, s) => a + s.qty, 0)

export const fmtQty = (n: number | string) => Number(n).toLocaleString('en-GB', { maximumFractionDigits: 3 })
export const fmtMoney = (n: number) => n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: n >= 1000 ? 0 : 2 })
export const fmtDate = (d: string | null | undefined) => (d ? new Date(d.length <= 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–')
export const fmtWhen = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
export const daysTo = (d: string) => Math.ceil((new Date(d + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 86400000)
export const locName = (ix: Index, id: string | null | undefined) => (id ? ix.locById.get(id)?.code ?? '?' : '–')
export function csvDownload(name: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' })); a.download = name; a.click()
}
/** Small, dependable CSV reader: quotes, commas and line breaks inside quotes. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let cur: string[] = []; let f = ''; let q = false
  const t = text.replace(/^﻿/, '')
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { f += '"'; i++ } else q = false } else f += ch }
    else if (ch === '"') q = true
    else if (ch === ',') { cur.push(f); f = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; cur.push(f); f = ''; if (cur.some((x) => x.trim())) rows.push(cur); cur = [] }
    else f += ch
  }
  cur.push(f); if (cur.some((x) => x.trim())) rows.push(cur)
  if (!rows.length) return []
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])))
}

export const STATUS_ORDER_LABEL: Record<string, string> = { packed: 'Packed', part_unpacked: 'Part unpacked', unpacked: 'Unpacked', dispatched: 'Dispatched' }
