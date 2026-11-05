import { UPPER } from '../sim/floors'
import { useSnap } from '../sim/snap'

/** Floors 1-3: ward layout and ceiling RFID readers at the lift, stairs and ward doors. */
export function UpperFloor({ floor }: { floor: '1' | '2' | '3' }) {
  const f = UPPER[floor]; const t = useSnap().t
  const pulse = (i: number) => Math.floor(t / 7 + i) % 5 === 0
  return (
    <svg viewBox="0 0 1140 620" className="w-full rounded-xl bg-[#f7f9fc]" style={{ maxHeight: 640 }}>
      <defs><pattern id={`gu${floor}`} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#e6edf6" strokeWidth="1" /></pattern></defs>
      <rect width="1140" height="620" fill={`url(#gu${floor})`} />
      <rect x="100" y="290" width="920" height="60" fill="#eef3f8" stroke="#b8c6d6" strokeWidth="1.5" strokeDasharray="6 5" />
      <text x="620" y="326" fontSize="12" fill="#8aa0b6" letterSpacing="3">CORRIDOR</text>
      {f.zones.map((z) => {
        return (
          <g key={z.id}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="3" fill={z.ward ? '#fff' : '#fafbfd'} stroke="#0b1b33" strokeWidth="3" />
            <text x={z.x + 12} y={z.y + 24} fontSize="14" fontWeight="700" fill="#0b1b33">{z.name}</text>
            <rect x={z.door[0] - 16} y={z.door[1] - 3} width="32" height="6" fill="#f7f9fc" />
          </g>)
      })}
      <g><rect x="548" y="296" width="44" height="48" rx="6" fill="#dbe7ff" stroke="#2f6fed" strokeWidth="2" /><text x="570" y="326" fontSize="11" fontWeight="800" textAnchor="middle" fill="#1d4ed8">LIFT</text></g>
      {f.stair.map((s, i) => <g key={i}><rect x={s[0] - (i ? 0 : 0)} y="296" width="0" height="0" /><text x={i ? 1030 : 70} y="326" fontSize="11" fontWeight="800" fill="#62758f">STAIRS</text></g>)}
      {f.readers.map((r, i) => (
        <g key={r.id}>
          {pulse(i) && <circle cx={r.at[0]} cy={r.at[1]} r="26" fill="#ea580c" opacity=".22" className="pulse-ring" />}
          <circle cx={r.at[0]} cy={r.at[1]} r="11" fill="#fff" stroke="#0b1b33" strokeWidth="2.5" />
          <path d={`M${r.at[0] - 5} ${r.at[1] + 1}a6 6 0 0 1 10 0M${r.at[0] - 2.8} ${r.at[1] + 3.4}a3.4 3.4 0 0 1 5.6 0`} fill="none" stroke="#0b1b33" strokeWidth="1.6" strokeLinecap="round" />
          <text x={r.at[0]} y={r.at[1] - 16} fontSize="9" fontWeight="600" textAnchor="middle" fill="#475569">{r.id}</text>
        </g>))}
    </svg>)
}
