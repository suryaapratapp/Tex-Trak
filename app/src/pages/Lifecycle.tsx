import { useMemo } from 'react'
import { ArrowRight, Check, Leaf, QrCode, Radio, Satellite } from 'lucide-react'
import { Bar, Card, CardHead, Chip, Page, STATUS_COLOR, StatusPill } from '../components/ui'
import { fmtT, fusion, getWorld, itemAt } from '../sim/engine'
import { SITES, VEH_BY_ID, ZONE_NAME } from '../sim/world'
import { sha256 } from '../lib/geo'
import { useSnap } from '../sim/snap'
import { useStore } from '../store'

const STAGES = [
  { id: 'A', name: 'Packed at decon', sub: 'Clean cages sealed', tech: ['RFID'] },
  { id: 'B', name: 'Truck → hospital', sub: 'Clean delivery', tech: ['RFID', 'GNSS'] },
  { id: 'C', name: 'Hospital goods-in', sub: 'Dock · linen store', tech: ['RFID'] },
  { id: 'D', name: 'Departments', sub: 'Issued & in use', tech: ['RFID', 'QR'] },
  { id: 'E', name: 'Dirty cages', sub: 'RFID cage bay', tech: ['RFID', 'QR'] },
  { id: 'F', name: 'Truck → decon', sub: 'Soiled collection', tech: ['RFID', 'GNSS'] },
  { id: 'G', name: 'Decontamination', sub: 'Sort · wash · finish · QA', tech: ['RFID'] },
]
const TECH = { RFID: <Radio size={11} />, QR: <QrCode size={11} />, GNSS: <Satellite size={11} /> }
function stageOf(loc: ReturnType<typeof itemAt>, t: number): string {
  if (loc.status === 'missing') return 'M'
  if (loc.kind === 'vehicle') { const l = getWorld().legs.find((x) => x.veh === 'V1' && x.arrive + 5 >= t); return l?.to === 'HOSP' ? 'B' : 'F' }
  const z = loc.zone ?? ''
  if (loc.status === 'in_cage') return 'E'
  if (loc.status === 'in_transit' && (z === 'YARD' || z === 'D_YARD')) return 'F'
  if (['D_PACK', 'D_OUT'].includes(z)) return 'A'
  if (['YARD', 'DOCK', 'LINEN', 'STREET'].includes(z)) return 'C'
  if (z === 'DIRTY') return 'E'
  if (z.startsWith('D_')) return 'G'
  return 'D'
}

