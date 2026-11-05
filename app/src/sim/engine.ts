import { along, cumulative, dist, distToPoly, rng, sha256, type LL } from '../lib/geo'
import { PLANS, PRODUCTS, ROUTES, SITES, VEHICLES, ZONE_NAME, type ProductType, type Sev } from './world'

export const T0 = 300 // 05:00
export const T1 = 1890 // 07:30 next day
export type Status = 'clean' | 'in_transit' | 'in_stock' | 'in_use' | 'soiled' | 'in_cage' | 'processing' | 'missing'
export type Src = 'RFID' | 'QR' | 'GNSS' | 'SYSTEM'
export interface Ev { id: number; t: number; src: Src; kind: string; title: string; detail: string; site?: string; item?: number; veh?: string; cons?: string; reader?: string; dir?: 'in' | 'out'; sev?: Sev }
export interface Step { t: number; plan: 'H' | 'D' | 'V'; loc: string; status: Status }
export interface Item { id: number; qr: string; epc: string; type: ProductType; baseCycles: number; steps: Step[]; cageIn: string; cageOut: string; missing?: { t: number; reason: string; lastZone: string }; washedAt?: number }
export interface Leg { id: string; veh: string; from: string; to: string; routeKey: string; planKey: string; depart: number; arrive: number; planArrive: number; pts: LL[]; cum: number[]; meters: number; cons: string; kind: string }
export interface Alert { id: string; t: number; rule: string; sev: Sev; title: string; detail: string; subject: string; site?: string; pos?: LL; evidence: Record<string, string | number>; risk: number; cons?: string; incident?: string }
export interface Incident { id: string; t: number; title: string; summary: string; sev: Sev; risk: number; alerts: string[]; actions: string[]; cons?: string }
export interface Consignment { ref: string; kind: string; veh: string; legId?: string; from: string; to: string; items: number; kg: number; cages: string[]; desc: string; carrier: string; verdict: 'compliant' | 'diverted' | 'routine' }
export interface CustodyEv { t: number; type: string; title: string; site?: string; pos?: LL; source: string; ok: boolean; hash: string; prev: string }
export interface Scanner { id: string; name: string; home: string; pos: LL; geofence: number; holder: string; battery0: number; drain: number }

export const RULES = [
  { code: 'ROUTE_DEVIATION', name: 'Route deviation', sev: 'medium' as Sev, desc: 'Vehicle >1.5 km from the planned corridor (cross-track error).' },
  { code: 'RESTRICTED_GEOFENCE', name: 'Restricted geofence entry', sev: 'critical' as Sev, desc: 'Consignment enters a port, incinerator or landfill that is not its declared destination.' },
  { code: 'DEST_NOT_REACHED', name: 'Destination not reached', sev: 'high' as Sev, desc: 'No entry into the declared destination geofence 20 min after planned ETA.' },
  { code: 'GNSS_SIGNAL_LOSS', name: 'GNSS / cellular signal loss', sev: 'high' as Sev, desc: 'No fix for >15 min while consignment should be moving — jamming, shielding, tamper or sea transit.' },
  { code: 'RECEIPT_MISSING', name: 'RFID receipt missing', sev: 'critical' as Sev, desc: 'Destination readers did not capture the expected RFID tags (chain-of-custody gap).' },
  { code: 'ETA_SLIP', name: 'ETA slip', sev: 'low' as Sev, desc: 'Predicted arrival slips >8 min vs plan — triggers plant re-planning.' },
  { code: 'ITEM_EXIT_UNAUTH', name: 'Unauthorised exit', sev: 'medium' as Sev, desc: 'RFID tag read at an exit with no QR return/soil event.' },
  { code: 'RECON_SHORTFALL', name: 'Reconciliation shortfall', sev: 'high' as Sev, desc: 'Items issued but not returned to the dirty cage by end of day.' },
  { code: 'ASSET_OUT_OF_GEOFENCE', name: 'Asset out of geofence', sev: 'high' as Sev, desc: 'Loaned high-value asset moved beyond its permitted radius.' },
  { code: 'ASSET_STALE', name: 'Asset not checking in', sev: 'medium' as Sev, desc: 'No location report for >24 h.' },
  { code: 'LOW_BATTERY', name: 'Tracker battery low', sev: 'low' as Sev, desc: 'Tracker battery below 20%.' },
  { code: 'CYCLE_LIFE', name: 'End-of-life prediction', sev: 'info' as Sev, desc: 'Item within 5% of its maximum wash cycles — route to recycling.' },
]

export const SCANNERS: Scanner[] = [
  { id: 'SC-001', name: 'Portable ultrasound · Butterfly iQ+', home: 'Camden Community Clinic', pos: [51.5415, -0.143], geofence: 150, holder: 'Dr A. Rahman', battery0: 88, drain: 0.5 },
  { id: 'SC-002', name: 'Portable ultrasound · Butterfly iQ+', home: 'Hackney Health Centre', pos: [51.545, -0.0553], geofence: 150, holder: 'N. Clarke (nurse)', battery0: 24, drain: 1.6 },
  { id: 'SC-003', name: 'Handheld ECG · Kardia 12L', home: 'Brent Mobile Unit', pos: [51.559, -0.276], geofence: 300, holder: 'Mobile unit pool', battery0: 61, drain: 0 },
  { id: 'SC-004', name: 'Portable ultrasound · Vscan Air', home: 'Camden Community Clinic', pos: [51.541, -0.003], geofence: 150, holder: 'Hub → Camden', battery0: 97, drain: 0.2 },
  { id: 'SC-005', name: 'Portable ultrasound · Butterfly iQ+', home: 'Islington Care Home', pos: [51.5362, -0.103], geofence: 150, holder: 'Care home lead', battery0: 79, drain: 0.4 },
  { id: 'SC-006', name: 'Handheld ECG · Kardia 12L', home: 'Newham GP Surgery', pos: [51.53, 0.005], geofence: 150, holder: 'Dr S. Mehta', battery0: 71, drain: 0.3 },
]
const SC5_DEST: LL = [51.462, -0.011]

