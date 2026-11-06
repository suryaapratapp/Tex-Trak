import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, CircleCheck, PackagePlus, Send, Truck, X } from 'lucide-react'
import { Card, Page } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { NETWORK } from '../sim/registry'
import { useStore } from '../store'
import { btnGhost, btnPrimary, Field, inputCls, Notice } from '../qr/ui'
import ShipmentsLive from './ShipmentsLive'

interface Shipment { id: string; ref: string; org_id: string; kind: string; from_name: string; to_name: string; carrier: string; vehicle_reg: string; description: string; items: number; weight_kg: number | null; planned_dispatch: string | null; planned_arrival: string | null; status: 'booked' | 'in_transit' | 'delivered' | 'exception' | 'cancelled'; dispatched_at: string | null; delivered_at: string | null; items_received: number | null; created_at: string }
interface Ev { id: number; shipment_id: string; type: string; detail: string; by_name: string; created_at: string }
const KINDS: Record<string, string> = { delivery: 'Delivery', collection: 'Collection', recycling: 'Recycling load', equipment: 'Equipment', other: 'Other' }
const STATUS: Record<string, { label: string; cls: string }> = { booked: { label: 'Booked', cls: 'bg-stone-100 text-stone-700' }, in_transit: { label: 'On the way', cls: 'bg-blue-50 text-blue-700' }, delivered: { label: 'Delivered', cls: 'bg-emerald-50 text-emerald-700' }, exception: { label: 'Problem', cls: 'bg-rose-50 text-rose-700' }, cancelled: { label: 'Cancelled', cls: 'bg-stone-100 text-stone-400' } }
const EV_LABEL: Record<string, string> = { booked: 'Booked', dispatched: 'Dispatched', update: 'Update', delayed: 'Delay reported', received: 'Received', exception: 'Problem reported', cancelled: 'Cancelled' }
const dt = (s?: string | null) => (s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–')
const SITE_NAMES = [...new Set(NETWORK.filter((n) => ['hospital', 'decon', 'recycler', 'facility', 'hub', 'community'].includes(n.kind)).map((n) => n.name))]
const STEPS: [string, string][] = [['Book', 'Say what is going where'], ['Dispatch', 'Confirm it is loaded and sealed'], ['On the way', 'Add updates or report a delay'], ['Receive', 'Count what arrived']]

function NewShipment({ org, onDone, onCancel }: { org: string; onDone: (id: string) => void; onCancel: () => void }) {
  const [f, setF] = useState({ kind: 'delivery', from: '', to: '', carrier: '', vehicle: '', desc: '', items: '1', weight: '', pd: '', pa: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('shipment_book', { p_org: org, p_kind: f.kind, p_from: f.from.trim(), p_to: f.to.trim(), p_carrier: f.carrier.trim(), p_vehicle: f.vehicle.trim().toUpperCase(), p_desc: f.desc.trim(), p_items: +f.items || 1, p_weight: f.weight ? +f.weight : null, p_planned_dispatch: f.pd ? new Date(f.pd).toISOString() : null, p_planned_arrival: f.pa ? new Date(f.pa).toISOString() : null })
    setBusy(false); if (error) return setErr(error.message); onDone((data as Shipment).id)
  }
  return (
    <Card className="mb-6 space-y-5 p-6"><div className="flex items-center justify-between"><h2 className="text-[18px] font-extrabold text-stone-900">New shipment</h2><button onClick={onCancel} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-stone-100"><X size={16} /></button></div>
      <datalist id="sites">{SITE_NAMES.map((n) => <option key={n} value={n} />)}</datalist>
      <div className="grid gap-4 md:grid-cols-3"><Field label="Type"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={inputCls}>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="From" required hint="Pick a site or type any address"><input list="sites" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={inputCls} /></Field><Field label="To" required><input list="sites" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={inputCls} /></Field></div>
      <div className="grid gap-4 md:grid-cols-3"><Field label="What is in it"><input value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder="e.g. 16 clean curtains" className={inputCls} /></Field><Field label="Number of items" required><input value={f.items} onChange={(e) => setF({ ...f, items: e.target.value.replace(/\D/g, '') })} inputMode="numeric" className={inputCls} /></Field><Field label="Weight (kg)"><input value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" className={inputCls} /></Field></div>
      <div className="grid gap-4 md:grid-cols-4"><Field label="Carrier"><input value={f.carrier} onChange={(e) => setF({ ...f, carrier: e.target.value })} className={inputCls} /></Field><Field label="Vehicle registration"><input value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })} className={inputCls} /></Field><Field label="Planned dispatch"><input type="datetime-local" value={f.pd} onChange={(e) => setF({ ...f, pd: e.target.value })} className={inputCls} /></Field><Field label="Planned arrival"><input type="datetime-local" value={f.pa} onChange={(e) => setF({ ...f, pa: e.target.value })} className={inputCls} /></Field></div>
      {err && <Notice kind="error">{err}</Notice>}<div className="flex gap-3"><button disabled={busy || !f.from.trim() || !f.to.trim() || !+f.items} onClick={submit} className={btnPrimary}>Book shipment</button><button onClick={onCancel} className={btnGhost}>Cancel</button></div></Card>)
}

