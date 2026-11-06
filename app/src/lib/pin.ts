import { create } from 'zustand'
import { App as CapApp } from '@capacitor/app'
import { isNative } from './offline'

const KEY = 'textrak-pin'; const AWAY_MS = 2 * 60 * 1000
interface Stored { uid: string; salt: string; hash: string; fails: number }
const read = (): Stored | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null } }
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b as ArrayBuffer)].map((x) => x.toString(16).padStart(2, '0')).join('')
async function derive(pin: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: 150000, salt: new TextEncoder().encode(salt) }, key, 256))
}
export const hasPin = (uid: string) => read()?.uid === uid
export async function setPin(uid: string, pin: string) { const salt = hex(crypto.getRandomValues(new Uint8Array(16))); localStorage.setItem(KEY, JSON.stringify({ uid, salt, hash: await derive(pin, salt), fails: 0 } satisfies Stored)); useLock.getState().unlock() }
export const removePin = () => { localStorage.removeItem(KEY); useLock.getState().unlock() }
/** 'locked-out' after five wrong tries: the person must sign in with their password again. */
export async function checkPin(uid: string, pin: string): Promise<'ok' | 'bad' | 'locked-out'> {
  const s = read(); if (!s || s.uid !== uid) return 'locked-out'
  if ((await derive(pin, s.salt)) === s.hash) { localStorage.setItem(KEY, JSON.stringify({ ...s, fails: 0 })); return 'ok' }
  const fails = s.fails + 1; localStorage.setItem(KEY, JSON.stringify({ ...s, fails })); return fails >= 5 ? 'locked-out' : 'bad'
}

interface L { locked: boolean; lock: () => void; unlock: () => void }
export const useLock = create<L>((set) => ({ locked: !!read(), lock: () => set({ locked: true }), unlock: () => set({ locked: false }) }))
let leftAt = 0
if (isNative) void CapApp.addListener('appStateChange', (s) => { if (!s.isActive) leftAt = Date.now(); else if (leftAt && Date.now() - leftAt > AWAY_MS && read()) useLock.getState().lock() })
