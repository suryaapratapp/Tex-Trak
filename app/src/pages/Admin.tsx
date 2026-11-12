import { useStore } from '../store'
import { useEffect, useMemo, useState } from 'react'
import { Building2, CheckCircle2, Eye, Globe2, Radio, Recycle, ShieldAlert, Users } from 'lucide-react'
import { Card, CardHead, Chip, Kpi, Page } from '../components/ui'
import { FleetMapView } from '../components/FleetMapView'
import { MapLegend } from '../components/MapLegend'
import { KIND_COLOR, KIND_GLYPH, KIND_LABEL, NETWORK, UPPER_FLOOR_READERS, isRestricted, totals } from '../sim/registry'
import { useAuth } from '../lib/auth'
import { ClientsPanel } from './AdminClients'
import { FeedCard, ReadersAdmin, SitesAdmin, TrackersAdmin, VehiclesAdmin, ZonesAdmin } from './AdminInfra'
import { toNet, useInfra } from '../lib/infra'
import { DECON_PLAN, HOSPITAL_PLAN } from '../sim/world'
import { UPPER } from '../sim/floors'
import { VEHICLES } from '../sim/world'
import { getWorld } from '../sim/engine'

const TABS = [['clients', 'Clients'], ['sites', 'Sites'], ['readers', 'RFID readers'], ['map', 'UK map'], ['devices', 'Trackers and vehicles']] as const
type Tab = (typeof TABS)[number][0]
const stateTone = { live: 'green', provisioned: 'blue', planned: 'slate' } as const

