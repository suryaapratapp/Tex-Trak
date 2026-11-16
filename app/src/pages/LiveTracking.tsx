import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Truck } from 'lucide-react'
import { Card } from '../components/ui'
import { DeliveryMap } from '../components/DeliveryMap'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useStore } from '../store'

interface Row { id: string; ref: string; org_id: string; from_name: string; to_name: string; items: number; carrier: string; vehicle_reg: string; planned_arrival: string | null; dispatched_at: string | null; arrived_at: string | null; description: string }
const dt = (s?: string | null) => (s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–')

/** Real shipments that are on the way right now, each on a live map. */
export default function LiveTracking() {
  const role = useStore((s) => s.role); const orgs = useAuth((s) => s.orgs); const [rows, setRows] = useState<Row[] | null>(null); const [sel, setSel] = useState<string | null>(null)
  const load = useCallback(async () => {
    const { data } = await supabase.from('shipments').select('id,ref,org_id,from_name,to_name,items,carrier,vehicle_reg,planned_arrival,dispatched_at,arrived_at,description,customer_org_id').eq('status', 'in_transit').order('dispatched_at', { ascending: false })
    setRows(((data ?? []) as (Row & { customer_org_id: string | null })[]).filter((r) => role === 'superadmin' || r.org_id === role || r.customer_org_id === role))
  }, [role])
  useEffect(() => { void load(); const t = setInterval(() => void load(), 10000); return () => clearInterval(t) }, [load])
  const cur = rows?.find((r) => r.id === sel) ?? rows?.[0] ?? null
  if (rows === null) return <Card className="p-8 text-center text-stone-400">Loading…</Card>
  if (!cur) return <Card className="grid place-items-center p-12 text-center"><div><Truck className="mx-auto text-stone-300" size={32} /><div className="mt-2 text-[16px] font-bold text-stone-700">Nothing is on the way right now</div><div className="text-[14px] text-stone-500">When a shipment leaves, it appears here on a live map.</div></div></Card>
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[380px_1fr]">
      <Card><ul className="divide-y divide-stone-100">{rows.map((r) => (
        <li key={r.id}><button onClick={() => setSel(r.id)} className={`w-full border-l-4 px-4 py-3.5 text-left ${cur.id === r.id ? 'border-blue-500 bg-blue-50/70' : 'border-transparent hover:bg-stone-50'}`}>
          <div className="flex items-center justify-between gap-3"><span className="mono text-[15px] font-bold text-stone-900">{r.ref}</span><span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[12px] font-bold text-blue-700"><i className="live-dot" style={{ background: '#3b82f6' }} />{r.arrived_at ? 'Arrived' : 'On the way'}</span></div>
          <div className="mt-1 truncate text-[13.5px] text-stone-500">{r.from_name} → {r.to_name}</div></button></li>))}</ul></Card>
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3"><h2 className="mono text-[20px] font-extrabold text-stone-900">{cur.ref}</h2>{role === 'superadmin' && <span className="text-[13px] text-stone-500">{orgs.find((o) => o.id === cur.org_id)?.name}</span>}</div>
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-stone-50 p-3.5 text-[14.5px] font-bold text-stone-900"><span className="min-w-0 flex-1 truncate">{cur.from_name}</span><ArrowRight size={17} className="shrink-0 text-stone-400" /><span className="min-w-0 flex-1 truncate text-right">{cur.to_name}</span></div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[14px] md:grid-cols-4">{[['Items', String(cur.items)], ['Left', dt(cur.dispatched_at)], ['Planned arrival', dt(cur.planned_arrival)], ['Carrier', cur.carrier || '–']].map(([k, v]) => <div key={k}><dt className="text-[12px] font-bold uppercase tracking-wider text-stone-400">{k}</dt><dd className="mt-0.5 font-semibold text-stone-900">{v}</dd></div>)}</dl>
        <DeliveryMap key={cur.id} id={cur.id} status={'in_transit' + (cur.arrived_at ?? '')} height={420} />
      </Card>
    </div>)
}
