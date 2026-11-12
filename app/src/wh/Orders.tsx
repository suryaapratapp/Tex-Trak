import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Package, Printer, Truck, Undo2 } from 'lucide-react'
import { Page } from '../components/ui'
import { QrImg } from '../components/QrImg'
import { useStore } from '../store'
import { hasFeature } from '../sim/registry'
import { supabase } from '../lib/supabase'
import { fmtDate, fmtQty, fmtWhen, locName, STATUS_ORDER_LABEL, useIndex, useOp, useWh, useWhOrg, whRpc } from './store'
import { btnGhost, btnPrimary, Empty, Field, inputCls, Notice, OmniInput, Pill, Section, TD, TH, useFlash } from './ui'

export interface OrderRow { id: string; number: string; customer: string; reference: string; notes: string; status: string; by_name: string; packed_at: string; dispatched_at: string | null }
export interface OrderLine { id: string; item_id: string; location_id: string; lot: string; expiry: string | null; qty: number; unpacked_qty: number }
const TONE: Record<string, 'amber' | 'green' | 'slate' | 'blue'> = { packed: 'amber', part_unpacked: 'blue', unpacked: 'slate', dispatched: 'green' }
const DISP = [{ v: 'restock', l: 'Back to stock' }, { v: 'quarantine', l: 'Hold for checking' }, { v: 'repair', l: 'To repair' }, { v: 'scrap', l: 'Beyond repair' }]

async function loadOrder(org: string, number: string): Promise<{ order: OrderRow; lines: OrderLine[] } | null> {
  const { data: o } = await supabase.from('wh_orders').select('*').eq('org_id', org).eq('number', number).maybeSingle(); if (!o) return null
  const { data: l } = await supabase.from('wh_order_lines').select('id,item_id,location_id,lot,expiry,qty,unpacked_qty').eq('order_id', o.id)
  return { order: o as OrderRow, lines: ((l ?? []) as OrderLine[]).map((x) => ({ ...x, qty: +x.qty, unpacked_qty: +x.unpacked_qty })) }
}

function Slip({ order, lines, onDone }: { order: OrderRow; lines: OrderLine[]; onDone: () => void }) {
  const ix = useIndex(); const orgs = useWhOrg()
  useEffect(() => { const t = setTimeout(() => { window.print(); onDone() }, 600); return () => clearTimeout(t) }, [onDone])
  const live = lines.filter((l) => l.qty - l.unpacked_qty > 0)
  return createPortal(<div className="print-only" style={{ fontFamily: 'Inter, sans-serif', color: '#131a2e' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#7a839b' }}>Packing slip · {orgs}</div><div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{order.number}</div><div style={{ marginTop: 8, fontSize: 15 }}>{order.customer}{order.reference ? ` · Ref ${order.reference}` : ''}</div><div style={{ fontSize: 13, color: '#59627c' }}>Packed {fmtWhen(order.packed_at)} by {order.by_name}</div></div><QrImg text={`WH:O:${order.number}`} size={110} /></div>
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 24, fontSize: 14 }}><thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #131a2e' }}><th style={{ padding: '6px 4px' }}>SKU</th><th>Item</th><th>Lot</th><th style={{ textAlign: 'right' }}>Qty</th></tr></thead>
      <tbody>{live.map((l) => { const it = ix.itemById.get(l.item_id); return <tr key={l.id} style={{ borderBottom: '1px solid #e7eaf3' }}><td style={{ padding: '7px 4px', fontFamily: 'monospace' }}>{it?.sku}</td><td>{it?.name}</td><td style={{ fontFamily: 'monospace' }}>{l.lot || '–'}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtQty(l.qty - l.unpacked_qty)}</td></tr> })}</tbody></table>
    <div style={{ marginTop: 18, fontSize: 14, fontWeight: 700 }}>Total: {fmtQty(live.reduce((a, l) => a + l.qty - l.unpacked_qty, 0))} units</div>{order.notes && <div style={{ marginTop: 10, fontSize: 13 }}>Notes: {order.notes}</div>}
    <div style={{ marginTop: 40, fontSize: 12, color: '#7a839b' }}>Tex-Trak · Developed by CIRCAI LTD</div></div>, document.body)
}

