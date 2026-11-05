import { useMemo, useState } from 'react'
import { ArrowLeft, Building2, Check, Radio, QrCode, Route as RouteIcon, Satellite, Truck } from 'lucide-react'
import { Bar, Card, Chip, Page, StatusPill } from '../components/ui'
import { FloorPlan } from '../components/FloorPlan'
import { LegMap } from '../components/LegMap'
import { fmtT, fusion, getWorld, type Item, type Step } from '../sim/engine'
import { rng } from '../lib/geo'
import { PLANS, SITES, VEH_BY_ID, ZONE_NAME } from '../sim/world'
import { fmtDur, useSnap } from '../sim/snap'
import { go, useStore } from '../store'

interface Chapter { idx: number; kind: 'trip' | 'inside'; plan: 'H' | 'D' | 'V'; steps: Step[]; t0: number; t1: number; legId?: string; title: string; cycle: number }
function chapters(it: Item): Chapter[] {
  const w = getWorld(); const groups: Step[][] = []
  it.steps.forEach((s, i) => { if (i === 0 || s.plan !== it.steps[i - 1].plan) groups.push([]); groups[groups.length - 1].push(s) })
  return groups.map((g, i) => {
    const plan = g[0].plan; const next = groups[i + 1]?.[0]
    const leg = plan === 'V' ? w.legs.find((l) => l.veh === 'V1' && l.arrive + 5 >= g[0].t) : undefined
    const t1 = plan === 'V' ? leg!.arrive + 2 : next ? next.t : 1890
    const second = it.washedAt !== undefined && g[0].t >= it.washedAt - 1
    const title = plan === 'V' ? (leg!.to === 'HOSP' ? 'Truck: plant → hospital' : 'Truck: hospital → plant') : plan === 'H' ? 'Inside the hospital' : 'Inside the decon plant'
    return { idx: i, kind: plan === 'V' ? 'trip' : 'inside', plan, steps: g, t0: g[0].t, t1, legId: leg?.id, title, cycle: it.baseCycles + (second ? 2 : 1) }
  })
}
const how = (it: Item, s: Step, prev: number) => {
  const w = getWorld()
  const e = [...w.events].reverse().find((x) => x.item === it.id && x.t <= s.t + 0.3 && x.t > prev - 6 && (x.reader || x.src === 'QR'))
  return e ? (e.src === 'QR' ? { src: 'QR', text: e.title.replace('QR scan · ', 'Scanned: ') } : { src: 'RFID', text: e.title }) : { src: 'RFID', text: 'Tag read' }
}

