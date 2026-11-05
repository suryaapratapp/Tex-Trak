import { useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Download, Upload } from 'lucide-react'
import { Page } from '../components/ui'
import { btnGhost, Notice, Section, useFlash } from './ui'
import { useQr } from './store'

const parseCsv = (t: string) => { const lines = t.split(/\r?\n/).filter((l) => l.trim()); if (!lines.length) return []; const split = (l: string) => l.split(',').map((c) => c.replace(/^"|"$/g, '').trim()); const head = split(lines[0]).map((h) => h.toLowerCase()); const col = (n: string) => head.findIndex((h) => h.startsWith(n))
  const [h, c, f, w, b] = [col('hospital'), col('code'), col('floor'), col('ward'), col('bay')]; if (h < 0 || w < 0 || b < 0) return null
  return lines.slice(1).map(split).filter((r) => r[h] && r[w] && r[b]).map((r) => ({ hospital: r[h], code: c >= 0 ? r[c] : undefined, floor: f >= 0 ? r[f] : undefined, ward: r[w], bay: r[b] })) }

export default function Locations() {
  const { hospitals, locs, products, importLocations } = useQr(); const [open, setOpen] = useState<string | null>(null); const file = useRef<HTMLInputElement>(null); const { flash, ok, err, clear } = useFlash()
  const download = (name: string, text: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = name; a.click() }
  const onFile = async (f?: File) => { if (!f) return; const rows = parseCsv(await f.text()); if (!rows) return err('The file needs Hospital, Ward and Bay columns.'); const r = importLocations(rows); ok(r.added ? `${r.added} new locations added${r.hospitals ? `, ${r.hospitals} new hospital${r.hospitals > 1 ? 's' : ''}` : ''}.` : 'Nothing new: every row was already on the system.') }
  const bayCount = (h: string) => locs.filter((l) => l.hospitalId === h).length
  return (
    <Page title="Locations" sub={`${hospitals.length} hospitals · ${locs.length} bays`} right={<button onClick={() => download('locations.csv', 'Hospital,Code,Floor,Ward,Bay\n' + locs.map((l) => { const h = hospitals.find((x) => x.id === l.hospitalId)!; return [h.name, h.code, l.floor, l.ward, l.bay].join(',') }).join('\n'))} className={`${btnGhost} flex items-center gap-2`}><Download size={16} /> Export CSV</button>}>
      <div className="mx-auto max-w-[1000px] space-y-6">
        <Section title="Import a location list" sub={<>Upload Synergy&rsquo;s CSV for a hospital. Columns needed: <b>Hospital</b>, <b>Floor</b>, <b>Ward</b>, <b>Bay</b> (an optional <b>Code</b> column sets the hospital&rsquo;s short code). Existing locations are left untouched; only new ones are added.</>}>
          <div className="grid gap-3 sm:grid-cols-2"><input ref={file} type="file" accept=".csv,text/csv" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
            <button onClick={() => file.current?.click()} className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 py-3.5 text-[15px] font-bold text-white hover:bg-cyan-700"><Upload size={17} /> Choose CSV file</button>
            <button onClick={() => download('locations-template.csv', 'Hospital,Code,Floor,Ward,Bay\nQueen Mary Hospital,QMH,Ground,Emergency Ward,Bay E1\nQueen Mary Hospital,QMH,Level 1,Surgical Ward,Bay S1\n')} className={btnGhost}>Download template</button></div>
          {flash && <div className="mt-4"><Notice kind={flash.kind} onClose={clear}>{flash.text}</Notice></div>}</Section>
        <Section title="Current locations"><div className="space-y-3">{hospitals.map((h) => { const mine = locs.filter((l) => l.hospitalId === h.id); const floors = [...new Set(mine.map((l) => l.floor))]; const isOpen = open === h.id; return (
          <div key={h.id} className="rounded-2xl border border-stone-100"><button onClick={() => setOpen(isOpen ? null : h.id)} className="flex w-full items-center justify-between px-5 py-4 text-left"><span><span className="block text-[17px] font-extrabold text-stone-900">{h.name}</span><span className="text-[14px] text-stone-500">{floors.length} floors · {bayCount(h.id)} bays</span></span>{isOpen ? <ChevronUp size={19} className="text-stone-400" /> : <ChevronDown size={19} className="text-stone-400" />}</button>
            {isOpen && <div className="space-y-4 border-t border-stone-100 px-5 py-4">{floors.map((f) => <div key={f}><div className="mb-2 text-[12.5px] font-extrabold uppercase tracking-wider text-stone-400">{f}</div>{[...new Set(mine.filter((l) => l.floor === f).map((l) => l.ward))].map((w) => <div key={w} className="mb-2"><div className="mb-1.5 text-[14.5px] font-bold text-stone-800">{w}</div><div className="flex flex-wrap gap-2">{mine.filter((l) => l.floor === f && l.ward === w).map((l) => { const used = Object.values(products).some((p) => p.status === 'in_use' && p.place?.hospitalId === h.id && p.place.ward === l.ward && p.place.bay === l.bay); return <span key={l.id} className={`rounded-lg px-3 py-1.5 text-[13px] font-bold ${used ? 'bg-cyan-50 text-cyan-800' : 'bg-stone-100 text-stone-500'}`}>{l.bay}</span> })}</div></div>)}</div>)}</div>}</div>) })}</div></Section>
      </div>
    </Page>)
}
