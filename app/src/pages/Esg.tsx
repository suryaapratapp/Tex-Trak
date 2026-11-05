import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, Droplets, Leaf, PackageCheck, Recycle } from 'lucide-react'
import { Card, CardHead, Chip, Kpi, Page } from '../components/ui'
import { fmtT, getWorld } from '../sim/engine'
import { PRODUCTS } from '../sim/world'
import { useSnap } from '../sim/snap'


function Roi() {
  const [beds, setBeds] = useState(300); const [spend, setSpend] = useState(4000); const [before, setBefore] = useState(15); const [after, setAfter] = useState(5); const [hours, setHours] = useState(20); const [fee, setFee] = useState(15)
  const spendTotal = beds * spend, lossBefore = (spendTotal * before) / 100, lossAfter = (spendTotal * after) / 100
  const loss = lossBefore - lossAfter, labour = hours * 52 * 18, cost = beds * fee * 12, net = loss + labour - cost
  const payback = net > 0 ? Math.max(0.5, (cost * 0.5) / ((loss + labour) / 12)) : 0
  const co2 = (beds * 150 * 3.4) / 1000
  const money = (n: number) => `£${Math.round(n).toLocaleString()}`
  const Slider = ({ l, v, set, min, max, step = 1, fmt = (x: number) => String(x) }: { l: string; v: number; set: (n: number) => void; min: number; max: number; step?: number; fmt?: (x: number) => string }) => (
    <label className="block"><div className="flex justify-between text-[13px] font-bold text-stone-700"><span>{l}</span><span className="text-stone-900">{fmt(v)}</span></div><input type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(+e.target.value)} className="mt-1 w-full accent-cyan-600" /></label>)
  return (
    <Card className="mb-5 overflow-hidden"><CardHead title="Return on investment" sub="Adjust the assumptions" />
      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4"><Slider l="Hospital beds" v={beds} set={setBeds} min={50} max={1200} step={10} /><Slider l="Annual textile & equipment spend per bed" v={spend} set={setSpend} min={1000} max={8000} step={100} fmt={money} /><Slider l="Loss rate today" v={before} set={setBefore} min={5} max={25} fmt={(x) => `${x}%`} /><Slider l="Loss rate with Tex-Trak" v={after} set={setAfter} min={1} max={15} fmt={(x) => `${x}%`} /><Slider l="Stock-count hours saved per week" v={hours} set={setHours} min={0} max={80} /><Slider l="Platform fee per bed per month" v={fee} set={setFee} min={5} max={40} fmt={money} /></div>
        <div className="grid content-start gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-gradient-to-br from-stone-900 to-cyan-900 p-5 text-white sm:col-span-2"><div className="text-xs font-bold uppercase tracking-wider text-cyan-200">Net benefit per year</div><div className="mt-1 text-4xl font-extrabold">{money(net)}</div><div className="mt-1 text-sm text-white/70">{net > 0 ? `Pays back in about ${payback.toFixed(1)} months` : 'Increase savings or lower the fee'}</div></div>
          {[['Loss avoided', money(loss)], ['Labour saved', money(labour)], ['Platform cost', money(cost)], ['CO₂e avoided', `${co2.toFixed(0)} t / yr`]].map(([l, v]) => <div key={l} className="rounded-2xl bg-stone-50 p-4"><div className="text-xs font-bold text-stone-500">{l}</div><div className="mt-1 text-2xl font-extrabold text-stone-900">{v}</div></div>)}</div>
      </div></Card>)
}

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
    <Page title="Impact" sub="Environmental and financial impact."
      right={<div className="flex gap-2"><button onClick={() => download('csv')} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200"><Download size={13} /> CSV</button><button onClick={() => download('json')} className="flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-white"><Download size={13} /> CSRD datapoints (JSON)</button></div>}>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="CO₂e avoided today (pilot)" value={`${co2.toFixed(0)} kg`} tone="good" icon={<Leaf size={15} />} sub={`≈ ${annual.toFixed(0)} t / yr projected for a 300-bed hospital`} />
        <Kpi label="Water avoided" value={`${water.toFixed(0)} L`} icon={<Droplets size={15} />} sub="net of laundering" />
        <Kpi label="Verified recycled" value={`${verifiedKg} kg`} tone="good" icon={<Recycle size={15} />} sub={unverifiedKg ? `${unverifiedKg} kg withheld — chain broken` : 'chain-of-custody certified'} />
        <Kpi label="Shrinkage" value={`${((missing / snap.loc.length) * 100).toFixed(1)}%`} tone={missing ? 'warn' : 'good'} icon={<PackageCheck size={15} />} sub={`£${invValue.toLocaleString()} sample inventory · baseline 10–20%/yr`} />
      </div>
      <Roi />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2"><CardHead title="Cumulative CO₂e avoided" sub="Per clinical use: single-use equivalent footprint − laundering footprint" />
          <div className="h-[280px] p-3"><ResponsiveContainer><LineChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="#e5ebf2" /><XAxis dataKey="h" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Line dataKey="co2" name="kg CO₂e" stroke="#059669" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div></Card>
        <Card><CardHead title="Recycling provenance" sub="kg of end-of-life textile" />
          <div className="h-[240px]"><ResponsiveContainer><PieChart><Pie data={pie} dataKey="v" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>{pie.map((p, i) => <Cell key={i} fill={p.c} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div></Card>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card><CardHead title="By product" sub="kg CO₂e avoided so far" /><div className="h-[260px] p-3"><ResponsiveContainer><BarChart data={byProd}><CartesianGrid strokeDasharray="3 3" stroke="#e5ebf2" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="co2" fill="#1c1917" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card><CardHead title="CSRD / ESRS datapoints" sub="Audit-ready, each with source and data-quality class" />
          <table className="w-full text-left text-[12.5px]"><tbody className="divide-y divide-slate-100">{rows.map(([m, v, s, q]) => <tr key={m}><td className="px-4 py-2.5 text-slate-800">{m}</td><td className="mono font-medium text-slate-900">{v}</td><td className="text-slate-500">{s}</td><td><Chip tone={q.startsWith('Measured') ? 'green' : q === 'Flagged' ? 'red' : 'amber'}>{q}</Chip></td></tr>)}</tbody></table></Card>
      </div>
    </Page>
  )
}
