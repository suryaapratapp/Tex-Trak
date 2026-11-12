import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Page } from '../components/ui'
import { fmtQty, locName, useIndex, useOp, whRpc, type Item, type Loc, type Stock } from './store'
import { btnGhost, btnPrimary, ExpiryChip, Field, inputCls, Notice, OmniInput, Section, StatusPill, TD, TH, useFlash, useTakePrefill } from './ui'

const same = (a: Stock | null, b: Stock) => !!a && a.itemId === b.itemId && a.locId === b.locId && a.lot === b.lot && a.status === b.status

export default function Move() {
  const ix = useIndex(); const pre = useTakePrefill(); const { op, renew } = useOp(); const { flash, ok, err, clear } = useFlash()
  const [item, setItem] = useState<Item | null>(pre?.itemId ? ix.itemById.get(pre.itemId) ?? null : null); const [fromLoc, setFromLoc] = useState<string | null>(pre?.locId ?? null)
  const [src, setSrc] = useState<Stock | null>(null); const [dest, setDest] = useState<Loc | null>(null); const [qty, setQty] = useState(''); const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false)
  const rows = useMemo(() => (item ? (ix.stockByItem.get(item.id) ?? []).filter((r) => !fromLoc || r.locId === fromLoc) : []), [item, ix, fromLoc])
  useEffect(() => { if (rows.length === 1 && !src) { setSrc(rows[0]); setQty(String(rows[0].qty)) } }, [rows, src])
  const reset = () => { setItem(null); setSrc(null); setDest(null); setQty(''); setNotes(''); setFromLoc(null) }
  const pickItem = (i: Item) => { clear(); setItem(i); setSrc(null); setQty('') }
  const go_ = async () => {
    if (!item || !src || !dest) return; const q = Number(qty); if (!(q > 0)) return err('Enter how many to move.'); if (q > src.qty) return err(`Only ${fmtQty(src.qty)} there.`)
    setBusy(true); const r = await whRpc('wh_move', { p_item: item.id, p_from: src.locId, p_to: dest.id, p_qty: q, p_lot: src.lot, p_status: src.status, p_notes: notes, p_op: op() }); setBusy(false)
    if (!r.ok) return err(r.message); renew(); ok(r.message); reset()
  }
  const atLoc = fromLoc ? (ix.stockByLoc.get(fromLoc) ?? []) : []
  return (
    <Page title="Move stock" sub="Move items from one shelf to another. The ledger keeps the full trail, including lot and expiry.">
      <div className="mx-auto max-w-[900px] space-y-6">
        {flash && <Notice kind={flash.kind} onClose={clear}>{flash.text}</Notice>}
        {!item && <Section>
          {fromLoc && <div className="mb-4 flex items-center justify-between rounded-2xl bg-cyan-50 px-4 py-3 text-[14px]"><span>Moving from <b className="mono">{locName(ix, fromLoc)}</b></span><button onClick={() => setFromLoc(null)} className="font-bold text-cyan-700">Any shelf</button></div>}
          <OmniInput kind="item" label="Scan the item to move" onItem={pickItem} />
          {fromLoc && atLoc.length > 0 && <ul className="mt-4 divide-y divide-stone-100 rounded-2xl border border-stone-100">{atLoc.map((r, i) => { const it = ix.itemById.get(r.itemId); return <li key={i}><button onClick={() => it && pickItem(it)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-50"><span className="font-semibold text-stone-800">{it?.name} <span className="mono text-[12.5px] text-stone-400">{it?.sku}</span></span><span className="mono font-bold">{fmtQty(r.qty)}</span></button></li> })}</ul>}
        </Section>}
        {item && (
          <Section title={item.name} sub={item.sku} right={<button onClick={reset} className="text-[13.5px] font-bold text-stone-400 hover:text-stone-700">Start over</button>}>
            {rows.length === 0 ? <p className="text-[14px] text-stone-500">There is no stock of this item{fromLoc ? ' on that shelf' : ''} to move.</p> : <>
              <div className="mb-2 text-[13px] font-bold text-stone-600">Move from</div>
              <div className="-mx-2 overflow-x-auto"><table className="w-full text-[14px]"><thead><tr><th className={TH} /><th className={TH}>Location</th><th className={TH}>Lot</th><th className={TH}>Expiry</th><th className={TH}>Condition</th><th className={TH + ' text-right'}>Qty</th></tr></thead>
                <tbody>{rows.map((r, i) => <tr key={i} onClick={() => { setSrc(r); setQty(String(r.qty)) }} className={`cursor-pointer transition ${same(src, r) ? 'bg-cyan-50' : 'hover:bg-stone-50'}`}><td className={TD}><input type="radio" readOnly checked={same(src, r)} className="accent-cyan-600" /></td><td className={TD + ' mono font-semibold'}>{locName(ix, r.locId)}</td><td className={TD + ' mono'}>{r.lot || '–'}</td><td className={TD}><ExpiryChip date={r.expiry} /></td><td className={TD}><StatusPill s={r.status} /></td><td className={TD + ' mono text-right font-semibold'}>{fmtQty(r.qty)}</td></tr>)}</tbody></table></div>
              {src && <div className="mt-6 space-y-4">
                <div>{dest ? <div className="flex items-center justify-between rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3"><div className="flex items-center gap-3"><span className="mono text-[16px] font-bold text-stone-500">{locName(ix, src.locId)}</span><ArrowRight size={18} className="text-cyan-600" /><span className="mono text-[18px] font-bold text-stone-900">{dest.code}</span></div><button onClick={() => setDest(null)} className="text-[13.5px] font-bold text-cyan-700">Change</button></div>
                  : <OmniInput kind="loc" label="Move to (scan the shelf)" autoFocus={false} onLoc={(l) => { if (l.id === src.locId) err('That is where it already is.'); else { clear(); setDest(l) } }} />}</div>
                <div className="grid gap-4 sm:grid-cols-[160px_1fr]"><Field label="How many"><input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className={inputCls} /></Field><Field label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Optional" /></Field></div>
                <div className="flex gap-2"><button disabled={!dest || busy} onClick={() => void go_()} className={btnPrimary}>{busy ? 'Moving…' : 'Move'}</button><button onClick={reset} className={btnGhost}>Cancel</button></div></div>}
            </>}
          </Section>)}
      </div>
    </Page>)
}
