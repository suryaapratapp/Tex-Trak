import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Page } from '../components/ui'
import { supabase } from '../lib/supabase'
import { csvDownload, fmtQty, fmtWhen, KIND_LABEL, locName, useIndex, useWh, useWhOrg } from './store'
import { btnGhost, Empty, inputCls, Pill, Section, TD, TH } from './ui'

interface M { id: number; created_at: string; kind: string; item_id: string; qty: number; lot: string; from_loc: string | null; to_loc: string | null; from_status: string | null; to_status: string | null; ref: string | null; reason: string | null; notes: string | null; by_name: string }
const PAGE = 100
const TONE: Record<string, 'green' | 'red' | 'amber' | 'blue' | 'slate'> = { receive: 'green', issue: 'red', pack: 'amber', unpack: 'blue', dispatch: 'green', damage: 'red', writeoff: 'red', adjust: 'amber', count: 'blue' }

export default function Ledger() {
  const org = useWhOrg(); const ix = useIndex(); const stock = useWh((s) => s.stock)
  const [kind, setKind] = useState(''); const [text, setText] = useState(''); const [loc, setLoc] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [ref, setRef] = useState('')
  const [rows, setRows] = useState<M[] | null>(null); const [more, setMore] = useState(false); const [err, setErr] = useState('')
  const itemIds = useMemo(() => { const t = text.trim().toLowerCase(); return t ? ix.items.filter((i) => (i.sku + i.name + i.barcode).toLowerCase().includes(t)).map((i) => i.id).slice(0, 150) : [] }, [text, ix.items])
  const build = useCallback(() => {
    let q = supabase.from('wh_moves').select('*').eq('org_id', org).order('created_at', { ascending: false }).order('id', { ascending: false })
    if (kind) q = q.eq('kind', kind); if (text.trim()) q = itemIds.length ? q.in('item_id', itemIds) : q.eq('item_id', '00000000-0000-0000-0000-000000000000')
    if (loc) q = q.or(`from_loc.eq.${loc},to_loc.eq.${loc}`); if (from) q = q.gte('created_at', from + 'T00:00:00'); if (to) q = q.lte('created_at', to + 'T23:59:59'); if (ref.trim()) q = q.ilike('ref', `%${ref.trim()}%`)
    return q
  }, [org, kind, text, itemIds, loc, from, to, ref])
  const load = useCallback(async (append = false, offset = 0) => { const { data, error } = await build().range(offset, offset + PAGE - 1); if (error) return setErr(error.message); setErr(''); setMore((data ?? []).length === PAGE); setRows((r) => (append && r ? [...r, ...((data ?? []) as M[])] : ((data ?? []) as M[]))) }, [build])
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t) }, [load, stock])
  const exportAll = async () => { const { data } = await build().range(0, 4999); csvDownload('ledger.csv', [['Time', 'Type', 'SKU', 'Item', 'Qty', 'Lot', 'From', 'To', 'Reference', 'Reason', 'Notes', 'By'], ...((data ?? []) as M[]).map((m) => [new Date(m.created_at).toISOString(), KIND_LABEL[m.kind] ?? m.kind, ix.itemById.get(m.item_id)?.sku, ix.itemById.get(m.item_id)?.name, m.qty, m.lot, locName(ix, m.from_loc), locName(ix, m.to_loc), m.ref, m.reason, m.notes, m.by_name])]) }
  return (
    <Page title="Stock ledger" sub="Every movement, who did it and when. Nothing here can be edited or deleted. This is the full audit trail." right={<button onClick={() => void exportAll()} className={btnGhost + ' flex items-center gap-2 !px-4 !py-2.5 !text-[14px]'}><Download size={16} />Export CSV</button>}>
      <Section>
        <div className="mb-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls + ' !h-11'}><option value="">All types</option>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Item name or SKU" className={inputCls + ' !h-11'} />
          <select value={loc} onChange={(e) => setLoc(e.target.value)} className={inputCls + ' !h-11'}><option value="">Any location</option>{ix.locs.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}</select>
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Reference (PK-…)" className={inputCls + ' !h-11'} />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls + ' !h-11'} aria-label="From" /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls + ' !h-11'} aria-label="To" /></div>
        {err ? <p className="py-6 text-center text-rose-600">{err}</p> : rows === null ? <p className="py-8 text-center text-stone-400">Loading…</p> : rows.length === 0 ? <Empty title="No movements match" sub="Try clearing a filter." /> : <>
          <div className="-mx-2 overflow-x-auto"><table className="w-full text-[14px]"><thead><tr><th className={TH}>When</th><th className={TH}>Type</th><th className={TH}>Item</th><th className={TH + ' text-right'}>Qty</th><th className={TH}>Where</th><th className={TH}>Ref</th><th className={TH}>By</th></tr></thead>
            <tbody>{rows.map((m) => { const it = ix.itemById.get(m.item_id); return <tr key={m.id}><td className={TD + ' whitespace-nowrap text-stone-500'}>{fmtWhen(m.created_at)}</td><td className={TD}><Pill tone={TONE[m.kind] ?? 'slate'}>{KIND_LABEL[m.kind] ?? m.kind}</Pill></td><td className={TD}><div className="font-semibold text-stone-800">{it?.name ?? '?'}</div><div className="mono text-[12px] text-stone-400">{it?.sku}{m.lot ? ` · ${m.lot}` : ''}</div>{(m.reason || m.notes) && <div className="text-[12.5px] text-stone-400">{[m.reason, m.notes].filter(Boolean).join(' · ')}</div>}</td><td className={TD + ' mono text-right font-semibold'}>{m.qty > 0 && (m.kind === 'adjust' || m.kind === 'count') ? '+' : ''}{fmtQty(m.qty)}</td><td className={TD + ' mono whitespace-nowrap text-[13px]'}>{m.from_loc ? locName(ix, m.from_loc) : '–'} → {m.to_loc ? locName(ix, m.to_loc) : '–'}</td><td className={TD + ' mono text-[13px] text-stone-500'}>{m.ref ?? ''}</td><td className={TD + ' text-stone-500'}>{m.by_name}</td></tr> })}</tbody></table></div>
          {more && <div className="mt-4 text-center"><button onClick={() => void load(true, rows.length)} className={btnGhost + ' !px-6 !py-2.5 !text-[14px]'}>Load more</button></div>}</>}
      </Section>
    </Page>)
}
