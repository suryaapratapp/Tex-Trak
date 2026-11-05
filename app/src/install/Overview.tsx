import { useRef, useState } from 'react'
import { ArrowRight, Play, RotateCcw, ScanLine } from 'lucide-react'
import { Card, CardHead } from '../components/ui'
import { useStore } from '../store'
import { BAYS, JOB_FLOOR, STATUS, bayCode, curtainCode, isDue, useInst, type CStatus } from './store'

export const Ring = ({ v, size = 132, label }: { v: number; size?: number; label: string }) => { const r = size / 2 - 10, c = 2 * Math.PI * r
  return (<svg width={size} height={size} className="shrink-0"><circle cx={size / 2} cy={size / 2} r={r} stroke="#e6edf6" strokeWidth="10" fill="none" /><circle cx={size / 2} cy={size / 2} r={r} stroke="#0b877d" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset .5s' }} /><text x="50%" y="48%" textAnchor="middle" className="fill-stone-900 text-[26px] font-extrabold">{Math.round(v * 100)}%</text><text x="50%" y="63%" textAnchor="middle" className="fill-stone-500 text-[11px] font-semibold">{label}</text></svg>) }

export function EventList({ limit = 8 }: { limit?: number }) {
  const events = useInst((s) => s.events)
  const dot = { ok: '#10b981', warn: '#f59e0b', error: '#e11d48' }
  if (!events.length) return <div className="p-6 text-center text-sm text-stone-400">No scans yet. Start scanning to see activity here.</div>
  return <ul className="divide-y divide-stone-100">{events.slice(0, limit).map((e) => <li key={e.id} className="flex items-start gap-3 px-5 py-3"><i className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot[e.level] }} /><div className="min-w-0 flex-1"><div className="text-sm font-bold text-stone-900">{e.title}</div><div className="truncate text-xs text-stone-500">{e.detail}</div></div><span className="mono text-[11px] text-stone-400">{new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></li>)}</ul>
}

export function InstOverview() {
  const { curtains, seedTs, handToDriver, finishReprocessing, reset } = useInst(); const set = useStore((s) => s.set)
  const list = Object.values(curtains); const count = (s: CStatus) => list.filter((c) => c.status === s).length
  const job = BAYS.filter((b) => b.floor === JOB_FLOOR)
  const done = job.filter((b) => { const c = list.find((x) => x.bay === b.id && x.status === 'installed'); return c?.installedAt && c.installedAt > seedTs }).length
  const [running, setRunning] = useState(false); const stop = useRef(false)
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const auto = async () => {
    if (running) { stop.current = true; return }
    setRunning(true); stop.current = false; const st = useInst.getState
    for (const b of job) {
      if (stop.current) break
      const cur = Object.values(st().curtains)
      const inBay = cur.find((c) => c.bay === b.id && c.status === 'installed'); if (inBay?.installedAt && inBay.installedAt > st().seedTs) continue
      const nxt = cur.find((c) => c.status === 'on_site'); if (!nxt) break
      st().scan('install', bayCode(b.id)); await sleep(380); st().scan('install', curtainCode(nxt.id)); await sleep(520)
    }
    setRunning(false)
  }
  const stages: { s: CStatus; hint: string }[] = [{ s: 'stock', hint: 'Clean & ready' }, { s: 'on_site', hint: 'Waiting to be fitted' }, { s: 'installed', hint: 'Hanging in wards' }, { s: 'taken_down', hint: 'Awaiting collection' }, { s: 'in_transit', hint: 'Heading back' }, { s: 'reprocessing', hint: 'Being cleaned' }]
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden"><div className="grid gap-6 bg-gradient-to-br from-cyan-50 via-white to-white p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
        <Ring v={done / job.length} label={`${done} of ${job.length} bays`} />
        <div><div className="text-xs font-bold uppercase tracking-wider text-cyan-700">Today’s job</div><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-stone-900">Replace curtains · Floor 2</h2><p className="mt-1 text-stone-500">Wards 3A and 3B · {job.length} bays · {job.filter((b) => list.find((c) => c.bay === b.id && isDue(c))).length} curtains due for replacement</p>
          <div className="mt-4 flex flex-wrap gap-2.5"><button onClick={() => set({ instTab: 'scan' })} className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-stone-700"><ScanLine size={16} /> Start scanning</button>
            <button onClick={auto} className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-bold text-stone-800 hover:bg-stone-50"><Play size={15} /> {running ? 'Stop demo' : 'Watch it run'}</button>
            <button onClick={() => { stop.current = true; reset() }} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-stone-500 hover:bg-stone-100"><RotateCcw size={14} /> Reset</button></div></div>
        <div className="hidden text-right md:block"><div className="text-xs font-semibold text-stone-500">Demo user</div><div className="font-extrabold text-stone-900">Synergy</div><div className="text-xs text-stone-500">Field installation team</div></div>
      </div></Card>

      <Card><CardHead title="The curtain cycle" sub="Every curtain repeats this loop" />
        <div className="scroll-thin flex items-stretch gap-2 overflow-x-auto p-5">{stages.map(({ s, hint }, i) => (
          <div key={s} className="flex flex-1 items-center gap-2"><div className="min-w-[140px] flex-1 rounded-2xl border border-stone-200 p-4"><div className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS[s].color }} /><span className="text-[12.5px] font-bold text-stone-700">{STATUS[s].label}</span></div><div className="mt-2 text-3xl font-extrabold text-stone-900">{count(s)}</div><div className="text-xs text-stone-500">{hint}</div></div>{i < stages.length - 1 && <ArrowRight size={16} className="shrink-0 text-stone-300" />}</div>))}</div>
        <div className="flex flex-wrap gap-2.5 border-t border-stone-100 p-4">
          <button disabled={!count('taken_down')} onClick={handToDriver} className="rounded-full bg-stone-900 px-4 py-2 text-sm font-bold text-white disabled:bg-stone-200 disabled:text-stone-400">Hand {count('taken_down')} to driver</button>
          <button onClick={() => set({ instTab: 'scan' })} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-bold text-stone-700 hover:bg-stone-50">Receive at facility (scan)</button>
          <button disabled={!count('reprocessing')} onClick={finishReprocessing} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-bold text-stone-700 hover:bg-stone-50 disabled:text-stone-300">Finish reprocessing ({count('reprocessing')})</button></div></Card>
      <Card><CardHead title="Recent activity" /><EventList limit={8} /></Card>
    </div>)
}
