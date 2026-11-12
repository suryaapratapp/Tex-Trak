import { useState } from 'react'
import { PackageMinus } from 'lucide-react'
import { Page } from '../components/ui'
import { fmtQty, REASONS, useIndex, useOp, useWh, whRpc } from './store'
import { btnPrimary, Field, inputCls, Notice, Section, useFlash, useTakePrefillItem } from './ui'
import { PickLines, type PLine } from './PickLines'

export default function Issue() {
  const ix = useIndex(); const partners = useWh((s) => s.partners); const pre = useTakePrefillItem(); const { op, renew } = useOp(); const { flash, ok, err, clear } = useFlash()
  const [reason, setReason] = useState('sale'); const [to, setTo] = useState(''); const [notes, setNotes] = useState(''); const [lines, setLines] = useState<PLine[]>([]); const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!lines.length) return err('Add at least one item.'); setBusy(true)
    const r = await whRpc('wh_issue', { p_reason: reason, p_to: to, p_notes: notes, p_op: op(), p_lines: lines.map((l) => ({ item: l.item.id, qty: l.qty, location: l.locId ?? null, lot: l.lot ?? null })) })
    setBusy(false); if (!r.ok) return err(r.message); renew(); ok(r.message); setLines([]); setTo(''); setNotes('')
  }
  return (
    <Page title="Goods out" sub="Take stock out of the warehouse: a sale, production use, a sample, disposal or a return to the supplier. For parcels you pack and ship, use Pack order.">
      <div className="mx-auto grid max-w-[1200px] gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Section title="Why is it leaving?"><div className="space-y-4">
          <Field label="Reason" required><select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>{REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Field>
          <Field label="To whom or where"><input value={to} onChange={(e) => setTo(e.target.value)} list="wh-customers" className={inputCls} placeholder="Customer, department, bin…" /><datalist id="wh-customers">{partners.map((p) => <option key={p.id} value={p.name} />)}</datalist></Field>
          <Field label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Optional" /></Field>
          {flash && <Notice kind={flash.kind} onClose={clear}>{flash.text}</Notice>}</div></Section>
        <Section title="Items" sub={lines.length ? `${lines.length} line${lines.length === 1 ? '' : 's'} · ${fmtQty(lines.reduce((a, l) => a + l.qty, 0))} units` : undefined}>
          <PickLines lines={lines} setLines={setLines} initialItem={pre ? ix.itemById.get(pre.itemId ?? '') : null} />
          {lines.length > 0 && <button disabled={busy} onClick={() => void save()} className={btnPrimary + ' mt-5 flex w-full items-center justify-center gap-2'}><PackageMinus size={18} />{busy ? 'Saving…' : 'Record goods out'}</button>}
        </Section>
      </div>
    </Page>)
}
