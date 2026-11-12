import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Camera, Search, WifiOff, X as XIcon } from 'lucide-react'
import { Scanner } from '../components/Scanner'
import { feedback } from '../lib/offline'
import { useAuth } from '../lib/auth'
import { useNet } from '../lib/offline'
import { useStore } from '../store'
import { inputCls } from '../qr/ui'
import { daysTo, fmtDate, norm, resolveCode, STATUS_LABEL, STATUS_TONE, useIndex, useWh, useWhLoad, useWhOrg, type Item, type Loc, type Status } from './store'
export { btnGhost, btnPrimary, Field, inputCls, Notice, Section, useFlash } from '../qr/ui'

export const TH = 'px-4 py-2.5 text-left text-[12px] font-bold uppercase tracking-wide text-stone-400'
export const TD = 'border-t border-stone-100 px-4 py-3 align-middle'
export const btnDanger = 'rounded-2xl border border-rose-200 bg-white px-5 py-3 text-[15px] font-bold text-rose-700 transition hover:bg-rose-50'
export const btnSmall = 'rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-[13px] font-bold text-stone-700 transition hover:bg-stone-50'

type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet'
const TONES: Record<Tone, string> = { slate: 'bg-stone-100 text-stone-600', green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-800', red: 'bg-rose-50 text-rose-700', blue: 'bg-blue-50 text-blue-700', violet: 'bg-violet-50 text-violet-700' }
export const Pill = ({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) => <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12.5px] font-bold ${TONES[tone]}`}>{children}</span>
export const StatusPill = ({ s }: { s: Status }) => <Pill tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}</Pill>
export function ExpiryChip({ date }: { date: string | null }) {
  if (!date) return <span className="text-stone-300">–</span>
  const d = daysTo(date)
  return <Pill tone={d < 0 ? 'red' : d <= 30 ? 'amber' : 'slate'}>{fmtDate(date)}{d < 0 ? ' · expired' : d <= 30 ? ` · ${d}d` : ''}</Pill>
}
export const Empty = ({ icon, title, sub, children }: { icon?: ReactNode; title: string; sub?: string; children?: ReactNode }) => (
  <div className="px-6 py-12 text-center">{icon && <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-600">{icon}</div>}<div className="text-[16px] font-bold text-stone-800">{title}</div>{sub && <p className="mx-auto mt-1.5 max-w-md text-[14px] text-stone-500">{sub}</p>}{children && <div className="mt-4 flex justify-center gap-2">{children}</div>}</div>)
export const Meter = ({ v, tone = 'cyan' }: { v: number; tone?: 'cyan' | 'amber' | 'red' | 'green' }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, background: { cyan: '#6759e4', amber: '#f59e0b', red: '#e11d48', green: '#10b981' }[tone] }} /></div>)

/** One box for everything: scan with a camera or a hardware scanner, type a code, or search by name. */
export function OmniInput({ kind, label, placeholder, autoFocus = true, onItem, onLoc, onOrder, onUnknown, hint }: {
  kind: 'item' | 'loc' | 'any'; label: string; placeholder?: string; autoFocus?: boolean; hint?: string
  onItem?: (item: Item, packQty: number) => void; onLoc?: (loc: Loc) => void; onOrder?: (number: string) => void; onUnknown?: (code: string) => void
}) {
  const ix = useIndex(); const [v, setV] = useState(''); const [cam, setCam] = useState(false); const [msg, setMsg] = useState(''); const [open, setOpen] = useState(false); const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])
  const matches = useMemo(() => {
    const q = v.trim().toLowerCase(); if (q.length < 2) return []
    const out: { key: string; label: string; sub: string; pick: () => void }[] = []
    if (kind !== 'loc') for (const i of ix.items) { if (!i.active) continue; if (i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q) || i.barcode.toLowerCase().includes(q)) { out.push({ key: 'i' + i.id, label: i.name, sub: i.sku, pick: () => onItem?.(i, 1) }); if (out.length >= 8) break } }
    if (kind !== 'item') for (const l of ix.locs) { if (!l.active) continue; if (l.code.toLowerCase().includes(q) || l.name.toLowerCase().includes(q)) { out.push({ key: 'l' + l.id, label: l.code, sub: l.name !== l.code ? l.name : l.kind, pick: () => onLoc?.(l) }); if (out.length >= 14) break } }
    return out
  }, [v, ix, kind, onItem, onLoc])
  const submit = (raw: string) => {
    const code = raw.trim(); if (!code) return
    const r = resolveCode(ix, code); setOpen(false)
    const done = () => { setV(''); setMsg(''); ref.current?.focus() }
    if (!r) { feedback(false); if (onUnknown) onUnknown(norm(code)); setMsg(`“${code}” is not in the system yet.`); return }
    if (r.kind === 'item') { if (kind === 'loc') { feedback(false); setMsg('That is an item code. Scan a location.'); return } if (!r.item.active) { feedback(false); setMsg(`${r.item.sku} is switched off.`); return } feedback(true); onItem?.(r.item, r.packQty); return done() }
    if (r.kind === 'loc') { if (kind === 'item') { feedback(false); setMsg('That is a location code. Scan an item.'); return } feedback(true); onLoc?.(r.loc); return done() }
    if (kind !== 'any') { feedback(false); setMsg('That is an order number.'); return }
    feedback(true); onOrder?.(r.number); done()
  }
  return (
    <div className="relative">
      <div className="mb-2 text-[14px] font-bold text-stone-600">{label}</div>
      <form onSubmit={(e) => { e.preventDefault(); submit(v) }} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
          <input ref={ref} value={v} onChange={(e) => { setV(e.target.value); setOpen(true); setMsg('') }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder={placeholder ?? 'Scan, type a code, or search by name'} autoComplete="off" autoCapitalize="characters" className={inputCls + ' pl-11'} aria-label={label} />
          {open && matches.length > 0 && (
            <div className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl">
              {matches.map((m) => <button type="button" key={m.key} onMouseDown={(e) => e.preventDefault()} onClick={() => { feedback(true); m.pick(); setV(''); setOpen(false); setMsg('') }} className="flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left hover:bg-cyan-50"><span className="truncate text-[14.5px] font-semibold text-stone-800">{m.label}</span><span className="mono shrink-0 text-[12.5px] text-stone-400">{m.sub}</span></button>)}
            </div>)}
        </div>
        <button type="button" onClick={() => setCam(!cam)} aria-label="Use camera" className={`grid h-12 w-14 shrink-0 place-items-center rounded-2xl ${cam ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-700'}`}><Camera size={20} /></button>
      </form>
      {msg && <p className="mt-2 text-[13.5px] font-semibold text-rose-600">{msg}</p>}
      {hint && !msg && <p className="mt-2 text-[12.5px] text-stone-400">{hint}</p>}
      {cam && <div className="mt-3"><Scanner onScan={(c) => submit(c)} /></div>}
    </div>)
}

