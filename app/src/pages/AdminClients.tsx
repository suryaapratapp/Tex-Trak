import { useState } from 'react'
import { CheckCircle2, Eye, Plus } from 'lucide-react'
import { Card } from '../components/ui'
import { useAuth, type Org } from '../lib/auth'
import { FEATURES, MODULES, featuresOf, type ModuleId } from '../sim/features'
import { totals, NETWORK } from '../sim/registry'
import { useStore } from '../store'
import { btnPrimary, Field, inputCls, Notice } from '../qr/ui'
import { FeaturePicker, TeamManager } from './Team'

const genPassword = () => { const c = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = new Uint32Array(12); crypto.getRandomValues(b); return [...b].map((x) => c[x % c.length]).join('') }
const ALL = FEATURES.map((f) => f.id)

function OrgCard({ o }: { o: Org }) {
  const { api, people } = useAuth(); const setRole = useStore((s) => s.setRole)
  const [more, setMore] = useState<'features' | 'team' | null>(null); const [draft, setDraft] = useState(o.features); const [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null)
  const t = totals(NETWORK.filter((n) => n.client === o.id)); const users = people.filter((p) => p.org_id === o.id)
  const save = async (features: string[]) => { setMsg(null); const r = await api('update_org', { id: o.id, features }); setMsg(r.error ? { k: 'error', t: r.error } : { k: 'ok', t: 'Access updated. People in this client keep only what the client still has.' }) }
  const moduleOn = (m: ModuleId) => featuresOf(m).some((f) => o.features.includes(f))
  const flip = (m: ModuleId) => save(moduleOn(m) ? o.features.filter((f) => !featuresOf(m).includes(f)) : [...new Set([...o.features, ...featuresOf(m)])])
  return (
    <Card className={o.active ? '' : 'opacity-70'}>
      <div className="flex items-start gap-4 p-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-extrabold text-white" style={{ background: o.color }}>{o.name[0]}</span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-extrabold text-stone-900">{o.name}</h3>{!o.active && <span className="rounded-full bg-rose-50 px-3 py-0.5 text-[12.5px] font-bold text-rose-700">Switched off</span>}</div><p className="text-[14px] text-stone-500">{o.tagline}</p></div>
        <button onClick={() => api('update_org', { id: o.id, active: !o.active })} className="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-[13px] font-bold text-stone-600 hover:bg-stone-50">{o.active ? 'Switch off' : 'Switch on'}</button></div>
      <div className="grid grid-cols-3 gap-2 px-5 pb-4">{[[users.length, 'accounts'], [t.sites, 'sites'], [o.features.length, 'features']].map(([v, l]) => <div key={l as string} className="rounded-2xl bg-stone-50 p-3"><div className="text-2xl font-extrabold text-stone-900">{v}</div><div className="text-[12px] font-semibold text-stone-500">{l}</div></div>)}</div>
      <div className="border-t border-stone-100 px-5 py-4"><div className="mb-3 text-[12px] font-bold uppercase tracking-wider text-stone-400">Modules this client can use</div>
        <div className="flex flex-wrap gap-2">{(Object.keys(MODULES) as ModuleId[]).map((m) => { const on = moduleOn(m); return <button key={m} onClick={() => flip(m)} title={MODULES[m].blurb} className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13.5px] font-bold transition ${on ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}>{on ? <CheckCircle2 size={14} /> : <i className="h-3.5 w-3.5 rounded-full border-2 border-stone-300" />}{MODULES[m].label}</button> })}</div>
        <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => { setMore(more === 'features' ? null : 'features'); setDraft(o.features) }} className="rounded-full bg-stone-100 px-4 py-2 text-[13.5px] font-bold text-stone-700 hover:bg-stone-200">Choose individual features</button><button onClick={() => setMore(more === 'team' ? null : 'team')} className="rounded-full bg-stone-100 px-4 py-2 text-[13.5px] font-bold text-stone-700 hover:bg-stone-200">Accounts ({users.length})</button>
          <button onClick={() => setRole(o.id)} className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-[13.5px] font-bold text-stone-700 hover:bg-stone-50"><Eye size={15} /> Preview what they see</button></div>
        {msg && <div className="mt-4"><Notice kind={msg.k} onClose={() => setMsg(null)}>{msg.t}</Notice></div>}
        {more === 'features' && <div className="mt-4 space-y-3"><FeaturePicker allowed={ALL} value={draft} onChange={setDraft} /><button onClick={() => save(draft)} className={btnPrimary}>Save features</button></div>}
        {more === 'team' && <div className="mt-4"><TeamManager orgId={o.id} superView /></div>}</div>
    </Card>)
}

