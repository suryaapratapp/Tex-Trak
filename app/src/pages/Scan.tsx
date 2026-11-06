import { useCallback, useEffect, useState } from 'react'
import { Boxes, CheckCircle2, Package, Radar, ScanLine, TriangleAlert, XCircle } from 'lucide-react'
import { Card, CardHead, Page, StatusPill } from '../components/ui'
import { Scanner } from '../components/Scanner'
import { getWorld, itemAt, SCANNERS, scannerAt, type Item } from '../sim/engine'
import { ZONE_NAME } from '../sim/world'
import { hasModule, type ModuleId } from '../sim/registry'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { go, useStore } from '../store'

interface Entry { id: number; created_at: string; kind: string; level: 'ok' | 'warn' | 'error'; text: string }
interface Ship { id: string; ref: string; status: string; items: number; from_name: string; to_name: string; description: string; org_id: string }

type Task = 'textile' | 'asset' | 'load' | 'curtain'
const TASKS: { id: Task; label: string; sub: string; module: ModuleId; icon: React.ReactNode }[] = [
  { id: 'textile', label: 'Textile item', sub: 'Issue, soil, cage', module: 'laundry', icon: <Boxes size={22} /> },
  { id: 'curtain', label: 'Curtain', sub: 'Install · take down', module: 'curtains', icon: <ScanLine size={22} /> },
  { id: 'asset', label: 'Equipment', sub: 'Check out · check in', module: 'assets', icon: <Radar size={22} /> },
  { id: 'load', label: 'Shipment', sub: 'Dispatch · receive', module: 'shipments', icon: <Package size={22} /> },
]
type Found = { type: 'item'; it: Item } | { type: 'asset'; id: string } | { type: 'load'; sh: Ship } | null

