import { CalendarClock } from 'lucide-react'
import { Card, CardHead, Chip, Kpi } from '../components/ui'
import { useLiveData, useLiveLoad } from '../lib/liveData'
import { go, useStore } from '../store'
import { btnPrimary } from '../qr/ui'

const when = (s: string | null) => (s ? new Date(s).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'no time set')
export default function PlannerLive() {
  useLiveLoad(); const { ships, items, loaded } = useLiveData(); const role = useStore((s) => s.role)
  const mine = ships.filter((s) => role === 'superadmin' || s.org_id === role); const its = items.filter((i) => role === 'superadmin' || i.org_id === role)
  const now = Date.now(); const open = mine.filter((s) => s.status === 'booked' || s.status === 'in_transit'); const overdue = open.filter((s) => s.planned_arrival && new Date(s.planned_arrival).getTime() < now)
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999); const today = open.filter((s) => s.planned_arrival && new Date(s.planned_arrival).getTime() <= todayEnd.getTime())
  const n = (st: string) => its.filter((i) => i.status === st).length
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Arriving today" value={today.length} icon={<CalendarClock size={15} />} sub="including anything late" />
        <Kpi label="Late" value={overdue.length} tone={overdue.length ? 'bad' : 'good'} sub="past planned arrival" />
        <Kpi label="Clean in stock" value={n('in_stock') + n('clean')} sub="ready to issue" tone="good" />
        <Kpi label="In dirty cages" value={n('in_cage')} sub="waiting for collection" />
      </div>
      <Card><CardHead title="What is arriving" sub="Open shipments, soonest first. Book and update them under Shipments." right={<button onClick={() => go('shipments')} className="text-[14px] font-medium text-cyan-700 hover:underline">Open shipments</button>} />
        {loaded && open.length === 0 ? <div className="p-10 text-center"><p className="text-[14.5px] text-stone-500">Nothing is on its way. Book a delivery and it appears here with its planned arrival.</p><button onClick={() => go('shipments')} className={`${btnPrimary} mt-4`}>Book a shipment</button></div> :
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr><th>Shipment</th><th>From → to</th><th>Planned arrival</th><th>Load</th><th>Status</th></tr></thead>
            <tbody className="divide-y divide-stone-100">{open.sort((a, b) => (a.planned_arrival ?? '9').localeCompare(b.planned_arrival ?? '9')).map((s) => { const late = s.planned_arrival && new Date(s.planned_arrival).getTime() < now
              return <tr key={s.id}><td><div className="mono font-medium text-stone-900">{s.ref}</div><div className="text-[12.5px] text-stone-400">{s.description}</div></td><td className="text-stone-600">{s.from_name} → {s.to_name}</td><td className={late ? 'font-medium text-rose-600' : 'text-stone-700'}>{when(s.planned_arrival)}</td><td>{s.items} item{s.items === 1 ? '' : 's'}</td><td><Chip tone={s.status === 'in_transit' ? 'blue' : late ? 'red' : 'slate'}>{s.status === 'in_transit' ? 'On the way' : 'Booked'}</Chip></td></tr> })}</tbody></table></div>}
      </Card>
    </>)
}
