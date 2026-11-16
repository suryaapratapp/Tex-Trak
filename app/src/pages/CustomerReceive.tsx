import { useMemo, useState } from 'react'
import { CheckCircle2, ClipboardCheck, ScanLine } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { feedback } from '../lib/offline'
import { toast } from '../lib/toast'
import { SignaturePad } from '../components/SignaturePad'
import { btnPrimary, Field, inputCls, Notice, ScanField } from '../qr/ui'
import type { Line } from './ShipmentContents'

/** The customer's side: accept a delivery by scanning every item, or by confirming they checked it. Either way: name and signature. */
export function CustomerReceive({ id, shipRef, expected, lines, onDone }: { id: string; shipRef: string; expected: number; lines: Line[]; onDone: () => void }) {
  const scannable = lines.filter((l) => l.source === 'qr' || l.source === 'rfid')
  const canScan = scannable.length > 0 && scannable.reduce((n, l) => n + l.qty, 0) === expected
  const [how, setHow] = useState<'scan' | 'confirm'>(canScan ? 'scan' : 'confirm')
  const [got, setGot] = useState<Set<string>>(new Set()); const [said, setSaid] = useState(false); const [count, setCount] = useState(String(expected))
  const [name, setName] = useState(''); const [sig, setSig] = useState<string | null>(null); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const codes = useMemo(() => new Map(scannable.map((l) => [l.label.trim().toUpperCase(), l.label])), [scannable])
  const scan = (raw: string) => {
    const c = raw.trim().toUpperCase(); if (!c) return
    if (!codes.has(c)) { feedback(false); return toast.error(`${raw.trim()} is not on this delivery.`) }
    if (got.has(c)) { feedback(false); return toast.info(`${codes.get(c)} was already scanned.`) }
    feedback(true); setGot((g) => new Set(g).add(c))
  }
  const missing = scannable.filter((l) => !got.has(l.label.trim().toUpperCase()))
  const received = how === 'scan' ? got.size : Math.max(0, Math.round(Number(count) || 0))
  const ready = name.trim().length >= 2 && !!sig && (how === 'scan' ? got.size > 0 : said)
  const submit = async () => {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('shipment_customer_receive', { p_id: id, p_method: how, p_items: received, p_name: name.trim(), p_signature: sig, p_note: note.trim(), p_scanned: how === 'scan' ? got.size : null })
    setBusy(false); if (error) return setErr(error.message)
    toast.ok(received === expected ? `${shipRef} accepted. Thank you.` : `${shipRef} recorded with ${received} of ${expected} items.`); onDone()
  }
  return (
    <div className="mt-5 space-y-4 rounded-2xl border-2 border-cyan-200 bg-cyan-50/40 p-4">
      <div><h3 className="text-[17px] font-extrabold text-stone-900">Accept this delivery</h3><p className="text-[13.5px] text-stone-500">{expected} item{expected === 1 ? '' : 's'} are expected. Check them, then sign.</p></div>
      <div className="grid grid-cols-2 gap-2">
        {([['scan', 'Scan the items', ScanLine, canScan], ['confirm', 'Confirm without scanning', ClipboardCheck, true]] as const).map(([k, l, Icon, on]) => (
          <button key={k} type="button" disabled={!on} onClick={() => setHow(k)} className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3 text-center text-[14px] font-bold transition ${how === k ? 'border-cyan-600 bg-white text-cyan-800 shadow-sm' : 'border-stone-200 bg-white/60 text-stone-600'} ${on ? '' : 'opacity-40'}`}><Icon size={22} />{l}</button>))}
      </div>
      {!canScan && <p className="text-[13px] text-stone-500">These items cannot be scanned one by one, so confirm the delivery instead.</p>}

      {how === 'scan' && <div className="space-y-3">
        <div><div className="mb-1 flex justify-between text-[14px] font-bold text-stone-700"><span>{got.size} of {scannable.length} scanned</span>{got.size === scannable.length && <span className="text-emerald-600">All scanned</span>}</div>
          <div className="h-2.5 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(got.size / Math.max(1, scannable.length)) * 100}%` }} /></div></div>
        <ScanField label="Scan each item's label" onScan={scan} placeholder="Scan or type a code" />
        {missing.length > 0 && got.size > 0 && <details className="rounded-xl bg-white p-3 text-[13.5px]"><summary className="cursor-pointer font-bold text-amber-700">{missing.length} not scanned yet</summary><div className="mt-2 flex flex-wrap gap-1.5">{missing.slice(0, 200).map((l) => <span key={l.ref} className="mono rounded-md bg-amber-50 px-2 py-1 text-[12px] text-amber-800">{l.label}</span>)}</div></details>}
        {got.size > 0 && got.size < scannable.length && <p className="text-[13px] font-semibold text-amber-700">If you accept now, {scannable.length - got.size} will be reported as missing.</p>}
      </div>}

      {how === 'confirm' && <div className="space-y-3">
        <Field label="How many items did you receive?" hint={`${expected} were sent. A different number is reported as a problem.`}><input value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={`${inputCls} max-w-[200px]`} /></Field>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3.5 text-[14.5px] font-semibold text-stone-800"><input type="checkbox" checked={said} onChange={(e) => setSaid(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-600" /><span>I have scanned and checked the items. The quantity and the items received are correct.</span></label>
      </div>}

      <div className="space-y-3 border-t border-cyan-100 pt-4">
        <Field label="Name of the person receiving" required><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Full name" className={inputCls} /></Field>
        <div><div className="mb-1.5 text-[14px] font-bold text-stone-600">Signature <span className="text-rose-500">*</span></div><SignaturePad onChange={setSig} /></div>
        <Field label="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: one box damaged" className={inputCls} /></Field>
      </div>
      {err && <Notice kind="error" onClose={() => setErr('')}>{err}</Notice>}
      <button disabled={!ready || busy} onClick={() => void submit()} className={`${btnPrimary} flex w-full items-center justify-center gap-2 !py-3.5 text-[16px]`}><CheckCircle2 size={19} />{busy ? 'Saving…' : `Accept delivery${received !== expected ? ` (${received} of ${expected})` : ''}`}</button>
      {!ready && <p className="text-center text-[12.5px] text-stone-400">{how === 'scan' ? 'Scan at least one item' : 'Tick the confirmation'}, enter your name and sign to continue.</p>}
    </div>)
}
