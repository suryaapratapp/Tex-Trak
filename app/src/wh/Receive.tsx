import { useMemo, useState } from 'react'
import { CheckCircle2, Plus } from 'lucide-react'
import { Page } from '../components/ui'
import { go } from '../store'
import { supabase } from '../lib/supabase'
import { daysTo, friendly, fmtDate, fmtQty, locName, useIndex, useOp, useWh, useWhOrg, whRpc, type Item, type Loc } from './store'
import { btnGhost, btnPrimary, Field, inputCls, Notice, OmniInput, RemoveBtn, Section, TD, TH, useFlash } from './ui'

type QC = 'pass' | 'hold' | 'repair' | 'scrap'
const QCS: { v: QC; label: string; help: string }[] = [{ v: 'pass', label: 'Good', help: 'Goes straight into stock' }, { v: 'hold', label: 'Hold', help: 'Quarantine until checked' }, { v: 'repair', label: 'To repair', help: 'Damaged, can be fixed' }, { v: 'scrap', label: 'Beyond repair', help: 'Damaged, cannot be fixed' }]
interface Line { key: number; item: Item; qty: number; loc: Loc; lot: string; expiry: string; qc: QC }
let k = 0

export default function Receive() {
  const ix = useIndex(); const org = useWhOrg(); const partners = useWh((s) => s.partners); const { op, renew } = useOp(); const { flash, ok, err, clear } = useFlash()
  const [po, setPo] = useState(''); const [supplier, setSupplier] = useState(''); const [notes, setNotes] = useState(''); const [lines, setLines] = useState<Line[]>([]); const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<{ item: Item; qty: string; loc: Loc | null; lot: string; expiry: string; qc: QC } | null>(null); const [lastLoc, setLastLoc] = useState<Loc | null>(null)
  const [newCode, setNewCode] = useState(''); const [newName, setNewName] = useState('')
  const suggestion = useMemo(() => { if (!draft) return null; const rows = (ix.stockByItem.get(draft.item.id) ?? []).filter((r) => r.status === 'available').sort((a, b) => b.qty - a.qty)[0]; return rows ? { loc: ix.locById.get(rows.locId)!, note: `already holds ${fmtQty(rows.qty)}` } : lastLoc ? { loc: lastLoc, note: 'last used' } : null }, [draft, ix, lastLoc])
  const pick = (item: Item, packQty: number) => { clear(); setNewCode(''); setDraft({ item, qty: String(packQty || 1), loc: null, lot: '', expiry: '', qc: 'pass' }) }
  const setD = (p: Partial<NonNullable<typeof draft>>) => setDraft((d) => (d ? { ...d, ...p } : d))
  const addLine = () => {
    if (!draft) return; const q = Number(draft.qty)
    if (!(q > 0)) return err('Enter how many arrived.'); if (!draft.loc) return err('Choose where it is going.')
    if (draft.item.trackExpiry && !draft.expiry && draft.qc === 'pass') return err('This item needs an expiry date.')
    if (draft.expiry && draft.qc === 'pass' && daysTo(draft.expiry) < 0) return err('That expiry date has passed. Receive it as Hold or Beyond repair.')
    setLines((l) => [...l, { key: ++k, item: draft.item, qty: q, loc: draft.loc!, lot: draft.lot.trim().toUpperCase(), expiry: draft.expiry, qc: draft.qc }]); setLastLoc(draft.loc); setDraft(null); clear()
  }
  const quickAdd = async () => {
    const { data, error } = await supabase.from('wh_items').insert({ org_id: org, sku: newCode, name: newName.trim(), barcode: /^\d{8,14}$/.test(newCode) ? newCode : null }).select('id').single()
    if (error) return err(friendly(error.message)); await useWh.getState().load(org)
    const it = useWh.getState().items.find((i) => i.id === data.id); if (it) pick(it, 1)
  }
  const save = async () => {
    if (!lines.length) return err('Add at least one line.'); setBusy(true)
    const r = await whRpc('wh_receive', { p_po: po, p_supplier: supplier, p_notes: notes, p_op: op(), p_lines: lines.map((l) => ({ item: l.item.id, qty: l.qty, location: l.loc.id, lot: l.lot, expiry: l.expiry || null, qc: l.qc })) })
    setBusy(false); if (!r.ok) return err(r.message)
    renew(); ok(r.queued ? r.message : r.message + '. Stock is on the shelf.'); setLines([]); setPo(''); setNotes(''); setDraft(null)
    const s = supplier.trim(); if (s && !partners.some((p) => p.name.toLowerCase() === s.toLowerCase())) void supabase.from('wh_partners').insert({ org_id: org, name: s, kind: 'supplier' }).then(() => useWh.getState().load(org))
  }
  const units = lines.reduce((a, l) => a + l.qty, 0)
  return (
    <Page title="Goods in" sub="Scan what arrived, say where it goes, and record its condition. One receipt can hold many items.">
      <div className="mx-auto grid max-w-[1200px] gap-6 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-6">
          <Section title="Delivery"><div className="grid gap-4 sm:grid-cols-2">
            <Field label="PO or delivery note"><input value={po} onChange={(e) => setPo(e.target.value)} className={inputCls} placeholder="Optional" /></Field>
            <Field label="Supplier"><input value={supplier} onChange={(e) => setSupplier(e.target.value)} list="wh-suppliers" className={inputCls} placeholder="Optional" /><datalist id="wh-suppliers">{partners.filter((p) => p.kind !== 'customer').map((p) => <option key={p.id} value={p.name} />)}</datalist></Field>
            <div className="sm:col-span-2"><Field label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Anything worth remembering, such as damaged outer boxes" /></Field></div></div></Section>
          {flash && <Notice kind={flash.kind} onClose={clear}>{flash.text}</Notice>}
          {!draft && !newCode && <Section><OmniInput kind="item" label="Scan the item" onItem={pick} onUnknown={(c) => { setNewCode(c); setNewName('') }} hint="Scan its barcode or QR, or search by name." /></Section>}
          {newCode && !draft && (
            <Section title="New item" sub={`“${newCode}” is not in the system. Add it now and carry on.`}>
              <Field label="Item name" required><input value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} autoFocus placeholder="For example, Nitrile gloves, medium" /></Field>
              <div className="mt-4 flex flex-wrap gap-2"><button disabled={!newName.trim()} onClick={() => void quickAdd()} className={btnPrimary}>Add and continue</button><button onClick={() => setNewCode('')} className={btnGhost}>Cancel</button><button onClick={() => go('whitems')} className="px-3 text-[13.5px] font-bold text-cyan-700">Open Items for more detail</button></div>
              <p className="mt-3 text-[12.5px] text-stone-400">Only people who can edit items can add them. You can add the reorder level and cost later.</p>
            </Section>)}
          {draft && (
            <Section title={draft.item.name} sub={`${draft.item.sku} · unit: ${draft.item.uom}`} right={<button onClick={() => setDraft(null)} className="text-[13.5px] font-bold text-stone-400 hover:text-stone-700">Cancel</button>}>
              <div className="space-y-4">
                <Field label="How many arrived" required><input value={draft.qty} onChange={(e) => setD({ qty: e.target.value })} inputMode="decimal" className={inputCls} /></Field>
                <div>
                  {draft.loc ? <div className="flex items-center justify-between rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3"><div><div className="text-[12px] font-bold uppercase tracking-wide text-cyan-700">Put away to</div><div className="mono text-[17px] font-bold text-stone-900">{draft.loc.code}</div></div><button onClick={() => setD({ loc: null })} className="text-[13.5px] font-bold text-cyan-700">Change</button></div>
                    : <><OmniInput kind="loc" label="Put away to (scan the shelf)" autoFocus={false} onLoc={(l) => setD({ loc: l })} />{suggestion && <button onClick={() => setD({ loc: suggestion.loc })} className="mt-2 rounded-full bg-amber-50 px-3 py-1.5 text-[13px] font-bold text-amber-800 hover:bg-amber-100">Suggested: {suggestion.loc.code} ({suggestion.note})</button>}</>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Lot or batch" hint="From the label, if it has one"><input value={draft.lot} onChange={(e) => setD({ lot: e.target.value })} className={inputCls} /></Field>
                  <Field label="Expiry date" required={draft.item.trackExpiry && draft.qc === 'pass'}><input type="date" value={draft.expiry} onChange={(e) => setD({ expiry: e.target.value })} className={inputCls} /></Field></div>
                <div><div className="mb-1.5 text-[13px] font-bold text-stone-600">Condition on arrival</div><div className="grid grid-cols-2 gap-2">{QCS.map((q) => <button key={q.v} onClick={() => setD({ qc: q.v })} className={`rounded-2xl border px-3.5 py-2.5 text-left transition ${draft.qc === q.v ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-100' : 'border-stone-200 hover:bg-stone-50'}`}><div className="text-[14.5px] font-bold text-stone-800">{q.label}</div><div className="text-[12px] text-stone-500">{q.help}</div></button>)}</div></div>
                <button onClick={addLine} className={btnPrimary + ' flex w-full items-center justify-center gap-2'}><Plus size={18} /> Add to receipt</button>
              </div>
            </Section>)}
        </div>

        <Section title="This receipt" sub={lines.length ? `${lines.length} line${lines.length === 1 ? '' : 's'} · ${fmtQty(units)} units` : 'Nothing added yet'} className="h-fit">
          {lines.length === 0 ? <p className="py-8 text-center text-[14px] text-stone-400">Scan an item to start.</p> : <>
            <div className="-mx-2 overflow-x-auto"><table className="w-full text-[14px]"><thead><tr><th className={TH}>Item</th><th className={TH}>To</th><th className={TH + ' text-right'}>Qty</th><th /></tr></thead>
              <tbody>{lines.map((l) => <tr key={l.key}><td className={TD}><div className="font-semibold text-stone-800">{l.item.name}</div><div className="mono text-[12px] text-stone-400">{l.item.sku}{l.lot ? ` · ${l.lot}` : ''}{l.expiry ? ` · exp ${fmtDate(l.expiry)}` : ''}{l.qc !== 'pass' ? ` · ${QCS.find((q) => q.v === l.qc)!.label}` : ''}</div></td><td className={TD + ' mono'}>{locName(ix, l.loc.id)}</td><td className={TD + ' mono text-right font-semibold'}>{fmtQty(l.qty)}</td><td className={TD}><RemoveBtn onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))} /></td></tr>)}</tbody></table></div>
            <button disabled={busy} onClick={() => void save()} className={btnPrimary + ' mt-5 flex w-full items-center justify-center gap-2'}><CheckCircle2 size={18} />{busy ? 'Saving…' : 'Save receipt'}</button></>}
        </Section>
      </div>
    </Page>)
}
