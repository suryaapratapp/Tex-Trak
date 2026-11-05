import { useEffect, type ReactNode } from 'react'
import { Activity, AlertTriangle, Boxes, Building2, Cpu, Leaf, Map, Pause, Play, Radar, Route, Truck, Workflow, ShieldCheck, Gauge } from 'lucide-react'
import { go, jump, SPEEDS, useStore } from '../store'
import { fmtClock, getWorld, T0, T1 } from '../sim/engine'
import { useLiveTracker } from '../lib/useLive'

const NAV: { group: string; items: { id: string; label: string; icon: ReactNode }[] }[] = [
  { group: 'Operate', items: [
    { id: 'command', label: 'Command Centre', icon: <Gauge size={16} /> },
    { id: 'map', label: 'Live Fleet Map', icon: <Map size={16} /> },
    { id: 'twin', label: 'Facility Digital Twin', icon: <Building2 size={16} /> },
    { id: 'lifecycle', label: 'Lifecycle Flow', icon: <Workflow size={16} /> },
  ] },
  { group: 'Logistics', items: [
    { id: 'planner', label: 'Laundry Planner', icon: <Activity size={16} /> },
    { id: 'shipments', label: 'Shipments', icon: <Truck size={16} /> },
    { id: 'assets', label: 'High-value Assets', icon: <Radar size={16} /> },
  ] },
  { group: 'Assurance', items: [
    { id: 'provenance', label: 'Provenance & Custody', icon: <ShieldCheck size={16} /> },
    { id: 'alerts', label: 'Alerts & Incidents', icon: <AlertTriangle size={16} /> },
    { id: 'esg', label: 'Sustainability · CSRD', icon: <Leaf size={16} /> },
  ] },
  { group: 'Platform', items: [{ id: 'devices', label: 'Devices & Integrations', icon: <Cpu size={16} /> }] },
]
const JUMPS: [string, number][] = [['Morning delivery', 335], ['Recycling run (diverted)', 612], ['Day operations', 600], ['Scanner leaves site', 850], ['Evening collection', 1045], ['Decon processing', 1230], ['Next-morning dispatch', 1760]]

export function Layout({ children }: { children: ReactNode }) {
  const { t, playing, speed, page, set, tick } = useStore()
  const { fix, db } = useLiveTracker()
  const open = getWorld().alerts.filter((a) => a.t <= t && a.sev !== 'info' && a.sev !== 'low').length
  useEffect(() => {
    let last = performance.now()
    const id = setInterval(() => { const n = performance.now(); tick(n - last); last = n }, 100)
    return () => clearInterval(id)
  }, [tick])
  useEffect(() => { const f = () => set({ page: location.hash.slice(1) || 'command' }); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [set])
  useEffect(() => { set({ live: fix }) }, [fix, set])
  const liveAge = fix ? (Date.now() - new Date(fix.ts).getTime()) / 60000 : null

  return (
    <div className="flex h-full">
      <aside className="flex w-[232px] shrink-0 flex-col bg-ink-950 text-slate-300">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-900/40"><Route size={18} /></div>
          <div><div className="text-[15px] font-semibold leading-none tracking-tight text-white">Tex-Trak</div><div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-cyan-300/80">Through-life intelligence</div></div>
        </div>
        <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-4">
          {NAV.map((g) => (
            <div key={g.group} className="mb-4">
              <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{g.group}</div>
              {g.items.map((i) => (
                <button key={i.id} onClick={() => go(i.id)} className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition ${page === i.id ? 'bg-white/10 font-medium text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'}`}>
                  <span className={page === i.id ? 'text-cyan-300' : ''}>{i.icon}</span>{i.label}
                  {i.id === 'alerts' && open > 0 && <span className="ml-auto rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">{open}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="m-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
          <div className="flex items-center gap-2 text-slate-200"><Boxes size={14} className="text-cyan-300" /> STELLAR-HEALTH</div>
          <div className="mt-1 text-[11px] leading-snug text-slate-400">QR → RFID → GNSS data-fusion · TRL 5 → 7 demonstrator</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-5 py-2.5">
          <div className="flex items-center gap-2">
            <button onClick={() => set({ playing: !playing })} className="grid h-8 w-8 place-items-center rounded-lg bg-ink-900 text-white hover:bg-ink-800" title={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
            <div>
              <div className="mono text-lg font-medium leading-none tracking-tight text-slate-900">{fmtClock(t)}</div>
              <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">{t >= 1440 ? 'Day 2 · simulated' : 'Day 1 · simulated'}</div>
            </div>
          </div>
          <input type="range" min={T0} max={T1} step={0.5} value={t} onChange={(e) => set({ t: +e.target.value })} className="h-1.5 min-w-[160px] flex-1 cursor-pointer accent-cyan-600" aria-label="Simulation time" />
          <select value={speed} onChange={(e) => set({ speed: +e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
            {SPEEDS.map((s) => <option key={s} value={s}>{s}× speed</option>)}
          </select>
          <select value="" onChange={(e) => { if (e.target.value) { jump(+e.target.value); set({ playing: true }) } }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
            <option value="">Jump to scenario…</option>{JUMPS.map(([n, m]) => <option key={n} value={m}>{n}</option>)}
          </select>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs" title="Physical Teltonika TAT240 · IMEI 862129084785066">
            <i className={`h-2 w-2 rounded-full ${fix && liveAge! < 90 ? 'bg-emerald-500' : db === 'error' ? 'bg-rose-500' : 'bg-amber-400'} ${fix && liveAge! < 90 ? 'blink' : ''}`} />
            <span className="font-medium text-slate-700">TAT240</span>
            <span className="text-slate-500">{fix ? (liveAge! < 90 ? 'live' : `last seen ${Math.round(liveAge! / 60)} h ago`) : db === 'ok' ? 'awaiting first fix' : db === 'error' ? 'db error' : 'connecting'}</span>
          </div>
        </header>
        <main className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
