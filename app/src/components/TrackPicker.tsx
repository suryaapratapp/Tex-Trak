import { useMemo } from 'react'
import { useInfra } from '../lib/infra'
import { inputCls } from '../qr/ui'

export interface Tracking { vehicle: string; imei: string }
/** The one question about tracking: what travels with the shipment? A vehicle, a tracker or phone, or nothing. */
export function TrackPicker({ org, value, onChange }: { org: string; value: Tracking; onChange: (v: Tracking) => void }) {
  const vehicles = useInfra((x) => x.vehicles); const trackers = useInfra((x) => x.trackers)
  const vs = useMemo(() => vehicles.filter((v) => v.active && (v.org_id === org || v.org_id === null)), [vehicles, org])
  const ts = useMemo(() => trackers.filter((t) => t.active && (t.org_id === org || t.org_id === null)), [trackers, org])
  const known = value.vehicle && vs.some((v) => v.reg.toUpperCase() === value.vehicle.toUpperCase())
  const sel = value.imei ? `t:${value.imei}` : known ? `v:${value.vehicle.toUpperCase()}` : value.vehicle ? 'other' : ''
  const veh = known ? vs.find((v) => v.reg.toUpperCase() === value.vehicle.toUpperCase()) : undefined
  const pick = (k: string) => {
    if (k === '') onChange({ vehicle: '', imei: '' })
    else if (k === 'other') onChange({ vehicle: value.vehicle || ' ', imei: '' })
    else if (k.startsWith('v:')) onChange({ vehicle: k.slice(2), imei: '' })
    else onChange({ vehicle: '', imei: k.slice(2) })
  }
  const trk = value.imei ? ts.find((t) => t.imei === value.imei) : veh?.tracker_imei ? trackers.find((t) => t.imei === veh.tracker_imei) : undefined
  const hint = !sel ? 'Not tracked. You confirm dispatch and arrival yourself.'
    : trk ? `${trk.name}${trk.last_seen ? ` · last heard ${new Date(trk.last_seen).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ' · not heard yet'}. Dispatch and arrival are recorded automatically from where it is.`
    : veh && !veh.tracker_imei ? 'This vehicle has no tracker fitted, so you confirm dispatch and arrival yourself. Or pick a tracker or phone instead.'
    : sel === 'other' ? 'Type the registration. If it has no tracker you confirm dispatch and arrival yourself.' : ''
  return (
    <div className="space-y-2">
      <select value={sel} onChange={(e) => pick(e.target.value)} className={inputCls} aria-label="Tracked by">
        <option value="">Not tracked (I will confirm by hand)</option>
        {vs.length > 0 && <optgroup label="Vehicle">{vs.map((v) => <option key={v.id} value={`v:${v.reg.toUpperCase()}`}>{v.reg}{v.driver ? ` · ${v.driver}` : ''}{v.tracker_imei ? ' · tracker fitted' : ' · no tracker'}</option>)}</optgroup>}
        {ts.length > 0 && <optgroup label="Tracker or phone travelling with it">{ts.map((t) => <option key={t.imei} value={`t:${t.imei}`}>{t.name} ({t.kind === 'phone' ? 'phone' : 'tracker'})</option>)}</optgroup>}
        <option value="other">Another vehicle (type the registration)</option>
      </select>
      {sel === 'other' && <input value={value.vehicle.trim() === '' ? '' : value.vehicle} onChange={(e) => onChange({ vehicle: e.target.value.toUpperCase() || ' ', imei: '' })} placeholder="Registration, e.g. AB12 CDE" className={inputCls} />}
      <p className="text-[13px] text-stone-500">{hint}</p>
    </div>)
}
