import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats as F } from 'html5-qrcode'
import { Camera, CameraOff, CheckCircle2 } from 'lucide-react'

export function Scanner({ onScan, autoStart = false }: { onScan: (text: string) => void; autoStart?: boolean }) {
  const [on, setOn] = useState(autoStart); const [err, setErr] = useState(''); const [seen, setSeen] = useState(''); const tm = useRef<ReturnType<typeof setTimeout>>(undefined); const last = useRef({ t: '', at: 0 }); const cb = useRef(onScan); cb.current = onScan
  useEffect(() => {
    if (!on) return
    const h = new Html5Qrcode('qr-reader', { verbose: false, useBarCodeDetectorIfSupported: true, formatsToSupport: [F.QR_CODE, F.DATA_MATRIX, F.CODE_128, F.CODE_39, F.CODE_93, F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.ITF, F.CODABAR, F.PDF_417, F.AZTEC] }); let started = false
    h.start({ facingMode: 'environment' }, { fps: 12, qrbox: (w: number, hgt: number) => ({ width: Math.min(w - 20, 320), height: Math.min(hgt - 20, 190) }), aspectRatio: 1.5 }, (txt) => { const n = Date.now(); if (txt === last.current.t && n - last.current.at < 2500) return; last.current = { t: txt, at: n }; navigator.vibrate?.(60); setSeen(txt); clearTimeout(tm.current); tm.current = setTimeout(() => setSeen(''), 4000); cb.current(txt) }, () => {})
      .then(() => { started = true }).catch(() => { setErr('Camera not available. Allow the camera for this site, or type the number instead.'); setOn(false) })
    return () => { (started ? h.stop() : Promise.resolve()).then(() => h.clear()).catch(() => {}) }
  }, [on])
  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-stone-900" style={{ minHeight: on ? 240 : 150 }}>
        <div id="qr-reader" className="[&_video]:rounded-2xl" />
        {on && seen && <div className="absolute inset-x-2 bottom-2 z-10 flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-white shadow-lg"><CheckCircle2 size={20} className="shrink-0" /><span className="min-w-0"><span className="block text-[11px] font-bold uppercase tracking-wider opacity-80">Scanned</span><span className="mono block truncate text-[16px] font-bold">{seen}</span></span></div>}
        {!on && <div className="absolute inset-0 grid place-items-center text-center"><div><div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white"><Camera size={24} /></div><button onClick={() => { setErr(''); setOn(true) }} className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-stone-900">Start camera</button></div></div>}
      </div>
      {on && <button onClick={() => setOn(false)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 px-5 py-3 text-[15px] font-bold text-white shadow-sm hover:bg-rose-700 active:bg-rose-800"><CameraOff size={17} /> Stop camera</button>}
      {err && <p className="mt-2 text-sm text-amber-700">{err}</p>}
    </div>
  )
}
