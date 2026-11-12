import { useMemo, useRef, useState } from 'react'
import { Download, Pencil, Plus, Tags, Upload, X } from 'lucide-react'
import { Page } from '../components/ui'
import { go } from '../store'
import { supabase } from '../lib/supabase'
import { csvDownload, fmtMoney, fmtQty, norm, onHand, parseCsv, useIndex, useWh, useWhOrg, whRpc, whWrite, type Item } from './store'
import { btnDanger, btnGhost, btnPrimary, btnSmall, Empty, Field, inputCls, Notice, Pill, RemoveBtn, Section, TD, TH, useFlash, useTakePrefill } from './ui'

const blank = { sku: '', name: '', category: '', uom: 'unit', barcode: '', description: '', supplier: '', unitCost: '0', reorderPoint: '0', reorderQty: '0', leadDays: '7', trackExpiry: false, active: true }
type Form = typeof blank
const toForm = (i: Item): Form => ({ sku: i.sku, name: i.name, category: i.category, uom: i.uom, barcode: i.barcode, description: i.description, supplier: i.supplier, unitCost: String(i.unitCost), reorderPoint: String(i.reorderPoint), reorderQty: String(i.reorderQty), leadDays: String(i.leadDays), trackExpiry: i.trackExpiry, active: i.active })
const num = (s: string) => (s.trim() === '' ? 0 : Number(s))

