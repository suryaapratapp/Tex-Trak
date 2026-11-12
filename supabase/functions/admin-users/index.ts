// Tex-Trak account administration. The only code path that creates users or changes access.
// Rules: Super Admin manages every client and user. A client's admin manages only staff in their own client,
// and can only grant features the client itself has. Staff cannot manage anyone.
import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'content-type': 'application/json' } })
const fail = (m: string, status = 400) => json({ error: m }, status)

const FEATURES = ['command', 'map', 'alerts', 'insights', 'esg', 'scan', 'planner', 'inventory', 'twin', 'lifecycle', 'assets', 'shipments', 'provenance',
  'qrdash', 'qrproducts', 'qrinstall', 'qrtakedown', 'qrregister', 'qrlabels', 'qrlocations', 'qrreports', 'qrusers',
  'whdash', 'whscan', 'whinsights', 'whreceive', 'whissue', 'whpack', 'whorders', 'whunpack', 'whmove', 'whstock', 'whcount', 'whitems', 'whlocations', 'whledger', 'whlabels']
const clean = (f: unknown) => (Array.isArray(f) ? [...new Set(f.filter((x): x is string => typeof x === 'string' && FEATURES.includes(x)))] : [])
const email = (u: string) => `${u}@textrak.local`
const USERNAME = /^[a-z0-9._-]{3,24}$/

type Profile = { id: string; username: string; full_name: string; org_id: string | null; role: 'superadmin' | 'org_admin' | 'staff'; features: string[]; active: boolean }

async function caller(req: Request): Promise<Profile | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await admin.auth.getUser(token)
  if (!data.user) return null
  const { data: p } = await admin.from('profiles').select('*').eq('id', data.user.id).maybeSingle()
  return p && p.active ? (p as Profile) : null
}

