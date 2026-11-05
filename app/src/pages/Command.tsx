import { useState } from 'react'
import { ArrowRight, Boxes, Compass, Package, Radar, Recycle, ScanLine } from 'lucide-react'
import { Card, CardHead, SevBadge } from '../components/ui'
import { FleetMapView } from '../components/FleetMapView'
import { MapLegend } from '../components/MapLegend'
import { Tour } from '../components/Tour'
import { fmtT, getWorld, scannerAt, SCANNERS } from '../sim/engine'
import { CLIENTS, hasModule } from '../sim/registry'
import { useSnap } from '../sim/snap'
import { insights } from '../lib/insights'
import { alertsFor, consFor, vehiclesFor } from '../lib/scope'
import { laundry, recycling } from '../lib/analytics'
import { useInst, isDue } from '../install/store'
import { go, useStore } from '../store'

const TONE: Record<string, string> = { info: 'bg-stone-50', warn: 'bg-amber-50', bad: 'bg-rose-50', good: 'bg-emerald-50' }
const DOT: Record<string, string> = { info: '#8fa1bb', warn: '#f59e0b', bad: '#e11d48', good: '#10b981' }

function UseCase({ n, title, icon, page, color, stats, tone }: { n: string; title: string; icon: React.ReactNode; page: string; color: string; stats: [string | number, string][]; tone?: string }) {
  return (
    <button onClick={() => go(page)} className="card group p-5 text-left transition hover:-translate-y-0.5">
      <div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: color + '1f', color }}>{icon}</span></div>
      <h3 className="mt-3 flex items-center gap-2 text-[17px] font-extrabold text-stone-900">{title}<ArrowRight size={16} className="text-stone-300 transition group-hover:translate-x-1 group-hover:text-stone-900" /></h3>
      {tone && <p className="mt-0.5 text-xs font-bold" style={{ color: tone.startsWith('!') ? '#e11d48' : '#10b981' }}>{tone.replace('!', '')}</p>}
      <div className="mt-3 grid grid-cols-3 gap-2">{stats.map(([v, l]) => <div key={l} className="rounded-xl bg-stone-50 px-2.5 py-2"><div className="whitespace-nowrap text-lg font-extrabold leading-none text-stone-900">{v}</div><div className="mt-1 text-[10.5px] font-semibold leading-tight text-stone-500">{l}</div></div>)}</div>
    </button>)
}

