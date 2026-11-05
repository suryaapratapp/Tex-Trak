import { useEffect, useState, type ReactNode } from 'react'
import { Menu, Activity, AlertTriangle, Boxes, Building2, Cpu, Home, Leaf, Map, Pause, Play, Radar, Route, ShieldCheck, Truck, Workflow } from 'lucide-react'
import { go, jump, SPEEDS, useStore } from '../store'
import { fmtClock, getWorld, T0, T1 } from '../sim/engine'
import { useLiveTracker } from '../lib/useLive'

const NAV: { group: string; items: { id: string; label: string; hint: string; icon: ReactNode }[] }[] = [
  { group: 'Start here', items: [
    { id: 'command', label: 'Overview', hint: 'Guided tour & today at a glance', icon: <Home size={17} /> },
    { id: 'lifecycle', label: 'Daily flow', hint: 'Where every item is right now', icon: <Workflow size={17} /> },
  ] },
  { group: 'Track', items: [
    { id: 'inventory', label: 'Inventory', hint: 'Every product & its journey', icon: <Boxes size={17} /> },
    { id: 'map', label: 'Live map', hint: 'Trucks on the road', icon: <Map size={17} /> },
    { id: 'twin', label: 'Inside buildings', hint: 'Hospital & plant floor plans', icon: <Building2 size={17} /> },
    { id: 'shipments', label: 'Shipments', hint: 'Deliveries & collections', icon: <Truck size={17} /> },
  ] },
  { group: 'Plan', items: [
    { id: 'planner', label: 'Laundry planner', hint: 'What arrives, and when', icon: <Activity size={17} /> },
    { id: 'assets', label: 'Community assets', hint: 'Scanners & loaned kit', icon: <Radar size={17} /> },
  ] },
  { group: 'Prove', items: [
    { id: 'provenance', label: 'Recycling proof', hint: 'Did it reach the recycler?', icon: <ShieldCheck size={17} /> },
    { id: 'alerts', label: 'Alerts', hint: 'Problems that need action', icon: <AlertTriangle size={17} /> },
    { id: 'esg', label: 'Sustainability', hint: 'CO₂, water & CSRD export', icon: <Leaf size={17} /> },
  ] },
  { group: 'Setup', items: [{ id: 'devices', label: 'Devices', hint: 'TAT240 tracker & readers', icon: <Cpu size={17} /> }] },
]
const JUMPS: [string, number][] = [['Morning delivery', 335], ['Recycling run (diverted)', 612], ['Day operations', 600], ['Scanner leaves site', 850], ['Evening collection', 1045], ['Decon processing', 1230], ['Next-morning dispatch', 1760]]

export function Layout({ children }: { children: ReactNode }) {
  const { t, playing, speed, page, set, tick } = useStore()
  const { fix, db } = useLiveTracker()
  const [menu, setMenu] = useState(false)
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

  return (
    <div className="flex h-full">
      {menu && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMenu(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] shrink-0 flex-col border-r border-stone-200 bg-white transition-transform lg:static lg:translate-x-0 ${menu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-stone-900 text-white"><Route size={19} /></div>
          <div><div className="text-[17px] font-extrabold leading-none tracking-tight text-stone-900">Tex-Trak</div><div className="mt-1 text-[11px] font-medium text-stone-500">Know where everything is</div></div>
        </div>
        <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-4">
          {NAV.map((g) => (
            <div key={g.group} className="mb-3">
              <div className="px-3 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-stone-400">{g.group}</div>
              {g.items.map((i) => (
                <button key={i.id} onClick={() => { go(i.id); setMenu(false) }} className={`mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${active === i.id ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-700 hover:bg-stone-100'}`}>
                  <span className={active === i.id ? 'text-white' : 'text-stone-500'}>{i.icon}</span>
                  <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-semibold leading-tight">{i.label}</span><span className={`block truncate text-[11px] leading-tight ${active === i.id ? 'text-stone-300' : 'text-stone-400'}`}>{i.hint}</span></span>
                  {i.id === 'alerts' && open > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{open}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="m-3 rounded-2xl bg-stone-100 p-3.5 text-xs">
          <div className="font-bold text-stone-900">How we know where things are</div>
          <div className="mt-2 space-y-1 text-[11.5px] leading-snug text-stone-600">
            <div><b className="text-violet-700">RFID</b> — readers on doorway ceilings</div>
            <div><b className="text-blue-700">QR</b> — a person scans it</div>
            <div><b className="text-sky-700">GPS</b> — the truck carrying the cage</div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button onClick={() => setMenu(true)} className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 lg:hidden" aria-label="Menu"><Menu size={18} /></button>
          <div className="flex items-center gap-3">
            <button onClick={() => set({ playing: !playing })} className="grid h-10 w-10 place-items-center rounded-full bg-stone-900 text-white transition hover:bg-stone-700" title={playing ? 'Pause demo' : 'Play demo'}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
            <div>
              <div className="mono text-[22px] font-medium leading-none tracking-tight text-stone-900">{fmtClock(t)}</div>
              <div className="mt-1 text-[11px] font-semibold text-stone-500">{t >= 1440 ? 'Day 2' : 'Day 1'} · demo time</div>
            </div>
          </div>
          <input type="range" min={T0} max={T1} step={0.5} value={t} onChange={(e) => set({ t: +e.target.value })} className="order-last h-1.5 w-full min-w-[160px] cursor-pointer accent-stone-900 sm:order-none sm:w-auto sm:flex-1" aria-label="Demo time" />
          <select value={speed} onChange={(e) => set({ speed: +e.target.value })} className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700">
            {SPEEDS.map((s) => <option key={s} value={s}>{s}× speed</option>)}
          </select>
          <select value="" onChange={(e) => { if (e.target.value) { jump(+e.target.value); set({ playing: true }) } }} className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700">
            <option value="">Jump to…</option>{JUMPS.map(([n, m]) => <option key={n} value={m}>{n}</option>)}
          </select>
          <button onClick={() => go('devices')} className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs" title="Physical Teltonika TAT240 · IMEI 862129084785066">
            <i className={`h-2 w-2 rounded-full ${fix && liveAge! < 90 ? 'blink bg-emerald-500' : db === 'error' ? 'bg-rose-500' : 'bg-amber-400'}`} />
            <span className="font-semibold text-stone-800">Real tracker</span>
            <span className="text-stone-500">{fix ? (liveAge! < 90 ? 'live' : 'offline') : db === 'ok' ? 'not connected yet' : db === 'error' ? 'db error' : '…'}</span>
          </button>
        </header>
        <main className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
