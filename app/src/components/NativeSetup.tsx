import { useEffect, useState } from 'react'
import { MapPin, ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { isNative, kvGet, kvSet } from '../lib/offline'
import { hasPin, setPin } from '../lib/pin'
import { giveConsent, startTracking } from '../native/tracking'
import { btnPrimary, btnGhost, inputCls } from '../qr/ui'

/** First sign-in on a phone: explain location recording plainly, ask for permission, and offer a quick PIN. */
export function NativeSetup() {
  const user = useAuth((s) => s.user); const [step, setStep] = useState<0 | 1 | 2>(0); const [show, setShow] = useState(false); const [pin, setP] = useState(''); const [err, setErr] = useState('')
  useEffect(() => { if (!isNative || !user) return; void kvGet<boolean>(`setup-done:${user.id}`).then((d) => setShow(!d)) }, [user])
  if (!show || !user) return null
  const done = async () => { await kvSet(`setup-done:${user.id}`, true); setShow(false) }
  const allow = async () => { await giveConsent(user.id); await startTracking(user); setStep(1) }
  const savePin = async () => { if (!/^\d{4,6}$/.test(pin)) return setErr('Use 4 to 6 digits.'); await setPin(user.id, pin); await done() }
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-white p-6">
      <div className="w-full max-w-[420px]">
        {step === 0 && <>
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"><MapPin size={28} /></span>
          <h1 className="mt-5 text-[26px] font-semibold tracking-tight text-stone-900">Share your location</h1>
          <p className="mt-3 text-[15.5px] leading-relaxed text-stone-600">While you are signed in, Tex-Trak records where this phone is, <b>including when the screen is off</b>, so your team can see that work is on track and where it is happening.</p>
          <ul className="mt-4 space-y-2 text-[14.5px] text-stone-600"><li>• A notification stays on screen while it is recording.</li><li>• It stops when you sign out.</li><li>• Your administrator can see the phone&rsquo;s name (your username) and its movement.</li></ul>
          <div className="mt-7 space-y-3"><button onClick={() => void allow()} className={`${btnPrimary} w-full`}>Allow location</button><button onClick={() => setStep(1)} className={`${btnGhost} w-full`}>Not now</button></div>
          <p className="mt-4 text-[12.5px] text-stone-400">On the next screens, choose &ldquo;While using the app&rdquo; or &ldquo;Allow&rdquo;. For the best tracking, set battery use for Tex-Trak to &ldquo;Unrestricted&rdquo; in Android settings.</p></>}
        {step === 1 && <>
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"><ShieldCheck size={28} /></span>
          <h1 className="mt-5 text-[26px] font-semibold tracking-tight text-stone-900">Set a quick PIN</h1>
          <p className="mt-3 text-[15.5px] leading-relaxed text-stone-600">A PIN opens the app fast, even with no signal, and keeps it private if the phone is lost. You stay signed in.</p>
          <input value={pin} onChange={(e) => { setP(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr('') }} inputMode="numeric" type="password" placeholder="4 to 6 digits" className={`${inputCls} mt-5 text-center text-[22px] tracking-[0.4em]`} />
          {err && <p className="mt-2 text-[13.5px] font-medium text-rose-600">{err}</p>}
          <div className="mt-6 space-y-3"><button disabled={pin.length < 4} onClick={() => void savePin()} className={`${btnPrimary} w-full`}>Save PIN</button><button onClick={() => void done()} className={`${btnGhost} w-full`}>Skip for now</button></div></>}
        {step === 2 && null}
        <span hidden>{String(hasPin(user.id))}</span>
      </div></div>)
}