export default function Command() {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const { set, role } = useStore(); const [tour, setTour] = useState(false)
  const curtains = Object.values(useInst((s) => s.curtains)); const seedTs = useInst((s) => s.seedTs)
  const mods = (m: Parameters<typeof hasModule>[1]) => hasModule(role, m)
  const alerts = alertsFor(role).filter((a) => a.t <= t && a.sev !== 'info').slice(-4).reverse()
  const ins = insights(t, snap).filter((i) => role === 'superadmin' || (role === 'synergy' ? !/SC-|scanner/i.test(i.title + i.body) : /RCY|recycl|SC-|scanner|asset/i.test(i.title + i.body)))
  const lau = laundry(t, snap); const rec = recycling(t, role)
  const uses = w.events.filter((e) => e.src === 'QR' && e.title.includes('USE') && e.t <= t)
  const co2 = mods('laundry') ? uses.reduce((a, e) => { const p = w.items[e.item!].type; return a + p.co2New - p.co2Cycle }, 0) : 0
  const rows = SCANNERS.map((s) => scannerAt(w.legs, s, t)); const off = rows.filter((r) => r.outside).length
  const cons = consFor(role).filter((c) => c.legId); const live = cons.filter((c) => { const l = w.legs.find((x) => x.id === c.legId)!; return l.depart <= t && l.arrive > t }).length
  const exc = cons.filter((c) => c.verdict === 'diverted' && t >= 760).length
  const open = alertsFor(role).filter((a) => a.t <= t && (a.sev === 'high' || a.sev === 'critical')).length
  const tracked = (mods('laundry') ? w.items.length : 0) + (mods('assets') ? SCANNERS.length : 0) + (mods('curtains') ? curtains.length : 0)
  const kpis: [string, string, boolean?][] = [['Items tracked', tracked.toLocaleString()], ['Open alerts', String(open), open > 0], ['Loads on the road', String(live)], ['CO₂e avoided', mods('laundry') ? `${co2.toFixed(0)} kg` : rec.tiles[2].value]]
  const hour = Math.floor((t % 1440) / 60); const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-7 p-5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[26px] font-extrabold tracking-tight text-stone-900">{hello}, {role === 'superadmin' ? 'admin' : CLIENTS[role].name}</h1><p className="text-sm text-stone-500">{role === 'superadmin' ? 'Everything across all clients.' : 'Here is what is happening across your sites.'}</p></div>
        <div className="flex gap-2"><button onClick={() => go('scan')} className="flex items-center gap-2 rounded-full bg-cyan-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-cyan-700"><ScanLine size={16} /> Scan</button>{mods('laundry') && <button onClick={() => setTour(!tour)} className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm font-extrabold text-stone-700 hover:bg-stone-50"><Compass size={16} /> {tour ? 'Hide tour' : 'Guided tour'}</button>}</div>
      </div>
      {tour && <Tour />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{kpis.map(([l, v, bad]) => <div key={l} className="card px-4 py-3.5"><div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">{l}</div><div className={`mt-1 text-[28px] font-extrabold leading-none tracking-tight ${bad ? 'text-rose-600' : 'text-stone-900'}`}>{v}</div></div>)}</div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-4">
        {mods('laundry') && <UseCase n="1" title="Laundry & arrivals" icon={<Boxes size={21} />} page="planner" color="#7c3aed" tone={lau.tiles[1].value !== '0' ? `!${lau.tiles[1].value} items unaccounted for` : 'Nothing missing'} stats={[[snap.byStatus.in_use ?? 0, 'in use now'], [snap.byStatus.in_cage ?? 0, 'in dirty cages'], [lau.tiles[0].value, 'on-time runs']]} />}
        {mods('assets') && <UseCase n="2" title="Community assets" icon={<Radar size={21} />} page="assets" color="#2f6fed" tone={off ? `!${off} off-site` : 'All on site'} stats={[[SCANNERS.length, 'devices'], [off, 'off-site'], [rows.filter((r) => r.mode === 'in_transit').length, 'in transit']]} />}
        {mods('shipments') && <UseCase n="3" title="Shipments" icon={<Package size={21} />} page="shipments" color="#d97706" tone={exc ? `!${exc} exception` : 'All on track'} stats={[[cons.length, 'loads today'], [live, 'in transit'], [exc, 'exceptions']]} />}
        {mods('recycling') && <UseCase n="4" title="Recycling proof" icon={<Recycle size={21} />} page="provenance" color="#16a34a" tone={rec.tiles[1].value !== '0 kg' ? `!${rec.tiles[1].value} not proven` : undefined} stats={[[rec.tiles[0].value, 'proven'], [rec.tiles[1].value, 'not proven'], [rec.tiles[2].value, 'CO₂e credit']]} />}
      </div>
      {mods('curtains') && <button onClick={() => go('install')} className="card group flex w-full flex-wrap items-center gap-x-8 gap-y-2 p-4 text-left transition hover:-translate-y-0.5"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-100 text-cyan-700"><ScanLine size={19} /></span><span className="text-[15px] font-extrabold text-stone-900">Curtain installations</span>{[[curtains.filter((c) => c.status === 'installed').length, 'installed'], [curtains.filter(isDue).length, 'due to replace'], [curtains.filter((c) => c.installedAt && c.installedAt > seedTs).length, 'replaced today']].map(([v, l]) => <span key={l as string} className="text-sm text-stone-500"><b className="text-lg font-extrabold text-stone-900">{v}</b> {l}</span>)}<ArrowRight size={16} className="ml-auto text-stone-300 transition group-hover:translate-x-1 group-hover:text-stone-900" /></button>}

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2"><CardHead title="Live fleet" right={<button onClick={() => go('map')} className="text-sm font-bold text-cyan-700 hover:underline">Full map</button>} />
          <div className="relative"><FleetMapView vehIds={vehiclesFor(role)} height={560} onSelect={(id) => { set({ selVeh: id }); go('map') }} scanners={mods('assets')} sites={role === 'clientA' ? ['HUB', 'COMM', 'RECY', 'PORT', 'PORT2', 'INCIN', 'INCIN2'] : undefined} /><MapLegend compact /></div></Card>
        <div className="space-y-6">
          <Card><CardHead title="What needs attention" right={<button onClick={() => go('insights')} className="text-sm font-bold text-cyan-700 hover:underline">All insights</button>} />
            <div className="space-y-2 p-4">{ins.slice(0, 4).map((i, k) => <button key={k} onClick={() => i.page && go(i.page)} className={`flex w-full gap-3 rounded-2xl p-3 text-left ${TONE[i.tone]}`}><i className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DOT[i.tone] }} /><span><span className="block text-[13.5px] font-extrabold text-stone-900">{i.title}</span><span className="block text-xs leading-snug text-stone-500">{i.body}</span></span></button>)}{ins.length === 0 && <div className="p-2 text-sm text-stone-400">All clear.</div>}</div></Card>
          <Card><CardHead title="Latest alerts" right={<button onClick={() => go('alerts')} className="text-sm font-bold text-cyan-700 hover:underline">All</button>} />
            <ul className="divide-y divide-stone-100">{alerts.length === 0 && <li className="p-5 text-sm text-stone-400">All clear.</li>}{alerts.map((a) => <li key={a.id} className="flex items-start gap-3 px-5 py-3"><SevBadge sev={a.sev} /><span className="min-w-0 flex-1 text-[13px] font-bold text-stone-800">{a.title}</span><span className="mono text-[11px] text-stone-400">{fmtT(a.t).slice(0, 5)}</span></li>)}</ul></Card>
        </div>
      </div>
    </div>)
}
