import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, Droplets, Leaf, PackageCheck, Recycle } from 'lucide-react'
import { Card, CardHead, Chip, Kpi, Page } from '../components/ui'
import { fmtT, getWorld } from '../sim/engine'
import { PRODUCTS } from '../sim/world'
import { useSnap } from '../sim/snap'

const SCALE = 2400 / 72 // pilot sample → 300-bed hospital daily item flow
export default function Esg() {
  const snap = useSnap(); const t = snap.t; const w = getWorld()
  const uses = useMemo(() => w.events.filter((e) => e.src === 'QR' && e.title.includes('USE')).map((e) => ({ t: e.t, p: w.items[e.item!].type })), [])
  const upTo = uses.filter((u) => u.t <= t)
  const co2 = upTo.reduce((a, u) => a + (u.p.co2New - u.p.co2Cycle), 0)
  const water = upTo.reduce((a, u) => a + (u.p.waterCycle * 0.4), 0)
  const series = useMemo(() => { const r: { h: string; co2: number }[] = []; for (let m = 300; m <= 1890; m += 60) r.push({ h: fmtT(m).slice(0, 5), co2: Math.round(uses.filter((u) => u.t <= m).reduce((a, u) => a + u.p.co2New - u.p.co2Cycle, 0)) }); return r }, [uses])
  const byProd = PRODUCTS.map((p) => ({ name: p.name.replace('Instrument tray set', 'Tray set'), co2: Math.round(upTo.filter((u) => u.p.sku === p.sku).reduce((a, u) => a + u.p.co2New - u.p.co2Cycle, 0)) }))
  const missing = snap.loc.filter((l) => l.status === 'missing').length
  const invValue = w.items.reduce((a, i) => a + i.type.unitValue, 0)
  const verifiedKg = t >= 665 ? 142 : 0, unverifiedKg = t >= 760 ? 168 : 0
  const pie = [{ name: 'Verified recycled', v: verifiedKg, c: '#10b981' }, { name: 'Unverified / withheld', v: unverifiedKg, c: '#e11d48' }, { name: 'Awaiting receipt', v: 310 - verifiedKg - unverifiedKg, c: '#cbd5e1' }]
  const annual = co2 * SCALE * 365 / 1000
  const rows: [string, string, string, string][] = [
    ['E5-4 Resource inflows · reusable textile re-use', `${upTo.length} clinical uses`, 'QR scan + RFID', 'Measured'],
    ['E5-5 Resource outflows · waste to recycling (verified)', `${verifiedKg} kg`, 'RFID weighbridge + GNSS', 'Measured · verified'],
    ['E5-5 Waste diverted — unverified destination', `${unverifiedKg} kg`, 'GNSS exception', 'Flagged'],
    ['E1-6 GHG avoided vs single-use (ISO 14040)', `${co2.toFixed(0)} kg CO₂e`, 'Cycle LCA factors', 'Modelled · secondary data'],
    ['E3 Water avoided (net of laundering)', `${water.toFixed(0)} L`, 'Cycle LCA factors', 'Modelled'],
    ['Inventory shrinkage', `${((missing / snap.loc.length) * 100).toFixed(1)} %`, 'RFID reconciliation', 'Measured'],
  ]
  const download = (kind: 'json' | 'csv') => {
    const data = rows.map(([metric, value, source, quality]) => ({ metric, value, source, quality, generated_at_sim: fmtT(t), standard: 'ISO 14040/14044' }))
    const body = kind === 'json' ? JSON.stringify(data, null, 2) : ['metric,value,source,quality,generated_at_sim,standard', ...data.map((d) => Object.values(d).map((x) => `"${x}"`).join(','))].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: kind === 'json' ? 'application/json' : 'text/csv' })); a.download = `textrak-csrd-${kind === 'json' ? 'datapoints.json' : 'datapoints.csv'}`; a.click()
  }
  return (
    <Page title="Sustainability · CSRD" sub="Auditable ISO 14040 LCA metrics, fused with verified (GNSS + RFID) end-of-life evidence."
      right={<div className="flex gap-2"><button onClick={() => download('csv')} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200"><Download size={13} /> CSV</button><button onClick={() => download('json')} className="flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-white"><Download size={13} /> CSRD datapoints (JSON)</button></div>}>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="CO₂e avoided today (pilot)" value={`${co2.toFixed(0)} kg`} tone="good" icon={<Leaf size={15} />} sub={`≈ ${annual.toFixed(0)} t / yr projected for a 300-bed hospital`} />
        <Kpi label="Water avoided" value={`${water.toFixed(0)} L`} icon={<Droplets size={15} />} sub="net of laundering" />
        <Kpi label="Verified recycled" value={`${verifiedKg} kg`} tone="good" icon={<Recycle size={15} />} sub={unverifiedKg ? `${unverifiedKg} kg withheld — chain broken` : 'chain-of-custody certified'} />
        <Kpi label="Shrinkage" value={`${((missing / snap.loc.length) * 100).toFixed(1)}%`} tone={missing ? 'warn' : 'good'} icon={<PackageCheck size={15} />} sub={`£${invValue.toLocaleString()} sample inventory · baseline 10–20%/yr`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2"><CardHead title="Cumulative CO₂e avoided" sub="Per clinical use: single-use equivalent footprint − laundering footprint" />
          <div className="h-[280px] p-3"><ResponsiveContainer><LineChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="#e5ebf2" /><XAxis dataKey="h" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Line dataKey="co2" name="kg CO₂e" stroke="#059669" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div></Card>
        <Card><CardHead title="Recycling provenance" sub="kg of end-of-life textile" />
          <div className="h-[240px]"><ResponsiveContainer><PieChart><Pie data={pie} dataKey="v" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>{pie.map((p, i) => <Cell key={i} fill={p.c} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div></Card>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card><CardHead title="By product" sub="kg CO₂e avoided so far" /><div className="h-[260px] p-3"><ResponsiveContainer><BarChart data={byProd}><CartesianGrid strokeDasharray="3 3" stroke="#e5ebf2" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="co2" fill="#06b6d4" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card><CardHead title="CSRD / ESRS datapoints" sub="Audit-ready, each with source and data-quality class" />
          <table className="w-full text-left text-[12.5px]"><tbody className="divide-y divide-slate-100">{rows.map(([m, v, s, q]) => <tr key={m}><td className="px-4 py-2.5 text-slate-800">{m}</td><td className="mono font-medium text-slate-900">{v}</td><td className="text-slate-500">{s}</td><td><Chip tone={q.startsWith('Measured') ? 'green' : q === 'Flagged' ? 'red' : 'amber'}>{q}</Chip></td></tr>)}</tbody></table></Card>
      </div>
      <Card className="mt-4 p-5"><h3 className="text-sm font-semibold text-slate-900">ISO 14040 / 14044 methodology</h3>
        <div className="mt-3 grid gap-3 text-xs text-slate-600 md:grid-cols-4">{[['Goal & scope', 'Compare reusable laundered textiles with single-use equivalents for one clinical use. Boundary: cradle-to-grave incl. transport and end-of-life.'], ['Inventory (LCI)', 'Per-SKU factors for production, laundering (water, energy, chemicals) and transport; trip distance measured from GNSS, not estimated.'], ['Impact (LCIA)', 'GWP100 (kg CO₂e) and water consumption; factors stored in product_types and versioned.'], ['Interpretation', 'Verified recycling credit only allocated when custody chain is complete — protects against over-claiming.']].map(([a, b]) => <div key={a} className="rounded-lg bg-slate-50 p-3"><div className="mb-1 font-semibold text-slate-800">{a}</div>{b}</div>)}</div></Card>
    </Page>
  )
}
