import { useState } from 'react'
import { Page } from '../components/ui'
import { btnPrimary, EMPTY, inputCls, LocationPicker, Notice, ScanField, Section, toPlace, useFlash, Field, type Pick } from './ui'
import { REASONS, placeText, useQr, type Place, type Reason } from './store'
import { ScanLog } from './ScanLog'

interface Pending { code: string; place?: Place }
export default function Takedown() {
  const st = useQr(); const [mode, setMode] = useState<'scan' | 'location'>('scan'); const [reason, setReason] = useState<Reason>('expired'); const [note, setNote] = useState(''); const [showNote, setShowNote] = useState(false)
  const [loc, setLoc] = useState<Pick>(EMPTY); const [sel, setSel] = useState<Set<string>>(new Set()); const [pending, setPending] = useState<Pending[]>([]); const [swaps, setSwaps] = useState<{ n: string; o: string; w: string }[]>([]); const { flash, ok, err, clear } = useFlash()
  const place = toPlace(loc)
  const here = Object.values(st.products).filter((p) => p.status === 'in_use' && p.place && place && p.place.hospitalId === place.hospitalId && (!place.floor || p.place.floor === place.floor) && (!place.ward || p.place.ward === place.ward) && (!place.bay || p.place.bay === place.bay))
  const down = async (code: string) => { const r = await st.takeDown(code, reason, note); if (!r.ok) { err(r.message); return false } setPending((p) => [...p, { code: code.trim().toUpperCase(), place: r.place }]); return true }
  const scanOld = async (c: string) => { if (await down(c)) { ok(`${c.toUpperCase()} taken down. Now scan its replacement.`); setNote('') } }
  const scanNew = async (c: string) => {
    const target = pending[0]; if (!target?.place) return err('Nothing is waiting for a replacement.')
    const r = await useQr.getState().install(c, target.place, { replaces: target.code }); if (!r.ok) return err(r.message)
    ok(r.message + (r.queued ? ' · saved on this phone' : '')); setSwaps((s) => [{ n: c.trim().toUpperCase(), o: target.code, w: placeText(useQr.getState(), target.place) }, ...s]); setPending((p) => p.slice(1))
  }
  const takeSelected = async () => { let n = 0; for (const code of sel) { if (await down(code)) n++ } setSel(new Set()); if (n) ok(`${n} taken down. Scan a replacement for each.`) }
  return (
    <Page title="Take down" sub="Remove the old curtain, then scan the new one">
      <div className="mx-auto max-w-[900px] space-y-6">
        <Section>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Method"><select value={mode} onChange={(e) => { setMode(e.target.value as 'scan' | 'location'); clear() }} className={inputCls}><option value="scan">By scan</option><option value="location">By location</option></select></Field>
            <Field label="Reason"><select value={reason} onChange={(e) => setReason(e.target.value as Reason)} className={inputCls}>{REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Field></div>
          {showNote ? <div className="mt-4"><Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything worth recording" className={inputCls} /></Field></div> : <button onClick={() => setShowNote(true)} className="mt-4 text-[14.5px] font-bold text-cyan-700 underline underline-offset-4">+ Add a note</button>}
        </Section>
        {mode === 'scan' && <Section><ScanField label="Scan the old curtain" onScan={scanOld} /></Section>}
        {mode === 'location' && <Section title="Where are you working?"><LocationPicker value={loc} onChange={(v) => { setLoc(v); setSel(new Set()) }} />
          {place && <div className="mt-5"><div className="mb-2 text-[13px] font-bold uppercase tracking-wider text-stone-400">Installed here ({here.length})</div>
            {here.length === 0 ? <p className="text-[14px] text-stone-400">Nothing is installed here.</p> : <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-100">{here.map((p) => <li key={p.code}><label className="flex cursor-pointer items-center gap-3 px-4 py-3"><input type="checkbox" checked={sel.has(p.code)} onChange={() => setSel((s) => { const n = new Set(s); n.has(p.code) ? n.delete(p.code) : n.add(p.code); return n })} className="h-5 w-5 accent-cyan-600" /><span className="flex-1"><span className="mono block text-[15px] font-bold">{p.code}</span><span className="text-[13px] text-stone-500">{[p.place?.ward, p.place?.bay].filter(Boolean).join(' · ')}</span></span></label></li>)}</ul>}
            <button disabled={!sel.size} onClick={takeSelected} className={`${btnPrimary} mt-4 w-full`}>Take down {sel.size || ''} selected</button></div>}</Section>}
        {pending.length > 0 && <Section title="Hang a replacement?" sub={`${pending.length} waiting. The new curtain goes exactly where the old one was.`}>
          <ul className="mb-5 space-y-2">{pending.map((p) => <li key={p.code} className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 text-[14px]"><span className="mono font-bold text-amber-900">{p.code}</span><span className="text-amber-800">{placeText(st, p.place)}</span></li>)}</ul>
          <ScanField label="Scan the new curtain" onScan={scanNew} /><button onClick={() => setPending([])} className="mt-4 text-[14px] font-bold text-stone-500 underline underline-offset-4">Skip replacements</button></Section>}
        {flash && <Notice kind={flash.kind} onClose={clear}>{flash.text}</Notice>}
        <ScanLog kinds={['takedown', 'install']} />

      </div>
    </Page>)
}
