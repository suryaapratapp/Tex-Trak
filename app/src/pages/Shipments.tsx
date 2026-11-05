import { useState } from 'react'
import { Check, MapPin, Package } from 'lucide-react'
import { Bar, Card, CardHead, Chip, Page } from '../components/ui'
import { EventFeed } from '../components/Feed'
import { FleetMapView } from '../components/FleetMapView'
import { fmtT, getWorld, type Consignment } from '../sim/engine'
import { SITES, VEH_BY_ID } from '../sim/world'
import { fmtDur, useSnap } from '../sim/snap'
import { useStore } from '../store'

interface Step { label: string; t: number; sub?: string; bad?: boolean }
function view(c: Consignment, t: number, snap: ReturnType<typeof useSnap>) {
  const w = getWorld(); const leg = w.legs.find((l) => l.id === c.legId)
  if (!leg) {
    const steps: Step[] = [{ label: 'Label created', t: 360 }, { label: 'Collected by carrier', t: 570 }, { label: 'In transit · Stratford depot', t: 700 }, { label: 'Out for delivery', t: 825 }, { label: 'Delivered · signed at dock', t: 905 }]
    const done = steps.filter((s) => s.t <= t).length
    return { steps, done, status: done >= 5 ? 'delivered' : done >= 4 ? 'out for delivery' : done >= 2 ? 'in transit' : 'booked', eta: 905, progress: Math.min(1, done / 5), delay: 0, exception: false }
  }
  const diverted = c.verdict === 'diverted'; const broken = diverted && t >= 760
  const steps: Step[] = [{ label: 'Booked & manifest created', t: leg.depart - 120 }, { label: 'Loaded & sealed', t: leg.depart - 10, sub: `${c.cages.join(', ')} · RFID bound` }, { label: `Departed ${SITES[c.from].short}`, t: leg.depart, sub: 'GNSS tracking started' },
    { label: 'In transit', t: leg.depart + 1 }, ...(broken ? [{ label: 'EXCEPTION — destination never reached', t: 760, bad: true, sub: 'Entered Port of Tilbury · tracker silent' }] : [{ label: `Arrived ${SITES[c.to].short}`, t: leg.arrive }, { label: c.kind === 'parcel' ? 'Delivered' : 'Received & RFID-reconciled', t: leg.arrive + 28 }])]
  const done = steps.filter((s) => s.t <= t).length
  const v = snap.veh[c.veh]
  const progress = broken ? 1 : t >= leg.arrive ? 1 : t < leg.depart ? 0 : v.progress
  const status = broken ? 'exception' : t < leg.depart - 10 ? 'booked' : t < leg.depart ? 'loaded' : t < leg.arrive ? 'in transit' : t < leg.arrive + 28 ? 'arrived' : 'delivered'
  return { steps, done, status, eta: v.leg?.id === leg.id ? v.eta! : leg.arrive, progress, delay: (v.leg?.id === leg.id ? v.eta! : leg.arrive) - leg.planArrive, exception: broken }
}
const tone = (s: string) => (s === 'delivered' ? 'green' : s === 'exception' ? 'red' : s === 'in transit' || s === 'out for delivery' ? 'blue' : s === 'booked' ? 'slate' : 'amber') as 'green' | 'red' | 'blue' | 'slate' | 'amber'

