import { getWorld, SCANNERS, type Alert, type Consignment } from '../sim/engine'
import { VEHICLES } from '../sim/world'
import { consOwned, hasModule, type ModuleId, type Role } from '../sim/registry'

/** Which vehicles / consignments / alerts a given role may see. Super Admin sees everything. */
export const vehiclesFor = (role: Role) => VEHICLES.filter((v) => role === 'superadmin' || (role === 'clientA' ? v.id === 'V4' : v.id !== 'V4')).map((v) => v.id)
export const consFor = (role: Role): Consignment[] => getWorld().consignments.filter((c) => consOwned(role, c))
export const scannersFor = (role: Role) => (hasModule(role, 'assets') ? SCANNERS : [])
export function alertsFor(role: Role): Alert[] {
  const w = getWorld(); if (role === 'superadmin') return w.alerts
  const refs = new Set(consFor(role).map((c) => c.ref))
  return w.alerts.filter((a) => (a.subject.startsWith('SC-') ? role === 'clientA' : a.cons ? refs.has(a.cons) : role === 'synergy'))
}
export const can = (role: Role, m: ModuleId) => hasModule(role, m)
