import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { LocateFixed, Route, X } from 'lucide-react'

type Pos = [number, number]
interface Props { title: string; subtitle: string; pts: Pos[]; focus: Pos | null; focusLabel: string; fromName?: string; toName?: string; manualCount: number; children: ReactNode; onClose: () => void }

/** Fits the whole route when the dialogue opens and when asked. It does not refit on each live update, so the viewer's own zoom is kept. */
function View({ pts, focus, ask }: { pts: Pos[]; focus: Pos | null; ask: { to: 'all' | 'focus'; n: number } }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    if (ask.to === 'focus' && focus) map.setView(focus, Math.max(map.getZoom(), 16))
    else if (pts.length) map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [48, 72], paddingBottomRight: [48, 40], maxZoom: 16 })
  }, [ask.n]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const watch = new ResizeObserver(() => map.invalidateSize()); watch.observe(map.getContainer()); return () => watch.disconnect() }, [map])
  return null
}

/** The delivery map in its own dialogue: the whole screen on a phone, a large window on a computer. Close with the button, the Esc key or by clicking outside it. */
export function FullMapDialog({ title, subtitle, pts, focus, focusLabel, fromName, toName, manualCount, children, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null); const [shown, setShown] = useState(false)
  const [ask, setAsk] = useState<{ to: 'all' | 'focus'; n: number }>({ to: 'all', n: 0 })
  useEffect(() => {
    const el = ref.current!; if (!el.open) el.showModal(); setShown(true)
    const before = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = before }
  }, [])
  const control = 'flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-cyan-300 bg-white px-3 text-[16px] font-bold text-cyan-900 hover:bg-cyan-50 sm:flex-none sm:px-5'
  const keys: [string, string][] = [...(fromName ? [['#94a3b8', `From: ${fromName}`] as [string, string]] : []), ...(toName ? [['#10b981', `To: ${toName}`] as [string, string]] : []), ...(focus ? [['#6759e4', focusLabel] as [string, string]] : [])]
  return (
    <dialog ref={ref} aria-label={title} onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current.close() }}
      className="m-auto h-[100dvh] max-h-none w-screen max-w-none overflow-hidden bg-white p-0 backdrop:bg-stone-900/60 backdrop:backdrop-blur-[2px] open:flex open:flex-col sm:h-[90dvh] sm:w-[min(1200px,94vw)] sm:rounded-3xl sm:shadow-2xl">
      <header className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top,0px))] sm:pt-3">
        <div className="min-w-0"><h2 className="truncate text-[20px] font-extrabold leading-tight text-stone-900">{title}</h2><p className="truncate text-[15px] font-semibold text-stone-600">{subtitle}</p></div>
        <button type="button" autoFocus onClick={() => ref.current?.close()} className="flex min-h-[52px] shrink-0 items-center gap-2 rounded-2xl bg-stone-900 px-5 text-[17px] font-bold text-white hover:bg-stone-700"><X size={20} />Close</button>
      </header>
      <div className="min-h-0 flex-1">
        {shown && <MapContainer center={pts[0] ?? [51.5, -0.1]} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer attribution="&copy; OpenStreetMap" url={import.meta.env.VITE_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} />
          <View pts={pts} focus={focus} ask={ask} />{children}
        </MapContainer>}
      </div>
      <footer className="space-y-2.5 border-t border-stone-200 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
        <div className="min-w-0 space-y-1">
          <ul className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-5">{keys.map(([colour, label]) => <li key={label} className="flex items-center gap-2 text-[15px] font-semibold text-stone-800"><i className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: colour }} /><span className="min-w-0 break-words">{label}</span></li>)}</ul>
          {manualCount > 0 && <p className="flex items-center gap-2 text-[13.5px] font-semibold text-amber-700"><i className="inline-block h-0 w-6 shrink-0 border-t-[3px] border-dashed border-amber-600" />Orange dashed route: {manualCount} point{manualCount === 1 ? '' : 's'} entered manually, not reported by the tracker.</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setAsk((a) => ({ to: 'all', n: a.n + 1 }))} className={control}><Route size={18} className="shrink-0" />Whole route</button>
          {focus && <button type="button" onClick={() => setAsk((a) => ({ to: 'focus', n: a.n + 1 }))} className={control}><LocateFixed size={18} className="shrink-0" />{focusLabel}</button>}
        </div>
      </footer>
    </dialog>)
}
