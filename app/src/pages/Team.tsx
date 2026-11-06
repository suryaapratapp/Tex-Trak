import { useState } from 'react'
import { Copy, KeyRound, Pencil, Power } from 'lucide-react'
import { Page } from '../components/ui'
import { ROLE_LABEL, useAuth, type Profile } from '../lib/auth'
import { FEATURES, MODULES, PRESETS, type ModuleId } from '../sim/features'
import { btnGhost, btnPrimary, Field, inputCls, Notice, Section } from '../qr/ui'

const genPassword = () => { const c = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = new Uint32Array(12); crypto.getRandomValues(b); return [...b].map((x) => c[x % c.length]).join('') }

/** Pick what someone can do, limited to what their organisation has. */
export function FeaturePicker({ allowed, value, onChange }: { allowed: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const mods = (Object.keys(MODULES) as ModuleId[]).map((m) => ({ m, list: FEATURES.filter((f) => f.module === m && allowed.includes(f.id)) })).filter((x) => x.list.length)
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">{PRESETS.map((p) => <button key={p.id} type="button" title={p.help} onClick={() => onChange(p.features.filter((f) => allowed.includes(f)))} className="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-[13.5px] font-bold text-stone-700 hover:bg-stone-50">{p.label}</button>)}
        <button type="button" onClick={() => onChange(allowed)} className="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-[13.5px] font-bold text-stone-700 hover:bg-stone-50">Everything</button><button type="button" onClick={() => onChange([])} className="rounded-full px-3 py-1.5 text-[13.5px] font-bold text-stone-400 hover:text-stone-700">Clear</button></div>
      <div className="grid gap-4 rounded-2xl border border-stone-100 p-4 sm:grid-cols-2">{mods.map(({ m, list }) => <div key={m}><div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wider text-stone-400">{MODULES[m].label}</div>
        {list.map((f) => <label key={f.id} className="flex cursor-pointer items-center gap-2.5 py-1 text-[14.5px]"><input type="checkbox" checked={value.includes(f.id)} onChange={() => toggle(f.id)} className="h-4.5 w-4.5 accent-cyan-600" /><span className={value.includes(f.id) ? 'font-semibold text-stone-900' : 'text-stone-500'}>{f.label}</span></label>)}</div>)}</div>
    </div>)
}

