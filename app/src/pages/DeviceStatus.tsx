import { useCallback, useEffect, useState } from 'react'
import { Cpu, MapPin, Radio, RefreshCw, Smartphone } from 'lucide-react'
import { Card, CardHead, Chip, Kpi, Page } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useInfra } from '../lib/infra'
import { go, useStore } from '../store'
import { ago, HEALTH_LABEL, HEALTH_TONE, readerHealth, trackerHealth, volts } from '../lib/status'

interface Trk { imei: string; name: string; kind: 'tracker' | 'phone'; model: string; org_id: string | null; active: boolean; last_seen: string | null; battery_pct: number | null }
interface Latest { imei: string; seen_at: string | null; fix_valid: boolean | null; satellites: number | null; battery_mv: number | null; gsm_signal: number | null; lat: number | null; fix_ts: string | null }

/** Super Admin: is every tracker, phone and RFID reader alive? Everything here is computed from real last-seen times. */
export default function DeviceStatus() {
  const orgs = useAuth((s) => s.orgs); const { sites, zones, readers, load: loadInfra } = useInfra(); const set = useStore((s) => s.set)
  const [trk, setTrk] = useState<Trk[]>([]); const [latest, setLatest] = useState<Record<string, Latest>>({}); const [loaded, setLoaded] = useState(false); const [err, setErr] = useState(''); const [, tick] = useState(0)
  const load = useCallback(async () => {
    const [t, l] = await Promise.all([supabase.from('trackers').select('imei,name,kind,model,org_id,active,last_seen,battery_pct').order('name'), supabase.rpc('device_latest'), loadInfra()])
    if (t.error) setErr(t.error.message); else setErr('')
    setTrk((t.data ?? []) as Trk[]); setLatest(Object.fromEntries(((l.data ?? []) as Latest[]).map((x) => [x.imei, x]))); setLoaded(true)
  }, [loadInfra])
  useEffect(() => { void load(); const id = setInterval(() => { void load(); tick((n) => n + 1) }, 15000); return () => clearInterval(id) }, [load])

  const org = (id: string | null) => orgs.find((o) => o.id === id)?.name ?? 'Not assigned'
  const active = trk.filter((t) => t.active); const hw = active.filter((t) => t.kind === 'tracker'); const ph = active.filter((t) => t.kind === 'phone')
  const on = (a: Trk[]) => a.filter((t) => trackerHealth(t.kind, t.last_seen) === 'online').length
  const rh = readers.map((r) => ({ r, h: readerHealth(r.last_seen) })); const rOn = rh.filter((x) => x.h === 'online').length; const rOff = rh.filter((x) => x.h === 'offline' || x.h === 'never').length
  const open = (imei: string) => { set({ focusDevice: imei }); go('map') }
  const manage = (tab: string) => { set({ adminTab: tab }); go('admin') }

  return (
    <Page title="Device status" sub="Whether every tracker, phone and RFID reader is reporting. Updates every 15 seconds." right={<button onClick={() => void load()} className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-[13.5px] font-semibold text-stone-700 hover:bg-stone-50"><RefreshCw size={15} /> Refresh</button>}>
      {err && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] font-semibold text-rose-900">Could not load devices: {err}</div>}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Vehicle trackers" value={`${on(hw)} / ${hw.length}`} sub="online now" tone={hw.length && on(hw) < hw.length ? 'warn' : 'good'} icon={<Cpu size={15} />} />
        <Kpi label="Phones" value={`${on(ph)} / ${ph.length}`} sub="signed in and reporting" icon={<Smartphone size={15} />} />
        <Kpi label="RFID readers" value={`${rOn} / ${readers.length}`} sub="read something in the last 15 min" tone={rOff ? 'warn' : 'good'} icon={<Radio size={15} />} />
        <Kpi label="Needs attention" value={hw.filter((t) => trackerHealth(t.kind, t.last_seen) !== 'online').length + rOff} sub="offline or never seen" tone={hw.filter((t) => trackerHealth(t.kind, t.last_seen) !== 'online').length + rOff ? 'bad' : 'good'} />
      </div>

      <Card className="mb-6"><CardHead title="Trackers and phones" sub="A vehicle tracker is online if it reported in the last 15 minutes (it reports every 6). A phone is online if it reported in the last 10." right={<button onClick={() => manage('devices')} className="text-[13.5px] font-semibold text-cyan-700 hover:underline">Edit trackers</button>} />
        {!loaded ? <div className="p-8 text-center text-stone-400">Loading…</div> : trk.length === 0 ? <div className="p-8 text-center text-[14.5px] text-stone-500">No trackers yet. Add one in Super Admin → Trackers.</div> :
          <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-[14px]"><thead><tr><th>Device</th><th>Belongs to</th><th>Status</th><th>Last heard</th><th>GPS</th><th>Battery</th><th>Signal</th><th /></tr></thead>
            <tbody className="divide-y divide-stone-100">{trk.map((t) => { const h = trackerHealth(t.kind, t.last_seen); const l = latest[t.imei]; const hasFix = !!l?.fix_ts; const gpsOk = l?.fix_valid !== false && !!l?.fix_ts && (Date.now() - new Date(l.fix_ts).getTime()) < 3600e3
              return <tr key={t.imei} className={t.active ? '' : 'opacity-55'}>
                <td><div className="font-medium text-stone-900">{t.name || 'Unnamed'}{t.kind === 'phone' && <span className="ml-2 rounded-full bg-cyan-50 px-2 py-0.5 text-[11.5px] font-medium text-cyan-700">Phone</span>}{!t.active && <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-[11.5px] font-medium text-stone-500">Switched off</span>}</div><div className="mono text-[12px] text-stone-400">{t.imei}</div></td>
                <td>{org(t.org_id)}</td><td><Chip tone={t.active ? HEALTH_TONE[h] : 'slate'}>{t.active ? HEALTH_LABEL[h] : 'Off'}</Chip></td><td className="text-stone-600">{ago(t.last_seen)}</td>
                <td>{t.kind === 'phone' ? (hasFix ? <Chip tone={gpsOk ? 'green' : 'amber'}>{gpsOk ? 'Fix' : 'Old fix'}</Chip> : <Chip>–</Chip>) : !l?.seen_at ? <Chip>No data</Chip> : gpsOk ? <Chip tone="green">Fix{l.satellites ? ` · ${l.satellites} sats` : ''}</Chip> : <Chip tone="amber">{hasFix ? 'Fix lost' : 'No GPS fix'}</Chip>}</td>
                <td>{t.kind === 'phone' ? (t.battery_pct != null ? `${t.battery_pct}%` : '–') : volts(l?.battery_mv)}</td><td>{l?.gsm_signal != null ? `${l.gsm_signal} / 5` : '–'}</td>
                <td className="text-right">{hasFix && <button onClick={() => open(t.imei)} className="mr-2 inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1.5 text-[12.5px] font-semibold text-cyan-700 hover:bg-cyan-100"><MapPin size={14} /> Route</button>}</td></tr> })}</tbody></table></div>}
      </Card>

      <Card><CardHead title="RFID readers" sub="Online: a read or heartbeat in the last 15 minutes. Quiet: nothing for a while (normal for a reader nobody walks past). Offline: nothing for a day." right={<button onClick={() => manage('readers')} className="text-[13.5px] font-semibold text-cyan-700 hover:underline">Edit readers</button>} />
        {readers.length === 0 ? <div className="p-8 text-center text-[14.5px] text-stone-500">No readers yet. Add one in Super Admin → RFID readers.</div> :
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[14px]"><thead><tr><th>Reader</th><th>Site</th><th>Zone</th><th>Belongs to</th><th>Status</th><th>Last read</th></tr></thead>
            <tbody className="divide-y divide-stone-100">{rh.map(({ r, h }) => { const s = sites.find((x) => x.id === r.site_id); const z = zones.find((x) => x.id === r.zone_id)
              return <tr key={r.id}><td><div className="font-medium text-stone-900">{r.code}</div><div className="text-[12.5px] text-stone-400">{r.label || r.position}</div></td><td>{s?.name ?? '–'}</td><td>{z?.name ?? '–'}</td><td>{s ? (s.org_id ? org(s.org_id) : 'Shared') : '–'}</td><td><Chip tone={HEALTH_TONE[h]}>{HEALTH_LABEL[h]}</Chip></td><td className="text-stone-600">{ago(r.last_seen)}</td></tr> })}</tbody></table></div>}
      </Card>
    </Page>)
}
