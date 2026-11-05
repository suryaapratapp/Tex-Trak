import { useEffect, useState } from 'react'
import { supabase, TAT240_IMEI } from './supabase'

export interface LiveFix { ts: string; lat: number; lng: number; speed_kmh: number; heading: number; satellites: number | null; fix_valid?: boolean; hdop: number | null; battery_mv: number | null; gsm_signal: number | null }
/** Streams the physical Teltonika TAT240 (IMEI 862129084785066) from Supabase Realtime. */
export function useLiveTracker() {
  const [fix, setFix] = useState<LiveFix | null>(null)
  const [db, setDb] = useState<'connecting' | 'ok' | 'error'>('connecting')
  const [count, setCount] = useState(0)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data, error } = await supabase.from('tracker_positions').select('*').eq('imei', TAT240_IMEI).order('ts', { ascending: false }).limit(1)
      if (!alive) return
      if (error) { setDb('error'); return }
      setDb('ok'); if (data?.[0]) setFix(data[0] as LiveFix)
      const c = await supabase.from('tracker_positions').select('id', { count: 'exact', head: true }).eq('imei', TAT240_IMEI)
      if (alive && c.count != null) setCount(c.count)
    })()
    const ch = supabase.channel(`tat240-${Math.random().toString(36).slice(2)}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tracker_positions', filter: `imei=eq.${TAT240_IMEI}` }, (p) => { setFix(p.new as LiveFix); setCount((n) => n + 1) }).subscribe()
    return () => { alive = false; supabase.removeChannel(ch) }
  }, [])
  return { fix, db, count }
}
