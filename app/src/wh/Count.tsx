import { useMemo, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { Page } from '../components/ui'
import { fmtDate, fmtQty, useIndex, useOp, whRpc, type Item, type Loc } from './store'
import { useInsights } from './intel'
import { btnGhost, btnPrimary, Field, inputCls, Notice, OmniInput, Pill, RemoveBtn, Section, TD, TH, useFlash, useTakePrefill } from './ui'

interface Row { key: string; item: Item; lot: string; expiry: string | null; system: number; counted: string; added?: boolean }

export default function Count() {
  const ix = useIndex(); const pre = useTakePrefill(); const { data } = useInsights(); const { op, renew } = useOp(); const { flash, ok, err, clear } = useFlash()
  const [loc, setLoc] = useState<Loc | null>(pre?.locId ? ix.locById.get(pre.locId) ?? null : null); const [extra, setExtra] = useState<Row[]>([]); const [counted, setCounted] = useState<Record<string, string>>({}); const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false); const [newLot, setNewLot] = useState('')
  const base = useMemo<Row[]>(() => (loc ? (ix.stockByLoc.get(loc.id) ?? []).filter((s) => s.status === 'available').map((s) => ({ key: `${s.itemId}|${s.lot}`, item: ix.itemById.get(s.itemId)!, lot: s.lot, expiry: s.expiry, system: s.qty, counted: '' })).filter((r) => r.item).sort((a, b) => a.item.sku.localeCompare(b.item.sku)) : []), [loc, ix])
  const rows = [...base, ...extra.filter((e) => !base.some((b) => b.key === e.key))].map((r) => ({ ...r, counted: counted[r.key] ?? '' }))
  const filled = rows.filter((r) => r.counted !== ''); const blank = rows.length - filled.length
  const diff = (r: Row) => Number(r.counted) - r.system
  const reset = () => { setLoc(null); setExtra([]); setCounted({}); setNotes('') }
  const addItem = (i: Item) => { const key = `${i.id}|${newLot.trim().toUpperCase()}`; if (rows.some((r) => r.key === key)) return err('That item and lot is already in the list.'); clear(); setExtra((e) => [...e, { key, item: i, lot: newLot.trim().toUpperCase(), expiry: null, system: 0, counted: '', added: true }]) }
  const submit = async () => {
    if (!loc) return; if (!filled.length) return err('Enter at least one count.'); if (filled.some((r) => !(Number(r.counted) >= 0))) return err('Counts must be zero or more.')
    const bad = filled.find((r) => r.added && diff(r) > 0 && r.item.trackExpiry && !r.expiry); if (bad) return err(`Add the item through Goods in instead: ${bad.item.sku} needs an expiry date.`)
    setBusy(true); const r = await whRpc('wh_count', { p_loc: loc.id, p_notes: notes, p_op: op(), p_lines: filled.map((x) => ({ item: x.item.id, lot: x.lot, counted: Number(x.counted), expiry: x.expiry })) }); setBusy(false)
    if (!r.ok) return err(r.message); renew(); ok(r.message); reset()
  }
  const variance = filled.reduce((a, r) => a + Math.abs(diff(r)), 0)
  return (
    <Page title="Cycle count" sub="Count what is really on a shelf. Differences are corrected and recorded, and shelves that often differ are flagged in Insights.">
      <div className="mx-auto max-w-[1000px] space-y-6">
        {flash && <Notice kind={flash.kind} onClose={clear}>{flash.text}</Notice>}
        {!loc ? <Section>
          <OmniInput kind="loc" label="Scan the shelf to count" onLoc={(l) => { clear(); setLoc(l) }} />
          {data && data.count_next.length > 0 && <div className="mt-5"><div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-stone-400">Suggested next, longest since counted first</div><div className="flex flex-wrap gap-2">{data.count_next.map((c) => <button key={c.id} onClick={() => setLoc(ix.locById.get(c.id) ?? null)} className="rounded-full border border-stone-200 px-3.5 py-1.5 text-[13.5px] font-semibold text-stone-700 hover:bg-cyan-50"><span className="mono">{c.code}</span> · {c.last_count ? fmtDate(c.last_count) : 'never counted'}{c.var_events > 0 && <span className="ml-1 text-amber-700">· {c.var_events} corrections</span>}</button>)}</div></div>}
        </Section> : (
          <Section title={<span>Counting <span className="mono">{loc.code}</span></span>} sub={rows.length ? `${rows.length} line${rows.length === 1 ? '' : 's'} expected. Enter what you find. Leave a line blank to skip it.` : 'The system has nothing here. Scan what you find to add it.'} right={<button onClick={reset} className="text-[13.5px] font-bold text-stone-400 hover:text-stone-700">Change shelf</button>}>
            {rows.length > 0 && <div className="-mx-2 overflow-x-auto"><table className="w-full text-[14px]"><thead><tr><th className={TH}>Item</th><th className={TH}>Lot</th><th className={TH + ' text-right'}>System</th><th className={TH}>Counted</th><th className={TH}>Difference</th><th /></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.key}><td className={TD}><div className="font-semibold text-stone-800">{r.item.name}</div><div className="mono text-[12px] text-stone-400">{r.item.sku}</div></td><td className={TD + ' mono'}>{r.lot || '–'}</td><td className={TD + ' mono text-right'}>{fmtQty(r.system)}</td>
                <td className={TD}><input value={r.counted} onChange={(e) => setCounted({ ...counted, [r.key]: e.target.value })} inputMode="decimal" placeholder="–" className="h-10 w-24 rounded-xl border border-stone-200 px-3 text-[14.5px] font-semibold outline-none focus:border-cyan-500" /></td>
                <td className={TD}>{r.counted === '' ? <span className="text-stone-300">–</span> : diff(r) === 0 ? <Pill tone="green">Matches</Pill> : <Pill tone={diff(r) < 0 ? 'red' : 'amber'}>{diff(r) > 0 ? '+' : ''}{fmtQty(diff(r))}</Pill>}</td>
                <td className={TD}>{r.added && <RemoveBtn onClick={() => setExtra((e) => e.filter((x) => x.key !== r.key))} />}</td></tr>)}</tbody></table></div>}
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_160px]"><OmniInput kind="item" label="Found something that is not listed?" autoFocus={false} onItem={addItem} /><Field label="Its lot (optional)"><input value={newLot} onChange={(e) => setNewLot(e.target.value)} className={inputCls} /></Field></div>
            <div className="mt-5 flex flex-wrap items-center gap-3">{base.length > 0 && <button onClick={() => setCounted(Object.fromEntries(rows.map((r) => [r.key, String(r.system)])))} className={btnGhost}>Everything matches</button>}</div>
            <div className="mt-5 space-y-3 border-t border-stone-100 pt-5"><Field label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Optional" /></Field>
              {filled.length > 0 && <p className="text-[13.5px] text-stone-500">{filled.length} line{filled.length === 1 ? '' : 's'} counted{variance > 0 ? `, ${fmtQty(variance)} unit${variance === 1 ? '' : 's'} of difference will be corrected` : ', all matching'}{blank > 0 ? `. ${blank} blank line${blank === 1 ? '' : 's'} will not be changed.` : '.'}</p>}
              <button disabled={busy || !filled.length} onClick={() => void submit()} className={btnPrimary + ' flex items-center gap-2'}><ClipboardCheck size={18} />{busy ? 'Saving…' : 'Save count'}</button></div>
          </Section>)}
      </div>
    </Page>)
}
