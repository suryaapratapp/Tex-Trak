import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart, Bar as RBar, Legend } from 'recharts'
import { CalendarClock, Users } from 'lucide-react'
import { Card, CardHead, Chip, Kpi, Page } from '../components/ui'
import { fmtT, getWorld } from '../sim/engine'
import { fmtDur, useSnap } from '../sim/snap'

interface Inbound { id: string; from: string; reg: string; plan: number; delay: number; kg: number; items: number; live?: boolean; tracker: string }
const OTHERS: Inbound[] = [
  { id: 'KB-NW-02', from: 'St Anselm Hospital', reg: 'KB04 TRK', plan: 1055, delay: 6, kg: 1850, items: 342, tracker: 'TAT240' },
  { id: 'KB-NW-05', from: 'Harrow General', reg: 'KB09 TRK', plan: 1110, delay: 14, kg: 2300, items: 418, tracker: 'TAT240' },
  { id: 'KB-NW-07', from: 'Kingsmead Care Group', reg: 'KB11 TRK', plan: 1165, delay: 0, kg: 980, items: 176, tracker: 'TAT240' },
  { id: 'KB-SW-01', from: 'Thames Valley Trust', reg: 'KB02 TRK', plan: 1225, delay: 22, kg: 3100, items: 560, tracker: 'TAT240' },
  { id: 'KB-NW-09', from: 'Ealing Day Surgery', reg: 'KB15 TRK', plan: 1275, delay: 4, kg: 760, items: 140, tracker: 'TAT240' },
  { id: 'KB-NE-03', from: 'Barnet Community', reg: 'KB06 TRK', plan: 1335, delay: 10, kg: 1420, items: 255, tracker: 'TAT240' },
]
export default function Planner() {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const [crew, setCrew] = useState(11)
  const L4 = w.legs.find((l) => l.id === 'L4')!; const v1 = snap.veh.V1
  const ours: Inbound = { id: L4.cons, from: 'Royal Meridian Hospital', reg: 'SY71 KBR', plan: L4.planArrive, delay: v1.leg?.id === 'L4' ? v1.delay : L4.arrive - L4.planArrive, kg: 373, items: 69, live: true, tracker: 'TAT240 …085066' }
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
    <Page title="Laundry Planner" sub="Know what is arriving, when — so the wash line, crew and dispatch are planned before the trucks reach the gate.">
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
            <RBar dataKey="arrivals" name="Arrivals (kg/30m)" fill="#06b6d4" radius={[3, 3, 0, 0]} /><Line dataKey="capacity" name="Capacity" stroke="#0b1f33" dot={false} strokeWidth={2} /><Line dataKey="backlog" name="Backlog (kg)" stroke="#e11d48" dot={false} strokeWidth={2} /></ComposedChart></ResponsiveContainer></div>
          <div className="border-t border-slate-100 p-4 text-[12.5px] text-slate-700"><b>Recommendation:</b> {peak > 2500 ? `Backlog peaks at ${(peak / 1000).toFixed(1)} t. Add ${Math.max(1, needCrew - crew)} crew from 20:00 or divert KB-SW-01 to the Slough plant.` : peak > 1000 ? 'Backlog manageable; keep tunnel washer B on standby.' : 'Capacity comfortably covers tonight’s arrivals.'}</div></Card>
      </div>
    </Page>
  )
}
