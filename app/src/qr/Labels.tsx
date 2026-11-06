import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Printer } from 'lucide-react'
import { Page } from '../components/ui'
import { go } from '../store'
import { QrImg } from '../components/QrImg'
import { btnPrimary, btnGhost, Field, inputCls, Notice, Section } from './ui'
import { batchCodes, capacity, DEFAULT_FORMAT, serialCode, seriesKey, useQr, type Batch } from './store'

const CHIPS = [100, 500, 1000, 5000, 10000, 50000]
const Num = ({ n, c }: { n: number; c: string }) => <span className="mr-3 inline-grid h-7 w-7 place-items-center rounded-full text-[13px] font-extrabold text-white" style={{ background: c }}>{n}</span>

function Sheet({ batch, sheet, onDone }: { batch: Batch; sheet: number; onDone: () => void }) {
  const codes = batchCodes(batch, sheet * 500, 500)
  useEffect(() => { const t = setTimeout(() => { window.print(); onDone() }, 700); return () => clearTimeout(t) }, [onDone])
  return createPortal(<div className="print-only"><style>{`@page{margin:8mm}`}</style><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,28mm)', gap: '1mm' }}>{codes.map((c) => <div key={c} style={{ width: '28mm', height: '34mm', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '0.2mm solid #cbd5e1', breakInside: 'avoid' }}><QrImg text={c} size={86} /><div style={{ fontFamily: 'monospace', fontSize: '5.6pt', marginTop: '1mm' }}>{c}</div></div>)}</div></div>, document.body)
}

