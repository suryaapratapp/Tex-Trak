import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart, Bar as RBar, Legend } from 'recharts'
import { CalendarClock, Users } from 'lucide-react'
import { Card, CardHead, Chip, Kpi, Page } from '../components/ui'
import { fmtT, getWorld, itemAt } from '../sim/engine'
import { fmtDur, useSnap } from '../sim/snap'

interface Inbound { id: string; from: string; reg: string; plan: number; delay: number; kg: number; items: number; live?: boolean; tracker: string }
const OTHERS: Inbound[] = [
  { id: 'DP-NW-02', from: 'St Anselm Hospital', reg: 'DP04 TRK', plan: 1055, delay: 6, kg: 1850, items: 342, tracker: 'TAT240' },
  { id: 'DP-NW-05', from: 'Harrow General', reg: 'DP09 TRK', plan: 1110, delay: 14, kg: 2300, items: 418, tracker: 'TAT240' },
  { id: 'DP-NW-07', from: 'Kingsmead Care Group', reg: 'DP11 TRK', plan: 1165, delay: 0, kg: 980, items: 176, tracker: 'TAT240' },
  { id: 'DP-SW-01', from: 'Thames Valley Trust', reg: 'DP02 TRK', plan: 1225, delay: 22, kg: 3100, items: 560, tracker: 'TAT240' },
  { id: 'DP-NW-09', from: 'Ealing Day Surgery', reg: 'DP15 TRK', plan: 1275, delay: 4, kg: 760, items: 140, tracker: 'TAT240' },
  { id: 'DP-NE-03', from: 'Barnet Community', reg: 'DP06 TRK', plan: 1335, delay: 10, kg: 1420, items: 255, tracker: 'TAT240' },
]
function PlantView() {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const [crew, setCrew] = useState(11)
  const L4 = w.legs.find((l) => l.id === 'L4')!; const v1 = snap.veh.V1
  const ours: Inbound = { id: L4.cons, from: 'Royal Meridian Hospital', reg: 'DP71 TRK', plan: L4.planArrive, delay: v1.leg?.id === 'L4' ? v1.delay : L4.arrive - L4.planArrive, kg: 373, items: 69, live: true, tracker: 'TAT240 …085066' }
  const all = [...OTHERS, ours].sort((a, b) => a.plan - b.plan)
  const row = (x: Inbound) => {
    const eta = x.plan + (x.live ? x.delay : x.delay * Math.min(1, Math.max(0, (t - (x.plan - 120)) / 90)))
    const dep = x.plan - 45
    const status = t < dep - 20 ? 'scheduled' : t < dep ? 'loading' : t < eta ? 'en route' : 'arrived'
    return { ...x, eta, status }
  }
  const rows = all.map(row)
  const cap = crew * 100 // kg/h
  const data: { h: string; arrivals: number; capacity: number; backlog: number }[] = []
  let backlog = 0
  for (let m = 1020; m <= 1620; m += 30) {
    const arr = rows.filter((x) => x.eta >= m && x.eta < m + 30).reduce((a, b) => a + b.kg, 0)
    backlog = Math.max(0, backlog + arr - cap / 2)
    data.push({ h: fmtT(m).slice(0, 5), arrivals: arr, capacity: cap / 2, backlog: Math.round(backlog) })
  }
  const peak = Math.max(...data.map((d) => d.backlog)); const clear = data.find((d, i) => i > 4 && d.backlog === 0)
  const total = rows.reduce((a, b) => a + b.kg, 0)
  const hoursNeeded = total / cap
  const needCrew = Math.ceil(total / 8 / 100)
  const next = rows.filter((x) => x.status !== 'arrived').sort((a, b) => a.eta - b.eta)[0]
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Inbound tonight" value={`${(total / 1000).toFixed(1)} t`} sub={`${rows.length} consignments · ${rows.reduce((a, b) => a + b.items, 0)} tagged items`} icon={<CalendarClock size={15} />} />
        <Kpi label="Next arrival" value={next ? fmtT(next.eta).slice(0, 5) : '—'} sub={next ? `${next.from} · in ${fmtDur(next.eta - t)}` : 'all received'} />
        <Kpi label="Peak backlog" value={`${(peak / 1000).toFixed(1)} t`} tone={peak > 2500 ? 'bad' : peak > 1000 ? 'warn' : 'good'} sub={clear ? `clears by ${clear.h}` : 'does not clear before 02:00'} />
        <Kpi label="Crew needed for 8 h shift" value={needCrew} tone={crew >= needCrew ? 'good' : 'warn'} sub={`${crew} rostered · ${hoursNeeded.toFixed(1)} h at current crew`} icon={<Users size={15} />} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card><CardHead title="Arrival board" sub="ETA from each truck's GNSS tracker, adjusted for traffic" />
          <table className="w-full text-left text-[13px]"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-2">Consignment</th><th>Origin</th><th>Plan</th><th>ETA</th><th>Δ</th><th>Load</th><th>Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((x) => (
              <tr key={x.id} className={x.live ? 'bg-cyan-50/50' : ''}><td className="px-4 py-2.5"><div className="font-medium text-slate-900">{x.id}</div><div className="mono text-[11px] text-slate-400">{x.reg} · {x.tracker}</div></td><td className="text-slate-700">{x.from}{x.live && <Chip tone="cyan"> live</Chip>}</td>
                <td className="mono text-slate-500">{fmtT(x.plan).slice(0, 5)}</td><td className="mono font-semibold text-slate-900">{fmtT(x.eta).slice(0, 5)}</td>
                <td className={`mono ${x.eta - x.plan > 10 ? 'text-amber-600' : 'text-slate-500'}`}>{x.eta - x.plan >= 0 ? '+' : ''}{Math.round(x.eta - x.plan)}m</td><td className="text-slate-600">{x.kg} kg · {x.items}</td>
                <td><Chip tone={x.status === 'arrived' ? 'green' : x.status === 'en route' ? 'blue' : x.status === 'loading' ? 'amber' : 'slate'}>{x.status}</Chip></td></tr>))}</tbody></table></Card>
        <Card><CardHead title="Capacity vs. arrivals" sub="Plant throughput = crew × 100 kg/h" right={<label className="flex items-center gap-2 text-xs text-slate-600">Crew <input type="range" min={6} max={20} value={crew} onChange={(e) => setCrew(+e.target.value)} className="accent-cyan-600" /><b className="w-5 text-slate-900">{crew}</b></label>} />
          <div className="h-[260px] p-3"><ResponsiveContainer><ComposedChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e5ebf2" /><XAxis dataKey="h" tick={{ fontSize: 10 }} interval={3} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
            <RBar dataKey="arrivals" name="Arrivals (kg/30m)" fill="#1c1917" radius={[3, 3, 0, 0]} /><Line dataKey="capacity" name="Capacity" stroke="#ea580c" dot={false} strokeWidth={2} /><Line dataKey="backlog" name="Backlog (kg)" stroke="#e11d48" dot={false} strokeWidth={2} /></ComposedChart></ResponsiveContainer></div>
          <div className="border-t border-slate-100 p-4 text-[12.5px] text-slate-700"><b>Recommendation:</b> {peak > 2500 ? `Backlog peaks at ${(peak / 1000).toFixed(1)} t. Add ${Math.max(1, needCrew - crew)} crew from 20:00 or divert DP-SW-01 to the Slough plant.` : peak > 1000 ? 'Backlog manageable; keep tunnel washer B on standby.' : 'Capacity comfortably covers tonight’s arrivals.'}</div></Card>
      </div>
    </>
  )
}

