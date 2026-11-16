import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

/** A box to sign in with a finger or a mouse. Reports a small PNG (white background) once something is drawn, or null when empty. */
export function SignaturePad({ onChange, height = 150 }: { onChange: (png: string | null) => void; height?: number }) {
  const cv = useRef<HTMLCanvasElement>(null); const drawing = useRef(false); const [inked, setInked] = useState(false); const cb = useRef(onChange); cb.current = onChange
  const paint = () => { const c = cv.current; if (!c) return; const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.lineWidth = 3.2; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1c2236' }
  useEffect(() => { const c = cv.current; if (!c) return; c.width = 720; c.height = Math.round(720 * (height / 480)); paint() }, [height])
  const pt = (e: React.PointerEvent) => { const c = cv.current!; const r = c.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height } }
  const down = (e: React.PointerEvent) => { const g = cv.current!.getContext('2d')!; cv.current!.setPointerCapture(e.pointerId); drawing.current = true; const p = pt(e); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + 0.1, p.y + 0.1); g.stroke() }
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const g = cv.current!.getContext('2d')!; const p = pt(e); g.lineTo(p.x, p.y); g.stroke() }
  const up = () => { if (!drawing.current) return; drawing.current = false; setInked(true); cb.current(cv.current!.toDataURL('image/png')) }
  const clear = () => { paint(); setInked(false); cb.current(null) }
  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-stone-300 bg-white">
        <canvas ref={cv} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Signature box" className="block w-full touch-none" style={{ height }} />
        {!inked && <span className="pointer-events-none absolute inset-0 grid place-items-center text-[15px] font-semibold text-stone-300">Sign here</span>}
        <span className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-stone-200" />
      </div>
      <button type="button" onClick={clear} className="mt-2 flex items-center gap-1.5 text-[13.5px] font-bold text-stone-500 hover:text-stone-800"><Eraser size={15} /> Clear signature</button>
    </div>)
}
