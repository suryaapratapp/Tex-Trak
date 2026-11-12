import { Fragment, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { Card, Chip } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useInfra, type DbSite } from '../lib/infra'
import { SUPABASE_URL } from '../lib/supabase'
import { KIND_LABEL } from '../sim/registry'
import { btnGhost, btnPrimary, Field, inputCls, Notice } from '../qr/ui'
import { ago, HEALTH_LABEL, HEALTH_TONE, readerHealth, trackerHealth } from '../lib/status'

const KINDS = ['hospital', 'decon', 'recycler', 'facility', 'hub', 'community', 'port', 'incinerator'] as const
const POSITIONS = ['ceiling', 'doorway', 'portal', 'weighbridge', 'handheld']
const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6) || 'SITE'
const when = (s: string | null) => (s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never')
const Head = ({ title, sub, onAdd, open }: { title: string; sub: string; onAdd: () => void; open: boolean }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-6 py-5"><div><h3 className="text-[17px] font-semibold text-stone-900">{title}</h3><p className="mt-0.5 text-[14px] text-stone-500">{sub}</p></div><button onClick={onAdd} aria-expanded={open} className={`${open ? btnGhost : btnPrimary} flex items-center gap-2`}>{open ? <X size={17} /> : <Plus size={17} />}{open ? 'Close' : 'Add'}</button></div>)
const EditRow = ({ cols, busy, onSave, onCancel, children }: { cols: number; busy: boolean; onSave: () => void; onCancel: () => void; children: React.ReactNode }) => (
  <tr><td colSpan={cols} className="bg-stone-50 p-4"><div className="grid gap-3 md:grid-cols-4">{children}</div><div className="mt-3 flex gap-2"><button disabled={busy} onClick={onSave} className={btnPrimary}>Save changes</button><button onClick={onCancel} className={btnGhost}>Cancel</button></div></td></tr>)
const EditBtn = ({ onClick, label }: { onClick: () => void; label: string }) => <button onClick={onClick} aria-label={label} title={label} className="mr-1 inline-grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"><Pencil size={16} /></button>

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
  type SEd = { id: string; name: string; kind: string; org: string; region: string; address: string; lat: string; lng: string; radius: string; floors: string; status: string }
  const [ed, setEd] = useState<SEd | null>(null)
  const edit = (x: DbSite) => { setMsg(null); setEd({ id: x.id, name: x.name, kind: x.kind, org: x.org_id ?? '', region: x.region ?? '', address: x.address ?? '', lat: String(x.lat), lng: String(x.lng), radius: String(x.radius_m), floors: String(x.floors), status: x.status }) }
  const saveEdit = async () => { if (!ed) return; if (!ed.name.trim() || Number.isNaN(+ed.lat) || Number.isNaN(+ed.lng) || Math.abs(+ed.lat) > 90 || Math.abs(+ed.lng) > 180) return setMsg({ k: 'error', t: 'Enter a name and valid coordinates (latitude -90 to 90, longitude -180 to 180).' })
    setBusy(true); const { error } = await supabase.from('sites').update({ name: ed.name.trim(), kind: ed.kind, org_id: ed.org || null, region: ed.region.trim(), address: ed.address.trim(), lat: +ed.lat, lng: +ed.lng, radius_m: +ed.radius || 200, floors: +ed.floors || 0, status: ed.status }).eq('id', ed.id); setBusy(false)
    if (error) return setMsg({ k: 'error', t: error.message }); setMsg({ k: 'ok', t: `${ed.name.trim()} updated.` }); setEd(null); await load() }
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
        <tbody className="divide-y divide-stone-100">{sites.map((s) => <Fragment key={s.id}><tr><td><div className="font-medium text-stone-900">{s.name}</div><div className="text-[12.5px] text-stone-400">{s.address || `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`}</div></td><td>{KIND_LABEL[s.kind] ?? s.kind}</td><td>{orgs.find((o) => o.id === s.org_id)?.name ?? 'Shared'}</td><td>{s.region || '–'}</td><td className="text-right">{s.floors}</td><td><Chip tone={s.status === 'live' ? 'green' : s.status === 'planned' ? 'slate' : 'blue'}>{s.status}</Chip></td><td className="text-right"><EditBtn onClick={() => edit(s)} label={`Edit ${s.name}`} /><button onClick={() => del(s)} aria-label={`Remove ${s.name}`} className="grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button></td></tr>{ed?.id === s.id && <EditRow cols={7} busy={busy} onSave={saveEdit} onCancel={() => setEd(null)}>
          <Field label="Name" required><input value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} className={inputCls} /></Field>
          <Field label="Type"><select value={ed.kind} onChange={(e) => setEd({ ...ed, kind: e.target.value })} className={inputCls}>{KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></Field>
          <Field label="Belongs to"><select value={ed.org} onChange={(e) => setEd({ ...ed, org: e.target.value })} className={inputCls}><option value="">Shared</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
          <Field label="Status"><select value={ed.status} onChange={(e) => setEd({ ...ed, status: e.target.value })} className={inputCls}><option value="live">Live</option><option value="provisioned">Provisioned</option><option value="planned">Planned</option></select></Field>
          <Field label="Address"><input value={ed.address} onChange={(e) => setEd({ ...ed, address: e.target.value })} className={inputCls} /></Field>
          <Field label="Latitude" required><input value={ed.lat} onChange={(e) => setEd({ ...ed, lat: e.target.value })} className={inputCls} inputMode="decimal" /></Field>
          <Field label="Longitude" required><input value={ed.lng} onChange={(e) => setEd({ ...ed, lng: e.target.value })} className={inputCls} inputMode="decimal" /></Field>
          <Field label="Radius (m)"><input value={ed.radius} onChange={(e) => setEd({ ...ed, radius: e.target.value.replace(/\D/g, '') })} className={inputCls} /></Field>
          <Field label="Floors"><input value={ed.floors} onChange={(e) => setEd({ ...ed, floors: e.target.value.replace(/\D/g, '') })} className={inputCls} /></Field>
          <Field label="Region"><input value={ed.region} onChange={(e) => setEd({ ...ed, region: e.target.value })} className={inputCls} /></Field></EditRow>}</Fragment>)}</tbody></table></div>}
    </Card>)
}

