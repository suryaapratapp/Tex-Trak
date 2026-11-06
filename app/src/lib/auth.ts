import { create } from 'zustand'
import { SUPABASE_URL, supabase } from './supabase'
import { useStore } from '../store'

export type AccountRole = 'superadmin' | 'org_admin' | 'staff'
export interface Org { id: string; name: string; tagline: string; color: string; features: string[]; active: boolean }
export interface Profile { id: string; username: string; full_name: string; org_id: string | null; role: AccountRole; features: string[]; active: boolean }
export const ROLE_LABEL: Record<AccountRole, string> = { superadmin: 'Super Admin', org_admin: 'Client admin', staff: 'Staff' }
const emailOf = (u: string) => `${u.trim().toLowerCase()}@textrak.local`

interface A {
  ready: boolean; user: Profile | null; orgs: Org[]; people: Profile[]
  init: () => Promise<void>; signIn: (u: string, p: string) => Promise<string | null>; signOut: () => Promise<void>; refresh: () => Promise<void>
  api: (action: string, body: Record<string, unknown>) => Promise<{ error?: string; [k: string]: unknown }>
  changePassword: (current: string, next: string) => Promise<string | null>
}
export const useAuth = create<A>((set, get) => ({
  ready: false, user: null, orgs: [], people: [],
  refresh: async () => {
    const { data: s } = await supabase.auth.getSession(); const uid = s.session?.user.id
    if (!uid) { set({ user: null, orgs: [], people: [], ready: true }); return }
    const { data: me } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    if (!me || !me.active) { await supabase.auth.signOut(); set({ user: null, orgs: [], people: [], ready: true }); return }
    const [{ data: orgs }, { data: people }] = await Promise.all([supabase.from('orgs').select('*').order('name'), supabase.from('profiles').select('*').order('full_name')])
    const user = me as Profile; set({ user, orgs: (orgs ?? []) as Org[], people: (people ?? []) as Profile[], ready: true })
    const st = useStore.getState(); if (user.role !== 'superadmin') st.set({ role: user.org_id as string }); else if (!st.role) st.set({ role: 'superadmin' })
  },
  init: async () => { await get().refresh(); supabase.auth.onAuthStateChange((e) => { if (e === 'SIGNED_OUT') set({ user: null, orgs: [], people: [], ready: true }) }) },
  signIn: async (u, p) => {
    const { error } = await supabase.auth.signInWithPassword({ email: emailOf(u), password: p })
    if (error) return /banned|disabled/i.test(error.message) ? 'This account has been switched off. Ask your administrator.' : 'Incorrect username or password.'
    await get().refresh(); const user = get().user
    if (!user) return 'This account has been switched off. Ask your administrator.'
    const org = get().orgs.find((o) => o.id === user.org_id); if (user.role !== 'superadmin' && !org?.active) { await get().signOut(); return 'Your organisation’s access is switched off.' }
    useStore.getState().set({ page: 'command' }); location.hash = 'command'; return null
  },
  signOut: async () => { await supabase.auth.signOut(); set({ user: null, orgs: [], people: [] }); useStore.getState().set({ role: 'superadmin' }) },
  api: async (action, body) => {
    const { data: s } = await supabase.auth.getSession()
    const r = await fetch(`${SUPABASE_URL}/functions/v1/admin-users`, { method: 'POST', headers: { 'content-type': 'application/json', ...(s.session ? { authorization: `Bearer ${s.session.access_token}` } : {}) }, body: JSON.stringify({ action, ...body }) })
    const j = (await r.json().catch(() => ({ error: 'The server did not answer.' }))) as { error?: string }
    if (!j.error) await get().refresh(); return j
  },
  changePassword: async (current, next) => {
    const u = get().user; if (!u) return 'Sign in again.'; if (next.length < 8) return 'Use at least 8 characters.'
    const { error: e1 } = await supabase.auth.signInWithPassword({ email: emailOf(u.username), password: current }); if (e1) return 'Your current password is not right.'
    const { error } = await supabase.auth.updateUser({ password: next }); return error ? error.message : null
  },
}))

export const orgInfo = (id: string) => { const o = useAuth.getState().orgs.find((x) => x.id === id); return { name: o?.name ?? id, tagline: o?.tagline ?? '', color: o?.color ?? '#5a46e0' } }
if (import.meta.env.DEV) (window as unknown as { __auth: typeof useAuth }).__auth = useAuth