export default function Admin() {
  const tab = useStore((st) => st.adminTab) as Tab; const mode = useStore((st) => st.mode); const demo = mode === 'demo'; const setTab = (k: Tab) => useStore.getState().set({ adminTab: k }); const [client, setClient] = useState<string>('all'); const [kind, setKind] = useState('all'); const [q, setQ] = useState('')
  const orgs = useAuth((s) => s.orgs)
  const infra = useInfra(); useEffect(() => { void infra.load() }, [])
  const custom = useMemo(() => toNet(infra.sites, infra.readers), [infra.sites, infra.readers]); const NET = useMemo(() => (demo ? [...NETWORK, ...custom] : custom), [custom, demo])
  const all = totals(NET)
  const rows = useMemo(() => NET.filter((n) => (client === 'all' || n.client === client) && (kind === 'all' || n.kind === kind) && (n.name + n.region).toLowerCase().includes(q.toLowerCase())), [client, kind, q, NET])
  const owner = (c: string) => (c === 'shared' ? 'Shared' : orgs.find((o) => o.id === c)?.name ?? c)
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
    <Page title="Super Admin" demo={demo} sub="Every client, site, floor and RFID reader on the platform.">
      {demo ? <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label="Clients" value={orgs.length} icon={<Users size={15} />} />
        <Kpi label="Sites" value={all.sites} icon={<Globe2 size={15} />} />
        <Kpi label="Hospitals" value={all.hospitals} icon={<Building2 size={15} />} />
        <Kpi label="RFID readers" value={all.readers} icon={<Radio size={15} />} tone="good" />
        <Kpi label="Recycling plants" value={all.recyclers} icon={<Recycle size={15} />} />
        <Kpi label="Restricted zones" value={all.restricted} icon={<ShieldAlert size={15} />} tone="warn" sub="ports and incinerators" />
      </div> : <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Clients" value={orgs.length} icon={<Users size={15} />} />
        <Kpi label="Sites" value={infra.sites.length} icon={<Globe2 size={15} />} />
        <Kpi label="RFID readers" value={infra.readers.length} icon={<Radio size={15} />} tone="good" />
        <Kpi label="Zones" value={infra.zones.length} icon={<Building2 size={15} />} />
        <Kpi label="Trackers and phones" value={infra.trackers.length} icon={<ShieldAlert size={15} />} />
      </div>}
      <div className="mb-5 inline-flex flex-wrap rounded-full bg-stone-200/70 p-1">{TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${tab === k ? 'bg-white text-stone-900 shadow' : 'text-stone-500'}`}>{l}</button>)}</div>

      {tab === 'clients' && <ClientsPanel />}

      {tab === 'sites' && <><SitesAdmin />{demo && <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sites or regions" className="min-w-[200px] flex-1 rounded-full border border-stone-200 px-4 py-2 text-sm outline-none focus:border-cyan-500" />
          <select value={client} onChange={(e) => setClient(e.target.value as typeof client)} className="rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-semibold"><option value="all">All clients</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}<option value="shared">Shared</option></select>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-semibold"><option value="all">All types</option>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[13px]"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500"><tr><th className="px-4 py-2">Site</th><th>Type</th><th>Owner</th><th>Region</th><th className="text-right">Floors</th><th className="text-right">RFID readers</th><th className="pr-4 text-right">Status</th></tr></thead>
          <tbody className="divide-y divide-stone-100">{rows.map((n) => (<tr key={n.id} className="hover:bg-stone-50"><td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><i className="grid h-6 w-6 place-items-center rounded-lg text-[11px] text-white" style={{ background: KIND_COLOR[n.kind] }}>{KIND_GLYPH[n.kind]}</i><div><div className="font-bold text-stone-900">{n.name}</div>{n.note && <div className="text-[11px] text-stone-500">{n.note}</div>}</div></div></td>
            <td>{KIND_LABEL[n.kind]}{isRestricted(n.kind) && <b className="ml-1 text-rose-600">⚠</b>}</td><td>{owner(n.client)}</td><td className="text-stone-600">{n.region}</td><td className="text-right mono">{n.floors || '–'}</td><td className="text-right mono font-bold">{n.readers || '–'}</td><td className="pr-4 text-right"><Chip tone={stateTone[n.state]}>{n.sim ? 'live demo' : n.state}</Chip></td></tr>))}</tbody></table></div>
        <div className="border-t border-stone-100 px-4 py-2.5 text-xs text-stone-500">{rows.length} of {NETWORK.length} example sites</div></Card>}</>}

      {tab === 'readers' && <><FeedCard /><ZonesAdmin /><ReadersAdmin />{demo && <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 p-3"><input value={rq} onChange={(e) => setRq(e.target.value)} placeholder="Search readers" className="min-w-[200px] flex-1 rounded-full border border-stone-200 px-4 py-2 text-sm outline-none focus:border-cyan-500" /><span className="text-xs font-semibold text-stone-500">{rr.length} readers · hospital {HOSPITAL_PLAN.readers.length + 3 * UPPER_FLOOR_READERS} · decon {DECON_PLAN.readers.length}</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[13px]"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500"><tr><th className="px-4 py-2">Reader</th><th>Site</th><th>Floor</th><th>Location</th><th>Owner</th><th className="pr-4 text-right">Last read</th></tr></thead>
          <tbody className="divide-y divide-stone-100">{rr.map((r) => { const l = (w.readerEvents[r.id] ?? []).slice(-1)[0]; return <tr key={r.id} className="hover:bg-stone-50"><td className="mono px-4 py-2 font-semibold text-stone-900">{r.id}</td><td>{r.site}</td><td>{r.floor}</td><td className="text-stone-600">{r.where}</td><td>{r.client}</td><td className="mono pr-4 text-right text-stone-500">{l ? `${String(Math.floor((l % 1440) / 60)).padStart(2, '0')}:${String(Math.floor(l % 60)).padStart(2, '0')}` : 'online'}</td></tr> })}</tbody></table></div></Card>}</>}

      {tab === 'map' && <Card className="relative overflow-hidden"><CardHead title="UK network" sub="Ports and incinerators are ringed in red; recycling plants in green." /><FleetMapView vehIds={[]} height={600} network={NET} /><MapLegend /></Card>}

      {tab === 'devices' && <><TrackersAdmin />{!demo && <VehiclesAdmin />}{demo && <Card><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[13px]"><thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500"><tr><th className="px-4 py-2">Vehicle</th><th>Tracker</th><th>IMEI</th><th>Owner</th><th>Role</th><th className="pr-4 text-right">Source</th></tr></thead>
        <tbody className="divide-y divide-stone-100">{VEHICLES.map((v) => <tr key={v.id}><td className="px-4 py-2.5 font-bold text-stone-900"><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: v.color }} />{v.reg}</td><td>{v.model}</td><td className="mono text-xs">{v.imei}</td><td>{v.id === 'V4' ? 'Client A' : 'Synergy'}</td><td className="text-stone-600">{v.role}</td><td className="pr-4 text-right"><Chip tone={v.simulated ? 'slate' : 'green'}>{v.simulated ? 'simulated' : 'physical unit'}</Chip></td></tr>)}</tbody></table></div></Card>}</>}
    </Page>)
}
