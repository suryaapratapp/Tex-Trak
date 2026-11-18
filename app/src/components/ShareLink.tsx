import { useEffect, useState } from 'react'
import { Copy, Mail, Send } from 'lucide-react'
import { toast } from '../lib/toast'
import { linkFor, notifyShipment } from '../lib/shipLink'
import { btnGhost, btnPrimary, inputCls } from '../qr/ui'

/** The link the customer opens, with no sign-in: email it, copy it, or send it from a mail app. */
export function ShareLink({ id, token, refText, customerName }: { id: string; token: string; refText: string; customerName?: string }) {
  const link = linkFor(token); const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { let off = false; void notifyShipment(id).then((r) => { if (!off && r.email) setEmail(r.email) }); return () => { off = true } }, [id])
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast.ok('Link copied.') } catch { window.prompt('Copy this link', link) } }
  const send = async () => { setBusy(true); const r = await notifyShipment(id, { send: true, email }); setBusy(false); if (r.sent) toast.ok(`Email sent to ${r.email}.`); else toast.error(r.error ?? 'The email could not be sent.') }
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Your delivery ${refText}`)}&body=${encodeURIComponent(`Hello${customerName ? ' ' + customerName : ''},\n\nYou can follow your delivery ${refText} live, and confirm it when it arrives, here (no sign-in needed):\n${link}\n`)}`
  return (
    <div className="mt-4 rounded-2xl border border-stone-100 bg-stone-50/70 p-4">
      <div className="text-[12px] font-bold uppercase tracking-wider text-stone-400">Customer link (no sign-in)</div>
      <p className="text-[13px] text-stone-500">{customerName ? `${customerName} can` : 'Your customer can'} follow this delivery live and confirm it with this link.</p>
      <div className="mt-2 flex flex-wrap gap-2"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" placeholder="Customer email" aria-label="Customer email" className={`${inputCls} !h-11 min-w-[14rem] flex-1`} />
        <button disabled={busy || !email.trim()} onClick={() => void send()} className={`${btnPrimary} flex items-center gap-2 !px-4 !py-2.5`}><Send size={16} />{busy ? 'Sending…' : 'Email link'}</button></div>
      <div className="mt-2 flex flex-wrap gap-2"><button onClick={() => void copy()} className={`${btnGhost} flex items-center gap-2 !px-4 !py-2`}><Copy size={15} />Copy link</button><a href={mailto} className={`${btnGhost} flex items-center gap-2 !px-4 !py-2`}><Mail size={15} />Open in mail app</a></div>
    </div>)
}
