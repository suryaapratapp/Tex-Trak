import { useEffect, useState } from 'react'
import { Copy, Eye, FileText } from 'lucide-react'
import { toast } from '../lib/toast'
import { linkFor, notifyShipment, type NotifyResult } from '../lib/shipLink'

/** The link the customer opens, with no sign-in. Copy the link, or copy a finished, designed email to paste into any mail app. */
export function ShareLink({ id, token }: { id: string; token: string }) {
  const link = linkFor(token); const [mail, setMail] = useState<NotifyResult | null>(null); const [view, setView] = useState(false)
  useEffect(() => { let off = false; void notifyShipment(id).then((r) => { if (!off) setMail(r) }); return () => { off = true } }, [id])
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast.ok('Link copied.') } catch { window.prompt('Copy this link', link) } }
  const copyRich = async () => {
    if (!mail?.html) return toast.error('The email is not ready yet. Try again in a moment.')
    try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([mail.html], { type: 'text/html' }), 'text/plain': new Blob([mail.text ?? ''], { type: 'text/plain' }) })]); toast.ok('Email copied. Paste it into a new email.') }
    catch { toast.error('This browser cannot copy a formatted email. Use Copy link.') }
  }
  const btn = 'flex w-full items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-[14.5px] font-bold text-stone-700 hover:bg-stone-50 sm:w-auto'
  return (
    <div className="mt-4 rounded-2xl border border-stone-100 bg-stone-50/70 p-4">
      <div className="text-[15px] font-bold text-stone-900">Customer link</div>
      <p className="text-[13.5px] text-stone-500">Opens with no sign-in. They follow the delivery live and confirm it.</p>
      <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
        <button onClick={() => void copy()} className={btn}><Copy size={16} />Copy link</button>
        <button onClick={() => void copyRich()} className={btn}><FileText size={16} />Copy formatted email</button>
        <button onClick={() => setView(!view)} className={btn}><Eye size={16} />{view ? 'Hide preview' : 'Preview email'}</button>
      </div>
      {view && (mail?.html ? <iframe title="Email preview" srcDoc={mail.html} sandbox="" className="mt-3 h-[70vh] min-h-[420px] w-full rounded-2xl border border-stone-200 bg-white" /> : <p className="mt-3 text-[13.5px] text-stone-400">Preparing the email…</p>)}
    </div>)
}
