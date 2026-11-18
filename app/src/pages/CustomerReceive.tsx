import { useMemo, useState } from 'react'
import { CheckCircle2, ClipboardCheck, ScanLine } from 'lucide-react'
import { feedback } from '../lib/offline'
import { toast } from '../lib/toast'
import { SignaturePad } from '../components/SignaturePad'
import { btnPrimary, inputCls, Notice, ScanField } from '../qr/ui'
import type { Line } from './ShipmentContents'

export interface Receipt { method: 'scan' | 'confirm'; items: number; name: string; signature: string; note: string; scanned: number | null }

/** The customer's side: confirm what arrived, by checking it or scanning it. Name and signature, then one big Accept button that stays on screen. */
export function CustomerReceive({ shipRef, expected, lines, submit, onDone }: { shipRef: string; expected: number; lines: Line[]; submit: (r: Receipt) => Promise<string | null>; onDone: () => void }) {
  const scannable = lines.filter((l) => l.source === 'qr' || l.source === 'rfid')
  const canScan = scannable.length > 0 && scannable.reduce((n, l) => n + l.qty, 0) === expected
  const [how, setHow] = useState<'scan' | 'confirm'>('confirm'); const [all, setAll] = useState(true); const [count, setCount] = useState(String(expected)); const [got, setGot] = useState<Set<string>>(new Set())
  const [name, setName] = useState(''); const [sig, setSig] = useState<string | null>(null); const [note, setNote] = useState(''); const [showNote, setShowNote] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const codes = useMemo(() => new Map(scannable.map((l) => [l.label.trim().toUpperCase(), l.label])), [scannable])
  const scan = (raw: string) => {
    const c = raw.trim().toUpperCase(); if (!c) return
    if (!codes.has(c)) { feedback(false); return toast.error(`${raw.trim()} is not on this delivery.`) }
    if (got.has(c)) { feedback(false); return toast.info(`${codes.get(c)} was already scanned.`) }
    feedback(true); setGot((g) => new Set(g).add(c))
  }
  const received = how === 'scan' ? got.size : all ? expected : Math.max(0, Math.round(Number(count) || 0))
  const ready = name.trim().length >= 2 && !!sig && (how === 'scan' ? got.size > 0 : all || count !== '')
  const missing = scannable.length - got.size
  const go = async () => {
    setBusy(true); setErr(''); const e = await submit({ method: how, items: received, name: name.trim(), signature: sig!, note: note.trim(), scanned: how === 'scan' ? got.size : null }); setBusy(false)
    if (e) return setErr(e); toast.ok(received === expected ? `${shipRef} confirmed. Thank you.` : `${shipRef} recorded with ${received} of ${expected} items.`); onDone()
  }
  const unit = `${expected} item${expected === 1 ? '' : 's'}`
  return (
    <div className="mt-4 rounded-3xl border-2 border-cyan-300 bg-white shadow-lg">
      <div className="space-y-4 p-4">
        <div><h3 className="text-[19px] font-extrabold leading-tight text-stone-900">Confirm your delivery</h3><p className="text-[14px] text-stone-500">{unit} {expected === 1 ? 'is' : 'are'} expected. Check {expected === 1 ? 'it' : 'them'}, then sign.</p></div>
        {canScan && <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-stone-100 p-1">{([['confirm', 'I checked them', ClipboardCheck], ['scan', 'Scan the items', ScanLine]] as const).map(([k, l, Icon]) => <button key={k} type="button" onClick={() => setHow(k)} className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[13.5px] font-bold ${how === k ? 'bg-white text-cyan-800 shadow-sm' : 'text-stone-500'}`}><Icon size={16} />{l}</button>)}</div>}

        {how === 'confirm' && <div className="space-y-2">
          <button type="button" onClick={() => setAll(true)} className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left ${all ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 bg-white'}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${all ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-stone-300'}`}>{all && <CheckCircle2 size={16} />}</span><span className="text-[16px] font-extrabold text-stone-900">{expected === 1 ? 'The item arrived' : `All ${expected} items arrived`}</span></button>
          <button type="button" onClick={() => setAll(false)} className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left ${!all ? 'border-amber-500 bg-amber-50' : 'border-stone-200 bg-white'}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${!all ? 'border-amber-500 bg-amber-500 text-white' : 'border-stone-300'}`}>{!all && <CheckCircle2 size={16} />}</span><span className="text-[16px] font-extrabold text-stone-900">A different number arrived</span></button>
          {!all && <div className="flex items-center gap-3 px-1"><label htmlFor="cr-n" className="text-[14.5px] font-bold text-stone-700">How many arrived?</label><input id="cr-n" autoFocus value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={`${inputCls} !w-24 text-center text-[18px] font-bold`} /><span className="text-[13px] text-stone-400">of {expected}</span></div>}
        </div>}

        {how === 'scan' && <div className="space-y-3">
          <div><div className="mb-1 flex justify-between text-[14px] font-bold text-stone-700"><span>{got.size} of {scannable.length} scanned</span>{got.size === scannable.length && <span className="text-emerald-600">All scanned</span>}</div>
            <div className="h-2.5 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(got.size / Math.max(1, scannable.length)) * 100}%` }} /></div></div>
          <ScanField label="Scan each label" onScan={scan} placeholder="Scan or type a code" />
          {got.size > 0 && missing > 0 && <p className="text-[13px] font-semibold text-amber-700">{missing} not scanned yet. If you accept now they are reported as missing.</p>}
        </div>}

        <div className="space-y-3 border-t border-stone-100 pt-3">
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your full name" aria-label="Your full name" className={`${inputCls} text-[16px]`} />
          <SignaturePad onChange={setSig} height={120} />
          {showNote ? <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: one box damaged" aria-label="Note" className={inputCls} /> : <button type="button" onClick={() => setShowNote(true)} className="text-[13.5px] font-bold text-cyan-700">+ Add a note</button>}
          <p className="text-[12px] leading-snug text-stone-400">By signing, I confirm I have checked the items and that the quantity and items received are correct.</p>
        </div>
        {err && <Notice kind="error" onClose={() => setErr('')}>{err}</Notice>}
      </div>
      <div className="sticky bottom-0 z-10 rounded-b-[22px] border-t border-stone-200 bg-white/95 p-3 backdrop-blur">
        <button disabled={!ready || busy} onClick={() => void go()} className={`${btnPrimary} flex w-full items-center justify-center gap-2 !py-4 text-[17px]`}><CheckCircle2 size={21} />{busy ? 'Saving…' : ready ? (received === expected ? 'Accept delivery' : `Accept ${received} of ${expected}`) : (name.trim().length < 2 ? 'Enter your name to accept' : 'Sign above to accept')}</button>
      </div>
    </div>)
}
