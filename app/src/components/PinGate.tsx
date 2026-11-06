import { useState } from 'react'
import { Delete, Lock } from 'lucide-react'
import { Logo } from './Logo'
import { useAuth } from '../lib/auth'
import { checkPin, removePin, useLock } from '../lib/pin'

/** Quick PIN lock. The phone stays signed in, so this also works with no connection. */
export function PinGate() {
  const { locked, unlock } = useLock(); const user = useAuth((s) => s.user); const signOut = useAuth((s) => s.signOut)
  const [pin, setPin] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  if (!locked || !user) return null
  const press = async (d: string) => {
    if (busy) return; const next = (pin + d).slice(0, 6); setPin(next); setErr('')
    if (next.length < 4) return
    // try as soon as 4+ digits match
    setBusy(true); const r = await checkPin(user.id, next); setBusy(false)
    if (r === 'ok') { setPin(''); unlock() } else if (r === 'locked-out') { removePin(); setPin(''); await signOut() } else if (next.length === 6) { setPin(''); setErr('That PIN is not right.') }
  }
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-gradient-to-br from-cyan-50 via-white to-stone-100 p-6">
      <div className="w-full max-w-[320px] text-center">
        <div className="mx-auto mb-5 flex items-center justify-center gap-3"><Logo size={40} /><span className="text-[20px] font-semibold text-stone-900">Tex-Trak</span></div>
        <div className="mb-1 flex items-center justify-center gap-2 text-[16px] font-medium text-stone-800"><Lock size={16} /> Welcome back, {user.full_name.split(' ')[0]}</div>
        <p className="mb-5 text-[14px] text-stone-500">Enter your PIN to continue. No connection needed.</p>
        <div className="mb-3 flex justify-center gap-3">{Array.from({ length: 6 }, (_, i) => <i key={i} className={`h-3.5 w-3.5 rounded-full ${i < pin.length ? 'bg-cyan-600' : 'bg-stone-200'}`} />)}</div>
        <div className="h-5 text-[13.5px] font-medium text-rose-600">{err}</div>
        <div className="mt-3 grid grid-cols-3 gap-3">{['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => void press(d)} className="h-16 rounded-xl bg-white text-[24px] font-medium text-stone-900 shadow-sm active:bg-stone-100">{d}</button>)}
          <button onClick={() => { setPin(''); setErr('') }} className="h-16 rounded-xl text-[13px] font-medium text-stone-500">Clear</button><button onClick={() => void press('0')} className="h-16 rounded-xl bg-white text-[24px] font-medium text-stone-900 shadow-sm active:bg-stone-100">0</button><button onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete" className="grid h-16 place-items-center rounded-xl text-stone-500"><Delete size={22} /></button></div>
        <button onClick={() => { if (confirm('Signing out needs an internet connection to sign back in. Saved scans that have not been sent will stay on this phone. Continue?')) { removePin(); void signOut() } }} className="mt-6 text-[13.5px] font-medium text-stone-500 hover:text-stone-800">Forgot your PIN? Sign in again</button>
      </div></div>)
}
