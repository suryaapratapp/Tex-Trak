import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import { useToasts } from '../lib/toast'

const STYLE = { ok: 'border-emerald-200 text-emerald-900', error: 'border-rose-200 text-rose-900', info: 'border-sky-200 text-sky-900' }
const ICON = { ok: <CheckCircle2 size={19} className="text-emerald-600" />, error: <CircleAlert size={19} className="text-rose-600" />, info: <Info size={19} className="text-sky-600" /> }

export function Toasts() {
  const { items, drop } = useToasts()
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-2 top-2 z-[3500] flex w-[min(380px,calc(100vw-16px))] flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={`toast-in pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 text-[14px] font-semibold shadow-xl ${STYLE[t.kind]}`}>
          <span className="mt-0.5 shrink-0">{ICON[t.kind]}</span><span className="min-w-0 flex-1 break-words">{t.text}</span>
          <button onClick={() => drop(t.id)} aria-label="Dismiss" className="shrink-0 text-stone-400 hover:text-stone-700"><X size={16} /></button>
        </div>))}
    </div>)
}
