import { Page } from '../components/ui'
import { Section } from './ui'
import { ROLE_HELP } from './store'

export default function Account() {
  const rows: [string, string][] = [['Username', 'admin'], ['Display name', 'Super Admin'], ['Access level', 'Super Admin'], ['Organisation', 'CIRCAI LTD']]
  return (
    <Page title="My account" sub="Your sign-in details">
      <div className="mx-auto max-w-[800px] space-y-6"><Section title="Signed in as"><dl className="divide-y divide-stone-100">{rows.map(([k, v]) => <div key={k} className="flex justify-between py-3.5 text-[15px]"><dt className="text-stone-500">{k}</dt><dd className="font-bold text-stone-900">{v}</dd></div>)}</dl><p className="mt-3 text-[14px] text-stone-400">Full access to every client, site and feature. {ROLE_HELP.admin}.</p></Section>
        <Section title="Password" sub="Passwords are not used in this demonstration. When live sign-in is switched on, you will change your password here."><div className="rounded-2xl bg-stone-50 px-4 py-3 text-[14px] text-stone-500">Live sign-in is not connected yet.</div></Section></div>
    </Page>)
}
