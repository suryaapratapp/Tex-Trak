import { useEffect, useState, type ReactNode } from 'react'
import { Activity, AlertTriangle, Boxes, Brain, Building2, Check, ChevronDown, Cpu, Home, Leaf, Map, Menu, Pause, Play, Radar, Recycle, ScanLine, Shield, Truck, Waypoints, Workflow } from 'lucide-react'
import { go, jump, SPEEDS, useStore } from '../store'
import { fmtClock, T0, T1 } from '../sim/engine'
import { useLiveTracker } from '../lib/useLive'
import { CLIENTS, hasModule, ROLES, type ModuleId, type Role } from '../sim/registry'
import { alertsFor } from '../lib/scope'

interface NavItem { id: string; label: string; icon: ReactNode; module?: ModuleId | ModuleId[]; roles?: Role[] }
interface Group { title: string; items: NavItem[] }
const GROUPS: Group[] = [
  { title: 'Overview', items: [
    { id: 'command', label: 'Home', icon: <Home size={17} /> },
    { id: 'map', label: 'Live map', icon: <Map size={17} /> },
    { id: 'alerts', label: 'Alerts', icon: <AlertTriangle size={17} /> },
    { id: 'insights', label: 'Intelligence', icon: <Brain size={17} /> }] },
  { title: 'Use cases', items: [
    { id: 'planner', label: '1 · Laundry arrivals', icon: <Activity size={17} />, module: 'laundry' },
    { id: 'inventory', label: 'Inventory', icon: <Boxes size={17} />, module: ['laundry', 'assets'] },
    { id: 'assets', label: '2 · Community assets', icon: <Radar size={17} />, module: 'assets' },
    { id: 'shipments', label: '3 · Shipments', icon: <Truck size={17} />, module: 'shipments' },
    { id: 'provenance', label: '4 · Recycling proof', icon: <Recycle size={17} />, module: 'recycling' }] },
  { title: 'Sites', items: [
    { id: 'twin', label: 'Facilities & floors', icon: <Building2 size={17} />, module: ['laundry', 'curtains'] },
    { id: 'install', label: 'Curtain installations', icon: <ScanLine size={17} />, module: 'curtains' },
    { id: 'lifecycle', label: 'Daily flow', icon: <Workflow size={17} />, module: 'laundry' },
    { id: 'esg', label: 'Impact', icon: <Leaf size={17} /> }] },
  { title: 'Administration', items: [
    { id: 'admin', label: 'Super Admin', icon: <Shield size={17} />, roles: ['superadmin'] },
    { id: 'devices', label: 'Trackers', icon: <Cpu size={17} />, roles: ['superadmin', 'synergy'] }] },
]
const JUMPS: [string, number][] = [['Morning delivery', 335], ['Recycling runs', 612], ['Day operations', 600], ['Evening collection', 1045], ['Decon processing', 1230], ['Next morning', 1760]]
const visible = (i: NavItem, role: Role) => (i.roles ? i.roles.includes(role) : true) && (!i.module || (Array.isArray(i.module) ? i.module : [i.module]).some((m) => hasModule(role, m)))
export const allowedPages = (role: Role) => GROUPS.flatMap((g) => g.items).filter((i) => visible(i, role)).map((i) => i.id).concat(['scan', 'item'])