export default function Scan() {
  const role = useStore((s) => s.role); const t = useStore((s) => s.t); const w = getWorld()
  const tasks = TASKS.filter((x) => hasModule(role, x.module) || (x.id === 'load' && hasModule(role, 'recycling')))
  const [task, setTask] = useState<Task>(tasks[0]?.id ?? 'load'); const [manual, setManual] = useState(''); const [found, setFound] = useState<Found>(null); const [msg, setMsg] = useState<{ level: 'ok' | 'warn' | 'error'; title: string; detail: string } | null>(null)
  const user = useAuth((x) => x.user); const orgId = role === 'superadmin' ? null : role
  const [list, setList] = useState<Entry[]>([]); const [open, setOpen] = useState<Ship[]>([]); const [count, setCount] = useState('')
  const reload = useCallback(async () => {
    const { data } = await supabase.from('scan_log').select('id,created_at,kind,level,text').order('created_at', { ascending: false }).limit(8); setList((data ?? []) as Entry[])
    const { data: sh } = await supabase.from('shipments').select('id,ref,status,items,from_name,to_name,description,org_id').in('status', ['booked', 'in_transit']).order('created_at', { ascending: false }).limit(4); setOpen((sh ?? []) as Ship[])
  }, [])
  useEffect(() => { void reload() }, [reload])
  const lookup = async (raw: string) => {
    const code = raw.trim().toUpperCase(); setFound(null)
    if (task === 'textile') { const it = w.items.find((i) => i.qr === code || i.epc === code); if (!it) return setMsg({ level: 'error', title: 'Not recognised', detail: `${raw} is not a textile tag.` }); setFound({ type: 'item', it }); return setMsg(null) }
    if (task === 'asset') { const sc = SCANNERS.find((s) => s.id === code); if (!sc) return setMsg({ level: 'error', title: 'Not recognised', detail: `${raw} is not an equipment tag.` }); setFound({ type: 'asset', id: sc.id }); return setMsg(null) }
    const { data } = await supabase.from('shipments').select('id,ref,status,items,from_name,to_name,description,org_id').eq('ref', code).maybeSingle()
    if (!data) return setMsg({ level: 'error', title: 'Shipment not found', detail: `${raw} does not match any shipment you can see.` }); setCount(String(data.items)); setFound({ type: 'load', sh: data as Ship }); setMsg(null)
  }
  const log = async (kind: string, code: string, text: string, level: 'ok' | 'warn' = 'ok') => {
    const org = orgId ?? (await supabase.from('orgs').select('id').limit(1)).data?.[0]?.id; setMsg({ level, title: text, detail: 'Saved to the scan log.' }); setFound(null)
    if (org) await supabase.from('scan_log').insert({ org_id: org, kind, code, text, level, by_name: user?.full_name ?? '', created_by: user?.id }); void reload()
  }
  const done = (kind: string, text: string, level: 'ok' | 'warn' = 'ok') => void log(kind, text.split(' ')[0], text, level)
  const step = async (sh: Ship, action: string, items: number | null, text: string) => { const { error } = await supabase.rpc('shipment_step', { p_id: sh.id, p_action: action, p_detail: 'Scanned in the field', p_items: items }); if (error) { setFound(null); return setMsg({ level: 'error', title: error.message, detail: `${sh.ref} was not changed.` }) } void log('load', sh.ref, text, items != null && items !== sh.items ? 'warn' : 'ok') }
  const chips: { label: string; raw: string }[] = task === 'textile' ? [0, 9, 20, 41].map((i) => ({ label: `${w.items[i].type.name} · ${w.items[i].qr}`, raw: w.items[i].qr })) : task === 'asset' ? SCANNERS.slice(0, 4).map((s) => ({ label: `${s.id} · ${s.name.split('·')[0].trim()}`, raw: s.id })) : open.map((c) => ({ label: `${c.ref} · ${c.to_name}`, raw: c.ref }))
  const tone = msg && { ok: ['border-emerald-300 bg-emerald-50 text-emerald-900', <CheckCircle2 key="i" className="text-emerald-600" size={28} />], warn: ['border-amber-300 bg-amber-50 text-amber-900', <TriangleAlert key="i" className="text-amber-600" size={28} />], error: ['border-rose-300 bg-rose-50 text-rose-900', <XCircle key="i" className="text-rose-600" size={28} />] }[msg.level]
  const btn = 'rounded-full px-4 py-2.5 text-sm font-extrabold transition'
  return (
    <Page title="Scan station" sub="For people working in the field. Pick a job, then scan the label with the camera or type the code. Every scan is saved to a shared log.">
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{tasks.map((x) => (
        <button key={x.id} onClick={() => { setTask(x.id); setFound(null); setMsg(null) }} className={`card flex items-center gap-3.5 p-4 text-left transition ${task === x.id ? 'ring-2 ring-cyan-600' : 'hover:-translate-y-0.5'}`}>
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${task === x.id ? 'bg-cyan-600 text-white' : 'bg-stone-100 text-stone-600'}`}>{x.icon}</span>
          <span><span className="block text-[15px] font-extrabold text-stone-900">{x.label}</span><span className="block text-xs font-semibold text-stone-500">{x.sub}</span></span></button>))}</div>

      {task === 'curtain' ? <Card className="p-8 text-center"><ScanLine className="mx-auto text-cyan-600" size={34} /><h3 className="mt-3 text-xl font-extrabold text-stone-900">Curtain scanning</h3><p className="mx-auto mt-1 max-w-md text-sm text-stone-500">Install and take down are in the curtain tools.</p>
        <button onClick={() => { go('qrinstall') }} className="mt-5 rounded-full bg-stone-900 px-6 py-3 text-sm font-extrabold text-white">Open install</button></Card> : (
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHead title="Scan" />
          <div className="space-y-4 p-5"><Scanner onScan={lookup} />
            <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { lookup(manual); setManual('') } }} className="flex gap-2"><input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Type or paste a code" className="min-w-0 flex-1 rounded-full border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-cyan-500" /><button className={`${btn} bg-stone-900 text-white`}>Go</button></form>
            {chips.length > 0 && <div><div className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">Try a demo scan</div><div className="flex flex-wrap gap-2">{chips.map((c) => <button key={c.raw} onClick={() => lookup(c.raw)} className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-50">{c.label}</button>)}</div></div>}</div></Card>
        <div className="space-y-5">
          {found?.type === 'item' && (() => { const it = found.it; const l = itemAt(it, t); return (
            <Card><CardHead title={it.type.name} sub={<span className="mono">{it.qr}</span>} right={<StatusPill s={l.status} />} />
              <div className="space-y-3 p-5"><div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-2xl bg-stone-50 p-3"><div className="text-[11px] font-bold uppercase text-stone-400">Where</div><div className="font-bold text-stone-900">{l.kind === 'vehicle' ? 'On truck' : ZONE_NAME[l.zone!]}</div></div><div className="rounded-2xl bg-stone-50 p-3"><div className="text-[11px] font-bold uppercase text-stone-400">Washes</div><div className="font-bold text-stone-900">{l.cycles} of {it.type.maxCycles}</div></div></div>
                <div className="flex flex-wrap gap-2"><button onClick={() => done('textile', `${it.qr} issued to ward`)} className={`${btn} bg-cyan-600 text-white`}>Issue to ward</button><button onClick={() => done('textile', `${it.qr} marked soiled`)} className={`${btn} bg-amber-500 text-white`}>Mark soiled</button><button onClick={() => done('textile', `${it.qr} loaded into dirty cage ${it.cageOut}`)} className={`${btn} bg-violet-600 text-white`}>Load into cage</button><button onClick={() => done('textile', `${it.qr} reported lost`, 'warn')} className={`${btn} bg-rose-50 text-rose-700 ring-1 ring-rose-200`}>Report lost</button></div></div></Card>) })()}
          {found?.type === 'asset' && (() => { const sc = SCANNERS.find((s) => s.id === found.id)!; const st = scannerAt(w.legs, sc, t); return (
            <Card><CardHead title={sc.name} sub={<span className="mono">{sc.id}</span>} />
              <div className="space-y-3 p-5"><div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-2xl bg-stone-50 p-3"><div className="text-[11px] font-bold uppercase text-stone-400">Holder</div><div className="font-bold text-stone-900">{sc.holder}</div></div><div className="rounded-2xl bg-stone-50 p-3"><div className="text-[11px] font-bold uppercase text-stone-400">Battery</div><div className="font-bold text-stone-900">{Math.round(st.battery)}%</div></div></div>
                <div className="flex flex-wrap gap-2"><button onClick={() => done('asset', `${sc.id} checked out to a person or site`)} className={`${btn} bg-cyan-600 text-white`}>Check out</button><button onClick={() => done('asset', `${sc.id} returned to ${sc.home}`)} className={`${btn} bg-emerald-600 text-white`}>Return</button></div></div></Card>) })()}
          {found?.type === 'load' && (() => { const c = found.sh; return (
            <Card><CardHead title={c.ref} sub={`${c.from_name} → ${c.to_name}`} right={<span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">{c.status === 'in_transit' ? 'On the way' : c.status === 'booked' ? 'Booked' : c.status}</span>} />
              <div className="space-y-3 p-5"><div className="text-[14px] text-stone-600">{c.description || 'No description'} · {c.items} item{c.items === 1 ? '' : 's'}</div>
                {c.status === 'booked' && <button onClick={() => void step(c, 'dispatch', null, `${c.ref} dispatched`)} className={`${btn} bg-cyan-600 text-white`}>Dispatch</button>}
                {c.status === 'in_transit' && <div className="flex flex-wrap items-end gap-3"><label className="block"><span className="mb-1 block text-xs font-bold text-stone-500">Items that arrived</span><input value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="h-11 w-28 rounded-xl border border-stone-200 px-3 text-[15px]" /></label><button onClick={() => void step(c, 'receive', +count, `${c.ref} received · ${count} of ${c.items} items`)} className={`${btn} bg-emerald-600 text-white`}>Receive</button></div>}
                {c.status !== 'booked' && c.status !== 'in_transit' && <div className="text-[14px] text-stone-500">This shipment is already closed.</div>}</div></Card>) })()}
          <div className={`card flex min-h-[110px] items-center gap-4 border-2 p-5 ${tone ? tone[0] as string : 'border-dashed border-stone-200'}`}>{msg ? <>{tone![1]}<div><div className="text-lg font-extrabold leading-tight">{msg.title}</div><div className="text-sm opacity-80">{msg.detail}</div></div></> : <div className="text-sm font-semibold text-stone-400">{found ? 'Choose what happened.' : 'Waiting for a scan.'}</div>}</div>
          <Card><CardHead title="Scan log"  />
            <ul className="divide-y divide-stone-100">{list.length === 0 && <li className="p-5 text-sm text-stone-400">No scans yet.</li>}{list.slice(0, 8).map((e) => <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]"><i className={`h-2 w-2 shrink-0 rounded-full ${e.level === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'}`} /><span className="min-w-0 flex-1 truncate font-semibold text-stone-800">{e.text}</span><span className="mono text-[11px] text-stone-400">{new Date(e.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></li>)}</ul></Card>
        </div>
      </div>)}
    </Page>)
}
