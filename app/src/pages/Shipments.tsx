import { clearShipDraft, peekShipDraft, type ShipStart } from '../lib/shipDraft'
import { ask } from '../components/Confirm'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, CircleCheck, PackagePlus, Send, Truck, X } from 'lucide-react'
import { Card, Page } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useInfra } from '../lib/infra'
import { toast } from '../lib/toast'
import { useStore } from '../store'
import { btnGhost, btnPrimary, Field, inputCls, Notice } from '../qr/ui'
import ShipmentsLive from './ShipmentsLive'
import { ShipmentContents, summarise, type Line } from './ShipmentContents'
import { CustomerReceive } from './CustomerReceive'

interface Shipment { id: string; ref: string; org_id: string; kind: string; from_name: string; to_name: string; carrier: string; vehicle_reg: string; description: string; items: number; weight_kg: number | null; planned_dispatch: string | null; planned_arrival: string | null; status: 'booked' | 'in_transit' | 'delivered' | 'exception' | 'cancelled'; dispatched_at: string | null; delivered_at: string | null; arrived_at?: string | null; items_received: number | null; created_at: string; customer_org_id?: string | null; received_by_name?: string | null; received_method?: 'scan' | 'confirm' | null; received_at?: string | null; received_scanned?: number | null }
interface Ev { id: number; shipment_id: string; type: string; detail: string; by_name: string; created_at: string }
const KINDS: Record<string, string> = { delivery: 'Delivery', collection: 'Collection', recycling: 'Recycling load', equipment: 'Equipment', other: 'Other' }
const STATUS: Record<string, { label: string; cls: string }> = { booked: { label: 'Booked', cls: 'bg-stone-100 text-stone-700' }, in_transit: { label: 'On the way', cls: 'bg-blue-50 text-blue-700' }, delivered: { label: 'Delivered', cls: 'bg-emerald-50 text-emerald-700' }, exception: { label: 'Problem', cls: 'bg-rose-50 text-rose-700' }, cancelled: { label: 'Cancelled', cls: 'bg-stone-100 text-stone-400' } }
const EV_LABEL: Record<string, string> = { booked: 'Booked', dispatched: 'Dispatched', update: 'Update', delayed: 'Delay reported', received: 'Received', exception: 'Problem reported', cancelled: 'Cancelled' }
const dt = (s?: string | null) => (s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–')
const STEPS: [string, string][] = [['Book', 'Say what is going where'], ['Dispatch', 'Confirm it is loaded and sealed'], ['On the way', 'Add updates or report a delay'], ['Receive', 'Count what arrived']]

function NewShipment({ org, onDone, onCancel, start }: { org: string; onDone: (id: string) => void; onCancel: () => void; start?: ShipStart | null }) {
  const [f, setF] = useState({ kind: 'delivery', from: '', to: '', carrier: '', vehicle: '', desc: '', items: '1', weight: '', pd: '', pa: '' }); const [lines, setLines] = useState<Line[]>([]); const total = Math.max(1, Math.round(lines.reduce((a, l) => a + l.qty, 0))); const count = lines.length ? total : +f.items || 0; const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [cust, setCust] = useState(''); const [custs, setCusts] = useState<{ id: string; name: string }[]>([])
  useEffect(() => { let off = false; void supabase.rpc('shipment_customers', { p_org: org }).then(({ data }) => { if (!off) setCusts((data ?? []) as { id: string; name: string }[]) }); return () => { off = true } }, [org])
  const infraSites = useInfra((x) => x.sites); const siteNames = useMemo(() => [...new Set(infraSites.filter((x) => x.org_id === org || x.org_id === null).map((x) => x.name))].sort(), [infraSites, org])
  const submit = async () => {
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('shipment_book', { p_org: org, p_kind: f.kind, p_from: f.from.trim(), p_to: f.to.trim(), p_carrier: f.carrier.trim(), p_vehicle: f.vehicle.trim().toUpperCase(), p_desc: f.desc.trim() || summarise(lines), p_items: count || 1, p_lines: lines.length ? lines.map((l) => ({ source: l.source, ref: l.ref, label: l.label, qty: l.qty })) : null, p_weight: f.weight ? +f.weight : null, p_planned_dispatch: f.pd ? new Date(f.pd).toISOString() : null, p_planned_arrival: f.pa ? new Date(f.pa).toISOString() : null, p_customer: cust || null })
    setBusy(false); if (error) return setErr(error.message); onDone((data as Shipment).id)
  }
  return (
    <Card className="mb-6 space-y-5 p-6"><div className="flex items-center justify-between"><h2 className="text-[18px] font-extrabold text-stone-900">New shipment</h2><button onClick={onCancel} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-stone-100"><X size={16} /></button></div>
      <datalist id="sites">{siteNames.map((n) => <option key={n} value={n} />)}</datalist>
      <div className="grid gap-4 md:grid-cols-3"><Field label="Type"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={inputCls}>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="From" required hint={siteNames.length ? 'Pick one of your sites so the tracker can dispatch it automatically, or type any address' : 'No sites added yet. Type an address'}><input list="sites" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={inputCls} /></Field><Field label="To" required hint={siteNames.length ? 'Pick a site so arrival is recorded automatically' : undefined}><input list="sites" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={inputCls} /></Field></div>
      {custs.length > 0 && <Field label="Customer account" hint="Optional. The customer can sign in, see this shipment, scan or confirm what arrived, and sign for it."><select value={cust} onChange={(e) => { setCust(e.target.value); const c = custs.find((x) => x.id === e.target.value); if (c && !f.to.trim()) setF({ ...f, to: c.name }) }} className={inputCls}><option value="">No customer account</option>{custs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
      <Field label="What is in it" hint="Pick what is going: packed orders and goods out from Warehouse, curtains or laundry items. Or skip this and type a description below."><ShipmentContents org={org} lines={lines} setLines={setLines} start={start} /></Field>
      <div className="grid gap-4 md:grid-cols-3"><Field label="Description" hint={lines.length ? 'Optional. Filled in from your selection if left empty.' : undefined}><input value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder={lines.length ? summarise(lines) : 'e.g. 16 clean curtains'} className={inputCls} /></Field><Field label="Number of items" required hint={lines.length ? 'Counted from your selection.' : undefined}><input value={lines.length ? String(total) : f.items} readOnly={lines.length > 0} onChange={(e) => setF({ ...f, items: e.target.value.replace(/\D/g, '') })} inputMode="numeric" className={inputCls} /></Field><Field label="Weight (kg)"><input value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" className={inputCls} /></Field></div>
      <div className="grid gap-4 md:grid-cols-4"><Field label="Carrier"><input value={f.carrier} onChange={(e) => setF({ ...f, carrier: e.target.value })} className={inputCls} /></Field><Field label="Vehicle registration"><input value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })} className={inputCls} /></Field><Field label="Planned dispatch"><input type="datetime-local" value={f.pd} onChange={(e) => setF({ ...f, pd: e.target.value })} className={inputCls} /></Field><Field label="Planned arrival"><input type="datetime-local" value={f.pa} onChange={(e) => setF({ ...f, pa: e.target.value })} className={inputCls} /></Field></div>
      {err && <Notice kind="error">{err}</Notice>}<div className="flex gap-3"><button disabled={busy || !f.from.trim() || !f.to.trim() || !count} onClick={submit} className={btnPrimary}>Book shipment</button><button onClick={onCancel} className={btnGhost}>Cancel</button></div></Card>)
}

