// One place that decides whether a tracker, phone or RFID reader counts as online.
// TAT240 trackers report every 6 minutes, so "online" allows two missed reports. Phones report far more often.
export type Health = 'online' | 'quiet' | 'offline' | 'never'

export const ageMin = (iso: string | null | undefined) => (iso ? (Date.now() - new Date(iso).getTime()) / 60000 : Infinity)

export function trackerHealth(kind: 'tracker' | 'phone', lastSeen: string | null): Health {
  const a = ageMin(lastSeen); if (!Number.isFinite(a)) return 'never'
  return a <= (kind === 'phone' ? 10 : 15) ? 'online' : 'offline'
}
/** A reader that is switched on but sees no tags is silent, so "quiet" (no reads for a while) is shown separately from "offline" (nothing for a day). */
export function readerHealth(lastSeen: string | null): Health {
  const a = ageMin(lastSeen); if (!Number.isFinite(a)) return 'never'
  return a <= 15 ? 'online' : a <= 24 * 60 ? 'quiet' : 'offline'
}
export const HEALTH_LABEL: Record<Health, string> = { online: 'Online', quiet: 'Quiet', offline: 'Offline', never: 'Never seen' }
export const HEALTH_TONE: Record<Health, 'green' | 'amber' | 'red' | 'slate'> = { online: 'green', quiet: 'amber', offline: 'red', never: 'slate' }

export function ago(iso: string | null | undefined) {
  const m = ageMin(iso); if (!Number.isFinite(m)) return 'never'
  if (m < 1) return 'just now'; if (m < 60) return `${Math.round(m)} min ago`; if (m < 1440) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} d ago`
}
export const volts = (mv: number | null | undefined) => (mv == null ? '–' : `${(mv / 1000).toFixed(2)} V`)

/** "every 2 hours", "every 6 minutes" */
export const rhythmText = (min: number | null | undefined) => {
  if (!min || !Number.isFinite(min)) return ''
  if (min < 1.5) return 'about every minute'; if (min < 90) return `every ${Math.round(min)} minutes`
  const h = min / 60; return h < 1.6 ? 'every hour' : h < 36 ? `every ${Math.round(h)} hours` : `every ${Math.round(h / 24)} days`
}

export type Level = 'ok' | 'warn' | 'bad'
export interface DeviceNote { level: Level; label: string; position: string; connection: string; rhythm: string; advice: string }
/** Says in plain words what a device is doing. "Connected" and "has a position" are different things, and a tracker that sleeps reports rarely. */
export function describeDevice(d: { kind: 'tracker' | 'phone'; lastSeen: string | null; intervalMin?: number | null; fixTs?: string | null; hasPosition?: boolean }): DeviceNote {
  const phone = d.kind === 'phone'; const age = ageMin(d.lastSeen); const iv = d.intervalMin && d.intervalMin > 0 ? d.intervalMin : null
  const limit = phone ? Math.max(10, (iv ?? 1) * 2 + 2) : Math.max(15, (iv ?? 6) * 1.5 + 5)
  const rhythm = iv ? `Reports ${rhythmText(iv)}${!phone && iv >= 60 ? ' while it is still' : ''}` : ''
  const fixAge = ageMin(d.fixTs); const fixLimit = phone ? 30 : Math.max(30, (iv ?? 6) * 2 + 10)
  const pos = d.fixTs ? (fixAge <= fixLimit ? `Live position, ${ago(d.fixTs)}` : `No GPS fix since ${new Date(d.fixTs).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`) : (d.hasPosition ? 'Last known place only' : 'Never had a GPS position')
  if (!Number.isFinite(age)) return { level: 'bad', label: 'Never heard from', position: pos, connection: 'Never connected', rhythm, advice: phone ? 'Nobody has signed in on this phone yet.' : 'Check the IMEI is right, the tracker is charged and switched on, has a SIM with data, and its server settings point at Tex-Trak.' }
  const conn = `Heard ${ago(d.lastSeen)}`
  if (age > limit) return { level: 'bad', label: 'Offline', position: pos, connection: `Not heard for ${ago(d.lastSeen).replace(' ago', '')}`, rhythm, advice: phone ? 'The app is closed, the phone has no signal, or location is switched off. Open Tex-Trak on the phone.' : `It normally reports ${iv ? rhythmText(iv) : 'every few minutes'} and has gone quiet. Check it is charged, switched on and has signal.` }
  if (!d.fixTs || fixAge > fixLimit) return { level: 'warn', label: 'Connected, no GPS', position: pos, connection: conn, rhythm, advice: phone ? 'The phone is connected but has not sent a position. Check location is allowed and set to always on for Tex-Trak.' : `It is connected, but it cannot see satellites, so it keeps repeating its last known place${iv && iv >= 60 ? ' and only reports ' + rhythmText(iv) + ' while it is still' : ''}. Take it outside with open sky, or move it so it sees the sky; it sends more often once it moves. The map shows its last known place.` }
  return { level: 'ok', label: 'Working', position: pos, connection: conn, rhythm, advice: '' }
}