// ------------------------------------------------------------ world build
export interface World {
  items: Item[]; events: Ev[]; legs: Leg[]; alerts: Alert[]; incidents: Incident[]; consignments: Consignment[]
  custody: Record<string, CustodyEv[]>; readerEvents: Record<string, number[]>
}
const fmt = (m: number) => { const d = m >= 1440 ? m - 1440 : m; return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(Math.floor(d % 60)).padStart(2, '0')}` }
export const fmtT = (m: number) => fmt(m) + (m >= 1440 ? ' +1d' : '')
export const fmtClock = (m: number) => { const d = m >= 1440 ? m - 1440 : m; const s = Math.floor((d % 1) * 60); return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(Math.floor(d % 60)).padStart(2, '0')}:${String(s).padStart(2, '0')}` }
export const dep = ['THEATRES', 'ICU', 'WARD', 'MAT', 'AE', 'OPD']

function mkLeg(id: string, veh: string, from: string, to: string, routeKey: string, planKey: string, depart: number, actual: number, plan: number, cons: string, kind: string): Leg {
  const r = ROUTES[routeKey]; const base = r.osrmSeconds / 60
  const pr = ROUTES[planKey]
  return { id, veh, from, to, routeKey, planKey, depart, arrive: depart + base * actual, planArrive: depart + (pr.osrmSeconds / 60) * plan, pts: r.pts, cum: cumulative(r.pts), meters: r.meters, cons, kind }
}

let world: World | null = null
export function getWorld(): World { return (world ??= buildWorld()) }

