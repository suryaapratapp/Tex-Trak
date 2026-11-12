import { useState } from 'react'
import { fmtDate, fmtQty, locName, planPick, onHand, useIndex, type Item } from './store'
import { Field, inputCls, OmniInput, Pill, RemoveBtn, TD, TH } from './ui'

export interface PLine { key: number; item: Item; qty: number; locId?: string; lot?: string }
let k = 0
/** Builds a list of items to take out. Shows exactly where each will be picked from (soonest expiry first) and warns when there is not enough. */
export function PickLines({ lines, setLines, initialItem }: { lines: PLine[]; setLines: (f: (l: PLine[]) => PLine[]) => void; initialItem?: Item | null }) {
  const ix = useIndex(); const [draft, setDraft] = useState<{ item: Item; qty: string; locId: string } | null>(initialItem ? { item: initialItem, qty: '1', locId: '' } : null)
  const plan = draft ? planPick(ix, draft.item.id, Number(draft.qty) || 0, draft.locId || undefined) : null
  const rows = draft ? (ix.stockByItem.get(draft.item.id) ?? []).filter((r) => r.status === 'available') : []
  const locs = [...new Set(rows.map((r) => r.locId))]
  const add = () => { if (!draft || !(Number(draft.qty) > 0) || !plan || plan.short > 0) return; setLines((l) => [...l, { key: ++k, item: draft.item, qty: Number(draft.qty), locId: draft.locId || undefined }]); setDraft(null) }
  return (
    <div className="space-y-5">
      {!draft && <OmniInput kind="item" label="Scan the item to take" onItem={(item, pq) => setDraft({ item, qty: String(pq || 1), locId: '' })} />}
      {draft && (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4">
          <div className="flex items-start justify-between gap-3"><div><div className="text-[16px] font-bold text-stone-900">{draft.item.name}</div><div className="mono text-[12.5px] text-stone-400">{draft.item.sku} · {fmtQty(onHand(ix, draft.item.id))} available</div></div><button onClick={() => setDraft(null)} className="text-[13px] font-bold text-stone-400 hover:text-stone-700">Cancel</button></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Quantity"><input value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} inputMode="decimal" className={inputCls} autoFocus /></Field>
            <Field label="Take from" hint="Leave on Best pick to use the soonest expiry first"><select value={draft.locId} onChange={(e) => setDraft({ ...draft, locId: e.target.value })} className={inputCls}><option value="">Best pick (automatic)</option>{locs.map((id) => <option key={id} value={id}>{locName(ix, id)}</option>)}</select></Field>
          </div>
          {plan && Number(draft.qty) > 0 && (plan.short > 0
            ? <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13.5px] font-semibold text-rose-800">Only {fmtQty(Number(draft.qty) - plan.short)} can be taken{draft.locId ? ' from there' : ''}. Expired, held and damaged stock is never picked.</p>
            : <ul className="mt-3 space-y-1.5">{plan.picks.map((p, i) => <li key={i} className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2 text-[13.5px]"><span><span className="mono font-bold text-stone-800">{locName(ix, p.locId)}</span>{p.lot && <span className="text-stone-400"> · lot {p.lot}</span>}{p.expiry && <span className="text-stone-400"> · exp {fmtDate(p.expiry)}</span>}</span><span className="mono font-bold text-cyan-700">{fmtQty(p.take)}</span></li>)}</ul>)}
          <button onClick={add} disabled={!plan || plan.short > 0 || !(Number(draft.qty) > 0)} className="mt-4 w-full rounded-2xl bg-cyan-600 px-5 py-3 text-[15px] font-bold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400">Add to list</button>
        </div>)}
      {lines.length > 0 && <div className="-mx-2 overflow-x-auto"><table className="w-full text-[14px]"><thead><tr><th className={TH}>Item</th><th className={TH}>From</th><th className={TH + ' text-right'}>Qty</th><th /></tr></thead>
        <tbody>{lines.map((l) => { const p = planPick(ix, l.item.id, l.qty, l.locId, l.lot); return <tr key={l.key}><td className={TD}><div className="font-semibold text-stone-800">{l.item.name}</div><div className="mono text-[12px] text-stone-400">{l.item.sku}</div></td><td className={TD}>{p.short > 0 ? <Pill tone="red">Not enough now</Pill> : <span className="mono text-[13px]">{p.picks.map((x) => locName(ix, x.locId)).join(', ')}</span>}</td><td className={TD + ' mono text-right font-semibold'}>{fmtQty(l.qty)}</td><td className={TD}><RemoveBtn onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))} /></td></tr> })}</tbody></table></div>}
    </div>)
}
