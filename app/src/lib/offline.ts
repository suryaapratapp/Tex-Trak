import { create } from 'zustand'
import { Capacitor } from '@capacitor/core'
import { Network } from '@capacitor/network'
import { get, set, del } from 'idb-keyval'

export const isNative = Capacitor.isNativePlatform()
export const kvGet = <T,>(k: string) => get<T>(k).catch(() => undefined)
export const kvSet = (k: string, v: unknown) => set(k, v).catch(() => undefined)
export const kvDel = (k: string) => del(k).catch(() => undefined)

/** Is there a connection right now? On the phone this follows the system; a failed request also flips it until the next success. */
interface N { online: boolean; set: (o: boolean) => void }
export const useNet = create<N>((s) => ({ online: typeof navigator === 'undefined' ? true : navigator.onLine, set: (online) => s({ online }) }))

let started = false
export function initNetwork() {
  if (started) return; started = true
  const set = useNet.getState().set
  window.addEventListener('online', () => set(true)); window.addEventListener('offline', () => set(false))
  if (isNative) { void Network.getStatus().then((s) => set(s.connected)); void Network.addListener('networkStatusChange', (s) => set(s.connected)) }
}

/** A request failed because there is no connection (as opposed to the server saying no). */
export const isNetworkError = (e: { message?: string; code?: string; status?: number } | null | undefined) => !!e && !e.code && (e.status === 0 || e.status === undefined) && /fetch|network|failed to|load failed|timeout|offline|abort/i.test(e.message ?? '')

/** Short beep and buzz so a fitter knows a scan landed without looking. */
let ctx: AudioContext | null = null
export function feedback(ok: boolean) {
  try { navigator.vibrate?.(ok ? 40 : [90, 60, 90]) } catch { /* not supported */ }
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = ok ? 880 : 240; g.gain.value = 0.08
    o.start(); o.stop(ctx.currentTime + (ok ? 0.09 : 0.22))
  } catch { /* no audio */ }
}
