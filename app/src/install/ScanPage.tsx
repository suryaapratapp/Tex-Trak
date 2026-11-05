import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, PackageCheck, PackageOpen, TriangleAlert, XCircle } from 'lucide-react'
import { Card, CardHead } from '../components/ui'
import { Scanner } from './Scanner'
import { EventList } from './Overview'
import { BAYS, JOB_FLOOR, MODES, bayCode, curtainCode, useInst, type Mode, type ScanResult } from './store'

const ICON: Record<Mode, React.ReactNode> = { install: <ArrowDownToLine size={20} />, takedown: <ArrowUpFromLine size={20} />, dispatch: <PackageOpen size={20} />, receive: <PackageCheck size={20} /> }

export function ScanPage() {
  const { curtains, scan, pendingBay, pendingCurtain, clearPending, seedTs } = useInst()
  const [mode, setMode] = useState<Mode>('install'); const [res, setRes] = useState<ScanResult | null>(null); const [manual, setManual] = useState('')
  const go = (raw: string) => setRes(scan(mode, raw))
  const list = Object.values(curtains)
  const jobBays = BAYS.filter((b) => b.floor === JOB_FLOOR)
  const nextBay = jobBays.find((b) => { const c = list.find((x) => x.bay === b.id && x.status === 'installed'); return !(c?.installedAt && c.installedAt > seedTs) })
  const chips: { label: string; raw: string }[] = []
  if (mode === 'install') { if (!pendingBay && nextBay) chips.push({ label: `Bay · ${nextBay.label}`, raw: bayCode(nextBay.id) }); if (!pendingCurtain) list.filter((c) => c.status === 'on_site').slice(0, 3).forEach((c) => chips.push({ label: `Curtain · ${c.id}`, raw: curtainCode(c.id) })) }
  if (mode === 'takedown') list.filter((c) => c.status === 'installed').sort((a, b) => (a.installedAt ?? 0) - (b.installedAt ?? 0)).slice(0, 4).forEach((c) => chips.push({ label: `${c.id} · ${c.bay ? BAYS.find((b) => b.id === c.bay)!.label : ''}`, raw: curtainCode(c.id) }))
  if (mode === 'dispatch') list.filter((c) => c.status === 'stock').slice(0, 4).forEach((c) => chips.push({ label: c.id, raw: curtainCode(c.id) }))
  if (mode === 'receive') list.filter((c) => c.status === 'taken_down' || c.status === 'in_transit').slice(0, 4).forEach((c) => chips.push({ label: c.id, raw: curtainCode(c.id) }))
  const step = mode === 'install' ? (pendingBay ? 'Now scan the new curtain' : pendingCurtain ? 'Now scan the bay label' : 'Scan a bay label, then a curtain') : MODES[mode].blurb
  const tone = res && { ok: { c: 'border-emerald-300 bg-emerald-50 text-emerald-900', i: <CheckCircle2 className="text-emerald-600" size={28} /> }, warn: { c: 'border-amber-300 bg-amber-50 text-amber-900', i: <TriangleAlert className="text-amber-600" size={28} /> }, error: { c: 'border-rose-300 bg-rose-50 text-rose-900', i: <XCircle className="text-rose-600" size={28} /> } }[res.level]
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(Object.keys(MODES) as Mode[]).map((m) => (
        <button key={m} onClick={() => { setMode(m); setRes(null); clearPending() }} className={`card flex items-center gap-3.5 p-4 text-left transition ${mode === m ? 'ring-2 ring-stone-900' : 'hover:-translate-y-0.5'}`}>
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${mode === m ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'}`}>{ICON[m]}</span>
          <span><span className="block text-[15px] font-extrabold text-stone-900">{MODES[m].label}</span><span className="block text-xs font-semibold text-stone-500">{MODES[m].dir}</span></span></button>))}</div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHead title={step} sub={MODES[mode].dir} />
          <div className="space-y-4 p-5"><Scanner onScan={go} />
            <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { go(manual); setManual('') } }} className="flex gap-2"><input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Type or paste a code" className="min-w-0 flex-1 rounded-full border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-stone-900" /><button className="rounded-full bg-stone-900 px-5 text-sm font-bold text-white">Scan</button></form>
            {chips.length > 0 && <div><div className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">Try a demo scan</div><div className="flex flex-wrap gap-2">{chips.map((c) => <button key={c.raw} onClick={() => go(c.raw)} className="rounded-full border border-stone-200 bg-white px-3.5 py-2 text-[13px] font-bold text-stone-700 hover:border-stone-900">{c.label}</button>)}</div></div>}
          </div></Card>
        <div className="space-y-5">
          <div className={`card flex min-h-[150px] items-center gap-4 border-2 p-6 ${tone ? tone.c : 'border-dashed border-stone-200'}`}>
            {res ? <>{tone!.i}<div className="min-w-0"><div className="text-xl font-extrabold leading-tight">{res.title}</div><div className="mt-1 text-sm opacity-80">{res.detail}</div>{res.next && <div className="mt-2 inline-block rounded-full bg-white/70 px-3 py-1 text-xs font-bold">{res.next}</div>}</div></> : <div className="mx-auto text-center text-stone-400"><div className="text-sm font-semibold">Scan result appears here</div></div>}</div>
          <Card><CardHead title="Recent scans" /><EventList limit={6} /></Card></div>
      </div>
    </div>)
}
