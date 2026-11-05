import { fmtT, getWorld, itemAt } from '../sim/engine'
import { SITES, VEHICLES, ZONE_NAME } from '../sim/world'
import type { Snap } from '../sim/snap'
import { fmtDur } from '../sim/snap'

export interface Insight { tone: 'info' | 'warn' | 'bad' | 'good'; title: string; body: string; page?: string }
/** Rule-based "intelligence layer": turns raw fused data into operational recommendations. */
export function insights(t: number, snap: Snap): Insight[] {
  const w = getWorld(); const out: Insight[] = []
  for (const v of VEHICLES) {
    const st = snap.veh[v.id]
    if (st.leg && v.id === 'V1') {
      const l = st.leg; const eta = st.eta!
      out.push({ tone: st.delay > 8 ? 'warn' : 'info', title: `${v.reg} → ${SITES[l.to].short} in ${fmtDur(eta - t)}`, body: `ETA ${fmtT(eta)} (${st.delay >= 0 ? '+' : ''}${Math.round(st.delay)} min vs plan). ${l.kind === 'laundry_outbound' ? 'Plant wash-line start will shift accordingly; receiving crew pre-alerted.' : l.kind === 'laundry_inbound' ? 'Goods-in team should have the dock free and 2 porters ready.' : 'Empty collection run.'}`, page: 'map' })
    }
  }
  const inc = w.incidents.find((i) => i.t <= t && i.id === 'INC-2041')
  if (inc) out.unshift({ tone: 'bad', title: 'Possible diversion: RCY-0612-B', body: `Risk ${inc.risk}/100 · truck BX19 HLT drove past the recycler and entered Port of Tilbury. 44 tagged items have no downstream receipt. Recommended: freeze certificate & notify duty officer.`, page: 'alerts' })
  const v3 = snap.veh.V3
  if (v3.dark && t >= 745) out.push({ tone: 'bad', title: `BX19 HLT has been dark for ${fmtDur(t - 745)}`, body: 'Last fix inside Port of Tilbury. Uncertainty radius is expanding on the map; ship-loading probability elevated.', page: 'map' })
  if (t >= 1110) { const m = snap.loc.filter((l) => l.status === 'missing').length; if (m) out.push({ tone: 'warn', title: `${m} items unaccounted for`, body: 'Ranked likely locations: Main Entrance (staff removal), Theatres waste stream, Maternity patient room. £' + (42 + 36 + 14) + ' at risk; propose a ward sweep with handheld RFID.', page: 'lifecycle' }) }
  const theatres = snap.byZone.THEATRES ?? 0, ic = snap.byZone.ICU ?? 0
  if (t > 560 && t < 900 && theatres < 6) out.push({ tone: 'warn', title: 'Theatres gown par level low', body: `Only ${theatres} tagged items remain in Theatres against a par of 8. Re-stock from Linen Store (${snap.byZone.LINEN ?? 0} on hand).` })
  if (t > 760 && t < 900) out.push({ tone: 'info', title: 'Demand forecast', body: `Predicted soil rate peaks 16:00–17:15; schedule the evening collection truck for 18:15 to avoid cage overflow (current ICU stock ${ic}).` })
  const mid = snap.loc.filter((l) => l.status === 'processing').length
  if (mid) out.push({ tone: 'good', title: `${mid} items in decontamination`, body: 'Thermal disinfection validated per batch; RFID barrier reads confirm no dirty→clean cross-contamination.', page: 'twin' })
  const eol = w.items.filter((i) => i.type.maxCycles - itemAt(i, t).cycles <= 2 && !i.missing).length
  if (eol) out.push({ tone: 'info', title: `${eol} items within 2 cycles of end-of-life`, body: 'Auto-flagged for the next recycling consignment instead of re-circulation — protects patient safety and fibre value.' })
  if (!out.length) out.push({ tone: 'good', title: 'All consignments on plan', body: 'No anomalies detected by the rule engine in the last hour.' })
  return out.slice(0, 6)
}
