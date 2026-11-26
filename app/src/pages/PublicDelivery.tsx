import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clock3, PackageCheck, TriangleAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'
import { Toasts } from '../components/Toasts'
import { Logo } from '../components/Logo'
import { DeliveryMap } from '../components/DeliveryMap'
import { CustomerReceive } from './CustomerReceive'
import type { Line } from './ShipmentContents'

interface Pub { ref: string; status: 'booked' | 'in_transit' | 'delivered' | 'exception' | 'cancelled'; sender: string; from_name: string; to_name: string; items: number; description: string; planned_arrival: string | null; dispatched_at: string | null; arrived_at: string | null; delivered_at: string | null; items_received: number | null; received_by_name: string | null; received_at: string | null; received_method: string | null; lines: { source: Line['source']; label: string; qty: number }[] }
const dt = (s?: string | null) => (s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–')

/** The page a customer opens from their email. No sign-in: the secret in the link is the key. */
export default function PublicDelivery({ token }: { token: string }) {
  const [d, setD] = useState<Pub | null | undefined>(undefined); const [net, setNet] = useState(false); const prev = useRef<string>('')
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('public_shipment', { p_token: token })
    if (error) return setNet(true); setNet(false); const x = (data ?? null) as Pub | null; setD(x)
    if (x) { const k = `${x.status}|${x.arrived_at ?? ''}`; if (prev.current && prev.current !== k) { if (x.arrived_at && !prev.current.split('|')[1]) { toast.ok('Your delivery has arrived. Please confirm it below.'); window.scrollTo({ top: 0, behavior: 'smooth' }) } else if (x.status === 'in_transit' && !prev.current.startsWith('in_transit')) toast.info('Your delivery is on its way.') } prev.current = k }
  }, [token])
  useEffect(() => { void load(); const t = setInterval(() => void load(), 8000); return () => clearInterval(t) }, [load])
  useEffect(() => { document.title = d ? `Delivery ${d.ref}` : 'Your delivery' }, [d])
  const shell = (children: React.ReactNode) => (
    <div className="min-h-full bg-[#f6f7fd]"><Toasts /><div className="mx-auto w-full max-w-[560px] px-3 pb-8 pt-3">
      <div className="mb-3 flex items-center gap-2.5 px-1"><Logo size={30} /><span className="text-[16px] font-semibold tracking-tight text-stone-900">Tex-Trak</span><span className="ml-auto text-[12px] font-semibold text-stone-400">Track · Trace · Prove</span></div>
      {children}<p className="mt-6 text-center text-[12.5px] font-semibold text-stone-400">Tex-Trak · Developed by CIRCAI LTD</p></div></div>)
  if (d === undefined) return shell(<div className="h-40 animate-pulse rounded-3xl bg-white" />)
  if (d === null) return shell(<div className="rounded-3xl border border-stone-200 bg-white p-6 text-center"><TriangleAlert className="mx-auto text-amber-500" size={30} /><h1 className="mt-2 text-[19px] font-extrabold text-stone-900">This link is not valid</h1><p className="mt-1 text-[14.5px] text-stone-500">Please use the link from your latest email, or contact the sender.{net ? ' You also seem to be offline.' : ''}</p></div>)
  const arrived = d.status === 'in_transit' && !!d.arrived_at
  const lines: Line[] = d.lines.map((l) => ({ source: l.source, ref: l.label, label: l.label, qty: Number(l.qty) }))
  const chip = arrived ? ['Arrived', 'bg-emerald-100 text-emerald-800'] : d.status === 'in_transit' ? ['On the way', 'bg-blue-100 text-blue-800'] : d.status === 'booked' ? ['Booked', 'bg-stone-200 text-stone-700'] : d.status === 'delivered' ? ['Delivered', 'bg-emerald-100 text-emerald-800'] : d.status === 'exception' ? ['Problem reported', 'bg-rose-100 text-rose-800'] : ['Cancelled', 'bg-stone-200 text-stone-500']
  return shell(<>
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[17px] font-semibold text-stone-700">From {d.sender}</div><h1 className="mono text-[22px] font-extrabold leading-tight text-stone-900">{d.ref}</h1></div><span className={`shrink-0 rounded-full px-3 py-1.5 text-[16px] font-extrabold ${chip[1]}`}>{chip[0]}</span></div>
      <div className="mt-3 space-y-1 rounded-2xl bg-stone-50 px-3.5 py-3 text-[17px] leading-snug text-stone-900"><div>From <b>{d.from_name}</b></div><div>To <b>{d.to_name}</b></div></div>
      <p className="mt-2 text-[17px] text-stone-700">{d.items} item{d.items === 1 ? '' : 's'}{d.description ? ` · ${d.description}` : ''}{d.planned_arrival && d.status !== 'delivered' ? ` · expected ${dt(d.planned_arrival)}` : ''}</p>
    </div>

    {arrived && <div className="mt-3 flex items-start gap-3 rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-4 text-emerald-950"><PackageCheck size={34} className="mt-0.5 shrink-0" /><div><h2 className="text-[23px] font-extrabold leading-tight">Your delivery has arrived</h2><p className="mt-1 text-[17px] leading-snug">Please check it, then sign below.</p></div></div>}

    {arrived && <CustomerReceive shipRef={d.ref} expected={d.items} lines={lines} onDone={() => void load()} checkCode={async (code) => { const { data, error } = await supabase.rpc('public_shipment_barcode', { p_token: token, p_code: code }); return { item: (data as string | null) ?? null, error: error?.message ?? null } }} submit={async (r) => { const { error } = await supabase.rpc('public_shipment_accept', { p_token: token, p_method: r.method, p_items: r.items, p_name: r.name, p_signature: r.signature, p_note: r.note, p_scanned: r.scanned }); if (!error && r.barcode) { const { error: e2 } = await supabase.rpc('public_shipment_barcode', { p_token: token, p_code: r.barcode, p_record: true }); if (e2) toast.error('Your delivery is confirmed, but the barcode could not be saved.') } return error ? error.message : null }} />}

    {!arrived && lines.length > 0 && d.status !== 'cancelled' && <div className="mt-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70"><h2 className="text-[18px] font-extrabold text-stone-900">What is in it</h2><ul className="mt-1 divide-y divide-stone-100">{lines.map((l) => <li key={l.source + l.ref} className="flex items-start justify-between gap-3 py-2.5 text-[17px] text-stone-900"><span className="min-w-0 break-words font-semibold">{l.label}</span>{(l.source === 'wh_order' || l.source === 'wh_goods_out' || l.qty !== 1) && <span className="shrink-0 font-bold">{l.qty} item{l.qty === 1 ? '' : 's'}</span>}</li>)}</ul></div>}

    {d.status === 'in_transit' && <div className="mt-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
      {!arrived && <p className="flex items-center gap-2 text-[18px] font-bold text-sky-950"><Clock3 size={22} className="shrink-0 text-sky-600" /> On its way to you. You can confirm it here as soon as it arrives.</p>}
      <DeliveryMap token={token} id={d.ref} status={d.status + (d.arrived_at ?? '')} height={arrived ? 200 : 360} /></div>}
    {d.status === 'booked' && <div className="mt-3 rounded-3xl bg-white p-4 text-[17px] font-semibold text-stone-700 shadow-sm ring-1 ring-stone-200/70"><Clock3 size={18} className="mb-1 text-stone-400" /> This delivery has not left yet. Keep this page: it will show the live map when it does.</div>}
    {d.status === 'delivered' && <div className="mt-3 rounded-3xl bg-emerald-50 p-5 text-center ring-1 ring-emerald-200"><PackageCheck className="mx-auto text-emerald-600" size={34} /><h2 className="mt-1 text-[20px] font-extrabold text-emerald-900">Delivery confirmed. Thank you.</h2><p className="mt-1 text-[17px] text-emerald-900">{d.items_received} of {d.items} items{d.received_by_name ? ` · signed by ${d.received_by_name}` : ''} · {dt(d.received_at ?? d.delivered_at)}</p></div>}
    {d.status === 'exception' && <div className="mt-3 rounded-3xl bg-amber-50 p-5 text-center ring-1 ring-amber-200"><CheckCircle2 className="mx-auto text-amber-600" size={32} /><h2 className="mt-1 text-[19px] font-extrabold text-amber-900">Thank you. Your report has been recorded.</h2><p className="mt-1 text-[17px] text-amber-900">{d.items_received != null ? `${d.items_received} of ${d.items} items received. ` : ''}{d.sender} has been told and will be in touch.</p></div>}
    {d.status === 'cancelled' && <div className="mt-3 rounded-3xl bg-white p-5 text-center text-[15px] font-semibold text-stone-500 ring-1 ring-stone-200">This delivery was cancelled.</div>}
  </>)
}
