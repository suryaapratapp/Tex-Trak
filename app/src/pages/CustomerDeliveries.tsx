import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Clock3, PackageCheck, TriangleAlert, Truck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'
import { DeliveryMap } from '../components/DeliveryMap'
import { CustomerReceive } from './CustomerReceive'
import type { Line } from './ShipmentContents'
import type { Ev, Shipment } from './Shipments'

const when = (s?: string | null) => (s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '')
const items = (n: number) => `${n} item${n === 1 ? '' : 's'}`
const EV: Record<string, string> = { booked: 'Booked', dispatched: 'Left the sender', update: 'Update', delayed: 'Delay', received: 'Received', exception: 'Problem reported', cancelled: 'Cancelled' }

type State = 'arrived' | 'coming' | 'booked' | 'done' | 'problem'
const stateOf = (s: Shipment): State => (s.status === 'in_transit' ? (s.arrived_at ? 'arrived' : 'coming') : s.status === 'booked' ? 'booked' : s.status === 'exception' ? 'problem' : 'done')
const RANK: Record<State, number> = { arrived: 0, coming: 1, booked: 2, done: 3, problem: 3 }
const latest = (s: Shipment) => new Date((stateOf(s) === 'arrived' ? s.arrived_at : s.received_at ?? s.delivered_at ?? s.arrived_at ?? s.dispatched_at) ?? s.created_at).getTime()
/** What needs the customer first: arrived and waiting to be signed (newest arrival first), then on the way, then not left yet, then finished (newest first). */
export const customerOrder = (list: Shipment[]) => list.filter((s) => s.status !== 'cancelled').sort((a, b) => RANK[stateOf(a)] - RANK[stateOf(b)] || latest(b) - latest(a))

const LOOK: Record<State, { title: string; text: string; chip: string; box: string; icon: typeof Truck; tint: string }> = {
  arrived: { title: 'Your delivery has arrived', text: 'Please check it, then sign below.', chip: 'Arrived. Please sign', box: 'border-emerald-300 bg-emerald-50 text-emerald-950', icon: PackageCheck, tint: 'bg-emerald-100 text-emerald-900' },
  coming: { title: 'Your delivery is on its way', text: 'You do not need to do anything yet. You can sign for it here when it arrives.', chip: 'On the way', box: 'border-blue-300 bg-blue-50 text-blue-950', icon: Truck, tint: 'bg-blue-100 text-blue-900' },
  booked: { title: 'Your delivery has not left yet', text: 'You do not need to do anything yet.', chip: 'Not left yet', box: 'border-stone-300 bg-stone-50 text-stone-900', icon: Clock3, tint: 'bg-stone-200 text-stone-800' },
  done: { title: 'Delivered. Thank you', text: 'There is nothing more to do.', chip: 'Delivered', box: 'border-emerald-300 bg-emerald-50 text-emerald-950', icon: CheckCircle2, tint: 'bg-emerald-100 text-emerald-900' },
  problem: { title: 'A problem has been recorded', text: 'The sender has been told. There is nothing more to sign.', chip: 'Problem recorded', box: 'border-amber-300 bg-amber-50 text-amber-950', icon: TriangleAlert, tint: 'bg-amber-100 text-amber-900' },
}

