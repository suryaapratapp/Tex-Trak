import type { LL } from '../lib/geo'
import { HOSPITAL_PLAN, DECON_PLAN, SITES, type SiteKind } from './world'
import type { Consignment } from './engine'

export type ClientId = 'synergy' | 'clientA'
export type ModuleId = 'laundry' | 'curtains' | 'assets' | 'shipments' | 'recycling'
export interface Client { id: ClientId; name: string; tagline: string; color: string; plan: string; since: string; contact: string; modules: ModuleId[]; users: { name: string; role: string }[] }

export const MODULES: Record<ModuleId, { label: string; blurb: string }> = {
  laundry: { label: 'Laundry & arrivals', blurb: 'Reusable textiles, RFID doorways, ETA planning' },
  curtains: { label: 'Curtain installations', blurb: 'QR install / take-down on wards' },
  assets: { label: 'Community assets', blurb: 'High-value equipment on loan' },
  shipments: { label: 'Shipments', blurb: 'Any delivery or collection' },
  recycling: { label: 'Recycling proof', blurb: 'Did it reach the recycler?' },
}

export const CLIENTS: Record<ClientId, Client> = {
  synergy: { id: 'synergy', name: 'Synergy', tagline: 'Laundry, curtains and recycling services for hospitals', color: '#0b877d', plan: 'Enterprise', since: 'Jan 2026', contact: 'ops@synergy.example',
    modules: ['laundry', 'curtains', 'shipments', 'recycling'],
    users: [{ name: 'Amir Syed', role: 'Driver · scanner' }, { name: 'Priya Nair', role: 'Driver · scanner' }, { name: 'Laura Bennett', role: 'Operations manager' }, { name: 'Daniel Reyes', role: 'Plant supervisor' }] },
  clientA: { id: 'clientA', name: 'Client A', tagline: 'NHS trust · community equipment and clinic recycling', color: '#2f6fed', plan: 'Standard', since: 'Mar 2026', contact: 'logistics@clienta.example',
    modules: ['assets', 'shipments', 'recycling'],
    users: [{ name: 'Dr A. Rahman', role: 'Clinical lead' }, { name: 'Helen Ofori', role: 'Logistics manager' }, { name: 'Tom Walsh', role: 'Estates' }] },
}

export type Role = 'superadmin' | ClientId
export const ROLES: { id: Role; label: string; sub: string }[] = [
  { id: 'synergy', label: 'Synergy', sub: 'Demo client' },
  { id: 'clientA', label: 'Client A', sub: 'Demo client' },
  { id: 'superadmin', label: 'Super Admin', sub: 'All clients and sites' },
]

export type NetKind = SiteKind
export interface NetSite { id: string; name: string; kind: NetKind; client: ClientId | 'shared'; pos: LL; region: string; floors: number; readers: number; state: 'live' | 'provisioned' | 'planned'; sim: boolean; radius: number; note?: string }

const hospReaders = HOSPITAL_PLAN.readers.length
export const UPPER_FLOOR_READERS = 4 // 2 ward entrances + lift lobby + stair core, per upper floor
const mk = (id: string, name: string, kind: NetKind, client: NetSite['client'], pos: LL, region: string, floors: number, readers: number, state: NetSite['state'], radius = 250, note?: string): NetSite =>
  ({ id, name, kind, client, pos, region, floors, readers, state, sim: false, radius, note })

const simSite = (id: string, client: NetSite['client'], region: string, floors: number, readers: number, note?: string): NetSite => {
  const s = SITES[id]
  return { id, name: s.name, kind: s.kind, client, pos: s.pos, region, floors, readers, state: 'live', sim: true, radius: s.radius, note }
}

