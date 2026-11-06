import { useEffect, useState, type ReactNode } from 'react'
import { Activity, AlertTriangle, BarChart3, Boxes, Brain, Building2, Cpu, Eye, FileText, Home, Layers, Leaf, MapPin, Map, Menu, Pause, Play, Radar, Recycle, Repeat2, ScanLine, Settings2, Shield, Tag, Truck, UserCircle, Users, Workflow, ArrowDownToLine, QrCode, LogOut, UsersRound } from 'lucide-react'
import { go, jump, SPEEDS, useStore } from '../store'
import { fmtClock, T0, T1 } from '../sim/engine'
import { useLiveTracker } from '../lib/useLive'
import { hasFeature, type Role } from '../sim/registry'
import { ROLE_LABEL, useAuth } from '../lib/auth'
import { alertsFor } from '../lib/scope'
import { Logo } from './Logo'

interface NavItem { id: string; label: string; icon: ReactNode; adminOnly?: boolean; teamOnly?: boolean; always?: boolean }
interface Group { title: string; items: NavItem[] }
const I = 17
const GROUPS: Group[] = [
  { title: 'Overview', items: [{ id: 'command', label: 'Home', icon: <Home size={I} /> }, { id: 'map', label: 'Live map', icon: <Map size={I} /> }, { id: 'alerts', label: 'Alerts', icon: <AlertTriangle size={I} /> }, { id: 'insights', label: 'Intelligence', icon: <Brain size={I} /> }] },
  { title: 'Field work', items: [{ id: 'scan', label: 'Scan station', icon: <ScanLine size={I} /> }] },
  { title: 'Curtains · QR', items: [
    { id: 'qrdash', label: 'Dashboard', icon: <BarChart3 size={I} /> }, { id: 'qrproducts', label: 'Products', icon: <Tag size={I} /> }, { id: 'qrinstall', label: 'Install', icon: <ArrowDownToLine size={I} /> }, { id: 'qrtakedown', label: 'Take down', icon: <Repeat2 size={I} /> },
    { id: 'qrregister', label: 'Register labels', icon: <QrCode size={I} /> }, { id: 'qrlocations', label: 'Locations', icon: <MapPin size={I} /> }, { id: 'qrreports', label: 'Reports', icon: <FileText size={I} /> }] },
  { title: 'Laundry · RFID', items: [{ id: 'planner', label: 'Laundry arrivals', icon: <Activity size={I} /> }, { id: 'inventory', label: 'Inventory', icon: <Boxes size={I} /> }, { id: 'twin', label: 'Facilities and floors', icon: <Building2 size={I} /> }, { id: 'lifecycle', label: 'Daily flow', icon: <Workflow size={I} /> }] },
  { title: 'Equipment and loads', items: [{ id: 'assets', label: 'Community assets', icon: <Radar size={I} /> }, { id: 'shipments', label: 'Shipments', icon: <Truck size={I} /> }] },
  { title: 'Reporting', items: [{ id: 'provenance', label: 'Recycling proof', icon: <Recycle size={I} /> }, { id: 'esg', label: 'Impact', icon: <Leaf size={I} /> }] },
  { title: 'Administration', items: [{ id: 'admin', label: 'Super Admin', icon: <Shield size={I} />, adminOnly: true }, { id: 'devices', label: 'Trackers', icon: <Cpu size={I} />, adminOnly: true }, { id: 'team', label: 'Team', icon: <UsersRound size={I} />, teamOnly: true }, { id: 'account', label: 'My account', icon: <UserCircle size={I} />, always: true }] },
]
const JUMPS: [string, number][] = [['Morning delivery', 335], ['Recycling runs', 612], ['Day operations', 600], ['Evening collection', 1045], ['Decon processing', 1230], ['Next morning', 1760]]
const visible = (i: NavItem, role: Role) => { const u = useAuth.getState().user; if (i.always) return !!u; if (i.adminOnly) return u?.role === 'superadmin'; if (i.teamOnly) return u?.role === 'org_admin'; return hasFeature(role, i.id) }
export const allowedPages = (role: Role) => GROUPS.flatMap((g) => g.items).filter((i) => visible(i, role)).map((i) => i.id).concat(['item']).concat(hasFeature(role, 'qrlabels') ? ['qrlabels'] : [])

