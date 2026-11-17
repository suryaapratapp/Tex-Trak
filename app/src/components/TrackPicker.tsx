import { useEffect, useMemo, useState } from 'react'
import { Ban, Car, Radio, Smartphone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useInfra } from '../lib/infra'
import { inputCls } from '../qr/ui'

export interface Tracking { vehicle: string; imei: string }
type Mode = 'vehicle' | 'gnss' | 'phone' | 'none'
const ago = (iso: string | null) => { if (!iso) return null; const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return { m, text: m < 2 ? 'just now' : m < 90 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago` } }

/** What travels with the shipment: a vehicle, a GNSS tracker, a mobile phone, or nothing. Each kind has its own list. */
export function TrackPicker({ org, value, onChange, selfId }: { org: string; value: Tracking; onChange: (v: Tracking) => void; selfId?: string }) {
  const vehicles = useInfra((x) => x.vehicles); const trackers = useInfra((x) => x.trackers)
  const vs = useMemo(() => vehicles.filter((v) => v.active && (v.org_id === org || v.org_id === null)), [vehicles, org])
  const mine = useMemo(() => trackers.filter((t) => t.active && (t.org_id === org || t.org_id === null)), [trackers, org])
  const fitted = useMemo(() => new Set(vs.map((v) => v.tracker_imei).filter(Boolean)), [vs])
  const gnss = useMemo(() => mine.filter((t) => t.kind !== 'phone' && !fitted.has(t.imei)), [mine, fitted])
  const phones = useMemo(() => mine.filter((t) => t.kind === 'phone'), [mine])
  const [open, setOpen] = useState<{ id: string; ref: string; vehicle_reg: string; tracker_imei: string | null }[]>([])
  useEffect(() => { let off = false; void supabase.from('shipments').select('id,ref,vehicle_reg,tracker_imei').in('status', ['booked', 'in_transit']).then(({ data }) => { if (!off) setOpen((data ?? []) as typeof open) }); return () => { off = true } }, [org])
  const busyBy = (imei: string | null, reg?: string) => { const r = open.find((o) => o.id !== selfId && ((imei && (o.tracker_imei === imei || vs.find((v) => v.reg.toUpperCase() === o.vehicle_reg.toUpperCase())?.tracker_imei === imei)) || (reg && o.vehicle_reg.toUpperCase() === reg.toUpperCase()))); return r?.ref }
  const known = !!value.vehicle.trim() && vs.some((v) => v.reg.toUpperCase() === value.vehicle.trim().toUpperCase())
  const derived: Mode = value.imei ? (phones.some((t) => t.imei === value.imei) ? 'phone' : 'gnss') : value.vehicle.trim() ? 'vehicle' : 'none'
  const [mode, setMode] = useState<Mode>(derived)
  useEffect(() => { if (derived !== 'none') setMode(derived) }, [derived])
  const other = mode === 'vehicle' && !!value.vehicle.trim() && !known
  const pickMode = (m: Mode) => { setMode(m); if (m === 'none') onChange({ vehicle: '', imei: '' }); else if (m !== derived) onChange({ vehicle: '', imei: '' }) }
  const tabs: { id: Mode; label: string; icon: React.ReactNode; n?: number }[] = [{ id: 'vehicle', label: 'Vehicle', icon: <Car size={16} />, n: vs.length }, { id: 'gnss', label: 'GNSS tracker', icon: <Radio size={16} />, n: gnss.length }, { id: 'phone', label: 'Mobile phone', icon: <Smartphone size={16} />, n: phones.length }, { id: 'none', label: 'Not tracked', icon: <Ban size={16} /> }]
  const Row = ({ on, onPick, title, sub, imei, warn }: { on: boolean; onPick: () => void; title: string; sub?: string; imei?: string | null; warn?: string }) => {
    const a = ago(imei ? mine.find((t) => t.imei === imei)?.last_seen ?? null : null); const bat = imei ? mine.find((t) => t.imei === imei)?.battery_pct : null
    return <button type="button" onClick={onPick} className={`flex w-full items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-left transition ${on ? 'border-cyan-600 bg-cyan-50' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-cyan-600' : 'border-stone-300'}`}>{on && <i className="h-2.5 w-2.5 rounded-full bg-cyan-600" />}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-bold text-stone-900">{title}</span>{(sub || warn) && <span className={`block truncate text-[12.5px] ${warn ? 'font-semibold text-amber-700' : 'text-stone-500'}`}>{warn ?? sub}</span>}</span>
      {imei !== undefined && <span className="shrink-0 text-right text-[12px] leading-tight"><span className={`flex items-center justify-end gap-1.5 font-semibold ${a && a.m <= 30 ? 'text-emerald-700' : a ? 'text-amber-700' : 'text-stone-400'}`}><i className={`h-2 w-2 rounded-full ${a && a.m <= 30 ? 'bg-emerald-500' : a ? 'bg-amber-500' : 'bg-stone-300'}`} />{a ? a.text : imei ? 'not heard yet' : 'no tracker'}</span>{bat != null && <span className="text-stone-400">{bat}% battery</span>}</span>}
    </button>
  }
  const empty = (t: string) => <p className="rounded-xl bg-stone-50 p-3.5 text-[13.5px] text-stone-500">{t}</p>
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{tabs.map((t) => <button key={t.id} type="button" onClick={() => pickMode(t.id)} className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-center text-[13px] font-bold transition ${mode === t.id ? 'border-cyan-600 bg-white text-cyan-800 shadow-sm' : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-white'}`}>{t.icon}<span className="leading-tight">{t.label}</span>{t.n !== undefined && <span className="text-[11.5px] font-semibold text-stone-400">{t.n} available</span>}</button>)}</div>
      {mode === 'vehicle' && <div className="space-y-2">
        {vs.map((v) => { const t = v.tracker_imei; const b = busyBy(t, v.reg); return <Row key={v.id} on={value.vehicle.trim().toUpperCase() === v.reg.toUpperCase() && !value.imei} onPick={() => onChange({ vehicle: v.reg.toUpperCase(), imei: '' })} title={v.reg} sub={[v.driver, v.role].filter(Boolean).join(' · ') || undefined} imei={t ?? null} warn={b ? `Already on ${b}` : undefined} /> })}
        <Row on={other} onPick={() => onChange({ vehicle: ' ', imei: '' })} title="Another vehicle" sub="Type its registration. No tracker, so you confirm by hand." />
        {other && <input autoFocus value={value.vehicle.trim() === '' ? '' : value.vehicle} onChange={(e) => onChange({ vehicle: e.target.value.toUpperCase() || ' ', imei: '' })} placeholder="Registration, e.g. AB12 CDE" className={inputCls} />}
      </div>}
      {mode === 'gnss' && <div className="space-y-2">{gnss.length === 0 ? empty('No stand-alone GNSS trackers added yet. Super Admin adds them under Trackers.') : gnss.map((t) => <Row key={t.imei} on={value.imei === t.imei} onPick={() => onChange({ vehicle: '', imei: t.imei })} title={t.name} sub={t.model || 'GNSS tracker'} imei={t.imei} warn={busyBy(t.imei) ? `Already on ${busyBy(t.imei)}` : undefined} />)}<p className="px-1 text-[12.5px] text-stone-400">A tracker placed in the load or on the cage. Trackers fitted to a vehicle are under Vehicle.</p></div>}
      {mode === 'phone' && <div className="space-y-2">{phones.length === 0 ? empty('No phones are recording yet. A phone appears here once its owner has signed in on the Tex-Trak app and allowed location.') : phones.map((t) => <Row key={t.imei} on={value.imei === t.imei} onPick={() => onChange({ vehicle: '', imei: t.imei })} title={t.name} sub={t.model || 'Mobile phone'} imei={t.imei} warn={busyBy(t.imei) ? `Already on ${busyBy(t.imei)}` : undefined} />)}<p className="px-1 text-[12.5px] text-stone-400">The driver&rsquo;s phone. Best on the Android app, which keeps recording with the screen off.</p></div>}
      {mode === 'none' && empty('Not tracked. You press Dispatch when it leaves and Mark as arrived when it gets there.')}
    </div>)
}
