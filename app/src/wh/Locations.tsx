import { useRef, useState } from 'react'
import { Download, MapPinned, Pencil, Plus, Tags, Upload, X } from 'lucide-react'
import { Page } from '../components/ui'
import { go } from '../store'
import { supabase } from '../lib/supabase'
import { csvDownload, fmtQty, LOC_KINDS, norm, parseCsv, useIndex, useWh, useWhOrg, whWrite, type Loc, type LocKind } from './store'
import { btnDanger, btnGhost, btnPrimary, btnSmall, Empty, Field, inputCls, Meter, Notice, Pill, Section, TD, TH, useFlash, useTakePrefill } from './ui'

const KIND_HELP: Record<LocKind, string> = { warehouse: 'A whole site', zone: 'An area', shelf: 'A shelf', bin: 'A bin or tote', dock: 'Loading dock', quarantine: 'Held stock', damage: 'Damaged stock', packing: 'Packing bench' }
const blank = { code: '', name: '', kind: 'shelf' as LocKind, parent: '', capacity: '', active: true }

export default function Locations() {
  const ix = useIndex(); const org = useWhOrg(); const pre = useTakePrefill(); const { flash, ok, err, clear } = useFlash(); const file = useRef<HTMLInputElement>(null)
  const [show, setShow] = useState(!!pre?.code); const [edit, setEdit] = useState<Loc | null>(null); const [f, setF] = useState({ ...blank, code: pre?.code ?? '' }); const [busy, setBusy] = useState(false); const [q, setQ] = useState(''); const [imp, setImp] = useState(false)
  const used = (id: string) => (ix.stockByLoc.get(id) ?? []).reduce((a, s) => a + s.qty, 0)
  const rows = ix.locs.filter((l) => !q || (l.code + l.name + l.kind).toLowerCase().includes(q.toLowerCase()))
  const open = (l: Loc | null) => { clear(); setEdit(l); setF(l ? { code: l.code, name: l.name, kind: l.kind, parent: l.parentId ?? '', capacity: l.capacity == null ? '' : String(l.capacity), active: l.active } : blank); setShow(true); setImp(false) }
  const save = async () => {
    if (!f.code.trim()) return err('Enter a code. This is what the QR label will say.'); const cap = f.capacity.trim() === '' ? null : Number(f.capacity); if (cap != null && !(cap >= 0)) return err('Capacity must be zero or more.')
    const row = { code: f.code, name: f.name, kind: f.kind, parent_id: f.parent || null, capacity: cap, active: f.active }
    setBusy(true); const r = await whWrite(edit ? supabase.from('wh_locations').update(row).eq('id', edit.id).eq('org_id', org) : supabase.from('wh_locations').insert({ ...row, org_id: org })); setBusy(false)
    if (!r.ok) return err(r.message); ok(edit ? 'Location saved.' : 'Location added.'); setShow(false); setEdit(null)
  }
  const del = async () => { if (!edit) return; setBusy(true); const r = await whWrite(supabase.from('wh_locations').delete().eq('id', edit.id).eq('org_id', org)); setBusy(false); if (!r.ok) return err(r.message); ok('Location deleted.'); setShow(false); setEdit(null) }
  const run = async (fl: File) => {
    const data = parseCsv(await fl.text()); if (!data.length) return err('The file is empty or has no header row.')
    const seen = new Set<string>(); const good: Record<string, unknown>[] = []; const bad: string[] = []
    data.forEach((r, i) => { const code = norm(r.code ?? ''); if (!code) return bad.push(`Row ${i + 2}: no code.`); if (seen.has(code)) return; seen.add(code); const kind = (r.kind || 'shelf').toLowerCase(); if (!LOC_KINDS.includes(kind as LocKind)) return bad.push(`Row ${i + 2}: unknown type “${r.kind}”.`); good.push({ org_id: org, code, name: r.name || code, kind, capacity: r.capacity ? Number(r.capacity) : null }) })
    let n = 0; for (let i = 0; i < good.length; i += 200) { const c = good.slice(i, i + 200); const { error } = await supabase.from('wh_locations').upsert(c, { onConflict: 'org_id,code' }); if (error) bad.push(error.message); else n += c.length }
    await useWh.getState().load(org); const parents = data.filter((r) => r.parent && norm(r.code ?? '')); const map = new Map(useWh.getState().locs.map((l) => [l.code, l.id]))
    for (const r of parents) { const pid = map.get(norm(r.parent)); const id = map.get(norm(r.code)); if (pid && id && pid !== id) await supabase.from('wh_locations').update({ parent_id: pid }).eq('id', id) }
    await useWh.getState().load(org); if (bad.length) err(`${n} imported. Problems: ${bad.slice(0, 5).join(' ')}`); else ok(`${n} location${n === 1 ? '' : 's'} imported.`); setImp(false)
  }
  return (
    <Page title="Locations" sub="Warehouses, zones, shelves and bins. Each has a code that prints as a QR label, so a scan tells the system exactly where you are."
      right={<div className="flex flex-wrap gap-2">
        {show ? <button onClick={() => { setShow(false); setEdit(null) }} className={btnGhost + ' flex items-center gap-2 !px-4 !py-2.5 !text-[14px]'}><X size={16} />Close</button> : <button onClick={() => open(null)} className={btnPrimary + ' flex items-center gap-2 !px-4 !py-2.5 !text-[14px]'}><Plus size={16} />Add location</button>}
        <button onClick={() => { setImp(!imp); setShow(false) }} className={btnGhost + ' !px-4 !py-2.5 !text-[14px]'}>Import</button>
        <button onClick={() => go('whlabels')} className={btnGhost + ' flex items-center gap-2 !px-4 !py-2.5 !text-[14px]'}><Tags size={16} />Labels</button></div>}>
      <div className="space-y-6">
        {flash && <Notice kind={flash.kind} onClose={clear}>{flash.text}</Notice>}
        {imp && <Section title="Import locations" sub="Existing codes are updated. Use parent to place one location inside another.">
          <p className="mono mb-3 rounded-xl bg-stone-50 p-3 text-[12.5px] text-stone-600">code, name, kind, parent, capacity</p>
          <div className="flex flex-wrap gap-3"><button onClick={() => csvDownload('locations-template.csv', [['code', 'name', 'kind', 'parent', 'capacity'], ['A', 'Aisle A', 'zone', '', ''], ['A-01-01', 'Aisle A, bay 1, shelf 1', 'shelf', 'A', '200']])} className={btnGhost + ' flex items-center gap-2 !px-4 !py-2.5 !text-[14px]'}><Download size={16} />Template</button>
            <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const fl = e.target.files?.[0]; if (fl) void run(fl); e.target.value = '' }} /><button onClick={() => file.current?.click()} className={btnPrimary + ' flex items-center gap-2 !px-4 !py-2.5 !text-[14px]'}><Upload size={16} />Choose CSV file</button></div></Section>}
        {show && (
          <Section title={edit ? `Edit ${edit.code}` : 'New location'}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Code" required hint="Short and unique. Printed on the label."><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className={inputCls} placeholder="A-01-03" /></Field>
              <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} placeholder="Optional" /></Field>
              <Field label="Type"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as LocKind })} className={inputCls}>{LOC_KINDS.map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)} · {KIND_HELP[k]}</option>)}</select></Field>
              <Field label="Inside" hint="Optional"><select value={f.parent} onChange={(e) => setF({ ...f, parent: e.target.value })} className={inputCls}><option value="">Nothing (top level)</option>{ix.locs.filter((l) => l.id !== edit?.id).map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}</select></Field>
              <Field label="Capacity (units)" hint="Optional. Used to warn when it is nearly full."><input value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} inputMode="decimal" className={inputCls} /></Field>
              {edit && <label className="flex items-center gap-2.5 self-end pb-3 text-[14.5px] font-semibold text-stone-700"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="h-5 w-5 accent-cyan-600" /> In use</label>}
            </div>
            <div className="mt-6 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void save()} className={btnPrimary}>{busy ? 'Saving…' : edit ? 'Save changes' : 'Add location'}</button>{edit && <button disabled={busy} onClick={() => void del()} className={btnDanger}>Delete</button>}</div>
            {edit && <p className="mt-2 text-[12.5px] text-stone-400">A location with stock or history cannot be deleted. Untick “In use” instead.</p>}
          </Section>)}
        <Section>
          <div className="mb-4"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code or name…" className={inputCls + ' !h-11'} /></div>
          {ix.locs.length === 0 ? <Empty icon={<MapPinned size={22} />} title="No locations yet" sub="Add your first shelf or import a list. You will need at least one before you can receive stock." /> : (
            <div className="-mx-2 overflow-x-auto"><table className="w-full text-[14px]"><thead><tr><th className={TH}>Code</th><th className={TH}>Type</th><th className={TH}>Inside</th><th className={TH}>Filled</th><th /></tr></thead>
              <tbody>{rows.map((l) => { const u = used(l.id); return <tr key={l.id} className={l.active ? '' : 'opacity-50'}><td className={TD}><div className="mono font-bold text-stone-900">{l.code}</div>{l.name !== l.code && <div className="text-[12.5px] text-stone-400">{l.name}</div>}</td><td className={TD}><Pill>{l.kind}</Pill>{!l.active && <span className="ml-1.5"><Pill tone="red">Off</Pill></span>}</td><td className={TD + ' mono text-stone-500'}>{l.parentId ? ix.locById.get(l.parentId)?.code : '–'}</td>
                <td className={TD + ' w-56'}>{l.capacity ? <div><div className="mb-1 text-[12.5px] text-stone-500">{fmtQty(u)} / {fmtQty(l.capacity)}</div><Meter v={u / l.capacity} tone={u > l.capacity ? 'red' : u / l.capacity > 0.9 ? 'amber' : 'cyan'} /></div> : <span className="mono text-stone-500">{u ? fmtQty(u) + ' units' : '–'}</span>}</td>
                <td className={TD}><button onClick={() => open(l)} className={btnSmall + ' flex items-center gap-1.5'}><Pencil size={13} />Edit</button></td></tr> })}</tbody></table></div>)}
        </Section>
      </div>
    </Page>)
}
