import { useEffect, useMemo, useState } from 'react'
import { Boxes, PackageCheck, PackageMinus, Search, Tag, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { inputCls } from '../qr/ui'

export type Source = 'wh_order' | 'wh_goods_out' | 'qr' | 'rfid' | 'typed'
export interface Line { source: Source; ref: string; label: string; qty: number; sub?: string }
interface Cand extends Line { group?: string }

const TABS: { id: Exclude<Source, 'typed'>; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'wh_order', label: 'Packed orders', icon: <PackageCheck size={15} />, hint: 'Orders packed in Warehouse and waiting to go. Shipping them marks the order as dispatched.' },
  { id: 'wh_goods_out', label: 'Goods out', icon: <PackageMinus size={15} />, hint: 'Stock you recorded leaving the warehouse in the last 60 days.' },
  { id: 'qr', label: 'Curtains', icon: <Tag size={15} />, hint: 'Curtains with a QR code. Pick the ones going on this shipment.' },
  { id: 'rfid', label: 'Laundry items', icon: <Boxes size={15} />, hint: 'RFID-tagged linen and equipment.' },
]
const QR_STATUS: Record<string, string> = { registered: 'In stock', removed: 'Taken down', in_use: 'In use', retired: 'Retired' }
const RFID_STATUS: Record<string, string> = { clean: 'Clean', in_stock: 'In stock', soiled: 'Soiled', in_cage: 'In dirty cage', in_use: 'In use', processing: 'Processing', in_transit: 'In transit', missing: 'Missing' }
const num = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 3 })

type Used = Map<string, string> // "source:ref" -> shipment ref

async function loadUsed(org: string): Promise<Used> {
  const m: Used = new Map()
  const { data } = await supabase.from('shipment_lines').select('source,ref_id,shipments(ref,status)').eq('org_id', org).limit(5000)
  for (const r of (data ?? []) as unknown as { source: string; ref_id: string; shipments: { ref: string; status: string } | null }[]) if (r.shipments && r.shipments.status !== 'cancelled') m.set(`${r.source}:${r.ref_id}`, r.shipments.ref)
  return m
}

async function loadSource(org: string, src: Exclude<Source, 'typed'>, status: string): Promise<{ rows: Cand[]; note?: string }> {
  if (src === 'wh_order') {
    const { data: ords, error } = await supabase.from('wh_orders').select('id,number,customer,reference,status').eq('org_id', org).in('status', ['packed', 'part_unpacked']).order('packed_at', { ascending: false }).limit(300)
    if (error) return { rows: [], note: 'The Warehouse module is not available for this account.' }
    const ids = (ords ?? []).map((o) => o.id as string); if (!ids.length) return { rows: [] }
    const [{ data: ls }, { data: its }] = await Promise.all([supabase.from('wh_order_lines').select('order_id,item_id,qty,unpacked_qty').in('order_id', ids), supabase.from('wh_items').select('id,sku,name').eq('org_id', org).limit(5000)])
    const nm = new Map((its ?? []).map((i) => [i.id as string, i.name as string]))
    return { rows: (ords ?? []).map((o) => {
      const mine = (ls ?? []).filter((l) => l.order_id === o.id); const q = mine.reduce((a, l) => a + Number(l.qty) - Number(l.unpacked_qty), 0)
      return { source: 'wh_order' as const, ref: o.id as string, label: `${o.number} · ${o.customer}`, qty: q, sub: mine.filter((l) => Number(l.qty) - Number(l.unpacked_qty) > 0).map((l) => `${num(Number(l.qty) - Number(l.unpacked_qty))} × ${nm.get(l.item_id as string) ?? 'item'}`).join(', ') }
    }).filter((r) => r.qty > 0) }
  }
  if (src === 'wh_goods_out') {
    const since = new Date(Date.now() - 60 * 86400000).toISOString()
    const { data: mv, error } = await supabase.from('wh_moves').select('ref,item_id,qty,notes,reason,created_at').eq('org_id', org).eq('kind', 'issue').gte('created_at', since).order('created_at', { ascending: false }).limit(3000)
    if (error) return { rows: [], note: 'The Warehouse module is not available for this account.' }
    const { data: its } = await supabase.from('wh_items').select('id,name').eq('org_id', org).limit(5000); const nm = new Map((its ?? []).map((i) => [i.id as string, i.name as string]))
    const g = new Map<string, { qty: number; names: Map<string, number>; note: string; at: string }>()
    for (const m of mv ?? []) { const k = (m.ref as string) || 'GO'; const e = g.get(k) ?? { qty: 0, names: new Map(), note: (m.notes as string) ?? '', at: m.created_at as string }; e.qty += Number(m.qty); const n = nm.get(m.item_id as string) ?? 'item'; e.names.set(n, (e.names.get(n) ?? 0) + Number(m.qty)); g.set(k, e) }
    return { rows: [...g.entries()].map(([ref, e]) => ({ source: 'wh_goods_out' as const, ref, label: `${ref}${e.note ? ' · ' + e.note.split('.')[0].replace(/^To: /, 'to ') : ''}`, qty: e.qty, sub: [...e.names.entries()].map(([n, q]) => `${num(q)} × ${n}`).join(', ') })) }
  }
  if (src === 'qr') {
    let q = supabase.from('qr_products').select('code,type,size,colour,status').eq('org_id', org).order('code').limit(2000); if (status !== 'all') q = q.eq('status', status)
    const { data, error } = await q; if (error) return { rows: [], note: 'Curtains are not available for this account.' }
    return { rows: (data ?? []).map((p) => ({ source: 'qr' as const, ref: p.code as string, label: p.code as string, qty: 1, sub: [p.type, p.size, p.colour].filter(Boolean).join(' · '), group: QR_STATUS[p.status as string] ?? p.status })) }
  }
  let q = supabase.from('items').select('id,epc,qr,product,status').eq('org_id', org).order('product').limit(2000); if (status !== 'all') q = q.eq('status', status)
  const { data, error } = await q; if (error) return { rows: [], note: 'Laundry items are not available for this account.' }
  return { rows: (data ?? []).map((i) => ({ source: 'rfid' as const, ref: i.id as string, label: (i.qr as string) || (i.epc as string) || (i.id as string).slice(0, 8), qty: 1, sub: i.product as string, group: RFID_STATUS[i.status as string] ?? i.status })) }
}

