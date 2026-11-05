import { useState } from 'react'
import { Card, CardHead, Chip } from '../components/ui'
import { QrImg } from './QrImg'
import { BAY, BAYS, STATUS, WARDS, bayCode, isDue, ageDays, useInst, type Bay } from './store'

export function Floors() {
  const { curtains, seedTs, events } = useInst(); const [sel, setSel] = useState<string>('F2-3A-B01')
  const at = (b: Bay) => Object.values(curtains).find((c) => c.bay === b.id && c.status === 'installed')
  const tone = (b: Bay) => { const c = at(b); if (!c) return { bg: '#e2e8f0', fg: '#64748b', k: 'Empty' }; if (c.installedAt && c.installedAt > seedTs) return { bg: '#0b877d', fg: '#fff', k: 'Replaced today' }; if (isDue(c)) return { bg: '#f59e0b', fg: '#fff', k: 'Due for replacement' }; return { bg: '#34c1b1', fg: '#fff', k: 'Up to date' } }
  const b = BAY[sel]; const c = at(b); const hist = events.filter((e) => e.bay === sel).slice(0, 5)
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {[3, 2, 1].map((f) => (
          <Card key={f} className="p-5"><div className="mb-3 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-stone-900 text-sm font-extrabold text-white">{f}</span><div className="text-[15px] font-extrabold text-stone-900">Floor {f}</div></div>
            <div className="grid gap-4 sm:grid-cols-2">{WARDS.filter((w) => w.f === f).map((w) => (
              <div key={w.code} className="rounded-2xl border border-stone-200 p-4"><div className="mb-3 text-sm font-bold text-stone-700">{w.name}</div>
                <div className="flex flex-wrap gap-2">{BAYS.filter((x) => x.wardCode === w.code).map((x) => { const t = tone(x); return <button key={x.id} onClick={() => setSel(x.id)} title={`${x.label} · ${t.k}`} className={`grid h-11 w-11 place-items-center rounded-xl text-sm font-extrabold transition hover:scale-105 ${sel === x.id ? 'ring-2 ring-stone-900 ring-offset-2' : ''}`} style={{ background: t.bg, color: t.fg }}>{x.n}</button> })}</div></div>))}</div></Card>))}
        <div className="flex flex-wrap gap-4 px-1 text-xs font-semibold text-stone-600">{[['#34c1b1', 'Up to date'], ['#f59e0b', 'Due for replacement'], ['#0b877d', 'Replaced today'], ['#e2e8f0', 'Empty']].map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><i className="h-3 w-3 rounded" style={{ background: c }} />{l}</span>)}</div>
      </div>
      <Card className="h-fit"><CardHead title={b.label} sub={`Floor ${b.floor}`} />
        <div className="space-y-4 p-5"><div className="flex items-center gap-4"><QrImg text={bayCode(b.id)} size={110} /><div className="text-xs text-stone-500">Bay label<div className="mono mt-1 text-[11px] text-stone-700">{b.id}</div></div></div>
          {c ? <div className="rounded-2xl bg-stone-50 p-4 text-sm"><div className="flex items-center justify-between"><b className="text-stone-900">{c.id}</b><Chip tone={isDue(c) ? 'amber' : 'green'}>{isDue(c) ? 'Due' : 'OK'}</Chip></div><div className="mt-1 text-stone-500">{c.type} · wash cycle {c.cycles}</div><div className="mt-1 text-stone-500">Hanging for {ageDays(c).toFixed(0)} days</div></div> : <div className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">No curtain installed.</div>}
          {hist.length > 0 && <div><div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-stone-400">Activity</div>{hist.map((e) => <div key={e.id} className="py-1 text-sm text-stone-700">{e.title}</div>)}</div>}</div></Card>
    </div>)
}