function Detail({ s, events, org, onChange }: { s: Shipment; events: Ev[]; org: string; onChange: () => void }) {
  const [mode, setMode] = useState<'update' | 'delay' | 'receive' | 'exception' | null>(null); const [text, setText] = useState(''); const [count, setCount] = useState(String(s.items)); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const step = async (action: string, detail = '', items: number | null = null) => { setBusy(true); setErr(''); const { error } = await supabase.rpc('shipment_step', { p_id: s.id, p_action: action, p_detail: detail, p_items: items }); setBusy(false); if (error) return setErr(error.message); setMode(null); setText(''); onChange() }
  const late = s.status === 'in_transit' && s.planned_arrival && new Date(s.planned_arrival).getTime() < Date.now()
  const st = STATUS[s.status]
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-3"><h2 className="mono text-[22px] font-extrabold text-stone-900">{s.ref}</h2><span className={`rounded-full px-3 py-1 text-[12.5px] font-bold ${st.cls}`}>{st.label}</span></div><p className="mt-1 text-[14.5px] text-stone-500">{KINDS[s.kind]}{s.description ? ` · ${s.description}` : ''}</p></div>
        {late && <span className="rounded-full bg-amber-50 px-3 py-1 text-[12.5px] font-bold text-amber-800">Past its planned arrival</span>}</div>
      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-stone-50 p-4 text-[15px] font-bold text-stone-900"><span className="min-w-0 flex-1 truncate">{s.from_name}</span><ArrowRight size={18} className="shrink-0 text-stone-400" /><span className="min-w-0 flex-1 truncate text-right">{s.to_name}</span></div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[14px] md:grid-cols-4">{[['Items', s.items_received != null ? `${s.items_received} of ${s.items}` : String(s.items)], ['Weight', s.weight_kg != null ? `${s.weight_kg} kg` : '–'], ['Carrier', s.carrier || '–'], ['Vehicle', s.vehicle_reg || '–'], ['Planned dispatch', dt(s.planned_dispatch)], ['Dispatched', dt(s.dispatched_at)], ['Planned arrival', dt(s.planned_arrival)], ['Delivered', dt(s.delivered_at)]].map(([k, v]) => <div key={k}><dt className="text-[12px] font-bold uppercase tracking-wider text-stone-400">{k}</dt><dd className="mt-0.5 font-semibold text-stone-900">{v}</dd></div>)}</dl>
      {err && <div className="mt-4"><Notice kind="error" onClose={() => setErr('')}>{err}</Notice></div>}
      <div className="mt-5 flex flex-wrap gap-2">
        {s.status === 'booked' && <><button disabled={busy} onClick={() => step('dispatch', 'Loaded and sealed')} className={`${btnPrimary} flex items-center gap-2`}><Send size={16} /> Dispatch</button><button disabled={busy} onClick={() => step('cancel', 'Cancelled before dispatch')} className={btnGhost}>Cancel shipment</button></>}
        {s.status === 'in_transit' && <><button onClick={() => setMode('receive')} className={`${btnPrimary} flex items-center gap-2`}><Check size={16} /> Receive</button><button onClick={() => setMode('update')} className={btnGhost}>Add update</button><button onClick={() => setMode('delay')} className={btnGhost}>Report delay</button></>}
        {(s.status === 'booked' || s.status === 'in_transit') && <button onClick={() => setMode('exception')} className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-[15px] font-bold text-rose-700 hover:bg-rose-100">Report a problem</button>}
        {s.status === 'exception' && <button disabled={busy} onClick={() => step('resolve', 'Problem resolved')} className={`${btnPrimary} flex items-center gap-2`}><CircleCheck size={16} /> Mark resolved</button>}</div>
      {mode && <div className="mt-4 space-y-3 rounded-2xl border border-stone-100 p-4">
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
  const [rows, setRows] = useState<Shipment[]>([]); const [events, setEvents] = useState<Ev[]>([]); const [sel, setSel] = useState<string | null>(null); const [adding, setAdding] = useState(false); const [f, setF] = useState('all'); const [q, setQ] = useState(''); const [pick, setPick] = useState(''); const [loaded, setLoaded] = useState(false)
  const org = role !== 'superadmin' ? role : pick || orgs[0]?.id || ''
  const load = useCallback(async () => {
    const { data } = await supabase.from('shipments').select('*').order('created_at', { ascending: false }).limit(300); setRows((data ?? []) as Shipment[]); setLoaded(true)
    const { data: ev } = await supabase.from('shipment_events').select('*').order('created_at', { ascending: false }).limit(1500); setEvents((ev ?? []) as Ev[])
  }, [])
  useEffect(() => { void load(); const id = setInterval(() => void load(), 20000); return () => clearInterval(id) }, [load])
  const mine = useMemo(() => rows.filter((r) => role === 'superadmin' || r.org_id === role), [rows, role])
  const list = mine.filter((r) => (f === 'all' || (f === 'open' ? r.status === 'booked' || r.status === 'in_transit' : r.status === f)) && (r.ref + r.from_name + r.to_name + r.description).toLowerCase().includes(q.toLowerCase()))
  const cur = mine.find((r) => r.id === sel) ?? null
  const n = (st: string) => mine.filter((r) => r.status === st).length
  return (
    <>
      <Card className="mb-6 p-5"><ol className="grid gap-4 md:grid-cols-4">{STEPS.map(([t, h], i) => <li key={t} className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cyan-600 text-[14px] font-extrabold text-white">{i + 1}</span><span><span className="block text-[15px] font-extrabold text-stone-900">{t}</span><span className="text-[13.5px] text-stone-500">{h}</span></span></li>)}</ol></Card>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4">{[['Booked', n('booked'), 'text-stone-900'], ['On the way', n('in_transit'), 'text-blue-600'], ['Delivered', n('delivered'), 'text-emerald-600'], ['Problems', n('exception'), n('exception') ? 'text-rose-600' : 'text-stone-900']].map(([l, v, c]) => <div key={l as string} className="card p-5"><div className={`text-[32px] font-extrabold leading-none ${c}`}>{v}</div><div className="mt-2 text-[14px] font-bold text-stone-600">{l}</div></div>)}</div>
        <div className="flex items-center gap-2">{role === 'superadmin' && <select value={pick || orgs[0]?.id} onChange={(e) => setPick(e.target.value)} className="h-12 rounded-2xl border border-stone-200 bg-white px-4 text-[14.5px] font-semibold" aria-label="Client">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}<button onClick={() => setAdding(true)} disabled={!org} className={`${btnPrimary} flex items-center gap-2`}><PackagePlus size={18} /> New shipment</button></div></div>
      {adding && org && <NewShipment org={org} onCancel={() => setAdding(false)} onDone={(id) => { setAdding(false); setSel(id); void load() }} />}
      <div className="grid items-start gap-6 xl:grid-cols-[420px_1fr]">
        <Card><div className="space-y-3 border-b border-stone-100 p-4"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reference, place or contents" className={inputCls} />
          <div className="flex flex-wrap gap-2">{[['all', 'All'], ['open', 'Open'], ['booked', 'Booked'], ['in_transit', 'On the way'], ['delivered', 'Delivered'], ['exception', 'Problems']].map(([k, l]) => <button key={k} onClick={() => setF(k)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${f === k ? 'bg-cyan-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{l}</button>)}</div></div>
          <ul className="divide-y divide-stone-100">{!loaded && <li className="p-6 text-center text-stone-400">Loading…</li>}{loaded && list.length === 0 && <li className="p-8 text-center"><Truck className="mx-auto text-stone-300" size={30} /><div className="mt-2 text-[15px] font-bold text-stone-700">No shipments yet</div><div className="text-[13.5px] text-stone-500">Book one to start. It appears here and is tracked until it is received.</div></li>}
            {list.map((r) => <li key={r.id}><button onClick={() => setSel(r.id)} className={`w-full px-5 py-4 text-left ${cur?.id === r.id ? 'bg-cyan-50' : 'hover:bg-stone-50'}`}><div className="flex items-center justify-between gap-3"><span className="mono text-[15px] font-bold text-stone-900">{r.ref}</span><span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span></div><div className="mt-1 truncate text-[13.5px] text-stone-500">{r.from_name} → {r.to_name}</div><div className="mt-0.5 text-[12.5px] text-stone-400">{KINDS[r.kind]} · {r.items} item{r.items === 1 ? '' : 's'}{role === 'superadmin' ? ` · ${orgs.find((o) => o.id === r.org_id)?.name ?? r.org_id}` : ''}</div></button></li>)}</ul></Card>
        {cur ? <Detail key={cur.id} s={cur} org={org} events={events.filter((e) => e.shipment_id === cur.id).reverse()} onChange={() => void load()} /> : <Card className="grid place-items-center p-12 text-center"><div><AlertTriangle className="mx-auto text-stone-300" size={30} /><div className="mt-2 text-[15px] font-bold text-stone-700">Choose a shipment to see its progress</div></div></Card>}
      </div>
      <span hidden>{user?.id}</span>
    </>)
}

export default function Shipments() {
  const [tab, setTab] = useState<'work' | 'live'>('work')
  return (
    <Page title="Shipments" sub="Book a delivery or collection, send it, and receive it. Everything is recorded."
      right={<div className="flex rounded-full bg-stone-200/70 p-1">{([['work', 'My shipments'], ['live', 'Live tracking']] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-[14px] font-bold ${tab === k ? 'bg-white text-stone-900 shadow' : 'text-stone-500'}`}>{l}</button>)}</div>}>
      {tab === 'work' ? <Workflow /> : <ShipmentsLive />}
    </Page>)
}
