import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Boxes, CheckCircle2, Info, MapPinned, Package, PackageMinus, PackagePlus, ScanBarcode, Sparkles, Tags } from 'lucide-react'
import { Page } from '../components/ui'
import { go, useStore } from '../store'
import { hasFeature } from '../sim/registry'
import { supabase } from '../lib/supabase'
import { buildFocus, useInsights, type Sev } from './intel'
import { fmtMoney, fmtQty, fmtWhen, KIND_LABEL, STATUS_LABEL, useIndex, useWh, useWhOrg, type Status } from './store'
import { Empty, Pill, Section } from './ui'

const SEV: Record<Sev, { dot: string; chip: 'red' | 'amber' | 'blue' | 'slate'; label: string }> = { critical: { dot: '#e11d48', chip: 'red', label: 'Urgent' }, high: { dot: '#f97316', chip: 'amber', label: 'Soon' }, medium: { dot: '#f59e0b', chip: 'amber', label: 'Watch' }, info: { dot: '#6759e4', chip: 'blue', label: 'Idea' } }
interface Move { id: number; created_at: string; kind: string; item_id: string; qty: number; from_loc: string | null; to_loc: string | null; ref: string | null; by_name: string }
const BAR: Record<Status, string> = { available: '#10b981', quarantine: '#f59e0b', repair: '#6759e4', scrap: '#e11d48' }