async function createAccount(a: { username: string; password: string; full_name: string; org_id: string | null; role: Profile['role']; features: string[] }) {
  if (!USERNAME.test(a.username)) return { error: 'Usernames are 3–24 lowercase letters, digits, dots, dashes or underscores.' }
  if (typeof a.password !== 'string' || a.password.length < 8) return { error: 'Passwords need at least 8 characters.' }
  if (!a.full_name?.trim()) return { error: 'Enter a name.' }
  const { data: taken } = await admin.from('profiles').select('id').eq('username', a.username).maybeSingle()
  if (taken) return { error: 'That username is already taken.' }
  const { data, error } = await admin.auth.admin.createUser({ email: email(a.username), password: a.password, email_confirm: true })
  if (error || !data.user) return { error: error?.message ?? 'Could not create the sign-in.' }
  const { error: pe } = await admin.from('profiles').insert({ id: data.user.id, username: a.username, full_name: a.full_name.trim(), org_id: a.org_id, role: a.role, features: a.features })
  if (pe) { await admin.auth.admin.deleteUser(data.user.id); return { error: pe.message } }
  return { id: data.user.id }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail('POST only', 405)
  let body: Record<string, any>
  try { body = await req.json() } catch { return fail('Bad request') }
  const action = body.action as string

  // ---- first-time setup: creates the first Super Admin, only while none exists and only with the setup token
  if (action === 'bootstrap') {
    const secret = Deno.env.get('BOOTSTRAP_TOKEN')
    if (!secret) return fail('First-time setup is not enabled. Set the BOOTSTRAP_TOKEN secret first.', 503)
    if (body.token !== secret) return fail('Incorrect setup token.', 401)
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'superadmin')
    if ((count ?? 0) > 0) return fail('A Super Admin already exists.', 409)
    const r = await createAccount({ username: String(body.username ?? '').toLowerCase(), password: body.password, full_name: body.full_name, org_id: null, role: 'superadmin', features: [] })
    return 'error' in r ? fail(r.error!) : json({ ok: true })
  }

  const me = await caller(req)
  if (!me) return fail('Please sign in again.', 401)
  const isSuper = me.role === 'superadmin'

  const orgOf = async (id: string) => (await admin.from('orgs').select('*').eq('id', id).maybeSingle()).data as { id: string; features: string[]; active: boolean } | null
  /** May `me` manage this target? Super Admin: anyone else's account. Client admin: staff in their own client. */
  const manageable = async (id: string) => {
    const { data: t } = await admin.from('profiles').select('*').eq('id', id).maybeSingle()
    if (!t) return null
    if (isSuper) return t as Profile
    return me.role === 'org_admin' && t.org_id === me.org_id && t.role === 'staff' ? (t as Profile) : null
  }

  if (action === 'create_org') {
    if (!isSuper) return fail('Only the Super Admin can create clients.', 403)
    const name = String(body.name ?? '').trim(); const id = slug(body.id ?? name)
    if (!name || id.length < 2) return fail('Enter the client name.')
    if (await orgOf(id)) return fail('A client with that name already exists.')
    const { error } = await admin.from('orgs').insert({ id, name, tagline: String(body.tagline ?? ''), color: /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : '#5a46e0', features: clean(body.features) })
    if (error) return fail(error.message)
    const a = body.admin ?? {}
    const r = await createAccount({ username: String(a.username ?? '').toLowerCase(), password: a.password, full_name: a.full_name, org_id: id, role: 'org_admin', features: [] })
    if ('error' in r) { await admin.from('orgs').delete().eq('id', id); return fail(r.error!) }
    return json({ ok: true, id })
  }

  if (action === 'update_org') {
    if (!isSuper) return fail('Only the Super Admin can change a client.', 403)
    const org = await orgOf(String(body.id)); if (!org) return fail('Client not found.', 404)
    const patch: Record<string, unknown> = {}
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
    if (typeof body.tagline === 'string') patch.tagline = body.tagline
    if (typeof body.active === 'boolean') patch.active = body.active
    if (body.features !== undefined) patch.features = clean(body.features)
    const { error } = await admin.from('orgs').update(patch).eq('id', org.id)
    if (error) return fail(error.message)
    if (patch.features) { // staff can never hold more than their client does
      const { data: staff } = await admin.from('profiles').select('id,features').eq('org_id', org.id).eq('role', 'staff')
      for (const s of staff ?? []) { const next = (s.features as string[]).filter((f) => (patch.features as string[]).includes(f)); if (next.length !== s.features.length) await admin.from('profiles').update({ features: next }).eq('id', s.id) }
    }
    return json({ ok: true })
  }

  if (action === 'create_user') {
    const orgId = isSuper ? String(body.org_id ?? '') : me.org_id
    if (!isSuper && me.role !== 'org_admin') return fail('You cannot create accounts.', 403)
    const org = orgId ? await orgOf(orgId) : null; if (!org) return fail('Choose a client.')
    const role: Profile['role'] = isSuper && body.role === 'org_admin' ? 'org_admin' : 'staff'
    const features = role === 'staff' ? clean(body.features).filter((f) => org.features.includes(f)) : []
    const r = await createAccount({ username: String(body.username ?? '').toLowerCase(), password: body.password, full_name: body.full_name, org_id: org.id, role, features })
    return 'error' in r ? fail(r.error!) : json({ ok: true, id: r.id })
  }

  if (action === 'update_user') {
    const t = await manageable(String(body.id)); if (!t) return fail('You cannot change that account.', 403)
    if (t.id === me.id && body.active === false) return fail('You cannot deactivate your own account.')
    const patch: Record<string, unknown> = {}
    if (typeof body.full_name === 'string' && body.full_name.trim()) patch.full_name = body.full_name.trim()
    if (body.features !== undefined && t.role === 'staff') { const org = await orgOf(t.org_id!); patch.features = clean(body.features).filter((f) => org?.features.includes(f)) }
    if (typeof body.active === 'boolean') patch.active = body.active
    const { error } = await admin.from('profiles').update(patch).eq('id', t.id)
    if (error) return fail(error.message)
    if (typeof body.active === 'boolean') await admin.auth.admin.updateUserById(t.id, { ban_duration: body.active ? 'none' : '876000h' })
    return json({ ok: true })
  }

  if (action === 'reset_password') {
    const t = await manageable(String(body.id)); if (!t) return fail('You cannot change that account.', 403)
    if (typeof body.password !== 'string' || body.password.length < 8) return fail('Passwords need at least 8 characters.')
    const { error } = await admin.auth.admin.updateUserById(t.id, { password: body.password })
    return error ? fail(error.message) : json({ ok: true })
  }

  return fail('Unknown action')
})
