import type { ReactNode } from 'react'
import type { Sev } from '../sim/world'

export const SEV_STYLE: Record<Sev, string> = {
  info: 'bg-sky-50 text-sky-700 ring-sky-200', low: 'bg-slate-100 text-slate-700 ring-slate-200', medium: 'bg-amber-50 text-amber-800 ring-amber-200',
  high: 'bg-orange-50 text-orange-800 ring-orange-300', critical: 'bg-rose-50 text-rose-700 ring-rose-300',
}
export const SEV_DOT: Record<Sev, string> = { info: '#38bdf8', low: '#94a3b8', medium: '#f59e0b', high: '#f97316', critical: '#e11d48' }
export const SevBadge = ({ sev }: { sev: Sev }) => <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${SEV_STYLE[sev]}`}><i className="h-1.5 w-1.5 rounded-full" style={{ background: SEV_DOT[sev] }} />{sev}</span>

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={`card ${className}`}>{children}</div>
export const CardHead = ({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) => (
  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
    <div><h3 className="text-[16px] font-extrabold tracking-tight text-slate-900">{title}</h3>{sub && <p className="mt-1 text-[13.5px] text-slate-500">{sub}</p>}</div>{right}
  </div>
)
export const Kpi = ({ label, value, sub, tone = 'default', icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'good' | 'bad' | 'warn'; icon?: ReactNode }) => {
  const c = { default: 'text-slate-900', good: 'text-emerald-600', bad: 'text-rose-600', warn: 'text-amber-600' }[tone]
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between text-[12px] font-bold uppercase tracking-wider text-slate-500">{label}<span className="text-slate-400">{icon}</span></div>
      <div className={`mt-3 text-[32px] font-extrabold leading-none tracking-tight ${c}`}>{value}</div>
      {sub && <div className="mt-2 text-[13px] text-slate-500">{sub}</div>}
    </div>
  )
}
export const Chip = ({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue' | 'cyan' | 'violet' }) => {
  const m = { slate: 'bg-slate-100 text-slate-700', green: 'bg-emerald-50 text-emerald-700', red: 'bg-rose-50 text-rose-700', amber: 'bg-amber-50 text-amber-800', blue: 'bg-blue-50 text-blue-700', cyan: 'bg-cyan-50 text-cyan-800', violet: 'bg-violet-50 text-violet-700' }[tone]
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${m}`}>{children}</span>
}
export const Bar = ({ v, color = '#1c1917', h = 6 }: { v: number; color?: string; h?: number }) => (
  <div className="w-full overflow-hidden rounded-full bg-slate-100" style={{ height: h }}><div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, background: color }} /></div>
)
export const Page = ({ title, sub, right, demo, children }: { title: string; sub?: string; right?: ReactNode; demo?: boolean; children: ReactNode }) => (
  <div className="mx-auto w-full max-w-[1500px] p-5 sm:p-8">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-[30px] font-extrabold tracking-tight text-slate-900">{title}{demo && <span title="This page shows a built-in example day. Live data from readers and scans is not connected yet." className="ml-3 inline-block translate-y-[-4px] rounded-full bg-amber-50 px-3 py-1 align-middle text-[12px] font-medium text-amber-800 ring-1 ring-amber-200">Demo data</span>}</h1>{sub && <p className="mt-1.5 max-w-3xl text-[15.5px] leading-snug text-slate-500">{sub}</p>}</div>{right}
    </div>{children}
  </div>
)
export const STATUS_COLOR: Record<string, string> = { clean: '#10b981', in_stock: '#0ea5e9', in_use: '#3b82f6', soiled: '#f59e0b', in_cage: '#a855f7', in_transit: '#6366f1', processing: '#ec4899', missing: '#e11d48' }
export const STATUS_LABEL: Record<string, string> = { clean: 'Clean', in_stock: 'In stock', in_use: 'In use', soiled: 'Soiled', in_cage: 'In dirty cage', in_transit: 'In transit', processing: 'Processing', missing: 'Missing' }
export const StatusPill = ({ s }: { s: string }) => <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200"><i className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[s] ?? '#94a3b8' }} />{STATUS_LABEL[s] ?? s}</span>
export const SrcChip = ({ s }: { s: string }) => <Chip tone={s === 'RFID' ? 'violet' : s === 'QR' ? 'blue' : s === 'GNSS' ? 'cyan' : 'slate'}>{s}</Chip>