export default function Dashboard() {
  const { data, error } = useInsights(); const ix = useIndex(); const org = useWhOrg(); const role = useStore((s) => s.role); const stock = useWh((s) => s.stock); const [moves, setMoves] = useState<Move[]>([])
  useEffect(() => { let on = true; void supabase.from('wh_moves').select('id,created_at,kind,item_id,qty,from_loc,to_loc,ref,by_name').eq('org_id', org).order('created_at', { ascending: false }).limit(8).then(({ data: d }) => { if (on) setMoves((d ?? []) as Move[]) }); return () => { on = false } }, [org, stock])
  const focus = useMemo(() => (data ? buildFocus(data) : []), [data])
  const byStatus = useMemo(() => { const t: Record<Status, number> = { available: 0, quarantine: 0, repair: 0, scrap: 0 }; for (const s of stock) t[s.status] += s.qty; return t }, [stock])
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0)
  const urgent = focus.filter((f) => f.sev === 'critical' || f.sev === 'high').length
  const can = (f: string) => hasFeature(role, f)
  const empty = ix.items.length === 0
  const ACTIONS = [{ id: 'whscan', label: 'Smart scan', icon: <ScanBarcode size={20} /> }, { id: 'whreceive', label: 'Goods in', icon: <PackagePlus size={20} /> }, { id: 'whissue', label: 'Goods out', icon: <PackageMinus size={20} /> }, { id: 'whpack', label: 'Pack order', icon: <Package size={20} /> }].filter((a) => can(a.id))

  return (
    <Page title="Warehouse" sub="Any product, tracked by QR, barcode or RFID. See what is where, what is running low and what needs attention.">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-950 via-ink-900 to-[#2a2470] p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-500/25 blur-3xl" /><div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-2 text-[13px] font-semibold text-cyan-200"><Sparkles size={15} /> {error ? 'Insights are unavailable right now' : !data ? 'Reading your stock…' : urgent > 0 ? `${urgent} thing${urgent === 1 ? '' : 's'} need${urgent === 1 ? 's' : ''} attention` : 'Everything looks healthy'}</div>
        <div className="relative mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[['Units available', data ? fmtQty(data.summary.units) : '–'], ['Items (SKUs)', data ? fmtQty(data.summary.skus) : '–'], ['Stock value', data ? fmtMoney(data.summary.value) : '–'], ['Orders waiting', data ? fmtQty(data.summary.open_orders) : '–']].map(([l, v]) => (
            <div key={l}><div className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/50">{l}</div><div className="mono mt-1.5 text-[34px] font-semibold leading-none tracking-tight">{v}</div></div>))}
        </div>
        {ACTIONS.length > 0 && <div className="relative mt-7 flex flex-wrap gap-2.5">{ACTIONS.map((a) => <button key={a.id} onClick={() => go(a.id)} className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-[14.5px] font-bold text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20">{a.icon}{a.label}</button>)}</div>}
      </div>

      {empty ? (
        <Section className="mt-6"><Empty icon={<Boxes size={22} />} title="Let’s set up your warehouse" sub="Three quick steps. You can import everything from a spreadsheet.">
          <div className="grid w-full max-w-2xl gap-3 text-left sm:grid-cols-3">
            {[['1', 'Add locations', 'Shelves, bins and zones, each with a code you can print as a QR label.', 'whlocations', <MapPinned key="a" size={18} />], ['2', 'Add items', 'Your products and their barcodes, with reorder levels.', 'whitems', <Tags key="b" size={18} />], ['3', 'Receive stock', 'Scan goods in and put them on a shelf.', 'whreceive', <PackagePlus key="c" size={18} />]].map(([n, t, s, p, ic]) => (
              <button key={n as string} onClick={() => go(p as string)} disabled={!can(p as string)} className="rounded-2xl border border-stone-200 p-4 text-left transition enabled:hover:border-cyan-300 enabled:hover:bg-cyan-50 disabled:opacity-50"><div className="flex items-center gap-2 text-cyan-600">{ic}<span className="mono text-[13px] font-bold">{n}</span></div><div className="mt-2 text-[15px] font-bold text-stone-800">{t}</div><div className="mt-1 text-[13px] leading-snug text-stone-500">{s}</div></button>))}
          </div></Empty></Section>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Section title="What needs your attention" sub="Ranked for you, with the reason for each. Updated as stock moves.">
            {!data ? <p className="py-6 text-center text-[14px] text-stone-400">Reading your stock…</p> : focus.length === 0 ? <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-4 text-[14.5px] font-semibold text-emerald-800"><CheckCircle2 size={20} /> Nothing needs attention. Stock levels, expiry dates and orders all look fine.</div> : (
              <ul className="space-y-2.5">{focus.slice(0, 6).map((f) => (
                <li key={f.id} className="flex items-start gap-3.5 rounded-2xl border border-stone-100 p-4 transition hover:border-stone-200"><i className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEV[f.sev].dot }} />
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[15px] font-bold text-stone-900">{f.title}</span><Pill tone={SEV[f.sev].chip}>{SEV[f.sev].label}</Pill></div><p className="mt-1 text-[13.5px] leading-snug text-stone-500">{f.why}</p></div>
                  {can(f.page) && <button onClick={() => { if (f.prefill) useWh.getState().setPrefill(f.prefill); go(f.page) }} className="flex shrink-0 items-center gap-1 rounded-xl bg-cyan-50 px-3 py-2 text-[13px] font-bold text-cyan-700 hover:bg-cyan-100">{f.label}<ArrowRight size={14} /></button>}</li>))}
              </ul>)}
            {focus.length > 6 && can('whinsights') && <button onClick={() => go('whinsights')} className="mt-3 text-[13.5px] font-bold text-cyan-700">See all {focus.length} →</button>}
          </Section>

          <div className="space-y-6">
            <Section title="Stock by condition" sub={`${fmtQty(total)} units in total`}>
              {total === 0 ? <p className="text-[14px] text-stone-400">No stock yet.</p> : <>
                <div className="flex h-3 overflow-hidden rounded-full bg-stone-100">{(Object.keys(byStatus) as Status[]).filter((k) => byStatus[k] > 0).map((k) => <div key={k} style={{ width: `${(byStatus[k] / total) * 100}%`, background: BAR[k] }} title={STATUS_LABEL[k]} />)}</div>
                <ul className="mt-4 space-y-2">{(Object.keys(byStatus) as Status[]).map((k) => <li key={k} className="flex items-center gap-2.5 text-[14px]"><i className="h-2.5 w-2.5 rounded-full" style={{ background: BAR[k] }} /><span className="flex-1 text-stone-600">{STATUS_LABEL[k]}</span><span className="mono font-semibold text-stone-800">{fmtQty(byStatus[k])}</span></li>)}</ul></>}
            </Section>
            <Section title="Recent activity">
              {moves.length === 0 ? <p className="text-[14px] text-stone-400">Nothing recorded yet.</p> : <ul className="space-y-3">{moves.map((m) => { const it = ix.itemById.get(m.item_id); return (
                <li key={m.id} className="flex items-start gap-3"><Info size={15} className="mt-1 shrink-0 text-stone-300" /><div className="min-w-0 flex-1 text-[13.5px]"><div className="truncate font-semibold text-stone-800">{KIND_LABEL[m.kind] ?? m.kind} · {fmtQty(Math.abs(m.qty))} × {it?.sku ?? '?'}</div><div className="truncate text-stone-400">{m.by_name} · {fmtWhen(m.created_at)}{m.ref ? ` · ${m.ref}` : ''}</div></div></li>) })}</ul>}
              {can('whledger') && moves.length > 0 && <button onClick={() => go('whledger')} className="mt-4 text-[13.5px] font-bold text-cyan-700">Open the full ledger →</button>}
            </Section>
          </div>
        </div>)}
      {error && <p className="mt-4 flex items-center gap-2 text-[13px] text-amber-700"><AlertTriangle size={14} /> {error}</p>}
    </Page>)
}
