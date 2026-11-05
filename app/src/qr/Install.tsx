import { useState } from 'react'
import { Page } from '../components/ui'
import { EMPTY, LocationPicker, Notice, ScanField, Section, toPlace, useFlash, type Pick } from './ui'
import { fmtDateTime, placeText, useQr } from './store'

export default function Install() {
  const st = useQr(); const [loc, setLoc] = useState<Pick>(EMPTY); const { flash, ok, err, clear } = useFlash(); const [done, setDone] = useState<{ code: string; where: string; ts: number }[]>([])
  const place = toPlace(loc)
  const scan = (code: string) => {
    if (!place) return err('Choose the hospital first.')
    const r = st.install(code, place); if (!r.ok) return err(r.message)
    ok(r.message); setDone((d) => [{ code: code.trim().toUpperCase(), where: placeText(useQr.getState(), place), ts: Date.now() }, ...d])
  }
  return (
    <Page title="Install" sub="New curtains">
      <div className="mx-auto grid max-w-[1100px] gap-6 lg:grid-cols-2">
        <Section title="Where are you working?"><LocationPicker value={loc} onChange={(v) => { setLoc(v); clear() }} /></Section>
        <div className="space-y-6">
          <Section><ScanField label="Scan the new curtain" onScan={scan} disabled={!place} />{!place && <p className="mt-3 text-[13.5px] text-stone-400">Choose a hospital to start scanning.</p>}</Section>
          {flash && <Notice kind={flash.kind} onClose={clear}>{flash.text}</Notice>}
          {done.length > 0 && <Section title={`Installed this session (${done.length})`}><ul className="divide-y divide-stone-100">{done.map((d, i) => <li key={i} className="flex items-center justify-between gap-3 py-3"><div><div className="mono text-[15px] font-bold">{d.code}</div><div className="text-[13.5px] text-stone-500">{d.where}</div></div><span className="text-[13px] text-stone-400">{fmtDateTime(d.ts)}</span></li>)}</ul></Section>}
        </div>
      </div>
    </Page>)
}