const PAR: [string, string, number][] = [['THEATRES', 'Operating Theatres', 10], ['ICU', 'Intensive Care', 8], ['WARD', 'General Ward', 8], ['AE', 'Emergency (A&E)', 8], ['MAT', 'Maternity', 6], ['OPD', 'Outpatients', 5]]
function HospitalView() {
  const snap = useSnap(); const t = snap.t; const w = getWorld()
  const inbound = w.consignments.filter((c) => c.to === 'HOSP').map((c) => {
    const leg = w.legs.find((l) => l.id === c.legId); const v = leg ? snap.veh[leg.veh] : null
    const plan = leg ? leg.planArrive : 905; const eta = leg ? (v?.leg?.id === leg.id ? v.eta! : leg.arrive) : 905
    const ready = eta + (c.kind === 'parcel' ? 0 : c.kind.startsWith('curtain') ? 20 : 28)
    const status = !leg ? (t < 570 ? 'booked' : t < eta ? 'in transit' : 'delivered') : t < leg.depart - 10 ? 'scheduled' : t < leg.depart ? 'loading' : t < eta ? 'en route' : t < ready ? 'goods-in' : 'ready'
    return { c, plan, eta, ready, status }
  }).sort((a, b) => a.eta - b.eta)
  const next = inbound.find((x) => x.eta > t)
  // clean stock on site over the day
  const series: { h: string; stock: number }[] = []
  for (let m = 300; m <= 1890; m += 30) series.push({ h: fmtT(m).slice(0, 5), stock: w.items.reduce((a, it) => { const l = itemAt(it, m); return a + (l.kind === 'zone' && l.plan === 'H' && l.status === 'in_stock' ? 1 : 0) }, 0) })
  const nowStock = series.filter((d) => +d.h.slice(0, 2) * 60 + +d.h.slice(3) <= t % 1440 + (t >= 1440 ? 1440 : 0)).slice(-1)[0]?.stock ?? 0
  const low = series.filter((d) => d.stock < 8 && +d.h.slice(0, 2) >= 7 && +d.h.slice(0, 2) < 24)[0]
  const dept = PAR.map(([id, name, par]) => { const n = snap.loc.filter((l) => l.kind !== 'vehicle' && l.plan === 'H' && l.zone === id && (l.status === 'in_stock' || l.status === 'in_use')).length; return { id, name, par, n } })
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Next delivery" value={next ? fmtT(next.eta).slice(0, 5) : '–'} sub={next ? `${next.c.desc.split(' · ')[0]} · in ${fmtDur(next.eta - t)}` : 'nothing further today'} icon={<CalendarClock size={15} />} />
        <Kpi label="Ready for use at" value={next ? fmtT(next.ready).slice(0, 5) : '–'} sub="after goods-in check" tone="good" />
        <Kpi label="Clean on the shelves" value={nowStock} sub="ready to issue, not yet in use" />
        <Kpi label="Shelves run low from" value={low ? low.h : 'never'} tone={low ? 'warn' : 'good'} sub={low ? `${low.stock} clean items left` : 'stays above 8'} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card><CardHead title="Arriving at the hospital" sub="Live ETA from the vehicle tracker" />
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[13px]"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500"><tr><th className="px-4 py-2">Delivery</th><th>Plan</th><th>ETA</th><th>Ready</th><th>Load</th><th>Status</th></tr></thead>
            <tbody className="divide-y divide-stone-100">{inbound.map(({ c, plan, eta, ready, status }) => (
              <tr key={c.ref}><td className="px-4 py-2.5"><div className="font-bold text-stone-900">{c.ref}</div><div className="max-w-[240px] truncate text-[11px] text-stone-500">{c.desc}</div></td><td className="mono text-stone-500">{fmtT(plan).slice(0, 5)}</td><td className="mono font-bold text-stone-900">{fmtT(eta).slice(0, 5)}</td><td className="mono text-stone-500">{fmtT(ready).slice(0, 5)}</td><td className="text-stone-600">{c.items} items</td>
                <td><Chip tone={status === 'ready' || status === 'delivered' ? 'green' : status === 'en route' || status === 'in transit' ? 'blue' : status === 'goods-in' || status === 'loading' ? 'amber' : 'slate'}>{status}</Chip></td></tr>))}</tbody></table></div></Card>
        <Card><CardHead title="Ready for procedures?" sub="Clean items on hand against the minimum for each department" />
          <ul className="divide-y divide-stone-100">{dept.map((d) => { const ok = d.n >= d.par; return (
            <li key={d.id} className="px-4 py-2.5"><div className="flex items-center justify-between text-[13px]"><span className="font-bold text-stone-900">{d.name}</span><span className="flex items-center gap-2"><span className="mono text-stone-500">{d.n} / {d.par}</span><Chip tone={ok ? 'green' : d.n === 0 ? 'red' : 'amber'}>{ok ? 'ready' : d.n === 0 ? 'empty' : 'low'}</Chip></span></div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (d.n / d.par) * 100)}%`, background: ok ? '#10b981' : d.n === 0 ? '#e11d48' : '#f59e0b' }} /></div></li>) })}</ul></Card>
      </div>
      <Card className="mt-4"><CardHead title="Clean items on the shelves through the day" sub="Falls as items go into use, refills with each delivery" />
        <div className="h-[220px] p-3"><ResponsiveContainer><AreaChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="#e5ebf2" /><XAxis dataKey="h" tick={{ fontSize: 10 }} interval={3} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Area dataKey="stock" name="Clean items" stroke="#0b877d" fill="#14a59733" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></Card>
    </>)
}

export default function Planner() {
  const [view, setView] = useState<'hospital' | 'plant'>('hospital')
  return (
    <Page title="Laundry arrivals" sub={view === 'hospital' ? 'What is arriving at the hospital, and when it can be used.' : 'What reaches the plant, and when.'}
      right={<div className="flex rounded-full bg-white p-1 ring-1 ring-stone-200">{([['hospital', 'At the hospital'], ['plant', 'At the plant']] as const).map(([k, l]) => <button key={k} onClick={() => setView(k)} className={`rounded-full px-4 py-1.5 text-xs font-bold ${view === k ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-50'}`}>{l}</button>)}</div>}>
      {view === 'hospital' ? <HospitalView /> : <PlantView />}
    </Page>)
}