export default function Lifecycle() {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const { selItem, set } = useStore()
  const counts = useMemo(() => { const m: Record<string, number> = {}; w.items.forEach((it) => { const s = stageOf(snap.loc[it.id], t); m[s] = (m[s] ?? 0) + 1 }); return m }, [snap])
  const it = w.items[selItem ?? 0]; const loc = snap.loc[it.id]; const fu = fusion(it, t)
  const cur = stageOf(loc, t)
  const timeline = useMemo(() => {
    const rows: { t: number; title: string; src: string; plan: string }[] = it.steps.map((s) => ({ t: s.t, title: s.plan === 'V' ? `Onboard ${VEH_BY_ID[s.loc].reg} (cage ↔ TAT240 …${VEH_BY_ID[s.loc].imei.slice(-6)})` : ZONE_NAME[s.loc], src: s.plan === 'V' ? 'GNSS' : 'RFID', plan: s.status }))
    w.events.filter((e) => e.item === it.id && e.src === 'QR').forEach((e) => rows.push({ t: e.t, title: e.title.replace('QR scan · ', 'QR · '), src: 'QR', plan: '' }))
    return rows.sort((a, b) => a.t - b.t)
  }, [it])
  const ledger = useMemo(() => { let prev = 'GENESIS'; return timeline.map((r) => { const h = sha256(`${prev}|${it.epc}|${r.title}|${r.t.toFixed(1)}`); const o = { ...r, hash: h, prev }; prev = h; return o }) }, [timeline])
  const doneN = timeline.filter((r) => r.t <= t).length
  const co2 = loc.cycles * (it.type.co2New - it.type.co2Cycle)
  return (
    <Page demo title="Daily flow" sub="Where every item is right now.">
      <Card className="mb-4 overflow-x-auto p-4">
        <div className="flex min-w-[1100px] items-stretch gap-1.5">
          {STAGES.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center gap-1.5">
              <div className={`flex-1 rounded-xl border p-3 transition ${cur === s.id ? 'border-cyan-500 bg-cyan-50 shadow-sm' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-2"><div className="min-w-0 text-[12.5px] font-semibold leading-tight text-slate-900">{s.name}</div><div className="mono shrink-0 text-lg font-semibold leading-none text-slate-900">{counts[s.id] ?? 0}</div></div>
                <div className="text-[11px] text-slate-500">{s.sub}</div>
                <div className="mt-2 flex gap-1">{s.tech.map((x) => <Chip key={x} tone={x === 'GNSS' ? 'cyan' : x === 'QR' ? 'blue' : 'violet'}>{TECH[x as keyof typeof TECH]}{x}</Chip>)}</div>
              </div>
              {i < STAGES.length - 1 && <ArrowRight size={16} className="shrink-0 text-slate-300" />}
            </div>
          ))}
          <div className="ml-1 w-[110px] shrink-0 rounded-xl border border-rose-200 bg-rose-50 p-3"><div className="text-[12.5px] font-semibold text-rose-800">Unaccounted</div><div className="mono text-lg font-semibold text-rose-700">{counts.M ?? 0}</div><div className="text-[11px] text-rose-700/70">reconciliation gap</div></div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr_340px]">
        <Card><CardHead title="Tracked items" sub={`${w.items.length} textiles · select to trace`} />
          <ul className="scroll-thin max-h-[560px] divide-y divide-slate-100 overflow-y-auto">{w.items.map((x) => { const l = snap.loc[x.id]; return (
            <li key={x.id}><button onClick={() => set({ selItem: x.id })} className={`flex w-full items-center gap-2.5 px-4 py-2 text-left ${selItem === x.id ? 'bg-cyan-50/70' : 'hover:bg-slate-50'}`}>
              <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[l.status] }} />
              <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-medium text-slate-800">{x.type.name}</div><div className="mono text-[11px] text-slate-400">{x.qr}</div></div>
              <span className="text-[11px] text-slate-400">{l.status.replace('_', ' ')}</span></button></li>) })}</ul></Card>

        <Card><CardHead title={<span>{it.type.name} <span className="mono font-normal text-slate-400">· {it.qr}</span></span>} sub="Digital product passport — every hand-off, one hash-linked thread" right={<StatusPill s={loc.status} />} />
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <ol className="scroll-thin max-h-[520px] overflow-y-auto pr-1">
              {ledger.map((r, i) => { const done = r.t <= t; const isCur = done && (ledger[i + 1]?.t ?? 1e9) > t; return (
                <li key={i} className="relative flex gap-3 pb-3 pl-1">
                  {i < ledger.length - 1 && <span className="absolute left-[10px] top-5 h-full w-px bg-slate-200" />}
                  <span className={`z-10 mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white ${isCur ? 'bg-cyan-600 ring-4 ring-cyan-100' : done ? 'bg-emerald-500' : 'bg-slate-200'}`}>{done && !isCur && <Check size={11} />}</span>
                  <div className={done ? '' : 'opacity-40'}><div className="text-[12.5px] font-medium text-slate-900">{r.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500"><span className="mono">{fmtT(r.t)}</span><Chip tone={r.src === 'GNSS' ? 'cyan' : r.src === 'QR' ? 'blue' : 'violet'}>{r.src}</Chip>{done && <span className="mono text-slate-400">#{r.hash.slice(0, 8)}</span>}</div></div>
                </li>) })}
            </ol>
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs font-semibold text-slate-700">Data-fusion position</div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px]">
                  {[['QR', <QrCode size={14} />, fu.lastQR ? fmtT(fu.lastQR.t).slice(0, 5) : '—'], ['RFID', <Radio size={14} />, fu.lastRF ? fmtT(fu.lastRF.t).slice(0, 5) : '—'], ['GNSS', <Satellite size={14} />, loc.kind === 'vehicle' ? 'live' : 'via truck']].map(([n, ic, v], k) => (
                    <div key={k} className={`rounded-lg border px-1 py-2 ${(n === 'GNSS' && loc.kind === 'vehicle') ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200'}`}><div className="mx-auto mb-1 grid place-items-center text-slate-500">{ic}</div><div className="font-semibold text-slate-800">{n as string}</div><div className="text-slate-500">{v as string}</div></div>))}</div>
                <div className="mt-3 flex items-center justify-between text-xs"><span className="text-slate-500">Confidence</span><span className="font-semibold text-slate-900">{Math.round(fu.conf * 100)}%</span></div>
                <Bar v={fu.conf} color={fu.conf > 0.8 ? '#10b981' : fu.conf > 0.5 ? '#f59e0b' : '#e11d48'} />
                <div className="mt-2 text-[11px] leading-snug text-slate-500"><b className="text-slate-700">{fu.tier}.</b> {fu.method}{fu.pos ? ` · ${fu.pos[0].toFixed(4)}, ${fu.pos[1].toFixed(4)}` : ''}</div></div>
              <div className="rounded-xl border border-slate-200 p-3 text-xs"><div className="font-semibold text-slate-700">Asset record</div>
                {[['EPC (Gen2)', it.epc], ['Cycles', `${loc.cycles} / ${it.type.maxCycles}`], ['Unit value', `£${it.type.unitValue}`], ['Cage (clean)', it.cageIn], ['Cage (dirty)', it.cageOut]].map(([a, b]) => <div key={a} className="mt-1.5 flex justify-between"><span className="text-slate-500">{a}</span><span className="mono text-slate-900">{b}</span></div>)}
                <div className="mt-2"><Bar v={loc.cycles / it.type.maxCycles} color={loc.cycles / it.type.maxCycles > 0.9 ? '#e11d48' : '#1c1917'} /></div></div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><div className="flex items-center gap-1.5 font-semibold"><Leaf size={13} /> Lifetime saving vs single-use</div><div className="mt-1 text-lg font-semibold">{co2.toFixed(0)} kg CO₂e</div><div className="text-emerald-800/80">{loc.cycles} cycles · ISO 14040 functional unit: 1 clinical use</div></div>
              {it.missing && t >= it.missing.t && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"><b>Unaccounted for.</b> {it.missing.reason}. Last known: {ZONE_NAME[it.missing.lastZone]}.</div>}
            </div>
          </div>
        </Card>

        <Card><CardHead title="Hash-linked custody" sub="Tamper-evident ledger (SHA-256)" />
          <div className="scroll-thin max-h-[560px] space-y-1.5 overflow-y-auto p-3">{ledger.slice(0, doneN).slice(-14).reverse().map((r, i) => (
            <div key={i} className="rounded-lg bg-slate-50 px-2.5 py-1.5"><div className="flex justify-between text-[11px]"><span className="font-medium text-slate-700">{r.title.length > 30 ? r.title.slice(0, 30) + '…' : r.title}</span><span className="mono text-slate-400">{fmtT(r.t).slice(0, 5)}</span></div><div className="mono mt-0.5 break-all text-[10px] text-slate-400">prev {r.prev.slice(0, 10)}… → <span className="text-emerald-600">{r.hash.slice(0, 16)}…</span></div></div>))}
            {doneN === 0 && <div className="p-3 text-xs text-slate-400">No events yet.</div>}</div></Card>
      </div>
    </Page>
  )
}
