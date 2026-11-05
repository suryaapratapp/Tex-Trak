import { useEffect, useState } from 'react'
import { Battery, CheckCircle2, Cpu, Database, Radio, Satellite, Server } from 'lucide-react'
import { Card, CardHead, Chip, Page } from '../components/ui'
import { supabase, SUPABASE_URL, TAT240_IMEI } from '../lib/supabase'
import { useLiveTracker } from '../lib/useLive'
import { PLANS, VEHICLES } from '../sim/world'

const TABLES = ['sites', 'readers', 'product_types', 'assets', 'trackers', 'tracker_positions', 'custody_events', 'alerts', 'alert_rules']
export default function Devices() {
  const { fix, db, count } = useLiveTracker()
  const [counts, setCounts] = useState<Record<string, number | string>>({})
  useEffect(() => { TABLES.forEach(async (t) => { const r = await supabase.from(t).select('*', { count: 'exact', head: true }); setCounts((c) => ({ ...c, [t]: r.error ? 'err' : r.count ?? 0 })) }) }, [])
  const readers = [...PLANS.H.readers.map((r) => ({ ...r, site: 'Royal Meridian Hospital' })), ...PLANS.D.readers.map((r) => ({ ...r, site: 'Decon Plant' }))]
  return (
    <Page title="Devices" sub="Trackers and readers.">
      <Card className="mb-4"><CardHead title="Remote test checklist" sub="Share this page’s public link with whoever has the tracker — each check turns green by itself when real data arrives." />
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">{[
          ['Database reachable', db === 'ok'],
          ['First message received from the tracker', count > 0],
          ['Message is recent (last 30 min)', !!fix && Date.now() - new Date(fix.ts).getTime() < 30 * 60e3],
          ['Valid GPS fix (satellites locked)', !!fix && fix.fix_valid !== false && !(fix.lat === 0 && fix.lng === 0)],
          ['Movement detected (speed > 0)', !!fix && fix.speed_kmh > 0],
          ['Battery level reported', !!fix && !!fix.battery_mv],
        ].map(([l, ok]) => <div key={l as string} className={`flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-stone-50 text-stone-500'}`}><CheckCircle2 size={18} className={ok ? 'text-emerald-600' : 'text-stone-300'} />{l as string}</div>)}</div></Card>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2"><CardHead title="Teltonika TAT240 — LTE/GNSS terminal" sub="Model TAT240-QJIB0 · Bluetooth · internal Li-SOCl₂ 7.2 V 2200 mAh" right={<Chip tone={fix ? 'green' : 'amber'}>{fix ? 'reporting' : 'awaiting first fix'}</Chip>} />
          <div className="grid gap-4 p-4 md:grid-cols-[220px_1fr]">
            <div className="rounded-xl bg-ink-900 p-4 text-white"><div className="text-[10px] uppercase tracking-widest text-cyan-300">TELTONIKA</div><div className="mt-1 text-3xl font-bold tracking-tight">TAT240</div><div className="mt-3 space-y-2 text-xs text-slate-300"><div><div className="text-slate-500">IMEI</div><div className="mono text-sm text-white">{TAT240_IMEI}</div></div><div><div className="text-slate-500">S/N</div><div className="mono text-sm text-white">1159593094</div></div></div></div>
            <div className="space-y-3 text-[13px]">
              <div className="grid grid-cols-2 gap-2 text-xs">{[[<Satellite size={14} />, 'GNSS', 'GPS · GLONASS · Galileo · BeiDou'], [<Radio size={14} />, 'Connectivity', 'LTE Cat 1 / 2G · BLE'], [<Battery size={14} />, 'Power', 'Battery-powered, no wiring'], [<Cpu size={14} />, 'Protocol', 'Teltonika Codec 8 / 8 Extended']].map(([ic, a, b], i) => <div key={i} className="rounded-lg bg-slate-50 p-2.5"><div className="flex items-center gap-1.5 text-slate-500">{ic}{a}</div><div className="mt-0.5 font-medium text-slate-900">{b as string}</div></div>)}</div>
              <div className="rounded-lg border border-slate-200 p-3 text-xs"><div className="mb-1 font-semibold text-slate-800">Live feed</div>{fix ? <div className="mono text-slate-700">{new Date(fix.ts).toLocaleString()} · {fix.lat.toFixed(5)}, {fix.lng.toFixed(5)} · {Math.round(fix.speed_kmh)} km/h · {fix.battery_mv ? `${(fix.battery_mv / 1000).toFixed(2)} V` : ''}</div> : <div className="text-slate-500">No position received yet. Follow the setup below — the first fix appears here and on the Fleet Map instantly (Supabase Realtime).</div>}<div className="mt-1 text-slate-400">{count} stored positions · database {db}</div></div>
            </div></div>
          <div className="border-t border-slate-100 p-4"><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Bring the device online</div>
            <ol className="space-y-2 text-[13px] text-slate-700">
              <li><b>1.</b> Run the gateway (parses Codec 8/8E over TCP, forwards to Supabase):<pre className="mono mt-1 overflow-x-auto rounded-lg bg-slate-900 p-2.5 text-[11.5px] text-cyan-100">cd gateway && INGEST_URL={SUPABASE_URL}/functions/v1/ingest-tracker INGEST_TOKEN=&lt;secret&gt; node src/server.mjs</pre></li>
              <li><b>2.</b> Expose port 5027 (public IP / cloud VM). In <i>Teltonika Configurator</i> → System/GPRS: Domain = your host, Port = 5027, Protocol = TCP, Codec = 8 Extended, APN for the SIM.</li>
              <li><b>3.</b> Data acquisition: moving every 30 s, stationary every 60 min; enable <i>Send data on movement</i>. Power-cycle and watch this page.</li>
            </ol></div></Card>
        <div className="space-y-4">
          <Card><CardHead title="Platform health" sub="Supabase project qhxdqgkpebmpzzuzqcla" right={<Chip tone={db === 'ok' ? 'green' : 'red'}><Database size={11} /> {db}</Chip>} />
            <ul className="divide-y divide-slate-100 text-[13px]">{TABLES.map((t) => <li key={t} className="flex items-center justify-between px-4 py-2"><span className="mono text-slate-700">{t}</span><span className="mono text-slate-900">{counts[t] ?? '…'}</span></li>)}</ul></Card>
          <Card><CardHead title="Ingestion path" />
            <ol className="space-y-2 p-4 text-xs text-slate-600">{[['TAT240', 'AVL packets over TCP'], ['Gateway', 'IMEI auth · CRC · Codec 8/8E decode'], ['Edge function', 'validate · store · geofence · alert'], ['Postgres + Realtime', 'tracker_positions, custody_events'], ['Tex-Trak UI', 'map, ETA, rules, ledger']].map(([a, b], i) => <li key={a} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-cyan-100 text-[10px] font-bold text-cyan-800">{i + 1}</span><b className="text-slate-800">{a}</b> {b}</li>)}</ol></Card>
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card><CardHead title="Fleet trackers" /><table className="w-full text-left text-[13px]"><tbody className="divide-y divide-slate-100">{VEHICLES.map((v) => <tr key={v.id}><td className="px-4 py-2.5 font-medium text-slate-900">{v.reg}</td><td className="mono text-xs text-slate-600">{v.imei}</td><td className="text-slate-500">{v.driver}</td><td><Chip tone={v.simulated ? 'slate' : 'green'}>{v.simulated ? 'simulated' : 'hardware'}</Chip></td></tr>)}</tbody></table></Card>
        <Card><CardHead title={`RFID reader estate (${readers.length})`} sub="Fixed ceiling readers · UHF Gen2" /><div className="scroll-thin grid max-h-[260px] gap-1.5 overflow-y-auto p-3 sm:grid-cols-2">{readers.map((r) => <div key={r.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs"><CheckCircle2 size={13} className="text-emerald-500" /><span className="mono font-medium text-slate-800">{r.id}</span><span className="truncate text-slate-500">{r.label}</span></div>)}</div></Card>
      </div>
    </Page>
  )
}
