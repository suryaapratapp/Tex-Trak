import { useState } from 'react'
import { Radar } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'
import { useInfra } from '../lib/infra'
import { btnGhost, btnPrimary } from '../qr/ui'
import { TrackPicker, type Tracking } from './TrackPicker'

interface S { id: string; org_id: string; from_name: string; to_name: string; vehicle_reg: string; tracker_imei?: string | null; status: string }
/** The tracker that follows a shipment: its own, or the one fitted to its vehicle. */
export const trackerOf = (s: Pick<S, 'vehicle_reg' | 'tracker_imei'>, vehicles: { reg: string; tracker_imei: string | null }[]) =>
  s.tracker_imei || vehicles.find((v) => s.vehicle_reg && v.reg.toUpperCase() === s.vehicle_reg.toUpperCase())?.tracker_imei || ''

/** Says in plain words how this shipment is followed, what will happen by itself, and what the user must do by hand. */
export function TrackingCard({ s, clash, onChange }: { s: S; clash: string[]; onChange: () => void }) {
  const { sites, trackers, vehicles } = useInfra(); const [edit, setEdit] = useState(false); const [v, setV] = useState<Tracking>({ vehicle: s.vehicle_reg, imei: s.tracker_imei ?? '' }); const [busy, setBusy] = useState(false)
  const imei = trackerOf(s, vehicles); const trk = trackers.find((t) => t.imei === imei)
  const siteOk = (n: string) => sites.some((x) => x.name.toLowerCase() === n.trim().toLowerCase() && (x.org_id === s.org_id || x.org_id === null))
  const age = trk?.last_seen ? Math.round((Date.now() - new Date(trk.last_seen).getTime()) / 60000) : null
  const lines: { tone: 'ok' | 'warn' | 'info'; text: string }[] = []
  if (!imei) lines.push({ tone: 'info', text: s.vehicle_reg ? `${s.vehicle_reg} has no tracker fitted. Press Dispatch when it leaves and Receive when it arrives.` : 'Not tracked. Press Dispatch when it leaves and Receive when it arrives.' })
  else {
    lines.push({ tone: age !== null && age <= 30 ? 'ok' : 'warn', text: `Following ${trk?.name ?? 'a tracker'}${age === null ? ', which has not been heard yet.' : age <= 30 ? `, last heard ${age < 2 ? 'just now' : `${age} minutes ago`}.` : `, last heard ${age > 90 ? `${Math.round(age / 60)} hours` : `${age} minutes`} ago. Nothing is recorded until it reports again.`}` })
    if (s.status === 'booked') lines.push({ tone: siteOk(s.from_name) ? 'ok' : 'warn', text: siteOk(s.from_name) ? `It dispatches by itself when it drives out of ${s.from_name}.` : `${s.from_name} is not one of your sites, so dispatch will not be automatic. Press Dispatch yourself.` })
    lines.push({ tone: siteOk(s.to_name) ? 'ok' : 'warn', text: siteOk(s.to_name) ? `Arrival is noted by itself when it reaches ${s.to_name}.` : `${s.to_name} is not one of your sites, so arrival will not be noticed. Press Receive when it arrives.` })
  }
  if (clash.length) lines.push({ tone: 'warn', text: `The same tracker is also on ${clash.join(', ')}. Each shipment is judged by its own From and To, so check they do not overlap.` })
  const save = async () => { setBusy(true); const { error } = await supabase.from('shipments').update({ vehicle_reg: v.vehicle.trim().toUpperCase(), tracker_imei: v.imei || null }).eq('id', s.id); setBusy(false); if (error) return toast.error(error.message); toast.ok('Tracking updated.'); setEdit(false); onChange() }
  return (
    <div className="mt-4 rounded-2xl border border-stone-100 bg-stone-50/70 p-4">
      <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-stone-400"><Radar size={14} /> Tracking</h3>{!edit && <button onClick={() => { setV({ vehicle: s.vehicle_reg, imei: s.tracker_imei ?? '' }); setEdit(true) }} className="text-[13.5px] font-bold text-cyan-700 hover:underline">Change</button>}</div>
      {!edit && <ul className="mt-2 space-y-1.5">{lines.map((l, i) => <li key={i} className={`flex gap-2 text-[14px] ${l.tone === 'warn' ? 'font-semibold text-amber-800' : l.tone === 'ok' ? 'text-stone-700' : 'text-stone-600'}`}><i className={`mt-2 h-2 w-2 shrink-0 rounded-full ${l.tone === 'warn' ? 'bg-amber-500' : l.tone === 'ok' ? 'bg-emerald-500' : 'bg-stone-300'}`} /><span>{l.text}</span></li>)}</ul>}
      {edit && <div className="mt-3 space-y-3"><TrackPicker org={s.org_id} value={v} onChange={setV} selfId={s.id} /><div className="flex gap-2"><button disabled={busy} onClick={() => void save()} className={btnPrimary}>Save</button><button onClick={() => setEdit(false)} className={btnGhost}>Cancel</button></div></div>}
    </div>)
}
