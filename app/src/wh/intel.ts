import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { kvGet, kvSet } from '../lib/offline'
import { useWh, useWhOrg, type Prefill } from './store'

export interface ReorderRow { id: string; sku: string; name: string; uom: string; supplier: string; avail: number; vel: number; reorder_point: number; reorder_qty: number; lead_time_days: number; cover: number | null; sugg: number }
export interface Insights {
  summary: { skus: number; units: number; value: number; locations: number; open_orders: number; low: number; out_of_stock: number }
  reorder: ReorderRow[]
  abc: { a: number; b: number; c: number; idle: number; top: { id: string; sku: string; name: string; v: number; cls: string }[] }
  expiry: { expired: number; d30: number; d60: number; value_at_risk: number; rows: { item_id: string; sku: string; name: string; loc: string; lot: string; expiry: string; qty: number; days: number; val: number }[] }
  dead: { id: string; sku: string; name: string; qty: number; val: number; last_out: string | null }[]
  utilisation: { over: number; high: number; empty: number; rows: { code: string; name: string; capacity: number; used: number; pct: number }[] }
  variance: { code: string; name: string; n: number; units: number }[]
  anomalies: { created_at: string; kind: string; qty: number; reason: string | null; by_name: string; sku: string; name: string; loc: string | null }[]
  stuck: { status: string; sku: string; name: string; loc: string; qty: number; days: number }[]
  old_orders: { number: string; customer: string; days: number }[]
  count_next: { id: string; code: string; name: string; units: number; last_count: string | null; var_events: number }[]
}

export function useInsights(everyMs = 60000) {
  const org = useWhOrg(); const stockVersion = useWh((s) => s.stock)
  const [data, setData] = useState<Insights | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    if (!org) return
    const { data: d, error: e } = await supabase.rpc('wh_insights', { p_org: org })
    if (e) { const c = await kvGet<Insights>(`wh-ins:${org}`); if (c) { setData(c); setError('') } else setError(e.message) } else { setData(d as Insights); setError(''); void kvSet(`wh-ins:${org}`, d) }
    setLoading(false)
  }, [org])
  useEffect(() => { setLoading(true); void reload(); const id = setInterval(() => void reload(), everyMs); return () => clearInterval(id) }, [reload, everyMs])
  useEffect(() => { void reload() }, [stockVersion, reload])
  return { data, error, loading, reload }
}

export type Sev = 'critical' | 'high' | 'medium' | 'info'
export interface Focus { id: string; sev: Sev; title: string; why: string; page: string; label: string; prefill?: Prefill }
const RANK: Record<Sev, number> = { critical: 0, high: 1, medium: 2, info: 3 }
const n = (v: number) => Number(v).toLocaleString('en-GB', { maximumFractionDigits: 1 })

/** Turns the numbers into a short, ranked to-do list with the reason for each item. */
export function buildFocus(d: Insights): Focus[] {
  const f: Focus[] = []
  if (d.expiry.expired > 0) f.push({ id: 'expired', sev: 'critical', title: `${d.expiry.expired} lot${d.expiry.expired === 1 ? ' has' : 's have'} expired and ${d.expiry.expired === 1 ? 'is' : 'are'} still on the shelf`, why: 'Expired stock is blocked from picking, so it only takes up space. Write it off or send it back.', page: 'whinsights', label: 'See which' })
  if (d.summary.out_of_stock > 0) f.push({ id: 'oos', sev: 'high', title: `${d.summary.out_of_stock} item${d.summary.out_of_stock === 1 ? ' is' : 's are'} out of stock but still being used`, why: 'These had recent demand or a reorder level, and nothing is available now.', page: 'whinsights', label: 'Reorder list' })
  const first = d.reorder.find((r) => r.avail > 0)
  if (d.reorder.length > 0) f.push({ id: 'reorder', sev: d.reorder.some((r) => r.cover != null && r.cover < r.lead_time_days) ? 'high' : 'medium', title: `${d.reorder.length} item${d.reorder.length === 1 ? '' : 's'} should be reordered`, why: first ? `${first.name} has about ${first.cover != null ? n(first.cover) + ' days' : 'little'} of stock left; suppliers take ${first.lead_time_days} days.` : 'Stock is at or below the reorder level.', page: 'whinsights', label: 'Reorder list' })
  if (d.expiry.d30 > 0) f.push({ id: 'exp30', sev: 'high', title: `${d.expiry.d30} lot${d.expiry.d30 === 1 ? '' : 's'} expire within 30 days`, why: 'Goods out and Pack order pick the soonest expiry first, so these will go first. Check they can be used in time.', page: 'whinsights', label: 'Review' })
  if (d.anomalies.length > 0) f.push({ id: 'anom', sev: 'high', title: `${d.anomalies.length} unusually large adjustment${d.anomalies.length === 1 ? '' : 's'} this week`, why: 'Much bigger than the usual corrections here. Worth a quick check with whoever made them.', page: 'whledger', label: 'Open ledger' })
  if (d.stuck.length > 0) f.push({ id: 'stuck', sev: 'medium', title: `${d.stuck.length} line${d.stuck.length === 1 ? '' : 's'} stuck in repair or quarantine`, why: 'Repair for over 14 days, or quarantine for over a week. Decide: release, repair or write off.', page: 'whstock', label: 'Take action' })
  if (d.old_orders.length > 0) f.push({ id: 'oldord', sev: 'medium', title: `${d.old_orders.length} packed order${d.old_orders.length === 1 ? '' : 's'} waiting over 3 days`, why: `${d.old_orders[0].number} for ${d.old_orders[0].customer} has been waiting longest. Dispatch it, or unpack it to free the stock.`, page: 'whorders', label: 'Open orders' })
  if (d.utilisation.over > 0) f.push({ id: 'over', sev: 'medium', title: `${d.utilisation.over} location${d.utilisation.over === 1 ? ' is' : 's are'} over capacity`, why: 'More is stored there than its capacity allows. Move some to a quieter shelf.', page: 'whinsights', label: 'See where' })
  if (d.count_next.length > 0) { const c = d.count_next[0]; f.push({ id: 'count', sev: 'info', title: `Count ${c.code} next`, why: c.last_count ? `Last counted ${Math.round((Date.now() - new Date(c.last_count).getTime()) / 86400000)} days ago${c.var_events ? `, with ${c.var_events} recent correction${c.var_events === 1 ? '' : 's'}` : ''}.` : 'Never counted, and it holds stock.', page: 'whcount', label: 'Start count', prefill: { locId: c.id } }) }
  if (d.dead.length > 0) f.push({ id: 'dead', sev: 'info', title: `${d.dead.length} item${d.dead.length === 1 ? ' has' : 's have'} not moved in 90 days`, why: 'Stock that is not used ties up space and money. Consider returning, discounting or recycling it.', page: 'whinsights', label: 'See items' })
  return f.sort((a, b) => RANK[a.sev] - RANK[b.sev])
}