function Detail({ s, events, org, onChange, customer }: { s: Shipment; events: Ev[]; org: string; onChange: () => void; customer?: boolean }) {
  const [sig, setSig] = useState<string | null>(null)
  useEffect(() => { if (!s.received_at) return; let off = false; void supabase.from('shipments').select('received_signature').eq('id', s.id).maybeSingle().then(({ data }) => { if (!off) setSig((data as { received_signature: string | null } | null)?.received_signature ?? null) }); return () => { off = true } }, [s.id, s.received_at])
  const [mode, setMode] = useState<'update' | 'delay' | 'receive' | 'exception' | null>(null); const [text, setText] = useState(''); const [count, setCount] = useState(String(s.items)); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [lines, setLines] = useState<Line[]>([])
  useEffect(() => { let off = false; void supabase.from('shipment_lines').select('source,ref_id,label,qty').eq('shipment_id', s.id).order('id').limit(3000).then(({ data }) => { if (!off) setLines(((data ?? []) as { source: Line['source']; ref_id: string; label: string; qty: number }[]).map((r) => ({ source: r.source, ref: r.ref_id, label: r.label, qty: Number(r.qty) }))) }); return () => { off = true } }, [s.id])
  const synced = useRef(false) // a shipment the tracker dispatched still needs its packed Warehouse orders marked as dispatched
  useEffect(() => {
    if (customer || s.status !== 'in_transit' || synced.current) return; const orders = lines.filter((x) => x.source === 'wh_order'); if (!orders.length) return; synced.current = true
    void (async () => { for (const l of orders) { const { error: e2 } = await supabase.rpc('wh_dispatch', { p_org: s.org_id, p_order: l.ref }); if (e2 && !/already been dispatched|not packed|cannot be dispatched/i.test(e2.message)) toast.error(`${l.label.split(' · ')[0]} could not be marked dispatched in Warehouse. ${e2.message}`) } })()
  }, [s.status, s.org_id, lines])
  const step = async (action: string, detail = '', items: number | null = null) => {
    setBusy(true); setErr(''); const { error } = await supabase.rpc('shipment_step', { p_id: s.id, p_action: action, p_detail: detail, p_items: items })
    if (error) { setBusy(false); return setErr(error.message) }
    if (action === 'dispatch') { // packed Warehouse orders on this shipment are dispatched with it
      const fails: string[] = []
      for (const l of lines.filter((x) => x.source === 'wh_order')) { const { error: e2 } = await supabase.rpc('wh_dispatch', { p_org: s.org_id, p_order: l.ref }); if (e2 && !/already been dispatched/i.test(e2.message)) fails.push(`${l.label.split(' · ')[0]}: ${e2.message}`) }
      if (fails.length) setErr(`Shipment dispatched, but a Warehouse order could not be marked dispatched. ${fails.join(' ')}`)
    }
    setBusy(false); setMode(null); setText(''); onChange() }
  const late = s.status === 'in_transit' && s.planned_arrival && new Date(s.planned_arrival).getTime() < Date.now()
  const st = STATUS[s.status]
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-3"><h2 className="mono text-[22px] font-extrabold text-stone-900">{s.ref}</h2><span className={`rounded-full px-3 py-1 text-[12.5px] font-bold ${st.cls}`}>{st.label}</span></div><p className="mt-1 text-[14.5px] text-stone-500">{KINDS[s.kind]}{s.description ? ` · ${s.description}` : ''}</p></div>
        {late && <span className="rounded-full bg-amber-50 px-3 py-1 text-[12.5px] font-bold text-amber-800">Past its planned arrival</span>}</div>
      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-stone-50 p-4 text-[15px] font-bold text-stone-900"><span className="min-w-0 flex-1 truncate">{s.from_name}</span><ArrowRight size={18} className="shrink-0 text-stone-400" /><span className="min-w-0 flex-1 truncate text-right">{s.to_name}</span></div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[14px] md:grid-cols-4">{[['Items', s.items_received != null ? `${s.items_received} of ${s.items}` : String(s.items)], ['Weight', s.weight_kg != null ? `${s.weight_kg} kg` : '–'], ['Carrier', s.carrier || '–'], ['Vehicle', s.vehicle_reg || '–'], ['Planned dispatch', dt(s.planned_dispatch)], ['Dispatched', dt(s.dispatched_at)], ['Planned arrival', dt(s.planned_arrival)], ['Delivered', dt(s.delivered_at)]].map(([k, v]) => <div key={k}><dt className="text-[12px] font-bold uppercase tracking-wider text-stone-400">{k}</dt><dd className="mt-0.5 font-semibold text-stone-900">{v}</dd></div>)}</dl>
      {lines.length > 0 && <div className="mt-5"><h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-stone-400">What is in it</h3>
        <ul className="scroll-thin max-h-[220px] divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-100">{lines.map((l) => <li key={l.source + l.ref} className="flex items-center justify-between gap-3 px-3 py-2 text-[13.5px]"><span className="min-w-0 truncate"><span className="font-semibold text-stone-900">{l.label}</span><span className="ml-2 text-[12px] text-stone-400">{{ wh_order: 'Packed order', wh_goods_out: 'Goods out', qr: 'Curtain', rfid: 'Laundry item', typed: '' }[l.source]}</span></span>{(l.source === 'wh_order' || l.source === 'wh_goods_out' || l.qty !== 1) && <span className="shrink-0 font-semibold text-stone-700">{l.qty} items</span>}</li>)}</ul></div>}
      {s.received_at && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"><h3 className="text-[12px] font-bold uppercase tracking-wider text-emerald-800">Received and signed</h3><div className="mt-1 text-[15px] font-bold text-stone-900">{s.received_by_name} · {dt(s.received_at)}</div><div className="text-[13.5px] text-stone-600">{s.items_received} of {s.items} items · {s.received_method === 'scan' ? `each item scanned${s.received_scanned != null ? ` (${s.received_scanned})` : ''}` : 'checked and confirmed without scanning'}</div>{sig && <img src={sig} alt={`Signature of ${s.received_by_name}`} className="mt-3 h-24 rounded-xl border border-stone-200 bg-white" />}</div>}
      {customer && (s.status === 'booked' || s.status === 'in_transit') && <CustomerReceive id={s.id} shipRef={s.ref} expected={s.items} lines={lines} onDone={onChange} />}
      {s.status === 'in_transit' && s.arrived_at && !customer && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-[14px] font-semibold text-emerald-900">The vehicle arrived at {s.to_name} at {dt(s.arrived_at)}. Press Receive and count what arrived to close this shipment.</div>}
      {err && <div className="mt-4"><Notice kind="error" onClose={() => setErr('')}>{err}</Notice></div>}
      {!customer && <div className="mt-5 flex flex-wrap gap-2">
        {s.status === 'booked' && <><button disabled={busy} onClick={() => step('dispatch', 'Loaded and sealed')} className={`${btnPrimary} flex items-center gap-2`}><Send size={16} /> Dispatch</button><button disabled={busy} onClick={async () => { if (await ask('Cancel this shipment? Its items become free to put on another shipment.', 'Cancel shipment')) void step('cancel', 'Cancelled before dispatch') }} className={btnGhost}>Cancel shipment</button></>}
        {s.status === 'in_transit' && <><button onClick={() => setMode('receive')} className={`${btnPrimary} flex items-center gap-2`}><Check size={16} /> Receive</button><button onClick={() => setMode('update')} className={btnGhost}>Add update</button><button onClick={() => setMode('delay')} className={btnGhost}>Report delay</button></>}
        {(s.status === 'booked' || s.status === 'in_transit') && <button onClick={() => setMode('exception')} className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-[15px] font-bold text-rose-700 hover:bg-rose-100">Report a problem</button>}
        {s.status === 'exception' && <button disabled={busy} onClick={() => step('resolve', 'Problem resolved')} className={`${btnPrimary} flex items-center gap-2`}><CircleCheck size={16} /> Mark resolved</button>}</div>}
      {!customer && mode && <div className="mt-4 space-y-3 rounded-2xl border border-stone-100 p-4">
        {mode === 'receive' && <Field label="How many items arrived?" hint={`${s.items} were sent. A different number is recorded as a problem.`}><input value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={`${inputCls} max-w-[200px]`} /></Field>}
        <Field label={mode === 'receive' ? 'Note (optional)' : mode === 'exception' ? 'What went wrong?' : mode === 'delay' ? 'Why is it late?' : 'Update'}><input value={text} onChange={(e) => setText(e.target.value)} className={inputCls} /></Field>
        <div className="flex gap-2"><button disabled={busy || (mode !== 'receive' && !text.trim())} onClick={() => step(mode === 'delay' ? 'delay' : mode, text, mode === 'receive' ? +count : null)} className={btnPrimary}>{{ receive: 'Confirm received', update: 'Save update', delay: 'Report delay', exception: 'Report problem' }[mode]}</button><button onClick={() => setMode(null)} className={btnGhost}>Cancel</button></div></div>}
      <h3 className="mb-3 mt-7 text-[15px] font-extrabold text-stone-900">History</h3>
      <ol className="space-y-4 border-l-2 border-stone-100 pl-5">{events.map((e) => <li key={e.id} className="relative"><i className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white ${e.type === 'exception' || e.type === 'delayed' ? 'bg-rose-500' : e.type === 'received' ? 'bg-emerald-500' : 'bg-cyan-500'}`} /><div className="text-[14.5px] font-bold text-stone-900">{EV_LABEL[e.type]}</div>{e.detail && <div className="text-[14px] text-stone-600">{e.detail}</div>}<div className="text-[12.5px] text-stone-400">{dt(e.created_at)}{e.by_name ? ` · ${e.by_name}` : ''}</div></li>)}</ol>
      <span hidden>{org}</span>
    </Card>)
}

function Workflow() {
  const role = useStore((s) => s.role); const user = useAuth((s) => s.user); const orgs = useAuth((s) => s.orgs)
  const [rows, setRows] = useState<Shipment[]>([]); const [events, setEvents] = useState<Ev[]>([]); const [sel, setSel] = useState<string | null>(null); useEffect(() => () => clearShipDraft(), []); const [start] = useState(() => peekShipDraft()); const [adding, setAdding] = useState(!!start); const [f, setF] = useState('all'); const [q, setQ] = useState(''); const [pick, setPick] = useState(''); const [loaded, setLoaded] = useState(false)
  const isCust = role !== 'superadmin' && orgs.find((o) => o.id === role)?.kind === 'customer'
  const sendOrgs = orgs.filter((o) => o.kind !== 'customer'); const org = role !== 'superadmin' ? role : pick || sendOrgs[0]?.id || ''
  useEffect(() => { void useInfra.getState().load() }, [])
  const seen = useRef<Map<string, string>>(new Map())
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('shipments').select('id,ref,org_id,kind,from_name,to_name,carrier,vehicle_reg,description,items,weight_kg,planned_dispatch,planned_arrival,status,dispatched_at,delivered_at,arrived_at,items_received,created_at,customer_org_id,received_by_name,received_method,received_at,received_scanned').order('created_at', { ascending: false }).limit(300)
    if (error) { setLoaded(true); if (!seen.current.size) toast.error(`Could not load shipments. ${error.message}`); return }
    const list = (data ?? []) as Shipment[]
    for (const r of list) { // tell the user when the tracker moved a shipment on
      const key = `${r.status}|${r.arrived_at ?? ''}`; const was = seen.current.get(r.id)
      if (was !== undefined && was !== key) toast.info(r.status === 'in_transit' && !was.startsWith('in_transit') ? `${r.ref} has left ${r.from_name} and is on the way.` : r.arrived_at && !was.split('|')[1] ? `${r.ref} has arrived at ${r.to_name}. Count what arrived.` : `${r.ref} is now ${STATUS[r.status]?.label.toLowerCase() ?? r.status}.`)
      seen.current.set(r.id, key)
    }
    setRows(list); setLoaded(true)
    const { data: ev } = await supabase.from('shipment_events').select('*').order('created_at', { ascending: false }).limit(1500); setEvents((ev ?? []) as Ev[])
  }, [])
  useEffect(() => { void load(); const id = setInterval(() => void load(), 20000); return () => clearInterval(id) }, [load])
  const mine = useMemo(() => rows.filter((r) => role === 'superadmin' || r.org_id === role || r.customer_org_id === role), [rows, role])
  const list = mine.filter((r) => (f === 'all' || (f === 'open' ? r.status === 'booked' || r.status === 'in_transit' : r.status === f)) && (r.ref + r.from_name + r.to_name + r.description).toLowerCase().includes(q.toLowerCase()))
  const cur = mine.find((r) => r.id === sel) ?? null
  const n = (st: string) => mine.filter((r) => r.status === st).length
  return (
    <>
      {!isCust && <Card className="mb-4 p-3 sm:mb-6 sm:p-5"><ol className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-4 md:gap-4">{STEPS.map(([t, h], i) => <li key={t} className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cyan-600 text-[13px] font-extrabold text-white">{i + 1}</span><span><span className="block text-[15px] font-extrabold text-stone-900">{t}</span><span className="hidden text-[13.5px] text-stone-500 sm:inline">{h}</span></span></li>)}</ol></Card>}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex-1 sm:gap-4 md:grid-cols-4">{[['Booked', n('booked'), 'text-stone-900'], ['On the way', n('in_transit'), 'text-blue-600'], ['Delivered', n('delivered'), 'text-emerald-600'], ['Problems', n('exception'), n('exception') ? 'text-rose-600' : 'text-stone-900']].map(([l, v, c]) => <div key={l as string} className="card p-5"><div className={`text-[32px] font-extrabold leading-none ${c}`}>{v}</div><div className="mt-2 text-[14px] font-bold text-stone-600">{l}</div></div>)}</div>
        {!isCust && <div className="flex items-center gap-2">{role === 'superadmin' && <select value={pick || sendOrgs[0]?.id} onChange={(e) => setPick(e.target.value)} className="h-12 rounded-2xl border border-stone-200 bg-white px-4 text-[14.5px] font-semibold" aria-label="Client">{sendOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}<button onClick={() => setAdding(true)} disabled={!org} className={`${btnPrimary} flex items-center gap-2`}><PackagePlus size={18} /> New shipment</button></div>}</div>
      {adding && org && !isCust && <NewShipment start={start} org={org} onCancel={() => { clearShipDraft(); setAdding(false) }} onDone={(id) => { clearShipDraft(); setAdding(false); setSel(id); void load() }} />}
      <div className="grid items-start gap-6 xl:grid-cols-[420px_1fr]">
        <Card><div className="space-y-3 border-b border-stone-100 p-4"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reference, place or contents" className={inputCls} />
          <div className="flex flex-wrap gap-2">{[['all', 'All'], ['open', 'Open'], ['booked', 'Booked'], ['in_transit', 'On the way'], ['delivered', 'Delivered'], ['exception', 'Problems']].map(([k, l]) => <button key={k} onClick={() => setF(k)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${f === k ? 'bg-cyan-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{l}</button>)}</div></div>
          <ul className="divide-y divide-stone-100">{!loaded && <li className="p-6 text-center text-stone-400">Loading…</li>}{loaded && list.length === 0 && <li className="p-8 text-center"><Truck className="mx-auto text-stone-300" size={30} /><div className="mt-2 text-[15px] font-bold text-stone-700">No shipments yet</div><div className="text-[13.5px] text-stone-500">{isCust ? 'Deliveries sent to you appear here. You can accept them when they arrive.' : 'Book one to start. It appears here and is tracked until it is received.'}</div></li>}
            {list.map((r) => <li key={r.id}><button onClick={() => setSel(r.id)} className={`w-full px-5 py-4 text-left ${cur?.id === r.id ? 'bg-cyan-50' : 'hover:bg-stone-50'}`}><div className="flex items-center justify-between gap-3"><span className="mono text-[15px] font-bold text-stone-900">{r.ref}</span><span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span></div><div className="mt-1 truncate text-[13.5px] text-stone-500">{r.from_name} → {r.to_name}</div><div className="mt-0.5 text-[12.5px] text-stone-400">{KINDS[r.kind]} · {r.items} item{r.items === 1 ? '' : 's'}{role === 'superadmin' ? ` · ${orgs.find((o) => o.id === r.org_id)?.name ?? r.org_id}` : ''}</div></button></li>)}</ul></Card>
        {cur ? <Detail key={cur.id} s={cur} customer={isCust} org={org} events={events.filter((e) => e.shipment_id === cur.id).reverse()} onChange={() => void load()} /> : <Card className="grid place-items-center p-12 text-center"><div><AlertTriangle className="mx-auto text-stone-300" size={30} /><div className="mt-2 text-[15px] font-bold text-stone-700">Choose a shipment to see its progress</div></div></Card>}
      </div>
      <span hidden>{user?.id}</span>
    </>)
}

export default function Shipments() {
  const [tab, setTab] = useState<'work' | 'live'>('work'); const role = useStore((s) => s.role); const orgs = useAuth((s) => s.orgs); const isCust = role !== 'superadmin' && orgs.find((o) => o.id === role)?.kind === 'customer'
  return (
    <Page title={isCust ? 'Your deliveries' : 'Shipments'} sub={isCust ? 'Deliveries on their way to you. Scan or check what arrives, then sign to accept it.' : 'Book a delivery or collection, send it, and receive it. Everything is recorded.'}
      right={isCust ? undefined : <div className="flex rounded-full bg-stone-200/70 p-1">{([['work', 'My shipments'], ['live', 'Live tracking']] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-[14px] font-bold ${tab === k ? 'bg-white text-stone-900 shadow' : 'text-stone-500'}`}>{l}</button>)}</div>}>
      {tab === 'work' ? <Workflow /> : <ShipmentsLive />}
    </Page>)
}