/** Choose how many of each line to take back out of the box, and where it goes. Used here and on the Unpack page. */
export function UnpackPanel({ order, lines, onDone }: { order: OrderRow; lines: OrderLine[]; onDone: () => void }) {
  const ix = useIndex(); const { op, renew } = useOp(); const { flash, ok, err, clear } = useFlash(); const [qty, setQty] = useState<Record<string, string>>({}); const [disp, setDisp] = useState<Record<string, string>>({}); const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false)
  const open = lines.filter((l) => l.qty - l.unpacked_qty > 0)
  const save = async () => {
    const pick = open.filter((l) => Number(qty[l.id]) > 0); if (!pick.length) return err('Enter how many to unpack on at least one line.'); setBusy(true)
    const r = await whRpc('wh_unpack', { p_order: order.id, p_notes: notes, p_op: op(), p_lines: pick.map((l) => ({ line: l.id, qty: Number(qty[l.id]), disposition: disp[l.id] ?? 'restock' })) })
    setBusy(false); if (!r.ok) return err(r.message); renew(); ok(r.message); setQty({}); onDone()
  }
  if (order.status === 'dispatched') return <Notice kind="info">This order has been dispatched, so it cannot be unpacked here. Record a return in Goods in.</Notice>
  if (open.length === 0) return <Notice kind="info">Everything on this order has already been unpacked.</Notice>
  return (
    <div className="space-y-4">
      <div className="-mx-2 overflow-x-auto"><table className="w-full text-[14px]"><thead><tr><th className={TH}>Item</th><th className={TH}>Returns to</th><th className={TH + ' text-right'}>Packed</th><th className={TH}>Unpack</th><th className={TH}>Outcome</th></tr></thead>
        <tbody>{open.map((l) => { const it = ix.itemById.get(l.item_id); const left = l.qty - l.unpacked_qty; return <tr key={l.id}><td className={TD}><div className="font-semibold text-stone-800">{it?.name}</div><div className="mono text-[12px] text-stone-400">{it?.sku}{l.lot ? ` · ${l.lot}` : ''}</div></td><td className={TD + ' mono'}>{locName(ix, l.location_id)}</td><td className={TD + ' mono text-right'}>{fmtQty(left)}</td>
          <td className={TD}><div className="flex items-center gap-1.5"><input value={qty[l.id] ?? ''} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} inputMode="decimal" placeholder="0" className="h-10 w-20 rounded-xl border border-stone-200 px-3 text-[14px] outline-none focus:border-cyan-500" /><button onClick={() => setQty({ ...qty, [l.id]: String(left) })} className="text-[12.5px] font-bold text-cyan-700">All</button></div></td>
          <td className={TD}><select value={disp[l.id] ?? 'restock'} onChange={(e) => setDisp({ ...disp, [l.id]: e.target.value })} className="h-10 rounded-xl border border-stone-200 bg-white px-2.5 text-[13.5px]">{DISP.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}</select></td></tr> })}</tbody></table></div>
      <Field label="Reason or notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Optional, kept in the ledger" /></Field>
      {flash && <Notice kind={flash.kind} onClose={clear}>{flash.text}</Notice>}
      <button disabled={busy} onClick={() => void save()} className={btnPrimary + ' flex items-center gap-2'}><Undo2 size={18} />{busy ? 'Saving…' : 'Unpack selected'}</button>
    </div>)
}