function Fold({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return <div className="rounded-3xl border border-stone-200 bg-white"><button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 text-left text-[18px] font-extrabold text-stone-900">{label}<ChevronDown size={24} className={`shrink-0 text-stone-500 transition-transform ${open ? 'rotate-180' : ''}`} /></button>{open && <div className="border-t border-stone-100 px-4 pb-4 pt-1">{children}</div>}</div>
}

function Contents({ lines, count }: { lines: Line[]; count: number }) {
  return <div className="rounded-3xl border border-stone-200 bg-white p-4"><h3 className="text-[18px] font-extrabold text-stone-900">What is in it: {items(count)}</h3>
    {lines.length > 0 && <ul className="mt-2 divide-y divide-stone-100">{lines.map((l) => <li key={l.source + l.ref} className="flex items-start justify-between gap-3 py-2.5 text-[17px] text-stone-900"><span className="min-w-0 break-words font-semibold">{l.label}</span>{(l.source === 'wh_order' || l.source === 'wh_goods_out' || l.qty !== 1) && <span className="shrink-0 font-bold">{items(l.qty)}</span>}</li>)}</ul>}</div>
}

function Delivery({ s, events, onDone }: { s: Shipment; events: Ev[]; onDone: () => void }) {
  const [lines, setLines] = useState<Line[]>([]); const [sig, setSig] = useState<string | null>(null)
  useEffect(() => { let off = false; void supabase.from('shipment_lines').select('source,ref_id,label,qty').eq('shipment_id', s.id).order('id').limit(3000).then(({ data }) => { if (!off) setLines(((data ?? []) as { source: Line['source']; ref_id: string; label: string; qty: number }[]).map((r) => ({ source: r.source, ref: r.ref_id, label: r.label, qty: Number(r.qty) }))) }); return () => { off = true } }, [s.id])
  useEffect(() => { if (!s.received_at) return; let off = false; void supabase.from('shipments').select('received_signature').eq('id', s.id).maybeSingle().then(({ data }) => { if (!off) setSig((data as { received_signature: string | null } | null)?.received_signature ?? null) }); return () => { off = true } }, [s.id, s.received_at])
  const st = stateOf(s); const look = LOOK[st]; const Icon = look.icon
  const map = <DeliveryMap id={s.id} status={s.status + (s.arrived_at ?? '')} height={260} />
  return (
    <div className="space-y-3">
      <div className={`rounded-3xl border-2 p-4 ${look.box}`}>
        <div className="flex items-start gap-3"><Icon size={34} className="mt-0.5 shrink-0" /><div className="min-w-0"><h2 className="text-[23px] font-extrabold leading-tight">{look.title}</h2><p className="mt-1 text-[17px] leading-snug">{look.text}</p></div></div>
        <div className="mt-3 rounded-2xl bg-white/80 px-3.5 py-3 text-[17px] leading-snug text-stone-900"><div><b className="mono">{s.ref}</b> · {items(s.items)}</div><div className="mt-1">From <b>{s.from_name}</b></div><div>To <b>{s.to_name}</b></div>
          {st === 'arrived' && <div className="mt-1">Arrived {when(s.arrived_at)}</div>}{st === 'coming' && s.planned_arrival && <div className="mt-1">Expected {when(s.planned_arrival)}</div>}</div>
      </div>

      {st === 'arrived' && <CustomerReceive shipRef={s.ref} expected={s.items} lines={lines} onDone={onDone} checkCode={async (code) => { const { data, error } = await supabase.rpc('shipment_receipt_barcode', { p_id: s.id, p_code: code }); return { item: (data as string | null) ?? null, error: error?.message ?? null } }} submit={async (r) => { const { error } = await supabase.rpc('shipment_customer_receive', { p_id: s.id, p_method: r.method, p_items: r.items, p_name: r.name, p_signature: r.signature, p_note: r.note, p_scanned: r.scanned }); if (!error && r.barcode) { const { error: e2 } = await supabase.rpc('shipment_receipt_barcode', { p_id: s.id, p_code: r.barcode, p_record: true }); if (e2) toast.error('The delivery is confirmed, but the barcode could not be saved.') } return error ? error.message : null }} />}

      {s.received_at && <div className="rounded-3xl border border-stone-200 bg-white p-4 text-[17px] text-stone-900"><h3 className="text-[18px] font-extrabold">Received and signed</h3>
        <div className="mt-1"><b>{s.received_by_name}</b>, {when(s.received_at)}</div><div>{s.items_received} of {items(s.items)} received</div>
        {s.received_barcode && <div className="mt-1 break-words font-semibold text-emerald-800">Item barcode confirmed: {s.received_barcode_item} ({s.received_barcode})</div>}
        {sig && <img src={sig} alt={`Signature of ${s.received_by_name}`} className="mt-3 h-24 max-w-full rounded-xl border border-stone-200 bg-white" />}</div>}

      {st !== 'arrived' && <Contents lines={lines} count={s.items} />}
      {st === 'coming' && <div className="rounded-3xl border border-stone-200 bg-white px-3 pb-3"><div>{map}</div></div>}
      {(st === 'arrived' || st === 'done' || st === 'problem') && <Fold label="Show the map">{map}</Fold>}
      {events.length > 0 && <Fold label="Show what has happened"><ol className="mt-2 space-y-4 border-l-2 border-stone-200 pl-4">{events.map((e) => <li key={e.id}><div className="text-[17px] font-bold text-stone-900">{EV[e.type] ?? 'Update'}</div>{e.detail && <div className="break-words text-[16px] text-stone-700">{e.detail.replace(/sealed/gi, (m) => (m[0] === 'S' ? 'Packed' : 'packed'))}</div>}<div className="text-[15px] text-stone-500">{when(e.created_at)}</div></li>)}</ol></Fold>}
    </div>)
}

/** The whole customer side on one phone-width column: the delivery that needs them is already open at the top. */
export function CustomerDeliveries({ list, events, loaded, onChange }: { list: Shipment[]; events: Ev[]; loaded: boolean; onChange: () => void }) {
  const sorted = customerOrder(list); const top = sorted[0]
  const [sel, setSel] = useState<string | null>(null)
  const cur = sorted.find((s) => s.id === sel) ?? top
  // Stay on a delivery that is waiting for a signature, so a newer one arriving never wipes what has been typed.
  useEffect(() => { if (!sel && cur && stateOf(cur) === 'arrived') setSel(cur.id) }, [sel, cur])
  const open = (id: string | null) => { setSel(id); document.querySelector('main')?.scrollTo({ top: 0 }) }
  if (!loaded) return <div className="mx-auto h-48 max-w-[620px] animate-pulse rounded-3xl bg-white" aria-busy="true" />
  if (!cur) return <div className="mx-auto max-w-[620px] rounded-3xl border border-stone-200 bg-white p-6 text-center"><Truck className="mx-auto text-stone-400" size={44} /><h2 className="mt-2 text-[22px] font-extrabold text-stone-900">No deliveries yet</h2><p className="mt-1 text-[17px] text-stone-600">When something is sent to you, it will appear here.</p></div>
  const others = sorted.filter((s) => s.id !== cur.id); const waiting = others.filter((s) => stateOf(s) === 'arrived')
  return (
    <div className="mx-auto w-full max-w-[620px] space-y-3">
      {cur.id !== top.id && <button type="button" onClick={() => open(null)} className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-stone-300 bg-white px-4 text-[17px] font-extrabold text-stone-900"><ArrowLeft size={22} /> Back to the newest delivery</button>}
      {stateOf(cur) !== 'arrived' && waiting.length > 0 && <button type="button" onClick={() => open(waiting[0].id)} className="flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-[18px] font-extrabold text-white">{waiting.length === 1 ? 'Another delivery is waiting for you' : `${waiting.length} deliveries are waiting for you`} <ChevronRight size={22} className="shrink-0" /></button>}
      <Delivery key={cur.id} s={cur} events={events.filter((e) => e.shipment_id === cur.id).reverse()} onDone={() => { setSel(cur.id); onChange(); document.querySelector('main')?.scrollTo({ top: 0 }) }} />
      {others.length > 0 && <section className="pt-3"><h2 className="mb-2 px-1 text-[20px] font-extrabold text-stone-900">Your other deliveries</h2>
        <ul className="space-y-2.5">{others.map((s) => { const k = LOOK[stateOf(s)]; return <li key={s.id}><button type="button" onClick={() => open(s.id)} className="flex min-h-[76px] w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-left"><span className="min-w-0 flex-1"><span className={`inline-block rounded-lg px-2.5 py-1 text-[16px] font-extrabold ${k.tint}`}>{k.chip}</span><span className="mt-1.5 block text-[17px] text-stone-900"><b className="mono">{s.ref}</b> · {items(s.items)}</span><span className="block text-[16px] text-stone-600">From {s.from_name}</span></span><ChevronRight size={28} className="shrink-0 text-stone-500" /></button></li> })}</ul></section>}
    </div>)
}
