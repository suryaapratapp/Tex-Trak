import { useState } from 'react'
import { Download } from 'lucide-react'
import { Page } from '../components/ui'
import { btnGhost, inputCls, Section, Field } from './ui'
import { fmtDate, REASONS, useQr } from './store'

const PERIODS: [string, number][] = [['Last 7 days', 7], ['Last 30 days', 30], ['Last 90 days', 90], ['Last 12 months', 365], ['All time', 99999]]
export default function Reports() {
  const st = useQr(); const [type, setType] = useState<'installed' | 'removed'>('installed'); const [days, setDays] = useState(90); const [site, setSite] = useState('')
  const rows = st.history.filter((h) => h.type === type && h.ts >= Date.now() - days * 86400000 && (!site || h.hospitalId === site))
  const byReason = REASONS.map((r) => ({ r, n: rows.filter((h) => h.reason === r.value).length }))
  const csv = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([['Date,Code,Hospital,Where,Reason,Note', ...rows.map((h) => [fmtDate(h.ts), h.code, st.hospitals.find((x) => x.id === h.hospitalId)?.name ?? '', h.where ?? '', h.reason ?? '', h.notes ?? ''].map((c) => `"${c}"`).join(','))].join('\n')], { type: 'text/csv' })); a.download = `${type}-report.csv`; a.click() }
  return (
    <Page title="Reports" sub="Installations and take-downs over time" right={<button onClick={csv} className={`${btnGhost} flex items-center gap-2`}><Download size={16} /> Export CSV</button>}>
      <div className="mx-auto max-w-[1100px] space-y-6">
        <Section><div className="grid gap-4 sm:grid-cols-3"><Field label="Report type"><select value={type} onChange={(e) => setType(e.target.value as 'installed' | 'removed')} className={inputCls}><option value="installed">Installations</option><option value="removed">Take-downs</option></select></Field><Field label="Period"><select value={days} onChange={(e) => setDays(+e.target.value)} className={inputCls}>{PERIODS.map(([l, d]) => <option key={l} value={d}>{l}</option>)}</select></Field><Field label="Hospital"><select value={site} onChange={(e) => setSite(e.target.value)} className={inputCls}><option value="">All hospitals</option>{st.hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field></div></Section>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><div className="card p-5"><div className="text-[34px] font-extrabold leading-none text-cyan-700">{rows.length}</div><div className="mt-2 text-[15px] font-bold text-stone-700">Records</div></div>{type === 'removed' && byReason.map(({ r, n }) => <div key={r.value} className="card p-5"><div className="text-[34px] font-extrabold leading-none text-stone-900">{n}</div><div className="mt-2 text-[15px] font-bold text-stone-700">{r.label}</div></div>)}</div>
        <div className="card overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[14.5px]"><thead className="bg-stone-50 text-[12px] uppercase tracking-wider text-stone-500"><tr><th>Date</th><th>Code</th><th>Hospital</th><th>Where</th>{type === 'removed' && <th>Reason</th>}</tr></thead>
          <tbody className="divide-y divide-stone-100">{rows.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-stone-400">Nothing to report. Try a wider period or a different filter.</td></tr>}{rows.slice(0, 200).map((h) => <tr key={h.id}><td>{fmtDate(h.ts)}</td><td className="mono font-bold">{h.code}</td><td>{st.hospitals.find((x) => x.id === h.hospitalId)?.name}</td><td className="text-stone-600">{h.where}</td>{type === 'removed' && <td>{REASONS.find((r) => r.value === h.reason)?.label}</td>}</tr>)}</tbody></table></div>
      </div>
    </Page>)
}
