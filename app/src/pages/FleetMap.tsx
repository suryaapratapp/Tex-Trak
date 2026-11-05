import { useState } from 'react'
import { Battery, Compass, Gauge, Navigation, Satellite, Signal, Building2 } from 'lucide-react'
import { FleetMapView } from '../components/FleetMapView'
import { Bar, Card, CardHead, Chip, Page } from '../components/ui'
import { EventFeed } from '../components/Feed'
import { fmtT, getWorld } from '../sim/engine'
import { SITES, VEHICLES, VEH_BY_ID } from '../sim/world'
import { fmtDur, useSnap } from '../sim/snap'
import { go, useStore } from '../store'

export default function FleetMap() {
  const snap = useSnap(); const t = snap.t; const { selVeh, set } = useStore(); const [follow, setFollow] = useState(false)
  const w = getWorld(); const v = VEH_BY_ID[selVeh]; const st = snap.veh[selVeh]
  const live = useStore((s) => s.live)
  const mine = w.legs.filter((l) => l.veh === selVeh)
  const nextLeg = mine.find((l) => l.depart > t)
  const lastLeg = [...mine].reverse().find((l) => l.arrive <= t)
  const onboard = snap.loc.filter((l) => l.kind === 'vehicle' && l.veh === selVeh)
  const status = st.dark ? { txt: `No signal since ${fmtT(st.lastFixT)} — last fix inside ${st.atSite ? SITES[st.atSite].short : 'unknown area'}`, tone: 'red' as const }
    : st.leg ? { txt: `En route to ${SITES[st.leg.to].name} · ETA ${fmtT(st.eta!)} (${st.delay >= 0 ? '+' : ''}${Math.round(st.delay)} min vs plan)`, tone: st.delay > 8 ? ('amber' as const) : ('green' as const) }
    : st.atSite ? { txt: `Parked at ${SITES[st.atSite].name}${lastLeg ? ` · arrived ${fmtT(lastLeg.arrive)}` : ''}${nextLeg ? ` · next departure ${fmtT(nextLeg.depart)} → ${SITES[nextLeg.to].short}` : ''}`, tone: 'blue' as const }
    : { txt: 'Parked', tone: 'slate' as const }
  const pingS = st.moving ? 30 : 3600
  return (
    <Page title="Live Fleet Map" sub="Real-time position from Teltonika TAT240 GNSS trackers bound to cages and vehicles.">
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-900">Greater London operations</span>
            <span className="ml-auto flex items-center gap-3 text-xs text-slate-500"><i className="inline-block h-0.5 w-5 border-t-2 border-dotted border-slate-500" /> planned route <i className="inline-block h-1 w-5 rounded bg-cyan-500" /> travelled <label className="ml-2 flex cursor-pointer items-center gap-1.5 font-medium text-slate-700"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow selected</label></span>
          </div>
          <FleetMapView vehIds={['V1', 'V2', 'V3', 'V4']} height={640} selected={selVeh} onSelect={(id) => set({ selVeh: id })} follow={follow} scanners />
        </Card>
        <div className="space-y-4">
          <Card><CardHead title="Vehicles" />
            <ul className="divide-y divide-slate-100">{VEHICLES.map((x) => { const s = snap.veh[x.id]; return (
              <li key={x.id}><button onClick={() => set({ selVeh: x.id })} className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${selVeh === x.id ? 'bg-cyan-50/60' : 'hover:bg-slate-50'}`}>
                <i className="h-3 w-3 rounded-full" style={{ background: x.color }} />
                <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-slate-900">{x.reg} <span className="font-normal text-slate-500">· {x.driver}</span></div><div className="truncate text-xs text-slate-500">{x.role}</div></div>
                {s.dark ? <Chip tone="red">NO SIGNAL</Chip> : s.moving ? <Chip tone="green">{Math.round(s.speed)} km/h</Chip> : <Chip>parked</Chip>}</button></li>) })}</ul></Card>
          <Card><CardHead title={`${v.reg} · ${v.model}`} sub={`IMEI ${v.imei}${v.simulated ? ' (simulated)' : ' · physical device'}`} right={<Chip tone={v.simulated ? 'slate' : 'green'}>{v.simulated ? 'SIM' : 'HW'}</Chip>} />
            <div className="space-y-3 p-4">
              <div className={`rounded-lg px-3 py-2 text-[12.5px] font-medium ${{ red: 'bg-rose-50 text-rose-800', amber: 'bg-amber-50 text-amber-900', green: 'bg-emerald-50 text-emerald-800', blue: 'bg-sky-50 text-sky-800', slate: 'bg-slate-50 text-slate-700' }[status.tone]}`}>{status.txt}</div>
              {st.leg && <div><div className="mb-1 flex justify-between text-xs text-slate-500"><span>{SITES[st.leg.from].short}</span><span>{Math.round(st.progress * 100)}% · {fmtDur(st.eta! - t)} left</span><span>{SITES[st.leg.to].short}</span></div><Bar v={st.progress} color={v.color} h={8} /></div>}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[[<Gauge size={13} />, 'Speed', `${Math.round(st.speed)} km/h`], [<Compass size={13} />, 'Heading', `${Math.round(st.heading)}°`], [<Satellite size={13} />, 'Satellites / HDOP', st.dark ? '—' : `${st.sats} / ${st.hdop.toFixed(1)}`], [<Signal size={13} />, 'Cellular (LTE)', st.dark ? 'none' : `${st.signal}/5`], [<Battery size={13} />, 'Battery', `${Math.round(st.battery)}% · ${(st.mv / 1000).toFixed(2)} V`], [<Navigation size={13} />, 'Position', `${st.pos[0].toFixed(4)}, ${st.pos[1].toFixed(4)}`]].map(([ic, l, val], i) => (
                  <div key={i} className="rounded-lg bg-slate-50 px-2.5 py-2"><div className="flex items-center gap-1.5 text-slate-500">{ic}{l}</div><div className="mono mt-0.5 text-[12.5px] font-medium text-slate-900">{val as string}</div></div>))}
              </div>
              <div className="text-[11px] text-slate-500">Reporting every {pingS < 100 ? `${pingS} s while moving` : '60 min while stationary (battery saver)'} · last fix {st.dark ? fmtT(st.lastFixT) : 'now'}</div>
              <div className="rounded-lg border border-slate-200 p-3"><div className="text-xs font-semibold text-slate-700">Inherited visibility</div><div className="mt-1 text-xs text-slate-500">{onboard.length ? `${onboard.length} QR/RFID items ride in cages bound to this tracker — each inherits its GNSS position.` : 'No tagged cages onboard.'}</div>
                {onboard.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{onboard.slice(0, 12).map((o) => { const it = w.items[snap.loc.indexOf(o)]; return <Chip key={it.id} tone="cyan">{it.qr.slice(3)}</Chip> })}{onboard.length > 12 && <Chip>+{onboard.length - 12}</Chip>}</div>}</div>
              {(st.atSite === 'HOSP' || st.atSite === 'DECON') && <button onClick={() => { set({ twin: st.atSite === 'HOSP' ? 'H' : 'D' }); go('twin') }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink-900 px-3 py-2 text-sm font-medium text-white hover:bg-ink-800"><Building2 size={15} /> Follow the cages inside {SITES[st.atSite].short}</button>}
            </div></Card>
          {live && <Card><CardHead title="Physical TAT240 · live" sub="IMEI 862129084785066" /><div className="p-4 text-xs text-slate-600">Fix {new Date(live.ts).toLocaleTimeString()} · {live.lat.toFixed(5)}, {live.lng.toFixed(5)} · {Math.round(live.speed_kmh)} km/h</div></Card>}
        </div>
      </div>
      <Card className="mt-4"><CardHead title="GNSS events" sub="Geofence entries / exits from all trackers" /><EventFeed limit={8} filter={(e) => e.src === 'GNSS'} /></Card>
    </Page>
  )
}
