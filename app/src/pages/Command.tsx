import { AlertTriangle, Boxes, Radar, ShieldAlert, Truck, Layers } from 'lucide-react'
import { Bar, Card, CardHead, Kpi, Page, SevBadge, STATUS_COLOR, STATUS_LABEL } from '../components/ui'
import { FleetMapView } from '../components/FleetMapView'
import { EventFeed } from '../components/Feed'
import { fmtT, fusion, getWorld, SCANNERS, scannerAt } from '../sim/engine'
import { useSnap } from '../sim/snap'
import { insights } from '../lib/insights'
import { go, useStore } from '../store'

const TONE: Record<string, string> = { info: 'border-sky-200 bg-sky-50/60', warn: 'border-amber-200 bg-amber-50/70', bad: 'border-rose-200 bg-rose-50/80', good: 'border-emerald-200 bg-emerald-50/60' }
export default function Command() {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const set = useStore((s) => s.set)
  const alerts = w.alerts.filter((a) => a.t <= t).slice(-5).reverse()
  const openHigh = w.alerts.filter((a) => a.t <= t && (a.sev === 'high' || a.sev === 'critical')).length
  const moving = Object.values(snap.veh).filter((v) => v.moving).length
  const valueAtRisk = snap.loc.filter((l) => l.status === 'missing').reduce((a, _l, i) => a + 40, 0) + (t >= 745 ? 168 * 9 : 0) + (t >= 860 ? 6900 : 0)
  const conf = w.items.map((i) => fusion(i, t).conf)
  const fusedPct = Math.round((conf.filter((c) => c >= 0.7).length / conf.length) * 100)
  const stages = ['in_stock', 'in_use', 'soiled', 'in_cage', 'in_transit', 'processing', 'clean', 'missing']
  const ins = insights(t, snap)
  const sc = SCANNERS.map((s) => scannerAt(w.legs, s, t))
  return (
    <Page title="Command Centre" sub="One verified data thread from point of use to end of life — QR, RFID and GNSS fused.">
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label="Tagged items" value={snap.loc.length + SCANNERS.length} sub={`${snap.loc.length} textiles · ${SCANNERS.length} high-value`} icon={<Boxes size={15} />} />
        <Kpi label="Vehicles moving" value={`${moving}/4`} sub="Teltonika TAT240 fleet" icon={<Truck size={15} />} />
        <Kpi label="Fusion coverage" value={`${fusedPct}%`} sub="items located with ≥70% confidence" tone={fusedPct > 90 ? 'good' : 'warn'} icon={<Layers size={15} />} />
        <Kpi label="Open high-risk" value={openHigh} sub={`${w.incidents.filter((i) => i.t <= t).length} incident(s) open`} tone={openHigh ? 'bad' : 'good'} icon={<ShieldAlert size={15} />} />
        <Kpi label="Value at risk" value={`£${valueAtRisk.toLocaleString()}`} sub="missing items · diverted material · off-site assets" tone={valueAtRisk ? 'warn' : 'good'} icon={<AlertTriangle size={15} />} />
        <Kpi label="Assets off-site" value={sc.filter((s) => s.outside).length} sub={`${sc.length} scanners tracked`} tone={sc.some((s) => s.outside) ? 'bad' : 'good'} icon={<Radar size={15} />} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card><CardHead title="Live fleet" sub="Decon plant ⇄ hospital · recycling runs · asset courier" right={<button onClick={() => go('map')} className="text-xs font-medium text-cyan-700 hover:underline">Open full map →</button>} />
            <FleetMapView vehIds={['V1', 'V2', 'V3', 'V4']} height={420} onSelect={(id) => { set({ selVeh: id }); go('map') }} /></Card>
          <Card><CardHead title="Textile lifecycle — items by state" sub="Updates with the simulated clock" />
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {stages.map((s) => (<div key={s}><div className="mb-1 flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 font-medium text-slate-700"><i className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />{STATUS_LABEL[s]}</span><span className="mono text-slate-500">{snap.byStatus[s] ?? 0}</span></div><Bar v={(snap.byStatus[s] ?? 0) / snap.loc.length} color={STATUS_COLOR[s]} /></div>))}
            </div></Card>
        </div>
        <div className="space-y-4">
          <Card><CardHead title="Intelligence" sub="Recommendations from the rule & prediction engine" />
            <div className="space-y-2 p-3">{ins.map((i, k) => (
              <button key={k} onClick={() => i.page && go(i.page)} className={`w-full rounded-lg border p-2.5 text-left ${TONE[i.tone]}`}><div className="text-[12.5px] font-semibold text-slate-900">{i.title}</div><div className="mt-0.5 text-xs leading-snug text-slate-600">{i.body}</div></button>))}</div></Card>
          <Card><CardHead title="Alerts" right={<button onClick={() => go('alerts')} className="text-xs font-medium text-cyan-700 hover:underline">All →</button>} />
            <ul className="divide-y divide-slate-100">{alerts.length === 0 && <li className="p-4 text-sm text-slate-400">No alerts yet.</li>}
              {alerts.map((a) => (<li key={a.id} className="px-4 py-2.5"><div className="flex items-center justify-between gap-2"><SevBadge sev={a.sev} /><span className="mono text-[11px] text-slate-400">{fmtT(a.t).slice(0, 5)}</span></div><div className="mt-1 text-[12.5px] font-medium text-slate-800">{a.title}</div></li>))}</ul></Card>
        </div>
      </div>
      <Card className="mt-4"><CardHead title="Live event stream" sub="RFID reads · QR scans · GNSS geofence events · system reconciliations" /><EventFeed limit={10} /></Card>
    </Page>
  )
}
