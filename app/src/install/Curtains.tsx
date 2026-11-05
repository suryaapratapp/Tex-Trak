import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { Card, CardHead, Chip } from '../components/ui'
import { rng } from '../lib/geo'
import { QrImg } from './QrImg'
import { BAY, STATUS, ageDays, curtainCode, isDue, useInst, type CStatus } from './store'

const LOOP: CStatus[] = ['stock', 'on_site', 'installed', 'taken_down', 'in_transit', 'reprocessing']
export function Curtains() {
  const { curtains, events } = useInst(); const [q, setQ] = useState(''); const [st, setSt] = useState('all'); const [sel, setSel] = useState('CUR-1017')
  const list = useMemo(() => Object.values(curtains).filter((c) => (st === 'all' || c.status === st) && (c.id + c.type + (c.bay ? BAY[c.bay].label : '')).toLowerCase().includes(q.toLowerCase())), [curtains, q, st])
  const c = curtains[sel]
  const past = useMemo(() => { const r = rng(+sel.slice(4) * 31); const wards = ['Ward 2A', 'Ward 2B', 'Ward 3A', 'Ward 3B', 'Surgical Ward 1A', 'Cardiology 1B']; return [1, 2, 3, 4, 5].map((k) => ({ n: (c?.cycles ?? 5) - k + 1, ward: wards[Math.floor(r() * wards.length)], days: Math.round(26 + r() * 6), when: `${k * 4 + Math.round(r() * 2)} weeks ago` })) }, [sel, c?.cycles])
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
      <Card><div className="flex flex-wrap items-center gap-3 border-b border-stone-100 p-4"><div className="relative min-w-[200px] flex-1"><Search size={15} className="absolute left-3 top-3 text-stone-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search curtain, ward…" className="w-full rounded-full border border-stone-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-stone-900" /></div>
        <select value={st} onChange={(e) => setSt(e.target.value)} className="rounded-full border border-stone-200 bg-white px-3 py-2.5 text-sm"><option value="all">All states</option>{LOOP.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}</select></div>
        <div className="scroll-thin max-h-[640px] overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white text-[11px] font-bold uppercase tracking-wider text-stone-400"><tr><th className="px-5 py-3">Curtain</th><th>State</th><th>Location</th><th>Cycles</th></tr></thead>
          <tbody className="divide-y divide-stone-100">{list.map((x) => <tr key={x.id} onClick={() => setSel(x.id)} className={`cursor-pointer ${sel === x.id ? 'bg-cyan-50' : 'hover:bg-stone-50'}`}><td className="px-5 py-3"><div className="font-bold text-stone-900">{x.id}</div><div className="text-xs text-stone-500">{x.type}</div></td>
            <td><span className="inline-flex items-center gap-1.5 text-[13px] font-semibold"><i className="h-2 w-2 rounded-full" style={{ background: STATUS[x.status].color }} />{STATUS[x.status].short}</span>{isDue(x) && <Chip tone="amber"> due</Chip>}</td><td className="text-stone-600">{x.bay ? BAY[x.bay].label : '—'}</td><td className="font-semibold">{x.cycles}</td></tr>)}</tbody></table></div></Card>
      {c && <Card className="h-fit"><CardHead title={c.id} sub={c.type} right={<QrImg text={curtainCode(c.id)} size={72} />} />
        <div className="p-5"><div className="mb-4 flex flex-wrap gap-1.5">{LOOP.map((s, i) => { const at = LOOP.indexOf(c.status); return <span key={s} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${i === at ? 'bg-stone-900 text-white' : i < at ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-400'}`}>{i < at && <Check size={11} />}{STATUS[s].short}</span> })}</div>
          <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl bg-stone-50 p-3"><div className="text-2xl font-extrabold">{c.cycles}</div><div className="text-[11px] font-semibold text-stone-500">wash cycles</div></div><div className="rounded-2xl bg-stone-50 p-3"><div className="text-2xl font-extrabold">{c.installedAt ? ageDays(c).toFixed(0) : '—'}</div><div className="text-[11px] font-semibold text-stone-500">days hanging</div></div><div className="rounded-2xl bg-stone-50 p-3"><div className="text-2xl font-extrabold">{Math.max(0, 60 - c.cycles)}</div><div className="text-[11px] font-semibold text-stone-500">cycles left</div></div></div>
          <div className="mt-5 text-xs font-bold uppercase tracking-wider text-stone-400">This session</div>
          {events.filter((e) => e.curtain === c.id).slice(0, 4).map((e) => <div key={e.id} className="py-1.5 text-sm text-stone-700">{e.title}</div>) }{!events.some((e) => e.curtain === c.id) && <div className="py-1.5 text-sm text-stone-400">No scans yet</div>}
          <div className="mt-5 text-xs font-bold uppercase tracking-wider text-stone-400">Earlier cycles</div>
          <table className="mt-1 w-full text-sm"><tbody className="divide-y divide-stone-100">{past.map((p) => <tr key={p.n}><td className="py-2 font-bold">#{p.n}</td><td>{p.ward}</td><td className="text-stone-500">{p.days} days</td><td className="text-right text-xs text-stone-400">{p.when}</td></tr>)}</tbody></table></div></Card>}
    </div>)
}
