import { useState } from 'react'
import { Radar, ShieldAlert, Truck, Wallet } from 'lucide-react'
import { FleetMapView } from '../components/FleetMapView'
import { Bar, Card, CardHead, Chip, Kpi, Page } from '../components/ui'
import { fmtT, getWorld, SCANNERS, scannerAt, scannerValue } from '../sim/engine'
import { useSnap } from '../sim/snap'

export default function Assets() {
  const snap = useSnap(); const t = snap.t; const w = getWorld(); const [sel, setSel] = useState('SC-005')
  const rows = SCANNERS.map((s) => ({ s, st: scannerAt(w.legs, s, t) }))
  const off = rows.filter((r) => r.st.outside).length
  const value = rows.reduce((a, r) => a + scannerValue(r.s), 0)
  const selR = rows.find((r) => r.s.id === sel)!
  const staleH = (r: (typeof rows)[0]) => (t - r.st.lastSeen) / 60
  const tag = (r: (typeof rows)[0]) => (r.st.outside ? ['red', 'OFF-SITE'] : r.st.mode === 'in_transit' ? ['blue', 'IN TRANSIT'] : staleH(r) > 24 ? ['amber', 'STALE'] : r.st.mode === 'at_hub' ? ['slate', 'AT HUB'] : ['green', 'ON-SITE']) as ['red' | 'blue' | 'amber' | 'slate' | 'green', string]
  return (
    <Page title="Community assets" sub="Equipment in the community and where it is.">
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Assets tracked" value={rows.length} icon={<Radar size={15} />} sub="GNSS tier · LTE-M / BLE assist" />
        <Kpi label="Value under watch" value={`£${value.toLocaleString()}`} icon={<Wallet size={15} />} sub="replacement cost" />
        <Kpi label="Off-site now" value={off} tone={off ? 'bad' : 'good'} icon={<ShieldAlert size={15} />} sub="outside its permitted area" />
        <Kpi label="In transit" value={rows.filter((r) => r.st.mode === 'in_transit').length} icon={<Truck size={15} />} sub="inherit courier GNSS" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="overflow-hidden"><CardHead title="Community map" sub="Purple = permitted geofence · red = breach" />
          <FleetMapView vehIds={['V4']} height={470} scanners sites={['HUB', 'COMM']} bounds={[[51.45, -0.3], [51.58, 0.05]]} /></Card>
        <Card><CardHead title="Register" />
          <table className="w-full text-left text-[13px]"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-2">Asset</th><th>Holder · home</th><th>Battery</th><th>Last report</th><th>State</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((r) => { const [tn, tx] = tag(r); return (
              <tr key={r.s.id} onClick={() => setSel(r.s.id)} className={`cursor-pointer ${sel === r.s.id ? 'bg-cyan-50/60' : 'hover:bg-slate-50'}`}>
                <td className="px-4 py-2.5"><div className="font-medium text-slate-900">{r.s.id}</div><div className="max-w-[180px] truncate text-[11px] text-slate-500">{r.s.name}</div></td>
                <td><div className="text-slate-800">{r.s.holder}</div><div className="text-[11px] text-slate-500">{r.s.home}</div></td>
                <td className="w-24"><div className="mono text-xs text-slate-700">{Math.round(r.st.battery)}%</div><Bar v={r.st.battery / 100} color={r.st.battery < 20 ? '#e11d48' : '#10b981'} /></td>
                <td className="mono text-xs text-slate-600">{staleH(r) > 24 ? `${Math.round(staleH(r))} h ago` : `${Math.max(0, Math.round(t - r.st.lastSeen))} min ago`}</td><td><Chip tone={tn}>{tx}</Chip></td></tr>) })}</tbody></table>
          <div className="border-t border-slate-100 p-4 text-xs text-slate-600"><b className="text-slate-900">{selR.s.id}</b> — {selR.st.mode.replace(/_/g, ' ')} · {(selR.st.distFromHome / 1000).toFixed(2)} km from home · {selR.st.pos[0].toFixed(4)}, {selR.st.pos[1].toFixed(4)} · alerts: {w.alerts.filter((a) => a.subject === sel && a.t <= t).map((a) => `${a.rule} (${fmtT(a.t).slice(0, 5)})`).join(', ') || 'none'}</div></Card>
      </div>
    </Page>
  )
}