export function Layout({ children }: { children: ReactNode }) {
  const { t, playing, speed, page, role, mode, set, setRole, tick } = useStore()
  const { fix, db } = useLiveTracker(); const { user, orgs, signOut } = useAuth(); const isSuper = user?.role === 'superadmin'; const org = orgs.find((o) => o.id === role)
  const [menu, setMenu] = useState(false)
  const open = alertsFor(role).filter((a) => a.t <= t && a.sev !== 'info' && a.sev !== 'low').length
  useEffect(() => { let last = performance.now(); const id = setInterval(() => { const n = performance.now(); tick(n - last); last = n }, 100); return () => clearInterval(id) }, [tick])
  useEffect(() => { const f = () => set({ page: location.hash.slice(1) || 'command' }); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [set])
  useEffect(() => { set({ live: fix }) }, [fix, set])
  useEffect(() => { if (!allowedPages(role).includes(page)) go('command') }, [role, page])
  const liveAge = fix ? (Date.now() - new Date(fix.ts).getTime()) / 60000 : null
  const active = page === 'item' ? 'inventory' : page
  const nav = (id: string) => { go(id); setMenu(false) }

  const Side = (
    <div className="flex h-full flex-col border-r border-stone-200 bg-white text-stone-600">
      <button onClick={() => nav('command')} className="flex items-center gap-3 px-6 pb-5 pt-6"><Logo size={42} /><span className="text-left"><span className="block text-[20px] font-semibold leading-none tracking-tight text-stone-900">Tex-Trak</span><span className="mt-1 block text-[11.5px] font-semibold text-stone-400">Track · Trace · Prove</span></span></button>
      <nav className="scroll-thin min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4 pt-2">
        {GROUPS.map((g) => { const items = g.items.filter((i) => visible(i, role)); if (!items.length) return null; return (
          <div key={g.title}><div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">{g.title}</div>
            {items.map((i) => (
              <button key={i.id} onClick={() => nav(i.id)} className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14.5px] font-medium transition ${active === i.id ? 'bg-cyan-50 text-cyan-700' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}>
                {active === i.id && <i className="absolute -left-4 top-2 h-6 w-1 rounded-r bg-cyan-600" />}
                <span className={active === i.id ? 'text-cyan-600' : 'text-stone-400'}>{i.icon}</span><span className="flex-1">{i.label}</span>
                {i.id === 'alerts' && open > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10.5px] font-bold leading-4 text-white">{open}</span>}
              </button>))}</div>) })}
      </nav>
      <div className="border-t border-stone-200 p-4">
        <div className="flex items-center gap-1"><button onClick={() => nav('account')} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-stone-50"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyan-100 text-[14px] font-semibold text-cyan-700">{(user?.full_name ?? '?')[0]}</span><span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold text-stone-900">{user?.full_name}</span><span className="block truncate text-[12px] text-stone-400">{user ? (isSuper ? ROLE_LABEL.superadmin : `${ROLE_LABEL[user.role]} · ${orgs.find((o) => o.id === user.org_id)?.name ?? ''}`) : ''}</span></span></button>
          <button onClick={() => void signOut()} title="Sign out" aria-label="Sign out" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"><LogOut size={17} /></button></div>
        <div className="mt-3 px-2 text-[11.5px] font-medium text-stone-400">Developed by CIRCAI LTD</div>
      </div>
    </div>)

  return (
    <div className="flex h-full">
      <aside className="hidden w-[264px] shrink-0 xl:block">{Side}</aside>
      {menu && <div className="fixed inset-0 z-50 xl:hidden"><div className="absolute inset-0 bg-stone-900/50" onClick={() => setMenu(false)} /><div className="absolute inset-y-0 left-0 w-[290px] shadow-2xl">{Side}</div></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        {isSuper && role !== 'superadmin' && <div className="flex flex-wrap items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-[14px] font-semibold text-amber-900"><Eye size={16} /> Previewing as {org?.name ?? role}. This is exactly what their users can see.<button onClick={() => setRole('superadmin')} className="rounded-full bg-amber-900 px-3.5 py-1 text-[13px] font-bold text-white">Exit preview</button></div>}
        <header className="flex items-center gap-3 border-b border-stone-200/70 bg-white px-4 py-3.5 xl:px-8">
          <button onClick={() => setMenu(true)} className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 xl:hidden" aria-label="Menu"><Menu size={18} /></button>
          <div className="flex min-w-0 items-center gap-2 text-[14px] font-semibold"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: role === 'superadmin' ? '#131a2e' : org?.color ?? '#5a46e0' }} /><span className="truncate text-stone-800">{role === 'superadmin' ? 'All clients' : org?.name}</span>{role !== 'superadmin' && org?.tagline && <span className="hidden truncate text-stone-500 sm:inline">· {org.tagline}</span>}</div>
          <div className="ml-auto flex items-center gap-2">
            {isSuper && <div className="hidden rounded-lg bg-stone-100 p-0.5 sm:flex" title="Choose between your real data and the built-in example day">{(['live', 'demo'] as const).map((m) => <button key={m} onClick={() => set({ mode: m })} className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${mode === m ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>{m === 'live' ? 'Live data' : 'Demo data'}</button>)}</div>}
            {hasFeature(role, 'scan') && <button onClick={() => nav('scan')} className="flex items-center gap-1.5 rounded-full bg-cyan-600 px-4 py-2 text-[13.5px] font-bold text-white hover:bg-cyan-700 xl:hidden"><ScanLine size={15} /> Scan</button>}
            {isSuper && <button onClick={() => nav('devices')} className="hidden items-center gap-2 whitespace-nowrap rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-[13px] sm:flex" title="Physical Teltonika TAT240">
              <i className={`h-2 w-2 rounded-full ${fix && liveAge! < 90 ? 'blink bg-emerald-500' : db === 'error' ? 'bg-rose-500' : 'bg-amber-400'}`} /><span className="font-semibold text-stone-800">TAT240</span><span className="text-stone-500">{fix ? (liveAge! < 90 ? 'live' : 'offline') : 'not connected'}</span></button>}
          </div>
        </header>
        <main className="scroll-thin min-h-0 flex-1 overflow-y-auto pb-28">{children}
          <footer className="mx-auto max-w-[1500px] px-8 pb-6 pt-2 text-center text-[13px] font-semibold text-stone-400">Tex-Trak · Developed by CIRCAI LTD</footer></main>
        <div className="fixed bottom-3 left-3 right-3 z-40 mx-auto flex max-w-[860px] items-center gap-3 rounded-full border border-stone-200 bg-white/95 px-3 py-2 shadow-[0_18px_50px_-18px_rgba(19,26,46,.45)] backdrop-blur xl:left-[288px] sm:gap-4 sm:px-4">
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
