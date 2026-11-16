import { create } from 'zustand'

export type ToastKind = 'ok' | 'error' | 'info'
export interface ToastItem { id: number; kind: ToastKind; text: string }
interface T { items: ToastItem[]; push: (kind: ToastKind, text: string) => void; drop: (id: number) => void }
let seq = 0; const recent = new Map<string, number>()

export const useToasts = create<T>((set, get) => ({
  items: [],
  push: (kind, text) => {
    const t = text.trim(); if (!t) return
    const key = `${kind}:${t}`; const now = Date.now(); if ((recent.get(key) ?? 0) > now - 3000) return // the same message twice in a row is shown once
    recent.set(key, now); const id = ++seq
    set((s) => ({ items: [...s.items.slice(-3), { id, kind, text: t }] }))
    setTimeout(() => get().drop(id), kind === 'error' ? 4000 : 2000) // short, so they never block the top of a phone screen
  },
  drop: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}))

/** Shows a short message at the top right of the screen. */
export const toast = { ok: (t: string) => useToasts.getState().push('ok', t), error: (t: string) => useToasts.getState().push('error', t), info: (t: string) => useToasts.getState().push('info', t) }
