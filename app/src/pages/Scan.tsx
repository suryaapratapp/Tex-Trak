import { useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Boxes, CheckCircle2, Package, Radar, ScanLine, TriangleAlert, XCircle } from 'lucide-react'
import { Card, CardHead, Page, StatusPill } from '../components/ui'
import { Scanner } from '../install/Scanner'
import { getWorld, itemAt, SCANNERS, scannerAt, type Consignment, type Item } from '../sim/engine'
import { SITES, ZONE_NAME } from '../sim/world'
import { hasModule, type ModuleId } from '../sim/registry'
import { consFor } from '../lib/scope'
import { go, useStore } from '../store'

interface Entry { id: number; at: number; kind: string; level: 'ok' | 'warn' | 'error'; text: string }
const useLog = create<{ list: Entry[]; add: (e: Omit<Entry, 'id' | 'at'>) => void; clear: () => void }>()(persist((set) => ({
  list: [], add: (e) => set((s) => ({ list: [{ id: s.list.length ? s.list[0].id + 1 : 1, at: Date.now(), ...e }, ...s.list].slice(0, 40) })), clear: () => set({ list: [] }),
}), { name: 'textrak-scanlog-v1' }))

type Task = 'textile' | 'asset' | 'load' | 'curtain'
const TASKS: { id: Task; label: string; sub: string; module: ModuleId; icon: React.ReactNode }[] = [
  { id: 'textile', label: 'Textile item', sub: 'Issue, soil, cage', module: 'laundry', icon: <Boxes size={22} /> },
  { id: 'curtain', label: 'Curtain', sub: 'Install · take down', module: 'curtains', icon: <ScanLine size={22} /> },
  { id: 'asset', label: 'Equipment', sub: 'Loan out · return', module: 'assets', icon: <Radar size={22} /> },
  { id: 'load', label: 'Delivery or load', sub: 'Dispatch · receive', module: 'shipments', icon: <Package size={22} /> },
]
type Found = { type: 'item'; it: Item } | { type: 'asset'; id: string } | { type: 'load'; c: Consignment } | null