export default function Labels() {
  const { format, counters, setFormat, generate, batches } = useQr()
  const [product, setProduct] = useState('MVN191'); const [name, setName] = useState('Curtain'); const [count, setCount] = useState(500); const [register, setRegister] = useState<boolean | null>(null)
  const [draft, setDraft] = useState(format); const [msg, setMsg] = useState(''); const [dueDays, setDueDays] = useState('7'); const [bad, setBad] = useState(false); const [printing, setPrinting] = useState<{ b: Batch; sheet: number } | null>(null); const [sheet, setSheet] = useState(0)
  const saved = draft.prefix === format.prefix && draft.letters === format.letters && draft.digits === format.digits
  const validPrefix = /^[A-Z0-9]{3,10}$/.test(draft.prefix); const room = capacity(draft)
  const next = (counters[seriesKey(draft, product)] ?? 0) + 1; const sample = `${draft.prefix}-${product}-${serialCode(next, draft)}`
  const cap = 50000; const n = Math.min(Math.max(1, count || 0), cap)
  const gen = async () => { if (register === null || !saved) return; setBad(false); const r = await generate(product, name, n, register, +dueDays || 7); if (r.error || !r.batch) { setBad(true); return setMsg(r.error ?? 'Something went wrong.') }; setMsg(`${r.batch.count.toLocaleString('en-GB')} codes issued: ${r.batch.first} to ${r.batch.last}`); setSheet(0) }
  useEffect(() => { setDraft(format) }, [format])
  const last = batches[0]
  const csv = (b: Batch) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['Code\n' + batchCodes(b).join('\n')], { type: 'text/csv' })); a.download = `labels-${b.first}-${b.last}.csv`; a.click() }
  void DEFAULT_FORMAT
  return (
    <Page title="Generate QR codes" sub="Make a batch of label codes to print or export" right={<button onClick={() => go('qrregister')} className="rounded-lg border border-stone-200 bg-white px-5 py-3 text-[14.5px] font-medium text-stone-700 hover:bg-stone-50">Back to Register labels</button>}>
      <div className="mx-auto max-w-[900px] space-y-6">
        <Section title={<span className="flex items-center"><Num n={1} c="#5340e0" />What are you labelling?</span>}>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Product code" hint="The middle block of the code. Letters and digits only."><input value={product} onChange={(e) => setProduct(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} className={inputCls} /></Field><Field label="Product name" hint="For reporting; not part of the code."><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field></div>
          <div className="mt-4 max-w-sm"><Field label="How many labels?" hint={`Up to ${cap.toLocaleString('en-GB')} in one run. Each number is issued once, ever.`}><input type="number" min={1} max={50000} value={count} onChange={(e) => setCount(+e.target.value)} className={inputCls} /></Field></div>
          <div className="mt-3 flex flex-wrap gap-2">{CHIPS.map((c) => <button key={c} onClick={() => setCount(c)} className={`rounded-full px-4 py-1.5 text-[14px] font-bold ${count === c ? 'bg-cyan-600 text-white' : 'border border-stone-200 bg-white text-stone-700'}`}>{c.toLocaleString('en-GB')}</button>)}</div>
          <details className="mt-5 border-t border-stone-100 pt-4"><summary className="cursor-pointer text-[14.5px] font-bold text-cyan-700">Optional details for this run</summary><div className="mt-3 max-w-xs"><Field label="Change due after (days)" hint="How long each one stays up before it is flagged. Default 7."><input value={dueDays} onChange={(e) => setDueDays(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={inputCls} /></Field></div></details>
        </Section>
        <Section title={<span className="flex items-center"><Num n={2} c="#0e8f7e" />Check the format</span>}>
          <div className="flex flex-wrap items-center gap-5"><QrImg text={sample} size={110} /><div className="min-w-0 flex-1 text-[14.5px] text-stone-600">Codes look like <code className="mono rounded bg-stone-100 px-2 py-0.5 text-[13px]">{sample}</code>: the prefix <b>{draft.prefix}</b>, the product code, then {draft.letters} letter{draft.letters > 1 ? 's' : ''} and {draft.digits} digit{draft.digits > 1 ? 's' : ''}.<p className="mt-2 text-[13.5px] text-stone-400">Codes are issued in ascending order and reserved as they are generated. A number is never issued twice, whatever happens to the product afterwards.</p></div></div>
          <div className="mt-5 grid gap-4 border-t border-stone-100 pt-5 sm:grid-cols-3"><Field label="Prefix" hint="3–10 letters or digits at the start of every code."><input value={draft.prefix} onChange={(e) => setDraft({ ...draft, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) })} className={inputCls} /></Field>
            <Field label="Letters"><select value={draft.letters} onChange={(e) => setDraft({ ...draft, letters: +e.target.value })} className={inputCls}>{[1, 2, 3, 4, 5, 6].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Digits"><select value={draft.digits} onChange={(e) => setDraft({ ...draft, digits: +e.target.value })} className={inputCls}>{[1, 2, 3, 4, 5, 6, 7, 8].map((x) => <option key={x}>{x}</option>)}</select></Field></div>
          <p className={`mt-3 text-[14px] ${room < 10000 ? 'text-rose-600' : 'text-stone-500'}`}>{room < 10000 ? 'Too small: formats must allow at least 10,000 codes.' : `Room for ${room.toLocaleString('en-GB')} codes per product.`}</p>
          <p className="mt-2 text-[13.5px] text-stone-400">A new prefix or format applies to labels generated from now on. Labels already printed keep working: every earlier prefix is still accepted. Each prefix and format counts up from its own start, so no code is ever issued twice.</p>
          <button disabled={saved || !validPrefix || room < 10000} onClick={async () => { const r = await setFormat(draft); if (!r.ok) { setBad(true); setMsg(r.message) } }} className={`${btnPrimary} mt-4 w-full`}>{saved ? 'Format is saved' : 'Save format'}</button>
          <div className="mt-6"><div className="mb-2 text-[14px] font-bold text-stone-700">Register these labels in Tex-Trak? <b className="text-rose-500">*</b></div>
            <div className="space-y-3">{([[true, 'Yes, register them', 'Fitters can install and track them'], [false, 'No, just make the codes', 'For printing elsewhere. Numbers are reserved, nothing is registered']] as const).map(([v, t, h]) => <button key={String(v)} onClick={() => setRegister(v)} className={`w-full rounded-2xl border p-4 text-left transition ${register === v ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-100' : 'border-stone-200 bg-white hover:bg-stone-50'}`}><div className="text-[15px] font-bold text-stone-900">{t}</div><div className="text-[13.5px] text-stone-500">{h}</div></button>)}</div>
            </div>
          <button disabled={register === null || !saved} onClick={gen} className={`${btnPrimary} mt-5 w-full`}>{register === null ? 'Choose yes or no above' : `Generate ${n.toLocaleString('en-GB')} labels`}</button>
        </Section>
        <Section title={<span className="flex items-center"><Num n={3} c="#d9622b" />Print or export</span>}>
          {!last ? <div className="py-8 text-center"><div className="text-[17px] font-extrabold text-stone-900">No labels generated yet</div><div className="mt-1 text-[14px] text-stone-500">Generated codes appear here, ready to download or print.</div></div> : <div className="space-y-5">
            {msg && <Notice kind={bad ? 'error' : 'ok'}>{msg}</Notice>}
            <div className="flex flex-wrap items-center gap-3"><button onClick={() => csv(last)} className={`${btnGhost} flex items-center gap-2`}><Download size={16} /> Download CSV</button>
              {last.count > 500 && <select value={sheet} onChange={(e) => setSheet(+e.target.value)} className="h-12 rounded-2xl border border-stone-200 bg-white px-4 text-[14.5px] font-semibold">{Array.from({ length: Math.ceil(Math.min(last.count, 5000) / 500) }, (_, i) => <option key={i} value={i}>Sheet {i + 1} ({i * 500 + 1}–{Math.min(last.count, i * 500 + 500)})</option>)}</select>}
              <button onClick={() => setPrinting({ b: last, sheet })} className={`${btnPrimary} flex items-center gap-2`}><Printer size={16} /> Print sheet (28 × 34 mm labels)</button></div>
            <div><div className="mb-2 text-[13px] font-bold uppercase tracking-wider text-stone-400">Recent batches</div><ul className="divide-y divide-stone-100">{batches.map((b) => <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-[14px]"><span><span className="mono font-bold">{b.first}</span> to <span className="mono font-bold">{b.last}</span><span className="block text-stone-500">{b.count.toLocaleString('en-GB')} × {b.name} · {b.registered ? 'registered' : 'codes only'} · {new Date(b.ts).toLocaleDateString('en-GB')}</span></span><button onClick={() => csv(b)} className="text-[13.5px] font-bold text-cyan-700 hover:underline">CSV</button></li>)}</ul></div></div>}
        </Section>
      </div>
      {printing && <Sheet batch={printing.b} sheet={printing.sheet} onDone={() => setPrinting(null)} />}
    </Page>)
}