export function OrderDetail({ number, mode, onChanged }: { number: string; mode: 'full' | 'unpack'; onChanged?: () => void }) {
  const org = useWhOrg(); const ix = useIndex(); const role = useStore((s) => s.role); const { op, renew } = useOp(); const { flash, ok, err, clear } = useFlash()
  const [d, setD] = useState<{ order: OrderRow; lines: OrderLine[] } | null | 'none'>(null); const [tab, setTab] = useState<'lines' | 'unpack'>(mode === 'unpack' ? 'unpack' : 'lines'); const [printing, setPrinting] = useState(false); const [busy, setBusy] = useState(false)
  const reload = useCallback(async () => { const r = await loadOrder(org, number); setD(r ?? 'none') }, [org, number])
  useEffect(() => { setD(null); void reload() }, [reload])
  if (d === null) return <p className="py-8 text-center text-stone-400">Loading…</p>
  if (d === 'none') return <Empty title={`No order ${number}`} sub="Check the number and try again." />
  const { order, lines } = d; const open = lines.reduce((a, l) => a + l.qty - l.unpacked_qty, 0); const canAct = order.status === 'packed' || order.status === 'part_unpacked'
  const dispatch = async () => { setBusy(true); const r = await whRpc('wh_dispatch', { p_order: order.id, p_op: op() }); setBusy(false); if (!r.ok) return err(r.message); renew(); ok(r.message); await reload(); onChanged?.() }
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="mono text-[22px] font-extrabold text-stone-900">{order.number}</div><div className="text-[14px] text-stone-500">{order.customer}{order.reference ? ` · Ref ${order.reference}` : ''}</div><div className="text-[12.5px] text-stone-400">Packed {fmtWhen(order.packed_at)} by {order.by_name}{order.dispatched_at ? ` · dispatched ${fmtWhen(order.dispatched_at)}` : ''}</div></div><Pill tone={TONE[order.status]}>{STATUS_ORDER_LABEL[order.status]}</Pill></div>
      {mode === 'full' && <div className="mt-4 flex flex-wrap gap-2.5"><button onClick={() => setPrinting(true)} className={btnGhost + ' flex items-center gap-2 !px-4 !py-2.5 !text-[14px]'}><Printer size={16} />Packing slip</button>
        {canAct && <button disabled={busy} onClick={() => void dispatch()} className={btnPrimary + ' flex items-center gap-2 !px-4 !py-2.5 !text-[14px]'}><Truck size={16} />Dispatch</button>}
        {canAct && hasFeature(role, 'whunpack') && <button onClick={() => setTab(tab === 'unpack' ? 'lines' : 'unpack')} className={btnGhost + ' flex items-center gap-2 !px-4 !py-2.5 !text-[14px]'}><Undo2 size={16} />{tab === 'unpack' ? 'Hide unpack' : 'Unpack'}</button>}</div>}
      {flash && <div className="mt-4"><Notice kind={flash.kind} onClose={clear}>{flash.text}</Notice></div>}
      {tab === 'unpack' && canAct ? <div className="mt-5"><UnpackPanel order={order} lines={lines} onDone={() => { void reload(); onChanged?.() }} /></div> : (
        <div className="-mx-2 mt-5 overflow-x-auto"><table className="w-full text-[14px]"><thead><tr><th className={TH}>Item</th><th className={TH}>Picked from</th><th className={TH}>Expiry</th><th className={TH + ' text-right'}>Qty</th><th className={TH + ' text-right'}>Unpacked</th></tr></thead>
          <tbody>{lines.map((l) => { const it = ix.itemById.get(l.item_id); return <tr key={l.id}><td className={TD}><div className="font-semibold text-stone-800">{it?.name}</div><div className="mono text-[12px] text-stone-400">{it?.sku}{l.lot ? ` · ${l.lot}` : ''}</div></td><td className={TD + ' mono'}>{locName(ix, l.location_id)}</td><td className={TD}>{fmtDate(l.expiry)}</td><td className={TD + ' mono text-right'}>{fmtQty(l.qty)}</td><td className={TD + ' mono text-right text-stone-400'}>{l.unpacked_qty ? fmtQty(l.unpacked_qty) : '–'}</td></tr> })}</tbody></table></div>)}
      <p className="mt-3 text-[13px] text-stone-400">{fmtQty(open)} unit{open === 1 ? '' : 's'} still packed.</p>
      {printing && <Slip order={order} lines={lines} onDone={() => setPrinting(false)} />}
    </div>)
}

