import { useEffect } from 'react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { go, useStore } from '../store'
import { fmtT } from '../sim/engine'

interface Step { t: number; page: string; title: string; text: string; twin?: 'H' | 'D'; veh?: string; play?: boolean; cta?: [string, string] }
export const TOUR: Step[] = [
  { t: 330, page: 'command', title: 'Welcome to Tex-Trak', text: 'Follow one working day of reusable linen: it leaves the plant clean, is used on the wards, comes back dirty, is washed and returns. Then see how recycling is proved. About two minutes.' },
  { t: 342, page: 'map', veh: 'V1', play: true, title: 'Clean linen leaves the plant', text: 'Cages are sealed and linked to the truck’s GNSS tracker. Watch the truck head to the hospital.' },
  { t: 385, page: 'twin', twin: 'H', play: true, title: 'It arrives and readers count everything', text: 'RFID readers over the dock door read every tag. Goods-in is checked against the manifest automatically.' },
  { t: 630, page: 'twin', twin: 'H', play: true, title: 'Used on the wards', text: 'Staff scan the QR code when an item is used. Doorway readers track it between departments.' },
  { t: 1075, page: 'twin', twin: 'H', play: true, title: 'Soiled items go in RFID cages', text: 'At 18:30 the system compares what was issued with what is in the cages, and flags anything missing.' },
  { t: 1140, page: 'map', veh: 'V1', play: true, title: 'The driver collects the cages', text: 'The truck’s GNSS now carries every item inside. If it runs late, the plant is warned ahead of time.' },
  { t: 1300, page: 'twin', twin: 'D', play: true, title: 'Washed and verified at the plant', text: 'Readers at each stage prove dirty items never cross into the clean side. The wash count goes up by one.' },
  { t: 1800, page: 'map', veh: 'V1', play: true, title: 'Back to the hospital, again', text: 'Reusable means the loop repeats. Each trip is recorded on the item’s own journey.' },
  { t: 800, page: 'provenance', title: 'Recycling: prove it arrived', text: 'One truck reaches the recycler. The other drives to a port and goes silent. The system tells them apart, and you can print the evidence.' },
  { t: 330, page: 'command', title: 'Now try it yourself', text: 'Book a shipment, scan an item, or add your own items and readers. When you are ready for your own data, switch the top bar from Demo to Live.', cta: ['Open Scan station', 'scan'] },
]

/** Floating step-by-step walkthrough. It stays on screen while it moves you between pages. */
export function GuidedTour() {
  const { tour, set, mode } = useStore(); const returnMode = useStore((s) => s.tourReturn)
  const step = tour != null ? TOUR[tour] : null
  useEffect(() => {
    if (tour == null) return
    const s = TOUR[tour]; set({ t: s.t, playing: !!s.play, mode: 'demo', ...(s.twin ? { twin: s.twin, floor: 'G' as const } : {}), ...(s.veh ? { selVeh: s.veh } : {}) }); go(s.page)
  }, [tour, set])
  if (tour == null || !step) return null
  const close = () => { set({ tour: null, playing: false, ...(returnMode ? { mode: returnMode } : {}), tourReturn: null }) }
  const last = tour === TOUR.length - 1
  return (
    <div className="fixed bottom-24 left-3 right-3 z-[60] sm:bottom-auto sm:left-auto sm:right-6 sm:top-24 sm:w-[360px]">
      <div className="card border-cyan-200 p-5 shadow-xl" style={{ boxShadow: '0 12px 40px -12px rgba(84,70,204,.35)' }}>
        <div className="flex items-center justify-between"><span className="rounded-full bg-cyan-50 px-3 py-1 text-[12px] font-medium text-cyan-700">Step {tour + 1} of {TOUR.length}</span><button onClick={close} aria-label="Close tour" className="grid h-8 w-8 place-items-center rounded-full text-stone-400 hover:bg-stone-100"><X size={16} /></button></div>
        <h3 className="mt-3 text-[18px] font-semibold leading-snug text-stone-900">{step.title}</h3>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-stone-600">{step.text}</p>
        {tour > 0 && !last && <div className="mono mt-3 text-[12px] text-stone-400">Demo time {fmtT(step.t).slice(0, 5)}</div>}
        <div className="mt-4 flex gap-1">{TOUR.map((_, i) => <i key={i} className={`h-1.5 flex-1 rounded-full ${i <= tour ? 'bg-cyan-500' : 'bg-stone-200'}`} />)}</div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button disabled={tour === 0} onClick={() => set({ tour: tour - 1 })} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[14px] font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-30"><ArrowLeft size={15} /> Back</button>
          <div className="flex gap-2">
            {step.cta && <button onClick={() => { close(); go(step.cta![1]) }} className="rounded-lg border border-stone-200 px-4 py-2 text-[14px] font-medium text-stone-700 hover:bg-stone-50">{step.cta[0]}</button>}
            <button onClick={() => (last ? close() : set({ tour: tour + 1 }))} className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-cyan-700">{last ? 'Finish' : tour === 0 ? 'Start' : 'Next'} {!last && <ArrowRight size={15} />}</button></div></div>
      </div>
      <span hidden>{mode}</span>
    </div>)
}
