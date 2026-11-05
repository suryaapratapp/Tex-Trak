import { useState } from 'react'
import { Page } from '../components/ui'
import { btnPrimary, Field, inputCls, Notice, Section } from './ui'
import { ROLE_LABEL, useAuth } from '../lib/auth'
import { FEATURES } from '../sim/features'

export default function Account(): React.ReactElement {
  const { user, orgs, changePassword } = useAuth(); const [f, setF] = useState({ cur: '', next: '', rep: '' }); const [m, setM] = useState<{ k: 'ok' | 'error'; t: string } | null>(null)
  if (!user) return <></>
  const org = orgs.find((o) => o.id === user.org_id)
  const can = user.role === 'superadmin' ? 'Everything on the platform' : user.role === 'org_admin' ? `All ${org?.features.length ?? 0} of ${org?.name}’s features, and managing the team` : `${user.features.length} features: ${FEATURES.filter((x) => user.features.includes(x.id)).map((x) => x.label).join(', ') || 'none yet'}`
  const rows: [string, string][] = [['Username', user.username], ['Name', user.full_name], ['Access level', ROLE_LABEL[user.role]], ...(org ? [['Organisation', org.name] as [string, string]] : []), ['Can use', can]]
  const submit = async () => { if (f.next !== f.rep) return setM({ k: 'error', t: 'The new passwords do not match.' }); const e = await changePassword(f.cur, f.next); if (e) return setM({ k: 'error', t: e }); setM({ k: 'ok', t: 'Password changed. You stay signed in on this device.' }); setF({ cur: '', next: '', rep: '' }) }
  return (
    <Page title="My account" sub="Your sign-in details">
      <div className="mx-auto max-w-[800px] space-y-6">
        <Section title="Signed in as"><dl className="divide-y divide-stone-100">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-6 py-3.5 text-[15px]"><dt className="shrink-0 text-stone-500">{k}</dt><dd className="text-right font-bold text-stone-900">{v}</dd></div>)}</dl></Section>
        <Section title="Change password" sub="Use at least 8 characters.">
          <div className="space-y-4"><Field label="Current password"><input type="password" value={f.cur} onChange={(e) => setF({ ...f, cur: e.target.value })} className={inputCls} autoComplete="current-password" /></Field><Field label="New password"><input type="password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} className={inputCls} autoComplete="new-password" /></Field><Field label="Repeat new password"><input type="password" value={f.rep} onChange={(e) => setF({ ...f, rep: e.target.value })} className={inputCls} autoComplete="new-password" /></Field>
            {m && <Notice kind={m.k} onClose={() => setM(null)}>{m.t}</Notice>}<button disabled={!f.cur || f.next.length < 8} onClick={submit} className={`${btnPrimary} w-full`}>Change password</button></div></Section>
      </div>
    </Page>)
}
