import { useState } from 'react'
import { Package } from 'lucide-react'
import { Page } from '../components/ui'
import { go } from '../store'
import { fmtQty, useIndex, useOp, useWh, whRpc } from './store'
import { btnPrimary, Field, inputCls, Notice, Section, useFlash, useTakePrefillItem } from './ui'
import { PickLines, type PLine } from './PickLines'

export default function Pack() {
  const ix = useIndex(); const partners = useWh((s) => s.partners); const pre = useTakePrefillItem(); const { op, renew } = useOp(); const { flash, ok, err, clear } = useFlash()
  const [customer, setCustomer] = useState(''); const [ref, setRef] = useState(''); const [notes, setNotes] = useState(''); const [lines, setLines] = useState<PLine[]>([]); const [busy, setBusy] = useState(false); const [done, setDone] = useState('')
  const save = async () => {
    if (!customer.trim()) return err('Enter the customer or destination.'); if (!lines.length) return err('Add at least one item.'); setBusy(true)
    const r = await whRpc('wh_pack', { p_customer: customer, p_reference: ref, p_notes: notes, p_op: op(), p_lines: lines.map((l) => ({ item: l.item.id, qty: l.qty, location: l.locId ?? null, lot: l.lot ?? null })) })
    setBusy(false); if (!r.ok) return err(r.message); renew(); ok(r.queued ? r.message : r.message + '. The stock is now reserved for this order.'); setDone((r.data?.number as string) ?? ''); setLines([]); setCustomer(''); setRef(''); setNotes('')
  }
  return (
    <Page title="Pack order" sub="Pick items for a customer order. Stock leaves the shelf now and is kept against the order until you dispatch or unpack it.">
      <div className="mx-auto grid max-w-[1200px] gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Section title="Order details"><div className="space-y-4">
          <Field label="Customer or destination" required><input value={customer} onChange={(e) => setCustomer(e.target.value)} list="wh-customers2" className={inputCls} /><datalist id="wh-customers2">{partners.filter((p) => p.kind !== 'supplier').map((p) => <option key={p.id} value={p.name} />)}</datalist></Field>
          <Field label="Customer reference" hint="Their PO or order number"><input value={ref} onChange={(e) => setRef(e.target.value)} className={inputCls} /></Field>
          <Field label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Optional" /></Field>
          {flash && <Notice kind={flash.kind} onClose={clear}>{flash.text}</Notice>}
          {done && <button onClick={() => { useWh.setState({ orderFocus: done }); go('whorders') }} className="text-[14px] font-bold text-cyan-700">Open {done} to print the packing slip →</button>}</div></Section>
        <Section title="Items to pack" sub={lines.length ? `${lines.length} line${lines.length === 1 ? '' : 's'} · ${fmtQty(lines.reduce((a, l) => a + l.qty, 0))} units` : undefined}>
          <PickLines lines={lines} setLines={setLines} initialItem={pre ? ix.itemById.get(pre.itemId ?? '') : null} />
          {lines.length > 0 && <button disabled={busy} onClick={() => void save()} className={btnPrimary + ' mt-5 flex w-full items-center justify-center gap-2'}><Package size={18} />{busy ? 'Packing…' : 'Pack order'}</button>}
        </Section>
      </div>
    </Page>)
}