export function TeamManager({ orgId, superView = false }: { orgId: string; superView?: boolean }) {
  const { orgs, people, api, user } = useAuth(); const org = orgs.find((o) => o.id === orgId); const mine = people.filter((p) => p.org_id === orgId)
  const [add, setAdd] = useState(false); const [f, setF] = useState({ full_name: '', username: '', password: genPassword(), role: 'staff', features: PRESETS[0].features }); const [edit, setEdit] = useState<{ id: string; features: string[] } | null>(null)
  const [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null); const [formErr, setFormErr] = useState(''); const [reset, setReset] = useState<{ id: string; pw: string } | null>(null); const [busy, setBusy] = useState(false)
  if (!org) return null
  const run = async (action: string, body: Record<string, unknown>, okText: string) => { setBusy(true); setMsg(null); const r = await api(action, body); setBusy(false); if (r.error) { setMsg({ k: 'error', t: r.error }); return false } setMsg({ k: 'ok', t: okText }); return true }
  const create = async () => {
    const username = f.username.trim().toLowerCase(); setFormErr('')
    if (!f.full_name.trim()) return setFormErr('Enter the person’s full name.')
    if (!/^[a-z0-9._-]{3,24}$/.test(username)) return setFormErr('The username needs 3 to 24 characters: lowercase letters, digits, dots, dashes or underscores, with no spaces.')
    if (f.password.length < 8) return setFormErr('The password needs at least 8 characters.')
    if (f.role === 'staff' && f.features.length === 0) return setFormErr('Choose at least one thing this person can do.')
    setBusy(true); setMsg(null)
    const r = await api('create_user', { org_id: orgId, role: f.role, username, password: f.password, full_name: f.full_name.trim(), features: f.features.filter((x) => org.features.includes(x)) }); setBusy(false)
    if (r.error) return setFormErr(r.error)
    setMsg({ k: 'ok', t: `Account created. Username ${username}, password ${f.password}. Copy it now: it is not shown again.` }); setAdd(false); setF({ full_name: '', username: '', password: genPassword(), role: 'staff', features: PRESETS[0].features })
  }
  const canManage = (p: Profile) => p.id !== user?.id && (superView || p.role === 'staff')
  return (
    <div className="space-y-5">
      {msg && <Notice kind={msg.k} onClose={() => setMsg(null)}>{msg.t}</Notice>}
      <div className="flex items-center justify-between"><div className="text-[15px] font-bold text-stone-700">{mine.length} account{mine.length === 1 ? '' : 's'}</div><button onClick={() => setAdd(!add)} className={btnPrimary}>{add ? 'Cancel' : 'Add person'}</button></div>
      {add && <div className="space-y-4 rounded-2xl bg-stone-50 p-5">
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input value={f.full_name} onChange={(e) => { setF({ ...f, full_name: e.target.value }); setFormErr('') }} className={inputCls} /></Field><Field label="Username" hint="3 to 24 lowercase letters, digits, dots, dashes or underscores. No spaces."><input value={f.username} onChange={(e) => { setF({ ...f, username: e.target.value }); setFormErr('') }} autoCapitalize="none" autoCorrect="off" spellCheck={false} className={inputCls} /></Field>
          <Field label="Password" hint="Generated for you. Share it with them securely."><div className="flex gap-2"><input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={`${inputCls} mono`} /><button type="button" onClick={() => setF({ ...f, password: genPassword() })} className={btnGhost}>New</button></div></Field>
          {superView && <Field label="Account type"><select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className={inputCls}><option value="staff">Staff (limited access)</option><option value="org_admin">Client admin (manages their own team)</option></select></Field>}</div>
        {f.role === 'staff' && <div><div className="mb-2 text-[13.5px] font-bold text-stone-600">What can they do?</div><FeaturePicker allowed={org.features} value={f.features} onChange={(v) => setF({ ...f, features: v })} /></div>}
        {formErr && <Notice kind="error" onClose={() => setFormErr('')}>{formErr}</Notice>}<button onClick={() => void create()} disabled={busy} className={btnPrimary}>{busy ? 'Creating…' : 'Create account'}</button></div>}
      <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-100 bg-white">{mine.map((p) => (
        <li key={p.id} className="px-5 py-4"><div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[12rem] flex-1"><div className="text-[16px] font-bold text-stone-900">{p.full_name}{p.id === user?.id && <span className="font-normal text-stone-400"> (you)</span>}</div><div className="text-[13.5px] text-stone-500">@{p.username} · {p.role === 'org_admin' ? 'all of the client’s features' : `${p.features.length} feature${p.features.length === 1 ? '' : 's'}`}</div></div>
          <span className={`rounded-full px-3 py-1 text-[12.5px] font-bold ${p.role === 'org_admin' ? 'bg-cyan-50 text-cyan-700' : 'bg-stone-100 text-stone-600'}`}>{ROLE_LABEL[p.role]}</span>
          {!p.active && <span className="rounded-full bg-rose-50 px-3 py-1 text-[12.5px] font-bold text-rose-700">Switched off</span>}
          {canManage(p) && <div className="flex gap-1">
            {p.role === 'staff' && <button title="Change access" onClick={() => setEdit(edit?.id === p.id ? null : { id: p.id, features: p.features })} className="grid h-9 w-9 place-items-center rounded-full text-stone-500 hover:bg-stone-100"><Pencil size={16} /></button>}
            <button title="Reset password" onClick={() => setReset(reset?.id === p.id ? null : { id: p.id, pw: genPassword() })} className="grid h-9 w-9 place-items-center rounded-full text-stone-500 hover:bg-stone-100"><KeyRound size={16} /></button>
            <button title={p.active ? 'Switch off' : 'Switch on'} onClick={() => run('update_user', { id: p.id, active: !p.active }, p.active ? 'Account switched off.' : 'Account switched on.')} className={`grid h-9 w-9 place-items-center rounded-full hover:bg-stone-100 ${p.active ? 'text-stone-500' : 'text-rose-600'}`}><Power size={16} /></button></div>}
        </div>
        {edit?.id === p.id && <div className="mt-4 space-y-3"><FeaturePicker allowed={org.features} value={edit.features} onChange={(v) => setEdit({ id: p.id, features: v })} /><button disabled={busy} onClick={async () => { if (await run('update_user', { id: p.id, features: edit.features }, 'Access updated.')) setEdit(null) }} className={btnPrimary}>Save access</button></div>}
        {reset?.id === p.id && <div className="mt-4 flex flex-wrap items-end gap-2"><div className="min-w-[240px] flex-1"><Field label="New password"><input value={reset.pw} onChange={(e) => setReset({ id: p.id, pw: e.target.value })} className={`${inputCls} mono`} /></Field></div><button disabled={busy || reset.pw.length < 8} onClick={async () => { if (await run('reset_password', { id: p.id, password: reset.pw }, `Password changed to ${reset.pw}. Copy it now: it is not shown again.`)) setReset(null) }} className={btnPrimary}>Set password</button><button onClick={() => navigator.clipboard?.writeText(reset.pw)} className={`${btnGhost} flex items-center gap-2`}><Copy size={15} /> Copy</button></div>}
        </li>))}</ul>
    </div>)
}

export default function Team() {
  const { user, orgs } = useAuth(); const org = orgs.find((o) => o.id === user?.org_id)
  if (!org) return <Page title="Team" sub="No client is linked to your account.">{null}</Page>
  return (
    <Page title="Team" sub={`People at ${org.name}, and what each of them can do`}>
      <div className="mx-auto max-w-[1000px]"><Section><TeamManager orgId={org.id} /></Section>
        <p className="mt-4 px-2 text-[13.5px] text-stone-400">You can give people any of the {org.features.length} features {org.name} has. To add more features to {org.name}, ask your Tex-Trak administrator.</p></div>
    </Page>)
}
