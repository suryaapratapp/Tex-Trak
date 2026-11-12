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