function buildWorld(): World {
  const R = rng(20240611)
  const events: Ev[] = []
  let evId = 0
  const ev = (e: Omit<Ev, 'id'>) => { events.push({ id: evId++, ...e }) }

  // ---- legs
  const L1 = mkLeg('L1', 'V1', 'DECON', 'HOSP', 'decon_hosp', 'decon_hosp', 340, 1.55, 1.4, 'LND-0612-AM', 'laundry_inbound')
  const L2 = mkLeg('L2', 'V1', 'HOSP', 'DECON', 'hosp_decon', 'hosp_decon', 425, 1.5, 1.4, 'LND-0612-RT', 'empty_return')
  const L3 = mkLeg('L3', 'V1', 'DECON', 'HOSP', 'decon_hosp', 'decon_hosp', 1050, 1.95, 1.4, 'LND-0612-COL', 'collection_run')
  const dep4 = L3.arrive + 38
  const L4 = mkLeg('L4', 'V1', 'HOSP', 'DECON', 'hosp_decon', 'hosp_decon', dep4, 1.85, 1.4, 'LND-0612-PM', 'laundry_outbound')
  const L5 = mkLeg('L5', 'V1', 'DECON', 'HOSP', 'decon_hosp', 'decon_hosp', 1780, 1.45, 1.4, 'LND-0613-AM', 'laundry_inbound')
  const L6 = mkLeg('L6', 'V2', 'HOSP', 'RECY', 'hosp_recy', 'hosp_recy', 570, 1.45, 1.4, 'RCY-0612-A', 'recycling')
  const L7 = mkLeg('L7', 'V3', 'DECON', 'PORT', 'decon_port', 'decon_recy', 615, 1.4, 1.4, 'RCY-0612-B', 'recycling')
  const L8 = mkLeg('L8', 'V4', 'HUB', 'COMM', 'hub_comm', 'hub_comm', 780, 1.3, 1.25, 'PCL-77421', 'asset_loan')
  const L9 = mkLeg('L9', 'V5', 'SYN', 'HOSP', 'syn_hosp', 'syn_hosp', 400, 1.45, 1.4, 'SYN-0612-DEL', 'curtain_delivery')
  const L10 = mkLeg('L10', 'V5', 'HOSP', 'SYN', 'hosp_syn', 'hosp_syn', 960, 1.5, 1.4, 'SYN-0612-COL', 'curtain_collection')
  const L11 = mkLeg('L11', 'V5', 'SYN', 'HOSP', 'syn_hosp', 'syn_hosp', 1790, 1.4, 1.4, 'SYN-0613-DEL', 'curtain_delivery')
  const legs = [L1, L2, L3, L4, L5, L6, L7, L8, L9, L10, L11]

  // ---- items
  const N = 72
  const typeIdx: number[] = []
  ;[20, 16, 14, 8, 6, 8].forEach((c, k) => { for (let j = 0; j < c; j++) typeIdx.push(k) })
  for (let i = typeIdx.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [typeIdx[i], typeIdx[j]] = [typeIdx[j], typeIdx[i]] }
  const MISSING: Record<number, { t: number; reason: string; lastZone: string; dept?: string }> = {
    5: { t: 852, reason: 'RFID tag read leaving via Main Entrance with no QR return', lastZone: 'STREET' },
    23: { t: 750, reason: 'Last QR scan in Theatres — likely discarded with clinical waste', lastZone: 'THEATRES', dept: 'THEATRES' },
    41: { t: 785, reason: 'Last RFID read entering Maternity — likely left in a patient room', lastZone: 'MAT', dept: 'MAT' },
  }
  const cleanCages = ['RC-101', 'RC-102', 'RC-103']
  const items: Item[] = []
  const mvEvents: [Item, Step, Step][] = []
  for (let i = 0; i < N; i++) {
    const type = PRODUCTS[typeIdx[i]]
    const miss = MISSING[i]
    const cageIdx = Math.floor(i / 24)
    let d1 = type.depts[Math.floor(R() * type.depts.length)]
    if (miss?.dept) d1 = miss.dept
    if (i === 5) d1 = 'AE'
    const cageOut = ['THEATRES', 'ICU', 'AE'].includes(d1) ? 'RC-201' : 'RC-202'
    const it: Item = { id: i, qr: `TX-${type.code}-${String(1000 + i * 7).padStart(5, '0')}`, epc: 'E2801160600002' + (4096 + i * 37).toString(16).padStart(10, '0').toUpperCase(), type, baseCycles: Math.floor(type.maxCycles * (0.2 + R() * 0.7)), steps: [], cageIn: cleanCages[cageIdx], cageOut }
    // near-end-of-life items for the CYCLE_LIFE demo
    if (i % 17 === 3 && type.code !== 'TRY') it.baseCycles = type.maxCycles - 2
    const S = it.steps
    const add = (t: number, plan: Step['plan'], loc: string, status: Status) => S.push({ t, plan, loc, status })
    add(0, 'D', 'D_PACK', 'clean')
    add(L1.depart - 40 + cageIdx * 2 + R() * 3, 'D', 'D_OUT', 'clean')
    add(L1.depart - 14 + cageIdx * 3 + R(), 'V', 'V1', 'in_transit')
    const a1 = L1.arrive
    add(a1 + 2, 'H', 'YARD', 'in_stock')
    const dock = a1 + 7 + cageIdx * 4 + (i % 24) * 0.12
    add(dock, 'H', 'DOCK', 'in_stock')
    const linen = dock + 22 + cageIdx * 3 + R() * 3
    add(linen, 'H', 'LINEN', 'in_stock')
    const dist1 = linen + 12 + R() * 45
    add(dist1, 'H', d1, 'in_stock')
    const use = Math.max(dist1 + 15, 495 + R() * 330)
    add(use, 'H', d1, 'in_use')
    let dN = d1
    if (R() < 0.25 && !miss) {
      const opts = dep.filter((d) => d !== d1)
      dN = opts[Math.floor(R() * opts.length)]
      add(use + 25 + R() * 90, 'H', dN, 'in_use')
    }
    const soil = 945 + R() * 80
    const dirtyT = soil + 18 + R() * 30
    if (miss) {
      const cut = S.filter((s) => s.t < miss.t)
      S.length = 0; S.push(...cut)
      if (i === 5) { add(miss.t, 'H', 'STREET', 'in_use') } else if (S[S.length - 1].loc !== miss.lastZone) add(miss.t - 1, 'H', miss.lastZone, 'in_use')
      it.missing = { t: 1110, reason: miss.reason, lastZone: miss.lastZone }
    } else {
      add(soil, 'H', dN, 'soiled')
      add(dirtyT, 'H', 'DIRTY', 'in_cage')
      const ci = it.cageOut === 'RC-201' ? 0 : 1
      const back = L3.arrive + 8 + ci * 5 + R() * 3
      add(back, 'H', 'DOCK', 'in_cage')
      add(back + 6, 'H', 'YARD', 'in_transit')
      add(back + 10 + R(), 'V', 'V1', 'in_transit')
      const a4 = L4.arrive
      const b = Math.floor((i % 36) / 12) // 3 wash batches
      add(a4 + 3, 'D', 'D_YARD', 'in_transit')
      add(a4 + 11 + b * 3 + R() * 6, 'D', 'D_RECV', 'processing')
      add(a4 + 48 + b * 22 + R() * 8, 'D', 'D_SORT', 'processing')
      const wash = a4 + 88 + b * 40 + R() * 10
      add(wash, 'D', 'D_WASH', 'processing'); it.washedAt = wash + 40
      add(wash + 100 + R() * 8, 'D', 'D_DRY', 'processing')
      add(wash + 215 + R() * 8, 'D', 'D_QA', 'processing')
      add(wash + 310 + R() * 8, 'D', 'D_PACK', 'clean')
      add(L5.depart - 30 + (i % 24) * 0.2, 'D', 'D_OUT', 'clean')
      add(L5.depart - 12 + (i % 24) * 0.15, 'V', 'V1', 'in_transit')
      const a5 = L5.arrive
      add(a5 + 2, 'H', 'YARD', 'in_stock')
      add(a5 + 7 + (i % 24) * 0.15, 'H', 'DOCK', 'in_stock')
    }
    S.sort((x, y) => x.t - y.t)
    for (let k = 1; k < S.length; k++) if (S[k].t <= S[k - 1].t) S[k].t = S[k - 1].t + 0.05
    for (let k = 1; k < S.length; k++) mvEvents.push([it, S[k - 1], S[k]])
    items.push(it)
  }

  // ---- item events (RFID reader passes + QR scans)
  const TR = { H: 3, D: 4 }
  for (const [it, p, s] of mvEvents) {
    if (p.plan === s.plan && s.plan !== 'V' && p.loc !== s.loc) {
      const plan = PLANS[s.plan]; const { readers } = plan.path(p.loc, s.loc)
      const tr = Math.min(TR[s.plan], s.t - p.t)
      readers.forEach((rid, k) => {
        const r = plan.readers.find((x) => x.id === rid)!
        const dir = r.zone === p.loc ? 'out' : 'in'
        ev({ t: s.t - tr + (tr * (k + 0.5)) / Math.max(1, readers.length), src: 'RFID', kind: 'rfid', title: `${r.label}`, detail: `${it.type.name} ${it.qr} ${dir === 'in' ? 'entered' : 'left'}`, site: s.plan === 'H' ? 'HOSP' : 'DECON', item: it.id, reader: rid, dir })
      })
      if (s.loc === 'DIRTY') ev({ t: s.t + 0.2, src: 'RFID', kind: 'rfid', title: 'Cage bay (in-cage)', detail: `${it.type.name} ${it.qr} bound to ${it.cageOut}`, site: 'HOSP', item: it.id, reader: 'R-CAGE', dir: 'in' })
    }
    if (s.status === 'in_use' && p.status === 'in_stock' && p.loc === s.loc && p.plan === 'H') ev({ t: s.t, src: 'QR', kind: 'qr', title: 'QR scan · USE', detail: `${it.type.name} ${it.qr} used in ${ZONE_NAME[s.loc]}`, site: 'HOSP', item: it.id })
    if (s.status === 'in_stock' && p.plan === 'H' && p.loc === 'LINEN' && s.loc !== 'LINEN') ev({ t: s.t, src: 'QR', kind: 'qr', title: 'QR scan · ISSUE', detail: `${it.type.name} ${it.qr} issued to ${ZONE_NAME[s.loc]}`, site: 'HOSP', item: it.id })
    if (s.status === 'soiled') ev({ t: s.t, src: 'QR', kind: 'qr', title: 'QR scan · SOILED', detail: `${it.type.name} ${it.qr} marked soiled in ${ZONE_NAME[s.loc]}`, site: 'HOSP', item: it.id })
  }

  // ---- vehicle geofence events + rule engine on 1-min samples
  const alerts: Alert[] = []
  const addAlert = (a: Omit<Alert, 'id'>) => { const al = { id: `AL-${String(alerts.length + 1).padStart(3, '0')}`, ...a }; alerts.push(al); return al }
  for (const v of VEHICLES) {
    let inSite: string | null = null
    for (let t = T0; t <= T1; t += 1) {
      const st = vehicleAt(legs, v.id, t)
      const here: string | null = !st.dark ? Object.values(SITES).find((s) => dist(st.pos, s.pos) <= s.radius)?.id ?? null : inSite
      if (here !== inSite) {
        if (inSite) ev({ t, src: 'GNSS', kind: 'geofence', title: `${v.reg} left ${SITES[inSite].short}`, detail: `TAT240 ${v.imei.slice(-6)} · geofence exit`, site: inSite, veh: v.id })
        if (here) ev({ t, src: 'GNSS', kind: 'geofence', title: `${v.reg} arrived ${SITES[here].short}`, detail: `TAT240 ${v.imei.slice(-6)} · geofence entry`, site: here, veh: v.id })
        inSite = here
      }
    }
  }

  // ---- consignment rule engine
  const consignments: Consignment[] = []
  const evalConsignment = (leg: Leg, declared: string, expectReceipt: boolean) => {
    let inside = 0, devDone = false, restrictedDone = false, gapDone = false, destDone = false, arrivedAt: number | null = null, lastFix = leg.depart, recDone = false
    const planPts = ROUTES[leg.planKey].pts
    for (let t = leg.depart; t <= T1; t += 1) {
      const st = vehicleAt(legs, leg.veh, t)
      if (!st.dark) {
        lastFix = t
        const off = distToPoly(st.pos, planPts)
        if (!devDone && off > 1500) { devDone = true; addAlert({ t, rule: 'ROUTE_DEVIATION', sev: 'medium', title: `${VEHICLES.find((x) => x.id === leg.veh)!.reg} is off the planned route`, detail: `Cross-track error ${(off / 1000).toFixed(1)} km from the planned corridor to ${SITES[declared].short}. Heading ${Math.round(st.heading)}°.`, subject: leg.cons, pos: st.pos, evidence: { 'Cross-track error': `${(off / 1000).toFixed(1)} km`, 'Planned route': `${leg.planKey}`, Speed: `${Math.round(st.speed)} km/h` }, risk: 38, cons: leg.cons }) }
        const rs = Object.values(SITES).find((q) => q.restricted && q.id !== declared && dist(st.pos, q.pos) <= q.radius)
        inside = rs ? inside + 1 : 0
        for (const s of rs && inside >= 5 ? [rs] : []) if (!restrictedDone) { restrictedDone = true; addAlert({ t, rule: 'RESTRICTED_GEOFENCE', sev: 'critical', title: `Consignment entered ${s.name}`, detail: `Declared destination was ${SITES[declared].name}. Vehicle entered an export / disposal geofence instead — possible offshore shipment or incineration.`, subject: leg.cons, site: s.id, pos: st.pos, evidence: { 'Entered geofence': s.name, 'Declared destination': SITES[declared].name, Dwell: 'in progress' }, risk: 88, cons: leg.cons }) }
        if (arrivedAt === null && dist(st.pos, SITES[declared].pos) <= SITES[declared].radius) arrivedAt = t
      } else if (!gapDone && t - lastFix >= 15 && st.leg == null) {
        gapDone = true
        addAlert({ t, rule: 'GNSS_SIGNAL_LOSS', sev: 'high', title: `Tracker silent for ${Math.round(t - lastFix)} min`, detail: `Last fix inside ${Object.values(SITES).find((s) => dist(st.pos, s.pos) <= s.radius)?.name ?? 'unknown area'}. No cellular/GNSS reports since ${fmtT(lastFix)} — consistent with container-stack shielding or sea transit. Last-known position retained as evidence.`, subject: leg.cons, pos: st.pos, evidence: { 'Last fix': fmtT(lastFix), 'Silent for': `${Math.round(t - lastFix)} min`, 'Battery at last fix': `${Math.round(st.battery)}%` }, risk: 72, cons: leg.cons })
      }
      if (!destDone && arrivedAt === null && t >= leg.planArrive + 20) { destDone = true; addAlert({ t, rule: 'DEST_NOT_REACHED', sev: 'high', title: `Not at ${SITES[declared].short} 20 min after ETA`, detail: `Planned arrival ${fmtT(leg.planArrive)}. Vehicle has not entered the destination geofence.`, subject: leg.cons, site: declared, pos: st.pos, evidence: { 'Planned ETA': fmtT(leg.planArrive), 'Declared destination': SITES[declared].name, 'Current position': `${st.pos[0].toFixed(4)}, ${st.pos[1].toFixed(4)}` }, risk: 64, cons: leg.cons }) }
      if (!recDone && expectReceipt && t >= leg.planArrive + 30 && arrivedAt === null) { recDone = true; addAlert({ t, rule: 'RECEIPT_MISSING', sev: 'critical', title: `No RFID receipt at ${SITES[declared].short}`, detail: `Expected 44 tagged items on the destination weighbridge reader. Zero tags read. Chain-of-custody broken at ${fmtT(lastFix)}.`, subject: leg.cons, site: declared, evidence: { 'Tags expected': 44, 'Tags read': 0, 'Custody broken after': fmtT(lastFix) }, risk: 95, cons: leg.cons }) }
    }
    return arrivedAt
  }
  const aV2 = evalConsignment(L6, 'RECY', false)
  evalConsignment(L7, 'RECY', true)

  // ---- laundry ETA-slip (L3 / L4) from live-eta model
  for (const leg of [L3, L4, L1]) {
    const slip = leg.arrive - leg.planArrive
    if (slip > 8) {
      const t = leg.depart + (leg.arrive - leg.depart) * 0.5
      const st = vehicleAt(legs, 'V1', t)
      addAlert({ t, rule: 'ETA_SLIP', sev: 'low', title: `${leg.kind === 'laundry_outbound' ? 'Dirty-linen run' : 'Truck'} running ${Math.round(slip)} min late`, detail: `Predicted arrival ${fmtT(leg.arrive)} vs plan ${fmtT(leg.planArrive)} (traffic on route). Plant receiving & wash-line start shift by ${Math.round(slip)} min.`, subject: leg.cons, site: leg.to, pos: st.pos, evidence: { Plan: fmtT(leg.planArrive), Predicted: fmtT(leg.arrive), Slip: `${Math.round(slip)} min` }, risk: 18, cons: leg.cons })
    }
  }

  // ---- hospital-side alerts
  for (const [idS, m] of Object.entries(MISSING)) {
    const it = items[+idS]
    if (+idS === 5) addAlert({ t: m.t, rule: 'ITEM_EXIT_UNAUTH', sev: 'medium', title: `${it.type.name} ${it.qr} left the building`, detail: 'Tag read by the Main Entrance ceiling reader moving outbound. No QR return/soil event in the last 6 h. Likely staff removal — CCTV timestamp attached.', subject: it.qr, site: 'HOSP', evidence: { Reader: 'R-MAIN', Direction: 'out', 'Last QR': 'USE in A&E', Value: `£${it.type.unitValue}` }, risk: 52 })
  }
  const missingItems = Object.keys(MISSING).map((k) => items[+k])
  addAlert({ t: 1110, rule: 'RECON_SHORTFALL', sev: 'high', title: `${missingItems.length} items unaccounted for at end of day`, detail: `Issued ${N} items today, cages RC-201/202 hold ${N - missingItems.length}. Missing: ${missingItems.map((m) => m.qr).join(', ')}. Ranked last-known locations attached.`, subject: 'RC-201/202', site: 'HOSP', evidence: { Issued: N, 'In dirty cages': N - missingItems.length, Missing: missingItems.length, 'Value at risk': `£${missingItems.reduce((a, b) => a + b.type.unitValue, 0)}` }, risk: 66 })
  const eol = items.filter((i) => i.type.maxCycles - i.baseCycles <= Math.max(2, i.type.maxCycles * 0.05) && !i.missing)
  addAlert({ t: items[0].steps[items[0].steps.length - 3]?.t ?? 1500, rule: 'CYCLE_LIFE', sev: 'info', title: `${eol.length} items reaching end of life`, detail: `${eol.map((e) => e.qr).join(', ')} are within 5% of their maximum wash cycles. Route to the next recycling consignment instead of returning to circulation.`, subject: 'fleet', evidence: { Items: eol.length }, risk: 5 })

  // ---- scanner alerts (derived from scanner model)
  for (const sc of SCANNERS) {
    for (let t = T0; t <= T1; t += 1) {
      const st = scannerAt(legs, sc, t)
      if (sc.id === 'SC-005' && st.outside) { addAlert({ t, rule: 'ASSET_OUT_OF_GEOFENCE', sev: 'high', title: `${sc.id} left ${sc.home}`, detail: `${sc.name} is ${(st.distFromHome / 1000).toFixed(1)} km from its permitted site and moving toward SE London. Loan holder: ${sc.holder}. £6,900 asset.`, subject: sc.id, pos: st.pos, evidence: { 'Distance from home': `${(st.distFromHome / 1000).toFixed(1)} km`, 'Loan holder': sc.holder, 'Asset value': '£6,900' }, risk: 81 }); break }
    }
    if (sc.id === 'SC-003') addAlert({ t: T0 + 5, rule: 'ASSET_STALE', sev: 'medium', title: `${sc.id} has not checked in for 26 h`, detail: `${sc.name} last reported from ${sc.home} yesterday 03:10. Battery 61% — tracker likely in a shielded cabinet or the unit was moved without scanning.`, subject: sc.id, pos: sc.pos, evidence: { 'Last report': 'yesterday 03:10', Battery: '61%' }, risk: 44 })
    if (sc.id === 'SC-002') addAlert({ t: 10 * 60, rule: 'LOW_BATTERY', sev: 'low', title: `${sc.id} tracker battery at 15%`, detail: 'Replace tracker battery within 2 days to avoid a tracking gap.', subject: sc.id, pos: sc.pos, evidence: { Battery: '15%' }, risk: 12 })
  }

  // ---- narrative system events
  const sys = (t: number, title: string, detail: string, site: string, extra: Partial<Ev> = {}) => ev({ t, src: 'SYSTEM', kind: 'system', title, detail, site, ...extra })
  sys(L1.depart - 20, 'Cages sealed & associated to trailer', 'RC-101, RC-102, RC-103 (72 RFID items) ↔ TAT240 …085066 · item ↔ container ↔ truck association created', 'DECON', { veh: 'V1', cons: L1.cons })
  sys(L1.arrive + 28, 'Goods-in reconciled', '72/72 RFID tags matched to dispatch manifest — zero discrepancy', 'HOSP', { cons: L1.cons })
  sys(L3.arrive + 6, 'Cage release authorised', 'Driver Marcus Hale scanned cages RC-201, RC-202 (QR) — release to transport', 'HOSP', { cons: L4.cons })
  sys(L4.depart, 'Dirty cages loaded', `${N - missingItems.length} items declared · TAT240 …085066 bound to RC-201/202 · decon plant notified of ETA ${fmtT(L4.arrive)}`, 'HOSP', { veh: 'V1', cons: L4.cons })
  sys(L4.arrive + 35, 'Plant receiving reconciled', `${N - missingItems.length}/${N - missingItems.length} tags matched to departure manifest · mass balance 100%`, 'DECON', { cons: L4.cons })
  sys(1470, 'Wash batch 1 certified', 'Thermal disinfection 71 °C · 10 min · A0 ≥ 600 · QA RFID verify pass', 'DECON')
  sys(L5.arrive + 28, 'Goods-in reconciled', `${N - missingItems.length}/${N - missingItems.length} tags matched · wash cycles +1 recorded on each tag`, 'HOSP', { cons: L5.cons })
  sys(L6.depart - 8, 'Recycling cages sealed', 'RCY-C1 · 38 end-of-life textiles · 142 kg declared · seal #A-88213 · destination GreenLoop Dagenham', 'HOSP', { veh: 'V2', cons: L6.cons })
  sys(L7.depart - 8, 'Recycling cages sealed', 'RCY-C2 · 44 end-of-life textiles · 168 kg declared · seal #A-88307 · destination GreenLoop Dagenham', 'DECON', { veh: 'V3', cons: L7.cons })
  if (aV2) {
    sys(aV2 + 11, 'Weighbridge RFID receipt', '38/38 tags read · 141.6 kg vs 142.0 declared (−0.3%) · seal intact', 'RECY', { cons: L6.cons })
    sys(aV2 + 40, 'Certificate of recycling issued', 'RCY-A · fibre-to-fibre processing · hashed to custody ledger · LCA credit 214 kg CO₂e', 'RECY', { cons: L6.cons })
  }
  sys(L9.depart - 8, 'Curtains loaded', '16 fresh curtains scanned onto the van · Floor 2 replacement', 'SYN', { veh: 'V5', cons: L9.cons })
  sys(L10.depart - 4, 'Taken-down curtains collected', '16 curtains scanned out of Floor 2 · handed to driver', 'HOSP', { veh: 'V5', cons: L10.cons })
  sys(L8.depart - 6, 'Courier loaded', 'SC-004 (Vscan Air) + 3 parcels · TAT240 …085090 bound', 'HUB', { veh: 'V4', cons: L8.cons })
  sys(L8.arrive + 4, 'Asset loan activated', 'SC-004 handed to Dr A. Rahman (QR) · geofence 150 m @ Camden', 'COMM', { cons: L8.cons })

  events.sort((a, b) => a.t - b.t)
  alerts.sort((a, b) => a.t - b.t)
  alerts.forEach((a, i) => { a.id = `AL-${String(i + 1).padStart(3, '0')}` })

  // ---- incidents
  const incidents: Incident[] = []
  const bAl = alerts.filter((a) => a.cons === 'RCY-0612-B')
  if (bAl.length >= 2) {
    const hi = bAl.filter((a) => a.sev === 'high' || a.sev === 'critical')
    const at = hi[Math.min(1, hi.length - 1)].t
    const inc: Incident = { id: 'INC-2041', t: at, title: 'Suspected diversion of recycling consignment RCY-0612-B', summary: `Truck BX19 HLT left the Decon plant at ${fmtT(L7.depart)} declared for GreenLoop Dagenham, drove past the plant, entered the Port of Tilbury export terminal at ${fmtT(L7.arrive)} and went dark ${fmtT(745)}. 44 RFID items (168 kg) have no downstream receipt.`, sev: 'critical', risk: 96, alerts: bAl.map((a) => a.id), actions: ['Freeze payment & certificate issuance for RCY-0612-B', 'Notify haulier + Environment Agency duty officer (waste-tracking breach)', 'Request Port of Tilbury gate-in log for BX19 HLT', 'Preserve GNSS evidence pack & custody ledger (hash-locked)', 'Quarantine vendor GreenLoop sub-contract pending audit'], cons: 'RCY-0612-B' }
    incidents.push(inc); bAl.forEach((a) => (a.incident = inc.id))
  }
  const s5 = alerts.find((a) => a.rule === 'ASSET_OUT_OF_GEOFENCE')
  if (s5) { const inc: Incident = { id: 'INC-2042', t: s5.t + 10, title: 'Portable scanner SC-005 off-site — possible loss/theft', summary: 'Tracker shows the unit travelling 10 km SE of its care-home site and stopping at a residential address.', sev: 'high', risk: 81, alerts: [s5.id], actions: ['Call loan holder to confirm custody', 'Lock the scanner app licence remotely', 'Escalate to police if unreachable in 2 h'] }; incidents.push(inc); s5.incident = inc.id }

  // ---- consignments
  const nm = N - missingItems.length
  consignments.push(
    { ref: L1.cons, kind: 'laundry_inbound', veh: 'V1', legId: 'L1', from: 'DECON', to: 'HOSP', items: N, kg: 38.5 * 9.6, cages: cleanCages, desc: 'Clean textiles · morning delivery (3 cages)', carrier: 'Decon Plant', verdict: 'routine' },
    { ref: L4.cons, kind: 'laundry_outbound', veh: 'V1', legId: 'L4', from: 'HOSP', to: 'DECON', items: nm, kg: nm * 5.4, cages: ['RC-201', 'RC-202'], desc: 'Soiled textiles · evening collection (2 RFID cages)', carrier: 'Decon Plant', verdict: 'routine' },
    { ref: L5.cons, kind: 'laundry_inbound', veh: 'V1', legId: 'L5', from: 'DECON', to: 'HOSP', items: nm, kg: nm * 5.2, cages: ['RC-301', 'RC-302'], desc: 'Clean textiles · next-morning delivery', carrier: 'Decon Plant', verdict: 'routine' },
    { ref: L6.cons, kind: 'recycling', veh: 'V2', legId: 'L6', from: 'HOSP', to: 'RECY', items: 38, kg: 142, cages: ['RCY-C1'], desc: 'End-of-life textiles → fibre-to-fibre recycling', carrier: 'GreenLoop Haulage', verdict: 'compliant' },
    { ref: L7.cons, kind: 'recycling', veh: 'V3', legId: 'L7', from: 'DECON', to: 'RECY', items: 44, kg: 168, cages: ['RCY-C2'], desc: 'End-of-life textiles → fibre-to-fibre recycling', carrier: 'BX Logistics (sub-contract)', verdict: 'diverted' },
    { ref: L8.cons, kind: 'asset_loan', veh: 'V4', legId: 'L8', from: 'HUB', to: 'COMM', items: 4, kg: 11.2, cages: ['PKG-8841'], desc: 'Portable ultrasound SC-004 + 3 consumable parcels', carrier: 'NHS Courier Service', verdict: 'routine' },
    { ref: L9.cons, kind: 'curtain_delivery', veh: 'V5', legId: 'L9', from: 'SYN', to: 'HOSP', items: 16, kg: 38.4, cages: ['TRL-01'], desc: 'Fresh curtains · Floor 2 replacement', carrier: 'Synergy', verdict: 'routine' },
    { ref: L10.cons, kind: 'curtain_collection', veh: 'V5', legId: 'L10', from: 'HOSP', to: 'SYN', items: 16, kg: 41.6, cages: ['TRL-01'], desc: 'Taken-down curtains · back to reprocessing', carrier: 'Synergy', verdict: 'routine' },
    { ref: 'PCL-88103', kind: 'parcel', veh: '', from: 'HUB', to: 'HOSP', items: 12, kg: 24, cages: [], desc: 'Supplier order · 12 reusable gowns (carrier API, no GNSS)', carrier: 'Parcelforce Express', verdict: 'routine' },
  )

  // ---- custody ledger (hash chain) per consignment
  const custody: Record<string, CustodyEv[]> = {}
  const chain = (ref: string, list: Omit<CustodyEv, 'hash' | 'prev'>[]) => {
    let prev = 'GENESIS'
    custody[ref] = list.map((e) => { const hash = sha256(`${prev}|${ref}|${e.type}|${e.t.toFixed(1)}|${e.site ?? ''}|${e.title}`); const o = { ...e, prev, hash }; prev = hash; return o })
  }
  const gps = (leg: Leg, f: number) => along(leg.pts, leg.cum, leg.meters * f).pos
  chain(L6.cons, [
    { t: L6.depart - 25, type: 'BOUND', title: '38 items condemned & RFID-bound to cage RCY-C1', site: 'HOSP', source: 'RFID+QR', ok: true },
    { t: L6.depart - 8, type: 'SEALED', title: 'Cage sealed #A-88213 · declared 142 kg', site: 'HOSP', source: 'QR', ok: true },
    { t: L6.depart, type: 'DEPARTED', title: 'Departed Hospital · cage ↔ TAT240 …085074', site: 'HOSP', pos: gps(L6, 0), source: 'GNSS', ok: true },
    { t: L6.depart + (L6.arrive - L6.depart) / 2, type: 'CHECKPOINT', title: 'GNSS checkpoint · on planned route', pos: gps(L6, 0.5), source: 'GNSS', ok: true },
    { t: L6.arrive, type: 'ARRIVED', title: 'Entered GreenLoop geofence', site: 'RECY', pos: gps(L6, 1), source: 'GNSS', ok: true },
    { t: L6.arrive + 11, type: 'RECEIVED', title: 'Weighbridge RFID 38/38 · 141.6 kg', site: 'RECY', source: 'RFID', ok: true },
    { t: L6.arrive + 40, type: 'CERTIFIED', title: 'Certificate of recycling issued', site: 'RECY', source: 'SYSTEM', ok: true },
  ])
  chain(L7.cons, [
    { t: L7.depart - 25, type: 'BOUND', title: '44 items condemned & RFID-bound to cage RCY-C2', site: 'DECON', source: 'RFID+QR', ok: true },
    { t: L7.depart - 8, type: 'SEALED', title: 'Cage sealed #A-88307 · declared 168 kg', site: 'DECON', source: 'QR', ok: true },
    { t: L7.depart, type: 'DEPARTED', title: 'Departed Decon plant · cage ↔ TAT240 …085082', site: 'DECON', pos: gps(L7, 0), source: 'GNSS', ok: true },
    { t: L7.depart + 22, type: 'CHECKPOINT', title: 'GNSS checkpoint · on planned corridor', pos: gps(L7, 0.18), source: 'GNSS', ok: true },
    { t: alerts.find((a) => a.rule === 'ROUTE_DEVIATION' && a.cons === L7.cons)?.t ?? 0, type: 'ANOMALY', title: 'Route deviation detected', pos: alerts.find((a) => a.rule === 'ROUTE_DEVIATION' && a.cons === L7.cons)?.pos, source: 'RULE', ok: false },
    { t: alerts.find((a) => a.rule === 'RESTRICTED_GEOFENCE')?.t ?? 0, type: 'ANOMALY', title: 'Entered Port of Tilbury (restricted export zone)', site: 'PORT', pos: alerts.find((a) => a.rule === 'RESTRICTED_GEOFENCE')?.pos, source: 'GNSS', ok: false },
    { t: 745, type: 'LOST', title: 'Tracker silent — last fix inside port terminal', site: 'PORT', source: 'GNSS', ok: false },
    { t: 760, type: 'BREAK', title: 'Expected receipt at GreenLoop never occurred — custody chain broken', site: 'RECY', source: 'RULE', ok: false },
  ].filter((e) => e.t > 0).sort((a, b) => a.t - b.t))

  const readerEvents: Record<string, number[]> = {}
  for (const e of events) if (e.reader) (readerEvents[e.reader] ??= []).push(e.t)

  return { items, events, legs, alerts, incidents, consignments, custody, readerEvents }
}

