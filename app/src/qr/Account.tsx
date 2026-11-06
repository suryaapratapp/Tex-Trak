import { useState } from 'react'
import { Page } from '../components/ui'
import { btnPrimary, Field, inputCls, Notice, Section } from './ui'
import { ROLE_LABEL, useAuth } from '../lib/auth'
import { PasswordInput } from '../components/PasswordInput'
import { isNative } from '../lib/offline'
import { hasPin, removePin, setPin } from '../lib/pin'
import { giveConsent, openLocationSettings, startTracking, useTracking } from '../native/tracking'
import { FEATURES } from '../sim/features'

export default function Account(): React.ReactElement {
  const { user, orgs, changePassword } = useAuth(); const tr = useTracking(); const [pin, setP] = useState(''); const [pinMsg, setPinMsg] = useState(''); const [f, setF] = useState({ cur: '', next: '', rep: '' }); const [m, setM] = useState<{ k: 'ok' | 'error'; t: string } | null>(null)
  if (!user) return <></>
  const org = orgs.find((o) => o.id === user.org_id)
  const can = user.role === 'superadmin' ? 'Everything on the platform' : user.role === 'org_admin' ? `All ${org?.features.length ?? 0} of ${org?.name}’s features, and managing the team` : `${user.features.length} features: ${FEATURES.filter((x) => user.features.includes(x.id)).map((x) => x.label).join(', ') || 'none yet'}`
  const rows: [string, string][] = [['Username', user.username], ['Name', user.full_name], ['Access level', ROLE_LABEL[user.role]], ...(org ? [['Organisation', org.name] as [string, string]] : []), ['Can use', can]]
  const submit = async () => { if (f.next !== f.rep) return setM({ k: 'error', t: 'The new passwords do not match.' }); const e = await changePassword(f.cur, f.next); if (e) return setM({ k: 'error', t: e }); setM({ k: 'ok', t: 'Password changed. You stay signed in on this device.' }); setF({ cur: '', next: '', rep: '' }) }
  return (
    <Page title="My account" sub="Your sign-in details">
      <div className="mx-auto max-w-[800px] space-y-6">
        <Section title="Signed in as"><dl className="divide-y divide-stone-100">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-6 py-3.5 text-[15px]"><dt className="shrink-0 text-stone-500">{k}</dt><dd className="text-right font-bold text-stone-900">{v}</dd></div>)}</dl></Section>
        {isNative && <Section title="This phone" sub="Location and quick PIN">
          <dl className="divide-y divide-stone-100 text-[15px]"><div className="flex justify-between py-3"><dt className="text-stone-500">Name in the tracker list</dt><dd className="font-semibold text-stone-900">{user.username}</dd></div>
            <div className="flex justify-between py-3"><dt className="text-stone-500">Location recording</dt><dd className={`font-semibold ${tr.state === 'on' ? 'text-emerald-600' : 'text-amber-700'}`}>{{ on: 'On', off: 'Off', starting: 'Starting…', denied: 'Blocked in settings', error: 'Problem' }[tr.state]}</dd></div>
            <div className="flex justify-between py-3"><dt className="text-stone-500">Locations waiting to send</dt><dd className="font-semibold text-stone-900">{tr.queued}</dd></div></dl>
          <div className="mt-4 flex flex-wrap gap-2">{!tr.consent && <button onClick={async () => { await giveConsent(user.id); await startTracking(user) }} className={btnPrimary}>Turn on location</button>}{tr.state === 'denied' && <button onClick={openLocationSettings} className={btnPrimary}>Open settings</button>}</div>
          <div className="mt-6 border-t border-stone-100 pt-5"><div className="text-[15px] font-semibold text-stone-900">Quick PIN {hasPin(user.id) ? '(on)' : '(off)'}</div><p className="mt-1 text-[14px] text-stone-500">Opens the app without a connection.</p>
            <div className="mt-3 flex gap-2"><input value={pin} onChange={(e) => { setP(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinMsg('') }} inputMode="numeric" type="password" placeholder="4 to 6 digits" className="h-12 w-44 rounded-lg border border-stone-200 px-4 text-[16px]" /><button disabled={pin.length < 4} onClick={async () => { await setPin(user.id, pin); setP(''); setPinMsg('PIN saved.') }} className={btnPrimary}>Save</button>{hasPin(user.id) && <button onClick={() => { removePin(); setPinMsg('PIN removed.') }} className="rounded-lg border border-stone-200 px-4 text-[14px] font-medium text-stone-600">Remove</button>}</div>
            {pinMsg && <p className="mt-2 text-[13.5px] text-emerald-700">{pinMsg}</p>}</div></Section>}
        <Section title="Change password" sub="Use at least 8 characters.">
          <div className="space-y-4"><Field label="Current password"><PasswordInput value={f.cur} onChange={(v) => setF({ ...f, cur: v })} autoComplete="current-password" /></Field><Field label="New password"><PasswordInput value={f.next} onChange={(v) => setF({ ...f, next: v })} autoComplete="new-password" /></Field><Field label="Repeat new password"><PasswordInput value={f.rep} onChange={(v) => setF({ ...f, rep: v })} autoComplete="new-password" /></Field>
            {m && <Notice kind={m.k} onClose={() => setM(null)}>{m.t}</Notice>}<button disabled={!f.cur || f.next.length < 8} onClick={submit} className={`${btnPrimary} w-full`}>Change password</button></div></Section>
      </div>
    </Page>)
}
