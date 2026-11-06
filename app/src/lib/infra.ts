import { create } from 'zustand'
import { supabase } from './supabase'
import type { NetSite } from '../sim/registry'

export interface DbSite { id: string; code: string; name: string; kind: string; lat: number; lng: number; radius_m: number; org_id: string | null; region: string; floors: number; status: 'live' | 'provisioned' | 'planned'; address: string; source: 'seed' | 'admin' }
export interface DbReader { id: string; site_id: string; code: string; label: string; floor: string; position: string; online: boolean; last_seen: string | null; source: 'seed' | 'admin' }
export interface DbTracker { imei: string; name: string; model: string; vendor: string; serial_no: string | null; org_id: string | null; active: boolean; battery_pct: number | null; last_seen: string | null; created_at: string }
interface I { sites: DbSite[]; readers: DbReader[]; trackers: DbTracker[]; loaded: boolean; load: () => Promise<void> }
export const useInfra = create<I>((set) => ({
  sites: [], readers: [], trackers: [], loaded: false,
  load: async () => {
    const [s, r, t] = await Promise.all([supabase.from('sites').select('*').eq('source', 'admin').order('name'), supabase.from('readers').select('*').eq('source', 'admin').order('code'), supabase.from('trackers').select('*').order('created_at', { ascending: false })])
    set({ sites: (s.data ?? []) as DbSite[], readers: (r.data ?? []) as DbReader[], trackers: (t.data ?? []) as DbTracker[], loaded: true })
  },
}))
/** Admin-added sites in the same shape as the built-in network, so maps and counts can include them. */
export const toNet = (sites: DbSite[], readers: DbReader[]): NetSite[] => sites.map((s) => ({ id: s.id, name: s.name, kind: (s.kind === 'laundry' ? 'decon' : s.kind) as NetSite['kind'], client: s.org_id ?? 'shared', pos: [s.lat, s.lng], region: s.region, floors: s.floors, readers: readers.filter((r) => r.site_id === s.id).length, state: s.status, sim: false, radius: s.radius_m, note: s.address }))