// ------------------------------------------------------------ vehicle model
export interface VehState { pos: LL; heading: number; speed: number; moving: boolean; dark: boolean; leg: Leg | null; progress: number; battery: number; mv: number; sats: number; hdop: number; signal: number; lastFixT: number; eta: number | null; planEta: number | null; delay: number; atSite: string | null }
const DARK_FROM: Record<string, number> = { V3: 745 }
const BASE_BAT: Record<string, number> = { V5: 93, V1: 96, V2: 88, V3: 54, V4: 91 }
const prof = (u: number) => u + (0.55 / (2 * Math.PI * 5)) * Math.sin(2 * Math.PI * 5 * u)
const dprof = (u: number) => 1 + 0.55 * Math.cos(2 * Math.PI * 5 * u)

export function vehicleAt(legs: Leg[], vid: string, t: number): VehState & { dark: boolean } {
  const mine = legs.filter((l) => l.veh === vid)
  const darkFrom = DARK_FROM[vid]
  let leg: Leg | null = null
  for (const l of mine) if (t >= l.depart && t < l.arrive) leg = l
  let pos: LL, heading = 0, speed = 0, progress = 0, prevLeg = [...mine].reverse().find((l) => l.arrive <= t)
  let eta: number | null = null, planEta: number | null = null, delay = 0
  let tt = darkFrom !== undefined ? Math.min(t, darkFrom) : t
  const effLeg = (() => { for (const l of mine) if (tt >= l.depart && tt < l.arrive) return l; return null })()
  if (effLeg) {
    const u = (tt - effLeg.depart) / (effLeg.arrive - effLeg.depart)
    const s = prof(u); const a = along(effLeg.pts, effLeg.cum, effLeg.meters * s)
    pos = a.pos; heading = a.heading; progress = s
    speed = (effLeg.meters / 1000 / ((effLeg.arrive - effLeg.depart) / 60)) * dprof(u)
    const recentU = Math.max(0, u - 8 / (effLeg.arrive - effLeg.depart))
    const v1 = (s - prof(recentU)) / Math.max(0.01, (u - recentU) * (effLeg.arrive - effLeg.depart))
    const vAvg = s / Math.max(1, tt - effLeg.depart)
    const rate = Math.max(0.0005, 0.5 * v1 + 0.5 * vAvg)
    eta = tt + (1 - s) / rate
    planEta = effLeg.planArrive; delay = eta - planEta
  } else {
    const p = [...mine].reverse().find((l) => l.arrive <= tt)
    const first = mine[0]
    const pt = p ? p.pts[p.pts.length - 1] : first.pts[0]
    pos = pt as LL
    prevLeg = p
    if (p) heading = 0
  }
  const dark = darkFrom !== undefined && t >= darkFrom
  const moving = !!effLeg && !dark
  const pct = Math.max(5, BASE_BAT[vid] - ((tt - T0) / (T1 - T0)) * 6 - (moving ? 0.5 : 0))
  const site = Object.values(SITES).find((s) => dist(pos, s.pos) <= s.radius)?.id ?? null
  void prevLeg
  return { pos, heading, speed: moving ? speed : 0, moving, dark, leg: dark ? null : leg, progress, battery: pct, mv: Math.round(6000 + pct * 12), sats: moving ? 9 + ((Math.floor(t) * 7) % 6) : 11, hdop: moving ? 0.8 + ((Math.floor(t) * 3) % 7) / 10 : 0.9, signal: dark ? 0 : 3 + (Math.floor(t) % 2), lastFixT: dark ? darkFrom : t, eta: dark ? null : eta, planEta, delay, atSite: site }
}