export function ClientsPanel() {
  const { orgs, api } = useAuth(); const [add, setAdd] = useState(false); const [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null); const [busy, setBusy] = useState(false); const [formErr, setFormErr] = useState('')
  const [f, setF] = useState({ name: '', tagline: '', username: '', full_name: '', password: genPassword(), features: featuresOf('core') })
  const create = async () => {
    const username = f.username.trim().toLowerCase(); setFormErr('')
    if (!f.name.trim()) return setFormErr('Enter the client’s name.')
    if (!f.features.length) return setFormErr('Choose at least one thing this client can use.')
    if (!f.full_name.trim()) return setFormErr('Enter the administrator’s full name.')
    if (!/^[a-z0-9._-]{3,24}$/.test(username)) return setFormErr('The username needs 3 to 24 characters: lowercase letters, digits, dots, dashes or underscores, with no spaces.')
    if (f.password.length < 8) return setFormErr('The password needs at least 8 characters.')
    setBusy(true); setMsg(null); const r = await api('create_org', { name: f.name.trim(), tagline: f.tagline, features: f.features, admin: { username, password: f.password, full_name: f.full_name.trim() } }); setBusy(false)
    if (r.error) return setFormErr(r.error)
    setMsg({ k: 'ok', t: `${f.name} created. Their admin signs in as ${username} with password ${f.password}. Copy it now: it is not shown again.` }); setAdd(false); setF({ name: '', tagline: '', username: '', full_name: '', password: genPassword(), features: featuresOf('core') })
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><p className="max-w-2xl text-[14.5px] text-stone-500">Create a client, choose what they can use, and give them an admin. Their admin then creates accounts for their own staff and chooses what each person can do, but never more than you gave the client.</p><button onClick={() => setAdd(!add)} className={`${btnPrimary} flex shrink-0 items-center gap-2`}><Plus size={17} />{add ? 'Cancel' : 'New client'}</button></div>
      {msg && <Notice kind={msg.k} onClose={() => setMsg(null)}>{msg.t}</Notice>}
      {add && <Card className="space-y-5 p-6"><h3 className="text-[17px] font-extrabold text-stone-900">New client</h3>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Client name" required><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></Field><Field label="Description"><input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} className={inputCls} /></Field></div>
        <div><div className="mb-2 text-[13.5px] font-bold text-stone-600">What can this client use?</div><FeaturePicker allowed={ALL} value={f.features} onChange={(v) => setF({ ...f, features: v })} /></div>
        <div><div className="mb-2 text-[13.5px] font-bold text-stone-600">Their administrator</div><div className="grid gap-4 sm:grid-cols-3"><Field label="Full name" required><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} className={inputCls} /></Field><Field label="Username" required><input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} className={inputCls} /></Field><Field label="Password" hint="Generated. Share it securely."><input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={`${inputCls} mono`} /></Field></div></div>
        {formErr && <Notice kind="error" onClose={() => setFormErr('')}>{formErr}</Notice>}<button disabled={busy} onClick={() => void create()} className={btnPrimary}>{busy ? 'Creating…' : 'Create client'}</button></Card>}
      <div className="grid gap-5 lg:grid-cols-2">{orgs.map((o) => <OrgCard key={o.id} o={o} />)}</div>
    </div>)
}
