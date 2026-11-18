import { useEffect, useState } from 'react'
import { Copy, Eye, Mail, Send } from 'lucide-react'
import { toast } from '../lib/toast'
import { linkFor, notifyShipment, type NotifyResult } from '../lib/shipLink'
import { btnGhost, btnPrimary, inputCls } from '../qr/ui'

/** The link the customer opens, with no sign-in: email it, copy it, or send a finished email from a mail app. */
export function ShareLink({ id, token, refText, customerName }: { id: string; token: string; refText: string; customerName?: string }) {
  const link = linkFor(token); const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [mail, setMail] = useState<NotifyResult | null>(null); const [view, setView] = useState(false)
  useEffect(() => { let off = false; void notifyShipment(id).then((r) => { if (!off) { setMail(r); if (r.email) setEmail((e) => e || r.email!) } }); return () => { off = true } }, [id])
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast.ok('Link copied.') } catch { window.prompt('Copy this link', link) } }
  const copyRich = async () => {
    if (!mail?.html) return toast.error('The email is not ready yet. Try again in a moment.')
    try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([mail.html], { type: 'text/html' }), 'text/plain': new Blob([mail.text ?? ''], { type: 'text/plain' }) })]); toast.ok('Formatted email copied. Paste it into a new email.') }
    catch { toast.error('Your browser cannot copy a formatted email. Use "Open in mail app" instead.') }
  }
  const send = async () => { setBusy(true); const r = await notifyShipment(id, { send: true, email }); setBusy(false); if (r.sent) toast.ok(`Email sent to ${r.email}.`); else toast.error(r.error ?? 'The email could not be sent.') }
  const to = encodeURIComponent(email); const subject = encodeURIComponent(mail?.subject ?? `Your delivery ${refText}`)
  const body = encodeURIComponent(mail?.text ?? `Hello${customerName ? ' ' + customerName : ''},\n\nYou can follow your delivery ${refText} live, and confirm it when it arrives, here (no sign-in needed):\n${link}\n`)
  const mailto = `mailto:${to}?subject=${subject}&body=${body}`
  return (
    <div className="mt-4 rounded-2xl border border-stone-100 bg-stone-50/70 p-4">
      <div className="text-[12px] font-bold uppercase tracking-wider text-stone-400">Customer link (no sign-in)</div>
      <p className="text-[13px] text-stone-500">{mail?.receiver && mail.receiver !== 'there' ? `${mail.receiver}` : customerName ? customerName : 'Your customer'} can follow this delivery live and confirm it with this link. The email names you ({mail?.senderPerson || 'the sender'}) and {mail?.receiver && mail.receiver !== 'there' ? mail.receiver : 'the customer'}, and lists the addresses, items and expected time.</p>
      <div className="mt-2 flex flex-wrap gap-2"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" placeholder="Customer email" aria-label="Customer email" className={`${inputCls} !h-11 min-w-[14rem] flex-1`} />
        <button disabled={busy || !email.trim()} onClick={() => void send()} className={`${btnPrimary} flex items-center gap-2 !px-4 !py-2.5`}><Send size={16} />{busy ? 'Sending…' : 'Email it'}</button></div>
      <div className="mt-2 flex flex-wrap gap-2"><a href={mailto} className={`${btnGhost} flex items-center gap-2 !px-4 !py-2`}><Mail size={15} />Open in mail app</a><button onClick={() => void copyRich()} className={`${btnGhost} flex items-center gap-2 !px-4 !py-2`}><Copy size={15} />Copy formatted email</button><button onClick={() => void copy()} className={`${btnGhost} flex items-center gap-2 !px-4 !py-2`}><Copy size={15} />Copy link</button>
        <button onClick={() => setView(!view)} className={`${btnGhost} flex items-center gap-2 !px-4 !py-2`}><Eye size={15} />{view ? 'Hide preview' : 'Preview email'}</button></div>
      {view && mail?.html && <iframe title="Email preview" srcDoc={mail.html} sandbox="" className="mt-3 h-[560px] w-full rounded-2xl border border-stone-200 bg-white" />}
    </div>)
}
