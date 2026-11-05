import { useMemo, useState } from 'react'
import { Building2, CheckCircle2, Globe2, Radio, Recycle, ShieldAlert, Users } from 'lucide-react'
import { Card, CardHead, Chip, Kpi, Page } from '../components/ui'
import { FleetMapView } from '../components/FleetMapView'
import { MapLegend } from '../components/MapLegend'
import { CLIENTS, KIND_COLOR, KIND_GLYPH, KIND_LABEL, MODULES, NETWORK, UPPER_FLOOR_READERS, isRestricted, totals, type ClientId, type ModuleId } from '../sim/registry'
import { DECON_PLAN, HOSPITAL_PLAN } from '../sim/world'
import { UPPER } from '../sim/floors'
import { VEHICLES } from '../sim/world'
import { useStore } from '../store'
import { getWorld } from '../sim/engine'

const TABS = [['clients', 'Clients'], ['sites', 'Sites'], ['readers', 'RFID readers'], ['map', 'UK map'], ['devices', 'Trackers']] as const
type Tab = (typeof TABS)[number][0]
const stateTone = { live: 'green', provisioned: 'blue', planned: 'slate' } as const

export default function Admin() {
  const [tab, setTab] = useState<Tab>('clients'); const [client, setClient] = useState<'all' | ClientId | 'shared'>('all'); const [kind, setKind] = useState('all'); const [q, setQ] = useState('')
  const setRole = useStore((s) => s.setRole)
  const all = totals(NETWORK)
  const rows = useMemo(() => NETWORK.filter((n) => (client === 'all' || n.client === client) && (kind === 'all' || n.kind === kind) && (n.name + n.region).toLowerCase().includes(q.toLowerCase())), [client, kind, q])
  const owner = (c: string) => (c === 'shared' ? 'Shared' : CLIENTS[c as ClientId].name)
  const readers = [
    ...HOSPITAL_PLAN.readers.map((r) => ({ id: r.id, site: 'Royal Meridian Hospital', floor: 'Ground', where: r.label, client: 'Synergy' })),
    ...(['1', '2', '3'] as const).flatMap((f) => UPPER[f].readers.map((r) => ({ id: r.id, site: 'Royal Meridian Hospital', floor: `Floor ${f}`, where: r.label, client: 'Synergy' }))),
    ...DECON_PLAN.readers.map((r) => ({ id: r.id, site: 'Decon Plant', floor: 'Ground', where: r.label, client: 'Shared' })),
    { id: 'R-RECY-IN', site: 'GreenLoop Recycling', floor: 'Gate', where: 'Weighbridge inbound', client: 'Shared' }, { id: 'R-RECY-WB', site: 'GreenLoop Recycling', floor: 'Gate', where: 'Weighbridge scale', client: 'Shared' },
    { id: 'R-SYN-OUT', site: 'Synergy Facility', floor: 'Gate', where: 'Dispatch door', client: 'Synergy' }, { id: 'R-SYN-IN', site: 'Synergy Facility', floor: 'Gate', where: 'Receiving door', client: 'Synergy' },
  ]
  const [rq, setRq] = useState('')
  const rr = readers.filter((r) => (r.id + r.site + r.where + r.floor).toLowerCase().includes(rq.toLowerCase()))
  const w = getWorld()
  return (
    <Page title="Super Admin" sub="Every client, site, floor and RFID reader on the platform."
      right={<div className="flex gap-2">{(['synergy', 'clientA'] as const).map((c) => <button key={c} onClick={() => setRole(c)} className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50">View as {CLIENTS[c].name}</button>)}</div>}>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label="Clients" value={Object.keys(CLIENTS).length} icon={<Users size={15} />} />
        <Kpi label="Sites" value={all.sites} icon={<Globe2 size={15} />} />
        <Kpi label="Hospitals" value={all.hospitals} icon={<Building2 size={15} />} />
        <Kpi label="RFID readers" value={all.readers} icon={<Radio size={15} />} tone="good" />
        <Kpi label="Recycling plants" value={all.recyclers} icon={<Recycle size={15} />} />
        <Kpi label="Restricted zones" value={all.restricted} icon={<ShieldAlert size={15} />} tone="warn" sub="ports and incinerators" />
      </div>
      <div className="mb-5 inline-flex flex-wrap rounded-full bg-stone-200/70 p-1">{TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${tab === k ? 'bg-white text-stone-900 shadow' : 'text-stone-500'}`}>{l}</button>)}</div>

      {tab === 'clients' && <div className="grid gap-5 lg:grid-cols-2">{Object.values(CLIENTS).map((c) => { const t = totals(NETWORK.filter((n) => n.client === c.id)); return (
        <Card key={c.id}><div className="flex items-start gap-4 p-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-extrabold text-white" style={{ background: c.color }}>{c.name[0]}</span>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-extrabold text-stone-900">{c.name}</h3><Chip tone="cyan">{c.plan}</Chip></div><p className="text-sm text-stone-500">{c.tagline}</p><p className="mt-1 text-xs text-stone-400">Customer since {c.since} · {c.contact}</p></div></div>
          <div className="grid grid-cols-3 gap-2 px-5 pb-4">{[[t.sites, 'sites'], [t.hospitals, 'hospitals'], [t.readers, 'RFID readers']].map(([v, l]) => <div key={l as string} className="rounded-2xl bg-stone-50 p-3"><div className="text-2xl font-extrabold text-stone-900">{v}</div><div className="text-[11px] font-semibold text-stone-500">{l}</div></div>)}</div>
          <div className="border-t border-stone-100 px-5 py-4"><div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-400">Modules</div>
            <div className="flex flex-wrap gap-2">{(Object.keys(MODULES) as ModuleId[]).map((m) => { const on = c.modules.includes(m); return <span key={m} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-400 line-through'}`}>{on && <CheckCircle2 size={13} />}{MODULES[m].label}</span> })}</div></div>
          <div className="border-t border-stone-100 px-5 py-4"><div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-400">Users</div>
            <ul className="grid gap-1.5 sm:grid-cols-2">{c.users.map((u) => <li key={u.name} className="flex items-center gap-2 text-sm"><span className="grid h-7 w-7 place-items-center rounded-full bg-stone-100 text-[11px] font-extrabold text-stone-600">{u.name.split(' ').map((x) => x[0]).join('')}</span><span><span className="block font-semibold text-stone-800">{u.name}</span><span className="block text-[11px] text-stone-500">{u.role}</span></span></li>)}</ul></div></Card>) })}</div>}

      {tab === 'sites' && <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sites or regions" className="min-w-[200px] flex-1 rounded-full border border-stone-200 px-4 py-2 text-sm outline-none focus:border-cyan-500" />
          <select value={client} onChange={(e) => setClient(e.target.value as typeof client)} className="rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-semibold"><option value="all">All clients</option><option value="synergy">Synergy</option><option value="clientA">Client A</option><option value="shared">Shared</option></select>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-semibold"><option value="all">All types</option>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[13px]"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500"><tr><th className="px-4 py-2">Site</th><th>Type</th><th>Owner</th><th>Region</th><th className="text-right">Floors</th><th className="text-right">RFID readers</th><th className="pr-4 text-right">Status</th></tr></thead>
          <tbody className="divide-y divide-stone-100">{rows.map((n) => (<tr key={n.id} className="hover:bg-stone-50"><td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><i className="grid h-6 w-6 place-items-center rounded-lg text-[11px] text-white" style={{ background: KIND_COLOR[n.kind] }}>{KIND_GLYPH[n.kind]}</i><div><div className="font-bold text-stone-900">{n.name}</div>{n.note && <div className="text-[11px] text-stone-500">{n.note}</div>}</div></div></td>
            <td>{KIND_LABEL[n.kind]}{isRestricted(n.kind) && <b className="ml-1 text-rose-600">⚠</b>}</td><td>{owner(n.client)}</td><td className="text-stone-600">{n.region}</td><td className="text-right mono">{n.floors || '–'}</td><td className="text-right mono font-bold">{n.readers || '–'}</td><td className="pr-4 text-right"><Chip tone={stateTone[n.state]}>{n.sim ? 'live demo' : n.state}</Chip></td></tr>))}</tbody></table></div>
        <div className="border-t border-stone-100 px-4 py-2.5 text-xs text-stone-500">{rows.length} of {NETWORK.length} sites</div></Card>}

      {tab === 'readers' && <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 p-3"><input value={rq} onChange={(e) => setRq(e.target.value)} placeholder="Search readers" className="min-w-[200px] flex-1 rounded-full border border-stone-200 px-4 py-2 text-sm outline-none focus:border-cyan-500" /><span className="text-xs font-semibold text-stone-500">{rr.length} readers · hospital {HOSPITAL_PLAN.readers.length + 3 * UPPER_FLOOR_READERS} · decon {DECON_PLAN.readers.length}</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[13px]"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500"><tr><th className="px-4 py-2">Reader</th><th>Site</th><th>Floor</th><th>Location</th><th>Owner</th><th className="pr-4 text-right">Last read</th></tr></thead>
          <tbody className="divide-y divide-stone-100">{rr.map((r) => { const l = (w.readerEvents[r.id] ?? []).slice(-1)[0]; return <tr key={r.id} className="hover:bg-stone-50"><td className="mono px-4 py-2 font-semibold text-stone-900">{r.id}</td><td>{r.site}</td><td>{r.floor}</td><td className="text-stone-600">{r.where}</td><td>{r.client}</td><td className="mono pr-4 text-right text-stone-500">{l ? `${String(Math.floor((l % 1440) / 60)).padStart(2, '0')}:${String(Math.floor(l % 60)).padStart(2, '0')}` : 'online'}</td></tr> })}</tbody></table></div></Card>}

      {tab === 'map' && <Card className="relative overflow-hidden"><CardHead title="UK network" sub="Ports and incinerators are ringed in red; recycling plants in green." /><FleetMapView vehIds={[]} height={600} network={NETWORK} /><MapLegend /></Card>}

      {tab === 'devices' && <Card><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[13px]"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500"><tr><th className="px-4 py-2">Vehicle</th><th>Tracker</th><th>IMEI</th><th>Owner</th><th>Role</th><th className="pr-4 text-right">Source</th></tr></thead>
        <tbody className="divide-y divide-stone-100">{VEHICLES.map((v) => <tr key={v.id}><td className="px-4 py-2.5 font-bold text-stone-900"><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: v.color }} />{v.reg}</td><td>{v.model}</td><td className="mono text-xs">{v.imei}</td><td>{v.id === 'V4' ? 'Client A' : 'Synergy'}</td><td className="text-stone-600">{v.role}</td><td className="pr-4 text-right"><Chip tone={v.simulated ? 'slate' : 'green'}>{v.simulated ? 'simulated' : 'physical unit'}</Chip></td></tr>)}</tbody></table></div></Card>}
    </Page>)
}