export const NETWORK: NetSite[] = [
  // ---- simulated sites (full live demo data)
  simSite('SYN', 'synergy', 'London', 1, 6, 'Curtain reprocessing · dispatch & receive'),
  simSite('HOSP', 'synergy', 'London', 4, hospReaders + 3 * UPPER_FLOOR_READERS, 'Ground floor RFID + floors 1–3'),
  simSite('DECON', 'shared', 'London', 1, DECON_PLAN.readers.length, 'Dirty → clean barrier readers'),
  simSite('RECY', 'shared', 'London', 1, 2, 'Weighbridge RFID'),
  simSite('PORT', 'shared', 'South East', 0, 0, 'Export terminal · restricted'),
  simSite('PORT2', 'shared', 'South East', 0, 0, 'Export terminal · restricted'),
  simSite('INCIN', 'shared', 'London', 0, 0, 'Energy-from-waste · restricted'),
  simSite('INCIN2', 'shared', 'London', 0, 0, 'Energy-from-waste · restricted'),
  simSite('HUB', 'clientA', 'London', 1, 3, 'Courier loading bay'),
  simSite('COMM', 'clientA', 'London', 1, 2, 'Community clinic'),
  // ---- Synergy: London & South East hospitals
  mk('H-ANS', "St Anselm Hospital", 'hospital', 'synergy', [51.5632, -0.1058], 'London', 5, 28, 'provisioned'),
  mk('H-HAR', 'Harrow General', 'hospital', 'synergy', [51.5836, -0.342], 'London', 4, 22, 'provisioned'),
  mk('H-EAL', 'Ealing Day Surgery', 'hospital', 'synergy', [51.513, -0.305], 'London', 2, 12, 'provisioned'),
  mk('H-BAR', 'Barnet Community Hospital', 'hospital', 'synergy', [51.6252, -0.2], 'London', 3, 16, 'provisioned'),
  mk('H-THV', 'Thames Valley Trust', 'hospital', 'synergy', [51.5105, -0.595], 'South East', 6, 34, 'provisioned'),
  mk('H-KNG', 'Kingsmead Care Group', 'hospital', 'synergy', [51.47, -0.45], 'London', 2, 10, 'planned'),
  mk('D-BHM', 'Decon Plant · Birmingham', 'decon', 'synergy', [52.4862, -1.8904], 'West Midlands', 1, 8, 'planned', 300),
  // ---- Client A: UK-wide
  mk('H-NGT', 'Northgate General Hospital', 'hospital', 'clientA', [53.4808, -2.2426], 'North West', 7, 38, 'provisioned'),
  mk('H-TYN', 'Tyneside General Hospital', 'hospital', 'clientA', [54.9783, -1.6178], 'North East', 5, 26, 'provisioned'),
  mk('H-MID', 'Midlands University Hospital', 'hospital', 'clientA', [52.4539, -1.9376], 'West Midlands', 8, 44, 'provisioned'),
  mk('H-SVN', 'Severn Valley Hospital', 'hospital', 'clientA', [51.4545, -2.5879], 'South West', 4, 20, 'provisioned'),
  mk('H-HIG', 'Highland Royal Infirmary', 'hospital', 'clientA', [55.9533, -3.1883], 'Scotland', 6, 30, 'planned'),
  mk('H-CBH', 'Cardiff Bay Hospital', 'hospital', 'clientA', [51.4816, -3.1791], 'Wales', 5, 24, 'planned'),
  mk('C-LDS', 'Leeds Community Clinic', 'community', 'clientA', [53.8008, -1.5491], 'Yorkshire', 1, 3, 'provisioned', 150),
  mk('D-MAN', 'Decon Plant · Manchester', 'decon', 'clientA', [53.4631, -2.2913], 'North West', 1, 8, 'provisioned', 300),
  // ---- shared recycling, ports, energy-from-waste (UK)
  mk('R-WKF', 'Northern Fibre Recovery', 'recycler', 'shared', [53.683, -1.4977], 'Yorkshire', 1, 2, 'provisioned', 400, 'Wakefield'),
  mk('R-SVN', 'Severn Textile Recovery', 'recycler', 'shared', [51.5, -2.55], 'South West', 1, 2, 'provisioned', 400, 'Avonmouth'),
  mk('P-FXT', 'Port of Felixstowe', 'port', 'shared', [51.9536, 1.3513], 'East of England', 0, 0, 'live', 1200, 'Export terminal · restricted'),
  mk('P-SOU', 'Port of Southampton', 'port', 'shared', [50.8965, -1.4344], 'South East', 0, 0, 'live', 1200, 'Export terminal · restricted'),
  mk('P-IMM', 'Port of Immingham', 'port', 'shared', [53.6314, -0.2037], 'Yorkshire', 0, 0, 'live', 1200, 'Export terminal · restricted'),
  mk('P-LIV', 'Port of Liverpool', 'port', 'shared', [53.4437, -3.0152], 'North West', 0, 0, 'live', 1200, 'Export terminal · restricted'),
  mk('P-DVR', 'Port of Dover', 'port', 'shared', [51.1279, 1.3134], 'South East', 0, 0, 'live', 1200, 'Export terminal · restricted'),
  mk('I-TYS', 'Tyseley Energy Recovery', 'incinerator', 'shared', [52.4553, -1.8408], 'West Midlands', 0, 0, 'live', 350, 'Energy-from-waste · restricted'),
  mk('I-SHF', 'Sheffield Energy Recovery', 'incinerator', 'shared', [53.3994, -1.4405], 'Yorkshire', 0, 0, 'live', 350, 'Energy-from-waste · restricted'),
  mk('I-MAN', 'Greater Manchester Energy Recovery', 'incinerator', 'shared', [53.4742, -2.4067], 'North West', 0, 0, 'live', 350, 'Energy-from-waste · restricted'),
]

export const KIND_LABEL: Record<string, string> = { facility: 'Facility', hospital: 'Hospital', decon: 'Decon plant', recycler: 'Recycling plant', port: 'Port (export)', incinerator: 'Incinerator', hub: 'Logistics hub', community: 'Community site' }
export const KIND_COLOR: Record<string, string> = { facility: '#0f766e', hospital: '#0e7490', decon: '#1d4ed8', recycler: '#15803d', port: '#be123c', incinerator: '#c2410c', hub: '#6d28d9', community: '#b45309' }
export const KIND_GLYPH: Record<string, string> = { facility: '▣', hospital: '✚', decon: '◈', recycler: '♻', port: '⚓', incinerator: '♨', hub: '⬢', community: '●' }
export const isRestricted = (k: string) => k === 'port' || k === 'incinerator'

export const clientNet = (role: Role) => (role === 'superadmin' ? NETWORK : NETWORK.filter((n) => n.client === role || n.client === 'shared'))
export const hasModule = (role: Role, m: ModuleId) => role === 'superadmin' || CLIENTS[role].modules.includes(m)
export const consOwned = (role: Role, c: Consignment) => role === 'superadmin' || c.client === role

export const totals = (list: NetSite[]) => ({
  sites: list.length,
  hospitals: list.filter((n) => n.kind === 'hospital').length,
  readers: list.reduce((a, n) => a + n.readers, 0),
  floors: list.reduce((a, n) => a + n.floors, 0),
  restricted: list.filter((n) => isRestricted(n.kind)).length,
  recyclers: list.filter((n) => n.kind === 'recycler').length,
})