export default function ItemJourney() {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const { selItem, set } = useStore()
  const it = w.items[selItem ?? 0]; const loc = snap.loc[it.id]; const fu = fusion(it, t)
  const chs = useMemo(() => chapters(it), [it])
  const live = chs.find((c) => t >= c.t0 && t < c.t1) ?? [...chs].reverse().find((c) => t >= c.t1) ?? chs[0]
  const [manual, setManual] = useState<number | null>(null)
  const cur = chs[manual ?? live.idx] ?? live
  const status = (c: Chapter) => (t < c.t0 ? 'next' : t < c.t1 ? 'live' : 'done')
  const leg = cur.legId ? w.legs.find((l) => l.id === cur.legId) : undefined
  const where = loc.status === 'missing' ? `Unaccounted for — last seen in ${ZONE_NAME[it.missing!.lastZone]}` : loc.kind === 'vehicle' ? `Riding on truck ${VEH_BY_ID[loc.veh!].reg}` : loc.kind === 'moving' ? `Moving to ${ZONE_NAME[loc.zone!]}` : ZONE_NAME[loc.zone!]
  const cyclesDone = loc.cycles
  const past = useMemo(() => { const r = rng(it.id * 977 + 13); const trucks = ['SY71 KBR', 'SY71 KBR', 'KB04 TRK']; return [1, 2, 3, 4, 5, 6].map((k) => ({ n: it.baseCycles - k + 1, daysAgo: Math.round(k * (2.6 + r() * 1.2)), dept: ZONE_NAME[it.type.depts[Math.floor(r() * it.type.depts.length)]], truck: trucks[Math.floor(r() * 3)], hrs: Math.round(6 + r() * 9) })) }, [it])
  const cycleGroups = [...new Set(chs.map((c) => c.cycle))]
  return (
    <Page title={it.type.name} sub={`Journey of ${it.qr} — follow the trips on the maps and the rooms it passes through inside each building.`}
      right={<button onClick={() => go('inventory')} className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100"><ArrowLeft size={15} /> All inventory</button>}>
      <Card className="mb-5 p-5"><div className="grid gap-5 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div><div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Right now</div><div className="mt-1 text-xl font-extrabold leading-tight text-stone-900">{where}</div><div className="mt-2"><StatusPill s={loc.status} /></div></div>
        <div><div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Reuse count</div><div className="mt-1 text-3xl font-extrabold text-stone-900">{cyclesDone}<span className="text-base font-semibold text-stone-400"> / {it.type.maxCycles}</span></div><Bar v={cyclesDone / it.type.maxCycles} color={cyclesDone / it.type.maxCycles > 0.9 ? '#e11d48' : '#1c1917'} /></div>
        <div><div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">How we know</div><div className="mt-1 flex items-center gap-2 text-sm font-bold text-stone-900">{loc.kind === 'vehicle' ? <Satellite size={16} className="text-sky-600" /> : fu.tier.startsWith('QR') ? <QrCode size={16} className="text-blue-600" /> : <Radio size={16} className="text-violet-600" />}{fu.tier}</div><div className="mt-1 text-xs text-stone-500">{Math.round(fu.conf * 100)}% confident</div></div>
        <div><div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Tag</div><div className="mono mt-1 break-all text-[11.5px] text-stone-700">{it.epc}</div><div className="mt-1 text-xs text-stone-500">Value £{it.type.unitValue}</div></div>
      </div></Card>

      <div className="grid gap-5 xl:grid-cols-[330px_1fr]">
        <Card className="h-fit p-4">
          <div className="mb-3 text-[13px] font-extrabold text-stone-900">Journey, step by step</div>
          {cycleGroups.map((cg) => (
            <div key={cg} className="mb-3">
              <div className="mb-1.5 flex items-center gap-2"><span className="rounded-full bg-stone-900 px-2.5 py-0.5 text-[11px] font-bold text-white">Wash cycle #{cg}</span><span className="text-[11px] text-stone-400">{cg === it.baseCycles + 1 ? 'today' : 'next day'}</span></div>
              {chs.filter((c) => c.cycle === cg).map((c) => { const s = status(c); return (
                <button key={c.idx} onClick={() => setManual(c.idx)} className={`mb-1 flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${cur.idx === c.idx ? 'border-stone-900 bg-stone-50' : 'border-transparent hover:bg-stone-50'}`}>
                  <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${s === 'live' ? 'bg-orange-500 text-white ring-4 ring-orange-100' : s === 'done' ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-500'}`}>{s === 'done' ? <Check size={14} /> : c.kind === 'trip' ? <Truck size={14} /> : <Building2 size={14} />}</span>
                  <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-bold text-stone-900">{c.title}</span><span className="mono block text-[11px] text-stone-500">{fmtT(c.t0).slice(0, 5)} → {fmtT(c.t1).slice(0, 5)}</span></span>
                  {s === 'live' && <Chip tone="amber">now</Chip>}</button>) })}
            </div>))}
          {it.missing && <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800"><b>Journey stops here.</b> {it.missing.reason}.</div>}
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-stone-600"><input type="checkbox" checked={manual === null} onChange={(e) => setManual(e.target.checked ? null : live.idx)} /> Follow the item automatically</label>
        </Card>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="border-b border-stone-100 p-5">
              <div className="flex flex-wrap items-center gap-2"><Chip tone={cur.kind === 'trip' ? 'blue' : 'violet'}>{cur.kind === 'trip' ? 'On the road · GPS' : 'In a building · RFID + QR'}</Chip><Chip>Wash cycle #{cur.cycle}</Chip>{status(cur) === 'live' && <Chip tone="amber">happening now</Chip>}</div>
              <h2 className="mt-2 text-xl font-extrabold text-stone-900">{cur.title}</h2>
              <p className="mt-1 max-w-3xl text-[14px] leading-relaxed text-stone-600">
                {cur.kind === 'trip' ? (leg!.to === 'HOSP' ? `The item is inside cage ${it.cageIn}. The cage is linked to the truck's TAT240 GPS tracker, so while it drives, the item has the truck's exact position.` : `The item is inside dirty cage ${it.cageOut}, scanned out of the hospital and linked to the truck's TAT240 tracker for the trip back to the decontamination plant.`)
                  : cur.plan === 'H' ? 'Ceiling RFID readers over every doorway record each time this item enters or leaves a room. Staff QR scans record when it is issued, used and soiled. Numbered stops show the path in order.'
                    : 'Readers at every stage of the plant confirm the item moved dirty → washed → finished → verified, and the wash cycle count goes up by one.'}</p>
            </div>
            {cur.kind === 'trip' && leg ? <>
              <LegMap legId={leg.id} height={380} itemOnboardFrom={cur.steps[0].t} itemOnboardTo={leg.arrive} />
              <div className="grid gap-px bg-stone-100 sm:grid-cols-4">{[['Departs', fmtT(leg.depart).slice(0, 5), SITES[leg.from].short], ['Arrives', fmtT(leg.arrive).slice(0, 5), t < leg.arrive && t >= leg.depart ? `in ${fmtDur(leg.arrive - t)}` : `plan ${fmtT(leg.planArrive).slice(0, 5)}`], ['Truck', VEH_BY_ID[leg.veh].reg, VEH_BY_ID[leg.veh].driver], ['Distance', `${(leg.meters / 1000).toFixed(1)} km`, `tracker …${VEH_BY_ID[leg.veh].imei.slice(-6)}`]].map(([a, b, c]) => <div key={a} className="bg-white p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">{a}</div><div className="mt-0.5 text-lg font-extrabold text-stone-900">{b}</div><div className="text-xs text-stone-500">{c}</div></div>)}</div>
            </> : <div className="p-4"><FloorPlan planId={cur.plan as 'H' | 'D'} trail={{ itemId: it.id, steps: cur.steps }} />
              <ol className="mt-4 grid gap-2 sm:grid-cols-2">{cur.steps.filter((s, i) => i === 0 || s.loc !== cur.steps[i - 1].loc).map((s, i, arr) => { const h = how(it, s, arr[i - 1]?.t ?? s.t - 10); const done = s.t <= t; return (
                <li key={i} className={`flex items-center gap-3 rounded-xl border p-3 ${done ? 'border-stone-200 bg-white' : 'border-dashed border-stone-200 bg-stone-50 opacity-60'}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold ${done ? 'bg-orange-500 text-white' : 'bg-stone-200 text-stone-500'}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-bold text-stone-900">{ZONE_NAME[s.loc]}</div><div className="flex items-center gap-1.5 text-[11px] text-stone-500"><span className="mono">{fmtT(s.t).slice(0, 5)}</span><Chip tone={h.src === 'QR' ? 'blue' : 'violet'}>{h.src}</Chip><span className="truncate">{h.text}</span></div></div></li>) })}</ol></div>}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2"><RouteIcon size={17} className="text-stone-700" /><h3 className="text-base font-extrabold text-stone-900">Earlier cycles — this item has done this {cyclesDone} times</h3></div>
            <p className="mt-1 text-sm text-stone-500">Every reuse repeats the same loop: delivery → use → soiled → collection → wash → delivery. Past cycles come from the hash-linked ledger.</p>
            <table className="mt-3 w-full text-left text-sm"><thead className="text-[11px] font-bold uppercase tracking-wider text-stone-400"><tr><th className="py-2">Cycle</th><th>When</th><th>Used in</th><th>Truck</th><th>Time in use</th><th>Result</th></tr></thead>
              <tbody className="divide-y divide-stone-100">{past.map((p) => <tr key={p.n}><td className="py-2.5 font-bold text-stone-900">#{p.n}</td><td className="text-stone-600">{p.daysAgo} days ago</td><td>{p.dept}</td><td className="mono text-xs">{p.truck}</td><td>{p.hrs} h</td><td><Chip tone="green">Washed ✓ verified</Chip></td></tr>)}</tbody></table>
            <div className="mt-3 rounded-xl bg-stone-50 p-3 text-xs text-stone-600">≈ {(cyclesDone * 24.8).toFixed(0)} km driven in total · {(cyclesDone * (it.type.co2New - it.type.co2Cycle)).toFixed(0)} kg CO₂e avoided versus single-use · {it.type.maxCycles - cyclesDone} washes before retirement</div>
          </Card>
        </div>
      </div>
    </Page>
  )
}
