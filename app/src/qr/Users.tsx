import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Page } from '../components/ui'
import { btnPrimary, Field, inputCls, Notice, Section, useFlash } from './ui'
import { ROLE_HELP, ROLE_LABELS, useQr, type UserRole } from './store'

const CHIP: Record<UserRole, string> = { admin: 'bg-emerald-50 text-emerald-800', synergy: 'bg-emerald-50 text-emerald-800', synergy_field: 'bg-blue-50 text-blue-800', hospital: 'bg-stone-100 text-stone-700', guest: 'bg-emerald-50 text-emerald-800' }
export default function Users() {
  const { users, hospitals, dueDays, setDueDays, addUser, removeUser } = useQr(); const [days, setDays] = useState(String(dueDays)); const [add, setAdd] = useState(false); const [f, setF] = useState({ name: '', username: '', role: 'synergy_field' as UserRole, hospitalId: '' }); const { flash, ok, err, clear } = useFlash()
  const create = () => { if (!f.name.trim() || !/^[a-z0-9._-]{3,20}$/.test(f.username)) return err('Enter a name and a username of 3–20 lowercase letters or digits.'); if (users.some((u) => u.username === f.username)) return err('That username is taken.'); if (f.role === 'hospital' && !f.hospitalId) return err('Choose the hospital this account belongs to.'); addUser({ name: f.name.trim(), username: f.username, role: f.role, hospitalId: f.role === 'hospital' ? f.hospitalId : undefined }); ok('Account created.'); setAdd(false); setF({ name: '', username: '', role: 'synergy_field', hospitalId: '' }) }
  return (
    <Page title="Users and settings" sub="Administrator access">
      <div className="mx-auto max-w-[1000px] space-y-6">
        <Section title="Change-due window" sub="How long a product stays in service before it is flagged for change. Applied to new installations."><div className="flex gap-3"><input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} className={`${inputCls} max-w-[200px]`} inputMode="numeric" aria-label="Days" /><button onClick={() => { setDueDays(+days || 180); ok(`Change-due window set to ${+days || 180} days.`) }} className={btnPrimary}>Save</button><span className="self-center text-[14px] text-stone-500">days</span></div></Section>
        <Section title={`Accounts (${users.length})`} right={<button onClick={() => setAdd(!add)} className={btnPrimary}>{add ? 'Cancel' : 'Add user'}</button>}>
          {add && <div className="mb-6 grid gap-4 rounded-2xl bg-stone-50 p-5 sm:grid-cols-2"><Field label="Full name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></Field><Field label="Username"><input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} className={inputCls} /></Field>
            <Field label="Access level" hint={ROLE_HELP[f.role]}><select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as UserRole })} className={inputCls}>{(Object.keys(ROLE_LABELS) as UserRole[]).filter((r) => r !== 'admin').map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></Field>
            {f.role === 'hospital' && <Field label="Hospital" required><select value={f.hospitalId} onChange={(e) => setF({ ...f, hospitalId: e.target.value })} className={inputCls}><option value="">Choose hospital</option>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>}
            <div className="sm:col-span-2"><button onClick={create} className={btnPrimary}>Create account</button></div></div>}
          {flash && <div className="mb-4"><Notice kind={flash.kind} onClose={clear}>{flash.text}</Notice></div>}
          <ul className="divide-y divide-stone-100">{users.map((u) => <li key={u.id} className="flex items-center gap-4 py-4"><div className="min-w-0 flex-1"><div className="text-[16px] font-bold text-stone-900">{u.name}{u.username === 'admin' && <span className="font-normal text-stone-400"> (you)</span>}</div><div className="text-[14px] text-stone-500">@{u.username}</div></div>
            <div className="text-right"><span className={`inline-flex rounded-full px-3 py-1 text-[12.5px] font-bold ${CHIP[u.role]}`}>{ROLE_LABELS[u.role]}</span>{u.hospitalId && <div className="mt-1 text-[13px] text-stone-500">{hospitals.find((h) => h.id === u.hospitalId)?.name}</div>}</div>
            {u.username !== 'admin' && <button onClick={() => removeUser(u.id)} aria-label={`Remove ${u.name}`} className="grid h-9 w-9 place-items-center rounded-full text-stone-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button>}</li>)}</ul></Section>
      </div>
    </Page>)
}
