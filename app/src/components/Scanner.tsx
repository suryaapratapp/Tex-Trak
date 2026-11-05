import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, CameraOff } from 'lucide-react'

export function Scanner({ onScan }: { onScan: (text: string) => void }) {
  const [on, setOn] = useState(false); const [err, setErr] = useState(''); const last = useRef({ t: '', at: 0 }); const cb = useRef(onScan); cb.current = onScan
  useEffect(() => {
    if (!on) return
    const h = new Html5Qrcode('qr-reader'); let started = false
    h.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } }, (txt) => { const n = Date.now(); if (txt === last.current.t && n - last.current.at < 2500) return; last.current = { t: txt, at: n }; navigator.vibrate?.(60); cb.current(txt) }, () => {})
      .then(() => { started = true }).catch(() => { setErr('Camera not available. Use the demo codes or type a code below.'); setOn(false) })
    return () => { (started ? h.stop() : Promise.resolve()).then(() => h.clear()).catch(() => {}) }
  }, [on])
  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-stone-900" style={{ minHeight: on ? 280 : 200 }}>
        <div id="qr-reader" className="[&_video]:rounded-2xl" />
        {!on && <div className="absolute inset-0 grid place-items-center text-center"><div><div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-white/10 text-white"><Camera size={24} /></div><button onClick={() => { setErr(''); setOn(true) }} className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-stone-900">Start camera</button></div></div>}
      </div>
      {on && <button onClick={() => setOn(false)} className="mt-2 flex items-center gap-2 text-sm font-semibold text-stone-600"><CameraOff size={15} /> Stop camera</button>}
      {err && <p className="mt-2 text-sm text-amber-700">{err}</p>}
    </div>
  )
}
