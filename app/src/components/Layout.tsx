import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Activity, AlertTriangle, BarChart3, Boxes, Brain, Building2, Cpu, Eye, FileText, Home, Layers, Leaf, MapPin, Map, Menu, Pause, Play, Radar, Recycle, Repeat2, ScanLine, Settings2, Shield, Tag, Truck, UserCircle, Users, Workflow, ArrowDownToLine, QrCode, LogOut, UsersRound, BookOpen, ArrowLeftRight, ClipboardCheck, ChevronDown, History, MapPinned, Package, PackageMinus, PackageOpen, PackagePlus, ScanBarcode, Sparkles, Warehouse, Wrench } from 'lucide-react'
import { DownloadApp } from './DownloadApp'
import { go, jump, SPEEDS, useStore } from '../store'
import { fmtClock, T0, T1 } from '../sim/engine'
import { hasFeature, type Role } from '../sim/registry'
import { ROLE_LABEL, useAuth } from '../lib/auth'
import { alertsFor } from '../lib/scope'
import { Logo } from './Logo'
import { GuidedTour } from './Tour'
import { SyncBar } from './SyncBar'
import { useQr } from '../qr/store'

interface NavItem { sub?: string; id: string; label: string; icon: ReactNode; adminOnly?: boolean; teamOnly?: boolean; always?: boolean; demoOnly?: boolean }
interface Group { title: string; icon: ReactNode; items: NavItem[] }
const I = 17
const ACCENT: Record<string, string> = { Overview: '#6a57e6', 'Curtains · QR': '#8b5cf6', Warehouse: '#0e8f7e', 'Laundry · RFID': '#3b82f6', Equipment: '#e0a030', Reporting: '#ec4899', Administration: '#64748b' }
const GROUPS: Group[] = [
  { title: 'Overview', icon: <Home size={I} />, items: [{ id: 'command', label: 'Home', icon: <Home size={I} /> }, { id: 'map', label: 'Live map', icon: <Map size={I} /> }, { id: 'scan', label: 'Scan station', icon: <ScanLine size={I} /> }, { id: 'alerts', label: 'Alerts', icon: <AlertTriangle size={I} /> }, { id: 'insights', label: 'Intelligence', icon: <Brain size={I} />, demoOnly: true }] },
  { title: 'Curtains · QR', icon: <QrCode size={I} />, items: [
    { id: 'qrdash', label: 'Dashboard', icon: <BarChart3 size={I} /> }, { id: 'qrproducts', label: 'Products', icon: <Tag size={I} /> }, { id: 'qrinstall', label: 'Install', icon: <ArrowDownToLine size={I} /> }, { id: 'qrtakedown', label: 'Take down', icon: <Repeat2 size={I} /> },
    { id: 'qrregister', label: 'Register labels', icon: <QrCode size={I} /> }, { id: 'qrlocations', label: 'Locations', icon: <MapPin size={I} /> }, { id: 'qrreports', label: 'Reports', icon: <FileText size={I} /> }] },
  { title: 'Warehouse', icon: <Warehouse size={I} />, items: [
    { sub: 'Stock', id: 'whdash', label: 'Dashboard', icon: <Warehouse size={I} /> }, { id: 'whscan', label: 'Smart scan', icon: <ScanBarcode size={I} /> }, { id: 'whinsights', label: 'Insights', icon: <Sparkles size={I} /> }, { id: 'whitems', label: 'Items', icon: <Tag size={I} /> },
    { id: 'whlocations', label: 'Locations', icon: <MapPinned size={I} /> }, { id: 'whledger', label: 'Ledger', icon: <History size={I} /> }, { id: 'whlabels', label: 'Print labels', icon: <QrCode size={I} /> },
    { sub: 'Work', id: 'whreceive', label: 'Goods in', icon: <PackagePlus size={I} /> }, { id: 'whissue', label: 'Goods out', icon: <PackageMinus size={I} /> }, { id: 'whpack', label: 'Pack order', icon: <Package size={I} /> }, { id: 'whorders', label: 'Orders', icon: <FileText size={I} /> },
    { id: 'whunpack', label: 'Unpack', icon: <PackageOpen size={I} /> }, { id: 'whmove', label: 'Move', icon: <ArrowLeftRight size={I} /> }, { id: 'whstock', label: 'Damage and repair', icon: <Wrench size={I} /> }, { id: 'whcount', label: 'Cycle count', icon: <ClipboardCheck size={I} /> }] },
  { title: 'Laundry · RFID', icon: <Boxes size={I} />, items: [{ id: 'planner', label: 'Laundry arrivals', icon: <Activity size={I} /> }, { id: 'inventory', label: 'Inventory', icon: <Boxes size={I} /> }, { id: 'twin', label: 'Facilities and floors', icon: <Building2 size={I} /> }, { id: 'lifecycle', label: 'Daily flow', icon: <Workflow size={I} />, demoOnly: true }] },
  { title: 'Equipment', icon: <Truck size={I} />, items: [{ id: 'assets', label: 'Community assets', icon: <Radar size={I} />, demoOnly: true }, { id: 'shipments', label: 'Shipments', icon: <Truck size={I} /> }] },
  { title: 'Reporting', icon: <FileText size={I} />, items: [{ id: 'provenance', label: 'Recycling proof', icon: <Recycle size={I} />, demoOnly: true }, { id: 'esg', label: 'Impact', icon: <Leaf size={I} />, demoOnly: true }] },
  { title: 'Administration', icon: <Settings2 size={I} />, items: [{ id: 'admin', label: 'Super Admin', icon: <Shield size={I} />, adminOnly: true }, { id: 'status', label: 'Device status', icon: <Cpu size={I} />, adminOnly: true }, { id: 'team', label: 'Team', icon: <UsersRound size={I} />, teamOnly: true }, { id: 'help', label: 'Help and training', icon: <BookOpen size={I} />, always: true }, { id: 'account', label: 'My account', icon: <UserCircle size={I} />, always: true }] },
]
const JUMPS: [string, number][] = [['Morning delivery', 335], ['Recycling runs', 612], ['Day operations', 600], ['Evening collection', 1045], ['Decon processing', 1230], ['Next morning', 1760]]
const visible = (i: NavItem, role: Role) => { const u = useAuth.getState().user; if (i.demoOnly && useStore.getState().mode === 'live') return false; if (i.always) return !!u; if (i.adminOnly) return u?.role === 'superadmin'; if (i.teamOnly) return u?.role === 'org_admin'; return hasFeature(role, i.id) }
export const allowedPages = (role: Role) => GROUPS.flatMap((g) => g.items).filter((i) => visible(i, role)).map((i) => i.id).concat(['item']).concat(hasFeature(role, 'qrlabels') ? ['qrlabels'] : [])

