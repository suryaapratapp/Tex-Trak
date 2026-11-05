import { ArrowRight, Boxes, Leaf, PackageX, ScanLine, ShieldCheck } from 'lucide-react'
import { Card, CardHead, SevBadge } from '../components/ui'
import { FleetMapView } from '../components/FleetMapView'
import { Tour } from '../components/Tour'
import { fmtT, getWorld, SCANNERS } from '../sim/engine'
import { PRODUCTS } from '../sim/world'
import { useSnap } from '../sim/snap'
import { insights } from '../lib/insights'
import { useInst, isDue } from '../install/store'
import { go, useStore } from '../store'

const TONE: Record<string, string> = { info: 'bg-stone-50', warn: 'bg-amber-50', bad: 'bg-rose-50', good: 'bg-emerald-50' }
const DOT: Record<string, string> = { info: '#8fa1bb', warn: '#f59e0b', bad: '#e11d48', good: '#10b981' }

export default function Command() {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const set = useStore((s) => s.set)
  const curtains = Object.values(useInst((s) => s.curtains)); const seedTs = useInst((s) => s.seedTs)
  const alerts = w.alerts.filter((a) => a.t <= t && a.sev !== 'info').slice(-4).reverse()
  const uses = w.events.filter((e) => e.src === 'QR' && e.title.includes('USE') && e.t <= t)
  const co2 = uses.reduce((a, e) => { const p = w.items[e.item!].type; return a + p.co2New - p.co2Cycle }, 0)
  const missing = snap.loc.filter((l) => l.status === 'missing').length
  const tracked = w.items.length + SCANNERS.length + curtains.length
  const verified = t >= 665 ? 142 : 0
  const atRisk = missing * 40 + (t >= 760 ? 168 * 9 : 0) + (t >= 860 ? 6900 : 0)
  const ins = insights(t, snap)
  const hero: [string, string, string][] = [['Items tracked', tracked.toLocaleString(), 'across both use cases'], ['CO₂e avoided', `${co2.toFixed(0)} kg`, 'versus single-use today'], ['Recycling verified', `${verified} kg`, 'proven at the recycler'], ['Value at risk', `£${atRisk.toLocaleString()}`, atRisk ? 'flagged and being chased' : 'nothing flagged']]
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6">
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-stone-900 via-stone-800 to-cyan-900 p-6 text-white sm:p-9">
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div><div className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Tex-Trak</div>
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">Every item.<br />Every journey.<br /><span className="text-cyan-300">Proven.</span></h1>
            <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => go('inventory')} className="flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-extrabold text-stone-900 hover:bg-cyan-50">Explore inventory <ArrowRight size={15} /></button><button onClick={() => go('install')} className="flex items-center gap-2 rounded-full border border-white/30 px-5 py-3 text-sm font-extrabold text-white hover:bg-white/10"><ScanLine size={16} /> Try QR scanning</button></div></div>
          <div className="grid grid-cols-2 gap-3">{hero.map(([l, v, s]) => <div key={l} className="rounded-2xl bg-white/10 p-4 backdrop-blur ring-1 ring-white/15"><div className="text-[11px] font-bold uppercase tracking-wider text-cyan-200">{l}</div><div className="mt-1.5 text-3xl font-extrabold tracking-tight">{v}</div><div className="mt-0.5 text-xs text-white/60">{s}</div></div>)}</div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <button onClick={() => go('inventory')} className="card group p-6 text-left transition hover:-translate-y-0.5">
          <div className="flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Boxes size={22} /></span><ArrowRight className="text-stone-300 transition group-hover:translate-x-1 group-hover:text-stone-900" /></div>
          <h3 className="mt-4 text-xl font-extrabold text-stone-900">Reusable textiles</h3><p className="text-sm font-semibold text-stone-500">RFID doorways + GPS trucks</p>
          <div className="mt-5 grid grid-cols-3 gap-3">{[[w.items.length, 'tagged items'], [snap.byStatus.in_use ?? 0, 'in use now'], [missing, 'missing']].map(([v, l]) => <div key={l as string} className="rounded-2xl bg-stone-50 p-3"><div className="text-2xl font-extrabold text-stone-900">{v}</div><div className="text-[11px] font-semibold text-stone-500">{l}</div></div>)}</div></button>
        <button onClick={() => go('install')} className="card group p-6 text-left transition hover:-translate-y-0.5">
          <div className="flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-100 text-cyan-700"><ScanLine size={22} /></span><ArrowRight className="text-stone-300 transition group-hover:translate-x-1 group-hover:text-stone-900" /></div>
          <h3 className="mt-4 text-xl font-extrabold text-stone-900">Curtain installations</h3><p className="text-sm font-semibold text-stone-500">QR scans · Synergy</p>
          <div className="mt-5 grid grid-cols-3 gap-3">{[[curtains.filter((c) => c.status === 'installed').length, 'installed'], [curtains.filter(isDue).length, 'due to replace'], [curtains.filter((c) => c.installedAt && c.installedAt > seedTs).length, 'replaced today']].map(([v, l]) => <div key={l as string} className="rounded-2xl bg-stone-50 p-3"><div className="text-2xl font-extrabold text-stone-900">{v}</div><div className="text-[11px] font-semibold text-stone-500">{l}</div></div>)}</div></button>
      </div>

      <Tour />

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2"><CardHead title="Live fleet" right={<button onClick={() => go('map')} className="text-sm font-bold text-cyan-700 hover:underline">Full map</button>} />
          <FleetMapView vehIds={['V1', 'V2', 'V3', 'V4', 'V5']} height={430} onSelect={(id) => { set({ selVeh: id }); go('map') }} /></Card>
        <div className="space-y-5">
          <Card><CardHead title="What needs attention" />
            <div className="space-y-2 p-4">{ins.slice(0, 4).map((i, k) => <button key={k} onClick={() => i.page && go(i.page)} className={`flex w-full gap-3 rounded-2xl p-3 text-left ${TONE[i.tone]}`}><i className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DOT[i.tone] }} /><span><span className="block text-[13.5px] font-extrabold text-stone-900">{i.title}</span><span className="block text-xs leading-snug text-stone-500">{i.body}</span></span></button>)}</div></Card>
          <Card><CardHead title="Latest alerts" right={<button onClick={() => go('alerts')} className="text-sm font-bold text-cyan-700 hover:underline">All</button>} />
            <ul className="divide-y divide-stone-100">{alerts.length === 0 && <li className="p-5 text-sm text-stone-400">All clear.</li>}{alerts.map((a) => <li key={a.id} className="flex items-start gap-3 px-5 py-3"><SevBadge sev={a.sev} /><span className="min-w-0 flex-1 text-[13px] font-bold text-stone-800">{a.title}</span><span className="mono text-[11px] text-stone-400">{fmtT(a.t).slice(0, 5)}</span></li>)}</ul></Card>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 pb-4 text-xs font-bold text-stone-400"><span className="flex items-center gap-1.5"><ShieldCheck size={14} /> Tamper-proof custody ledger</span><span className="flex items-center gap-1.5"><Leaf size={14} /> ISO 14040 LCA · CSRD ready</span><span className="flex items-center gap-1.5"><PackageX size={14} /> {PRODUCTS.length} product types · 5 trackers</span></div>
    </div>)
}
