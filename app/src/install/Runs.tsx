import { Check } from 'lucide-react'
import { Card, CardHead, Chip } from '../components/ui'
import { FleetMapView } from '../components/FleetMapView'
import { fmtT, getWorld } from '../sim/engine'
import { SITES } from '../sim/world'
import { fmtDur, useSnap } from '../sim/snap'

export function Runs() {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const v = snap.veh.V5
  const legs = ['L9', 'L10', 'L11'].map((id) => w.legs.find((l) => l.id === id)!)
  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <Card className="overflow-hidden"><FleetMapView vehIds={['V5']} height={460} sites={['SYN', 'HOSP']} selected="V5" /></Card>
      <Card><CardHead title="Van SY24 CRT" sub="Driver Amir Syed" right={v.moving ? <Chip tone="green">Driving · ETA {fmtT(v.eta!).slice(0, 5)}</Chip> : <Chip>Parked</Chip>} />
        <ol className="p-5">{legs.map((l, i) => { const done = t >= l.arrive, live = t >= l.depart && t < l.arrive; const col = l.kind === 'curtain_collection'; return (
          <li key={l.id} className="relative flex gap-3 pb-5 last:pb-0">{i < legs.length - 1 && <span className="absolute left-[13px] top-7 h-full w-px bg-stone-200" />}
            <span className={`z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs text-white ${done ? 'bg-emerald-500' : live ? 'bg-orange-500 ring-4 ring-orange-100' : 'bg-stone-200 text-stone-500'}`}>{done ? <Check size={14} /> : i + 1}</span>
            <div><div className="font-bold text-stone-900">{col ? 'Collect taken-down curtains' : l.id === 'L9' ? 'Deliver fresh curtains' : 'Next-day delivery'}</div><div className="text-sm text-stone-500">{SITES[l.from].short} → {SITES[l.to].short}</div><div className="mono mt-0.5 text-xs text-stone-400">{fmtT(l.depart).slice(0, 5)} → {fmtT(l.arrive).slice(0, 5)}{live ? ` · ${fmtDur(l.arrive - t)} left` : ''}</div></div></li>) })}</ol></Card>
    </div>)
}