export function ReadersAdmin() {
  const { sites, readers, load } = useInfra(); const [open, setOpen] = useState(false); const [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null); const [busy, setBusy] = useState(false)
  const { zones } = useInfra(); const [conn, setConn] = useState<{ id: string; url: string } | null>(null); const [copied, setCopied] = useState(false); const [f, setF] = useState({ site: '', code: '', label: '', floor: 'Ground', position: 'ceiling', zone: '' })
  const save = async () => { setBusy(true); setMsg(null); const { error } = await supabase.from('readers').insert({ site_id: f.site, code: f.code.trim().toUpperCase(), label: f.label.trim(), floor: f.floor.trim() || 'Ground', position: f.position, zone_id: f.zone || null, source: 'admin' }); setBusy(false)
    if (error) return setMsg({ k: 'error', t: error.code === '23505' ? 'That reader code is already used at this site.' : error.message }); setMsg({ k: 'ok', t: `${f.code.toUpperCase()} added.` }); setF({ ...f, code: '', label: '' }); await load() }
  const urlFor = (code: string, key: string) => `${SUPABASE_URL}/functions/v1/ingest-rfid?reader=${encodeURIComponent(code)}&key=${key}`
  const showConn = async (r: { id: string; code: string }) => { if (conn?.id === r.id) return setConn(null); const { data, error } = await supabase.rpc('reader_key', { p_reader: r.id }); if (error) return setMsg({ k: 'error', t: error.message }); setConn({ id: r.id, url: urlFor(r.code, data as string) }); setCopied(false) }
  const rotate = async (r: { id: string; code: string }) => { if (!confirm('Replace this reader’s key? The reader stops working until its config page is updated with the new address.')) return; const { data, error } = await supabase.rpc('reader_rotate_key', { p_reader: r.id }); if (error) return setMsg({ k: 'error', t: error.message }); setConn({ id: r.id, url: urlFor(r.code, data as string) }); setCopied(false) }
  type REd = { id: string; code: string; label: string; floor: string; position: string; zone: string; site_id: string }
  const [ed, setEd] = useState<REd | null>(null)
  const edit = (r: (typeof readers)[number]) => { setMsg(null); setEd({ id: r.id, code: r.code, label: r.label ?? '', floor: r.floor ?? 'Ground', position: r.position, zone: r.zone_id ?? '', site_id: r.site_id }) }
  const saveEdit = async () => { if (!ed) return; if (ed.code.trim().length < 2) return setMsg({ k: 'error', t: 'Enter a reader code of at least 2 characters.' })
    setBusy(true); const { error } = await supabase.from('readers').update({ code: ed.code.trim().toUpperCase(), label: ed.label.trim(), floor: ed.floor.trim() || 'Ground', position: ed.position, zone_id: ed.zone || null }).eq('id', ed.id); setBusy(false)
    if (error) return setMsg({ k: 'error', t: error.code === '23505' ? 'That reader code is already used at this site.' : error.message }); setMsg({ k: 'ok', t: `${ed.code.trim().toUpperCase()} updated. If you changed the code, press Connect and update the reader's address.` }); setEd(null); await load() }
  const del = async (id: string) => { if (!confirm('Remove this reader? Its past reads stay in the item journeys.')) return; const { error } = await supabase.from('readers').delete().eq('id', id); if (error) setMsg({ k: 'error', t: error.message }); else await load() }
  return (
    <Card className="mb-6"><Head title="RFID readers you have added" sub="Ceiling, doorway and weighbridge readers. Each belongs to one of your sites." open={open} onAdd={() => setOpen(!open)} />
      {msg && <div className="px-6 pt-4"><Notice kind={msg.k} onClose={() => setMsg(null)}>{msg.t}</Notice></div>}
      {open && <div className="space-y-4 border-b border-stone-100 bg-stone-50 p-6">{sites.length === 0 ? <p className="text-[14.5px] text-stone-500">Add a site first (Sites tab), then add its readers here.</p> : <>
        <div className="grid gap-4 md:grid-cols-6"><Field label="Site" required><select value={f.site} onChange={(e) => setF({ ...f, site: e.target.value, zone: '' })} className={inputCls}><option value="">Choose site</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Reader code" required hint="e.g. R-DOCK-01"><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className={inputCls} /></Field><Field label="Where is it?"><input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="e.g. Dock door" className={inputCls} /></Field>
          <Field label="Zone it watches" hint="The room this door leads into"><select value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} className={inputCls}><option value="">None</option>{zones.filter((z) => z.site_id === f.site).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></Field><Field label="Floor"><input value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} className={inputCls} /></Field><Field label="Type"><select value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} className={inputCls}>{POSITIONS.map((p) => <option key={p}>{p}</option>)}</select></Field></div>
        <button disabled={busy || !f.site || f.code.trim().length < 2} onClick={save} className={btnPrimary}>Add reader</button></>}</div>}
      {readers.length === 0 ? <div className="px-6 py-8 text-center text-[14.5px] text-stone-400">None yet.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[14px]"><thead><tr><th>Reader</th><th>Site</th><th>Zone</th><th>Where</th><th>Type</th><th>Status</th><th>Last read</th><th /></tr></thead>
        <tbody className="divide-y divide-stone-100">{readers.map((r) => <Fragment key={r.id}><tr><td className="mono font-medium text-stone-900">{r.code}</td><td>{sites.find((s) => s.id === r.site_id)?.name ?? '–'}</td><td>{zones.find((z) => z.id === r.zone_id)?.name ?? '–'}</td><td className="text-stone-600">{r.label || '–'}</td><td>{r.position}</td><td><Chip tone={HEALTH_TONE[readerHealth(r.last_seen)]}>{HEALTH_LABEL[readerHealth(r.last_seen)]}</Chip></td><td className="text-stone-500">{when(r.last_seen)}</td>
          <td className="whitespace-nowrap text-right"><button onClick={() => void showConn(r)} className="mr-2 rounded-full bg-cyan-50 px-3 py-1 text-[12.5px] font-medium text-cyan-700 hover:bg-cyan-100">Connect</button><EditBtn onClick={() => edit(r)} label={`Edit ${r.code}`} /><button onClick={() => del(r.id)} aria-label="Remove reader" className="inline-grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button></td></tr>{ed?.id === r.id && <EditRow cols={8} busy={busy} onSave={saveEdit} onCancel={() => setEd(null)}>
          <Field label="Reader code" required><input value={ed.code} onChange={(e) => setEd({ ...ed, code: e.target.value })} className={`${inputCls} mono`} /></Field>
          <Field label="Where is it?"><input value={ed.label} onChange={(e) => setEd({ ...ed, label: e.target.value })} className={inputCls} /></Field>
          <Field label="Zone it watches"><select value={ed.zone} onChange={(e) => setEd({ ...ed, zone: e.target.value })} className={inputCls}><option value="">None</option>{zones.filter((z) => z.site_id === ed.site_id).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></Field>
          <Field label="Floor"><input value={ed.floor} onChange={(e) => setEd({ ...ed, floor: e.target.value })} className={inputCls} /></Field>
          <Field label="Type"><select value={ed.position} onChange={(e) => setEd({ ...ed, position: e.target.value })} className={inputCls}>{POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field></EditRow>}</Fragment>)}</tbody></table></div>}
      {conn && <div className="border-t border-stone-100 bg-stone-50 p-6"><div className="mb-1 text-[15px] font-semibold text-stone-900">Connect this reader</div><p className="text-[14px] text-stone-500">In the reader&rsquo;s configuration page, set the server or &ldquo;HTTP POST&rdquo; address to this URL. Use JSON, text, or the reader&rsquo;s default format. Keep it private: anyone with it can send reads for this reader.</p>
        <div className="mt-3 flex gap-2"><input readOnly value={conn.url} onFocus={(e) => e.currentTarget.select()} className={`${inputCls} mono text-[12.5px]`} /><button onClick={() => { void navigator.clipboard?.writeText(conn.url); setCopied(true) }} className={btnPrimary}>{copied ? 'Copied' : 'Copy'}</button></div>
        <div className="mt-3 flex flex-wrap gap-4 text-[13.5px]"><button onClick={() => { const r = readers.find((x) => x.id === conn.id); if (r) void rotate(r) }} className="font-medium text-rose-600 hover:underline">Replace the key</button><span className="text-stone-400">Test it: send one tag to the URL, then check Facilities and floors.</span></div></div>}
    </Card>)
}