function ImportPanel({ kind, onClose }: { kind: 'items' | 'stock'; onClose: () => void }) {
  const org = useWhOrg(); const ix = useIndex(); const file = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const [out, setOut] = useState<{ ok: number; errors: string[] } | null>(null); const [mk, setMk] = useState(true)
  const head = kind === 'items' ? ['sku', 'name', 'category', 'uom', 'barcode', 'supplier', 'unit_cost', 'reorder_point', 'reorder_qty', 'lead_time_days', 'track_expiry'] : ['sku', 'location', 'qty', 'lot', 'expiry']
  const sample = kind === 'items' ? [['GLV-M', 'Nitrile gloves, medium', 'PPE', 'box', '5012345678900', 'Acme', '4.50', '20', '100', '7', 'no']] : [['GLV-M', 'A-01-01', '50', 'L2401', '2027-06-30']]
  const run = async (f: File) => {
    setBusy(true); setOut(null); const rows = parseCsv(await f.text()); const errors: string[] = []; let okN = 0
    if (!rows.length) { setOut({ ok: 0, errors: ['The file is empty or has no header row.'] }); return setBusy(false) }
    if (kind === 'items') {
      const good: Record<string, unknown>[] = []
      rows.forEach((r, i) => { const sku = norm(r.sku ?? ''); if (!sku || !(r.name ?? '').trim()) return errors.push(`Row ${i + 2}: needs a sku and a name.`); good.push({ org_id: org, sku, name: r.name, category: r.category ?? '', uom: r.uom || 'unit', barcode: r.barcode || null, supplier: r.supplier ?? '', unit_cost: num(r.unit_cost ?? ''), reorder_point: num(r.reorder_point ?? ''), reorder_qty: num(r.reorder_qty ?? ''), lead_time_days: num(r.lead_time_days ?? '') || 7, track_expiry: /^(y|yes|true|1)$/i.test(r.track_expiry ?? '') }) })
      for (let i = 0; i < good.length; i += 200) {
        const chunk = good.slice(i, i + 200); const { error } = await supabase.from('wh_items').upsert(chunk, { onConflict: 'org_id,sku' })
        if (!error) { okN += chunk.length; continue }
        for (const row of chunk) { const { error: e } = await supabase.from('wh_items').upsert(row, { onConflict: 'org_id,sku' }); if (e) errors.push(`${row.sku}: ${e.message}`); else okN++ }
      }
    } else {
      const locMap = new Map(ix.locs.map((l) => [l.code, l.id])); const lines: { item: string; location: string; qty: number; lot: string; expiry: string | null; qc: string }[] = []; const newLocs = new Set<string>()
      for (const [i, r] of rows.entries()) { const it = ix.itemByCode.get(norm(r.sku ?? ''))?.item; const code = norm(r.location ?? ''); const q = Number(r.qty)
        if (!it) { errors.push(`Row ${i + 2}: no item with code ${r.sku || '(blank)'}.`); continue } if (!code) { errors.push(`Row ${i + 2}: no location.`); continue } if (!(q > 0)) { errors.push(`Row ${i + 2}: quantity must be above zero.`); continue }
        if (!locMap.has(code)) { if (mk) newLocs.add(code); else { errors.push(`Row ${i + 2}: unknown location ${code}.`); continue } }
        lines.push({ item: it.id, location: code, qty: q, lot: (r.lot ?? '').toUpperCase(), expiry: r.expiry || null, qc: 'pass' }) }
      if (newLocs.size) { const { error } = await supabase.from('wh_locations').insert([...newLocs].map((code) => ({ org_id: org, code, name: code, kind: 'shelf' }))); if (error) { errors.push(`Could not create locations: ${error.message}`); setOut({ ok: 0, errors }); return setBusy(false) } await useWh.getState().load(org); for (const l of useWh.getState().locs) locMap.set(l.code, l.id) }
      for (let i = 0; i < lines.length; i += 300) {
        const chunk = lines.slice(i, i + 300).map((l) => ({ ...l, location: locMap.get(l.location) })); const r = await whRpc('wh_receive', { p_po: 'OPENING STOCK', p_supplier: '', p_notes: 'Imported from a spreadsheet', p_lines: chunk, p_op: crypto.randomUUID() })
        if (r.ok) okN += chunk.length; else errors.push(`Lines ${i + 1}–${i + chunk.length} were not saved: ${r.message}`)
      }
    }
    await useWh.getState().load(org); setOut({ ok: okN, errors }); setBusy(false)
  }
  return (
    <Section title={kind === 'items' ? 'Import items from a spreadsheet' : 'Import opening stock'} sub={kind === 'items' ? 'One row per item. Existing SKUs are updated, new ones are added.' : 'One row per shelf and lot. Item SKUs must already exist. This is recorded as a receipt called OPENING STOCK.'} right={<button onClick={onClose} className="rounded-xl p-2 text-stone-400 hover:bg-stone-100"><X size={18} /></button>}>
      <p className="mono mb-3 break-all rounded-xl bg-stone-50 p-3 text-[12.5px] text-stone-600">{head.join(', ')}</p>
      <div className="flex flex-wrap items-center gap-3"><button onClick={() => csvDownload(`${kind}-template.csv`, [head, ...sample])} className={btnGhost + ' flex items-center gap-2 !px-4 !py-2.5 !text-[14px]'}><Download size={16} />Template</button>
        <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(f); e.target.value = '' }} />
        <button disabled={busy} onClick={() => file.current?.click()} className={btnPrimary + ' flex items-center gap-2 !px-4 !py-2.5 !text-[14px]'}><Upload size={16} />{busy ? 'Importing…' : 'Choose CSV file'}</button>
        {kind === 'stock' && <label className="flex items-center gap-2 text-[14px] text-stone-600"><input type="checkbox" checked={mk} onChange={(e) => setMk(e.target.checked)} className="accent-cyan-600" /> Create locations that do not exist yet</label>}</div>
      {out && <div className="mt-4 space-y-2"><Notice kind={out.errors.length ? (out.ok ? 'info' : 'error') : 'ok'}>{out.ok} row{out.ok === 1 ? '' : 's'} imported{out.errors.length ? `, ${out.errors.length} problem${out.errors.length === 1 ? '' : 's'}` : '.'}</Notice>{out.errors.length > 0 && <ul className="max-h-48 overflow-auto rounded-xl bg-rose-50 p-3 text-[13px] text-rose-900">{out.errors.slice(0, 40).map((e, i) => <li key={i}>{e}</li>)}{out.errors.length > 40 && <li>…and {out.errors.length - 40} more</li>}</ul>}</div>}
    </Section>)
}