export function Layout({ children }: { children: ReactNode }) {
  const { t, playing, speed, page, role, set, setRole, tick } = useStore()
  const { fix, db } = useLiveTracker()
  const [menu, setMenu] = useState(false); const [who, setWho] = useState(false)
  const open = alertsFor(role).filter((a) => a.t <= t && a.sev !== 'info' && a.sev !== 'low').length
  useEffect(() => {
    let last = performance.now()
    const id = setInterval(() => { const n = performance.now(); tick(n - last); last = n }, 100)
    return () => clearInterval(id)
  }, [tick])
  useEffect(() => { const f = () => set({ page: location.hash.slice(1) || 'command' }); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [set])
  useEffect(() => { set({ live: fix }) }, [fix, set])
  useEffect(() => { if (!allowedPages(role).includes(page)) go('command') }, [role, page])
  const liveAge = fix ? (Date.now() - new Date(fix.ts).getTime()) / 60000 : null
  const active = page === 'item' ? 'inventory' : page
  const nav = (id: string) => { go(id); setMenu(false); setWho(false) }
  const me = ROLES.find((r) => r.id === role)!
  const accent = role === 'superadmin' ? '#0b1b33' : CLIENTS[role].color

  const Side = (
    <div className="flex h-full flex-col">
      <button onClick={() => nav('command')} className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl text-white shadow-md" style={{ background: 'linear-gradient(135deg,#14a597,#0a4743)' }}><Waypoints size={20} /></span>
        <span className="text-left"><span className="block text-[18px] font-extrabold leading-none tracking-tight text-stone-900">Tex-Trak</span><span className="mt-1 block text-[11px] font-semibold text-stone-400">Through-life tracking</span></span>
      </button>
      <div className="px-4 pb-5">
        <button onClick={() => nav('scan')} className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-[15px] font-extrabold text-white shadow-md transition hover:brightness-110 ${active === 'scan' ? 'ring-2 ring-offset-2 ring-cyan-600' : ''}`} style={{ background: 'linear-gradient(135deg,#14a597,#0b6c65)' }}><ScanLine size={18} /> Scan station</button>
      </div>
      <nav className="scroll-thin min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4">
        {GROUPS.map((g) => { const items = g.items.filter((i) => visible(i, role)); if (!items.length) return null; return (
          <div key={g.title}><div className="px-3.5 pb-2 text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-stone-400">{g.title}</div>
            {items.map((i) => (
              <button key={i.id} onClick={() => nav(i.id)} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[15px] font-semibold transition ${active === i.id ? 'bg-cyan-50 text-cyan-800' : 'text-stone-600 hover:bg-stone-100'}`}>
                <span className={active === i.id ? 'text-cyan-600' : 'text-stone-400'}>{i.icon}</span><span className="flex-1">{i.label}</span>
                {i.id === 'alerts' && open > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white">{open}</span>}
              </button>))}</div>) })}
      </nav>
      <div className="relative border-t border-stone-100 p-3">
        {who && <div className="absolute bottom-[68px] left-3 right-3 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl">
          <div className="px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-wider text-stone-400">Switch demo account</div>
          {ROLES.map((r) => <button key={r.id} onClick={() => { setRole(r.id); setWho(false); setMenu(false) }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-stone-50"><span className="grid h-8 w-8 place-items-center rounded-full text-xs font-extrabold text-white" style={{ background: r.id === 'superadmin' ? '#0b1b33' : CLIENTS[r.id].color }}>{r.label[0]}</span><span className="flex-1"><span className="block text-[13px] font-bold text-stone-900">{r.label}</span><span className="block text-[11px] text-stone-500">{r.sub}</span></span>{role === r.id && <Check size={15} className="text-cyan-600" />}</button>)}</div>}
        <button onClick={() => setWho(!who)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-stone-50">
          <span className="grid h-9 w-9 place-items-center rounded-full text-[13px] font-extrabold text-white" style={{ background: accent }}>{me.label[0]}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold text-stone-900">{me.label}</span><span className="block truncate text-[11px] text-stone-500">{me.sub}</span></span><ChevronDown size={15} className="text-stone-400" />
        </button>
      </div>
    </div>)

  return (
    <div className="flex h-full">
      <aside className="hidden w-[272px] shrink-0 border-r border-stone-200/80 bg-white xl:block">{Side}</aside>
      {menu && <div className="fixed inset-0 z-50 xl:hidden"><div className="absolute inset-0 bg-stone-900/40" onClick={() => setMenu(false)} /><div className="absolute inset-y-0 left-0 w-[280px] bg-white shadow-2xl">{Side}</div></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-stone-200/70 bg-white px-4 py-3.5 xl:px-8">
          <button onClick={() => setMenu(true)} className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 xl:hidden" aria-label="Menu"><Menu size={18} /></button>
          <div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-stone-500"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} /><span className="truncate text-stone-800">{role === 'superadmin' ? 'All clients' : CLIENTS[role].name}</span>{role !== 'superadmin' && <span className="hidden truncate sm:inline">· {CLIENTS[role].tagline}</span>}</div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => nav('scan')} className="flex items-center gap-1.5 rounded-full bg-cyan-600 px-3.5 py-2 text-[13px] font-bold text-white xl:hidden"><ScanLine size={15} /> Scan</button>
            <button onClick={() => nav('devices')} className="hidden items-center gap-2 whitespace-nowrap rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs sm:flex" title="Physical Teltonika TAT240">
              <i className={`h-2 w-2 rounded-full ${fix && liveAge! < 90 ? 'blink bg-emerald-500' : db === 'error' ? 'bg-rose-500' : 'bg-amber-400'}`} /><span className="font-semibold text-stone-800">TAT240</span><span className="text-stone-500">{fix ? (liveAge! < 90 ? 'live' : 'offline') : 'not connected'}</span></button>
          </div>
        </header>
        <main className="scroll-thin min-h-0 flex-1 overflow-y-auto pb-28" onClick={() => who && setWho(false)}>{children}</main>
        <div className="fixed bottom-3 left-3 right-3 z-40 mx-auto flex max-w-[860px] items-center gap-3 rounded-full border border-stone-200 bg-white/95 px-3 py-2 shadow-[0_18px_50px_-18px_rgba(11,27,51,.45)] backdrop-blur xl:left-[288px] sm:gap-4 sm:px-4">
          <button onClick={() => set({ playing: !playing })} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-stone-900 text-white transition hover:bg-stone-700" title={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
          <div className="shrink-0"><div className="mono text-[17px] font-medium leading-none text-stone-900">{fmtClock(t).slice(0, 5)}</div><div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">{t >= 1440 ? 'Day 2' : 'Day 1'}</div></div>
          <input type="range" min={T0} max={T1} step={0.5} value={t} onChange={(e) => set({ t: +e.target.value })} className="h-1.5 min-w-0 flex-1 cursor-pointer accent-cyan-600" aria-label="Time" />
          <select value={speed} onChange={(e) => set({ speed: +e.target.value })} className="hidden rounded-full border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 sm:block">{SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}</select>
          <select value="" onChange={(e) => { if (e.target.value) { jump(+e.target.value); set({ playing: true }) } }} className="w-[92px] rounded-full border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 sm:w-auto"><option value="">Jump to</option>{JUMPS.map(([n, m]) => <option key={n} value={m}>{n}</option>)}</select>
        </div>
      </div>
    </div>
  )
}