/** Loads the warehouse data for the page and lets Super Admin choose which client to look at. */
export function WhShell({ children }: { children: ReactNode }) {
  useWhLoad(); const org = useWhOrg(); const { loaded, error, org: loadedOrg } = useWh(); const user = useAuth((s) => s.user); const orgs = useAuth((s) => s.orgs); const role = useStore((s) => s.role); const set = useStore((s) => s.set)
  const ready = loaded && loadedOrg === org
  return (
    <>
      <OfflineBar />
      {user?.role === 'superadmin' && role === 'superadmin' && <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-6 pt-5 sm:px-10"><span className="text-[13.5px] text-stone-500">Showing warehouse data for</span><select value={org} onChange={(e) => set({ whOrg: e.target.value })} className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-[14px] font-medium" aria-label="Client">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}
      {error ? <div className="p-10 text-center text-[14.5px] text-rose-600">{error}</div> : ready ? children : <div className="p-10 text-center text-[14.5px] text-stone-400">Loading…</div>}
    </>)
}

/** Shows when the device is offline, and lists saved work that is waiting to send or was refused. */
export function OfflineBar() {
  const { offline, ops, flushing, flush, retryOp, discardOp } = useWh(); const online = useNet((s) => s.online)
  const pending = ops.filter((o) => o.state === 'pending'); const failed = ops.filter((o) => o.state === 'failed')
  if (online && !offline && !ops.length) return null
  return (
    <div className="mx-auto max-w-[1500px] space-y-2 px-6 pt-4 sm:px-10">
      {(!online || offline) && <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] font-semibold text-amber-900"><WifiOff size={18} className="mt-0.5 shrink-0" /><span>You are offline. Scanning, goods in and out, packing, moves, stock changes and counts still work and are saved on this device. Orders, the ledger, imports and item edits need a connection.</span></div>}
      {pending.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-[14px] font-semibold text-sky-900"><span>{pending.length} saved change{pending.length === 1 ? '' : 's'} waiting to send: {pending.slice(0, 3).map((o) => o.text).join(', ')}{pending.length > 3 ? '…' : ''}</span>{online && <button disabled={flushing} onClick={() => void flush()} className="rounded-xl bg-sky-700 px-3.5 py-1.5 text-[13px] font-bold text-white disabled:opacity-60">{flushing ? 'Sending…' : 'Send now'}</button>}</div>}
      {failed.map((o) => <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] text-rose-900"><span><b>{o.text}</b> was not accepted: {o.error}</span><span className="flex gap-2"><button onClick={() => retryOp(o.id)} className="rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-[13px] font-bold">Try again</button><button onClick={() => discardOp(o.id)} className="rounded-xl bg-rose-700 px-3 py-1.5 text-[13px] font-bold text-white">Discard</button></span></div>)}
    </div>)
}

/** Reads a hand-off from another page (for example "Move this item") once, then clears it. */
export function useTakePrefill() {
  const p = useWh((s) => s.prefill); const set = useWh((s) => s.setPrefill)
  const taken = useRef<typeof p>(null)
  if (p && !taken.current) taken.current = p
  useEffect(() => { if (p) set(null) }, [p, set])
  return taken.current
}
export function RemoveBtn({ onClick, label = 'Remove' }: { onClick: () => void; label?: string }) { return <button onClick={onClick} aria-label={label} title={label} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-rose-50 hover:text-rose-600"><XIcon size={16} /></button> }

/** Like useTakePrefill, but already turned into the hand-off fields pages ask for. */
export function useTakePrefillItem() { return useTakePrefill() }
