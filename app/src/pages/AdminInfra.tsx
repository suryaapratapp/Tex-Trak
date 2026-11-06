import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Card, Chip } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useInfra, type DbSite } from '../lib/infra'
import { SUPABASE_URL } from '../lib/supabase'
import { KIND_LABEL } from '../sim/registry'
import { btnGhost, btnPrimary, Field, inputCls, Notice } from '../qr/ui'

const KINDS = ['hospital', 'decon', 'recycler', 'facility', 'hub', 'community', 'port', 'incinerator'] as const
const POSITIONS = ['ceiling', 'doorway', 'portal', 'weighbridge', 'handheld']
const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6) || 'SITE'
const when = (s: string | null) => (s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never')
const Head = ({ title, sub, onAdd, open }: { title: string; sub: string; onAdd: () => void; open: boolean }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-6 py-5"><div><h3 className="text-[17px] font-semibold text-stone-900">{title}</h3><p className="mt-0.5 text-[14px] text-stone-500">{sub}</p></div><button onClick={onAdd} className={`${btnPrimary} flex items-center gap-2`}><Plus size={17} />{open ? 'Close' : 'Add'}</button></div>)

export function SitesAdmin() {
  const { sites, load } = useInfra(); const orgs = useAuth((s) => s.orgs); const [open, setOpen] = useState(false); const [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null); const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ name: '', kind: 'hospital', org: '', region: '', address: '', lat: '', lng: '', radius: '200', floors: '1', status: 'live' })
  const find = async () => {
    setMsg(null); if (!f.address.trim()) return setMsg({ k: 'error', t: 'Type an address or postcode first.' })
    try { const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(f.address)}`).then((x) => x.json()); if (!r[0]) return setMsg({ k: 'error', t: 'No match. Try a fuller address, or type the coordinates.' }); setF({ ...f, lat: (+r[0].lat).toFixed(5), lng: (+r[0].lon).toFixed(5) }) } catch { setMsg({ k: 'error', t: 'The address lookup is not available. Type the coordinates instead.' }) }
  }
  const save = async () => {
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('sites').insert({ code: slug(f.name) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(), name: f.name.trim(), kind: f.kind, lat: +f.lat, lng: +f.lng, radius_m: +f.radius || 200, org_id: f.org || null, region: f.region.trim(), floors: +f.floors || 0, status: f.status, address: f.address.trim(), source: 'admin' })
    setBusy(false); if (error) return setMsg({ k: 'error', t: error.message }); setMsg({ k: 'ok', t: `${f.name} added.` }); setOpen(false); setF({ ...f, name: '', address: '', lat: '', lng: '' }); await load()
  }
  const del = async (s: DbSite) => { if (!confirm(`Remove ${s.name}? Its readers are removed too.`)) return; const { error } = await supabase.from('sites').delete().eq('id', s.id); if (error) setMsg({ k: 'error', t: error.message }); else await load() }
  const bad = !f.name.trim() || !f.lat || !f.lng || Number.isNaN(+f.lat) || Number.isNaN(+f.lng)
  return (
    <Card className="mb-6"><Head title="Sites you have added" sub="Hospitals, plants, recyclers, ports and more. They appear on the map straight away." open={open} onAdd={() => setOpen(!open)} />
      {msg && <div className="px-6 pt-4"><Notice kind={msg.k} onClose={() => setMsg(null)}>{msg.t}</Notice></div>}
      {open && <div className="space-y-4 border-b border-stone-100 bg-stone-50 p-6">
        <div className="grid gap-4 md:grid-cols-3"><Field label="Name" required><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></Field>
          <Field label="Type" required><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={inputCls}>{KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></Field>
          <Field label="Belongs to" hint="Shared sites are visible to every client"><select value={f.org} onChange={(e) => setF({ ...f, org: e.target.value })} className={inputCls}><option value="">Shared</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field></div>
        <div className="grid gap-4 md:grid-cols-[1fr_auto]"><Field label="Address or postcode"><input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className={inputCls} /></Field><div className="flex items-end"><button onClick={find} className={btnGhost}>Find on map</button></div></div>
        <div className="grid gap-4 md:grid-cols-5"><Field label="Latitude" required><input value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} className={inputCls} inputMode="decimal" /></Field><Field label="Longitude" required><input value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} className={inputCls} inputMode="decimal" /></Field>
          <Field label="Radius (m)"><input value={f.radius} onChange={(e) => setF({ ...f, radius: e.target.value.replace(/\D/g, '') })} className={inputCls} /></Field><Field label="Floors"><input value={f.floors} onChange={(e) => setF({ ...f, floors: e.target.value.replace(/\D/g, '') })} className={inputCls} /></Field><Field label="Region"><input value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} className={inputCls} /></Field></div>
        <div className="flex items-end gap-4"><Field label="Status"><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={inputCls}><option value="live">Live</option><option value="provisioned">Provisioned</option><option value="planned">Planned</option></select></Field><button disabled={busy || bad} onClick={save} className={btnPrimary}>Add site</button></div></div>}
      {sites.length === 0 ? <div className="px-6 py-8 text-center text-[14.5px] text-stone-400">None yet. Use Add to create the first one.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[14px]"><thead><tr><th>Site</th><th>Type</th><th>Belongs to</th><th>Region</th><th className="text-right">Floors</th><th>Status</th><th /></tr></thead>
        <tbody className="divide-y divide-stone-100">{sites.map((s) => <tr key={s.id}><td><div className="font-medium text-stone-900">{s.name}</div><div className="text-[12.5px] text-stone-400">{s.address || `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`}</div></td><td>{KIND_LABEL[s.kind] ?? s.kind}</td><td>{orgs.find((o) => o.id === s.org_id)?.name ?? 'Shared'}</td><td>{s.region || '–'}</td><td className="text-right">{s.floors}</td><td><Chip tone={s.status === 'live' ? 'green' : s.status === 'planned' ? 'slate' : 'blue'}>{s.status}</Chip></td><td className="text-right"><button onClick={() => del(s)} aria-label={`Remove ${s.name}`} className="grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>}
    </Card>)
}

export function ReadersAdmin() {
  const { sites, readers, load } = useInfra(); const [open, setOpen] = useState(false); const [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null); const [busy, setBusy] = useState(false)
  const { zones } = useInfra(); const [f, setF] = useState({ site: '', code: '', label: '', floor: 'Ground', position: 'ceiling', zone: '' })
  const save = async () => { setBusy(true); setMsg(null); const { error } = await supabase.from('readers').insert({ site_id: f.site, code: f.code.trim().toUpperCase(), label: f.label.trim(), floor: f.floor.trim() || 'Ground', position: f.position, zone_id: f.zone || null, source: 'admin' }); setBusy(false)
    if (error) return setMsg({ k: 'error', t: error.code === '23505' ? 'That reader code is already used at this site.' : error.message }); setMsg({ k: 'ok', t: `${f.code.toUpperCase()} added.` }); setF({ ...f, code: '', label: '' }); await load() }
  const toggle = async (id: string, online: boolean) => { await supabase.from('readers').update({ online: !online }).eq('id', id); await load() }
  const del = async (id: string) => { if (!confirm('Remove this reader?')) return; await supabase.from('readers').delete().eq('id', id); await load() }
  return (
    <Card className="mb-6"><Head title="RFID readers you have added" sub="Ceiling, doorway and weighbridge readers. Each belongs to one of your sites." open={open} onAdd={() => setOpen(!open)} />
      {msg && <div className="px-6 pt-4"><Notice kind={msg.k} onClose={() => setMsg(null)}>{msg.t}</Notice></div>}
      {open && <div className="space-y-4 border-b border-stone-100 bg-stone-50 p-6">{sites.length === 0 ? <p className="text-[14.5px] text-stone-500">Add a site first (Sites tab), then add its readers here.</p> : <>
        <div className="grid gap-4 md:grid-cols-6"><Field label="Site" required><select value={f.site} onChange={(e) => setF({ ...f, site: e.target.value, zone: '' })} className={inputCls}><option value="">Choose site</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Reader code" required hint="e.g. R-DOCK-01"><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className={inputCls} /></Field><Field label="Where is it?"><input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="e.g. Dock door" className={inputCls} /></Field>
          <Field label="Zone it watches" hint="The room this door leads into"><select value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} className={inputCls}><option value="">None</option>{zones.filter((z) => z.site_id === f.site).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></Field><Field label="Floor"><input value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} className={inputCls} /></Field><Field label="Type"><select value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} className={inputCls}>{POSITIONS.map((p) => <option key={p}>{p}</option>)}</select></Field></div>
        <button disabled={busy || !f.site || f.code.trim().length < 2} onClick={save} className={btnPrimary}>Add reader</button></>}</div>}
      {readers.length === 0 ? <div className="px-6 py-8 text-center text-[14.5px] text-stone-400">None yet.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[14px]"><thead><tr><th>Reader</th><th>Site</th><th>Zone</th><th>Where</th><th>Type</th><th>Last read</th><th /></tr></thead>
        <tbody className="divide-y divide-stone-100">{readers.map((r) => <tr key={r.id}><td className="mono font-medium text-stone-900">{r.code}</td><td>{sites.find((s) => s.id === r.site_id)?.name ?? '–'}</td><td>{zones.find((z) => z.id === r.zone_id)?.name ?? '–'}</td><td className="text-stone-600">{r.label || '–'}</td><td>{r.position}</td><td className="text-stone-500">{when(r.last_seen)}</td>
          <td className="text-right"><button onClick={() => toggle(r.id, r.online)} className={`mr-2 rounded-full px-3 py-1 text-[12.5px] font-medium ${r.online ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{r.online ? 'Online' : 'Off'}</button><button onClick={() => del(r.id)} aria-label="Remove reader" className="inline-grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>}
    </Card>)
}

export function TrackersAdmin() {
  const { trackers, load } = useInfra(); const orgs = useAuth((s) => s.orgs); const [open, setOpen] = useState(false); const [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null); const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ imei: '', name: '', model: 'TAT240', serial: '', org: '' })
  const save = async () => { setBusy(true); setMsg(null); const { error } = await supabase.from('trackers').insert({ imei: f.imei.trim(), name: f.name.trim(), model: f.model.trim() || 'TAT240', serial_no: f.serial.trim() || null, org_id: f.org || null }); setBusy(false)
    if (error) return setMsg({ k: 'error', t: error.code === '23505' ? 'That IMEI is already registered.' : error.code === '23514' ? 'An IMEI is exactly 15 digits.' : error.message }); setMsg({ k: 'ok', t: `Tracker ${f.imei} registered. It can now send data to the gateway.` }); setOpen(false); setF({ ...f, imei: '', name: '', serial: '' }); await load() }
  const toggle = async (imei: string, active: boolean) => { await supabase.from('trackers').update({ active: !active }).eq('imei', imei); await load() }
  const del = async (imei: string) => { if (!confirm(`Remove tracker ${imei}? Its stored positions stay.`)) return; const { error } = await supabase.from('trackers').delete().eq('imei', imei); if (error) setMsg({ k: 'error', t: error.message }); else await load() }
  return (
    <Card className="mb-6"><Head title="Trackers" sub="A tracker can only send data once its IMEI is registered here." open={open} onAdd={() => setOpen(!open)} />
      {msg && <div className="px-6 pt-4"><Notice kind={msg.k} onClose={() => setMsg(null)}>{msg.t}</Notice></div>}
      {open && <div className="space-y-4 border-b border-stone-100 bg-stone-50 p-6"><div className="grid gap-4 md:grid-cols-5"><Field label="IMEI" required hint="15 digits, printed on the device"><input value={f.imei} onChange={(e) => setF({ ...f, imei: e.target.value.replace(/\D/g, '').slice(0, 15) })} className={`${inputCls} mono`} inputMode="numeric" /></Field>
        <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Van 3" className={inputCls} /></Field><Field label="Model"><input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} className={inputCls} /></Field>
        <Field label="Serial number"><input value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} className={inputCls} /></Field><Field label="Belongs to"><select value={f.org} onChange={(e) => setF({ ...f, org: e.target.value })} className={inputCls}><option value="">Not assigned</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field></div>
        <button disabled={busy || f.imei.length !== 15} onClick={save} className={btnPrimary}>Register tracker</button></div>}
      {trackers.length === 0 ? <div className="px-6 py-8 text-center text-[14.5px] text-stone-400">No trackers registered.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-[14px]"><thead><tr><th>Tracker</th><th>IMEI</th><th>Model</th><th>Belongs to</th><th>Battery</th><th>Last seen</th><th /></tr></thead>
        <tbody className="divide-y divide-stone-100">{trackers.map((t) => <tr key={t.imei} className={t.active ? '' : 'opacity-60'}><td className="font-medium text-stone-900">{t.name || '–'}{t.kind === 'phone' && <span className="ml-2 rounded-full bg-cyan-50 px-2 py-0.5 text-[11.5px] font-medium text-cyan-700">Phone</span>}</td><td className="mono text-[12.5px]">{t.imei}</td><td>{t.kind === 'phone' ? t.model : `${t.vendor} ${t.model}`}</td><td>{orgs.find((o) => o.id === t.org_id)?.name ?? 'Not assigned'}</td><td>{t.battery_pct != null ? `${t.battery_pct}%` : '–'}</td><td className="text-stone-500">{when(t.last_seen)}</td>
          <td className="text-right"><button onClick={() => toggle(t.imei, t.active)} className={`mr-2 rounded-full px-3 py-1 text-[12.5px] font-medium ${t.active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{t.active ? 'Active' : 'Off'}</button><button onClick={() => del(t.imei)} aria-label="Remove tracker" className="inline-grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>}
    </Card>)
}

const ZKINDS: [string, string][] = [['dock', 'Dock or entrance'], ['store', 'Clean store'], ['clinical', 'Ward or clinical area'], ['dirty', 'Dirty utility or cages'], ['processing', 'Washing or processing'], ['clean', 'Clean finishing'], ['outside', 'Outside or yard'], ['other', 'Other']]
export function ZonesAdmin() {
  const { sites, zones, load } = useInfra(); const [open, setOpen] = useState(false); const [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null); const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ site: '', name: '', kind: 'clinical', floor: '0' })
  const save = async () => { setBusy(true); setMsg(null); const { error } = await supabase.from('zones').insert({ site_id: f.site, code: f.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20), name: f.name.trim(), kind: f.kind, floor: +f.floor || 0 }); setBusy(false)
    if (error) return setMsg({ k: 'error', t: error.message }); setMsg({ k: 'ok', t: `${f.name} added.` }); setF({ ...f, name: '' }); await load() }
  const del = async (id: string) => { if (!confirm('Remove this zone? Readers pointing at it are left without a zone.')) return; await supabase.from('zones').delete().eq('id', id); await load() }
  const mine = zones.filter((z) => sites.some((s) => s.id === z.site_id))
  return (
    <Card className="mb-6"><Head title="Zones" sub="The rooms and areas of a site. A reader on a door tells Tex-Trak which zone an item has entered." open={open} onAdd={() => setOpen(!open)} />
      {msg && <div className="px-6 pt-4"><Notice kind={msg.k} onClose={() => setMsg(null)}>{msg.t}</Notice></div>}
      {open && <div className="space-y-4 border-b border-stone-100 bg-stone-50 p-6">{sites.length === 0 ? <p className="text-[14.5px] text-stone-500">Add a site first (Sites tab).</p> : <>
        <div className="grid gap-4 md:grid-cols-4"><Field label="Site" required><select value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })} className={inputCls}><option value="">Choose site</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Zone name" required><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Goods-in dock" className={inputCls} /></Field>
          <Field label="What happens here" hint="Sets the item state a read implies"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={inputCls}>{ZKINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field><Field label="Floor (0 = ground)"><input value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value.replace(/\D/g, '') })} className={inputCls} /></Field></div>
        <button disabled={busy || !f.site || !f.name.trim()} onClick={save} className={btnPrimary}>Add zone</button></>}</div>}
      {mine.length === 0 ? <div className="px-6 py-8 text-center text-[14.5px] text-stone-400">None yet.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[14px]"><thead><tr><th>Zone</th><th>Site</th><th>Floor</th><th>Kind</th><th /></tr></thead>
        <tbody className="divide-y divide-stone-100">{mine.map((z) => <tr key={z.id}><td className="font-medium text-stone-900">{z.name}</td><td>{sites.find((s) => s.id === z.site_id)?.name}</td><td>{z.floor === 0 ? 'Ground' : `Floor ${z.floor}`}</td><td>{ZKINDS.find(([k]) => k === z.kind)?.[1] ?? z.kind}</td><td className="text-right"><button onClick={() => del(z.id)} aria-label="Remove zone" className="grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>}
    </Card>)
}

export function FeedCard() {
  const { readers } = useInfra(); const [reader, setReader] = useState(''); const [epc, setEpc] = useState(''); const [res, setRes] = useState<{ k: 'ok' | 'error'; t: string } | null>(null); const [busy, setBusy] = useState(false)
  const url = `${SUPABASE_URL}/functions/v1/ingest-rfid`
  const send = async () => {
    setBusy(true); setRes(null); const { data: s } = await supabase.auth.getSession()
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${s.session?.access_token}` }, body: JSON.stringify({ reader, reads: [{ epc, ts: new Date().toISOString() }] }) }).then((x) => x.json()).catch(() => ({ error: 'Could not reach the server.' }))
    setBusy(false); setRes(r.error ? { k: 'error', t: r.error } : { k: 'ok', t: r.stored ? `Read recorded at ${r.reader}.` : r.unknown ? 'The reader accepted it, but that tag is not on any item list.' : 'Ignored: the same tag was just read at this reader.' })
  }
  return (
    <Card className="mb-6 p-6"><h3 className="text-[17px] font-semibold text-stone-900">How readers send data</h3>
      <p className="mt-1 text-[14px] text-stone-500">Each reader, or the middleware next to it, posts the tags it sees. Every read updates the item&rsquo;s zone and state and is kept in its journey.</p>
      <pre className="mono mt-4 overflow-x-auto rounded-lg bg-stone-50 p-4 text-[12.5px] leading-relaxed text-stone-700">{`POST ${url}\nheader  x-ingest-token: <your INGEST_TOKEN>\nbody    {"reader":"R-DOCK-01","reads":[{"epc":"E28011606000020D1A2B3C4D","ts":"2026-11-06T09:30:00Z"}]}`}</pre>
      <div className="mt-5 grid gap-4 border-t border-stone-100 pt-5 md:grid-cols-[1fr_1.4fr_auto]"><Field label="Send a test read" hint="No hardware needed"><select value={reader} onChange={(e) => setReader(e.target.value)} className={inputCls}><option value="">Choose a reader</option>{readers.map((r) => <option key={r.id} value={r.code}>{r.code}{r.label ? ` · ${r.label}` : ''}</option>)}</select></Field>
        <Field label="Tag (EPC) of an item on the list"><input value={epc} onChange={(e) => setEpc(e.target.value)} className={`${inputCls} mono`} /></Field><div className="flex items-end"><button disabled={busy || !reader || epc.replace(/[^0-9a-f]/gi, '').length < 8} onClick={send} className={btnPrimary}>Send</button></div></div>
      {res && <div className="mt-4"><Notice kind={res.k} onClose={() => setRes(null)}>{res.t}</Notice></div>}</Card>)
}