export default function Items() {
  const ix = useIndex(); const org = useWhOrg(); const codes = useWh((s) => s.codes); const pre = useTakePrefill(); const { flash, ok, err, clear } = useFlash()
  const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [show, setShow] = useState<'none' | 'form' | 'items' | 'stock'>(pre?.itemId || pre?.code ? 'form' : 'none')
  const [edit, setEdit] = useState<Item | null>(pre?.itemId ? ix.itemById.get(pre.itemId) ?? null : null); const [f, setF] = useState<Form>(() => (pre?.itemId && ix.itemById.get(pre.itemId) ? toForm(ix.itemById.get(pre.itemId)!) : { ...blank, sku: pre?.code ?? '', barcode: /^\d{8,14}$/.test(pre?.code ?? '') ? pre!.code! : '' }))
  const [busy, setBusy] = useState(false); const [alias, setAlias] = useState({ code: '', kind: 'barcode', pack: '1' })
  const cats = useMemo(() => [...new Set(ix.items.map((i) => i.category).filter(Boolean))].sort(), [ix.items])
  const rows = ix.items.filter((i) => (!cat || i.category === cat) && (!q || (i.sku + i.name + i.barcode + i.category).toLowerCase().includes(q.toLowerCase())))
  const open = (i: Item | null) => { clear(); setEdit(i); setF(i ? toForm(i) : blank); setShow('form') }
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))
  const save = async () => {
    if (!f.sku.trim() || !f.name.trim()) return err('Enter a SKU and a name.')
    const row = { sku: f.sku, name: f.name, category: f.category.trim(), uom: f.uom.trim() || 'unit', barcode: f.barcode.trim() || null, description: f.description, supplier: f.supplier.trim(), unit_cost: num(f.unitCost), reorder_point: num(f.reorderPoint), reorder_qty: num(f.reorderQty), lead_time_days: Math.round(num(f.leadDays)) || 7, track_expiry: f.trackExpiry, active: f.active }
    if ([row.unit_cost, row.reorder_point, row.reorder_qty].some((n) => !(n >= 0))) return err('Cost and reorder levels must be zero or more.')
    setBusy(true); const r = await whWrite(edit ? supabase.from('wh_items').update(row).eq('id', edit.id).eq('org_id', org) : supabase.from('wh_items').insert({ ...row, org_id: org })); setBusy(false)
    if (!r.ok) return err(r.message); ok(edit ? 'Item saved.' : 'Item added.'); setShow('none'); setEdit(null)
  }
  const del = async () => { if (!edit) return; setBusy(true); const r = await whWrite(supabase.from('wh_items').delete().eq('id', edit.id).eq('org_id', org)); setBusy(false); if (!r.ok) return err(r.message); ok('Item deleted.'); setShow('none'); setEdit(null) }
  const addAlias = async () => { if (!edit || !alias.code.trim()) return; const r = await whWrite(supabase.from('wh_codes').insert({ org_id: org, item_id: edit.id, code: alias.code, kind: alias.kind, pack_qty: num(alias.pack) || 1 })); if (!r.ok) return err(r.message); setAlias({ code: '', kind: 'barcode', pack: '1' }); clear() }
  const mine = edit ? codes.filter((c) => c.itemId === edit.id && c.kind !== 'sku' && c.code !== norm(edit.barcode)) : []

  return (
    <Page title="Items" sub="Everything you stock. Give each item a SKU and, if it has one, a barcode. QR and RFID codes can be added as extra codes."
      right={<div className="flex flex-wrap gap-2">
        {show === 'form' ? <button onClick={() => { setShow('none'); setEdit(null) }} className={btnGhost + ' flex items-center gap-2 !px-4 !py-2.5 !text-[14px]'}><X size={16} />Close</button> : <button onClick={() => open(null)} className={btnPrimary + ' flex items-center gap-2 !px-4 !py-2.5 !text-[14px]'}><Plus size={16} />Add item</button>}
        <button onClick={() => setShow(show === 'items' ? 'none' : 'items')} className={btnGhost + ' !px-4 !py-2.5 !text-[14px]'}>Import items</button><button onClick={() => setShow(show === 'stock' ? 'none' : 'stock')} className={btnGhost + ' !px-4 !py-2.5 !text-[14px]'}>Import stock</button>
        <button onClick={() => go('whlabels')} className={btnGhost + ' flex items-center gap-2 !px-4 !py-2.5 !text-[14px]'}><Tags size={16} />Labels</button></div>}>
      <div className="space-y-6">
        {flash && <Notice kind={flash.kind} onClose={clear}>{flash.text}</Notice>}
        {(show === 'items' || show === 'stock') && <ImportPanel kind={show} onClose={() => setShow('none')} />}
        {show === 'form' && (
          <Section title={edit ? `Edit ${edit.name}` : 'New item'}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="SKU" required hint="Your own code. Letters and numbers."><input value={f.sku} onChange={(e) => set('sku', e.target.value)} className={inputCls} /></Field>
              <div className="sm:col-span-1 lg:col-span-2"><Field label="Name" required><input value={f.name} onChange={(e) => set('name', e.target.value)} className={inputCls} /></Field></div>
              <Field label="Barcode (EAN or UPC)"><input value={f.barcode} onChange={(e) => set('barcode', e.target.value)} className={inputCls} /></Field>
              <Field label="Category"><input value={f.category} onChange={(e) => set('category', e.target.value)} list="wh-cats" className={inputCls} /><datalist id="wh-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></Field>
              <Field label="Unit"><input value={f.uom} onChange={(e) => set('uom', e.target.value)} className={inputCls} placeholder="unit, box, kg…" /></Field>
              <Field label="Cost per unit (£)"><input value={f.unitCost} onChange={(e) => set('unitCost', e.target.value)} inputMode="decimal" className={inputCls} /></Field>
              <Field label="Reorder level" hint="Warn me at or below this"><input value={f.reorderPoint} onChange={(e) => set('reorderPoint', e.target.value)} inputMode="decimal" className={inputCls} /></Field>
              <Field label="Usual order size"><input value={f.reorderQty} onChange={(e) => set('reorderQty', e.target.value)} inputMode="decimal" className={inputCls} /></Field>
              <Field label="Supplier"><input value={f.supplier} onChange={(e) => set('supplier', e.target.value)} className={inputCls} /></Field>
              <Field label="Supplier lead time (days)"><input value={f.leadDays} onChange={(e) => set('leadDays', e.target.value)} inputMode="numeric" className={inputCls} /></Field>
              <div className="sm:col-span-2 lg:col-span-3"><Field label="Description"><input value={f.description} onChange={(e) => set('description', e.target.value)} className={inputCls} /></Field></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-6"><label className="flex items-center gap-2.5 text-[14.5px] font-semibold text-stone-700"><input type="checkbox" checked={f.trackExpiry} onChange={(e) => set('trackExpiry', e.target.checked)} className="h-5 w-5 accent-cyan-600" /> Has an expiry date (picked soonest-first)</label>
              {edit && <label className="flex items-center gap-2.5 text-[14.5px] font-semibold text-stone-700"><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} className="h-5 w-5 accent-cyan-600" /> In use</label>}</div>
            {edit && <div className="mt-6 border-t border-stone-100 pt-5"><div className="text-[14px] font-bold text-stone-700">Other codes that mean this item</div><p className="text-[13px] text-stone-400">Case barcodes, QR labels or RFID tags. Scanning any of them finds this item.</p>
              <ul className="mt-3 space-y-2">{mine.map((c) => <li key={c.code} className="flex items-center justify-between rounded-xl bg-stone-50 px-3.5 py-2 text-[14px]"><span><span className="mono font-semibold">{c.code}</span> <Pill>{c.kind}</Pill>{c.packQty !== 1 && <span className="ml-2 text-stone-500">{fmtQty(c.packQty)} per scan</span>}</span><RemoveBtn onClick={() => void whWrite(supabase.from('wh_codes').delete().eq('org_id', org).eq('code', c.code))} /></li>)}</ul>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_130px_110px_auto]"><input value={alias.code} onChange={(e) => setAlias({ ...alias, code: e.target.value })} placeholder="Code" className={inputCls + ' !h-11'} /><select value={alias.kind} onChange={(e) => setAlias({ ...alias, kind: e.target.value })} className="h-11 rounded-2xl border border-stone-200 bg-white px-3 text-[14px]"><option>barcode</option><option>qr</option><option>rfid</option><option>other</option></select><input value={alias.pack} onChange={(e) => setAlias({ ...alias, pack: e.target.value })} title="Units per scan, for case barcodes" className={inputCls + ' !h-11'} /><button onClick={() => void addAlias()} className={btnSmall + ' !h-11 !px-4'}>Add code</button></div></div>}
            <div className="mt-6 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void save()} className={btnPrimary}>{busy ? 'Saving…' : edit ? 'Save changes' : 'Add item'}</button>{edit && <button disabled={busy} onClick={() => void del()} className={btnDanger}>Delete</button>}</div>
            {edit && <p className="mt-2 text-[12.5px] text-stone-400">An item that has stock or history cannot be deleted. Untick “In use” instead.</p>}
          </Section>)}

        <Section>
          <div className="mb-4 flex flex-wrap gap-2"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, SKU, barcode…" className={inputCls + ' !h-11 flex-1'} />
            {cats.length > 0 && <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-11 rounded-2xl border border-stone-200 bg-white px-3 text-[14px]"><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>}
            <button onClick={() => csvDownload('items.csv', [['sku', 'name', 'category', 'uom', 'barcode', 'supplier', 'unit_cost', 'reorder_point', 'reorder_qty', 'available'], ...rows.map((i) => [i.sku, i.name, i.category, i.uom, i.barcode, i.supplier, i.unitCost, i.reorderPoint, i.reorderQty, onHand(ix, i.id)])])} className={btnGhost + ' flex items-center gap-2 !px-4 !py-2.5 !text-[14px]'}><Download size={16} />Export</button></div>
          {ix.items.length === 0 ? <Empty icon={<Tags size={22} />} title="No items yet" sub="Add them one at a time, or import a spreadsheet." /> : rows.length === 0 ? <p className="py-8 text-center text-[14px] text-stone-400">Nothing matches.</p> : (
            <div className="-mx-2 overflow-x-auto"><table className="w-full text-[14px]"><thead><tr><th className={TH}>Item</th><th className={TH}>Category</th><th className={TH + ' text-right'}>Available</th><th className={TH + ' text-right'}>Reorder at</th><th className={TH + ' text-right'}>Cost</th><th /></tr></thead>
              <tbody>{rows.map((i) => { const a = onHand(ix, i.id); const low = i.reorderPoint > 0 && a <= i.reorderPoint; return <tr key={i.id} className={i.active ? '' : 'opacity-50'}><td className={TD}><div className="font-semibold text-stone-800">{i.name} {!i.active && <Pill>Off</Pill>}</div><div className="mono text-[12px] text-stone-400">{i.sku}{i.barcode ? ` · ${i.barcode}` : ''}</div></td><td className={TD + ' text-stone-500'}>{i.category || '–'}</td><td className={TD + ' mono text-right font-semibold'}>{low ? <span className="text-amber-700">{fmtQty(a)}</span> : fmtQty(a)}</td><td className={TD + ' mono text-right text-stone-500'}>{i.reorderPoint ? fmtQty(i.reorderPoint) : '–'}</td><td className={TD + ' mono text-right text-stone-500'}>{i.unitCost ? fmtMoney(i.unitCost) : '–'}</td><td className={TD}><button onClick={() => open(i)} className={btnSmall + ' flex items-center gap-1.5'}><Pencil size={13} />Edit</button></td></tr> })}</tbody></table></div>)}
        </Section>
      </div>
    </Page>)
}