export function TrackersAdmin() {
  const { trackers, load } = useInfra(); const orgs = useAuth((s) => s.orgs); const [open, setOpen] = useState(false); const [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null); const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ imei: '', name: '', model: 'TAT240', serial: '', org: '' })
  const save = async () => { setBusy(true); setMsg(null); const { error } = await supabase.from('trackers').insert({ imei: f.imei.trim(), name: f.name.trim(), model: f.model.trim() || 'TAT240', serial_no: f.serial.trim() || null, org_id: f.org || null }); setBusy(false)
    if (error) return setMsg({ k: 'error', t: error.code === '23505' ? 'That IMEI is already registered.' : error.code === '23514' ? 'An IMEI is exactly 15 digits.' : error.message }); setMsg({ k: 'ok', t: `Tracker ${f.imei} registered. It can now send data to the gateway.` }); setOpen(false); setF({ ...f, imei: '', name: '', serial: '' }); await load() }
  const [ed, setEd] = useState<{ imei: string; name: string; model: string; serial: string; org: string } | null>(null)
  const edit = (t: typeof trackers[number]) => { setMsg(null); setEd({ imei: t.imei, name: t.name ?? '', model: t.model ?? '', serial: t.serial_no ?? '', org: t.org_id ?? '' }) }
  const saveEdit = async () => { if (!ed) return; setBusy(true); const { error } = await supabase.from('trackers').update({ name: ed.name.trim(), model: ed.model.trim() || 'TAT240', serial_no: ed.serial.trim() || null, org_id: ed.org || null }).eq('imei', ed.imei); setBusy(false)
    if (error) return setMsg({ k: 'error', t: error.message }); setMsg({ k: 'ok', t: `Tracker ${ed.imei} updated.` }); setEd(null); await load() }
  const toggle = async (imei: string, active: boolean) => { await supabase.from('trackers').update({ active: !active }).eq('imei', imei); await load() }
  const del = async (imei: string) => { if (!confirm(`Remove tracker ${imei}? Its stored positions stay.`)) return; const { error } = await supabase.from('trackers').delete().eq('imei', imei); if (error) setMsg({ k: 'error', t: error.message }); else await load() }
  return (
    <Card className="mb-6"><Head title="Trackers" sub="A tracker can only send data once its IMEI is registered here." open={open} onAdd={() => setOpen(!open)} />
      {msg && <div className="px-6 pt-4"><Notice kind={msg.k} onClose={() => setMsg(null)}>{msg.t}</Notice></div>}
      {open && <div className="space-y-4 border-b border-stone-100 bg-stone-50 p-6"><div className="grid gap-4 md:grid-cols-5"><Field label="IMEI" required hint="15 digits, printed on the device"><input value={f.imei} onChange={(e) => setF({ ...f, imei: e.target.value.replace(/\D/g, '').slice(0, 15) })} className={`${inputCls} mono`} inputMode="numeric" /></Field>
        <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Van 3" className={inputCls} /></Field><Field label="Model"><input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} className={inputCls} /></Field>
        <Field label="Serial number"><input value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} className={inputCls} /></Field><Field label="Belongs to"><select value={f.org} onChange={(e) => setF({ ...f, org: e.target.value })} className={inputCls}><option value="">Not assigned</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field></div>
        <button disabled={busy || f.imei.length !== 15} onClick={save} className={btnPrimary}>Register tracker</button></div>}
      {trackers.length === 0 ? <div className="px-6 py-8 text-center text-[14.5px] text-stone-400">No trackers registered.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-[14px]"><thead><tr><th>Tracker</th><th>IMEI</th><th>Model</th><th>Belongs to</th><th>Status</th><th>Battery</th><th>Last seen</th><th /></tr></thead>
        <tbody className="divide-y divide-stone-100">{trackers.map((t) => <Fragment key={t.imei}><tr className={t.active ? '' : 'opacity-60'}><td className="font-medium text-stone-900">{t.name || '–'}{t.kind === 'phone' && <span className="ml-2 rounded-full bg-cyan-50 px-2 py-0.5 text-[11.5px] font-medium text-cyan-700">Phone</span>}</td><td className="mono text-[12.5px]">{t.imei}</td><td>{t.kind === 'phone' ? t.model : `${t.vendor} ${t.model}`}</td><td>{orgs.find((o) => o.id === t.org_id)?.name ?? 'Not assigned'}</td><td><Chip tone={t.active ? HEALTH_TONE[trackerHealth(t.kind, t.last_seen)] : 'slate'}>{t.active ? HEALTH_LABEL[trackerHealth(t.kind, t.last_seen)] : 'Off'}</Chip></td><td>{t.battery_pct != null ? `${t.battery_pct}%` : '–'}</td><td className="text-stone-500">{ago(t.last_seen)}</td>
          <td className="text-right"><button onClick={() => toggle(t.imei, t.active)} className={`mr-2 rounded-full px-3 py-1 text-[12.5px] font-medium ${t.active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{t.active ? 'Active' : 'Off'}</button><button onClick={() => edit(t)} aria-label="Edit tracker" className="mr-1 inline-grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"><Pencil size={16} /></button><button onClick={() => del(t.imei)} aria-label="Remove tracker" className="inline-grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button></td></tr>
          {ed?.imei === t.imei && <tr><td colSpan={7} className="bg-stone-50 p-4"><div className="grid gap-3 md:grid-cols-4"><Field label="Name"><input value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} className={inputCls} /></Field><Field label="Model"><input value={ed.model} onChange={(e) => setEd({ ...ed, model: e.target.value })} className={inputCls} /></Field><Field label="Serial number"><input value={ed.serial} onChange={(e) => setEd({ ...ed, serial: e.target.value })} className={inputCls} /></Field><Field label="Belongs to"><select value={ed.org} onChange={(e) => setEd({ ...ed, org: e.target.value })} className={inputCls}><option value="">Not assigned</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field></div>
            <div className="mt-3 flex gap-2"><button disabled={busy} onClick={saveEdit} className={btnPrimary}>Save changes</button><button onClick={() => setEd(null)} className={btnGhost}>Cancel</button></div></td></tr>}</Fragment>)}</tbody></table></div>}
    </Card>)
}

const ZKINDS: [string, string][] = [['dock', 'Dock or entrance'], ['store', 'Clean store'], ['clinical', 'Ward or clinical area'], ['dirty', 'Dirty utility or cages'], ['processing', 'Washing or processing'], ['clean', 'Clean finishing'], ['outside', 'Outside or yard'], ['other', 'Other']]
export function ZonesAdmin() {
  const { sites, zones, load } = useInfra(); const [open, setOpen] = useState(false); const [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null); const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ site: '', name: '', kind: 'clinical', floor: '0' })
  const save = async () => { setBusy(true); setMsg(null); const { error } = await supabase.from('zones').insert({ site_id: f.site, code: f.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20), name: f.name.trim(), kind: f.kind, floor: +f.floor || 0 }); setBusy(false)
    if (error) return setMsg({ k: 'error', t: error.message }); setMsg({ k: 'ok', t: `${f.name} added.` }); setF({ ...f, name: '' }); await load() }
  type ZEd = { id: string; name: string; kind: string; floor: string }
  const [ed, setEd] = useState<ZEd | null>(null)
  const saveEdit = async () => { if (!ed) return; if (!ed.name.trim()) return setMsg({ k: 'error', t: 'Enter a zone name.' })
    setBusy(true); const { error } = await supabase.from('zones').update({ name: ed.name.trim(), kind: ed.kind, floor: +ed.floor || 0 }).eq('id', ed.id); setBusy(false)
    if (error) return setMsg({ k: 'error', t: error.message }); setMsg({ k: 'ok', t: `${ed.name.trim()} updated. Reads from now on use the new kind.` }); setEd(null); await load() }
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
        <tbody className="divide-y divide-stone-100">{mine.map((z) => <Fragment key={z.id}><tr><td className="font-medium text-stone-900">{z.name}</td><td>{sites.find((s) => s.id === z.site_id)?.name}</td><td>{z.floor === 0 ? 'Ground' : `Floor ${z.floor}`}</td><td>{ZKINDS.find(([k]) => k === z.kind)?.[1] ?? z.kind}</td><td className="text-right"><EditBtn onClick={() => { setMsg(null); setEd({ id: z.id, name: z.name, kind: z.kind, floor: String(z.floor ?? 0) }) }} label={`Edit ${z.name}`} /><button onClick={() => del(z.id)} aria-label="Remove zone" className="grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button></td></tr>{ed?.id === z.id && <EditRow cols={5} busy={busy} onSave={saveEdit} onCancel={() => setEd(null)}>
          <Field label="Zone name" required><input value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} className={inputCls} /></Field>
          <Field label="What happens here"><select value={ed.kind} onChange={(e) => setEd({ ...ed, kind: e.target.value })} className={inputCls}>{ZKINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Floor (0 = ground)"><input value={ed.floor} onChange={(e) => setEd({ ...ed, floor: e.target.value.replace(/\D/g, '') })} className={inputCls} /></Field></EditRow>}</Fragment>)}</tbody></table></div>}
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
      <p className="mt-1 text-[14px] text-stone-500">Each reader posts the tags it sees to its own web address (use <b>Connect</b> on a reader below). Readers can send JSON in almost any layout (Impinj, Zebra, Chainway and similar), a list of tags, or plain text with one tag per line. Every read updates the item&rsquo;s zone and state and is kept in its journey.</p>
      <pre className="mono mt-4 overflow-x-auto rounded-lg bg-stone-50 p-4 text-[12.5px] leading-relaxed text-stone-700">{`POST ${url}\nheader  x-ingest-token: <your INGEST_TOKEN>\nbody    {"reader":"R-DOCK-01","reads":[{"epc":"E28011606000020D1A2B3C4D","ts":"2026-11-06T09:30:00Z"}]}`}</pre>
      <div className="mt-5 grid gap-4 border-t border-stone-100 pt-5 md:grid-cols-[1fr_1.4fr_auto]"><Field label="Send a test read" hint="No hardware needed"><select value={reader} onChange={(e) => setReader(e.target.value)} className={inputCls}><option value="">Choose a reader</option>{readers.map((r) => <option key={r.id} value={r.code}>{r.code}{r.label ? ` · ${r.label}` : ''}</option>)}</select></Field>
        <Field label="Tag (EPC) of an item on the list"><input value={epc} onChange={(e) => setEpc(e.target.value)} className={`${inputCls} mono`} /></Field><div className="flex items-end"><button disabled={busy || !reader || epc.replace(/[^0-9a-f]/gi, '').length < 8} onClick={send} className={btnPrimary}>Send</button></div></div>
      {res && <div className="mt-4"><Notice kind={res.k} onClose={() => setRes(null)}>{res.t}</Notice></div>}</Card>)
}

interface Veh { id: string; reg: string; driver: string; role: string; tracker_imei: string | null; tracker_model: string; org_id: string | null; active: boolean }
/** Vehicles and the tracker fitted to each. A vehicle can be edited, re-assigned to another tracker or client, or removed. */
export function VehiclesAdmin() {
  const { trackers } = useInfra(); const orgs = useAuth((s) => s.orgs); const [rows, setRows] = useState<Veh[]>([]); const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false); const [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null); const [busy, setBusy] = useState(false)
  const blank = { reg: '', driver: '', role: '', imei: '', model: 'Teltonika TAT240', org: '' }; const [f, setF] = useState(blank); const [ed, setEd] = useState<(typeof blank & { id: string }) | null>(null)
  const load = async () => { const { data } = await supabase.from('vehicles').select('id,reg,driver,role,tracker_imei,tracker_model,org_id,active').eq('source', 'admin').order('reg'); setRows((data ?? []) as Veh[]); setLoaded(true) }
  useEffect(() => { void load() }, [])
  const hw = trackers.filter((t) => t.kind === 'tracker')
  const err = (e: { code?: string; message: string }) => (e.code === '23505' ? 'A vehicle with that registration already exists.' : e.message)
  const clash = (imei: string, id?: string) => !!imei && rows.some((v) => v.tracker_imei === imei && v.id !== id)
  const save = async () => { if (clash(f.imei)) return setMsg({ k: 'error', t: 'That tracker is already fitted to another vehicle.' }); setBusy(true); setMsg(null)
    const { error } = await supabase.from('vehicles').insert({ reg: f.reg.trim().toUpperCase(), driver: f.driver.trim(), role: f.role.trim(), tracker_imei: f.imei || null, tracker_model: f.model.trim(), org_id: f.org || null, source: 'admin' }); setBusy(false)
    if (error) return setMsg({ k: 'error', t: err(error) }); setMsg({ k: 'ok', t: `${f.reg.trim().toUpperCase()} added.` }); setOpen(false); setF(blank); await load() }
  const saveEdit = async () => { if (!ed) return; if (!ed.reg.trim()) return setMsg({ k: 'error', t: 'Enter the registration.' }); if (clash(ed.imei, ed.id)) return setMsg({ k: 'error', t: 'That tracker is already fitted to another vehicle.' })
    setBusy(true); const { error } = await supabase.from('vehicles').update({ reg: ed.reg.trim().toUpperCase(), driver: ed.driver.trim(), role: ed.role.trim(), tracker_imei: ed.imei || null, tracker_model: ed.model.trim(), org_id: ed.org || null }).eq('id', ed.id); setBusy(false)
    if (error) return setMsg({ k: 'error', t: err(error) }); setMsg({ k: 'ok', t: `${ed.reg.trim().toUpperCase()} updated.` }); setEd(null); await load() }
  const toggle = async (v: Veh) => { await supabase.from('vehicles').update({ active: !v.active }).eq('id', v.id); await load() }
  const del = async (v: Veh) => { if (!confirm(`Remove vehicle ${v.reg}? The tracker and its route history stay.`)) return; const { error } = await supabase.from('vehicles').delete().eq('id', v.id); if (error) setMsg({ k: 'error', t: error.message }); else await load() }
  const fields = (x: typeof blank, set: (v: typeof blank) => void) => <>
    <Field label="Registration" required><input value={x.reg} onChange={(e) => set({ ...x, reg: e.target.value })} placeholder="e.g. AB12 CDE" className={inputCls} /></Field>
    <Field label="Driver"><input value={x.driver} onChange={(e) => set({ ...x, driver: e.target.value })} className={inputCls} /></Field>
    <Field label="What it does" hint="e.g. Laundry shuttle"><input value={x.role} onChange={(e) => set({ ...x, role: e.target.value })} className={inputCls} /></Field>
    <Field label="Tracker fitted"><select value={x.imei} onChange={(e) => set({ ...x, imei: e.target.value })} className={inputCls}><option value="">None</option>{hw.map((t) => <option key={t.imei} value={t.imei}>{t.name || t.imei}</option>)}</select></Field>
    <Field label="Tracker model"><input value={x.model} onChange={(e) => set({ ...x, model: e.target.value })} className={inputCls} /></Field>
    <Field label="Belongs to"><select value={x.org} onChange={(e) => set({ ...x, org: e.target.value })} className={inputCls}><option value="">Not assigned</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field></>
  return (
    <Card className="mb-6"><Head title="Vehicles" sub="Each vehicle with its registration, driver and the tracker fitted to it." open={open} onAdd={() => setOpen(!open)} />
      {msg && <div className="px-6 pt-4"><Notice kind={msg.k} onClose={() => setMsg(null)}>{msg.t}</Notice></div>}
      {open && <div className="space-y-4 border-b border-stone-100 bg-stone-50 p-6"><div className="grid gap-4 md:grid-cols-3">{fields(f, setF)}</div><button disabled={busy || !f.reg.trim()} onClick={save} className={btnPrimary}>Add vehicle</button></div>}
      {!loaded ? <div className="px-6 py-8 text-center text-stone-400">Loading…</div> : rows.length === 0 ? <div className="px-6 py-8 text-center text-[14.5px] text-stone-400">No vehicles yet. Add one and choose the tracker fitted to it.</div> :
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-[14px]"><thead><tr><th>Vehicle</th><th>Driver</th><th>Role</th><th>Tracker</th><th>Belongs to</th><th>Status</th><th /></tr></thead>
          <tbody className="divide-y divide-stone-100">{rows.map((v) => { const t = trackers.find((x) => x.imei === v.tracker_imei); return <Fragment key={v.id}><tr className={v.active ? '' : 'opacity-60'}>
            <td className="font-medium text-stone-900">{v.reg}</td><td>{v.driver || '–'}</td><td className="text-stone-600">{v.role || '–'}</td>
            <td>{t ? <><span className="font-medium text-stone-800">{t.name || t.imei}</span> <Chip tone={t.active ? HEALTH_TONE[trackerHealth(t.kind, t.last_seen)] : 'slate'}>{t.active ? HEALTH_LABEL[trackerHealth(t.kind, t.last_seen)] : 'Off'}</Chip></> : <span className="text-stone-400">None fitted</span>}</td>
            <td>{orgs.find((o) => o.id === v.org_id)?.name ?? 'Not assigned'}</td>
            <td><button onClick={() => void toggle(v)} className={`rounded-full px-3 py-1 text-[12.5px] font-medium ${v.active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{v.active ? 'In service' : 'Out of service'}</button></td>
            <td className="whitespace-nowrap text-right"><EditBtn onClick={() => { setMsg(null); setEd({ id: v.id, reg: v.reg, driver: v.driver ?? '', role: v.role ?? '', imei: v.tracker_imei ?? '', model: v.tracker_model ?? '', org: v.org_id ?? '' }) }} label={`Edit ${v.reg}`} /><button onClick={() => void del(v)} aria-label={`Remove ${v.reg}`} className="inline-grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button></td></tr>
            {ed?.id === v.id && <EditRow cols={7} busy={busy} onSave={saveEdit} onCancel={() => setEd(null)}>{fields(ed, (x) => setEd({ ...x, id: ed.id }))}</EditRow>}</Fragment> })}</tbody></table></div>}
    </Card>)
}
