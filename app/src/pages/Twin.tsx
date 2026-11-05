import { Cuboid, Radio, ScanLine } from 'lucide-react'
import { FloorPlan } from '../components/FloorPlan'
import { EventFeed } from '../components/Feed'
import { Card, CardHead, Chip, Kpi, Page, STATUS_COLOR, STATUS_LABEL, StatusPill } from '../components/ui'
import { fmtT, fusion, getWorld } from '../sim/engine'
import { PLANS } from '../sim/world'
import { useSnap } from '../sim/snap'
import { useStore } from '../store'

export default function Twin() {
  const snap = useSnap(); const t = snap.t; const { twin, set, selItem } = useStore(); const w = getWorld()
  const plan = PLANS[twin]
  const site = twin === 'H' ? 'HOSP' : 'DECON'
  const onSite = snap.loc.filter((l) => l.kind !== 'vehicle' && l.plan === twin).length
  const reads15 = w.events.filter((e) => e.reader && e.site === site && e.t <= t && e.t > t - 15).length
  const it = selItem != null ? w.items[selItem] : null
  const fu = it ? fusion(it, t) : null
  const loc = it ? snap.loc[it.id] : null
  return (
    <Page title="Facility Digital Twin" sub="Ceiling-mounted RFID readers at every entrance, exit and cage bay capture each tagged textile as it moves."
      right={<div className="flex rounded-lg bg-white p-1 ring-1 ring-slate-200">{([['H', 'Royal Meridian Hospital'], ['D', 'Synergy / K-Bro Decon Plant']] as const).map(([k, l]) => (<button key={k} onClick={() => set({ twin: k })} className={`rounded-md px-3 py-1.5 text-xs font-medium ${twin === k ? 'bg-ink-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{l}</button>))}</div>}>
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
    </Page>
  )
}
