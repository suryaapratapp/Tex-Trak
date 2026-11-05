import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Anchor, ArrowRight, Check, FileBadge, Flame, Printer, Recycle, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { Card, Chip, Kpi, Page } from '../components/ui'
import { FleetMapView } from '../components/FleetMapView'
import { MapLegend } from '../components/MapLegend'
import { fmtT, getWorld, vehicleAt, type Consignment, type CustodyEv } from '../sim/engine'
import { SITES, VEH_BY_ID } from '../sim/world'
import { orgInfo } from '../lib/auth'
import { dist } from '../lib/geo'
import { useSnap } from '../sim/snap'
import { useStore } from '../store'
import { consFor } from '../lib/scope'

type Verdict = { label: string; tone: 'ok' | 'bad' | 'wait' }
function judge(chain: CustodyEv[], t: number): Verdict {
  const shown = chain.filter((e) => e.t <= t)
  if (shown.some((e) => !e.ok)) return { label: 'CHAIN BROKEN', tone: 'bad' }
  if (shown.length === chain.length) return { label: 'VERIFIED RECYCLED', tone: 'ok' }
  return { label: 'IN PROGRESS', tone: 'wait' }
}
/** Where is the load right now? Compares the declared destination with the geofence the tracker is really inside. */
function whereNow(c: Consignment, t: number) {
  const w = getWorld(); const st = vehicleAt(w.legs, c.veh, t)
  const at = Object.values(SITES).find((s) => dist(st.pos, s.pos) <= s.radius)
  return { st, at, onTarget: at?.id === c.to, kind: at?.kind ?? 'road' }
}

function RouteSvg({ c }: { c: Consignment }) {
  const w = getWorld(); const leg = w.legs.find((l) => l.id === c.legId)!
  const pts = leg.pts
  const near = Object.values(SITES).filter((s) => [c.from, c.to].includes(s.id) || (s.restricted && pts.some((p) => dist(p, s.pos) < 9000)))
  const all = [...pts, ...near.map((s) => s.pos)]
  const lat0 = Math.min(...all.map((p) => p[0])), lat1 = Math.max(...all.map((p) => p[0])), lng0 = Math.min(...all.map((p) => p[1])), lng1 = Math.max(...all.map((p) => p[1]))
  const k = Math.cos(((lat0 + lat1) / 2) * Math.PI / 180); const W = 700, H = 240, pad = 34
  const sx = (W - pad * 2) / Math.max(1e-6, (lng1 - lng0) * k), sy = (H - pad * 2) / Math.max(1e-6, lat1 - lat0); const sc = Math.min(sx, sy)
  const X = (lng: number) => pad + (lng - lng0) * k * sc, Y = (lat: number) => H - pad - (lat - lat0) * sc
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, background: '#f8fafc' }}>
      <polyline points={pts.map((p) => `${X(p[1])},${Y(p[0])}`).join(' ')} fill="none" stroke="#5a46e0" strokeWidth="3" strokeLinejoin="round" />
      {near.map((s) => { const bad = s.restricted; return (
        <g key={s.id}><circle cx={X(s.pos[1])} cy={Y(s.pos[0])} r={bad ? 9 : 7} fill={bad ? '#fecdd3' : s.id === c.to ? '#bbf7d0' : '#e2e8f0'} stroke={bad ? '#be123c' : '#0b1b33'} strokeWidth="2" />
          <text x={X(s.pos[1])} y={Y(s.pos[0]) - 13} fontSize="11" fontWeight="700" textAnchor="middle" fill={bad ? '#9f1239' : '#0b1b33'}>{s.short}</text></g>) })}
    </svg>)
}

