import { useState } from 'react'
import { CheckCircle2, Eye, Siren } from 'lucide-react'
import { Card, CardHead, Chip, Page, SevBadge, SEV_DOT } from '../components/ui'
import { FleetMapView } from '../components/FleetMapView'
import { fmtT, getWorld, RULES } from '../sim/engine'
import { SEV_ORDER, type Sev } from '../sim/world'
import { useStore } from '../store'
import { useSnap } from '../sim/snap'

export default function Alerts() {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const { states, setAlert, selIncident, set } = useStore()
  const [sev, setSev] = useState<'all' | Sev>('all'); const [tab, setTab] = useState<'alerts' | 'rules'>('alerts'); const [selA, setSelA] = useState<string | null>(null)
  const list = w.alerts.filter((a) => a.t <= t && (sev === 'all' || a.sev === sev)).reverse()
  const inc = w.incidents.filter((i) => i.t <= t); const si = inc.find((i) => i.id === selIncident) ?? inc[0]
  const a = list.find((x) => x.id === selA) ?? null
  return (
    <Page title="Alerts" sub="Problems that need attention."
      right={<div className="flex rounded-lg bg-white p-1 ring-1 ring-slate-200">{(['alerts', 'rules'] as const).map((k) => <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${tab === k ? 'bg-ink-900 text-white' : 'text-slate-600'}`}>{k === 'rules' ? 'Rule catalogue' : 'Alerts'}</button>)}</div>}>
      {tab === 'rules' ? (
        <Card><table className="w-full text-left text-[13px]"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-2">Rule</th><th>Severity</th><th>Logic</th><th>Fired today</th></tr></thead><tbody className="divide-y divide-slate-100">
          {RULES.map((r) => <tr key={r.code}><td className="px-4 py-2.5"><div className="font-medium text-slate-900">{r.name}</div><div className="mono text-[11px] text-slate-400">{r.code}</div></td><td><SevBadge sev={r.sev} /></td><td className="max-w-[520px] text-slate-600">{r.desc}</td><td className="mono">{w.alerts.filter((x) => x.rule === r.code && x.t <= t).length}</td></tr>)}</tbody></table></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <div className="space-y-4">
            {si && (
              <Card className="border-rose-200"><div className="flex items-start gap-3 border-b border-rose-100 bg-rose-50/70 p-4"><Siren className="mt-0.5 text-rose-600" size={20} />
                <div className="flex-1"><div className="flex items-center gap-2"><span className="mono text-xs font-semibold text-rose-700">{si.id}</span><SevBadge sev={si.sev} /><Chip tone="red">risk {si.risk}/100</Chip></div><h3 className="mt-1 text-[15px] font-semibold text-slate-900">{si.title}</h3><p className="mt-1 text-[13px] leading-snug text-slate-700">{si.summary}</p></div>
                <div className="flex gap-1">{inc.map((i) => <button key={i.id} onClick={() => set({ selIncident: i.id })} className={`rounded-md px-2 py-1 text-[11px] font-medium ${si.id === i.id ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{i.id}</button>)}</div></div>
                <div className="grid gap-4 p-4 lg:grid-cols-2"><div><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Recommended actions</div><ul className="space-y-1.5">{si.actions.map((x, k) => <li key={k} className="flex gap-2 text-[13px] text-slate-700"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-slate-300" />{x}</li>)}</ul>
                  <div className="mt-3 flex gap-2"><button onClick={() => si.alerts.forEach((id) => setAlert(id, 'investigating'))} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700">Open investigation</button><button onClick={() => si.alerts.forEach((id) => setAlert(id, 'resolved'))} className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">Mark resolved</button></div></div>
                  <div className="overflow-hidden rounded-xl border border-slate-200"><FleetMapView vehIds={si.cons === 'RCY-0612-B' ? ['V3'] : []} height={220} sites={si.cons ? ['DECON', 'RECY', 'PORT'] : ['COMM']} scanners={!si.cons} bounds={si.cons ? [[51.42, -0.3], [51.57, 0.4]] : [[51.45, -0.2], [51.56, 0.0]]} /></div></div></Card>)}
            <Card><CardHead title="Alert stream" right={<div className="flex gap-1">{(['all', ...[...SEV_ORDER].reverse()] as const).map((s) => <button key={s} onClick={() => setSev(s as 'all' | Sev)} className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize ${sev === s ? 'bg-ink-900 text-white' : 'bg-slate-50 text-slate-600'}`}>{s}</button>)}</div>} />
              <ul className="divide-y divide-slate-100">{list.length === 0 && <li className="p-6 text-center text-sm text-slate-400">No alerts for this filter yet — press play or jump to a scenario.</li>}
                {list.map((x) => { const st = states[x.id]; return (
                  <li key={x.id}><button onClick={() => setSelA(x.id)} className={`flex w-full items-start gap-3 px-4 py-3 text-left ${selA === x.id ? 'bg-cyan-50/50' : 'hover:bg-slate-50'}`}>
                    <i className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEV_DOT[x.sev] }} />
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><SevBadge sev={x.sev} /><span className="mono text-[11px] text-slate-400">{x.id} · {fmtT(x.t)}</span>{x.incident && <Chip tone="red">{x.incident}</Chip>}{st && <Chip tone={st === 'resolved' ? 'green' : 'amber'}>{st}</Chip>}</div><div className="mt-1 text-[13px] font-medium text-slate-900">{x.title}</div><div className="text-xs text-slate-500">{x.detail.slice(0, 140)}{x.detail.length > 140 ? '…' : ''}</div></div></button></li>) })}</ul></Card>
          </div>
          <Card className="h-fit"><CardHead title={a ? a.title : 'Alert detail'} sub={a ? <span className="mono">{a.rule}</span> : 'Select an alert to inspect evidence'} />
            {a ? <div className="space-y-3 p-4 text-[13px]"><SevBadge sev={a.sev} /><p className="leading-snug text-slate-700">{a.detail}</p>
              <div className="rounded-lg bg-slate-50 p-3"><div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Evidence</div>{Object.entries(a.evidence).map(([k, v]) => <div key={k} className="flex justify-between py-0.5 text-xs"><span className="text-slate-500">{k}</span><span className="mono text-slate-900">{String(v)}</span></div>)}{a.pos && <div className="flex justify-between py-0.5 text-xs"><span className="text-slate-500">Position</span><span className="mono text-slate-900">{a.pos[0].toFixed(4)}, {a.pos[1].toFixed(4)}</span></div>}</div>
              <div><div className="mb-1 flex justify-between text-xs"><span className="text-slate-500">Risk score</span><b>{a.risk}</b></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${a.risk}%`, background: a.risk > 70 ? '#e11d48' : a.risk > 40 ? '#f59e0b' : '#38bdf8' }} /></div></div>
              <div className="flex gap-2"><button onClick={() => setAlert(a.id, 'ack')} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium ring-1 ring-slate-200"><Eye size={13} /> Acknowledge</button><button onClick={() => setAlert(a.id, 'resolved')} className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-white">Resolve</button></div></div> : <div className="p-6 text-sm text-slate-400">Click an alert in the stream.</div>}</Card>
        </div>)}
    </Page>
  )
}
