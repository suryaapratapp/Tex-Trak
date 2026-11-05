import { useMemo } from 'react'
import { getWorld } from '../sim/engine'
import { PLANS, ZONE_NAME, type XY } from '../sim/world'
import { useSnap } from '../sim/snap'
import { useStore } from '../store'
import { STATUS_COLOR } from './ui'

const frac = (n: number, k: number) => (n * k) % 1
function polyAt(pts: XY[], f: number): XY {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]))
  const tot = seg.reduce((a, b) => a + b, 0) || 1
  let d = f * tot
  for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const g = d / (seg[i] || 1); return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * g, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * g] }; d -= seg[i] }
  return pts[pts.length - 1]
}

export function FloorPlan({ planId }: { planId: 'H' | 'D' }) {
  const plan = PLANS[planId]; const snap = useSnap(); const t = snap.t; const w = getWorld()
  const { selItem, set } = useStore()
  const zoneCount = useMemo(() => { const m: Record<string, number> = {}; snap.loc.forEach((l) => { if (l.kind !== 'vehicle' && l.plan === planId && l.zone) m[l.zone] = (m[l.zone] ?? 0) + 1 }); return m }, [snap, planId])
  const v1 = snap.veh.V1
  const truckHere = (planId === 'H' && v1.atSite === 'HOSP') || (planId === 'D' && v1.atSite === 'DECON')
  const ready = (rid: string) => (w.readerEvents[rid] ?? []).some((x) => x <= t && x > t - 1.6)
  const cageBox = (cage: string) => (cage === 'RC-201' ? { x: 462, y: 420, w: 76, h: 118 } : { x: 542, y: 420, w: 76, h: 118 })

  const dots = w.items.map((it) => {
    const l = snap.loc[it.id]
    if (l.kind === 'vehicle') return null
    if (l.kind === 'moving') { if (l.plan !== planId) return null; const [x, y] = polyAt(l.pts!, Math.min(1, l.f!)); return { it, x, y, status: l.status, moving: true } }
    if (l.plan !== planId) return null
    const z = plan.zones.find((q) => q.id === l.zone); if (!z) return null
    let bx = z.x + 12, by = z.y + 34, bw = z.w - 24, bh = z.h - 46
    if (planId === 'H' && z.id === 'DIRTY') { const c = cageBox(it.cageOut); bx = c.x + 8; by = c.y + 12; bw = c.w - 16; bh = c.h - 22 }
    if (z.outside) { bx = z.x + 6; by = z.y + 6; bw = z.w - 12; bh = z.h - 12 }
    return { it, x: bx + frac(it.id + 1, 0.618034) * bw, y: by + frac(it.id + 1, 0.754878) * bh, status: l.status, moving: false }
  }).filter(Boolean) as { it: (typeof w.items)[0]; x: number; y: number; status: string; moving: boolean }[]

  return (
    <svg viewBox={`0 0 ${plan.w} ${plan.h}`} className="w-full rounded-xl bg-[#f7fafc]" style={{ maxHeight: planId === 'H' ? 640 : 420 }}>
      <defs>
        <pattern id={`g${planId}`} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#e6edf4" strokeWidth="1" /></pattern>
        <radialGradient id="rg"><stop offset="0" stopColor="#06b6d4" stopOpacity=".35" /><stop offset="1" stopColor="#06b6d4" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width={plan.w} height={plan.h} fill={`url(#g${planId})`} />
      {plan.corridor && <rect {...plan.corridor} fill="#eef3f8" stroke="#b8c6d6" strokeWidth="1.5" strokeDasharray="6 5" />}
      {plan.corridor && <text x={plan.corridor.x + 8} y={plan.corridor.y + 34} fontSize="12" fill="#8aa0b6" letterSpacing="3">MAIN CORRIDOR</text>}
      {planId === 'D' && <>
        <rect x="80" y="60" width="540" height="240" fill="#fff1f2" opacity=".55" /><rect x="630" y="60" width="480" height="240" fill="#ecfdf5" opacity=".65" />
        <text x="90" y="332" fontSize="12" fontWeight="600" fill="#be123c" letterSpacing="2">DIRTY SIDE (soiled-linen handling)</text><text x="640" y="332" fontSize="12" fontWeight="600" fill="#047857" letterSpacing="2">CLEAN SIDE (post-barrier)</text>
        <line x1="625" y1="40" x2="625" y2="320" stroke="#0b1f33" strokeWidth="3" strokeDasharray="10 6" />
      </>}
      {plan.zones.map((z) => (
        <g key={z.id}>
          <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={z.outside ? 6 : 3} fill={z.outside ? '#f1f5f9' : z.kind === 'dirty' ? (planId === 'H' ? '#faf5ff' : 'transparent') : z.kind === 'dock' ? '#eff6ff' : '#fff'} stroke={z.outside ? '#cbd5e1' : '#0b1f33'} strokeWidth={z.outside ? 1.5 : 3} strokeDasharray={z.outside ? '4 4' : undefined} />
          <text x={z.x + 10} y={z.y + 20} fontSize={z.outside ? 10 : 13} fontWeight="600" fill="#0f2236">{z.name.length > 24 && z.w < 200 ? z.name.slice(0, 22) + '…' : z.name}</text>
          {!z.outside && <text x={z.x + z.w - 10} y={z.y + 20} fontSize="12" fontWeight="700" textAnchor="end" fill="#0891b2">{zoneCount[z.id] ?? 0}</text>}
          {z.outside && <text x={z.x + 6} y={z.y + z.h - 6} fontSize="10" fontWeight="700" fill="#0891b2">{zoneCount[z.id] ?? 0}</text>}
          {z.door && planId === 'H' && <rect x={z.door[0] - 16} y={z.door[1] - 3} width="32" height="6" fill="#f7fafc" />}
          {z.door && planId === 'D' && <rect x={z.door[0] - 3} y={z.door[1] - 14} width="6" height="28" fill="#f7fafc" />}
        </g>
      ))}
      {planId === 'H' && <>
        <rect x="100" y="470" width="0" height="0" />
        <rect x="97" y="456" width="6" height="28" fill="#f7fafc" />
        <rect x="1069" y="305" width="6" height="30" fill="#f7fafc" />
        {(['RC-201', 'RC-202'] as const).map((c) => { const b = cageBox(c); const n = snap.loc.filter((l, i) => l.kind === 'zone' && l.zone === 'DIRTY' && w.items[i].cageOut === c).length
          return <g key={c}><rect x={b.x} y={b.y} width={b.w} height={b.h} rx="4" fill="#fff" stroke="#7c3aed" strokeWidth="2" strokeDasharray="5 3" /><text x={b.x + b.w / 2} y={b.y - 6} fontSize="11" fontWeight="700" textAnchor="middle" fill="#6d28d9">{c} · {n}</text></g> })}
      </>}
      {truckHere && <g transform={planId === 'H' ? 'translate(2,452)' : 'translate(4,150)'}><rect width="52" height="26" rx="4" fill="#0ea5e9" /><rect x="40" y="4" width="12" height="12" fill="#e0f2fe" /><circle cx="12" cy="27" r="4" fill="#0b1f33" /><circle cx="40" cy="27" r="4" fill="#0b1f33" /><text x="20" y="17" fontSize="9" fontWeight="700" fill="#fff" textAnchor="middle">KB</text></g>}
      {plan.readers.map((r) => { const on = ready(r.id); return (
        <g key={r.id}>
          {on && <circle cx={r.at[0]} cy={r.at[1]} r="26" fill="url(#rg)" className="pulse-ring" />}
          <circle cx={r.at[0]} cy={r.at[1]} r="11" fill="#fff" stroke={on ? '#06b6d4' : '#0b1f33'} strokeWidth="2.5" />
          <path d={`M${r.at[0] - 5} ${r.at[1] + 1}a6 6 0 0 1 10 0M${r.at[0] - 2.8} ${r.at[1] + 3.4}a3.4 3.4 0 0 1 5.6 0`} fill="none" stroke={on ? '#06b6d4' : '#0b1f33'} strokeWidth="1.6" strokeLinecap="round" />
          <text x={r.at[0]} y={r.at[1] - 16} fontSize="9" fontWeight="600" textAnchor="middle" fill="#475569">{r.id}</text>
        </g>) })}
      {dots.map(({ it, x, y, status, moving }) => (
        <g key={it.id} onClick={() => set({ selItem: it.id })} className="cursor-pointer">
          {selItem === it.id && <circle cx={x} cy={y} r="9" fill="none" stroke="#0b1f33" strokeWidth="2" />}
          <circle cx={x} cy={y} r={moving ? 5 : 4} fill={STATUS_COLOR[status]} stroke="#fff" strokeWidth="1.2" style={{ transition: 'cx .1s linear, cy .1s linear' }}><title>{it.type.name} · {it.qr} · {status}</title></circle>
        </g>
      ))}
      <title>{ZONE_NAME[plan.zones[0].id]}</title>
    </svg>
  )
}
