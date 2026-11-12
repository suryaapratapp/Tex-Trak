import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import { Page } from '../components/ui'
import { QrImg } from '../components/QrImg'
import { useIndex, useWh } from './store'
import { btnPrimary, inputCls, Section, useTakePrefill } from './ui'

const SIZES = { small: { w: 38, h: 25, qr: 17, label: 'Small · 38 × 25 mm' }, medium: { w: 50, h: 30, qr: 22, label: 'Medium · 50 × 30 mm' }, large: { w: 70, h: 42, qr: 32, label: 'Large · 70 × 42 mm' } } as const
interface L { key: string; text: string; code: string; name: string }

function Sheet({ labels, size, copies, onDone }: { labels: L[]; size: keyof typeof SIZES; copies: number; onDone: () => void }) {
  const s = SIZES[size]; useEffect(() => { const t = setTimeout(() => { window.print(); onDone() }, 800); return () => clearTimeout(t) }, [onDone])
  const all = labels.flatMap((l) => Array.from({ length: copies }, (_, i) => ({ ...l, key: l.key + i })))
  return createPortal(<div className="print-only"><style>{`@page{margin:6mm}`}</style><div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5mm' }}>{all.map((l) => (
    <div key={l.key} style={{ width: `${s.w}mm`, height: `${s.h}mm`, border: '0.2mm solid #cfd4e4', borderRadius: '1.5mm', display: 'flex', alignItems: 'center', gap: '1.5mm', padding: '1.5mm', boxSizing: 'border-box', breakInside: 'avoid', overflow: 'hidden' }}>
      <QrImg text={l.text} size={Math.round(s.qr * 3.78)} /><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: size === 'small' ? '9pt' : '12pt', wordBreak: 'break-all', lineHeight: 1.1 }}>{l.code}</div><div style={{ fontSize: size === 'small' ? '6pt' : '8pt', color: '#3d455d', lineHeight: 1.15, marginTop: '0.8mm', overflow: 'hidden', maxHeight: `${s.h - 8}mm` }}>{l.name}</div></div></div>))}</div></div>, document.body)
}

export default function Labels() {
  const ix = useIndex(); const pre = useTakePrefill(); const org = useWh((s) => s.org)
  const [kind, setKind] = useState<'loc' | 'item'>(pre?.itemId ? 'item' : 'loc'); const [sel, setSel] = useState<Set<string>>(new Set([pre?.locId, pre?.itemId].filter(Boolean) as string[])); const [q, setQ] = useState(''); const [size, setSize] = useState<keyof typeof SIZES>('medium'); const [copies, setCopies] = useState(1); const [printing, setPrinting] = useState(false)
  const list = useMemo<L[]>(() => (kind === 'loc' ? ix.locs.filter((l) => l.active).map((l) => ({ key: l.id, text: `WH:L:${l.code}`, code: l.code, name: l.name !== l.code ? l.name : l.kind })) : ix.items.filter((i) => i.active).map((i) => ({ key: i.id, text: `WH:I:${i.sku}`, code: i.sku, name: i.name }))).filter((l) => !q || (l.code + l.name).toLowerCase().includes(q.toLowerCase())), [kind, ix, q])
  const chosen = list.filter((l) => sel.has(l.key)); const toggle = (k: string) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  return (
    <Page title="Labels" sub="Print QR labels for shelves and items. Scanning one in Smart scan, Goods in or Move is understood straight away, with no setup in the scanner.">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Section>
          <div className="mb-4 flex flex-wrap gap-2">{(['loc', 'item'] as const).map((k) => <button key={k} onClick={() => { setKind(k); setSel(new Set()) }} className={`rounded-2xl border px-4 py-2 text-[14.5px] font-bold ${kind === k ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-stone-200 text-stone-600'}`}>{k === 'loc' ? 'Locations' : 'Items'}</button>)}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className={inputCls + ' !h-11 min-w-0 flex-1'} /></div>
          <div className="mb-2 flex gap-3 text-[13.5px] font-bold text-cyan-700"><button onClick={() => setSel(new Set(list.map((l) => l.key)))}>Select all {list.length}</button><button onClick={() => setSel(new Set())}>Clear</button></div>
          <ul className="max-h-[520px] divide-y divide-stone-100 overflow-auto rounded-2xl border border-stone-100">{list.length === 0 ? <li className="p-6 text-center text-[14px] text-stone-400">Nothing to label yet.</li> : list.map((l) => <li key={l.key}><label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-stone-50"><input type="checkbox" checked={sel.has(l.key)} onChange={() => toggle(l.key)} className="h-4.5 w-4.5 accent-cyan-600" /><span className="mono w-32 shrink-0 truncate font-bold text-stone-900">{l.code}</span><span className="truncate text-[14px] text-stone-500">{l.name}</span></label></li>)}</ul>
        </Section>
        <div className="space-y-6">
          <Section title="Print">
            <div className="space-y-4"><div><div className="mb-1.5 text-[13px] font-bold text-stone-600">Label size</div><select value={size} onChange={(e) => setSize(e.target.value as keyof typeof SIZES)} className={inputCls}>{Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div><div className="mb-1.5 text-[13px] font-bold text-stone-600">Copies of each</div><input type="number" min={1} max={20} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(20, +e.target.value || 1)))} className={inputCls} /></div>
              {chosen.length > 0 && <div className="flex items-center gap-4 rounded-2xl bg-stone-50 p-4"><QrImg text={chosen[0].text} size={84} /><div><div className="mono text-[16px] font-bold">{chosen[0].code}</div><div className="text-[13px] text-stone-500">{chosen[0].name}</div><div className="mono mt-1 text-[11.5px] text-stone-400">{chosen[0].text}</div></div></div>}
              <button disabled={!chosen.length} onClick={() => setPrinting(true)} className={btnPrimary + ' flex w-full items-center justify-center gap-2'}><Printer size={18} />Print {chosen.length * copies || ''} label{chosen.length * copies === 1 ? '' : 's'}</button>
              <p className="text-[12.5px] text-stone-400">Use the browser’s print dialogue and choose your label printer, or print on A4 label sheets. Set scale to 100%.</p></div>
          </Section>
          <p className="px-1 text-[12.5px] text-stone-400">Codes you already have on your items, such as EAN barcodes, need no new label. Add them under Items and scanning works as is. Client: {org}.</p>
        </div>
      </div>
      {printing && <Sheet labels={chosen} size={size} copies={copies} onDone={() => setPrinting(false)} />}
    </Page>)
}
