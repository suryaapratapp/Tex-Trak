import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { isNative, kvGet, kvSet } from '../lib/offline'
import { giveConsent, startTracking } from '../native/tracking'
import { btnGhost, btnPrimary } from '../qr/ui'

/** On a computer's browser: ask once whether this browser may share its location while Tex-Trak is open. */
export function WebLocationPrompt() {
  const user = useAuth((s) => s.user); const [show, setShow] = useState(false)
  useEffect(() => { if (isNative || !user || user.role === 'superadmin') return; void kvGet<string>(`web-location:${user.id}`).then((d) => setShow(!d)) }, [user])
  if (!show || !user) return null
  const answer = async (yes: boolean) => { await kvSet(`web-location:${user.id}`, yes ? 'yes' : 'no'); setShow(false); if (yes) { await giveConsent(user.id); await startTracking(user) } }
  return (
    <div className="fixed bottom-4 right-4 z-[80] w-[min(380px,calc(100vw-2rem))] rounded-xl border border-stone-200 bg-white p-5 shadow-xl">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-700"><MapPin size={20} /></span>
        <div><div className="text-[15.5px] font-semibold text-stone-900">Share this browser&rsquo;s location?</div><p className="mt-1 text-[13.5px] leading-relaxed text-stone-600">While Tex-Trak is open, your administrator can see where this browser is. It stops when you sign out or close the page. For tracking with the screen locked, use the Android app.</p></div></div>
      <div className="mt-4 flex gap-2"><button onClick={() => void answer(true)} className={`${btnPrimary} flex-1 !py-2.5`}>Allow</button><button onClick={() => void answer(false)} className={`${btnGhost} flex-1 !py-2.5`}>Not now</button></div></div>)
}
