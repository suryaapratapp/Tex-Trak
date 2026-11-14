import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Boxes, Cpu, Package, ScanLine, Tag } from 'lucide-react'
import { hasFeature, hasModule } from '../sim/registry'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useQr, useQrLoad, isOverdue } from '../qr/store'
import { DownloadApp } from '../components/DownloadApp'
import { go, useStore } from '../store'
import { loadAttention, type Attn } from '../lib/liveAttention'
import { readerHealth, trackerHealth } from '../lib/status'

const DOT = { info: '#a3abc2', warn: '#e0a030', bad: '#e5586b', good: '#3fb68b' }
function Tile({ icon, color, title, headline, label, status, bad, page }: { icon: React.ReactNode; color: string; title: string; headline: string | number; label: string; status: string; bad?: boolean; page: string }) {
  return (
    <button onClick={() => go(page)} className="card group p-6 text-left transition hover:border-cyan-200 hover:shadow-md">
      <div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: color + '18', color }}>{icon}</span><ArrowRight size={17} className="text-stone-300 transition group-hover:text-cyan-600" /></div>
      <h3 className="mt-5 text-[16px] font-semibold text-stone-800">{title}</h3>
      <div className="mt-1 flex items-baseline gap-2"><span className="text-[34px] font-semibold leading-none tracking-tight text-stone-900">{headline}</span><span className="text-[14px] text-stone-500">{label}</span></div>
      <div className="mt-4 flex items-center gap-2 text-[13.5px] text-stone-500"><i className="h-2 w-2 rounded-full" style={{ background: bad ? DOT.bad : DOT.good }} />{status}</div>
    </button>)
}

/** Home with live data only: every number comes from the database, nothing from the demo world. */
export default function HomeLive() {
  const role = useStore((s) => s.role); const user = useAuth((s) => s.user); const isSuper = user?.role === 'superadmin'
  useQrLoad(60000); const prods = Object.values(useQr((s) => s.products)); const overdue = prods.filter(isOverdue).length
  const [n, setN] = useState({ ship: 0, inUse: 0, missing: 0, items: 0, trkOn: 0, trk: 0, rdOn: 0, rd: 0 }); const [attn, setAttn] = useState<Attn[]>([]); const [loaded, setLoaded] = useState(false)
  const load = useCallback(async () => {
    const head = (t: string, f?: (q: any) => any) => { const q = supabase.from(t).select('id', { count: 'exact', head: true }); return (f ? f(q) : q).then((r: { count: number | null }) => r.count ?? 0) } // eslint-disable-line @typescript-eslint/no-explicit-any
    const [ship, inUse, missing, items, trk, rd, a] = await Promise.all([
      hasFeature(role, 'shipments') ? head('shipments', (q) => q.in('status', ['booked', 'in_transit'])) : 0, head('items', (q) => q.eq('status', 'in_use')), head('items', (q) => q.eq('status', 'missing')), head('items'),
      isSuper ? supabase.from('trackers').select('kind,last_seen').eq('active', true) : Promise.resolve({ data: [] }), isSuper ? supabase.from('readers').select('last_seen') : Promise.resolve({ data: [] }), loadAttention(isSuper)])
    const t = (trk.data ?? []) as { kind: 'tracker' | 'phone'; last_seen: string | null }[]; const r = (rd.data ?? []) as { last_seen: string | null }[]
    setN({ ship, inUse, missing, items, trkOn: t.filter((x) => trackerHealth(x.kind, x.last_seen) === 'online').length, trk: t.length, rdOn: r.filter((x) => readerHealth(x.last_seen) === 'online').length, rd: r.length }); setAttn(a); setLoaded(true)
  }, [role, isSuper])
  useEffect(() => { void load(); const id = setInterval(() => void load(), 30000); return () => clearInterval(id) }, [load])
  const hour = new Date().getHours(); const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const bad = attn.filter((a) => a.tone === 'bad').length
  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-8 p-6 sm:p-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-[28px] font-semibold tracking-tight text-stone-900">{hello}, {user?.full_name.split(' ')[0] ?? ''}</h1><p className="mt-1 text-[15px] text-stone-500">{!loaded ? 'Checking…' : bad ? `${bad} thing${bad === 1 ? '' : 's'} need${bad === 1 ? 's' : ''} a look.` : attn.length ? 'Nothing urgent. A few things to be aware of below.' : 'Everything is running normally.'}</p></div>
        {hasFeature(role, 'scan') && <button onClick={() => go('scan')} className="flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-3 text-[14.5px] font-medium text-white shadow-sm hover:bg-cyan-700"><ScanLine size={17} /> Scan</button>}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-5">
        {hasModule(role, 'curtains') && <Tile icon={<Tag size={20} />} color="#6a57e6" title="Curtains" headline={prods.filter((p) => p.status === 'in_use').length} label="installed" status={overdue ? `${overdue} overdue for change` : 'None overdue'} bad={!!overdue} page="qrdash" />}
        {hasModule(role, 'laundry') && <Tile icon={<Boxes size={20} />} color="#8b5cf6" title="Laundry and items" headline={n.items} label="on the list" status={n.missing ? `${n.missing} missing · ${n.inUse} in use` : `${n.inUse} in use · none missing`} bad={!!n.missing} page="inventory" />}
        {hasModule(role, 'shipments') && <Tile icon={<Package size={20} />} color="#e0a030" title="Shipments" headline={n.ship} label="open" status={attn.some((a) => a.id === 'ship-exc') ? 'A problem to look at' : 'No problems'} bad={attn.some((a) => a.id === 'ship-exc')} page="shipments" />}
        {isSuper && <Tile icon={<Cpu size={20} />} color="#0e8f7e" title="Devices" headline={`${n.trkOn + n.rdOn} / ${n.trk + n.rd}`} label="online" status={`${n.trkOn}/${n.trk} trackers and phones · ${n.rdOn}/${n.rd} readers`} bad={n.trkOn + n.rdOn < n.trk + n.rd} page="status" />}
      </div>
      {loaded && !prods.length && !n.items && !n.ship && !isSuper ? <div className="card p-8 text-center text-[14.5px] text-stone-500">Nothing here yet. Your first scans and imports will appear as soon as they are saved.</div> : null}
      {attn.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-semibold text-stone-800">Needs attention</h2><button onClick={() => go('alerts')} className="text-[14px] font-medium text-cyan-700 hover:underline">All alerts</button></div>
        <div className="card divide-y divide-stone-100">{attn.slice(0, 4).map((a) => <button key={a.id} onClick={() => a.page && go(a.page)} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-stone-50"><i className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: DOT[a.tone] }} /><span><span className="block text-[14.5px] font-medium text-stone-900">{a.title}</span><span className="block text-[13.5px] text-stone-500">{a.body}</span></span></button>)}</div></section>}
      <div className="max-w-[520px]"><DownloadApp variant="card" /></div>
    </div>)
}
