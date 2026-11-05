import { useMemo, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Page } from '../components/ui'
import { QrImg } from '../components/QrImg'
import { btnGhost, DaysChip, inputCls, Notice, StatusChip, useFlash } from './ui'
import { fmtDate, fmtDateTime, isDueSoon, isOverdue, placeText, REASONS, useQr, type Product } from './store'

type Filter = 'all' | 'in_use' | 'overdue' | 'soon' | 'registered' | 'removed' | 'retired'
export default function Products() {
  const st = useQr(); const { products, hospitals, history, retire } = st
  const [f, setF] = useState<Filter>('all'); const [q, setQ] = useState(''); const [site, setSite] = useState(''); const [open, setOpen] = useState<string | null>(null); const { flash, ok, err, clear } = useFlash()
  const all = useMemo(() => Object.values(products).sort((a, b) => (a.dueAt ?? 9e15) - (b.dueAt ?? 9e15) || a.code.localeCompare(b.code)), [products])
  const count = (fn: (p: Product) => boolean) => all.filter(fn).length
  const tiles: { id: Filter; label: string; sub: string; n: number; tone: string }[] = [
    { id: 'all', label: 'Total', sub: 'On the system', n: all.length, tone: 'text-cyan-700' }, { id: 'in_use', label: 'In use', sub: 'Currently fitted', n: count((p) => p.status === 'in_use'), tone: 'text-stone-900' },
    { id: 'overdue', label: 'Overdue', sub: 'Past change-due', n: count(isOverdue), tone: 'text-rose-600' }, { id: 'soon', label: 'Due in 30 days', sub: 'Plan the round', n: count(isDueSoon), tone: 'text-amber-600' },
    { id: 'registered', label: 'In stock', sub: 'Ready to fit', n: count((p) => p.status === 'registered'), tone: 'text-emerald-600' }, { id: 'removed', label: 'Taken down', sub: 'Out of service', n: count((p) => p.status === 'removed'), tone: 'text-stone-900' }]
  const match = (p: Product) => f === 'all' || (f === 'overdue' ? isOverdue(p) : f === 'soon' ? isDueSoon(p) : p.status === f)
  const list = all.filter((p) => match(p) && (!site || p.place?.hospitalId === site) && p.code.includes(q.trim().toUpperCase()))
  const sel = open ? products[open] : null
  const exportCsv = () => { const rows = [['Code', 'Type', 'Status', 'Location', 'Installed', 'Due'], ...list.map((p) => [p.code, p.type, p.status, placeText(st, p.place), p.installedAt ? fmtDate(p.installedAt) : '', p.dueAt ? fmtDate(p.dueAt) : ''])]; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'products.csv'; a.click() }
  return (
    <Page title="Products" sub={`${list.length.toLocaleString('en-GB')} ${f === 'all' ? 'products' : 'shown'}`} right={<button onClick={exportCsv} className={`${btnGhost} flex items-center gap-2`}><Download size={16} /> Export CSV</button>}>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">{tiles.map((t) => (
        <button key={t.id} onClick={() => setF(t.id)} className={`card p-5 text-left transition hover:-translate-y-0.5 ${f === t.id ? 'ring-2 ring-cyan-500' : ''}`}><div className={`text-[34px] font-extrabold leading-none ${t.tone}`}>{t.n.toLocaleString('en-GB')}</div><div className="mt-2 text-[15px] font-bold text-stone-900">{t.label}</div><div className="text-[13px] text-stone-500">{t.sub}</div></button>))}</div>
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_260px]"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by code, or just scan" className={inputCls} /><select value={site} onChange={(e) => setSite(e.target.value)} className={inputCls}><option value="">All sites</option>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
      <div className="mb-5 flex flex-wrap gap-2">{([['all', 'All'], ['in_use', 'In use'], ['overdue', 'Overdue'], ['soon', 'Due soon'], ['registered', 'In stock'], ['removed', 'Taken down'], ['retired', 'Retired']] as const).map(([k, l]) => <button key={k} onClick={() => setF(k)} className={`rounded-full px-5 py-2 text-[14px] font-bold ${f === k ? 'bg-cyan-600 text-white' : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50'}`}>{l}</button>)}</div>
      <div className="card divide-y divide-stone-100 overflow-hidden">
        {list.length === 0 && <div className="p-10 text-center text-stone-400">Nothing matches.</div>}
        {list.slice(0, 120).map((p) => (
          <button key={p.code} onClick={() => setOpen(p.code)} className="flex w-full items-center gap-4 px-6 py-4 text-left transition hover:bg-stone-50">
            <div className="min-w-0 flex-1"><div className="mono text-[16px] font-bold tracking-tight text-stone-900">{p.code}</div><div className="mt-0.5 truncate text-[14px] text-stone-500">{p.place ? placeText(st, p.place) : p.status === 'registered' ? 'Not installed' : p.status === 'removed' ? 'Taken down' : 'Retired'}</div></div>
            <div className="flex flex-col items-end gap-1.5"><StatusChip p={p} /><DaysChip p={p} /></div></button>))}
        {list.length > 120 && <div className="p-4 text-center text-sm text-stone-400">Showing the first 120. Narrow the search to see more.</div>}
      </div>
      {sel && <div className="fixed inset-0 z-50 flex justify-end"><div className="absolute inset-0 bg-stone-900/40" onClick={() => setOpen(null)} />
        <aside className="relative h-full w-full max-w-[460px] overflow-y-auto bg-white p-7 shadow-2xl">
          <button onClick={() => { setOpen(null); clear() }} className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-stone-100" aria-label="Close"><X size={17} /></button>
          <div className="mono text-[20px] font-extrabold text-stone-900">{sel.code}</div><div className="mt-1 text-[14px] text-stone-500">{sel.type} · {sel.productCode}</div>
          <div className="mt-4 flex flex-wrap gap-2"><StatusChip p={sel} /><DaysChip p={sel} /></div>
          <div className="mt-5 flex items-center gap-5"><QrImg text={sel.code} size={120} /><dl className="space-y-1.5 text-[14px]"><div><dt className="inline text-stone-400">Where: </dt><dd className="inline font-semibold">{placeText(st, sel.place)}</dd></div>{sel.installedAt && <div><dt className="inline text-stone-400">Installed: </dt><dd className="inline font-semibold">{fmtDate(sel.installedAt)}</dd></div>}{sel.dueAt && <div><dt className="inline text-stone-400">Change due: </dt><dd className="inline font-semibold">{fmtDate(sel.dueAt)}</dd></div>}{sel.batch && <div><dt className="inline text-stone-400">Batch: </dt><dd className="inline font-semibold">{sel.batch}</dd></div>}</dl></div>
          <h3 className="mb-3 mt-7 text-[15px] font-extrabold">History</h3>
          <ol className="space-y-3 border-l-2 border-stone-100 pl-5">{history.filter((h) => h.code === sel.code).map((h) => <li key={h.id} className="relative text-[14px]"><i className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-cyan-500" /><div className="font-bold text-stone-900">{{ registered: 'Registered', installed: 'Installed', removed: `Taken down${h.reason ? ` (${REASONS.find((r) => r.value === h.reason)?.label.toLowerCase()})` : ''}`, retired: 'Retired' }[h.type]}</div><div className="text-stone-500">{h.where ? `${h.where} · ` : ''}{fmtDateTime(h.ts)} · {h.by}</div></li>)}</ol>
          {flash && <div className="mt-5"><Notice kind={flash.kind}>{flash.text}</Notice></div>}
          {sel.status !== 'retired' && sel.status !== 'in_use' && <button onClick={() => { const r = retire(sel.code); r.ok ? ok(r.message) : err(r.message) }} className={`${btnGhost} mt-6 w-full`}>Retire this product</button>}
        </aside></div>}
    </Page>)
}