/** Pick exactly what is on a shipment from Warehouse, curtains or laundry items. */
export function ShipmentContents({ org, lines, setLines }: { org: string; lines: Line[]; setLines: (l: Line[]) => void }) {
  const [tab, setTab] = useState<Exclude<Source, 'typed'>>('wh_order'); const [status, setStatus] = useState('all'); const [q, setQ] = useState('')
  const [rows, setRows] = useState<Cand[]>([]); const [note, setNote] = useState(''); const [busy, setBusy] = useState(true); const [used, setUsed] = useState<Used>(new Map())
  useEffect(() => { let off = false; void loadUsed(org).then((u) => { if (!off) setUsed(u) }); return () => { off = true } }, [org])
  useEffect(() => {
    let off = false; setBusy(true); setNote('')
    void loadSource(org, tab, status).then((r) => { if (off) return; setRows(r.rows); setNote(r.note ?? ''); setBusy(false) })
    return () => { off = true }
  }, [org, tab, status])
  const key = (l: { source: string; ref: string }) => `${l.source}:${l.ref}`
  const picked = useMemo(() => new Set(lines.map(key)), [lines])
  const shown = useMemo(() => rows.filter((r) => `${r.label} ${r.sub ?? ''}`.toLowerCase().includes(q.toLowerCase())), [rows, q])
  const free = shown.filter((r) => !used.has(key(r)))
  const toggle = (r: Cand) => setLines(picked.has(key(r)) ? lines.filter((l) => key(l) !== key(r)) : [...lines, { source: r.source, ref: r.ref, label: r.label, qty: r.qty, sub: r.sub }])
  const allPicked = free.length > 0 && free.every((r) => picked.has(key(r)))
  const selectAll = () => setLines(allPicked ? lines.filter((l) => !free.some((r) => key(r) === key(l))) : [...lines, ...free.filter((r) => !picked.has(key(r))).map((r) => ({ source: r.source, ref: r.ref, label: r.label, qty: r.qty, sub: r.sub }))])
  const total = lines.reduce((a, l) => a + l.qty, 0); const cur = TABS.find((t) => t.id === tab)!
  const statuses = tab === 'qr' ? QR_STATUS : tab === 'rfid' ? RFID_STATUS : null
  return (
    <div className="rounded-xl border border-stone-200">
      <div className="flex flex-wrap gap-2 border-b border-stone-100 p-3">{TABS.map((t) => <button key={t.id} type="button" onClick={() => { setTab(t.id); setStatus(t.id === 'qr' ? 'registered' : t.id === 'rfid' ? 'clean' : 'all'); setQ('') }} className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold ${tab === t.id ? 'bg-cyan-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{t.icon}{t.label}{lines.some((l) => l.source === t.id) && <span className={`rounded-full px-1.5 text-[11px] ${tab === t.id ? 'bg-white/25' : 'bg-cyan-100 text-cyan-700'}`}>{lines.filter((l) => l.source === t.id).length}</span>}</button>)}</div>
      <div className="space-y-3 p-3"><p className="text-[13px] text-stone-500">{cur.hint}</p>
        <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-[180px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className={inputCls} style={{ paddingLeft: 36 }} /></div>
          {statuses && <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} max-w-[190px]`} aria-label="State"><option value="all">All states</option>{Object.entries(statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
          {free.length > 1 && <button type="button" onClick={selectAll} className="text-[13px] font-bold text-cyan-700 hover:underline">{allPicked ? 'Clear shown' : `Select all ${free.length} shown`}</button>}</div>
        <ul className="scroll-thin max-h-[260px] divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-100">
          {busy && <li className="p-4 text-center text-[13.5px] text-stone-400">Loading…</li>}
          {!busy && note && <li className="p-4 text-center text-[13.5px] text-stone-500">{note}</li>}
          {!busy && !note && shown.length === 0 && <li className="p-4 text-center text-[13.5px] text-stone-500">{rows.length ? 'Nothing matches your search.' : tab === 'wh_order' ? 'No packed orders waiting. Pack one in Warehouse first.' : tab === 'wh_goods_out' ? 'No goods out in the last 60 days.' : 'Nothing found with this filter.'}</li>}
          {!busy && shown.map((r) => { const u = used.get(key(r)); const on = picked.has(key(r)); return (
            <li key={key(r)}><label className={`flex items-start gap-3 px-3 py-2.5 ${u ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-stone-50'}`}>
              <input type="checkbox" disabled={!!u} checked={on} onChange={() => toggle(r)} className="mt-1 h-4 w-4 accent-cyan-600" />
              <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold text-stone-900">{r.label}</span>{r.sub && <span className="block truncate text-[12.5px] text-stone-500">{r.sub}</span>}</span>
              <span className="shrink-0 text-right text-[12.5px] text-stone-500">{u ? <span className="font-semibold text-amber-700">On {u}</span> : <>{r.group && <span className="block">{r.group}</span>}{r.qty !== 1 || r.source === 'wh_order' || r.source === 'wh_goods_out' ? <span className="font-semibold text-stone-700">{num(r.qty)} items</span> : null}</>}</span></label></li>) })}
        </ul>
        {lines.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg bg-cyan-50 p-3 text-[13.5px]"><b className="text-cyan-800">{num(total)} item{total === 1 ? '' : 's'} on this shipment</b><span className="text-cyan-700">from {lines.length} selection{lines.length === 1 ? '' : 's'}</span>
          <button type="button" onClick={() => setLines([])} className="ml-auto flex items-center gap-1 font-bold text-stone-500 hover:text-stone-800"><X size={14} />Clear all</button></div>}
      </div>
    </div>)
}

export const summarise = (lines: Line[]) => {
  const by = (s: Source) => lines.filter((l) => l.source === s)
  const part = (s: Source, one: string, many: string) => { const x = by(s); if (!x.length) return ''; const n = x.reduce((a, l) => a + l.qty, 0); return s === 'wh_order' || s === 'wh_goods_out' ? x.map((l) => l.label.split(' · ')[0]).slice(0, 4).join(', ') + (x.length > 4 ? ` +${x.length - 4}` : '') + ` (${num(n)} items)` : `${num(n)} ${n === 1 ? one : many}` }
  return [part('wh_order', '', ''), part('wh_goods_out', '', ''), part('qr', 'curtain', 'curtains'), part('rfid', 'laundry item', 'laundry items')].filter(Boolean).join(' · ')
}
