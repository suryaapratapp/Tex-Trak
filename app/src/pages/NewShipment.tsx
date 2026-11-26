import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, TriangleAlert, X } from 'lucide-react'
import { Card } from '../components/ui'
import { TrackPicker, type Tracking } from '../components/TrackPicker'
import { supabase } from '../lib/supabase'
import { useInfra } from '../lib/infra'
import { toast } from '../lib/toast'
import { btnGhost, btnPrimary, Field, inputCls, Notice } from '../qr/ui'
import type { ShipStart } from '../lib/shipDraft'
import { ShipmentContents, summarise, type Line } from './ShipmentContents'
import { ukLocalToIso } from '../lib/tz'

export const KINDS: Record<string, string> = { delivery: 'Delivery', collection: 'Collection', recycling: 'Recycling load', equipment: 'Equipment', other: 'Other' }
const norm = (s: string) => s.toLowerCase().replace(/\b(limited|ltd|plc|llc|inc|co|the)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }
const load = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null } catch { return null } }
/** A place is always one of the marked sites, so both ends can be drawn on the map and departure and arrival noticed. */
function PlaceField({ label, value, onChange, sites, skip, hint, tone }: { label: string; value: string; onChange: (v: string) => void; sites: string[]; skip?: string; hint?: React.ReactNode; tone?: 'ok' | 'warn' }) {
  return (
    <Field label={label} required>
      <select value={sites.includes(value) ? value : ''} onChange={(e) => onChange(e.target.value)} className={inputCls} aria-label={label}>
        <option value="">Choose a site</option>
        {sites.map((n) => <option key={n} value={n} disabled={n === skip}>{n}</option>)}
      </select>
      {hint && <p className={`mt-1.5 flex items-start gap-1.5 text-[13px] ${tone === 'warn' ? 'font-semibold text-amber-700' : tone === 'ok' ? 'text-emerald-700' : 'text-stone-500'}`}>{tone === 'ok' ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : tone === 'warn' ? <TriangleAlert size={15} className="mt-0.5 shrink-0" /> : null}<span>{hint}</span></p>}
    </Field>)
}

