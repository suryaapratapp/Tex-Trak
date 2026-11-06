import { useState } from 'react'
import { Boxes, Mail, Recycle, ScanLine, ShieldCheck } from 'lucide-react'
import { Logo } from '../components/Logo'
import { PasswordInput } from '../components/PasswordInput'
import { useAuth } from '../lib/auth'
import { SUPABASE_URL } from '../lib/supabase'
import { Field, inputCls, Notice } from '../qr/ui'

const POINTS: [React.ReactNode, string, string][] = [
  [<ScanLine key="a" size={20} />, 'Scan and know', 'QR and RFID tell you where every item is, and what state it is in.'],
  [<Boxes key="b" size={20} />, 'Plan with confidence', 'See what is arriving, what is in stock and what needs changing.'],
  [<Recycle key="c" size={20} />, 'Prove the journey', 'Evidence that goods reached the right place, ready to print.'],
  [<ShieldCheck key="d" size={20} />, 'Your data, your people', 'Each organisation sees only its own information.'],
]

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
    <div className="grid min-h-full bg-white lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-cyan-700 via-cyan-600 to-cyan-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" /><div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative flex items-center gap-3"><Logo size={44} /><span className="text-[22px] font-semibold tracking-tight">Tex-Trak</span></div>
        <div className="relative max-w-lg"><h2 className="text-[40px] font-semibold leading-[1.1] tracking-tight">Track. Trace. Prove.</h2><p className="mt-4 text-[17px] leading-relaxed text-white/80">One place to follow every product through its life, from the moment it is labelled to the moment it is recycled.</p>
          <ul className="mt-10 space-y-5">{POINTS.map(([icon, t, d]) => <li key={t} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/15">{icon}</span><span><span className="block text-[15.5px] font-semibold">{t}</span><span className="block text-[14.5px] leading-snug text-white/75">{d}</span></span></li>)}</ul></div>
        <div className="relative text-[13px] text-white/60">Developed by CIRCAI LTD</div>
      </aside>

      <main className="flex flex-col justify-between bg-stone-50 px-6 py-8 sm:px-12">
        <div className="flex items-center gap-3 lg:hidden"><Logo size={36} /><span className="text-[19px] font-semibold tracking-tight text-stone-900">Tex-Trak</span></div>
        <div className="mx-auto w-full max-w-[420px] py-10">
          <h1 className="text-[28px] font-semibold tracking-tight text-stone-900">{setup ? 'First-time setup' : 'Welcome back'}</h1>
          <p className="mt-1.5 text-[15px] text-stone-500">{setup ? 'Create the Super Admin account. This only works once.' : 'Sign in with the username and password you were given.'}</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            {done && <Notice kind="ok">Super Admin created. You can sign in now.</Notice>}
            {setup && <Field label="Your name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} autoComplete="name" /></Field>}
            <Field label="Username"><input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} className={inputCls} autoComplete="username" autoCapitalize="none" autoFocus /></Field>
            <Field label="Password" hint={setup ? 'At least 8 characters.' : undefined}><PasswordInput value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete={setup ? 'new-password' : 'current-password'} /></Field>
            {setup && <Field label="Setup token" hint="The BOOTSTRAP_TOKEN secret you set on the server."><PasswordInput value={f.token} onChange={(v) => setF({ ...f, token: v })} /></Field>}
            {err && <Notice kind="error">{err}</Notice>}
            <button disabled={busy || !f.username || !f.password} className="h-12 w-full rounded-lg bg-cyan-600 text-[15px] font-medium text-white shadow-sm transition hover:bg-cyan-700 disabled:bg-stone-200 disabled:text-stone-400 disabled:shadow-none">{busy ? 'Please wait…' : setup ? 'Create Super Admin' : 'Sign in'}</button>
          </form>
          <button type="button" onClick={() => { setSetup(!setup); setErr(''); setDone(false) }} className="mt-5 w-full text-center text-[13.5px] font-medium text-stone-400 hover:text-stone-700">{setup ? 'Back to sign in' : 'First time? Set up the Super Admin'}</button>
          <div className="mt-8 flex items-start gap-3 rounded-lg border border-stone-200 bg-white p-4 text-[14px] text-stone-600"><Mail size={18} className="mt-0.5 shrink-0 text-cyan-600" /><span>Having trouble signing in? Contact <a href="mailto:surya@circai.co.uk" className="font-medium text-cyan-700 hover:underline">surya@circai.co.uk</a> and we will help.</span></div>
        </div>
        <div className="text-center text-[12.5px] text-stone-400 lg:text-left">Developed by CIRCAI LTD</div>
      </main>
    </div>)
}
