import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-leaflet'
import { MousePointerClick } from 'lucide-react'

/**
 * Keeps the mouse wheel for scrolling the page until the map is clicked, so the page never gets stuck.
 * Tells the user what to do: a hint shows when the pointer rests on the map or the wheel is used before clicking.
 * Place inside a react-leaflet MapContainer (which should have scrollWheelZoom={false}).
 */
export function ZoomHint() {
  const map = useMap(); const [hint, setHint] = useState(false)
  useEffect(() => {
    const el = map.getContainer(); let t: ReturnType<typeof setTimeout> | undefined; let active = false
    const flash = (ms: number) => { setHint(true); clearTimeout(t); t = setTimeout(() => setHint(false), ms) }
    const enter = () => { if (!active) flash(2600) }
    const wheel = () => { if (!active) flash(2200) }
    const click = () => { active = true; map.scrollWheelZoom.enable(); setHint(false) }
    const leave = () => { active = false; map.scrollWheelZoom.disable(); setHint(false) }
    el.addEventListener('mouseenter', enter); el.addEventListener('wheel', wheel, { passive: true }); el.addEventListener('mousedown', click); el.addEventListener('mouseleave', leave)
    return () => { clearTimeout(t); el.removeEventListener('mouseenter', enter); el.removeEventListener('wheel', wheel); el.removeEventListener('mousedown', click); el.removeEventListener('mouseleave', leave) }
  }, [map])
  return createPortal(
    <div aria-live="polite" className={`pointer-events-none absolute inset-x-0 bottom-4 z-[1000] flex justify-center px-3 transition-opacity duration-300 ${hint ? 'opacity-100' : 'opacity-0'}`}>
      <span className="flex items-center gap-2 rounded-full bg-stone-900/85 px-4 py-2 text-[13px] font-semibold text-white shadow-lg backdrop-blur"><MousePointerClick size={15} /> Click the map, then scroll to zoom in or out</span>
    </div>, map.getContainer())
}
