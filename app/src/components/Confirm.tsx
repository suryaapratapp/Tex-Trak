import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

/** Asks the user to confirm before something is removed. Resolves true only if they press the confirm button. */
interface Ask { title: string; body?: string; confirm?: string; tone?: 'danger' | 'normal'; reason?: string }
type Pending = Ask & { done: (ok: boolean, text?: string) => void }

let show: ((p: Pending) => void) | null = null

export function askConfirm(a: Ask): Promise<boolean> {
  return new Promise((done) => { if (show) show({ ...a, done }); else done(window.confirm(`${a.title}${a.body ? `\n\n${a.body}` : ''}`)) })
}

/** Like askConfirm, with a box for the reason. Resolves to the reason (maybe empty) or null if cancelled. */
export function askReason(a: Omit<Ask, 'reason'> & { placeholder?: string }): Promise<string | null> {
  return new Promise((res) => { if (show) show({ ...a, reason: a.placeholder ?? 'Reason', done: (ok, text) => res(ok ? (text ?? '') : null) }); else { const t = window.prompt(`${a.title}\n\n${a.body ?? ''}`); res(t) } })
}

/** Shorthand: "Remove X? Detail." becomes a title and a line of detail. */
export function ask(msg: string, confirm = 'Delete'): Promise<boolean> {
  const i = msg.indexOf('? '); return askConfirm(i > 0 ? { title: msg.slice(0, i + 1), body: msg.slice(i + 2), confirm } : { title: msg, confirm })
}

export function ConfirmHost() {
  const [p, setP] = useState<Pending | null>(null); const [why, setWhy] = useState('')
  useEffect(() => { show = (x) => { setWhy(''); setP(x) }; return () => { show = null } }, [])
  useEffect(() => {
    if (!p) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false) }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p])
  const close = (ok: boolean) => { p?.done(ok, why.trim()); setP(null) }
  if (!p) return null
  const danger = p.tone !== 'normal'
  return (
    <div className="fixed inset-0 z-[3000] grid place-items-center bg-stone-900/45 p-4 backdrop-blur-[2px]" onClick={() => close(false)} role="presentation">
      <div role="alertdialog" aria-modal="true" aria-labelledby="cf-t" className="w-full max-w-[420px] rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-4">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${danger ? 'bg-rose-50 text-rose-600' : 'bg-violet-50 text-violet-600'}`}><AlertTriangle size={22} /></span>
          <div className="min-w-0"><h2 id="cf-t" className="text-[17px] font-extrabold text-stone-900">{p.title}</h2>{p.body && <p className="mt-1.5 text-[14px] leading-relaxed text-stone-500">{p.body}</p>}
            {p.reason !== undefined && <input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={200} placeholder={p.reason} aria-label="Reason" className="mt-3 h-11 w-full rounded-xl border border-stone-200 px-3 text-[14px] outline-none focus:border-violet-400" />}</div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button autoFocus={p.reason === undefined} onClick={() => close(false)} className="rounded-2xl border border-stone-200 px-5 py-2.5 text-[14.5px] font-bold text-stone-700 hover:bg-stone-50">Keep it</button>
          <button onClick={() => close(true)} className={`rounded-2xl px-5 py-2.5 text-[14.5px] font-bold text-white ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-violet-600 hover:bg-violet-700'}`}>{p.confirm ?? 'Delete'}</button>
        </div>
      </div>
    </div>
  )
}
