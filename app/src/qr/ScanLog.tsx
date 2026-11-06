import { CheckCircle2, Clock3, XCircle } from 'lucide-react'
import { useQr, fmtDateTime, type OpKind } from './store'

const STATE = {
  pending: { icon: <Clock3 size={17} className="text-amber-600" />, label: 'Waiting to send', cls: 'bg-amber-50 text-amber-800' },
  sent: { icon: <CheckCircle2 size={17} className="text-emerald-600" />, label: 'Saved', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { icon: <XCircle size={17} className="text-rose-600" />, label: 'Not saved', cls: 'bg-rose-50 text-rose-700' },
}
/** Every scan this phone has recorded, with whether it has reached the server. */
export function ScanLog({ kinds, title = 'Recorded scans', limit = 8 }: { kinds?: OpKind[]; title?: string; limit?: number }) {
  const { log, retryOp, discardOp } = useQr(); const list = log.filter((l) => !kinds || kinds.includes(l.kind)).slice(0, limit)
  if (!list.length) return null
  return (
    <section className="card overflow-hidden"><div className="border-b border-stone-100 px-6 py-4 text-[16px] font-semibold text-stone-900">{title}</div>
      <ul className="divide-y divide-stone-100">{list.map((l) => (
        <li key={l.id} className="flex items-start gap-3 px-6 py-3.5"><span className="mt-0.5">{STATE[l.state].icon}</span>
          <div className="min-w-0 flex-1"><div className="text-[14.5px] font-medium text-stone-900">{l.text}</div>
            {l.message && <div className="mt-0.5 text-[13.5px] font-medium text-rose-600">{l.message}</div>}
            <div className="mt-0.5 text-[12.5px] text-stone-400">{fmtDateTime(l.ts)}</div>
            {l.state === 'failed' && <div className="mt-2 flex gap-3 text-[13px] font-medium"><button onClick={() => retryOp(l.id)} className="text-cyan-700 hover:underline">Try again</button><button onClick={() => void discardOp(l.id)} className="text-stone-500 hover:underline">Remove</button></div>}</div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${STATE[l.state].cls}`}>{STATE[l.state].label}</span></li>))}</ul></section>)
}
