import { useMemo, useRef, useState } from 'react'
import { Plus, Search, Upload, X } from 'lucide-react'
import { Card, Chip, STATUS_COLOR, STATUS_LABEL } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ago, useLiveData, useLiveLoad, type LItem } from '../lib/liveData'
import { useStore } from '../store'
import { btnGhost, btnPrimary, Field, inputCls, Notice } from '../qr/ui'

const sel = 'h-10 rounded-lg border border-stone-200 bg-white px-3 text-[14px]'
const csvRows = (t: string) => { const lines = t.split(/\r?\n/).filter((l) => l.trim()); if (lines.length < 2) return []; const split = (l: string) => l.split(',').map((c) => c.replace(/^"|"$/g, '').trim()); const head = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, '')); return lines.slice(1).map((l) => { const c = split(l); const o: Record<string, string> = {}; head.forEach((h, i) => (o[h] = c[i] ?? '')); return o }) }

export default function InventoryLive() {
  useLiveLoad(); const { items, zones, sites, events, loaded, load } = useLiveData(); const role = useStore((s) => s.role); const orgs = useAuth((s) => s.orgs); const user = useAuth((s) => s.user)
  const [pick, setPick] = useState(''); const org = role !== 'superadmin' ? role : pick || orgs[0]?.id || ''
  const [q, setQ] = useState(''); const [prod, setProd] = useState('all'); const [status, setStatus] = useState('all'); const [where, setWhere] = useState('all'); const [life, setLife] = useState('all'); const [open, setOpen] = useState<string | null>(null)
  const [add, setAdd] = useState(false); const [f, setF] = useState({ product: '', epc: '', qr: '', barcode: '', max: '100', value: '' }); const [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null); const [busy, setBusy] = useState(false); const file = useRef<HTMLInputElement>(null)
  const mine = useMemo(() => items.filter((i) => role === 'superadmin' ? (!org || i.org_id === org) : i.org_id === role), [items, role, org])
  const zoneName = (i: LItem) => { const z = zones.find((x) => x.id === i.zone_id); const s = sites.find((x) => x.id === i.site_id); return i.status === 'missing' ? 'Missing' : z ? `${s?.name ?? ''}${s ? ' · ' : ''}${z.name}` : s?.name ?? 'Not seen yet' }
  const products = [...new Set(mine.map((i) => i.product))].sort(); const places = [...new Set(mine.map(zoneName))].sort()
  const left = (i: LItem) => 1 - i.wash_cycles / i.max_cycles
  const list = mine.filter((i) => (prod === 'all' || i.product === prod) && (status === 'all' || i.status === status) && (where === 'all' || zoneName(i) === where) && (life === 'all' || (life === 'low' ? left(i) < 0.1 : life === 'mid' ? left(i) >= 0.1 && left(i) < 0.3 : left(i) >= 0.3)) && `${i.epc ?? ''} ${i.qr ?? ''} ${i.barcode ?? ''} ${i.product}`.toLowerCase().includes(q.toLowerCase()))
  const sel1 = items.find((i) => i.id === open)

  const addOne = async () => {
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('items').insert({ org_id: org, product: f.product.trim(), epc: f.epc.trim().toUpperCase() || null, qr: f.qr.trim().toUpperCase() || null, barcode: f.barcode.trim().toUpperCase() || null, max_cycles: +f.max || 100, value_gbp: f.value ? +f.value : null })
    setBusy(false); if (error) return setMsg({ k: 'error', t: error.code === '23505' ? 'An item with that tag already exists.' : error.code === '23514' ? 'Enter an RFID tag (EPC), a QR code or a barcode.' : error.message })
    setMsg({ k: 'ok', t: 'Item added.' }); setF({ ...f, epc: '', qr: '', barcode: '' }); await load()
  }
  const importCsv = async (file: File) => {
    setMsg(null); const rows = csvRows(await file.text()); if (!rows.length) return setMsg({ k: 'error', t: 'The file is empty, or has no header row.' })
    const have = new Set(mine.flatMap((i) => [i.epc, i.qr, i.barcode].filter(Boolean) as string[])); const seen = new Set<string>(); let skipped = 0; const out: Record<string, unknown>[] = []
    for (const r of rows) {
      const epc = (r.epc || r.rfid || r.tag || '').toUpperCase().replace(/[^0-9A-F]/g, '') || null; const qr = (r.qr || r.qrcode || '').toUpperCase() || null; const barcode = (r.barcode || r.ean || r.upc || '').toUpperCase() || null; const product = r.product || r.name || r.type
      if ((!epc && !qr && !barcode) || !product) { skipped++; continue }
      if ([epc, qr, barcode].some((c) => c && (have.has(c) || seen.has(c)))) { skipped++; continue }
      if (epc) seen.add(epc); if (qr) seen.add(qr); if (barcode) seen.add(barcode)
      out.push({ org_id: org, epc, qr, barcode, product, max_cycles: +(r.maxcycles || r.maxwashes || 100) || 100, wash_cycles: +(r.cycles || r.washes || 0) || 0, value_gbp: r.value || r.valuegbp ? +(r.value || r.valuegbp) : null })
    }
    setBusy(true); let added = 0
    for (let i = 0; i < out.length; i += 400) { const { error } = await supabase.from('items').insert(out.slice(i, i + 400)); if (error) { setBusy(false); return setMsg({ k: 'error', t: `${added} added, then: ${error.message}` }) } added += Math.min(400, out.length - i) }
    setBusy(false); setMsg({ k: 'ok', t: `${added} item${added === 1 ? '' : 's'} imported${skipped ? `, ${skipped} skipped (blank, or already on the list)` : ''}.` }); await load()
  }
  const template = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['epc,qr,barcode,product,max_cycles,cycles,value\nE28011606000020D1A2B3C4D,TX-GWN-0001,5012345678900,Surgical gown,75,12,42\n'], { type: 'text/csv' })); a.download = 'items-template.csv'; a.click() }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">{role === 'superadmin' && <select value={org} onChange={(e) => setPick(e.target.value)} className={sel} aria-label="Client">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}<span className="text-[14px] text-stone-500">{mine.length.toLocaleString('en-GB')} items on the list</span></div>
        <div className="flex gap-2"><input ref={file} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f1 = e.target.files?.[0]; if (f1) void importCsv(f1); e.target.value = '' }} /><button onClick={() => file.current?.click()} disabled={!org || busy} className={`${btnGhost} flex items-center gap-2`}><Upload size={16} /> Import CSV</button><button onClick={() => setAdd(!add)} disabled={!org} className={`${btnPrimary} flex items-center gap-2`}><Plus size={17} /> Add item</button></div></div>
      {msg && <div className="mb-4"><Notice kind={msg.k} onClose={() => setMsg(null)}>{msg.t}</Notice></div>}
      {add && <Card className="mb-5 space-y-4 p-5"><div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6"><Field label="Product" required><input value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} placeholder="e.g. Surgical gown" className={inputCls} /></Field><Field label="RFID tag (EPC)"><input value={f.epc} onChange={(e) => setF({ ...f, epc: e.target.value })} className={`${inputCls} mono`} /></Field><Field label="QR code"><input value={f.qr} onChange={(e) => setF({ ...f, qr: e.target.value })} className={`${inputCls} mono`} /></Field><Field label="Barcode"><input value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} className={`${inputCls} mono`} /></Field><Field label="Washes allowed"><input value={f.max} onChange={(e) => setF({ ...f, max: e.target.value.replace(/\D/g, '') })} className={inputCls} /></Field><Field label="Value (£)"><input value={f.value} onChange={(e) => setF({ ...f, value: e.target.value.replace(/[^\d.]/g, '') })} className={inputCls} /></Field></div>
        <div className="flex gap-3"><button disabled={busy || !f.product.trim() || (!f.epc.trim() && !f.qr.trim() && !f.barcode.trim())} onClick={addOne} className={btnPrimary}>Add item</button><button onClick={template} className={btnGhost}>Download CSV template</button></div></Card>}

      {loaded && mine.length === 0 ? (
        <Card className="p-10 text-center"><div className="mx-auto max-w-lg"><h3 className="text-[18px] font-semibold text-stone-900">No items yet</h3><p className="mt-2 text-[14.5px] text-stone-500">Import your list of tagged items (RFID tag, QR code, product) as a CSV, or add them one at a time. Once readers are set up under Super Admin, every read moves an item here automatically.</p><div className="mt-5 flex justify-center gap-3"><button onClick={() => file.current?.click()} className={btnPrimary}>Import CSV</button><button onClick={template} className={btnGhost}>Download template</button></div></div></Card>
      ) : (<>
        <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">{products.map((p) => { const m = mine.filter((i) => i.product === p); return (
          <button key={p} onClick={() => setProd(prod === p ? 'all' : p)} className={`card p-4 text-left transition hover:border-cyan-200 ${prod === p ? 'ring-2 ring-cyan-500' : ''}`}><div className="text-[14px] font-medium text-stone-800">{p}</div><div className="mt-1 text-[28px] font-semibold leading-none">{m.length}</div>
            <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-stone-100">{Object.keys(STATUS_COLOR).map((s) => { const n = m.filter((i) => i.status === s).length; return n ? <i key={s} style={{ width: `${(n / m.length) * 100}%`, background: STATUS_COLOR[s] }} /> : null })}</div></button>) })}</div>
        <Card>
          <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 p-4">
            <div className="relative min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-3 text-stone-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tag, QR code or product" className="h-10 w-full rounded-lg border border-stone-200 pl-9 pr-3 text-sm outline-none focus:border-cyan-500" /></div>
            <select value={prod} onChange={(e) => setProd(e.target.value)} className={sel} aria-label="Product"><option value="all">All products</option>{products.map((p) => <option key={p}>{p}</option>)}</select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel} aria-label="State"><option value="all">All states</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select value={where} onChange={(e) => setWhere(e.target.value)} className={sel} aria-label="Location"><option value="all">Anywhere</option>{places.map((p) => <option key={p}>{p}</option>)}</select>
            <select value={life} onChange={(e) => setLife(e.target.value)} className={sel} aria-label="Life left"><option value="all">Any life left</option><option value="low">Under 10% left</option><option value="mid">10–30% left</option><option value="high">Over 30% left</option></select>
            {(prod !== 'all' || status !== 'all' || where !== 'all' || life !== 'all' || q) && <button onClick={() => { setProd('all'); setStatus('all'); setWhere('all'); setLife('all'); setQ('') }} className="text-[14px] font-medium text-cyan-700 hover:underline">Clear filters</button>}
            <span className="text-sm text-stone-500">{list.length} shown</span></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead><tr><th>Item</th><th>Where it is now</th><th>State</th><th>Washes</th><th>Last seen</th></tr></thead>
            <tbody className="divide-y divide-stone-100">{list.slice(0, 300).map((i) => (
              <tr key={i.id} onClick={() => setOpen(i.id)} className="cursor-pointer hover:bg-stone-50"><td><div className="font-medium text-stone-900">{i.product}</div><div className="mono text-[12px] text-stone-400">{i.qr ?? i.barcode ?? i.epc}</div></td><td>{zoneName(i)}</td>
                <td><span className="inline-flex items-center gap-1.5 rounded-full bg-stone-50 px-2.5 py-0.5 text-[12.5px] font-medium text-stone-700 ring-1 ring-stone-200"><i className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[i.status] }} />{STATUS_LABEL[i.status]}</span></td>
                <td className="w-40"><div className="mono text-[12.5px] text-stone-700">{i.wash_cycles} / {i.max_cycles}</div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (i.wash_cycles / i.max_cycles) * 100)}%`, background: left(i) < 0.1 ? '#e5586b' : '#6759e4' }} /></div></td><td className="text-stone-500">{ago(i.last_seen_at)}</td></tr>))}</tbody></table>
            {list.length > 300 && <div className="p-4 text-center text-sm text-stone-400">Showing the first 300. Narrow the filters to see more.</div>}</div></Card></>)}

      {sel1 && <div className="fixed inset-0 z-50 flex justify-end"><div className="absolute inset-0 bg-stone-900/30" onClick={() => setOpen(null)} />
        <aside className="relative h-full w-full max-w-[440px] overflow-y-auto bg-white p-7 shadow-2xl"><button onClick={() => setOpen(null)} className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-stone-100" aria-label="Close"><X size={16} /></button>
          <h2 className="text-[20px] font-semibold text-stone-900">{sel1.product}</h2><div className="mono mt-1 text-[13px] text-stone-500">{sel1.qr ?? ''} {sel1.epc ?? ''}</div><div className="mt-3 flex gap-2"><Chip tone="slate">{STATUS_LABEL[sel1.status]}</Chip><Chip tone="slate">{sel1.wash_cycles} of {sel1.max_cycles} washes</Chip></div>
          <h3 className="mb-3 mt-7 text-[15px] font-semibold">Journey</h3>
          <ol className="space-y-4 border-l-2 border-stone-100 pl-5">{events.filter((e) => e.item_id === sel1.id).slice(0, 40).map((e) => <li key={e.id} className="relative"><i className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-cyan-500" /><div className="text-[14.5px] font-medium text-stone-900">{e.type === 'read' ? 'Read' : e.type === 'found' ? 'Found again' : e.type === 'status' ? `Marked ${STATUS_LABEL[e.status ?? ''] ?? e.status}` : e.type}</div><div className="text-[13.5px] text-stone-600">{e.detail}</div><div className="text-[12.5px] text-stone-400">{new Date(e.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{e.by_name ? ` · ${e.by_name}` : ''}</div></li>)}
            {events.filter((e) => e.item_id === sel1.id).length === 0 && <li className="text-[14px] text-stone-400">No reads yet.</li>}</ol></aside></div>}
      <span hidden>{user?.id}</span>
    </>)
}