export function scannerAt(legs: Leg[], sc: Scanner, t: number) {
  let pos: LL = sc.pos, mode = 'at_site', veh: string | null = null
  if (sc.id === 'SC-004') {
    const l = legs.find((x) => x.id === 'L8')!
    if (t >= l.depart && t < l.arrive) { pos = vehicleAt(legs, 'V4', t).pos; mode = 'in_transit'; veh = 'V4' }
    else if (t >= l.arrive) { pos = SITES.COMM.pos; mode = 'at_site' } else mode = 'at_hub'
  }
  if (sc.id === 'SC-005' && t >= 860) {
    const f = Math.min(1, (t - 860) / 80)
    pos = [sc.pos[0] + (SC5_DEST[0] - sc.pos[0]) * f + Math.sin(f * 9) * 0.0012, sc.pos[1] + (SC5_DEST[1] - sc.pos[1]) * f + Math.cos(f * 7) * 0.0012]
    mode = f >= 1 ? 'stationary_offsite' : 'moving_offsite'
  }
  const home: LL = sc.id === 'SC-004' ? SITES.COMM.pos : sc.pos
  const d = dist(pos, home)
  const outside = sc.id === 'SC-004' ? false : d > sc.geofence * 2.5
  const battery = Math.max(3, sc.battery0 - sc.drain * ((t - T0) / 60))
  const lastSeen = sc.id === 'SC-003' ? T0 - 26 * 60 : Math.floor(t / 15) * 15
  return { pos, mode, outside, distFromHome: d, battery, lastSeen, veh }
}
export const scannerValue = (sc: Scanner) => (sc.name.includes('ECG') ? 1400 : 6900)

// ------------------------------------------------------------ item location
export interface ItemLoc { kind: 'zone' | 'moving' | 'vehicle' | 'gone'; plan?: 'H' | 'D'; zone?: string; pts?: [number, number][]; f?: number; veh?: string; step: Step; status: Status; cycles: number; from?: string }
export function itemAt(it: Item, t: number): ItemLoc {
  const S = it.steps
  let k = 0
  while (k + 1 < S.length && S[k + 1].t <= t) k++
  const cur = S[k], nxt = S[k + 1]
  let status = cur.status
  if (it.missing && t >= it.missing.t) status = 'missing'
  const cycles = it.baseCycles + (it.washedAt !== undefined && t >= it.washedAt ? 1 : 0)
  if (nxt && nxt.plan === cur.plan && cur.plan !== 'V' && nxt.loc !== cur.loc) {
    const tr = Math.min(cur.plan === 'H' ? 3 : 4, nxt.t - cur.t)
    if (t > nxt.t - tr) {
      const { pts } = PLANS[cur.plan].path(cur.loc, nxt.loc)
      return { kind: 'moving', plan: cur.plan, pts, f: (t - (nxt.t - tr)) / tr, step: cur, status, cycles, from: cur.loc, zone: nxt.loc }
    }
  }
  if (cur.plan === 'V') return { kind: 'vehicle', veh: cur.loc, step: cur, status, cycles }
  return { kind: 'zone', plan: cur.plan, zone: cur.loc, step: cur, status, cycles }
}

// ------------------------------------------------------------ data-fusion confidence
export function fusion(it: Item, t: number) {
  const w = getWorld()
  const loc = itemAt(it, t)
  const lastQR = [...w.events].reverse().find((e) => e.item === it.id && e.src === 'QR' && e.t <= t)
  const lastRF = [...w.events].reverse().find((e) => e.item === it.id && e.src === 'RFID' && e.t <= t)
  if (loc.kind === 'vehicle') {
    const v = vehicleAt(w.legs, loc.veh!, t)
    return { tier: 'GNSS (inherited via truck)', conf: v.dark ? 0.4 : 0.97, method: `QR → RFID cage RC → ${v.leg ? 'TAT240 fix' : 'parked fix'} on ${loc.veh}`, age: 0, lastQR, lastRF, pos: v.pos }
  }
  const age = lastRF ? t - lastRF.t : t - (loc.step.t || 0)
  let conf = Math.max(0.35, 0.96 * Math.exp(-Math.max(0, age) / 300))
  if (lastQR && t - lastQR.t < 10) conf = Math.max(conf, 0.98)
  if (loc.status === 'missing') conf = 0.12
  return { tier: lastQR && lastRF && lastQR.t > lastRF.t ? 'QR (manual scan)' : 'RFID zone read', conf, method: lastRF ? `${lastRF.title} · ${fmtT(lastRF.t)}` : 'last known state', age, lastQR, lastRF, pos: null as LL | null }
}

export const SC5_END = SC5_DEST
export { PRODUCTS }
