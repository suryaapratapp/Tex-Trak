import { Check, FileBadge, Printer, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { Card, CardHead, Chip, Kpi, Page } from '../components/ui'
import { FleetMapView } from '../components/FleetMapView'
import { fmtT, getWorld } from '../sim/engine'
import { SITES } from '../sim/world'
import { useSnap } from '../sim/snap'

function Chain({ ref_, vehId }: { ref_: string; vehId: string }) {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const c = w.consignments.find((x) => x.ref === ref_)!
  const chain = w.custody[ref_]; const shown = chain.filter((e) => e.t <= t)
  const broken = shown.some((e) => !e.ok); const complete = chain.every((e) => e.ok) && shown.length === chain.length
  const verdict = broken ? 'CHAIN BROKEN' : complete ? 'VERIFIED RECYCLED' : 'IN PROGRESS'
  const tone = broken ? 'border-rose-300 bg-rose-50 text-rose-800' : complete ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-sky-200 bg-sky-50 text-sky-800'
  return (
    <Card className="overflow-hidden">
      <div className={`flex items-center justify-between border-b px-4 py-3 ${tone}`}>
        <div className="flex items-center gap-2.5">{broken ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}<div><div className="text-sm font-semibold">{ref_}</div><div className="text-xs opacity-80">{c.desc} · {c.items} items · {c.kg} kg · {c.carrier}</div></div></div>
        <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold tracking-wide">{verdict}</span></div>
      <FleetMapView vehIds={[vehId]} height={250} sites={['HOSP', 'DECON', 'RECY', 'PORT']} bounds={[[51.42, -0.3], [51.57, 0.4]]} />
      <ol className="p-4">
        {chain.map((e, i) => { const d = e.t <= t; return (
          <li key={i} className={`relative flex gap-3 pb-3 ${d ? '' : 'opacity-35'}`}>
            {i < chain.length - 1 && <span className="absolute left-[9px] top-5 h-full w-px bg-slate-200" />}
            <span className={`z-10 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white ${!d ? 'bg-slate-200' : e.ok ? 'bg-emerald-500' : 'bg-rose-500'}`}>{d && (e.ok ? <Check size={11} /> : <X size={11} />)}</span>
            <div className="min-w-0 flex-1"><div className={`text-[13px] font-medium ${d && !e.ok ? 'text-rose-700' : 'text-slate-900'}`}>{e.title}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500"><span className="mono">{fmtT(e.t)}</span><Chip tone={e.source === 'GNSS' ? 'cyan' : e.source === 'RULE' ? 'red' : e.source.includes('RFID') ? 'violet' : 'slate'}>{e.source}</Chip>{e.site && <span>{SITES[e.site].short}</span>}{d && <span className="mono text-slate-400">sha256 {e.hash.slice(0, 14)}…</span>}</div></div></li>) })}
      </ol>
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
        <span>{broken ? 'Certificate withheld · evidence pack hash-locked' : complete ? 'Digital certificate issued · ISO 14040 credit allocated' : 'Awaiting downstream receipt'}</span>
        <button onClick={() => window.print()} className="no-print flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"><Printer size={12} /> Print evidence</button></div>
    </Card>)
}

export default function Provenance() {
  const snap = useSnap(); const t = snap.t
  return (
    <Page title="Provenance & Custody" sub="Did the truck carrying material for recycling actually reach the recycler — or was it shipped offshore or sent for incineration?">
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Consignments audited" value={2} icon={<FileBadge size={15} />} sub="recycling runs today" />
        <Kpi label="Verified recycled" value={t >= getWorld().custody['RCY-0612-A'].slice(-1)[0].t ? 1 : 0} tone="good" sub="weighbridge RFID + GNSS + certificate" />
        <Kpi label="Chain broken" value={t >= 760 ? 1 : 0} tone={t >= 760 ? 'bad' : 'good'} sub="no downstream receipt" />
        <Kpi label="Evidence integrity" value="SHA-256" sub="hash-linked custody ledger" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2"><Chain ref_="RCY-0612-A" vehId="V2" /><Chain ref_="RCY-0612-B" vehId="V3" /></div>
      <Card className="mt-4 p-4 text-sm text-slate-600"><b className="text-slate-900">How the verdict is reached.</b> Each cage is RFID-bound to a TAT240 tracker at the point of loading (item ↔ container ↔ truck). Position evidence is therefore GNSS-grade for every tagged item. A consignment is only certified when (1) GNSS shows entry to the declared destination geofence, (2) RFID readers at the destination weighbridge read the expected tags and (3) the mass delta is within tolerance. Any rule breach — route deviation, restricted geofence (port / incinerator), signal loss, missing receipt — breaks the chain and opens an incident.</Card>
    </Page>
  )
}
