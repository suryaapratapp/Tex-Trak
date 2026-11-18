import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, CheckCircle2, ChevronDown, Clock3, History, TriangleAlert, UserRound, X } from 'lucide-react'
import { Card } from '../components/ui'
import { TrackPicker, type Tracking } from '../components/TrackPicker'
import { supabase } from '../lib/supabase'
import { useInfra } from '../lib/infra'
import { toast } from '../lib/toast'
import { btnGhost, btnPrimary, Field, inputCls, Notice } from '../qr/ui'
import type { ShipStart } from '../lib/shipDraft'
import { ShipmentContents, summarise, type Line } from './ShipmentContents'

export const KINDS: Record<string, string> = { delivery: 'Delivery', collection: 'Collection', recycling: 'Recycling load', equipment: 'Equipment', other: 'Other' }
const norm = (s: string) => s.toLowerCase().replace(/\b(limited|ltd|plc|llc|inc|co|the)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }
const load = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null } catch { return null } }
interface Opt { name: string; kind: 'customer' | 'site' | 'recent' }

/** A place: type anything, or pick a customer, a marked site or somewhere you have used before. */
function PlaceField({ label, value, onChange, options, hint, tone }: { label: string; value: string; onChange: (v: string) => void; options: Opt[]; hint?: React.ReactNode; tone?: 'ok' | 'warn' | 'info' }) {
  const [open, setOpen] = useState(false); const q = value.trim().toLowerCase()
  const list = (q ? options.filter((o) => o.name.toLowerCase().includes(q) && o.name.toLowerCase() !== q) : options).slice(0, 8)
  const icon = (k: Opt['kind']) => (k === 'customer' ? <UserRound size={15} /> : k === 'site' ? <Building2 size={15} /> : <History size={15} />)
  return (
    <Field label={label} required>
      <div className="relative">
        <input value={value} onChange={(e) => { onChange(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} className={inputCls} autoComplete="off" placeholder="Choose or type a place" />
        {open && list.length > 0 && <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-1 shadow-xl">{list.map((o) => <li key={o.kind + o.name}><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(o.name); setOpen(false) }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-cyan-50"><span className="text-stone-400">{icon(o.kind)}</span><span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-stone-800">{o.name}</span><span className="shrink-0 text-[11.5px] font-bold uppercase tracking-wider text-stone-400">{o.kind === 'customer' ? 'Customer' : o.kind === 'site' ? 'Site' : 'Used before'}</span></button></li>)}</ul>}
      </div>
      {hint && <p className={`mt-1.5 flex items-start gap-1.5 text-[13px] ${tone === 'warn' ? 'font-semibold text-amber-700' : tone === 'ok' ? 'text-emerald-700' : 'text-stone-500'}`}>{tone === 'ok' ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : tone === 'warn' ? <TriangleAlert size={15} className="mt-0.5 shrink-0" /> : null}<span>{hint}</span></p>}
    </Field>)
}

export function NewShipment({ org, onDone, onCancel, start }: { org: string; onDone: (id: string) => void; onCancel: () => void; start?: ShipStart | null }) {
  const [lines, setLines] = useState<Line[]>([]); const [f, setF] = useState({ kind: 'delivery', from: '', to: '', carrier: '', desc: '', items: '1', weight: '', pd: '', pa: '' })
  const [trk, setTrk] = useState<Tracking>({ vehicle: '', imei: '' }); const [custs, setCusts] = useState<{ id: string; name: string }[]>([]); const [manualCust, setManualCust] = useState<string | null>(null)
  const [recent, setRecent] = useState<{ from_name: string; to_name: string }[]>([]); const [more, setMore] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const touched = useRef({ to: false, from: false, track: false }); const [fromLines, setFromLines] = useState('')
  const sites = useInfra((x) => x.sites); const trackers = useInfra((x) => x.trackers); const vehicles = useInfra((x) => x.vehicles); const infraLoaded = useInfra((x) => x.loaded)
  useEffect(() => { void useInfra.getState().load() }, [])
  useEffect(() => { let off = false; void supabase.rpc('shipment_customers', { p_org: org }).then(({ data }) => { if (!off) setCusts((data ?? []) as { id: string; name: string }[]) }); void supabase.from('shipments').select('from_name,to_name').eq('org_id', org).order('created_at', { ascending: false }).limit(40).then(({ data }) => { if (!off) setRecent((data ?? []) as typeof recent) }); return () => { off = true } }, [org])
  const mySites = useMemo(() => [...new Map(sites.filter((x) => x.org_id === org || x.org_id === null).map((x) => [x.name, x])).values()].sort((a, b) => a.name.localeCompare(b.name)), [sites, org])
  const count = lines.length ? Math.max(1, Math.round(lines.reduce((a, l) => a + l.qty, 0))) : Math.round(+f.items || 0)

  // What is going decides where it is going: the destination of the packed order or goods out fills the To box.
  const dests = useMemo(() => [...new Set(lines.map((l) => l.to?.trim()).filter((x): x is string => !!x))], [lines])
  const canon = (name: string) => custs.find((c) => norm(c.name) === norm(name))?.name ?? mySites.find((x) => norm(x.name) === norm(name))?.name ?? name
  useEffect(() => {
    if (touched.current.to) return
    if (dests.length === 1) { setF((x) => ({ ...x, to: canon(dests[0]) })); setFromLines(lines.find((l) => l.to?.trim() === dests[0])?.label.split(' · ')[0] ?? '') }
    else if (dests.length === 0 && !lines.length) setFromLines('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dests.join('|'), custs.length, mySites.length])

  // Remember and restore the last From and tracking; with only one choice, choose it.
  useEffect(() => {
    if (touched.current.from || f.from) return
    const last = load<string>(`ship-from:${org}`); if (last && (mySites.some((x) => x.name === last) || !mySites.length)) setF((x) => ({ ...x, from: last }))
    else if (infraLoaded && mySites.length === 1) setF((x) => ({ ...x, from: mySites[0].name }))
    else if (!last && recent[0]?.from_name) setF((x) => ({ ...x, from: recent[0].from_name }))
  }, [mySites, infraLoaded, recent, org]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (touched.current.track || !infraLoaded || trk.vehicle || trk.imei) return
    const last = load<Tracking>(`ship-track:${org}`)
    if (last && ((last.imei && trackers.some((t) => t.imei === last.imei)) || (last.vehicle && vehicles.some((v) => v.reg.toUpperCase() === last.vehicle.toUpperCase())))) { setTrk(last); return }
    const vt = vehicles.filter((v) => v.active && v.tracker_imei); if (vt.length === 1) setTrk({ vehicle: vt[0].reg.toUpperCase(), imei: '' })
  }, [infraLoaded, vehicles, trackers, org]) // eslint-disable-line react-hooks/exhaustive-deps

  const options = (skip?: string): Opt[] => {
    const seen = new Set<string>(); const out: Opt[] = []; const add = (name: string, kind: Opt['kind']) => { const k = norm(name); if (!name.trim() || seen.has(k) || (skip && norm(skip) === k)) return; seen.add(k); out.push({ name, kind }) }
    custs.forEach((c) => add(c.name, 'customer')); mySites.forEach((x) => add(x.name, 'site')); recent.forEach((r) => { add(r.from_name, 'recent'); add(r.to_name, 'recent') }); return out
  }
  const toSite = mySites.find((x) => norm(x.name) === norm(f.to)); const fromSite = mySites.find((x) => norm(x.name) === norm(f.from))
  const custMatch = custs.find((c) => norm(c.name) === norm(f.to)); const custId = manualCust ?? custMatch?.id ?? ''
  const tracked = !!(trk.imei || (trk.vehicle.trim() && vehicles.find((v) => v.reg.toUpperCase() === trk.vehicle.trim().toUpperCase())?.tracker_imei))
  const auto = tracked && !!fromSite && !!toSite
  const trackName = trk.imei ? trackers.find((t) => t.imei === trk.imei)?.name : trk.vehicle.trim()
  const problems = [!lines.length && !(+f.items > 0) ? 'say what is going' : '', !f.from.trim() ? 'choose where from' : '', !f.to.trim() ? 'choose where to' : ''].filter(Boolean)

  const submit = async () => {
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('shipment_book', { p_org: org, p_kind: f.kind, p_from: f.from.trim(), p_to: f.to.trim(), p_carrier: f.carrier.trim(), p_vehicle: trk.vehicle.trim().toUpperCase(), p_desc: f.desc.trim() || summarise(lines), p_items: count || 1, p_lines: lines.length ? lines.map((l) => ({ source: l.source, ref: l.ref, label: l.label, qty: l.qty })) : null, p_weight: f.weight ? +f.weight : null, p_planned_dispatch: f.pd ? new Date(f.pd).toISOString() : null, p_planned_arrival: f.pa ? new Date(f.pa).toISOString() : null, p_customer: custId || null })
    if (error) { setBusy(false); return setErr(error.message) }
    const id = (data as { id: string }).id
    if (trk.imei) await supabase.from('shipments').update({ tracker_imei: trk.imei }).eq('id', id)
    save(`ship-from:${org}`, f.from.trim()); save(`ship-track:${org}`, trk)
    if (custId) toast.info('Booked. Copy the customer link from the shipment.')
    setBusy(false); onDone(id)
  }
  const num = (n: number) => n.toLocaleString('en-GB')
  const step = (n: number, t: string, sub?: string) => <div className="mb-2.5 flex items-start gap-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cyan-600 text-[13px] font-extrabold text-white">{n}</span><div><h3 className="text-[16px] font-extrabold leading-tight text-stone-900">{t}</h3>{sub && <p className="text-[13px] text-stone-500">{sub}</p>}</div></div>
  return (
    <Card className="mb-5 space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between"><h2 className="text-[19px] font-extrabold text-stone-900">New shipment</h2><button onClick={onCancel} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-stone-100"><X size={16} /></button></div>

      <section>{step(1, 'What is going?', 'Pick what you packed. Where it is going fills in by itself.')}
        <ShipmentContents org={org} lines={lines} setLines={(l) => { setLines(l); touched.current.to = false }} start={start} />
        {!lines.length && <div className="mt-2 flex items-center gap-2 text-[13.5px] text-stone-500">Nothing to pick? Number of items: <input value={f.items} onChange={(e) => setF({ ...f, items: e.target.value.replace(/\D/g, '') })} inputMode="numeric" aria-label="Number of items" className={`${inputCls} !h-10 !w-24`} /></div>}
      </section>

      <section>{step(2, 'From and to', 'Pick marked sites and customers so Tex-Trak can follow it by itself.')}
        {dests.length > 1 && <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-[13.5px] text-amber-900"><b>These go to different places.</b> A shipment has one destination, so choose which one this is for, then book the rest separately.<div className="mt-2 flex flex-wrap gap-1.5">{dests.map((d) => <button key={d} type="button" onClick={() => { touched.current.to = true; setF({ ...f, to: canon(d) }) }} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[13px] font-bold hover:bg-amber-100">{d}</button>)}</div></div>}
        <div className="grid gap-4 md:grid-cols-2">
          <PlaceField label="From" value={f.from} onChange={(v) => { touched.current.from = true; setF({ ...f, from: v }) }} options={options(f.to)} tone={fromSite ? 'ok' : f.from.trim() ? 'warn' : undefined} hint={fromSite ? 'Marked site. It is dispatched by itself when the tracker leaves.' : f.from.trim() ? 'Not a marked site, so you press Dispatch yourself.' : undefined} />
          <PlaceField label="To" value={f.to} onChange={(v) => { touched.current.to = true; setF({ ...f, to: v }) }} options={options(f.from)} tone={custMatch || toSite ? 'ok' : f.to.trim() ? 'warn' : undefined}
            hint={f.to.trim() ? (custMatch ? `${custMatch.name} has a Tex-Trak account. They can follow this delivery live and sign for it.` : toSite ? `Marked site. Arrival is noticed by itself within ${toSite.radius_m} m.` : 'Not a marked site or customer, so arrival will not be noticed. You mark it arrived.') : undefined} />
        </div>
        {fromLines && f.to && dests.length === 1 && !touched.current.to && <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-cyan-700"><CheckCircle2 size={15} /> Destination taken from {fromLines}</p>}
        {custs.length > 0 && !custMatch && <div className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px] text-stone-600">Customer account: <select value={custId} onChange={(e) => setManualCust(e.target.value)} aria-label="Customer account" className={`${inputCls} !h-10 !w-auto min-w-[12rem]`}><option value="">None</option>{custs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><span className="text-stone-400">so they can follow and sign for it</span></div>}
      </section>

      <section>{step(3, 'How will it be tracked?', 'This is how Tex-Trak knows it has left and arrived.')}
        <TrackPicker org={org} value={trk} onChange={(v) => { touched.current.track = true; setTrk(v) }} />
      </section>

      <section>
        <button type="button" onClick={() => setMore(!more)} className="flex w-full items-center justify-between rounded-2xl bg-stone-50 px-4 py-3 text-left text-[14.5px] font-bold text-stone-700" aria-expanded={more}><span>More details <span className="font-medium text-stone-400">(optional: type, carrier, times, weight)</span></span><ChevronDown size={18} className={`transition ${more ? 'rotate-180' : ''}`} /></button>
        {more && <div className="mt-3 grid gap-4 md:grid-cols-3">
          <Field label="Type"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={inputCls}>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Carrier"><input value={f.carrier} onChange={(e) => setF({ ...f, carrier: e.target.value })} className={inputCls} /></Field>
          <Field label="Weight (kg)"><input value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" className={inputCls} /></Field>
          <Field label="Planned dispatch"><input type="datetime-local" value={f.pd} onChange={(e) => setF({ ...f, pd: e.target.value })} className={inputCls} /></Field>
          <Field label="Planned arrival"><input type="datetime-local" value={f.pa} onChange={(e) => setF({ ...f, pa: e.target.value })} className={inputCls} /></Field>
          <Field label="Description" hint={lines.length ? 'Filled in from what is going if left empty.' : undefined}><input value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder={lines.length ? summarise(lines) : 'e.g. 16 clean curtains'} className={inputCls} /></Field></div>}
      </section>

      {err && <Notice kind="error" onClose={() => setErr('')}>{err}</Notice>}
      <div className="sticky bottom-0 z-20 -mx-4 -mb-4 flex items-center gap-3 border-t border-stone-200 bg-white/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6 sm:py-3">
        <div className="min-w-0 flex-1 text-[13px] leading-snug sm:text-[13.5px]">
          <div className="truncate font-bold text-stone-900">{count > 0 ? `${num(count)} item${count === 1 ? '' : 's'}` : 'No items yet'}{f.from.trim() && f.to.trim() ? ` · ${f.from.trim()} → ${f.to.trim()}` : ''}</div>
          <div className={`truncate ${auto ? 'text-emerald-700' : 'text-stone-500'}`}>{auto ? `Followed by ${trackName}: automatic` : tracked ? (!fromSite ? `${trackName}: dispatch by hand (From is not a marked site)` : `${trackName}: arrival by hand (To is not a marked site)`) : 'Not tracked: dispatch and arrival by hand'}</div></div>
        <button onClick={onCancel} className={`${btnGhost} hidden !py-2.5 sm:block`}>Cancel</button>
        <button disabled={busy || problems.length > 0} onClick={() => void submit()} className={`${btnPrimary} shrink-0 !px-4 !py-2.5 sm:!px-5 sm:!py-3`} title={problems.length ? `To book: ${problems.join(', ')}` : undefined}>{busy ? 'Booking…' : 'Book shipment'}</button>
      </div>
    </Card>)
}