export function Layout({ children }: { children: ReactNode }) {
  const { t, playing, speed, page, role, mode, set, setRole, tick } = useStore()
  const { user, orgs, signOut } = useAuth(); const isSuper = user?.role === 'superadmin'; const org = orgs.find((o) => o.id === role)
  const [shut, setShut] = useState<string[]>(() => { try { const v = localStorage.getItem('nav-shut'); return v ? JSON.parse(v) : GROUPS.map((g) => g.title) } catch { return GROUPS.map((g) => g.title) } })
  const flip = (t: string) => setShut((c) => { const n = c.includes(t) ? c.filter((x) => x !== t) : [...c, t]; try { localStorage.setItem('nav-shut', JSON.stringify(n)) } catch { /* ignore */ } return n })
  const [menu, setMenu] = useState(false); const mainRef = useRef<HTMLElement>(null)
  useEffect(() => { mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior }) }, [page])
  const open = alertsFor(role).filter((a) => a.t <= t && a.sev !== 'info' && a.sev !== 'low').length
  useEffect(() => { let last = performance.now(); const id = setInterval(() => { const n = performance.now(); tick(n - last); last = n }, 100); return () => clearInterval(id) }, [tick])
  useEffect(() => { const f = () => set({ page: location.hash.slice(1) || 'command' }); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [set])
  useEffect(() => { if (!allowedPages(role).includes(page)) go('command') }, [role, page, mode])
  const active = page === 'item' ? 'inventory' : page
  const nav = (id: string) => { go(id); setMenu(false) }

  const Side = (
    <div className="nav-glass flex h-full flex-col border-r border-stone-200/80 text-stone-600">
      <button onClick={() => nav('command')} className="flex items-center gap-3 px-6 pb-5 pt-6"><span className="logo-glow"><Logo size={42} /></span><span className="text-left"><span className="block text-[20px] font-semibold leading-none tracking-tight text-stone-900">Tex-Trak</span><span className="mt-1 block text-[11.5px] font-semibold text-stone-400">Track · Trace · Prove</span></span></button>
      <nav className="scroll-thin min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4 pt-1">
        {GROUPS.map((g) => { const items = g.items.filter((i) => visible(i, role)); if (!items.length) return null
          const has = items.some((i) => i.id === active); const flat = g.title === 'Overview'; const closed = !flat && shut.includes(g.title) && !has; const ac = ACCENT[g.title] ?? '#6a57e6'
          const badge = g.title === 'Overview' ? 0 : items.length
          return (
          <div key={g.title} style={{ '--ac': ac } as React.CSSProperties} className={flat ? 'pb-2' : ''}>
            {flat && <div className="px-3 pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-stone-400">Main</div>}
            {!flat && <button onClick={() => flip(g.title)} aria-expanded={!closed} className={`group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[12.5px] font-bold transition ${has ? 'text-stone-900' : 'text-stone-500 hover:bg-white/80 hover:text-stone-800'}`}>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg transition group-hover:scale-105" style={{ background: `${ac}${has ? '26' : '14'}`, color: ac }}>{g.icon}</span><span className="flex-1 uppercase tracking-[0.08em]">{g.title}</span>
              {closed && badge > 0 && <span className="rounded-full bg-stone-100 px-1.5 text-[10.5px] font-bold leading-4 text-stone-500">{badge}</span>}
              {closed && has && <i className="h-1.5 w-1.5 rounded-full" style={{ background: ac }} />}
              <ChevronDown size={15} className={`text-stone-400 transition-transform ${closed ? '-rotate-90' : ''}`} /></button>}
            {!closed && <div className={flat ? '' : 'ml-[22px] mt-0.5 mb-1.5 border-l-2 pl-2'} style={flat ? undefined : { borderColor: `${ac}33` }}>
              {items.map((i, n) => (<div key={i.id}>
                {i.sub && <div className={`px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-stone-400 ${n ? 'pt-3' : 'pt-1'}`}>{i.sub}</div>}
                <button onClick={() => nav(i.id)} className={`nav-item relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] font-medium transition ${active === i.id ? 'nav-active font-semibold text-stone-900' : 'text-stone-600 hover:translate-x-0.5 hover:bg-white/80 hover:text-stone-900'}`}>
                  {active === i.id && <i className="nav-bar absolute -left-[11px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full" style={{ background: ac }} />}
                  <span style={{ color: active === i.id ? ac : undefined }} className={active === i.id ? '' : 'text-stone-400'}>{i.icon}</span><span className="flex-1">{i.label}</span>
                  {i.id === 'alerts' && open > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10.5px] font-bold leading-4 text-white">{open}</span>}
                </button></div>))}</div>}
          </div>) })}
      </nav>
      <div className="border-t border-stone-200/80 bg-white/60 p-3">
        <div className="flex items-center gap-1"><button onClick={() => nav('account')} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-stone-50"><span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[14px] font-semibold text-white shadow-sm">{(user?.full_name ?? '?')[0]}<i className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold text-stone-900">{user?.full_name}</span><span className="block truncate text-[12px] text-stone-400">{user ? (isSuper ? ROLE_LABEL.superadmin : `${ROLE_LABEL[user.role]} · ${orgs.find((o) => o.id === user.org_id)?.name ?? ''}`) : ''}</span></span></button>
          <button onClick={() => { const n = useQr.getState().ops.filter((o) => o.state === 'pending').length; if (n && !confirm(`${n} saved scan${n === 1 ? ' has' : 's have'} not been sent yet. If you sign out now they stay on this phone until you sign in again and have a connection. Sign out anyway?`)) return; void signOut() }} title="Sign out" aria-label="Sign out" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"><LogOut size={17} /></button></div>
        <DownloadApp variant="link" />
        <div className="mt-1 px-2 text-[11px] font-medium text-stone-400">Developed by CIRCAI LTD</div>
      </div>
    </div>)

  return (
    <div className="flex h-full">
      <aside className="hidden w-[264px] shrink-0 xl:block">{Side}</aside>
      {menu && <div className="fixed inset-0 z-50 xl:hidden"><div className="absolute inset-0 bg-stone-900/50" onClick={() => setMenu(false)} /><div className="absolute inset-y-0 left-0 w-[290px] shadow-2xl">{Side}</div></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        {isSuper && role !== 'superadmin' && <div className="flex flex-wrap items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-[14px] font-semibold text-amber-900"><Eye size={16} /> Previewing as {org?.name ?? role}. This is exactly what their users can see.<button onClick={() => setRole('superadmin')} className="rounded-full bg-amber-900 px-3.5 py-1 text-[13px] font-bold text-white">Exit preview</button></div>}
        <SyncBar />
        <header className="top-glass relative z-10 flex items-center gap-3 border-b border-stone-200/70 px-4 py-3.5 xl:px-8">
          <button onClick={() => setMenu(true)} className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 xl:hidden" aria-label="Menu"><Menu size={18} /></button>
          <div className="flex min-w-0 items-center gap-2 text-[14px] font-semibold"><span className="live-dot shrink-0" style={{ background: role === 'superadmin' ? '#131a2e' : org?.color ?? '#5a46e0' }} /><span className="truncate text-stone-800">{role === 'superadmin' ? 'All clients' : org?.name}</span>{role !== 'superadmin' && org?.tagline && <span className="hidden truncate text-stone-500 sm:inline">· {org.tagline}</span>}</div>
          <div className="ml-auto flex items-center gap-2">
            {mode === 'demo' && <span className="rounded-full bg-amber-100 px-3 py-1 text-[12.5px] font-bold uppercase tracking-wide text-amber-900" title="Everything you see is an example day. Nothing here is real.">Demo data</span>}
            {isSuper && <div className="hidden rounded-lg bg-stone-100 p-0.5 sm:flex" title="Choose between your real data and the built-in example day">{(['live', 'demo'] as const).map((m) => <button key={m} onClick={() => set({ mode: m })} className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${mode === m ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>{m === 'live' ? 'Live data' : 'Demo data'}</button>)}</div>}
            {hasFeature(role, 'scan') && <button onClick={() => nav('scan')} className="flex items-center gap-1.5 rounded-full bg-cyan-600 px-4 py-2 text-[13.5px] font-bold text-white hover:bg-cyan-700 xl:hidden"><ScanLine size={15} /> Scan</button>}
          </div>
        </header>
        <main ref={mainRef} className={`scroll-thin min-h-0 flex-1 overflow-y-auto ${mode === 'demo' ? 'pb-28' : 'pb-8'}`}>{children}
          <footer className="mx-auto max-w-[1500px] px-8 pb-6 pt-2 text-center text-[13px] font-semibold text-stone-400">Tex-Trak · Developed by CIRCAI LTD</footer></main>
        <GuidedTour />
        {mode === 'demo' && <div className="fixed bottom-3 left-3 right-3 z-40 mx-auto flex max-w-[860px] items-center gap-3 rounded-full border border-stone-200 bg-white/95 px-3 py-2 shadow-[0_18px_50px_-18px_rgba(19,26,46,.45)] backdrop-blur xl:left-[288px] sm:gap-4 sm:px-4">
          <button onClick={() => set({ playing: !playing })} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-stone-900 text-white transition hover:bg-stone-700" title={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
          <div className="shrink-0"><div className="mono text-[17px] font-medium leading-none text-stone-900">{fmtClock(t).slice(0, 5)}</div><div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">{t >= 1440 ? 'Day 2' : 'Day 1'}</div></div>
          <input type="range" min={T0} max={T1} step={0.5} value={t} onChange={(e) => set({ t: +e.target.value })} className="h-1.5 min-w-0 flex-1 cursor-pointer accent-cyan-600" aria-label="Time" />
          <select value={speed} onChange={(e) => set({ speed: +e.target.value })} className="hidden rounded-full border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 sm:block">{SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}</select>
          <select value="" onChange={(e) => { if (e.target.value) { jump(+e.target.value); set({ playing: true }) } }} className="w-[92px] rounded-full border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 sm:w-auto"><option value="">Jump to</option>{JUMPS.map(([n, m]) => <option key={n} value={m}>{n}</option>)}</select>
        </div>}
      </div>
    </div>
  )
}
