import { ArrowRight, ScanLine, Repeat2, Tag } from 'lucide-react'
import { Page } from '../components/ui'
import { DaysChip, Section } from './ui'
import { fmtDateTime, isDueSoon, isOverdue, placeText, REASONS, useQr } from './store'
import { go } from '../store'

export default function QrDashboard() {
  const st = useQr(); const all = Object.values(st.products); const inUse = all.filter((p) => p.status === 'in_use')
  const due = all.filter((p) => isOverdue(p) || isDueSoon(p)).sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
  const byH = st.hospitals.map((h) => ({ h, n: inUse.filter((p) => p.place?.hospitalId === h.id).length, over: inUse.filter((p) => p.place?.hospitalId === h.id && isOverdue(p)).length, bays: st.locs.filter((l) => l.hospitalId === h.id).length }))
  const kpi: [string, number, string][] = [['In use', inUse.length, 'text-stone-900'], ['Overdue', all.filter(isOverdue).length, 'text-rose-600'], ['Due in 30 days', all.filter(isDueSoon).length, 'text-amber-600'], ['In stock', all.filter((p) => p.status === 'registered').length, 'text-emerald-600']]
  return (
    <Page title="Curtain dashboard" sub="Everything installed across your hospitals">
      <div className="mb-6 grid gap-4 sm:grid-cols-3">{([['qrinstall', 'Install', 'New curtains', <ScanLine key="a" size={22} />], ['qrtakedown', 'Take down', 'Swap old for new', <Repeat2 key="b" size={22} />], ['qrproducts', 'Products', 'Search and filter', <Tag key="c" size={22} />]] as const).map(([id, t, s, ic]) => <button key={id} onClick={() => go(id)} className="card flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">{ic}</span><span className="flex-1"><span className="block text-[17px] font-extrabold">{t}</span><span className="text-[14px] text-stone-500">{s}</span></span><ArrowRight size={18} className="text-stone-300" /></button>)}</div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{kpi.map(([l, n, c]) => <div key={l} className="card p-5"><div className={`text-[34px] font-extrabold leading-none ${c}`}>{n}</div><div className="mt-2 text-[15px] font-bold text-stone-700">{l}</div></div>)}</div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Section title="Installed by hospital"><div className="space-y-4">{byH.map(({ h, n, over, bays }) => <div key={h.id}><div className="mb-1.5 flex justify-between text-[15px]"><b className="text-stone-900">{h.name}</b><span className="text-stone-500">{n} of {bays} bays{over ? <b className="ml-2 text-rose-600">{over} overdue</b> : null}</span></div><div className="h-3 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${(n / Math.max(1, bays)) * 100}%` }} /></div></div>)}</div></Section>
          <Section title="Due or overdue" sub="Change these first">{due.length === 0 ? <p className="text-[14.5px] text-stone-400">Nothing is due in the next 30 days.</p> : <ul className="divide-y divide-stone-100">{due.slice(0, 8).map((p) => <li key={p.code} className="flex items-center justify-between gap-3 py-3"><div><div className="mono text-[15px] font-bold">{p.code}</div><div className="text-[13.5px] text-stone-500">{placeText(st, p.place)}</div></div><DaysChip p={p} /></li>)}</ul>}</Section></div>
        <Section title="Recent activity"><ul className="divide-y divide-stone-100">{st.history.slice(0, 10).map((h) => <li key={h.id} className="py-3 text-[14.5px]"><div><b className="mono">{h.code}</b> <span className="text-stone-600">{{ registered: 'registered', installed: 'installed', removed: `taken down${h.reason ? ` (${REASONS.find((r) => r.value === h.reason)?.label.toLowerCase()})` : ''}`, retired: 'retired' }[h.type]}</span></div><div className="text-[13px] text-stone-400">{h.where ? `${h.where} · ` : ''}{fmtDateTime(h.ts)} · {h.by}</div></li>)}</ul></Section>
      </div>
    </Page>)
}
