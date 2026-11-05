import { ArrowRight } from 'lucide-react'
import { go, useStore } from '../store'
import { fmtT } from '../sim/engine'

const STEPS: { t: number; page: string; title: string; text: string; twin?: 'H' | 'D'; veh?: string }[] = [
  { t: 342, page: 'map', veh: 'V1', title: 'Clean linen leaves the plant', text: 'Cages are sealed and linked to the truck’s GPS tracker. Watch the truck head to the hospital.' },
  { t: 385, page: 'twin', twin: 'H', title: 'Arrives — readers count everything', text: 'RFID readers over the dock door read every tag. Goods-in is checked against the manifest automatically.' },
  { t: 630, page: 'twin', twin: 'H', title: 'Used on the wards', text: 'Staff scan the QR code when an item is used. Doorway readers track it between departments.' },
  { t: 1075, page: 'twin', twin: 'H', title: 'Soiled items go in RFID cages', text: 'At 18:30 the system compares what was issued with what is in the cages — and flags anything missing.' },
  { t: 1140, page: 'map', veh: 'V1', title: 'Driver collects the cages', text: 'The truck’s GPS now carries every item inside. If it runs late, the plant is warned ahead of time.' },
  { t: 1300, page: 'twin', twin: 'D', title: 'Washed and verified at the plant', text: 'Readers at each stage prove dirty items never cross into the clean side. Wash count goes up by one.' },
  { t: 1800, page: 'map', veh: 'V1', title: 'Back to the hospital — again', text: 'Reusable means the loop repeats. Each trip is recorded on the item’s own journey page.' },
  { t: 800, page: 'provenance', title: 'Recycling: prove it arrived', text: 'One truck reaches the recycler. The other drives to a port and goes silent. The system tells them apart.' },
]
export function Tour() {
  const { t, set } = useStore()
  const sorted = [...STEPS].sort((a, b) => a.t - b.t)
  const nowIdx = sorted.reduce((a, s, i) => (t >= s.t ? i : a), -1)
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-end justify-between"><div><h2 className="text-lg font-extrabold text-stone-900">How it works — a day in 8 steps</h2><p className="text-sm text-stone-500">Click “Show me” on any step to jump the demo clock there and open the right screen.</p></div></div>
      <div className="scroll-thin flex gap-3 overflow-x-auto pb-2">
        {STEPS.map((s, i) => { const live = sorted[nowIdx] === s; return (
          <div key={i} className={`card flex w-[250px] shrink-0 flex-col p-4 ${live ? 'ring-2 ring-orange-500' : ''}`}>
            <div className="flex items-center justify-between"><span className="grid h-7 w-7 place-items-center rounded-full bg-stone-900 text-xs font-extrabold text-white">{i + 1}</span><span className="mono text-xs text-stone-400">{fmtT(s.t).slice(0, 5)}</span></div>
            <div className="mt-3 text-[15px] font-extrabold leading-tight text-stone-900">{s.title}</div>
            <p className="mt-1.5 flex-1 text-[12.5px] leading-snug text-stone-500">{s.text}</p>
            <button onClick={() => { set({ t: s.t, playing: true, ...(s.twin ? { twin: s.twin } : {}), ...(s.veh ? { selVeh: s.veh } : {}) }); go(s.page) }} className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-stone-900 px-3 py-2 text-xs font-bold text-white hover:bg-stone-700">Show me <ArrowRight size={13} /></button>
          </div>) })}
      </div>
    </div>
  )
}
