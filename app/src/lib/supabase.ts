import { createClient } from '@supabase/supabase-js'
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://qhxdqgkpebmpzzuzqcla.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_FNyE_SqU-Lrq2iO-knotxg_dbqS7qne'
export const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } })
