import type { LL } from '../lib/geo'
import routes from './routes.json'

export type SiteKind = 'facility' | 'hospital' | 'decon' | 'recycler' | 'port' | 'incinerator' | 'hub' | 'community'
export interface Site { id: string; name: string; short: string; kind: SiteKind; pos: LL; radius: number; restricted?: boolean; address: string }

export const SITES: Record<string, Site> = {
  SYN: { id: 'SYN', name: 'Synergy Facility', short: 'Synergy Facility', kind: 'facility', pos: [51.5088, -0.276], radius: 250, address: 'Acton, London W3' },
  HOSP: { id: 'HOSP', name: 'Royal Meridian Hospital', short: 'Hospital', kind: 'hospital', pos: [51.5246, -0.134], radius: 200, address: 'Euston Rd, London NW1' },
  DECON: { id: 'DECON', name: 'Decon Plant', short: 'Decon Plant', kind: 'decon', pos: [51.5295, -0.285], radius: 300, address: 'Park Royal, London NW10' },
  RECY: { id: 'RECY', name: 'GreenLoop Textile Recycling', short: 'Recycler', kind: 'recycler', pos: [51.533, 0.145], radius: 450, address: 'Dagenham, London RM9' },
  PORT: { id: 'PORT', name: 'Port of Tilbury (export terminal)', short: 'Tilbury Port', kind: 'port', pos: [51.454, 0.357], radius: 1100, restricted: true, address: 'Tilbury, Essex RM18' },
  INCIN: { id: 'INCIN', name: 'Edmonton EcoPark (incineration)', short: 'Incinerator', kind: 'incinerator', pos: [51.6155, -0.0495], radius: 300, restricted: true, address: 'Edmonton, London N18' },
  PORT2: { id: 'PORT2', name: 'London Gateway Port (export terminal)', short: 'London Gateway', kind: 'port', pos: [51.5047, 0.4909], radius: 900, restricted: true, address: 'Stanford-le-Hope, Essex SS17' },
  INCIN2: { id: 'INCIN2', name: 'Riverside Resource Recovery (incineration)', short: 'Riverside EfW', kind: 'incinerator', pos: [51.4985, 0.1535], radius: 350, restricted: true, address: 'Belvedere, London SE2' },
  HUB: { id: 'HUB', name: 'NHS Regional Logistics Hub', short: 'Logistics Hub', kind: 'hub', pos: [51.541, -0.003], radius: 250, address: 'Stratford, London E15' },
  COMM: { id: 'COMM', name: 'Camden Community Clinic', short: 'Camden Clinic', kind: 'community', pos: [51.5415, -0.143], radius: 150, address: 'Camden, London NW1' },
}

export const ROUTES = routes as unknown as Record<string, { pts: LL[]; meters: number; osrmSeconds: number }>

// ---------------------------------------------------------------- products
export interface ProductType { sku: string; code: string; name: string; unitValue: number; maxCycles: number; co2New: number; co2Cycle: number; waterCycle: number; depts: string[] }
export const PRODUCTS: ProductType[] = [
  { sku: 'GWN-SG', code: 'GWN', name: 'Surgical gown', unitValue: 42, maxCycles: 75, co2New: 5.9, co2Cycle: 0.62, waterCycle: 9, depts: ['THEATRES', 'ICU', 'AE'] },
  { sku: 'SCR-TP', code: 'SCR', name: 'Scrub top', unitValue: 18, maxCycles: 100, co2New: 3.1, co2Cycle: 0.41, waterCycle: 6, depts: ['THEATRES', 'AE', 'ICU'] },
  { sku: 'BED-SH', code: 'BED', name: 'Bed sheet', unitValue: 14, maxCycles: 150, co2New: 4.4, co2Cycle: 0.55, waterCycle: 11, depts: ['WARD', 'MAT', 'ICU'] },
  { sku: 'DRP-TH', code: 'DRP', name: 'Theatre drape', unitValue: 36, maxCycles: 75, co2New: 5.2, co2Cycle: 0.58, waterCycle: 8, depts: ['THEATRES'] },
  { sku: 'BLK-WV', code: 'BLK', name: 'Woven blanket', unitValue: 28, maxCycles: 120, co2New: 9.8, co2Cycle: 0.9, waterCycle: 18, depts: ['WARD', 'MAT', 'OPD'] },
  { sku: 'TRY-IN', code: 'TRY', name: 'Instrument tray set', unitValue: 310, maxCycles: 500, co2New: 38, co2Cycle: 2.2, waterCycle: 22, depts: ['THEATRES'] },
]

// ---------------------------------------------------------------- floor plans
export type XY = [number, number]
export interface PZone { id: string; name: string; x: number; y: number; w: number; h: number; kind: string; door?: XY; center: XY; outside?: boolean }
export interface PReader { id: string; at: XY; label: string; zone: string }
export interface Plan { id: 'H' | 'D'; w: number; h: number; zones: PZone[]; readers: PReader[]; corridor?: { x: number; y: number; w: number; h: number }; path: (a: string, b: string) => { pts: XY[]; readers: string[] } }

const z = (id: string, name: string, x: number, y: number, w: number, h: number, kind: string, door?: XY, outside = false): PZone =>
  ({ id, name, x, y, w, h, kind, door, outside, center: [x + w / 2, y + h / 2] })

const hz: PZone[] = [
  z('THEATRES', 'Operating Theatres', 100, 50, 230, 240, 'clinical', [215, 290]),
  z('ICU', 'Intensive Care', 340, 50, 200, 240, 'clinical', [440, 290]),
  z('WARD', 'General Ward', 550, 50, 220, 240, 'clinical', [660, 290]),
  z('MAT', 'Maternity', 780, 50, 240, 240, 'clinical', [900, 290]),
  z('DOCK', 'Goods-In Dock', 100, 350, 180, 240, 'dock', [190, 350]),
  z('LINEN', 'Clean Linen Store', 290, 350, 150, 240, 'store', [365, 350]),
  z('DIRTY', 'Dirty Utility · RFID Cages', 450, 350, 180, 240, 'dirty', [540, 350]),
  z('AE', 'Emergency (A&E)', 640, 350, 190, 240, 'clinical', [735, 350]),
  z('OPD', 'Outpatients', 840, 350, 180, 240, 'clinical', [930, 350]),
  z('YARD', 'Loading Yard', 0, 440, 60, 60, 'outside', undefined, true),
  z('STREET', 'Main Entrance / Street', 1075, 290, 65, 60, 'outside', undefined, true),
]
const hById = Object.fromEntries(hz.map((q) => [q.id, q]))
const hOut = (id: string): XY[] => {
  const q = hById[id]
  if (id === 'YARD') return [q.center, [100, 470], hById.DOCK.center, [190, 350], [190, 320]]
  if (id === 'STREET') return [q.center, [1070, 320]]
  return [q.center, q.door!, [q.door![0], 320]]
}
const hReaderOf = (id: string) => ({ THEATRES: 'R-THEA', ICU: 'R-ICU', WARD: 'R-WARD', MAT: 'R-MAT', DOCK: 'R-DOCK', LINEN: 'R-LINEN', DIRTY: 'R-DIRTY', AE: 'R-AE', OPD: 'R-OPD', STREET: 'R-MAIN', YARD: 'R-YARD' } as Record<string, string>)[id]

export const HOSPITAL_PLAN: Plan = {
  id: 'H', w: 1140, h: 620, zones: hz, corridor: { x: 100, y: 290, w: 975, h: 60 },
  readers: [
    { id: 'R-YARD', at: [100, 470], label: 'Dock external door', zone: 'DOCK' },
    { id: 'R-DOCK', at: [190, 350], label: 'Dock → corridor', zone: 'DOCK' },
    { id: 'R-LINEN', at: [365, 350], label: 'Linen store door', zone: 'LINEN' },
    { id: 'R-DIRTY', at: [540, 350], label: 'Dirty utility door', zone: 'DIRTY' },
    { id: 'R-CAGE', at: [540, 520], label: 'Cage bay (in-cage)', zone: 'DIRTY' },
    { id: 'R-THEA', at: [215, 290], label: 'Theatres entrance', zone: 'THEATRES' },
    { id: 'R-ICU', at: [440, 290], label: 'ICU entrance', zone: 'ICU' },
    { id: 'R-WARD', at: [660, 290], label: 'General ward entrance', zone: 'WARD' },
    { id: 'R-MAT', at: [900, 290], label: 'Maternity entrance', zone: 'MAT' },
    { id: 'R-AE', at: [735, 350], label: 'A&E entrance', zone: 'AE' },
    { id: 'R-OPD', at: [930, 350], label: 'Outpatients entrance', zone: 'OPD' },
    { id: 'R-MAIN', at: [1070, 320], label: 'Main entrance (exit control)', zone: 'STREET' },
  ],
  path(a, b) {
    if ((a === 'YARD' && b === 'DOCK') || (a === 'DOCK' && b === 'YARD')) {
      const p: XY[] = [hById.YARD.center, [100, 470], hById.DOCK.center]
      return { pts: a === 'YARD' ? p : p.reverse(), readers: ['R-YARD'] }
    }
    const pa = hOut(a), pb = hOut(b).slice().reverse()
    const rs = [a, b].map(hReaderOf).filter((r, i, arr) => r && arr.indexOf(r) === i)
    // moving through dock for YARD routes crosses the dock corridor door too
    if (a === 'YARD' || b === 'YARD') rs.push('R-DOCK')
    return { pts: [...pa, ...pb], readers: rs }
  },
}

const dOrder = ['D_YARD', 'D_RECV', 'D_SORT', 'D_WASH', 'D_DRY', 'D_QA', 'D_PACK', 'D_OUT']
const dz: PZone[] = [
  z('D_YARD', 'Inbound Yard', 0, 120, 70, 120, 'outside', undefined, true),
  z('D_RECV', 'Receiving & RFID Gate', 80, 60, 150, 240, 'dirty', [80, 180]),
  z('D_SORT', 'Soil Sort', 240, 60, 150, 240, 'dirty', [235, 180]),
  z('D_WASH', 'Tunnel Washers', 400, 60, 220, 240, 'dirty', [395, 180]),
  z('D_DRY', 'Dry · Finish · Fold', 630, 60, 170, 240, 'clean', [625, 180]),
  z('D_QA', 'QA & RFID Verify', 810, 60, 140, 240, 'clean', [805, 180]),
  z('D_PACK', 'Pack & Dispatch Bay', 960, 60, 150, 240, 'clean', [955, 180]),
  z('D_OUT', 'Outbound Yard', 1120, 120, 70, 120, 'outside', undefined, true),
]
const dById = Object.fromEntries(dz.map((q) => [q.id, q]))
export const DECON_PLAN: Plan = {
  id: 'D', w: 1200, h: 360, zones: dz,
  readers: [
    { id: 'R-D-GATE', at: [80, 180], label: 'Receiving gate', zone: 'D_RECV' },
    { id: 'R-D-SORT', at: [235, 180], label: 'Sort line entry', zone: 'D_SORT' },
    { id: 'R-D-WASH', at: [395, 180], label: 'Tunnel washer feed', zone: 'D_WASH' },
    { id: 'R-D-BARR', at: [625, 180], label: 'Barrier (dirty → clean)', zone: 'D_DRY' },
    { id: 'R-D-QA', at: [805, 180], label: 'QA verification', zone: 'D_QA' },
    { id: 'R-D-PACK', at: [955, 180], label: 'Pack station', zone: 'D_PACK' },
    { id: 'R-D-OUT', at: [1115, 180], label: 'Dispatch gate', zone: 'D_OUT' },
  ],
  path(a, b) {
    const i = dOrder.indexOf(a), j = dOrder.indexOf(b)
    const step = i < j ? 1 : -1
    const pts: XY[] = [dById[a].center]
    const readers: string[] = []
    const rd = (zid: string) => DECON_PLAN.readers.find((r) => r.zone === zid)!
    for (let k = i; k !== j; k += step) {
      const entering = dOrder[k + step]
      const boundary = step === 1 ? rd(entering) : rd(dOrder[k])
      pts.push(boundary.at); readers.push(boundary.id)
      pts.push(dById[entering].center)
    }
    return { pts, readers }
  },
}
export const PLANS = { H: HOSPITAL_PLAN, D: DECON_PLAN }
export const ZONE_NAME: Record<string, string> = Object.fromEntries([...hz, ...dz].map((q) => [q.id, q.name]))

// ---------------------------------------------------------------- vehicles
export interface Vehicle { id: string; reg: string; driver: string; imei: string; simulated: boolean; role: string; color: string; model: string }
export const VEHICLES: Vehicle[] = [
  { id: 'V1', reg: 'DP71 TRK', driver: 'Marcus Hale', imei: '862129084785066', simulated: false, role: 'Laundry shuttle (Decon ⇄ Hospital)', color: '#0ea5e9', model: 'Teltonika TAT240' },
  { id: 'V2', reg: 'LN22 GRL', driver: 'Priya Nair', imei: '862129084785074', simulated: true, role: 'Recycling run · RCY-A', color: '#16a34a', model: 'Teltonika TAT240' },
  { id: 'V3', reg: 'BX19 HLT', driver: 'Dmitri Volkov', imei: '862129084785082', simulated: true, role: 'Recycling run · RCY-B', color: '#e11d48', model: 'Teltonika TAT240' },
  { id: 'V4', reg: 'YC70 CRR', driver: 'Sam Okoro', imei: '862129084785090', simulated: true, role: 'Courier · equipment & clinic recycling', color: '#9333ea', model: 'Teltonika TAT240' },
  { id: 'V5', reg: 'SY24 CRT', driver: 'Amir Syed', imei: '862129084785108', simulated: true, role: 'Synergy curtain run', color: '#0d9488', model: 'Teltonika TAT240' },
]
export const VEH_BY_ID = Object.fromEntries(VEHICLES.map((v) => [v.id, v]))

export const SEV_ORDER = ['info', 'low', 'medium', 'high', 'critical'] as const
export type Sev = (typeof SEV_ORDER)[number]
