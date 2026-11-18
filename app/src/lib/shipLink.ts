import { supabase, SUPABASE_URL } from './supabase'

export interface NotifyResult { ok?: boolean; sent?: boolean; link?: string; email?: string; customer?: string | null; reason?: string; error?: string }
/** Asks the server for the customer's link, and optionally emails it. */
export async function notifyShipment(id: string, opts: { send?: boolean; email?: string } = {}): Promise<NotifyResult> {
  const { data: s } = await supabase.auth.getSession(); if (!s.session) return { error: 'Please sign in again.' }
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/shipment-notify`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${s.session.access_token}` }, body: JSON.stringify({ id, send: !!opts.send, email: opts.email ?? '' }) })
    return (await r.json()) as NotifyResult
  } catch { return { error: 'No connection. Try again when you are online.' } }
}
export const linkFor = (token: string) => `${location.origin}/?track=${token}`
