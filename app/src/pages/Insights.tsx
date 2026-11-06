import { ArrowRight, CheckCircle2, CircleAlert, Info, TriangleAlert } from 'lucide-react'
import { Card, CardHead, Page } from '../components/ui'
import { laundry, assets, shipments, recycling, type Section, type Tone } from '../lib/analytics'
import { hasModule } from '../sim/registry'
import { useSnap } from '../sim/snap'
import { go, useStore } from '../store'

const TONE: Record<Tone, { bg: string; icon: React.ReactNode }> = {
  bad: { bg: 'bg-rose-50', icon: <CircleAlert size={17} className="text-rose-600" /> }, warn: { bg: 'bg-amber-50', icon: <TriangleAlert size={17} className="text-amber-600" /> },
  good: { bg: 'bg-emerald-50', icon: <CheckCircle2 size={17} className="text-emerald-600" /> }, info: { bg: 'bg-stone-50', icon: <Info size={17} className="text-stone-400" /> },
}
const RANK: Record<Tone, number> = { bad: 0, warn: 1, info: 2, good: 3 }
const TC = { default: 'text-stone-900', good: 'text-emerald-600', bad: 'text-rose-600', warn: 'text-amber-600' }

function Block({ s, n }: { s: Section; n: string }) {
  const max = Math.max(1, ...(s.bars ?? []).map((b) => b.v))
  return (
    <Card>
      <CardHead title={<span className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-lg bg-stone-900 text-[11px] font-extrabold text-white">{n}</span>{s.title}</span>} right={<button onClick={() => go(s.page)} className="flex items-center gap-1 text-sm font-bold text-cyan-700 hover:underline">Open <ArrowRight size={14} /></button>} />
      <div className="grid grid-cols-3 gap-2 p-4 pb-2">{s.tiles.map((x) => <div key={x.label} className="rounded-2xl bg-stone-50 p-3"><div className="text-[10.5px] font-bold uppercase tracking-wider text-stone-400">{x.label}</div><div className={`mt-1 text-[22px] font-extrabold leading-none ${TC[x.tone ?? 'default']}`}>{x.value}</div>{x.sub && <div className="mt-1 text-[11px] text-stone-500">{x.sub}</div>}</div>)}</div>
      <div className="space-y-2 p-4">{[...s.findings].sort((a, b) => RANK[a.tone] - RANK[b.tone]).slice(0, 4).map((f, i) => (
        <button key={i} onClick={() => f.page && go(f.page)} className={`flex w-full gap-3 rounded-2xl p-3 text-left ${TONE[f.tone].bg}`}><span className="mt-0.5 shrink-0">{TONE[f.tone].icon}</span><span><span className="block text-[13.5px] font-extrabold text-stone-900">{f.title}</span><span className="block text-xs leading-snug text-stone-600">{f.body}</span></span></button>))}</div>
      {s.bars && <div className="border-t border-stone-100 p-4"><div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-400">{s.barsTitle}</div>
        <div className="space-y-1.5">{s.bars.map((b) => <div key={b.label} className="flex items-center gap-3 text-xs"><span className="w-28 shrink-0 truncate font-semibold text-stone-600">{b.label}</span><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full" style={{ width: `${(b.v / max) * 100}%`, background: b.color ?? '#6e5cef' }} /></div><span className="mono w-10 text-right text-stone-700">{b.v}</span></div>)}</div></div>}
    </Card>)
}

export default function Insights() {
  const snap = useSnap(); const t = snap.t; const role = useStore((s) => s.role)
  const secs: [Section, string][] = []
  if (hasModule(role, 'laundry')) secs.push([laundry(t, snap), '1'])
  if (hasModule(role, 'assets')) secs.push([assets(t), '2'])
  if (hasModule(role, 'shipments')) secs.push([shipments(t, role), '3'])
  if (hasModule(role, 'recycling')) secs.push([recycling(t, role), '4'])
  const top = secs.flatMap(([s]) => s.findings.map((f) => ({ ...f, from: s.title }))).filter((f) => f.tone === 'bad' || f.tone === 'warn').sort((a, b) => RANK[a.tone] - RANK[b.tone]).slice(0, 4)
  return (
    <Page demo title="Intelligence" sub="What the data is telling you, in order of importance.">
      <Card className="mb-5"><CardHead title="Do these first" />
        <div className="grid gap-2 p-4 md:grid-cols-2">{top.length === 0 && <div className="col-span-2 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Nothing needs action right now.</div>}
          {top.map((f, i) => <button key={i} onClick={() => f.page && go(f.page)} className={`flex gap-3 rounded-2xl p-3.5 text-left ${TONE[f.tone].bg}`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-extrabold text-stone-900">{i + 1}</span><span><span className="block text-[11px] font-bold uppercase tracking-wider text-stone-400">{f.from}</span><span className="block text-[13.5px] font-extrabold text-stone-900">{f.title}</span><span className="block text-xs leading-snug text-stone-600">{f.body}</span></span></button>)}</div></Card>
      <div className="grid gap-5 xl:grid-cols-2">{secs.map(([s, n]) => <Block key={s.id} s={s} n={n} />)}</div>
    </Page>)
}
