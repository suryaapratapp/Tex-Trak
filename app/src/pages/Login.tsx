import { useState } from 'react'
import { Logo } from '../components/Logo'
import { useAuth } from '../lib/auth'
import { SUPABASE_URL } from '../lib/supabase'
import { Field, inputCls, Notice } from '../qr/ui'

export default function Login() {
  const signIn = useAuth((s) => s.signIn); const [setup, setSetup] = useState(false); const [f, setF] = useState({ username: '', password: '', name: '', token: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    if (setup) {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/admin-users`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'bootstrap', token: f.token, username: f.username.trim().toLowerCase(), password: f.password, full_name: f.name }) }).then((x) => x.json()).catch(() => ({ error: 'Could not reach the server.' }))
      setBusy(false); if (r.error) return setErr(r.error); setDone(true); setSetup(false); return
    }
    const m = await signIn(f.username, f.password); setBusy(false); if (m) setErr(m)
  }
  return (
    <div className="grid min-h-full place-items-center bg-gradient-to-br from-cyan-50 via-white to-stone-100 px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex items-center justify-center gap-3"><Logo size={52} /><div><div className="text-[26px] font-semibold leading-none tracking-tight text-stone-900">Tex-Trak</div><div className="mt-1 text-[13px] font-semibold text-stone-400">Track · Trace · Prove</div></div></div>
        <form onSubmit={submit} className="card space-y-5 p-8">
          <div><h1 className="text-[22px] font-extrabold text-stone-900">{setup ? 'First-time setup' : 'Sign in'}</h1><p className="mt-1 text-[14.5px] text-stone-500">{setup ? 'Create the Super Admin account. This only works once.' : 'Use the username and password you were given.'}</p></div>
          {done && <Notice kind="ok">Super Admin created. You can sign in now.</Notice>}
          {setup && <Field label="Your name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} autoComplete="name" /></Field>}
          <Field label="Username"><input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} className={inputCls} autoComplete="username" autoCapitalize="none" /></Field>
          <Field label="Password" hint={setup ? 'At least 8 characters.' : undefined}><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={inputCls} autoComplete={setup ? 'new-password' : 'current-password'} /></Field>
          {setup && <Field label="Setup token" hint="The BOOTSTRAP_TOKEN secret you set on the server."><input type="password" value={f.token} onChange={(e) => setF({ ...f, token: e.target.value })} className={inputCls} /></Field>}
          {err && <Notice kind="error">{err}</Notice>}
          <button disabled={busy || !f.username || !f.password} className="h-12 w-full rounded-2xl bg-cyan-600 text-[15px] font-bold text-white transition hover:bg-cyan-700 disabled:bg-stone-200 disabled:text-stone-400">{busy ? 'Please wait…' : setup ? 'Create Super Admin' : 'Sign in'}</button>
          <button type="button" onClick={() => { setSetup(!setup); setErr(''); setDone(false) }} className="w-full text-center text-[13.5px] font-semibold text-stone-400 hover:text-stone-700">{setup ? 'Back to sign in' : 'First time? Set up the Super Admin'}</button>
        </form>
        <p className="mt-6 text-center text-[13px] font-medium text-stone-400">Developed by CIRCAI LTD</p>
      </div>
    </div>)
}
