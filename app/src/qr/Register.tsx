import { useState } from 'react'
import { Page } from '../components/ui'
import { btnGhost, Field, inputCls, Notice, ScanField, Section, useFlash } from './ui'
import { useQr } from './store'

export default function Register() {
  const reg = useQr((s) => s.register); const [meta, setMeta] = useState({ batch: '', size: '', colour: '', dueDays: '7' }); const [done, setDone] = useState<string[]>([]); const [list, setList] = useState(false); const [text, setText] = useState(''); const { flash, ok, err, clear } = useFlash()
  const add = (codes: string[]) => { const r = reg(codes, { ...meta, dueDays: +meta.dueDays || 7 }); if (r.added.length) { setDone((d) => [...r.added, ...d]); ok(`${r.added.length} registered${r.skipped.length ? `, ${r.skipped.length} already on the system` : ''}`) } else err(`${r.skipped[0] ?? 'That code'} is already on the system.`) }
  return (
    <Page title="Register labels" sub="Bring newly labelled products onto the system">
      <div className="mx-auto max-w-[1000px] space-y-6">
        <Section title="Batch details" sub="Applied to everything you register in this run.">
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Batch reference"><input value={meta.batch} onChange={(e) => setMeta({ ...meta, batch: e.target.value })} placeholder="e.g. B-2026-08" className={inputCls} /></Field><Field label="Size"><input value={meta.size} onChange={(e) => setMeta({ ...meta, size: e.target.value })} placeholder="e.g. 3000 x 2000" className={inputCls} /></Field><Field label="Change due after (days)" hint="How long each one stays up before it is flagged for change. Default 7."><input value={meta.dueDays} onChange={(e) => setMeta({ ...meta, dueDays: e.target.value.replace(/\D/g, '') })} inputMode="numeric" className={inputCls} /></Field><Field label="Colour"><input value={meta.colour} onChange={(e) => setMeta({ ...meta, colour: e.target.value })} placeholder="e.g. Sky Blue" className={inputCls} /></Field></div></Section>
        <Section title="Scan each label">
          {!list ? <><ScanField label="Scan or type the QR / barcode" onScan={(c) => add([c])} /><button onClick={() => setList(true)} className="mt-4 text-[14.5px] font-bold text-cyan-700 underline underline-offset-4">Register a list of codes instead</button></>
            : <><Field label="Paste codes, one per line or separated by commas"><textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className={`${inputCls} h-auto py-3`} /></Field><div className="mt-4 flex gap-3"><button onClick={() => { add(text.split(/[\s,;]+/)); setText('') }} disabled={!text.trim()} className="rounded-2xl bg-cyan-600 px-6 py-3 font-bold text-white disabled:bg-stone-200 disabled:text-stone-400">Register list</button><button onClick={() => setList(false)} className={btnGhost}>Back to scanning</button></div></>}
          {flash && <div className="mt-4"><Notice kind={flash.kind} onClose={clear}>{flash.text}</Notice></div>}
        </Section>
        <Section title={`Registered this session (${done.length})`}>{done.length === 0 ? <div className="py-8 text-center"><div className="text-[17px] font-extrabold text-stone-900">Nothing registered yet</div><div className="mt-1 text-[14px] text-stone-500">Scanned labels will appear here.</div></div> : <ul className="divide-y divide-stone-100">{done.slice(0, 100).map((c, i) => <li key={i} className="mono py-2.5 text-[15px] font-bold">{c}</li>)}</ul>}</Section>
      </div>
    </Page>)
}