export default function Shipments() {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const { selShip, set } = useStore()
  const c = w.consignments.find((x) => x.ref === selShip) ?? w.consignments[0]; const v = view(c, t, snap)
  const [q, setQ] = useState('')
  const list = w.consignments.filter((x) => (x.ref + x.desc).toLowerCase().includes(q.toLowerCase()))
  return (
    <Page title="Shipments" sub="Every delivery and collection.">
      <div className="grid gap-4 xl:grid-cols-[400px_1fr]">
        <Card><div className="border-b border-slate-100 p-3"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reference…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500" /></div>
          <ul className="divide-y divide-slate-100">{list.map((x) => { const vv = view(x, t, snap); return (
            <li key={x.ref}><button onClick={() => set({ selShip: x.ref })} className={`w-full px-4 py-3 text-left ${c.ref === x.ref ? 'bg-cyan-50/60' : 'hover:bg-slate-50'}`}>
              <div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-slate-900">{x.ref}</span><Chip tone={tone(vv.status)}>{vv.status}</Chip></div>
              <div className="mt-0.5 text-xs text-slate-500">{SITES[x.from].short} → {SITES[x.to].short} · {x.items} items</div><div className="mt-2"><Bar v={vv.progress} color={vv.exception ? '#e11d48' : '#1c1917'} /></div></button></li>) })}</ul></Card>
        <div className="space-y-4">
          <Card><div className="flex flex-wrap items-start justify-between gap-4 p-5">
            <div><div className="flex items-center gap-2"><Package size={18} className="text-cyan-600" /><h2 className="text-lg font-semibold text-slate-900">{c.ref}</h2><Chip tone={tone(v.status)}>{v.status}</Chip></div><p className="mt-1 text-sm text-slate-600">{c.desc}</p><p className="mt-0.5 text-xs text-slate-500">Carrier: {c.carrier}{c.veh ? ` · ${VEH_BY_ID[c.veh].reg} · ${VEH_BY_ID[c.veh].driver}` : ''}</p></div>
            <div className="text-right"><div className="text-[11px] uppercase tracking-wider text-slate-500">{v.status === 'delivered' ? 'Delivered' : 'Estimated arrival'}</div><div className="mono text-3xl font-semibold tracking-tight text-slate-900">{v.exception ? '—' : fmtT(v.eta).slice(0, 5)}</div>
              <div className={`text-xs font-medium ${v.exception ? 'text-rose-600' : v.delay > 8 ? 'text-amber-600' : 'text-emerald-600'}`}>{v.exception ? 'will not arrive' : `${v.delay >= 0 ? '+' : ''}${Math.round(v.delay)} min vs plan${t < v.eta ? ` · in ${fmtDur(v.eta - t)}` : ''}`}</div></div></div>
            <div className="px-5 pb-5"><div className="mb-1 flex items-center justify-between text-xs text-slate-500"><span className="flex items-center gap-1"><MapPin size={12} />{SITES[c.from].name}</span><span>{SITES[c.to].name}</span></div><Bar v={v.progress} color={v.exception ? '#e11d48' : '#1c1917'} h={10} /></div></Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHead title="Tracking history" />
              <ol className="p-4">{v.steps.map((s, i) => { const d = s.t <= t; return (<li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                {i < v.steps.length - 1 && <span className={`absolute left-[9px] top-5 h-full w-0.5 ${i < v.done - 1 ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                <span className={`z-10 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white ${s.bad && d ? 'bg-rose-500' : d ? 'bg-emerald-500' : 'bg-slate-200'}`}>{d && <Check size={11} />}</span>
                <div className={d ? '' : 'opacity-40'}><div className={`text-[13px] font-medium ${s.bad ? 'text-rose-700' : 'text-slate-900'}`}>{s.label}</div><div className="mono text-[11px] text-slate-500">{fmtT(s.t)}{s.sub ? ` · ${s.sub}` : ''}</div></div></li>) })}</ol></Card>
            {c.veh ? <Card className="overflow-hidden"><CardHead title="Live position" /><FleetMapView vehIds={[c.veh]} height={300} sites={[c.from, c.to]} /></Card> : <Card><CardHead title="Carrier feed" /><div className="p-4 text-sm text-slate-500">Parcel tracked via carrier API milestones (no onboard GNSS). Upgrade path: attach a TAT240 tag to the carton for in-transit visibility.</div></Card>}
          </div>
          <Card><CardHead title="Consignment events" /><EventFeed limit={8} filter={(e) => e.cons === c.ref} /></Card>
        </div>
      </div>
    </Page>
  )
}
