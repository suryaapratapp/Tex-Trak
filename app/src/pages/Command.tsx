import { useEffect, useState } from 'react'
import { ArrowRight, Boxes, Compass, Package, Radar, Recycle, ScanLine, Tag } from 'lucide-react'
import { getWorld, scannerAt, SCANNERS } from '../sim/engine'
import { hasFeature, hasModule } from '../sim/registry'
import { useSnap } from '../sim/snap'
import { insights } from '../lib/insights'
import { alertsFor, consFor } from '../lib/scope'
import { laundry, recycling } from '../lib/analytics'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useQr, useQrLoad, isOverdue } from '../qr/store'
import { go, useStore } from '../store'

const DOT: Record<string, string> = { info: '#a3abc2', warn: '#e0a030', bad: '#e5586b', good: '#3fb68b' }

function Card({ icon, color, title, headline, label, status, bad, page }: { icon: React.ReactNode; color: string; title: string; headline: string | number; label: string; status: string; bad?: boolean; page: string }) {
  return (
    <button onClick={() => go(page)} className="card group p-6 text-left transition hover:border-cyan-200 hover:shadow-md">
      <div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: color + '18', color }}>{icon}</span><ArrowRight size={17} className="text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-cyan-600" /></div>
      <h3 className="mt-5 text-[16px] font-semibold text-stone-800">{title}</h3>
      <div className="mt-1 flex items-baseline gap-2"><span className="text-[34px] font-semibold leading-none tracking-tight text-stone-900">{headline}</span><span className="text-[14px] text-stone-500">{label}</span></div>
      <div className="mt-4 flex items-center gap-2 text-[13.5px] text-stone-500"><i className="h-2 w-2 rounded-full" style={{ background: bad ? DOT.bad : DOT.good }} />{status}</div>
    </button>)
}

export default function Command() {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const role = useStore((s) => s.role); const user = useAuth((s) => s.user)
  useQrLoad(60000); const prods = Object.values(useQr((s) => s.products)); const [open, setOpen] = useState(0)
  const mods = (m: Parameters<typeof hasModule>[1]) => hasModule(role, m)
  useEffect(() => { if (!hasFeature(role, 'shipments')) return; void supabase.from('shipments').select('id', { count: 'exact', head: true }).in('status', ['booked', 'in_transit']).then(({ count }) => setOpen(count ?? 0)) }, [role])
  const lau = laundry(t, snap); const rec = recycling(t, role)
  const off = SCANNERS.map((s) => scannerAt(w.legs, s, t)).filter((r) => r.outside).length
  const exc = consFor(role).filter((c) => c.verdict === 'diverted' && t >= 760).length
  const missing = Number(lau.tiles[1].value)
  const overdue = prods.filter(isOverdue).length
  const alerts = alertsFor(role).filter((a) => a.t <= t && (a.sev === 'high' || a.sev === 'critical')).length
  const attention = insights(t, snap).filter((i) => i.tone === 'bad' || i.tone === 'warn').filter((i) => role === 'superadmin' || (role === 'clientA' ? /RCY|recycl|SC-|scanner|asset/i.test(i.title + i.body) : !/SC-|scanner/i.test(i.title + i.body))).slice(0, 3)
  const tourOk = ['twin', 'map', 'provenance'].every((f) => hasFeature(role, f))
  const hour = Math.floor((t % 1440) / 60); const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-8 p-6 sm:p-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-[28px] font-semibold tracking-tight text-stone-900">{hello}, {user?.full_name.split(' ')[0] ?? ''}</h1><p className="mt-1 text-[15px] text-stone-500">{alerts ? `${alerts} alert${alerts === 1 ? '' : 's'} need a look today.` : 'Everything is running normally.'}</p></div>
        <div className="flex items-center">{tourOk && <button onClick={() => useStore.getState().set({ tour: 0, tourReturn: useStore.getState().mode })} className="mr-2 flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-5 py-3 text-[14.5px] font-medium text-cyan-700 hover:bg-cyan-100"><Compass size={17} /> Get started</button>}
        {hasFeature(role, 'scan') && <button onClick={() => go('scan')} className="flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-3 text-[14.5px] font-medium text-white shadow-sm hover:bg-cyan-700"><ScanLine size={17} /> Scan</button>}</div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-5">
        {mods('curtains') && <Card icon={<Tag size={20} />} color="#6a57e6" title="Curtains" headline={prods.filter((p) => p.status === 'in_use').length} label="installed" status={overdue ? `${overdue} overdue for change` : 'None overdue'} bad={!!overdue} page="qrdash" />}
        {mods('laundry') && <Card icon={<Boxes size={20} />} color="#8b5cf6" title="Laundry" headline={snap.byStatus.in_use ?? 0} label="in use now" status={missing ? `${missing} items missing` : 'Nothing missing'} bad={!!missing} page="planner" />}
        {mods('assets') && <Card icon={<Radar size={20} />} color="#3b82f6" title="Equipment" headline={SCANNERS.length} label="tracked" status={off ? `${off} off-site` : 'All on site'} bad={!!off} page="assets" />}
        {mods('shipments') && <Card icon={<Package size={20} />} color="#e0a030" title="Shipments" headline={open} label="open" status={exc ? `${exc} problem to look at` : 'No problems'} bad={!!exc} page="shipments" />}
        {mods('recycling') && <Card icon={<Recycle size={20} />} color="#3fb68b" title="Recycling" headline={rec.tiles[0].value} label="proven" status={rec.tiles[1].value !== '0 kg' ? `${rec.tiles[1].value} not proven` : 'All proven'} bad={rec.tiles[1].value !== '0 kg'} page="provenance" />}
      </div>

      {attention.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-semibold text-stone-800">Needs attention</h2><button onClick={() => go('alerts')} className="text-[14px] font-medium text-cyan-700 hover:underline">All alerts</button></div>
        <div className="card divide-y divide-stone-100">{attention.map((i, k) => <button key={k} onClick={() => i.page && go(i.page)} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-stone-50"><i className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: DOT[i.tone] }} /><span><span className="block text-[14.5px] font-medium text-stone-800">{i.title}</span><span className="mt-0.5 block text-[13.5px] leading-snug text-stone-500">{i.body}</span></span></button>)}</div></section>}
    </div>)
}
