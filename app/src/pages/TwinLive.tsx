import { useMemo, useState } from 'react'
import { Radio } from 'lucide-react'
import { Card, CardHead, Chip, STATUS_COLOR, STATUS_LABEL } from '../components/ui'
import { ago, useLiveData, useLiveLoad } from '../lib/liveData'
import { useAuth } from '../lib/auth'
import { go, useStore } from '../store'
import { btnPrimary } from '../qr/ui'

export default function TwinLive() {
  useLiveLoad(10000); const { items, zones, readers, sites, events, loaded } = useLiveData(); const role = useStore((s) => s.role); const user = useAuth((s) => s.user)
  const withKit = useMemo(() => sites.filter((s) => s.source === 'admin' && (readers.some((r) => r.site_id === s.id) || zones.some((z) => z.site_id === s.id))), [sites, readers, zones])
  const [pick, setPick] = useState(''); const site = withKit.find((s) => s.id === pick) ?? withKit[0]
  const mineItems = items.filter((i) => role === 'superadmin' || i.org_id === role)
  if (loaded && !site) return (
    <Card className="p-10 text-center"><div className="mx-auto max-w-lg"><h3 className="text-[18px] font-semibold text-stone-900">No facility is set up yet</h3><p className="mt-2 text-[14.5px] text-stone-500">A facility needs a site, its zones (for example Dock, Linen store, Dirty utility) and the RFID readers at the doors. {user?.role === 'superadmin' ? 'Set them up under Super Admin.' : 'Your Tex-Trak administrator sets these up.'}</p>{user?.role === 'superadmin' && <button onClick={() => go('admin')} className={`${btnPrimary} mt-5`}>Open Super Admin</button>}</div></Card>)
  if (!site) return null
  const sz = zones.filter((z) => z.site_id === site.id); const sr = readers.filter((r) => r.site_id === site.id); const floors = [...new Set(sz.map((z) => z.floor ?? 0))].sort((a, b) => a - b)
  const here = mineItems.filter((i) => i.site_id === site.id); const ev = events.filter((e) => e.site_id === site.id).slice(0, 12); const unknown = events.filter((e) => e.type === 'unknown_read' && e.site_id === site.id).length
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3"><select value={site.id} onChange={(e) => setPick(e.target.value)} className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-[14.5px] font-medium" aria-label="Site">{withKit.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <span className="text-[14px] text-stone-500">{here.length} item{here.length === 1 ? '' : 's'} here · {sr.filter((r) => r.online).length}/{sr.length} readers online{unknown ? ` · ${unknown} unknown tag read${unknown === 1 ? '' : 's'}` : ''}</span></div>
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {floors.length === 0 && <Card className="p-8 text-center text-[14.5px] text-stone-500">This site has readers but no zones yet. Add zones under Super Admin → RFID readers so reads can place items in a room.</Card>}
          {floors.map((fl) => (
            <Card key={fl}><CardHead title={fl === 0 ? 'Ground floor' : `Floor ${fl}`} />
              <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">{sz.filter((z) => (z.floor ?? 0) === fl).map((z) => { const zi = here.filter((i) => i.zone_id === z.id); const zr = sr.filter((r) => r.zone_id === z.id); const last = zr.map((r) => r.last_seen).filter(Boolean).sort().pop() ?? null
                return (<div key={z.id} className="rounded-xl border border-stone-200 p-4"><div className="flex items-start justify-between gap-2"><div className="text-[15px] font-medium text-stone-900">{z.name}</div><Chip tone="slate">{z.kind}</Chip></div>
                  <div className="mt-2 text-[30px] font-semibold leading-none text-stone-900">{zi.length}</div><div className="text-[12.5px] text-stone-400">items now</div>
                  <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-stone-100">{Object.keys(STATUS_COLOR).map((s) => { const n = zi.filter((i) => i.status === s).length; return n ? <i key={s} title={`${STATUS_LABEL[s]}: ${n}`} style={{ width: `${(n / zi.length) * 100}%`, background: STATUS_COLOR[s] }} /> : null })}</div>
                  <div className="mt-3 flex items-center gap-1.5 text-[12.5px] text-stone-500"><Radio size={13} className="text-stone-400" />{zr.length} reader{zr.length === 1 ? '' : 's'} · last read {ago(last)}</div></div>) })}</div></Card>))}
        </div>
        <div className="space-y-6">
          <Card><CardHead title="Readers" /><ul className="divide-y divide-stone-100">{sr.length === 0 && <li className="p-5 text-[14px] text-stone-400">No readers registered for this site.</li>}{sr.map((r) => <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3"><div><div className="mono text-[13px] font-medium text-stone-900">{r.code}</div><div className="text-[12.5px] text-stone-500">{r.label || zones.find((z) => z.id === r.zone_id)?.name || 'No zone'}</div></div><div className="text-right"><span className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium ${r.online ? 'text-emerald-600' : 'text-stone-400'}`}><i className={`h-2 w-2 rounded-full ${r.online ? 'bg-emerald-500' : 'bg-stone-300'}`} />{r.online ? 'Online' : 'Off'}</span><div className="text-[12px] text-stone-400">{ago(r.last_seen)}</div></div></li>)}</ul></Card>
          <Card><CardHead title="Latest reads" /><ul className="divide-y divide-stone-100">{ev.length === 0 && <li className="p-5 text-[14px] text-stone-400">Nothing read yet.</li>}{ev.map((e) => { const it = items.find((i) => i.id === e.item_id); return <li key={e.id} className="px-5 py-3"><div className="text-[14px] font-medium text-stone-800">{it ? it.product : 'Unknown tag'} <span className="mono text-[12px] font-normal text-stone-400">{it?.qr ?? e.epc?.slice(-8)}</span></div><div className="text-[12.5px] text-stone-500">{e.detail} · {ago(e.created_at)}</div></li> })}</ul></Card>
        </div>
      </div>
    </>)
}
