import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, ClipboardCheck, ScanLine } from 'lucide-react'
import { feedback } from '../lib/offline'
import { toast } from '../lib/toast'
import { SignaturePad } from '../components/SignaturePad'
import { btnPrimary, inputCls, Notice, ScanField } from '../qr/ui'
import { Scanner } from '../components/Scanner'
import type { Line } from './ShipmentContents'

export interface Receipt { method: 'scan' | 'confirm'; items: number; name: string; signature: string; note: string; scanned: number | null; barcode: string | null }

/** The customer's side: confirm what arrived, by checking it or scanning it. Name and signature, then one big Accept button that stays on screen. */
export function CustomerReceive({ shipRef, expected, lines, checkCode, submit, onDone }: { shipRef: string; expected: number; lines: Line[]; checkCode: (code: string) => Promise<{ item: string | null; error: string | null }>; submit: (r: Receipt) => Promise<string | null>; onDone: () => void }) {
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
  // Any one product's barcode confirms they are holding this delivery. Shipments with no product records have nothing to match.
  const needsCode = lines.some((l) => l.source !== 'typed')
  const [camera, setCamera] = useState(false); const [typed, setTyped] = useState(''); const [proof, setProof] = useState<{ code: string; item: string } | null>(null); const [proofMsg, setProofMsg] = useState(''); const checking = useRef(false)
  const checkProof = async (raw: string) => {
    const code = raw.trim(); if (!code || checking.current) return; checking.current = true; setProofMsg('Checking…')
    const r = await checkCode(code); checking.current = false
    if (r.error) { feedback(false); return setProofMsg('The barcode could not be checked. Check your internet connection and try again.') }
    if (!r.item) { feedback(false); return setProofMsg(`${code} is not a product on this delivery. Check you have the right parcel, then try again.`) }
    feedback(true); setProofMsg(''); setCamera(false); setTyped(''); setProof({ code, item: r.item })
  }
  const received = how === 'scan' ? got.size : all ? expected : Math.max(0, Math.round(Number(count) || 0))
  const codeFor = how === 'scan' ? [...got].map((k) => codes.get(k)!)[0] ?? null : proof?.code ?? null
  const codeOk = !needsCode || received === 0 || !!codeFor
  const counted = how === 'scan' ? got.size > 0 : all || count !== ''
  const ready = counted && codeOk && name.trim().length >= 2 && !!sig
  const showCode = needsCode && how === 'confirm' && received > 0
  const nameStep = showCode ? 3 : 2
  const next = !counted ? (how === 'scan' ? 'First, scan your items (step 1).' : 'First, enter how many arrived (step 1).') : !codeOk ? 'Next, scan one product barcode (step 2).' : name.trim().length < 2 ? `Next, type your name (step ${nameStep}).` : `Now sign in the box (step ${nameStep + 1}).`
  const missing = scannable.length - got.size
  const go = async () => {
    setBusy(true); setErr(''); const e = await submit({ method: how, items: received, name: name.trim(), signature: sig!, note: note.trim(), scanned: how === 'scan' ? got.size : null, barcode: received > 0 ? codeFor : null }); setBusy(false)
    if (e) return setErr(e); toast.ok(received === expected ? `${shipRef} confirmed. Thank you.` : `${shipRef} recorded with ${received} of ${expected} items.`); onDone()
  }
  const unit = `${expected} item${expected === 1 ? '' : 's'}`
  return (
    <div className="mt-4 rounded-3xl border-2 border-cyan-300 bg-white shadow-lg">
      <div className="space-y-4 p-4">
        <div><h3 className="text-[22px] font-extrabold leading-tight text-stone-900">Confirm your delivery</h3><p className="text-[17px] text-stone-700">{unit} {expected === 1 ? 'is' : 'are'} expected. There are {showCode ? 4 : 3} easy steps.</p></div>
        <h4 className="text-[19px] font-extrabold text-stone-900">Step 1. Check what arrived</h4>
        {lines.length > 0 && <ul className="max-h-[280px] divide-y divide-stone-200 overflow-y-auto rounded-2xl border border-stone-200 bg-stone-50 px-3.5">{lines.map((l, i) => <li key={l.source + l.ref} className="flex items-start justify-between gap-3 py-2.5 text-[17px] text-stone-900"><span className="min-w-0 break-words font-semibold">{needsCode && (l.source === 'qr' || l.source === 'rfid') ? `Labelled item ${i + 1}` : l.label}</span>{(l.source === 'wh_order' || l.source === 'wh_goods_out' || l.qty !== 1) && <span className="shrink-0 font-bold">{l.qty} item{l.qty === 1 ? '' : 's'}</span>}</li>)}</ul>}
        {canScan && <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-stone-100 p-1">{([['confirm', 'I checked them', ClipboardCheck], ['scan', 'Scan the items', ScanLine]] as const).map(([k, l, Icon]) => <button key={k} type="button" onClick={() => setHow(k)} className={`flex items-center justify-center gap-1.5 rounded-xl min-h-[52px] px-2 py-2 text-[16px] font-bold ${how === k ? 'bg-white text-cyan-800 shadow-sm' : 'text-stone-700'}`}><Icon size={18} />{l}</button>)}</div>}

        {how === 'confirm' && <div className="space-y-2">
          <button type="button" onClick={() => setAll(true)} className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left ${all ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 bg-white'}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${all ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-stone-300'}`}>{all && <CheckCircle2 size={16} />}</span><span className="text-[18px] font-extrabold text-stone-900">{expected === 1 ? 'The item arrived' : `All ${expected} items arrived`}</span></button>
          <button type="button" onClick={() => setAll(false)} className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left ${!all ? 'border-amber-500 bg-amber-50' : 'border-stone-200 bg-white'}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${!all ? 'border-amber-500 bg-amber-500 text-white' : 'border-stone-300'}`}>{!all && <CheckCircle2 size={16} />}</span><span className="text-[18px] font-extrabold text-stone-900">A different number arrived</span></button>
          {!all && <div className="flex items-center gap-3 px-1"><label htmlFor="cr-n" className="text-[17px] font-bold text-stone-900">How many arrived?</label><input id="cr-n" autoFocus value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={`${inputCls} !w-24 text-center text-[18px] font-bold`} /><span className="text-[16px] text-stone-600">of {expected}</span></div>}
        </div>}

        {showCode && <div className="space-y-2.5 border-t border-stone-100 pt-3">
          <h4 className="text-[19px] font-extrabold text-stone-900">Step 2. Scan one product barcode</h4>
          {proof ? <div className="flex items-start gap-2.5 rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-3.5"><CheckCircle2 size={24} className="mt-0.5 shrink-0 text-emerald-600" /><div className="min-w-0 flex-1"><div className="text-[18px] font-extrabold text-stone-900">Barcode matches</div><div className="text-[16px] text-stone-800">{proof.item} <span className="mono break-all">({proof.code})</span></div><button type="button" onClick={() => setProof(null)} className="mt-1 min-h-[44px] text-[16px] font-bold text-cyan-800">Scan a different one</button></div></div>
            : <><p className="text-[17px] text-stone-700">Take any one product from this delivery and scan the barcode on its label. One is enough.</p>
              {camera ? <div><Scanner autoStart onScan={(c) => void checkProof(c)} /><button type="button" onClick={() => setCamera(false)} className="mt-2 min-h-[48px] w-full rounded-2xl border-2 border-stone-300 bg-white text-[17px] font-bold text-stone-800">Close camera</button></div>
                : <button type="button" onClick={() => { setProofMsg(''); setCamera(true) }} className="flex min-h-[64px] w-full items-center justify-center gap-2.5 rounded-2xl bg-stone-900 px-4 text-[19px] font-bold text-white"><ScanLine size={22} />Scan with camera</button>}
              {proofMsg && <p role="status" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[17px] font-semibold text-amber-900">{proofMsg}</p>}
              <form onSubmit={(e) => { e.preventDefault(); void checkProof(typed) }}><label htmlFor="cr-code" className="mb-1.5 block text-[16px] font-bold text-stone-800">Camera not working? Type the number under the barcode</label>
                <div className="flex gap-2"><input id="cr-code" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" className={`${inputCls} min-w-0 !h-14 !border-2 !border-stone-300 !text-[18px]`} /><button disabled={!typed.trim()} className="h-14 shrink-0 rounded-2xl border-2 border-cyan-300 bg-white px-5 text-[17px] font-bold text-cyan-900 disabled:border-stone-300 disabled:text-stone-500">Check</button></div></form></>}
        </div>}

        {how === 'scan' && <div className="space-y-3">
          <div><div className="mb-1 flex justify-between text-[14px] font-bold text-stone-700"><span>{got.size} of {scannable.length} scanned</span>{got.size === scannable.length && <span className="text-emerald-600">All scanned</span>}</div>
            <div className="h-2.5 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(got.size / Math.max(1, scannable.length)) * 100}%` }} /></div></div>
          <ScanField label="Scan each label" onScan={scan} placeholder="Scan or type a code" />
          {got.size > 0 && missing > 0 && <p className="text-[16px] font-semibold text-amber-800">{missing} not scanned yet. If you accept now they are reported as missing.</p>}
        </div>}

        <div className="space-y-3 border-t border-stone-100 pt-3">
          <label className="block"><span className="mb-2 block text-[19px] font-extrabold text-stone-900">Step {nameStep}. Type your name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your full name" className={`${inputCls} !h-14 !border-2 !border-stone-300 !text-[19px]`} /></label>
          <div><div className="mb-1 text-[19px] font-extrabold text-stone-900">Step {nameStep + 1}. Sign in the box</div><p className="mb-2 text-[16px] text-stone-700">Use your finger.</p><SignaturePad onChange={setSig} height={170} /></div>
          {showNote ? <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: one box damaged" aria-label="Note" className={`${inputCls} !h-14 !text-[17px]`} /> : <button type="button" onClick={() => setShowNote(true)} className="min-h-[48px] text-[17px] font-bold text-cyan-800">+ Add a note (for example, if something is damaged)</button>}
          <p className="text-[15px] leading-snug text-stone-600">By signing, I confirm I have checked the items and that the quantity and items received are correct.</p>
        </div>
        {err && <Notice kind="error" onClose={() => setErr('')}>{err}</Notice>}
      </div>
      <div className={`rounded-b-[22px] border-t border-stone-200 bg-white/95 p-3 backdrop-blur ${ready ? 'sticky bottom-0 z-10' : ''}`}>
        <button disabled={!ready || busy} onClick={() => void go()} className={`flex min-h-[64px] w-full items-center justify-center gap-2 text-[19px] ${ready ? btnPrimary : 'cursor-not-allowed rounded-2xl border-2 border-stone-300 bg-stone-100 px-4 py-3 font-bold text-stone-700'}`}><CheckCircle2 size={22} className="shrink-0" />{busy ? 'Saving…' : received === expected || !ready ? 'Accept delivery' : `Accept ${received} of ${expected}`}</button>
        {!ready && <p role="status" className="mt-2 text-center text-[17px] font-semibold text-stone-800">{next}</p>}
      </div>
    </div>)
}
