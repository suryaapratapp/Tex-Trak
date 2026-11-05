import { useState } from 'react'
import { Page } from '../components/ui'
import { btnPrimary, inputCls, Notice, Section, useFlash } from './ui'
import { useQr } from './store'
import { useAuth } from '../lib/auth'
import { go } from '../store'

export default function Settings() {
  const { dueDays, setDueDays } = useQr(); const [days, setDays] = useState(String(dueDays)); const { flash, ok, clear } = useFlash(); const role = useAuth((s) => s.user?.role)
  return (
    <Page title="Settings" sub="Curtain tracking">
      <div className="mx-auto max-w-[800px] space-y-6">
        <Section title="Change-due window" sub="How long a product stays in service before it is flagged for change. Applies to new installations.">
          <div className="flex items-center gap-3"><input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} className={`${inputCls} max-w-[200px]`} inputMode="numeric" aria-label="Days" /><span className="text-[14.5px] text-stone-500">days</span><button onClick={() => { setDueDays(+days || 180); ok(`Change-due window set to ${+days || 180} days.`) }} className={btnPrimary}>Save</button></div>
          {flash && <div className="mt-4"><Notice kind={flash.kind} onClose={clear}>{flash.text}</Notice></div>}</Section>
        {role === 'org_admin' && <Section title="People" sub="Create accounts for your fitters and other staff, and choose what each can do."><button onClick={() => go('team')} className={btnPrimary}>Open Team</button></Section>}
      </div>
    </Page>)
}
