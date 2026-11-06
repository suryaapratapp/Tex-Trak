import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Camera, CheckCircle2, CircleAlert, X } from 'lucide-react'
import { Scanner } from '../components/Scanner'
import { feedback } from '../lib/offline'
import { useQr, type Place, type Status, daysLeft, isOverdue, STATUS_LABEL, type Product } from './store'

export const inputCls = 'h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-[15px] text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100'
export const btnPrimary = 'rounded-2xl bg-cyan-600 px-5 py-3 text-[15px] font-bold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400'
export const btnGhost = 'rounded-2xl border border-stone-200 bg-white px-5 py-3 text-[15px] font-bold text-stone-700 transition hover:bg-stone-50'

export const Field = ({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) => (
  <label className="block"><span className="mb-1.5 block text-[13px] font-bold text-stone-600">{label}{required && <b className="ml-1 text-rose-500">*</b>}</span>{children}{hint && <span className="mt-1.5 block text-[12.5px] text-stone-400">{hint}</span>}</label>)

export const Section = ({ title, sub, right, children, className = '' }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={`card p-6 ${className}`}>{(title || right) && <div className="mb-4 flex items-start justify-between gap-3"><div>{title && <h2 className="text-[17px] font-extrabold text-stone-900">{title}</h2>}{sub && <p className="mt-1 text-[14px] text-stone-500">{sub}</p>}</div>{right}</div>}{children}</section>)

export function Notice({ kind, children, onClose }: { kind: 'ok' | 'error' | 'info'; children: ReactNode; onClose?: () => void }) {
  const t = { ok: 'border-emerald-200 bg-emerald-50 text-emerald-900', error: 'border-rose-200 bg-rose-50 text-rose-900', info: 'border-sky-200 bg-sky-50 text-sky-900' }[kind]
  return <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-[14.5px] font-semibold ${t}`}>{kind === 'error' ? <CircleAlert size={19} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={19} className="mt-0.5 shrink-0" />}<span className="flex-1">{children}</span>{onClose && <button onClick={onClose} aria-label="Dismiss"><X size={16} /></button>}</div>
}

export function ScanField({ label, onScan, disabled, placeholder = 'Code' }: { label: string; onScan: (code: string) => void; disabled?: boolean; placeholder?: string }) {
  const [v, setV] = useState(''); const [cam, setCam] = useState(false); const [tapFree, setTapFree] = useState(false); const ref = useRef<HTMLInputElement>(null)
  const submit = (code: string) => { const c = code.trim(); if (!c) return; onScan(c); setV(''); ref.current?.focus() }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3"><span className="text-[14px] font-bold text-stone-600">{label}</span>
        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-[13px] font-bold text-stone-600"><input type="checkbox" checked={tapFree} onChange={(e) => setTapFree(e.target.checked)} className="h-4 w-4 accent-cyan-600" />Tap-free</label></div>
      <form onSubmit={(e) => { e.preventDefault(); submit(v) }} className="flex gap-2">
        <input ref={ref} value={v} onChange={(e) => setV(e.target.value)} disabled={disabled} placeholder={placeholder} autoComplete="off" autoCapitalize="characters" className={inputCls} />
        <button type="button" onClick={() => setCam(!cam)} aria-label="Use camera" className={`grid h-12 w-14 shrink-0 place-items-center rounded-2xl ${cam ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-700'}`}><Camera size={20} /></button>
        <button disabled={disabled || !v.trim()} className="h-12 shrink-0 rounded-2xl bg-stone-200 px-5 text-[15px] font-bold text-stone-500 transition enabled:bg-cyan-600 enabled:text-white">Add</button>
      </form>
      {cam && <div className="mt-3"><Scanner onScan={(c) => (tapFree ? submit(c) : setV(c))} /></div>}
      {tapFree && <p className="mt-2 text-[12.5px] text-stone-400">Tap-free is on: scanned codes are logged straight away.</p>}
    </div>)
}

export interface Pick { hospitalId: string; floor: string; ward: string; bay: string }
export const EMPTY: Pick = { hospitalId: '', floor: '', ward: '', bay: '' }
export const toPlace = (p: Pick): Place | null => (p.hospitalId ? { hospitalId: p.hospitalId, floor: p.floor || undefined, ward: p.ward || undefined, bay: p.bay || undefined } : null)
export function LocationPicker({ value, onChange, required = true }: { value: Pick; onChange: (v: Pick) => void; required?: boolean }) {
  const { hospitals, locs } = useQr(); const inH = locs.filter((l) => l.hospitalId === value.hospitalId)
  const floors = [...new Set(inH.map((l) => l.floor))]; const wards = [...new Set(inH.filter((l) => !value.floor || l.floor === value.floor).map((l) => l.ward))]
  const bays = inH.filter((l) => (!value.floor || l.floor === value.floor) && (!value.ward || l.ward === value.ward)).map((l) => l.bay)
  return (
    <div className="space-y-4">
      <Field label="Hospital" required={required}><select value={value.hospitalId} onChange={(e) => onChange({ ...EMPTY, hospitalId: e.target.value })} className={inputCls}><option value="">Choose hospital</option>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
      {value.hospitalId && <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Floor"><select value={value.floor} onChange={(e) => onChange({ ...value, floor: e.target.value, ward: '', bay: '' })} className={inputCls}><option value="">Any floor</option>{floors.map((f) => <option key={f}>{f}</option>)}</select></Field>
        <Field label="Ward"><select value={value.ward} onChange={(e) => onChange({ ...value, ward: e.target.value, bay: '' })} className={inputCls}><option value="">Any ward</option>{wards.map((w) => <option key={w}>{w}</option>)}</select></Field>
        <div className="sm:col-span-2"><Field label="Bay"><select value={value.bay} onChange={(e) => onChange({ ...value, bay: e.target.value })} className={inputCls}><option value="">Choose bay</option>{bays.map((b) => <option key={b}>{b}</option>)}</select></Field></div></div>}
    </div>)
}

const ST: Record<Status | 'overdue', string> = { in_use: 'bg-blue-50 text-blue-700', registered: 'bg-emerald-50 text-emerald-700', removed: 'bg-amber-50 text-amber-800', retired: 'bg-stone-100 text-stone-600', overdue: 'bg-rose-50 text-rose-700' }
export const StatusChip = ({ p }: { p: Product }) => { const k = isOverdue(p) ? 'overdue' : p.status; return <span className={`inline-flex rounded-full px-3 py-1 text-[12.5px] font-bold ${ST[k]}`}>{k === 'overdue' ? 'Overdue' : STATUS_LABEL[p.status]}</span> }
export const DaysChip = ({ p }: { p: Product }) => { const d = daysLeft(p); if (d == null) return null; const c = d < 0 ? 'bg-rose-50 text-rose-700' : d <= 30 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'; return <span className={`inline-flex rounded-full px-3 py-1 text-[12.5px] font-bold ${c}`}>{d < 0 ? `${-d} days overdue` : `${d} days left`}</span> }

export function useFlash() {
  const [m, setM] = useState<{ kind: 'ok' | 'error' | 'info'; text: string } | null>(null)
  useEffect(() => { if (m?.kind === 'ok') { const t = setTimeout(() => setM(null), 5000); return () => clearTimeout(t) } }, [m])
  return { flash: m, ok: (text: string) => { feedback(true); setM({ kind: 'ok', text }) }, err: (text: string) => { feedback(false); setM({ kind: 'error', text }) }, clear: () => setM(null) }
}
