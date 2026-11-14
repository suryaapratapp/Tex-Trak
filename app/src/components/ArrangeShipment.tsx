import { Truck } from 'lucide-react'
import { go } from '../store'
import { setShipDraft, type ShipStart } from '../lib/shipDraft'

/** A friendly next step: after packing, goods out or curtains, jump straight to booking a shipment with those items ready to tick. */
export function ArrangeShipment({ start, text = 'Ready to send it? Arrange a shipment with these items.' }: { start: ShipStart; text?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-cyan-700 shadow-sm"><Truck size={19} /></span>
      <p className="min-w-[180px] flex-1 text-[14px] font-semibold text-cyan-900">{text}</p>
      <button onClick={() => { setShipDraft(start); go('shipments') }} className="rounded-2xl bg-cyan-600 px-5 py-2.5 text-[14.5px] font-bold text-white hover:bg-cyan-700">Arrange shipment →</button>
    </div>
  )
}
