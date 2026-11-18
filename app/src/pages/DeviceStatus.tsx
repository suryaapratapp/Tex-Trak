import { useCallback, useEffect, useMemo, useState } from 'react'
import { Battery, Laptop, MapPin, Radio, RefreshCw, Satellite, Signal, Smartphone, Truck } from 'lucide-react'
import { Card, CardHead, Chip, Kpi, Page } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useInfra } from '../lib/infra'
import { go, useStore } from '../store'
import { describeDevice, HEALTH_LABEL, HEALTH_TONE, readerHealth, volts, type Level } from '../lib/status'

interface Trk { imei: string; name: string; kind: 'tracker' | 'phone'; model: string; org_id: string | null; active: boolean; last_seen: string | null; battery_pct: number | null }
interface Latest { imei: string; seen_at: string | null; fix_valid: boolean | null; satellites: number | null; battery_mv: number | null; gsm_signal: number | null; lat: number | null; lng: number | null; fix_ts: string | null }
const TONE: Record<Level, string> = { ok: 'bg-emerald-50 text-emerald-800 ring-emerald-200', warn: 'bg-amber-50 text-amber-900 ring-amber-200', bad: 'bg-rose-50 text-rose-800 ring-rose-200' }
const DOT: Record<Level, string> = { ok: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-rose-500' }

/** Super Admin: is every tracker, phone and RFID reader alive, and does it have a position? Each device says so in plain words. */
export default function DeviceStatus() {
  const orgs = useAuth((s) => s.orgs); const { sites, zones, readers, vehicles, load: loadInfra } = useInfra(); const set = useStore((s) => s.set)
  const [trk, setTrk] = useState<Trk[]>([]); const [latest, setLatest] = useState<Record<string, Latest>>({}); const [rhythm, setRhythm] = useState<Record<string, number>>({}); const [loaded, setLoaded] = useState(false); const [err, setErr] = useState(''); const [, tick] = useState(0); const [filter, setFilter] = useState<'all' | 'attention' | 'tracker' | 'phone'>('all')
  const load = useCallback(async () => {
    const [t, l, r] = await Promise.all([supabase.from('trackers').select('imei,name,kind,model,org_id,active,last_seen,battery_pct').order('name'), supabase.rpc('device_latest'), supabase.rpc('device_rhythm'), loadInfra()])
    if (t.error) setErr(t.error.message); else setErr('')
    setTrk((t.data ?? []) as Trk[]); setLatest(Object.fromEntries(((l.data ?? []) as Latest[]).map((x) => [x.imei, x]))); setRhythm(Object.fromEntries(((r.data ?? []) as { imei: string; interval_min: string }[]).map((x) => [x.imei, Number(x.interval_min)]))); setLoaded(true)
  }, [loadInfra])
  useEffect(() => { void load(); const id = setInterval(() => { void load(); tick((n) => n + 1) }, 15000); return () => clearInterval(id) }, [load])

  const org = (id: string | null) => orgs.find((o) => o.id === id)?.name ?? 'Not assigned'
  const fitted = useMemo(() => new Map(vehicles.filter((v) => v.tracker_imei).map((v) => [v.tracker_imei as string, v.reg])), [vehicles])
  const rows = useMemo(() => trk.filter((t) => t.active).map((t) => { const l = latest[t.imei]; const note = describeDevice({ kind: t.kind, lastSeen: t.last_seen, intervalMin: rhythm[t.imei], fixTs: l?.fix_ts, hasPosition: l?.lat != null }); const web = t.kind === 'phone' && /web browser/i.test(t.model ?? ''); return { t, l, note, web } }), [trk, latest, rhythm])
  const off = trk.filter((t) => !t.active)
  const count = (lv: Level) => rows.filter((r) => r.note.level === lv).length
  const rh = readers.map((r) => ({ r, h: readerHealth(r.last_seen) })); const rOn = rh.filter((x) => x.h === 'online').length; const rOff = rh.filter((x) => x.h === 'offline' || x.h === 'never').length
  const shown = rows.filter((r) => filter === 'all' || (filter === 'attention' ? r.note.level !== 'ok' : filter === 'tracker' ? r.t.kind === 'tracker' : r.t.kind === 'phone'))
  const open = (imei: string) => { set({ focusDevice: imei }); go('map') }
  const manage = (tab: string) => { set({ adminTab: tab }); go('admin') }
  const chip = (k: typeof filter, label: string, n: number) => <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-4 py-2 text-[13.5px] font-bold ${filter === k ? 'bg-cyan-600 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'}`}>{label} <span className={filter === k ? 'text-white/80' : 'text-stone-400'}>{n}</span></button>

  return (
    <Page title="Device status" sub="Is each device connected, and does it have a position? Updates every 15 seconds." right={<button onClick={() => void load()} className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-[13.5px] font-semibold text-stone-700 hover:bg-stone-50"><RefreshCw size={15} /> Refresh</button>}>
      {err && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] font-semibold text-rose-900">Could not load devices: {err}</div>}
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Working" value={`${count('ok')} / ${rows.length}`} sub="connected, live position" tone={rows.length && count('ok') < rows.length ? 'warn' : 'good'} icon={<Satellite size={15} />} />
        <Kpi label="Connected, no GPS" value={count('warn')} sub="alive but cannot see satellites" tone={count('warn') ? 'warn' : 'good'} icon={<MapPin size={15} />} />
        <Kpi label="Offline" value={count('bad')} sub="not heard for too long" tone={count('bad') ? 'bad' : 'good'} icon={<Signal size={15} />} />
        <Kpi label="RFID readers" value={`${rOn} / ${readers.length}`} sub="read something in the last 15 min" tone={rOff ? 'warn' : 'good'} icon={<Radio size={15} />} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">{chip('all', 'All', rows.length)}{chip('attention', 'Needs attention', rows.length - count('ok'))}{chip('tracker', 'Trackers', rows.filter((r) => r.t.kind === 'tracker').length)}{chip('phone', 'Phones and browsers', rows.filter((r) => r.t.kind === 'phone').length)}
        <button onClick={() => manage('devices')} className="ml-auto text-[13.5px] font-semibold text-cyan-700 hover:underline">Edit trackers</button></div>
      {!loaded ? <Card className="p-8 text-center text-stone-400">Loading…</Card> : rows.length === 0 ? <Card className="p-8 text-center text-[14.5px] text-stone-500">No trackers yet. Add one in Super Admin → Trackers.</Card> :
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{shown.map(({ t, l, note, web }) => { const Icon = t.kind === 'phone' ? (web ? Laptop : Smartphone) : fitted.has(t.imei) ? Truck : Radio; return (
          <Card key={t.imei} className="flex min-w-0 flex-col p-4">
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-600"><Icon size={19} /></span>
              <div className="min-w-0 flex-1"><div className="truncate text-[16px] font-bold text-stone-900">{fitted.get(t.imei) ?? (t.name || 'Unnamed')}</div><div className="truncate text-[12.5px] text-stone-500">{fitted.has(t.imei) ? `Vehicle tracker · ${t.name}` : t.kind === 'phone' ? (web ? 'Laptop or browser' : 'Mobile phone') : 'GNSS tracker'} · {org(t.org_id)}</div></div>
              <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold ring-1 ${TONE[note.level]}`}><i className={`h-2 w-2 rounded-full ${DOT[note.level]}`} />{note.label}</span></div>
            <dl className="mt-3 space-y-1.5 text-[13.5px]">
              <div className="flex gap-2"><dt className="w-24 shrink-0 text-stone-400">Connection</dt><dd className="min-w-0 font-semibold text-stone-800">{note.connection}</dd></div>
              <div className="flex gap-2"><dt className="w-24 shrink-0 text-stone-400">Position</dt><dd className="min-w-0 font-semibold text-stone-800">{note.position}</dd></div>
              {note.rhythm && <div className="flex gap-2"><dt className="w-24 shrink-0 text-stone-400">Rhythm</dt><dd className="min-w-0 text-stone-700">{note.rhythm}</dd></div>}
              <div className="flex gap-2"><dt className="w-24 shrink-0 text-stone-400">Power</dt><dd className="flex items-center gap-3 text-stone-700"><span className="flex items-center gap-1"><Battery size={14} />{t.kind === 'phone' ? (t.battery_pct != null ? `${t.battery_pct}%` : '–') : volts(l?.battery_mv)}</span>{l?.gsm_signal != null && <span className="flex items-center gap-1"><Signal size={14} />{l.gsm_signal}/5</span>}</dd></div>
            </dl>
            {note.advice && <p className={`mt-3 rounded-xl p-3 text-[13px] leading-snug ring-1 ${TONE[note.level]}`}>{note.advice}</p>}
            <div className="mt-auto pt-3">{l?.fix_ts && <button onClick={() => open(t.imei)} className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3.5 py-2 text-[13px] font-semibold text-cyan-700 hover:bg-cyan-100"><MapPin size={14} /> Show on the map</button>}</div>
          </Card>) })}{shown.length === 0 && <Card className="p-8 text-center text-[14.5px] text-stone-500 md:col-span-2 xl:col-span-3">Nothing here. Everything is working.</Card>}</div>}
      {off.length > 0 && <p className="mt-3 text-[13px] text-stone-400">{off.length} switched off: {off.map((t) => t.name || t.imei).join(', ')}.</p>}

      <Card className="mt-6"><CardHead title="RFID readers" sub="Online: a read or heartbeat in the last 15 minutes. Quiet: nothing for a while (normal for a reader nobody walks past). Offline: nothing for a day." right={<button onClick={() => manage('readers')} className="text-[13.5px] font-semibold text-cyan-700 hover:underline">Edit readers</button>} />
        {readers.length === 0 ? <div className="p-8 text-center text-[14.5px] text-stone-500">No readers yet. Add one in Super Admin → RFID readers.</div> :
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[14px]"><thead><tr><th>Reader</th><th>Site</th><th>Zone</th><th>Status</th></tr></thead>
            <tbody className="divide-y divide-stone-100">{rh.map(({ r, h }) => { const s = sites.find((x) => x.id === r.site_id); const z = zones.find((x) => x.id === r.zone_id)
              return <tr key={r.id}><td><div className="font-medium text-stone-900">{r.code}</div><div className="text-[12.5px] text-stone-400">{r.label || r.position}</div></td><td>{s?.name ?? '–'}</td><td>{z?.name ?? '–'}</td><td><Chip tone={HEALTH_TONE[h]}>{HEALTH_LABEL[h]}</Chip></td></tr> })}</tbody></table></div>}
      </Card>
    </Page>)
}
