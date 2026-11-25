import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Boxes, Cpu, Map as MapIcon, Package, PackagePlus, ScanLine, Tag } from 'lucide-react'
import { hasFeature, hasModule } from '../sim/registry'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useQr, useQrLoad, isOverdue } from '../qr/store'
import { DownloadApp } from '../components/DownloadApp'
import { allowedPages } from '../components/Layout'
import { go, useStore } from '../store'
import { loadAttention, type Attn } from '../lib/liveAttention'
import { readerHealth, trackerHealth } from '../lib/status'
import { ukHour } from '../lib/tz'

const DOT = { info: '#a3abc2', warn: '#e0a030', bad: '#e5586b', good: '#3fb68b' }
function Tile({ icon, color, title, headline, label, status, bad, page }: { icon: React.ReactNode; color: string; title: string; headline: string | number; label: string; status: string; bad?: boolean; page: string }) {
  return (
    <button onClick={() => go(page)} className="card group p-4 text-left transition hover:border-cyan-200 hover:shadow-md sm:p-6">
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
  const hour = ukHour(); const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const bad = attn.filter((a) => a.tone === 'bad').length
  const ok = allowedPages(role)
  const quick = ([['shipments', 'Shipments', <Package key="a" size={17} />], ['scan', 'Scan', <ScanLine key="b" size={17} />], ['map', 'Live map', <MapIcon key="c" size={17} />], ['qrinstall', 'Install curtain', <Tag key="d" size={17} />], ['whreceive', 'Goods in', <PackagePlus key="e" size={17} />]] as [string, string, React.ReactNode][]).filter(([id]) => ok.includes(id)).slice(0, 3).map(([id, label, icon]) => ({ id, label, icon }))
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 p-4 sm:gap-8 sm:p-10">
      <section className="relative order-0 overflow-hidden rounded-[26px] p-5 text-white shadow-[0_24px_60px_-24px_rgba(84,70,204,.7)] sm:p-7" style={{ background: 'linear-gradient(135deg,#6759e4 0%,#4f46c8 45%,#2b7fd6 120%)' }}>
        <i aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" /><i aria-hidden className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-white/75"><span className="relative flex h-2.5 w-2.5"><i className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: bad ? '#fb7185' : '#86efac' }} /><i className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: bad ? '#fb7185' : '#4ade80' }} /></span>{!loaded ? 'Checking' : bad ? 'Needs a look' : attn.length ? 'Mostly calm' : 'All clear'}</div>
        <h1 className="relative mt-2 text-[26px] font-semibold leading-tight tracking-tight text-white sm:text-[32px]" style={{ background: 'none', WebkitTextFillColor: 'white' }}>{hello}, {user?.full_name.split(' ')[0] ?? ''}</h1>
        <p className="relative mt-1 max-w-xl text-[14.5px] text-white/85 sm:text-[15.5px]">{!loaded ? 'Checking everything…' : bad ? `${bad} thing${bad === 1 ? '' : 's'} need${bad === 1 ? 's' : ''} a look, shown first below.` : attn.length ? 'Nothing urgent. A few things to be aware of below.' : n.ship ? `Everything is running normally. ${n.ship} shipment${n.ship === 1 ? ' is' : 's are'} open.` : 'Everything is running normally.'}</p>
        {quick.length > 0 && <div className="relative mt-4 flex flex-wrap gap-2">{quick.map((q) => <button key={q.id} onClick={() => go(q.id)} className="flex items-center gap-2 rounded-2xl border border-white/25 bg-white/15 px-4 py-2.5 text-[14px] font-bold text-white backdrop-blur transition hover:bg-white/25">{q.icon}{q.label}</button>)}</div>}
      </section>
      <div className="order-2 grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(250px,1fr))] sm:gap-5">
        {hasModule(role, 'curtains') && <Tile icon={<Tag size={20} />} color="#6a57e6" title="Curtains" headline={prods.filter((p) => p.status === 'in_use').length} label="installed" status={overdue ? `${overdue} overdue for change` : 'None overdue'} bad={!!overdue} page="qrdash" />}
        {hasModule(role, 'laundry') && <Tile icon={<Boxes size={20} />} color="#8b5cf6" title="Laundry and items" headline={n.items} label="on the list" status={n.missing ? `${n.missing} missing · ${n.inUse} in use` : `${n.inUse} in use · none missing`} bad={!!n.missing} page="inventory" />}
        {hasModule(role, 'shipments') && <Tile icon={<Package size={20} />} color="#e0a030" title="Shipments" headline={n.ship} label="open" status={attn.some((a) => a.id === 'ship-exc') ? 'A problem to look at' : 'No problems'} bad={attn.some((a) => a.id === 'ship-exc')} page="shipments" />}
        {isSuper && <Tile icon={<Cpu size={20} />} color="#0e8f7e" title="Devices" headline={`${n.trkOn + n.rdOn} / ${n.trk + n.rd}`} label="online" status={`${n.trkOn}/${n.trk} trackers and phones · ${n.rdOn}/${n.rd} readers`} bad={n.trkOn + n.rdOn < n.trk + n.rd} page="status" />}
      </div>
      {loaded && !prods.length && !n.items && !n.ship && !isSuper ? <div className="card order-4 p-8 text-center text-[14.5px] text-stone-500">Nothing here yet. Your first scans and imports will appear as soon as they are saved.</div> : null}
      {attn.length > 0 && <section className="order-1 sm:order-3"><div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-semibold text-stone-800">Needs attention</h2><button onClick={() => go('alerts')} className="text-[14px] font-medium text-cyan-700 hover:underline">All alerts</button></div>
        <div className="card divide-y divide-stone-100">{attn.slice(0, 4).map((a) => <button key={a.id} onClick={() => a.page && go(a.page)} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-stone-50"><i className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: DOT[a.tone] }} /><span><span className="block text-[14.5px] font-medium text-stone-900">{a.title}</span><span className="block text-[13.5px] text-stone-500">{a.body}</span></span></button>)}</div></section>}
      <div className="order-4 max-w-[520px]"><DownloadApp variant="card" /></div>
    </div>)
}