export default function Scan() {
  const role = useStore((s) => s.role); const t = useStore((s) => s.t); const w = getWorld()
  const tasks = TASKS.filter((x) => hasModule(role, x.module) || (x.id === 'load' && hasModule(role, 'recycling')))
  const [task, setTask] = useState<Task>(tasks[0]?.id ?? 'load'); const [manual, setManual] = useState(''); const [found, setFound] = useState<Found>(null); const [msg, setMsg] = useState<{ level: 'ok' | 'warn' | 'error'; title: string; detail: string } | null>(null)
  const { list, add, clear } = useLog(); const mine = consFor(role)
  const lookup = (raw: string) => {
    const code = raw.trim().toUpperCase(); setFound(null)
    if (task === 'textile') { const it = w.items.find((i) => i.qr === code || i.epc === code); if (!it) return setMsg({ level: 'error', title: 'Not recognised', detail: `${raw} is not a textile tag.` }); setFound({ type: 'item', it }); return setMsg(null) }
    if (task === 'asset') { const sc = SCANNERS.find((s) => s.id === code); if (!sc) return setMsg({ level: 'error', title: 'Not recognised', detail: `${raw} is not an equipment tag.` }); setFound({ type: 'asset', id: sc.id }); return setMsg(null) }
    const c = mine.find((x) => x.ref === code || x.cages.includes(code)); if (!c) return setMsg({ level: 'error', title: 'Not on your account', detail: `${raw} does not match any of your loads.` }); setFound({ type: 'load', c }); setMsg(null)
  }
  const done = (kind: string, text: string, level: 'ok' | 'warn' = 'ok') => { add({ kind, level, text }); setMsg({ level, title: text, detail: 'Saved to the scan log.' }); setFound(null) }
  const chips: { label: string; raw: string }[] = task === 'textile' ? [0, 9, 20, 41].map((i) => ({ label: `${w.items[i].type.name} · ${w.items[i].qr}`, raw: w.items[i].qr })) : task === 'asset' ? SCANNERS.slice(0, 4).map((s) => ({ label: `${s.id} · ${s.name.split('·')[0].trim()}`, raw: s.id })) : task === 'load' ? mine.slice(0, 4).map((c) => ({ label: `${c.ref} · ${SITES[c.from].short} → ${SITES[c.to].short}`, raw: c.ref })) : []
  const tone = msg && { ok: ['border-emerald-300 bg-emerald-50 text-emerald-900', <CheckCircle2 key="i" className="text-emerald-600" size={28} />], warn: ['border-amber-300 bg-amber-50 text-amber-900', <TriangleAlert key="i" className="text-amber-600" size={28} />], error: ['border-rose-300 bg-rose-50 text-rose-900', <XCircle key="i" className="text-rose-600" size={28} />] }[msg.level]
  const btn = 'rounded-full px-4 py-2.5 text-sm font-extrabold transition'
  return (
    <Page title="Scan station" sub="Pick a job, then scan the label with the camera or type the code.">
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{tasks.map((x) => (
        <button key={x.id} onClick={() => { setTask(x.id); setFound(null); setMsg(null) }} className={`card flex items-center gap-3.5 p-4 text-left transition ${task === x.id ? 'ring-2 ring-cyan-600' : 'hover:-translate-y-0.5'}`}>
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${task === x.id ? 'bg-cyan-600 text-white' : 'bg-stone-100 text-stone-600'}`}>{x.icon}</span>
          <span><span className="block text-[15px] font-extrabold text-stone-900">{x.label}</span><span className="block text-xs font-semibold text-stone-500">{x.sub}</span></span></button>))}</div>

      {task === 'curtain' ? <Card className="p-8 text-center"><ScanLine className="mx-auto text-cyan-600" size={34} /><h3 className="mt-3 text-xl font-extrabold text-stone-900">Curtain scanning</h3><p className="mx-auto mt-1 max-w-md text-sm text-stone-500">Install, take down, dispatch and receive are in the curtain scanner.</p>
        <button onClick={() => { useStore.getState().set({ instTab: 'scan' }); go('install') }} className="mt-5 rounded-full bg-stone-900 px-6 py-3 text-sm font-extrabold text-white">Open curtain scanner</button></Card> : (
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHead title="Scan" />
          <div className="space-y-4 p-5"><Scanner onScan={lookup} />
            <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { lookup(manual); setManual('') } }} className="flex gap-2"><input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Type or paste a code" className="min-w-0 flex-1 rounded-full border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500" /><button className={`${btn} bg-stone-900 text-white`}>Go</button></form>
            {chips.length > 0 && <div><div className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">Try a demo scan</div><div className="flex flex-wrap gap-2">{chips.map((c) => <button key={c.raw} onClick={() => lookup(c.raw)} className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-50">{c.label}</button>)}</div></div>}</div></Card>
        <div className="space-y-5">
          {found?.type === 'item' && (() => { const it = found.it; const l = itemAt(it, t); return (
            <Card><CardHead title={it.type.name} sub={<span className="mono">{it.qr}</span>} right={<StatusPill s={l.status} />} />
              <div className="space-y-3 p-5"><div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-2xl bg-stone-50 p-3"><div className="text-[11px] font-bold uppercase text-stone-400">Where</div><div className="font-bold text-stone-900">{l.kind === 'vehicle' ? 'On truck' : ZONE_NAME[l.zone!]}</div></div><div className="rounded-2xl bg-stone-50 p-3"><div className="text-[11px] font-bold uppercase text-stone-400">Washes</div><div className="font-bold text-stone-900">{l.cycles} of {it.type.maxCycles}</div></div></div>
                <div className="flex flex-wrap gap-2"><button onClick={() => done('textile', `${it.qr} issued to ward`)} className={`${btn} bg-cyan-600 text-white`}>Issue to ward</button><button onClick={() => done('textile', `${it.qr} marked soiled`)} className={`${btn} bg-amber-500 text-white`}>Mark soiled</button><button onClick={() => done('textile', `${it.qr} loaded into dirty cage ${it.cageOut}`)} className={`${btn} bg-violet-600 text-white`}>Load into cage</button><button onClick={() => done('textile', `${it.qr} reported lost`, 'warn')} className={`${btn} bg-rose-50 text-rose-700 ring-1 ring-rose-200`}>Report lost</button></div></div></Card>) })()}
          {found?.type === 'asset' && (() => { const sc = SCANNERS.find((s) => s.id === found.id)!; const st = scannerAt(w.legs, sc, t); return (
            <Card><CardHead title={sc.name} sub={<span className="mono">{sc.id}</span>} />
              <div className="space-y-3 p-5"><div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-2xl bg-stone-50 p-3"><div className="text-[11px] font-bold uppercase text-stone-400">Holder</div><div className="font-bold text-stone-900">{sc.holder}</div></div><div className="rounded-2xl bg-stone-50 p-3"><div className="text-[11px] font-bold uppercase text-stone-400">Battery</div><div className="font-bold text-stone-900">{Math.round(st.battery)}%</div></div></div>
                <div className="flex flex-wrap gap-2"><button onClick={() => done('asset', `${sc.id} loaned out`)} className={`${btn} bg-cyan-600 text-white`}>Loan out</button><button onClick={() => done('asset', `${sc.id} returned to ${sc.home}`)} className={`${btn} bg-emerald-600 text-white`}>Return</button></div></div></Card>) })()}
          {found?.type === 'load' && (() => { const c = found.c; const leg = w.legs.find((l) => l.id === c.legId); return (
            <Card><CardHead title={c.ref} sub={c.desc} />
              <div className="space-y-3 p-5"><div className="grid grid-cols-3 gap-2 text-sm">{[[`${c.items}`, 'items'], [`${c.kg} kg`, 'declared'], [SITES[c.to].short, 'to']].map(([v, l]) => <div key={l} className="rounded-2xl bg-stone-50 p-3"><div className="text-[11px] font-bold uppercase text-stone-400">{l}</div><div className="truncate font-bold text-stone-900">{v}</div></div>)}</div>
                {leg && <div className="text-xs text-stone-500">Planned arrival {String(Math.floor((leg.planArrive % 1440) / 60)).padStart(2, '0')}:{String(Math.floor(leg.planArrive % 60)).padStart(2, '0')}</div>}
                <div className="flex flex-wrap gap-2"><button onClick={() => done('load', `${c.ref} dispatched · ${c.items} items sealed`)} className={`${btn} bg-cyan-600 text-white`}>Dispatch and seal</button><button onClick={() => done('load', `${c.ref} received · ${c.items}/${c.items} items`)} className={`${btn} bg-emerald-600 text-white`}>Receive all</button><button onClick={() => done('load', `${c.ref} received with a shortage`, 'warn')} className={`${btn} bg-rose-50 text-rose-700 ring-1 ring-rose-200`}>Report shortage</button></div></div></Card>) })()}
          <div className={`card flex min-h-[110px] items-center gap-4 border-2 p-5 ${tone ? tone[0] as string : 'border-dashed border-stone-200'}`}>{msg ? <>{tone![1]}<div><div className="text-lg font-extrabold leading-tight">{msg.title}</div><div className="text-sm opacity-80">{msg.detail}</div></div></> : <div className="text-sm font-semibold text-stone-400">{found ? 'Choose what happened.' : 'Waiting for a scan.'}</div>}</div>
          <Card><CardHead title="Scan log" right={list.length > 0 && <button onClick={clear} className="text-xs font-bold text-stone-400 hover:text-stone-700">Clear</button>} />
            <ul className="divide-y divide-stone-100">{list.length === 0 && <li className="p-5 text-sm text-stone-400">No scans yet.</li>}{list.slice(0, 8).map((e) => <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]"><i className={`h-2 w-2 shrink-0 rounded-full ${e.level === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'}`} /><span className="min-w-0 flex-1 truncate font-semibold text-stone-800">{e.text}</span><span className="mono text-[11px] text-stone-400">{new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></li>)}</ul></Card>
        </div>
      </div>)}
    </Page>)
}
