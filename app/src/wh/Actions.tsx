import { useMemo, useState } from 'react'
import { Page } from '../components/ui'
import { fmtQty, locName, STATUS_LABEL, useIndex, useOp, whRpc, type Item, type Loc, type Status, type Stock } from './store'
import { btnGhost, btnPrimary, ExpiryChip, Field, inputCls, Notice, OmniInput, Section, StatusPill, TD, TH, useFlash, useTakePrefill } from './ui'

interface Act { id: string; label: string; help: string; from: Status | 'any'; tone: string; reason?: boolean }
const ACTS: Act[] = [
  { id: 'damage_repair', label: 'Damaged, can be repaired', help: 'Moves stock out of availability into the repair queue', from: 'available', tone: 'blue' },
  { id: 'damage_scrap', label: 'Damaged, beyond repair', help: 'Moves stock into beyond-repair', from: 'available', tone: 'red' },
  { id: 'quarantine', label: 'Put on hold', help: 'Keep it aside until it has been checked', from: 'available', tone: 'amber' },
  { id: 'release', label: 'Release from hold', help: 'Back into available stock', from: 'quarantine', tone: 'green' },
  { id: 'repair_ok', label: 'Repaired, back to stock', help: 'Repair finished', from: 'repair', tone: 'green' },
  { id: 'repair_fail', label: 'Repair failed', help: 'Cannot be fixed after all', from: 'repair', tone: 'red' },
  { id: 'writeoff', label: 'Write off', help: 'Remove it from the books for good', from: 'any', tone: 'red', reason: true },
  { id: 'adjust', label: 'Correct the quantity', help: 'Add or remove to match what is really there', from: 'available', tone: 'slate', reason: true },
]
const REASONS = ['Damaged in handling', 'Expired', 'Lost or missing', 'Found extra', 'Theft or shrinkage', 'Data entry mistake', 'Other']
const same = (a: Stock | null, b: Stock) => !!a && a.locId === b.locId && a.lot === b.lot && a.status === b.status

