import { useEffect, useState, type ReactNode } from 'react'
import { Activity, AlertTriangle, Boxes, Building2, ChevronDown, Cpu, Home, Leaf, Map, Menu, Pause, Play, Radar, Route, ScanLine, ShieldCheck, Truck, Workflow, X } from 'lucide-react'
import { go, jump, SPEEDS, useStore } from '../store'
import { fmtClock, getWorld, T0, T1 } from '../sim/engine'
import { useLiveTracker } from '../lib/useLive'

const PRIMARY = [
  { id: 'command', label: 'Home', icon: <Home size={16} /> },
  { id: 'inventory', label: 'Inventory', icon: <Boxes size={16} /> },
  { id: 'map', label: 'Live map', icon: <Map size={16} /> },
  { id: 'twin', label: 'Facilities', icon: <Building2 size={16} /> },
  { id: 'install', label: 'Installations', icon: <ScanLine size={16} /> },
  { id: 'shipments', label: 'Shipments', icon: <Truck size={16} /> },
  { id: 'alerts', label: 'Alerts', icon: <AlertTriangle size={16} /> },
  { id: 'esg', label: 'Impact', icon: <Leaf size={16} /> },
]
const MORE = [
  { id: 'lifecycle', label: 'Daily flow', icon: <Workflow size={16} /> },
  { id: 'planner', label: 'Laundry planner', icon: <Activity size={16} /> },
  { id: 'assets', label: 'Community assets', icon: <Radar size={16} /> },
  { id: 'provenance', label: 'Recycling proof', icon: <ShieldCheck size={16} /> },
  { id: 'devices', label: 'Devices', icon: <Cpu size={16} /> },
]
const JUMPS: [string, number][] = [['Morning delivery', 335], ['Recycling run', 612], ['Day operations', 600], ['Evening collection', 1045], ['Decon processing', 1230], ['Next morning', 1760]]

export function Layout({ children }: { children: ReactNode }) {
  const { t, playing, speed, page, set, tick } = useStore()
  const { fix, db } = useLiveTracker()
  const [menu, setMenu] = useState(false); const [more, setMore] = useState(false)
  const open = getWorld().alerts.filter((a) => a.t <= t && a.sev !== 'info' && a.sev !== 'low').length
  useEffect(() => {
    let last = performance.now()
    const id = setInterval(() => { const n = performance.now(); tick(n - last); last = n }, 100)
    return () => clearInterval(id)
  }, [tick])
  useEffect(() => { const f = () => set({ page: location.hash.slice(1) || 'command' }); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [set])
  useEffect(() => { set({ live: fix }) }, [fix, set])
  const liveAge = fix ? (Date.now() - new Date(fix.ts).getTime()) / 60000 : null
  const active = page === 'item' ? 'inventory' : page
  const moreActive = MORE.some((m) => m.id === active)
  const nav = (id: string) => { go(id); setMenu(false); setMore(false) }
  const Tab = ({ i, mobile }: { i: { id: string; label: string; icon: ReactNode }; mobile?: boolean }) => (
    <button onClick={() => nav(i.id)} className={`relative flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-[13.5px] font-semibold transition ${mobile ? 'w-full' : ''} ${active === i.id ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100'}`}>
      {i.icon}{i.label}{i.id === 'alerts' && open > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white">{open}</span>}
    </button>)

  return (
    <div className="flex h-full flex-col">
      <header className="no-print relative z-30 border-b border-stone-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6">
          <button onClick={() => setMenu(true)} className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 xl:hidden" aria-label="Menu"><Menu size={18} /></button>
          <button onClick={() => nav('command')} className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-800 text-white shadow-md shadow-cyan-900/20"><Route size={19} /></span>
            <span className="whitespace-nowrap text-[19px] font-extrabold tracking-tight text-stone-900">Tex-Trak</span>
          </button>
          <nav className="ml-6 hidden items-center gap-1 xl:flex">
            {PRIMARY.map((i) => <Tab key={i.id} i={i} />)}
            <div className="relative">
              <button onClick={() => setMore(!more)} className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13.5px] font-semibold ${moreActive ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>More <ChevronDown size={14} /></button>
              {more && <div className="absolute right-0 top-11 w-56 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">{MORE.map((m) => <button key={m.id} onClick={() => nav(m.id)} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] font-semibold ${active === m.id ? 'bg-stone-100 text-stone-900' : 'text-stone-600 hover:bg-stone-50'}`}>{m.icon}{m.label}</button>)}</div>}
            </div>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => nav('devices')} className="hidden items-center gap-2 whitespace-nowrap rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs sm:flex" title="Physical Teltonika TAT240">
              <i className={`h-2 w-2 rounded-full ${fix && liveAge! < 90 ? 'blink bg-emerald-500' : db === 'error' ? 'bg-rose-500' : 'bg-amber-400'}`} />
              <span className="font-semibold text-stone-800">Tracker</span><span className="text-stone-500">{fix ? (liveAge! < 90 ? 'live' : 'offline') : 'not connected'}</span>
            </button>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-stone-100 text-[13px] font-extrabold text-stone-700" title="Demo user">SY</div>
          </div>
        </div>
      </header>
      {menu && (
        <div className="fixed inset-0 z-50 xl:hidden"><div className="absolute inset-0 bg-stone-900/40" onClick={() => setMenu(false)} />
          <div className="absolute inset-y-0 left-0 w-[290px] space-y-1 overflow-y-auto bg-white p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between"><span className="text-lg font-extrabold">Tex-Trak</span><button onClick={() => setMenu(false)}><X size={20} /></button></div>
            {[...PRIMARY, ...MORE].map((i) => <Tab key={i.id} i={i} mobile />)}</div></div>)}

      <main className="scroll-thin min-h-0 flex-1 overflow-y-auto pb-28" onClick={() => more && setMore(false)}>{children}</main>

      <div className="no-print fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-[920px] items-center gap-3 rounded-full border border-stone-200 bg-white/95 px-3 py-2 shadow-[0_18px_50px_-18px_rgba(11,27,51,.45)] backdrop-blur sm:gap-4 sm:px-4">
        <button onClick={() => set({ playing: !playing })} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-stone-900 text-white transition hover:bg-stone-700" title={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
        <div className="shrink-0"><div className="mono text-[17px] font-medium leading-none text-stone-900">{fmtClock(t).slice(0, 5)}</div><div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">{t >= 1440 ? 'Day 2' : 'Day 1'}</div></div>
        <input type="range" min={T0} max={T1} step={0.5} value={t} onChange={(e) => set({ t: +e.target.value })} className="h-1.5 min-w-0 flex-1 cursor-pointer accent-cyan-600" aria-label="Time" />
        <select value={speed} onChange={(e) => set({ speed: +e.target.value })} className="hidden rounded-full border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 sm:block">{SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}</select>
        <select value="" onChange={(e) => { if (e.target.value) { jump(+e.target.value); set({ playing: true }) } }} className="w-[92px] rounded-full border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 sm:w-auto"><option value="">Jump to</option>{JUMPS.map(([n, m]) => <option key={n} value={m}>{n}</option>)}</select>
      </div>
    </div>
  )
}