function Certificate({ c, verdict, onDone }: { c: Consignment; verdict: Verdict; onDone: () => void }) {
  const w = getWorld(); const t = useStore.getState().t; const chain = w.custody[c.ref].filter((e) => e.t <= t)
  const now = whereNow(c, t); const v = VEH_BY_ID[c.veh]; const client = orgInfo(c.client)
  useEffect(() => { const id = setTimeout(() => { window.print(); onDone() }, 80); return () => clearTimeout(id) }, [onDone])
  const col = verdict.tone === 'ok' ? '#047857' : verdict.tone === 'bad' ? '#be123c' : '#0369a1'
  const cell: React.CSSProperties = { border: '1px solid #cbd5e1', padding: '5px 8px', fontSize: 11, textAlign: 'left', verticalAlign: 'top' }
  return createPortal(
    <div className="print-only" style={{ fontFamily: 'Manrope, Arial, sans-serif', color: '#0b1b33', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #5a46e0', paddingBottom: 10 }}>
        <div><div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 800, color: '#5a46e0' }}>TEX-TRAK · THROUGH-LIFE PROVENANCE</div><div style={{ fontSize: 24, fontWeight: 800, marginTop: 2 }}>Recycling evidence certificate</div></div>
        <div style={{ textAlign: 'right', fontSize: 11 }}><div style={{ fontWeight: 800, fontSize: 15 }}>{c.ref}</div><div>Issued {new Date().toLocaleString('en-GB')}</div></div>
      </div>
      <div style={{ margin: '14px 0', padding: '10px 14px', border: `2px solid ${col}`, borderRadius: 8, color: col, fontWeight: 800, fontSize: 16, letterSpacing: 1 }}>{verdict.label}
        <span style={{ fontWeight: 600, fontSize: 12, marginLeft: 12, color: '#0b1b33' }}>{verdict.tone === 'ok' ? 'Load reached the declared recycler and was received.' : verdict.tone === 'bad' ? 'Load did not reach the declared recycler. Certificate withheld.' : 'Journey still in progress.'}</span></div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}><tbody>
        {([['Client', client.name], ['Declared destination', SITES[c.to].name], ['Last confirmed location', now.at ? now.at.name : 'On the road'], ['Origin', SITES[c.from].name], ['Contents', `${c.desc} · ${c.items} items · ${c.kg} kg`], ['Carrier', c.carrier], ['Vehicle', `${v.reg} · TAT240 IMEI ${v.imei}`]] as [string, string][]).map(([a, b]) => (
          <tr key={a}><th style={{ ...cell, width: 170, background: '#f1f5f9' }}>{a}</th><td style={cell}>{b}</td></tr>))}
      </tbody></table>
      <div style={{ fontSize: 12, fontWeight: 800, margin: '0 0 6px' }}>Route driven</div><RouteSvg c={c} />
      <div style={{ fontSize: 12, fontWeight: 800, margin: '14px 0 6px' }}>Chain of custody (hash-linked ledger)</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Time', 'Event', 'Source', 'Result', 'SHA-256'].map((h) => <th key={h} style={{ ...cell, background: '#f1f5f9' }}>{h}</th>)}</tr></thead>
        <tbody>{chain.map((e, i) => (
          <tr key={i} style={{ pageBreakInside: 'avoid' }}><td style={cell}>{fmtT(e.t)}</td><td style={cell}>{e.title}</td><td style={cell}>{e.source}</td><td style={{ ...cell, color: e.ok ? '#047857' : '#be123c', fontWeight: 700 }}>{e.ok ? 'Pass' : 'Fail'}</td><td style={{ ...cell, fontFamily: 'monospace', fontSize: 8, wordBreak: 'break-all', width: 190 }}>{e.hash}</td></tr>))}</tbody>
      </table>
      <div style={{ marginTop: 14, fontSize: 10, color: '#475a75', borderTop: '1px solid #cbd5e1', paddingTop: 8 }}>Each ledger entry contains the SHA-256 hash of the previous entry, so any later change to this record is detectable. Position evidence comes from the Teltonika TAT240 tracker fitted to the vehicle; receipt evidence from RFID readers at the destination.</div>
    </div>, document.body)
}

