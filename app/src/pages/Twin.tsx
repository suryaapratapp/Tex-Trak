import { Cuboid, Layers, Radio, ScanLine } from 'lucide-react'
import { useState } from 'react'
import { UpperFloor } from '../components/UpperFloor'
import { UPPER, FLOOR_LABEL } from '../sim/floors'
import { hasModule } from '../sim/registry'
import { FloorPlan } from '../components/FloorPlan'
import { EventFeed } from '../components/Feed'
import { Card, CardHead, Chip, Kpi, Page, STATUS_COLOR, STATUS_LABEL, StatusPill } from '../components/ui'
import { fmtT, fusion, getWorld } from '../sim/engine'
import { PLANS } from '../sim/world'
import { useSnap } from '../sim/snap'
import { useStore } from '../store'

export default function Twin() {
  const snap = useSnap(); const t = snap.t; const { twin, set, selItem, floor, role } = useStore(); const w = getWorld()
  const plan = PLANS[twin]
  const site = twin === 'H' ? 'HOSP' : 'DECON'
  const onSite = snap.loc.filter((l) => l.kind !== 'vehicle' && l.plan === twin).length
  const reads15 = w.events.filter((e) => e.reader && e.site === site && e.t <= t && e.t > t - 15).length
  const it = selItem != null ? w.items[selItem] : null
  const fu = it ? fusion(it, t) : null
  const loc = it ? snap.loc[it.id] : null
  return (
    <Page title="Facilities & floors" sub={twin === 'H' ? 'Royal Meridian Hospital · choose a floor' : 'Decon Plant'}
      right={<div className="flex flex-wrap gap-2">
        <div className="flex rounded-full bg-white p-1 ring-1 ring-stone-200">{([['H', 'Hospital'], ['D', 'Decon Plant']] as const).map(([k, l]) => (<button key={k} onClick={() => set({ twin: k })} className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${twin === k ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-50'}`}>{l}</button>))}</div>
        {twin === 'H' && <div className="flex rounded-full bg-white p-1 ring-1 ring-stone-200"><span className="grid place-items-center px-2 text-stone-400"><Layers size={14} /></span>{(['G', '1', '2', '3'] as const).filter((f) => f === 'G' ? hasModule(role, 'laundry') : hasModule(role, 'curtains') || hasModule(role, 'laundry')).map((f) => (<button key={f} onClick={() => set({ floor: f })} className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${floor === f ? 'bg-cyan-600 text-white' : 'text-stone-600 hover:bg-stone-50'}`}>{f === 'G' ? 'Ground' : `Floor ${f}`}</button>))}</div>}
      </div>}>
      {twin === 'H' && floor !== 'G' && (() => {
        const uf = UPPER[floor]
        return (<>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Kpi label="Wards" value={uf.zones.filter((z) => z.ward).length} icon={<Layers size={15} />} sub={FLOOR_LABEL[floor]} />
            <Kpi label="Ceiling RFID readers" value={uf.readers.length} tone="good" icon={<Radio size={15} />} sub="all online" />
            <Kpi label="Rooms" value={uf.zones.length} sub="wards, services and stores" />
          </div>
          <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
            <Card className="p-3"><UpperFloor floor={floor} />
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-stone-600">{[['#34c1b1', 'Up to date'], ['#f59e0b', 'Due'], ['#0b877d', 'Replaced today'], ['#e2e8f0', 'Empty']].map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded" style={{ background: c }} />{l}</span>)}<span className="ml-auto flex items-center gap-1.5"><span className="grid h-4 w-4 place-items-center rounded-full border-2 border-stone-900" /> ceiling RFID reader</span></div></Card>
            <div className="space-y-4">
              <Card><CardHead title="Readers on this floor" />
                <ul className="divide-y divide-stone-100">{uf.readers.map((r) => <li key={r.id} className="flex items-center justify-between px-4 py-2.5"><div><div className="mono text-xs font-semibold text-stone-900">{r.id}</div><div className="text-[11px] text-stone-500">{r.label}</div></div><span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600"><i className="h-2 w-2 rounded-full bg-emerald-500" />online</span></li>)}</ul></Card>
            </div>
          </div></>)
      })()}
      {(twin === 'D' || floor === 'G') && <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Tagged items on site" value={onSite} icon={<Cuboid size={15} />} sub={twin === 'H' ? 'incl. dock, yard & street' : 'incl. inbound/outbound yards'} />
        <Kpi label="RFID reads · last 15 min" value={reads15} icon={<Radio size={15} />} sub={`${plan.readers.length} ceiling readers online`} tone="good" />
        <Kpi label={twin === 'H' ? 'In dirty cages' : 'Processing'} value={twin === 'H' ? snap.byStatus.in_cage ?? 0 : snap.byStatus.processing ?? 0} icon={<ScanLine size={15} />} sub={twin === 'H' ? 'RC-201 / RC-202' : 'dirty → clean flow'} />
        <Kpi label="Missing / unaccounted" value={snap.byStatus.missing ?? 0} tone={snap.byStatus.missing ? 'bad' : 'good'} sub="reconciled 18:30 daily" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="p-3">
          <FloorPlan planId={twin} />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-slate-600">
            {Object.entries(STATUS_LABEL).map(([k, l]) => <span key={k} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[k] }} />{l}</span>)}
            <span className="ml-auto flex items-center gap-1.5"><span className="grid h-4 w-4 place-items-center rounded-full border-2 border-ink-900" /> ceiling RFID reader</span>
          </div>
        </Card>
        <div className="space-y-4">
          {it && loc && fu && <Card><CardHead title={it.type.name} sub={<span className="mono">{it.qr}</span>} right={<StatusPill s={loc.status} />} />
            <div className="space-y-2 p-4 text-xs text-slate-600">
              <div className="flex justify-between"><span>EPC</span><span className="mono text-slate-900">{it.epc}</span></div>
              <div className="flex justify-between"><span>Wash cycles</span><span className="mono text-slate-900">{loc.cycles} / {it.type.maxCycles}</span></div>
              <div className="flex justify-between"><span>Position source</span><Chip tone="cyan">{fu.tier}</Chip></div>
              <div className="flex justify-between"><span>Confidence</span><span className="font-semibold text-slate-900">{Math.round(fu.conf * 100)}%</span></div>
              <div className="text-slate-500">{fu.method}</div>
            </div></Card>}
          <Card><CardHead title="Reader & scan feed" sub={twin === 'H' ? 'Hospital' : 'Decon plant'} /><EventFeed limit={12} filter={(e) => e.site === site && (!!e.reader || e.src === 'QR' || e.src === 'SYSTEM')} onPick={(e) => e.item != null && set({ selItem: e.item })} /></Card>
        </div>
      </div>
      <Card className="mt-4"><CardHead title="Readers" sub="Last read per reader" />
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">{plan.readers.map((r) => { const l = (w.readerEvents[r.id] ?? []).filter((x) => x <= t).slice(-1)[0]; return (<div key={r.id} className="rounded-lg border border-slate-200 px-3 py-2"><div className="flex items-center justify-between"><span className="mono text-xs font-semibold text-slate-900">{r.id}</span><i className="h-2 w-2 rounded-full bg-emerald-500" /></div><div className="text-xs text-slate-500">{r.label}</div><div className="mt-1 text-[11px] text-slate-400">last read {l ? fmtT(l) : '—'}</div></div>) })}</div></Card>
      </>}
    </Page>
  )
}
