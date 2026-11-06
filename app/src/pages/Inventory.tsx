import { useMemo, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { Bar, Card, Chip, Page, STATUS_COLOR, STATUS_LABEL, StatusPill } from '../components/ui'
import { fmtT, fusion, getWorld, SCANNERS, scannerAt, scannerValue } from '../sim/engine'
import { PRODUCTS, VEH_BY_ID, ZONE_NAME } from '../sim/world'
import { useSnap } from '../sim/snap'
import { go, useStore } from '../store'
import { hasModule } from '../sim/registry'

export default function Inventory() {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const set = useStore((s) => s.set)
  const role = useStore((st) => st.role); const [tab0, setTab] = useState<'textile' | 'asset'>('textile'); const tab = hasModule(role, 'laundry') ? (hasModule(role, 'assets') ? tab0 : 'textile') : 'asset'; const [q, setQ] = useState(''); const [type, setType] = useState('all'); const [status, setStatus] = useState('all'); const [area, setArea] = useState('all'); const [life, setLife] = useState('all')
  const rows = useMemo(() => w.items.map((it) => {
    const l = snap.loc[it.id]
    const where = l.status === 'missing' ? `Last seen: ${ZONE_NAME[it.missing!.lastZone]}` : l.kind === 'vehicle' ? `On truck ${VEH_BY_ID[l.veh!].reg}` : l.kind === 'moving' ? `Moving to ${ZONE_NAME[l.zone!]}` : ZONE_NAME[l.zone!]
    return { it, l, where, area: l.status === 'missing' ? 'Missing' : l.kind === 'vehicle' ? 'On a truck' : ZONE_NAME[l.zone!], conf: fusion(it, t).conf }
  }), [snap])
  const left = (r: (typeof rows)[0]) => 1 - r.l.cycles / r.it.type.maxCycles
  const areas = [...new Set(rows.map((r) => r.area))].sort()
  const list = rows.filter((r) => (type === 'all' || r.it.type.sku === type) && (status === 'all' || r.l.status === status) && (area === 'all' || r.area === area) && (life === 'all' || (life === 'low' ? left(r) < 0.1 : life === 'mid' ? left(r) >= 0.1 && left(r) < 0.3 : left(r) >= 0.3)) && (r.it.qr + r.it.type.name + r.where).toLowerCase().includes(q.toLowerCase()))
  const open = (id: number) => { set({ selItem: id }); go('item') }
  return (
    <Page demo title="Inventory" sub="Pick a product to see its journey.">
      <div className="mb-5 inline-flex rounded-full bg-stone-200/70 p-1">{([['textile', `Textiles (${w.items.length})`], ['asset', `High-value assets (${SCANNERS.length})`]] as const).filter(([k]) => hasModule(role, k === 'textile' ? 'laundry' : 'assets')).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === k ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}`}>{l}</button>)}</div>
      {tab === 'textile' ? <>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {PRODUCTS.map((p) => { const mine = rows.filter((r) => r.it.type.sku === p.sku); const avg = mine.reduce((a, r) => a + r.l.cycles, 0) / (mine.length || 1)
            return (<button key={p.sku} onClick={() => setType(type === p.sku ? 'all' : p.sku)} className={`card p-4 text-left transition hover:-translate-y-0.5 ${type === p.sku ? 'ring-2 ring-stone-900' : ''}`}>
              <div className="text-[13px] font-bold text-stone-900">{p.name}</div><div className="mt-1 text-3xl font-extrabold tracking-tight text-stone-900">{mine.length}</div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-stone-100">{Object.keys(STATUS_COLOR).map((s) => { const n = mine.filter((r) => r.l.status === s).length; return n ? <i key={s} style={{ width: `${(n / mine.length) * 100}%`, background: STATUS_COLOR[s] }} /> : null })}</div>
              <div className="mt-2 text-[11px] text-stone-500">avg {avg.toFixed(0)} / {p.maxCycles} washes · £{p.unitValue}</div></button>) })}
        </div>
        <Card>
          <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 p-4">
            <div className="relative min-w-[240px] flex-1"><Search size={15} className="absolute left-3 top-2.5 text-stone-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, QR code or location…" className="h-10 w-full rounded-lg border border-stone-200 pl-9 pr-3 text-sm outline-none focus:border-cyan-500" /></div>
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-[14px]" aria-label="Product type"><option value="all">All products</option>{PRODUCTS.map((p) => <option key={p.sku} value={p.sku}>{p.name}</option>)}</select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-[14px]" aria-label="State"><option value="all">All states</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select value={area} onChange={(e) => setArea(e.target.value)} className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-[14px]" aria-label="Location"><option value="all">Anywhere</option>{areas.map((a) => <option key={a}>{a}</option>)}</select>
            <select value={life} onChange={(e) => setLife(e.target.value)} className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-[14px]" aria-label="Life left"><option value="all">Any life left</option><option value="low">Under 10% left</option><option value="mid">10–30% left</option><option value="high">Over 30% left</option></select>
            {(type !== 'all' || status !== 'all' || area !== 'all' || life !== 'all' || q) && <button onClick={() => { setType('all'); setStatus('all'); setArea('all'); setLife('all'); setQ('') }} className="text-[14px] font-medium text-cyan-700 hover:underline">Clear filters</button>}
            <span className="text-sm text-stone-500">{list.length} shown</span>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-stone-400"><tr><th className="px-5 py-3">Product</th><th>Where it is now</th><th>State</th><th>Wash cycles</th><th>Confidence</th><th /></tr></thead>
            <tbody className="divide-y divide-stone-100">{list.map(({ it, l, where, conf }) => (
              <tr key={it.id} onClick={() => open(it.id)} className="cursor-pointer hover:bg-stone-50">
                <td className="px-5 py-3"><div className="font-bold text-stone-900">{it.type.name}</div><div className="mono text-[11px] text-stone-400">{it.qr}</div></td>
                <td className="text-stone-700">{where}</td><td><StatusPill s={l.status} /></td>
                <td className="w-48"><div className="mb-1 text-xs font-semibold text-stone-700">{l.cycles} <span className="font-normal text-stone-400">of {it.type.maxCycles}</span></div><Bar v={l.cycles / it.type.maxCycles} color={l.cycles / it.type.maxCycles > 0.9 ? '#e11d48' : '#1c1917'} h={5} /></td>
                <td><Chip tone={conf > 0.8 ? 'green' : conf > 0.5 ? 'amber' : 'red'}>{Math.round(conf * 100)}%</Chip></td><td className="pr-4 text-stone-300"><ChevronRight size={18} /></td></tr>))}</tbody></table></div>
        </Card></> : (
        <Card><table className="w-full text-left text-sm"><thead className="text-[11px] font-bold uppercase tracking-wider text-stone-400"><tr><th className="px-5 py-3">Asset</th><th>Holder</th><th>Home</th><th>Value</th><th>State</th><th /></tr></thead>
          <tbody className="divide-y divide-stone-100">{SCANNERS.map((s) => { const st = scannerAt(w.legs, s, t); return (
            <tr key={s.id} onClick={() => go('assets')} className="cursor-pointer hover:bg-stone-50"><td className="px-5 py-3"><div className="font-bold text-stone-900">{s.id}</div><div className="text-xs text-stone-500">{s.name}</div></td><td>{s.holder}</td><td>{s.home}</td><td>£{scannerValue(s).toLocaleString('en-GB')}</td>
              <td><Chip tone={st.outside ? 'red' : st.mode === 'in_transit' ? 'blue' : 'green'}>{st.outside ? 'Off-site' : st.mode === 'in_transit' ? 'In transit' : st.mode === 'at_hub' ? 'At hub' : 'On-site'}</Chip></td><td className="pr-4 text-stone-300"><ChevronRight size={18} /></td></tr>) })}</tbody></table></Card>)}
    </Page>
  )
}