export function NewShipment({ org, onDone, onCancel, start }: { org: string; onDone: (id: string) => void; onCancel: () => void; start?: ShipStart | null }) {
  const [lines, setLines] = useState<Line[]>([]); const [f, setF] = useState({ kind: 'delivery', from: '', to: '', carrier: '', desc: '', weight: '', pd: '', pa: '' })
  const [trk, setTrk] = useState<Tracking>({ vehicle: '', imei: '' }); const [custs, setCusts] = useState<{ id: string; name: string }[]>([]); const [manualCust, setManualCust] = useState<string | null>(null)
  const [more, setMore] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const touched = useRef({ to: false, from: false, track: false }); const [fromLines, setFromLines] = useState('')
  const sites = useInfra((x) => x.sites); const trackers = useInfra((x) => x.trackers); const vehicles = useInfra((x) => x.vehicles); const infraLoaded = useInfra((x) => x.loaded)
  useEffect(() => { void useInfra.getState().load() }, [])
  useEffect(() => { let off = false; void supabase.rpc('shipment_customers', { p_org: org }).then(({ data }) => { if (!off) setCusts((data ?? []) as { id: string; name: string }[]) }); return () => { off = true } }, [org])
  const mySites = useMemo(() => [...new Map(sites.filter((x) => x.org_id === org || x.org_id === null).map((x) => [x.name, x])).values()].sort((a, b) => a.name.localeCompare(b.name)), [sites, org])
  const siteNames = useMemo(() => mySites.map((x) => x.name), [mySites])
  const count = lines.length ? Math.max(1, Math.round(lines.reduce((a, l) => a + l.qty, 0))) : 0

  // What is going decides where it is going: the destination of the packed order or goods out fills the To box.
  const dests = useMemo(() => [...new Set(lines.map((l) => l.to?.trim()).filter((x): x is string => !!x))], [lines])
  const siteFor = (name: string) => mySites.find((x) => norm(x.name) === norm(name))?.name ?? ''
  useEffect(() => {
    if (touched.current.to) return
    if (dests.length === 1) { setF((x) => ({ ...x, to: siteFor(dests[0]) })); setFromLines(lines.find((l) => l.to?.trim() === dests[0])?.label.split(' · ')[0] ?? '') }
    else if (dests.length === 0 && !lines.length) setFromLines('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dests.join('|'), mySites.length])

  // Remember and restore the last From and tracking; with only one choice, choose it.
  useEffect(() => {
    if (touched.current.from || f.from) return
    const last = load<string>(`ship-from:${org}`); if (last && siteNames.includes(last)) setF((x) => ({ ...x, from: last }))
    else if (infraLoaded && siteNames.length === 1) setF((x) => ({ ...x, from: siteNames[0] }))
  }, [siteNames, infraLoaded, org]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (touched.current.track || !infraLoaded || trk.vehicle || trk.imei) return
    const last = load<Tracking>(`ship-track:${org}`)
    if (last && ((last.imei && trackers.some((t) => t.imei === last.imei)) || (last.vehicle && vehicles.some((v) => v.reg.toUpperCase() === last.vehicle.toUpperCase())))) { setTrk(last); return }
    const vt = vehicles.filter((v) => v.active && v.tracker_imei); if (vt.length === 1) setTrk({ vehicle: vt[0].reg.toUpperCase(), imei: '' })
  }, [infraLoaded, vehicles, trackers, org]) // eslint-disable-line react-hooks/exhaustive-deps

  const toSite = mySites.find((x) => x.name === f.to); const fromSite = mySites.find((x) => x.name === f.from)
  const custMatch = custs.find((c) => norm(c.name) === norm(f.to)); const custId = manualCust ?? custMatch?.id ?? ''
  const tracked = !!(trk.imei || (trk.vehicle.trim() && vehicles.find((v) => v.reg.toUpperCase() === trk.vehicle.trim().toUpperCase())?.tracker_imei))
  const auto = tracked && !!fromSite && !!toSite
  const trackName = trk.imei ? trackers.find((t) => t.imei === trk.imei)?.name : trk.vehicle.trim()
  const problems = [!lines.length ? 'add at least one item' : '', !fromSite ? 'choose the From site' : '', !toSite ? 'choose the To site' : '', fromSite && f.from === f.to ? 'choose two different sites' : ''].filter(Boolean)

  const submit = async () => {
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('shipment_book', { p_org: org, p_kind: f.kind, p_from: f.from.trim(), p_to: f.to.trim(), p_carrier: f.carrier.trim(), p_vehicle: trk.vehicle.trim().toUpperCase(), p_desc: f.desc.trim() || summarise(lines), p_items: count, p_lines: lines.map((l) => ({ source: l.source, ref: l.ref, label: l.label, qty: l.qty })), p_weight: f.weight ? +f.weight : null, p_planned_dispatch: f.pd ? ukLocalToIso(f.pd) : null, p_planned_arrival: f.pa ? ukLocalToIso(f.pa) : null, p_customer: custId || null })
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
        {!lines.length && <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-amber-700"><TriangleAlert size={15} className="shrink-0" />Tick at least one item. A shipment cannot be booked empty.</p>}
      </section>

      <section>{step(2, 'From and to', 'Choose from your sites, so both places show on the map and Tex-Trak can follow the shipment.')}
        {dests.length > 1 && <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-[13.5px] text-amber-900"><b>These go to different places.</b> A shipment has one destination, so choose which one this is for, then book the rest separately.<div className="mt-2 flex flex-wrap gap-1.5">{dests.map((d) => <button key={d} type="button" onClick={() => { touched.current.to = true; setF({ ...f, to: siteFor(d) }) }} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[13px] font-bold hover:bg-amber-100">{d}</button>)}</div></div>}
        <div className="grid gap-4 md:grid-cols-2">
          <PlaceField label="From" value={f.from} onChange={(v) => { touched.current.from = true; setF({ ...f, from: v }) }} sites={siteNames} skip={f.to} tone={fromSite ? 'ok' : undefined} hint={fromSite ? 'It is dispatched by itself when the tracker leaves.' : undefined} />
          <PlaceField label="To" value={f.to} onChange={(v) => { touched.current.to = true; setF({ ...f, to: v }) }} sites={siteNames} skip={f.from} tone={toSite ? 'ok' : dests.length === 1 ? 'warn' : undefined}
            hint={toSite ? (custMatch ? `${custMatch.name} has a Tex-Trak account. They can follow this delivery live and sign for it.` : `Arrival is noticed by itself within ${toSite.radius_m} m.`) : dests.length === 1 && !siteFor(dests[0]) ? `The items say they are going to "${dests[0]}", which is not one of your sites. Choose the right site.` : undefined} />
        </div>
        {infraLoaded && siteNames.length < 2 && <Notice kind="error">You need a From site and a To site. Ask your Tex-Trak administrator to add the missing place under Sites.</Notice>}
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
          <div className={`truncate ${auto ? 'text-emerald-700' : 'text-stone-500'}`}>{auto ? `Followed by ${trackName}: automatic` : problems.length ? `To book: ${problems.join(', ')}` : 'Not tracked: dispatch and arrival by hand'}</div></div>
        <button onClick={onCancel} className={`${btnGhost} hidden !py-2.5 sm:block`}>Cancel</button>
        <button disabled={busy || problems.length > 0} onClick={() => void submit()} className={`${btnPrimary} shrink-0 !px-4 !py-2.5 sm:!px-5 sm:!py-3`} title={problems.length ? `To book: ${problems.join(', ')}` : undefined}>{busy ? 'Booking…' : 'Book shipment'}</button>
      </div>
    </Card>)
}
