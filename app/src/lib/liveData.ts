import { create } from 'zustand'
import { supabase } from './supabase'

export type ItemStatus = 'clean' | 'in_stock' | 'in_use' | 'soiled' | 'in_cage' | 'in_transit' | 'processing' | 'missing'
export interface LItem { id: string; org_id: string; epc: string | null; qr: string | null; product: string; max_cycles: number; wash_cycles: number; value_gbp: number | null; status: ItemStatus; site_id: string | null; zone_id: string | null; last_seen_at: string | null; last_reader: string | null; created_at: string }
export interface LEvent { id: number; org_id: string; item_id: string | null; epc: string | null; type: string; status: string | null; detail: string; reader_code: string | null; site_id: string | null; zone_id: string | null; by_name: string; created_at: string }
export interface LZone { id: string; site_id: string; code: string; name: string; kind: string; floor: number | null }
export interface LReader { id: string; site_id: string; zone_id: string | null; code: string; label: string; floor: string; position: string; online: boolean; last_seen: string | null; source: string }
export interface LSite { id: string; code: string; name: string; kind: string; org_id: string | null; floors: number; source: string }
export interface LShip { id: string; ref: string; org_id: string; kind: string; from_name: string; to_name: string; description: string; items: number; status: string; planned_arrival: string | null; planned_dispatch: string | null; dispatched_at: string | null }

interface S { items: LItem[]; events: LEvent[]; zones: LZone[]; readers: LReader[]; sites: LSite[]; ships: LShip[]; loaded: boolean; load: () => Promise<void> }
export const useLiveData = create<S>((set) => ({
  items: [], events: [], zones: [], readers: [], sites: [], ships: [], loaded: false,
  load: async () => {
    const [i, e, z, r, s, sh] = await Promise.all([
      supabase.from('items').select('*').order('created_at', { ascending: false }).limit(5000),
      supabase.from('item_events').select('*').order('created_at', { ascending: false }).limit(400),
      supabase.from('zones').select('*').order('floor').order('name'),
      supabase.from('readers').select('*').order('code'),
      supabase.from('sites').select('id,code,name,kind,org_id,floors,source').order('name'),
      supabase.from('shipments').select('id,ref,org_id,kind,from_name,to_name,description,items,status,planned_arrival,planned_dispatch,dispatched_at').in('status', ['booked', 'in_transit', 'exception']).order('planned_arrival', { ascending: true, nullsFirst: false }).limit(200),
    ])
    set({ items: (i.data ?? []) as LItem[], events: (e.data ?? []) as LEvent[], zones: (z.data ?? []) as LZone[], readers: (r.data ?? []) as LReader[], sites: (s.data ?? []) as LSite[], ships: (sh.data ?? []) as LShip[], loaded: true })
  },
}))
export const ago = (iso: string | null) => { if (!iso) return 'never'; const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago` }
import { useEffect } from 'react'
/** Loads the live tables and keeps them fresh while a page is open. */
export function useLiveLoad(everyMs = 15000) {
  const load = useLiveData((s) => s.load)
  useEffect(() => { void load(); const id = setInterval(() => void load(), everyMs); return () => clearInterval(id) }, [load, everyMs])
}