export default function Orders() {
  const org = useWhOrg(); const focus = useWh((s) => s.orderFocus); const [rows, setRows] = useState<OrderRow[] | null>(null); const [offline, setOffline] = useState(false); const [sel, setSel] = useState<string | null>(focus); const [status, setStatus] = useState('open'); const [q, setQ] = useState('')
  const stock = useWh((s) => s.stock)
  const load = useCallback(async () => { const { data, error } = await supabase.from('wh_orders').select('*').eq('org_id', org).order('packed_at', { ascending: false }).limit(300); setOffline(!!error); if (!error) setRows((data ?? []) as OrderRow[]) }, [org])
  useEffect(() => { void load() }, [load, stock])
  useEffect(() => { if (focus) { setSel(focus); useWh.setState({ orderFocus: null }) } }, [focus])
  const shown = (rows ?? []).filter((r) => (status === 'all' ? true : status === 'open' ? r.status === 'packed' || r.status === 'part_unpacked' : r.status === status) && (!q || (r.number + r.customer + r.reference).toLowerCase().includes(q.toLowerCase())))
  return (
    <Page title="Orders and dispatch" sub="Packed orders waiting to go, and the history of what was sent. Print a packing slip, dispatch, or unpack.">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Section>
          <div className="mb-4 flex flex-wrap gap-2"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, customer…" className={inputCls + ' !h-10 flex-1'} /><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-[14px]"><option value="open">Waiting</option><option value="dispatched">Dispatched</option><option value="unpacked">Unpacked</option><option value="all">All</option></select></div>
          {offline && rows === null ? <Empty icon={<Package size={22} />} title="Orders need a connection" sub="Packing still works offline from Pack order. The order appears here once it has been sent." /> : rows === null ? <p className="py-8 text-center text-stone-400">Loading…</p> : shown.length === 0 ? <Empty icon={<Package size={22} />} title="No orders here" sub={status === 'open' ? 'Nothing is waiting. Packed orders appear here until they are dispatched.' : 'No orders match.'} /> : (
            <ul className="-mx-2 divide-y divide-stone-100">{shown.map((r) => <li key={r.id}><button onClick={() => setSel(r.number)} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-stone-50 ${sel === r.number ? 'bg-cyan-50' : ''}`}><div className="min-w-0"><div className="mono text-[14.5px] font-bold text-stone-900">{r.number}</div><div className="truncate text-[13.5px] text-stone-500">{r.customer}{r.reference ? ` · ${r.reference}` : ''}</div></div><div className="shrink-0 text-right"><Pill tone={TONE[r.status]}>{STATUS_ORDER_LABEL[r.status]}</Pill><div className="mt-1 text-[12px] text-stone-400">{fmtWhen(r.packed_at)}</div></div></button></li>)}</ul>)}
        </Section>
        <Section className="h-fit">{sel ? <OrderDetail key={sel} number={sel} mode="full" onChanged={() => void load()} /> : <Empty title="Choose an order" sub="Its lines, and the buttons to print, dispatch or unpack, appear here." />}</Section>
      </div>
    </Page>)
}

export function Unpack() {
  const [number, setNumber] = useState<string | null>(null); const [rows, setRows] = useState<OrderRow[]>([]); const org = useWhOrg(); const stock = useWh((s) => s.stock); const prefill = useWh((s) => s.prefill)
  useEffect(() => { void supabase.from('wh_orders').select('*').eq('org_id', org).in('status', ['packed', 'part_unpacked']).order('packed_at', { ascending: false }).limit(50).then(({ data }) => setRows((data ?? []) as OrderRow[])) }, [org, stock])
  useEffect(() => { if (prefill?.orderNumber) { setNumber(prefill.orderNumber); useWh.getState().setPrefill(null) } }, [prefill])
  return (
    <Page title="Unpack" sub="Take items back out of a packed order. Choose whether each returns to the shelf, goes on hold, or is damaged. Stock goes back to where it was picked from.">
      <div className="mx-auto max-w-[1000px] space-y-6">
        <Section><OmniInput kind="any" label="Scan the order slip or type its number" placeholder="PK-00001" onOrder={(n) => setNumber(n)} onItem={() => undefined} hint="The QR code on the packing slip works too." />
          {rows.length > 0 && <div className="mt-4"><div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-stone-400">Or choose a waiting order</div><div className="flex flex-wrap gap-2">{rows.slice(0, 12).map((r) => <button key={r.id} onClick={() => setNumber(r.number)} className={`rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold transition ${number === r.number ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}><span className="mono">{r.number}</span> · {r.customer}</button>)}</div></div>}</Section>
        {number && <Section><OrderDetail key={number} number={number} mode="unpack" /></Section>}
      </div>
    </Page>)
}