export default function Actions() {
  const ix = useIndex(); const pre = useTakePrefill(); const { op, renew } = useOp(); const { flash, ok, err, clear } = useFlash()
  const [act, setAct] = useState<Act>(ACTS[0]); const [item, setItem] = useState<Item | null>(pre?.itemId ? ix.itemById.get(pre.itemId) ?? null : null); const [src, setSrc] = useState<Stock | null>(null); const [other, setOther] = useState<Loc | null>(null)
  const [qty, setQty] = useState(''); const [sign, setSign] = useState<1 | -1>(-1); const [reason, setReason] = useState(''); const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false)
  const rows = useMemo(() => (item ? (ix.stockByItem.get(item.id) ?? []).filter((r) => act.from === 'any' || r.status === act.from) : []), [item, act, ix])
  const reset = () => { setItem(null); setSrc(null); setQty(''); setReason(''); setNotes(''); setOther(null) }
  const target = src ?? (act.id === 'adjust' && other ? ({ itemId: item!.id, locId: other.id, lot: '', status: 'available', expiry: null, qty: 0, updatedAt: '' } as Stock) : null)
  const submit = async () => {
    if (!item || !target) return; const q = Number(qty); if (!(q > 0)) return err('Enter a quantity above zero.')
    if (act.reason && !reason) return err('Choose a reason. It is kept in the audit trail.')
    if (!(act.id === 'adjust' && sign > 0) && q > target.qty) return err(`Only ${fmtQty(target.qty)} there.`)
    setBusy(true); const r = await whRpc('wh_stock_action', { p_action: act.id, p_item: item.id, p_loc: target.locId, p_qty: act.id === 'adjust' ? sign * q : q, p_lot: target.lot, p_status: target.status, p_reason: reason, p_notes: notes, p_op: op() }); setBusy(false)
    if (!r.ok) return err(r.message); renew(); ok(r.message); reset()
  }
  return (
    <Page title="Damage, repair and quarantine" sub="Record what happens to stock after it arrives: damaged, on hold, repaired, written off, or corrected.">
      <div className="mx-auto max-w-[900px] space-y-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{ACTS.map((a) => <button key={a.id} onClick={() => { setAct(a); setSrc(null); setOther(null); clear() }} className={`rounded-2xl border px-3.5 py-3 text-left transition ${act.id === a.id ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-100' : 'border-stone-200 bg-white hover:bg-stone-50'}`}><div className="text-[14px] font-bold leading-tight text-stone-800">{a.label}</div></button>)}</div>
        <p className="text-[13.5px] text-stone-500">{act.help}.</p>
        {flash && <Notice kind={flash.kind} onClose={clear}>{flash.text}</Notice>}
        {!item ? <Section><OmniInput kind="item" label="Scan the item" onItem={(i) => { clear(); setItem(i); setSrc(null) }} /></Section> : (
          <Section title={item.name} sub={item.sku} right={<button onClick={reset} className="text-[13.5px] font-bold text-stone-400 hover:text-stone-700">Start over</button>}>
            {rows.length === 0 && act.id !== 'adjust' ? <p className="text-[14px] text-stone-500">There is no {act.from === 'any' ? '' : STATUS_LABEL[act.from as Status].toLowerCase() + ' '}stock of this item to {act.label.toLowerCase()}.</p> : <>
              {rows.length > 0 && <div className="-mx-2 overflow-x-auto"><table className="w-full text-[14px]"><thead><tr><th className={TH} /><th className={TH}>Location</th><th className={TH}>Lot</th><th className={TH}>Expiry</th><th className={TH}>Condition</th><th className={TH + ' text-right'}>Qty</th></tr></thead>
                <tbody>{rows.map((r, i) => <tr key={i} onClick={() => { setSrc(r); setOther(null); setQty(act.id === 'adjust' ? '' : String(r.qty)) }} className={`cursor-pointer ${same(src, r) ? 'bg-cyan-50' : 'hover:bg-stone-50'}`}><td className={TD}><input type="radio" readOnly checked={same(src, r)} className="accent-cyan-600" /></td><td className={TD + ' mono font-semibold'}>{locName(ix, r.locId)}</td><td className={TD + ' mono'}>{r.lot || '–'}</td><td className={TD}><ExpiryChip date={r.expiry} /></td><td className={TD}><StatusPill s={r.status} /></td><td className={TD + ' mono text-right font-semibold'}>{fmtQty(r.qty)}</td></tr>)}</tbody></table></div>}
              {act.id === 'adjust' && !src && (other ? <div className="mt-3 flex items-center justify-between rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3"><span>Adding at <b className="mono">{other.code}</b></span><button onClick={() => setOther(null)} className="text-[13.5px] font-bold text-cyan-700">Change</button></div> : <div className="mt-4"><OmniInput kind="loc" label="Or a shelf with none of it yet" autoFocus={false} onLoc={setOther} /></div>)}
              {target && <div className="mt-6 space-y-4">
                {act.id === 'adjust' && <div className="flex gap-2">{([-1, 1] as const).map((s) => <button key={s} onClick={() => setSign(s)} className={`rounded-2xl border px-5 py-2.5 text-[14.5px] font-bold ${sign === s ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-stone-200 text-stone-600'}`}>{s > 0 ? 'Add' : 'Remove'}</button>)}</div>}
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Quantity" required><input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className={inputCls} /></Field>
                  {act.reason && <Field label="Reason" required><select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}><option value="">Choose…</option>{REASONS.map((r) => <option key={r}>{r}</option>)}</select></Field>}</div>
                <Field label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Optional. Say what happened." /></Field>
                <div className="flex gap-2"><button disabled={busy} onClick={() => void submit()} className={btnPrimary}>{busy ? 'Saving…' : act.label}</button><button onClick={reset} className={btnGhost}>Cancel</button></div></div>}
            </>}
          </Section>)}
      </div>
    </Page>)
}
