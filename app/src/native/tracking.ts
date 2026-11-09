import { registerPlugin } from '@capacitor/core'
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation'
import { Device } from '@capacitor/device'
import { LocalNotifications } from '@capacitor/local-notifications'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { App as CapApp } from '@capacitor/app'
import { isNative, isNetworkError, kvGet, kvSet, useNet } from '../lib/offline'
import type { Profile } from '../lib/auth'

const BG = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')
interface Point { ts: string; lat: number; lng: number; speed: number; heading: number; alt: number | null; acc: number; battery: number | null }
export type TrackState = 'off' | 'starting' | 'on' | 'denied' | 'error'
interface T { state: TrackState; deviceId: string; lastPoint: number; queued: number; consent: boolean; setConsent: (v: boolean) => void }
export const useTracking = create<T>((set) => ({ state: 'off', deviceId: '', lastPoint: 0, queued: 0, consent: false, setConsent: (v) => set({ consent: v }) }))

let watcher: string | null = null; let webWatch: number | null = null; let timer: ReturnType<typeof setInterval> | null = null; let user: Profile | null = null; let lastKept = 0; let flushing = false
const consentKey = (uid: string) => `tracking-consent:${uid}`

async function battery() { try { const b = await Device.getBatteryInfo(); return b.batteryLevel != null ? Math.round(b.batteryLevel * 100) : null } catch { return null } }

/** Send saved points (and a heartbeat) to the server. Points stay on the phone until the server confirms. */
export async function flushPoints() {
  if (flushing || !user) return; flushing = true
  try {
    const dev = useTracking.getState().deviceId; if (!dev || !useNet.getState().online) return
    const pts = (await kvGet<Point[]>('track-points')) ?? []; const batch = pts.slice(0, 200)
    const { error } = await supabase.rpc('phone_report', { p_device: dev, p_points: batch })
    if (error) { if (isNetworkError(error)) useNet.getState().set(false); return }
    const rest = pts.slice(batch.length); await kvSet('track-points', rest); useTracking.setState({ queued: rest.length })
    if (rest.length) { flushing = false; void flushPoints() }
  } finally { flushing = false }
}

async function onPoint(l: { latitude: number; longitude: number; speed: number | null; bearing: number | null; altitude: number | null; accuracy: number; time: number | null }) {
  const now = Date.now(); if (now - lastKept < 15000) return; lastKept = now
  const p: Point = { ts: new Date(l.time ?? now).toISOString(), lat: l.latitude, lng: l.longitude, speed: Math.round((l.speed ?? 0) * 3.6 * 10) / 10, heading: l.bearing ?? 0, alt: l.altitude, acc: Math.round(l.accuracy), battery: await battery() }
  const pts = ((await kvGet<Point[]>('track-points')) ?? []).concat(p).slice(-5000); await kvSet('track-points', pts)
  useTracking.setState({ lastPoint: now, queued: pts.length }); void flushPoints()
}

export const hasConsent = async (uid: string) => !!(await kvGet<boolean>(consentKey(uid)))
export async function giveConsent(uid: string) { await kvSet(consentKey(uid), true); useTracking.getState().setConsent(true) }

function webDeviceId() { let id = localStorage.getItem('textrak-web-device'); if (!id) { id = `ph-web-${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`; localStorage.setItem('textrak-web-device', id) } return id }

/** Called after sign-in. On the phone: name this device after the user and record location, including with the screen off.
 *  In a web browser: the same, but only while the page is open (browsers do not allow background tracking). */
export async function startTracking(u: Profile) {
  user = u
  const consent = await hasConsent(u.id); useTracking.getState().setConsent(consent)
  try {
    let dev: string; let model: string
    if (isNative) { const id = (await Device.getId()).identifier; const info = await Device.getInfo(); dev = `ph-${id}`; model = [info.manufacturer, info.model].filter(Boolean).join(' ') || 'Android phone' }
    else { dev = webDeviceId(); model = `Web browser (${(navigator.userAgent.match(/(Edg|Chrome|Firefox|Safari)\/?/) ?? ['browser'])[0].replace('/', '')})` }
    useTracking.setState({ deviceId: dev })
    if (useNet.getState().online) await supabase.rpc('phone_register', { p_device: dev, p_model: model, p_note: isNative ? '' : 'web' })
  } catch { /* retried at the next sign-in or app start */ }
  if (!consent || watcher || webWatch !== null) return
  useTracking.setState({ state: 'starting' })
  if (isNative) {
    try { await LocalNotifications.requestPermissions() } catch { /* notification is optional for the service to run */ }
    try {
      watcher = await BG.addWatcher({ backgroundTitle: 'Tex-Trak is recording your location', backgroundMessage: 'Your team can see where work is happening. Sign out to stop.', requestPermissions: true, stale: false, distanceFilter: 20 }, (loc, err) => {
        if (err) { useTracking.setState({ state: err.code === 'NOT_AUTHORIZED' ? 'denied' : 'error' }); return }
        if (loc) { useTracking.setState({ state: 'on' }); void onPoint(loc) }
      })
      timer = setInterval(() => void flushPoints(), 45000); useTracking.setState({ state: 'on' })
    } catch { useTracking.setState({ state: 'error' }) }
    return
  }
  if (!('geolocation' in navigator)) return useTracking.setState({ state: 'error' })
  webWatch = navigator.geolocation.watchPosition(
    (p) => { useTracking.setState({ state: 'on' }); void onPoint({ latitude: p.coords.latitude, longitude: p.coords.longitude, speed: p.coords.speed, bearing: p.coords.heading, altitude: p.coords.altitude, accuracy: p.coords.accuracy, time: p.timestamp }) },
    (e) => useTracking.setState({ state: e.code === 1 ? 'denied' : 'error' }), { enableHighAccuracy: true, maximumAge: 20000, timeout: 30000 })
  timer = setInterval(() => void flushPoints(), 45000)
}

export async function stopTracking() {
  try { if (watcher) await BG.removeWatcher({ id: watcher }) } catch { /* already gone */ }
  if (webWatch !== null) navigator.geolocation.clearWatch(webWatch); webWatch = null
  watcher = null; if (timer) clearInterval(timer); timer = null
  await flushPoints(); user = null; useTracking.setState({ state: 'off' })
}
export const openLocationSettings = () => { try { void BG.openSettings() } catch { /* not available */ } }

// If Android closed the recording while the app was away, start it again as soon as the app is opened.
if (isNative) void CapApp.addListener('appStateChange', (st) => { if (st.isActive && user && !watcher) void startTracking(user) })