function Chain({ c }: { c: Consignment }) {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const [printing, setPrinting] = useState(false)
  const chain = w.custody[c.ref]; const verdict = judge(chain, t); const now = whereNow(c, t)
  const tone = verdict.tone === 'bad' ? 'border-rose-300 bg-rose-50 text-rose-800' : verdict.tone === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-sky-200 bg-sky-50 text-sky-800'
  const dest = SITES[c.to]
  const actual = now.at ? now.at : null
  const wrong = actual && actual.id !== c.to && actual.restricted
  return (
    <Card className="overflow-hidden">
      <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${tone}`}>
        <div className="flex min-w-0 items-center gap-2.5">{verdict.tone === 'bad' ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}<div className="min-w-0"><div className="text-sm font-extrabold">{c.ref}</div><div className="truncate text-xs opacity-80">{c.desc} · {c.items} items · {c.kg} kg</div></div></div>
        <span className="shrink-0 rounded-full bg-white/70 px-3 py-1 text-xs font-bold tracking-wide">{verdict.label}</span></div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-stone-100 px-4 py-3 text-xs">
        <div><div className="font-bold uppercase tracking-wider text-stone-400">Declared</div><div className="mt-0.5 flex items-center gap-1.5 text-[13px] font-bold text-stone-900"><Recycle size={14} className="text-emerald-600" />{dest.short}</div></div>
        <ArrowRight size={16} className="text-stone-300" />
        <div><div className="font-bold uppercase tracking-wider text-stone-400">Actually at</div>
          <div className={`mt-0.5 flex items-center gap-1.5 text-[13px] font-bold ${wrong ? 'text-rose-700' : now.onTarget ? 'text-emerald-700' : 'text-stone-700'}`}>
            {wrong ? (actual!.kind === 'port' ? <Anchor size={14} /> : <Flame size={14} />) : now.onTarget ? <Recycle size={14} /> : null}{actual ? actual.short : 'On the road'}</div></div>
      </div>
      <div className="relative"><FleetMapView vehIds={[c.veh]} height={250} sites={['HOSP', 'DECON', 'COMM', 'RECY', 'PORT', 'PORT2', 'INCIN', 'INCIN2']} bounds={[[51.42, -0.3], [51.62, 0.52]]} /><MapLegend compact /></div>
      <ol className="p-4">
        {chain.map((e, i) => { const d = e.t <= t; return (
          <li key={i} className={`relative flex gap-3 pb-3 ${d ? '' : 'opacity-35'}`}>
            {i < chain.length - 1 && <span className="absolute left-[9px] top-5 h-full w-px bg-slate-200" />}
            <span className={`z-10 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white ${!d ? 'bg-slate-200' : e.ok ? 'bg-emerald-500' : 'bg-rose-500'}`}>{d && (e.ok ? <Check size={11} /> : <X size={11} />)}</span>
            <div className="min-w-0 flex-1"><div className={`text-[13px] font-semibold ${d && !e.ok ? 'text-rose-700' : 'text-slate-900'}`}>{e.title}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500"><span className="mono">{fmtT(e.t)}</span><Chip tone={e.source === 'GNSS' ? 'cyan' : e.source === 'RULE' ? 'red' : e.source.includes('RFID') ? 'violet' : 'slate'}>{e.source}</Chip>{e.site && <span>{SITES[e.site].short}</span>}{d && <span className="mono text-slate-400">sha256 {e.hash.slice(0, 14)}…</span>}</div></div></li>) })}
      </ol>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
        <span>{verdict.tone === 'bad' ? 'Certificate withheld · evidence locked' : verdict.tone === 'ok' ? 'Certificate issued' : 'Awaiting receipt at the recycler'}</span>
        <button onClick={() => setPrinting(true)} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"><Printer size={13} /> Print evidence</button></div>
      {printing && <Certificate c={c} verdict={verdict} onDone={() => setPrinting(false)} />}
    </Card>)
}

export default function Provenance() {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const role = useStore((s) => s.role)
  const list = consFor(role).filter((c) => c.kind === 'recycling')
  const verdicts = list.map((c) => judge(w.custody[c.ref], t))
  const ok = verdicts.filter((v) => v.tone === 'ok').length, bad = verdicts.filter((v) => v.tone === 'bad').length
  const kgOk = list.filter((_, i) => verdicts[i].tone === 'ok').reduce((a, c) => a + c.kg, 0)
  return (
    <Page title="Recycling proof" sub="Did the load reach the recycler, or the port or incinerator?">
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Loads audited" value={list.length} icon={<FileBadge size={15} />} />
        <Kpi label="Verified recycled" value={ok} tone="good" sub={`${kgOk} kg proven`} />
        <Kpi label="Chain broken" value={bad} tone={bad ? 'bad' : 'good'} sub={bad ? 'no receipt at recycler' : 'none'} />
        <Kpi label="Proof rate" value={list.length ? `${Math.round((ok / Math.max(1, ok + bad)) * 100)}%` : '–'} sub="of finished loads" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">{list.map((c) => <Chain key={c.ref} c={c} />)}</div>
    </Page>
  )
}
