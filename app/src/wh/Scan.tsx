import { useEffect, useState } from 'react'
import { ArrowLeftRight, ClipboardCheck, MapPin, Package, PackageMinus, Pencil, ScanBarcode, Sparkles, Tags, TriangleAlert, Wrench } from 'lucide-react'
import { Page } from '../components/ui'
import { go, useStore } from '../store'
import { hasFeature } from '../sim/registry'
import { supabase } from '../lib/supabase'
import { daysTo, fmtDate, fmtMoney, fmtQty, locName, onHand, planPick, STATUS_LABEL, useIndex, useWh, useWhOrg, type Index, type Item, type Loc, type Prefill } from './store'
import { btnGhost, Empty, ExpiryChip, Meter, OmniInput, Pill, Section, StatusPill, TD, TH } from './ui'

type View = { kind: 'item'; item: Item } | { kind: 'loc'; loc: Loc } | { kind: 'order'; number: string } | { kind: 'unknown'; code: string }
interface OrderBrief { number: string; customer: string; status: string; reference: string; packed_at: string; lines: { item_id: string; qty: number; unpacked_qty: number; location_id: string; lot: string }[] }

function hints(ix: Index, it: Item): { tone: 'amber' | 'red' | 'blue'; text: string }[] {
  const out: { tone: 'amber' | 'red' | 'blue'; text: string }[] = []
  const avail = onHand(ix, it.id); const rows = ix.stockByItem.get(it.id) ?? []
  if (avail <= 0 && rows.length === 0) out.push({ tone: 'red', text: 'There is none of this in stock.' })
  else if (it.reorderPoint > 0 && avail <= it.reorderPoint) out.push({ tone: 'amber', text: `Low: ${fmtQty(avail)} available, reorder level is ${fmtQty(it.reorderPoint)}${it.reorderQty ? `. Usual order: ${fmtQty(it.reorderQty)}.` : '.'}` })
  const exp = rows.filter((r) => r.status === 'available' && r.expiry).sort((a, b) => a.expiry!.localeCompare(b.expiry!))[0]
  if (exp) { const d = daysTo(exp.expiry!); if (d < 0) out.push({ tone: 'red', text: `Lot ${exp.lot || '(none)'} at ${locName(ix, exp.locId)} expired on ${fmtDate(exp.expiry)}. It will not be picked.` }); else if (d <= 30) out.push({ tone: 'amber', text: `Lot ${exp.lot || '(none)'} at ${locName(ix, exp.locId)} expires in ${d} day${d === 1 ? '' : 's'}. It will be picked first.` }) }
  const held = rows.filter((r) => r.status !== 'available').reduce((a, r) => a + r.qty, 0)
  if (held > 0) out.push({ tone: 'blue', text: `${fmtQty(held)} unit${held === 1 ? ' is' : 's are'} on hold, in repair or beyond repair.` })
  const best = planPick(ix, it.id, 1).picks[0]
  if (best && out.length === 0) out.push({ tone: 'blue', text: `Best place to pick from: ${locName(ix, best.locId)}${best.lot ? `, lot ${best.lot}` : ''}${best.expiry ? ` (expires ${fmtDate(best.expiry)})` : ''}.` })
  return out
}

export default function Scan() {
  const ix = useIndex(); const role = useStore((s) => s.role); const org = useWhOrg(); const [view, setView] = useState<View | null>(null); const [recent, setRecent] = useState<View[]>([]); const [order, setOrder] = useState<OrderBrief | null | 'none' | 'offline'>(null)
  const can = (f: string) => hasFeature(role, f)
  const show = (v: View) => { setView(v); setRecent((r) => [v, ...r.filter((x) => JSON.stringify(x) !== JSON.stringify(v))].slice(0, 6)) }
  const to = (page: string, p: Prefill) => { useWh.getState().setPrefill(p); go(page) }
  useEffect(() => {
    if (view?.kind !== 'order') { setOrder(null); return }
    let on = true; setOrder(null)
    void supabase.from('wh_orders').select('number,customer,status,reference,packed_at,wh_order_lines(item_id,qty,unpacked_qty,location_id,lot)').eq('org_id', org).eq('number', view.number).maybeSingle().then(({ data, error }) => { if (on) setOrder(error ? 'offline' : data ? { ...data, lines: (data as unknown as { wh_order_lines: OrderBrief['lines'] }).wh_order_lines } as OrderBrief : 'none') })
    return () => { on = false }
  }, [view, org])

  const Act = ({ icon, label, page, f, p }: { icon: React.ReactNode; label: string; page: string; f: string; p: Prefill }) => can(f) ? <button onClick={() => to(page, p)} className={btnGhost + ' flex items-center gap-2 !px-4 !py-2.5 !text-[14px]'}>{icon}{label}</button> : null

  return (
    <Page title="Smart scan" sub="Scan anything: an item, a shelf or an order. You will see what it is, where it is, and what to do next.">
      <div className="mx-auto max-w-[1100px] space-y-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-950 to-[#2a2470] p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-500/25 blur-3xl" />
          <div className="relative rounded-2xl bg-white p-5"><OmniInput kind="any" label="Scan or search" hint="Works with a camera, a Bluetooth or USB scanner, or an RFID handheld that types. You can also type part of a name." onItem={(item) => show({ kind: 'item', item })} onLoc={(loc) => show({ kind: 'loc', loc })} onOrder={(number) => show({ kind: 'order', number })} onUnknown={(code) => show({ kind: 'unknown', code })} /></div>
          {recent.length > 1 && <div className="relative mt-4 flex flex-wrap items-center gap-2"><span className="text-[12.5px] font-semibold text-white/50">Recent</span>{recent.slice(1).map((r, i) => <button key={i} onClick={() => setView(r)} className="rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold text-white ring-1 ring-white/15 hover:bg-white/20">{r.kind === 'item' ? r.item.sku : r.kind === 'loc' ? r.loc.code : r.kind === 'order' ? r.number : r.code}</button>)}</div>}
        </div>

        {!view && <Section><Empty icon={<ScanBarcode size={22} />} title="Ready when you are" sub="Point the camera at a QR code or barcode, or scan with your handheld." /></Section>}

        {view?.kind === 'unknown' && (
          <Section><Empty icon={<TriangleAlert size={22} />} title={`“${view.code}” is not in the system`} sub="It might be a new item or a new location. Check the code, or add it now.">
            {can('whitems') && <button onClick={() => to('whitems', { code: view.code })} className="rounded-2xl bg-cyan-600 px-5 py-3 text-[15px] font-bold text-white hover:bg-cyan-700">Add as an item</button>}
            {can('whlocations') && <button onClick={() => to('whlocations', { code: view.code })} className={btnGhost}>Add as a location</button>}
          </Empty></Section>)}

        {view?.kind === 'item' && (() => { const it = view.item; const rows = [...(ix.stockByItem.get(it.id) ?? [])].sort((a, b) => (a.expiry ?? '9').localeCompare(b.expiry ?? '9')); const avail = onHand(ix, it.id); const hs = hints(ix, it); return (
          <Section>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><div className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wide text-cyan-600"><Tags size={14} /> Item</div><h2 className="mt-1 text-[24px] font-extrabold tracking-tight text-stone-900">{it.name}</h2><div className="mono mt-1 text-[14px] text-stone-500">{it.sku}{it.barcode ? ` · ${it.barcode}` : ''}{it.category ? ` · ${it.category}` : ''}</div></div>
              <div className="text-right"><div className="text-[12px] font-bold uppercase tracking-wide text-stone-400">Available</div><div className="mono text-[34px] font-semibold leading-none text-stone-900">{fmtQty(avail)}</div><div className="mt-1 text-[13px] text-stone-400">{it.uom}{it.unitCost ? ` · ${fmtMoney(avail * it.unitCost)}` : ''}</div></div>
            </div>
            {hs.length > 0 && <ul className="mt-5 space-y-2">{hs.map((h, i) => <li key={i} className={`flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[14px] font-semibold ${h.tone === 'red' ? 'bg-rose-50 text-rose-800' : h.tone === 'amber' ? 'bg-amber-50 text-amber-900' : 'bg-cyan-50 text-cyan-900'}`}><Sparkles size={16} className="mt-0.5 shrink-0" />{h.text}</li>)}</ul>}
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Act icon={<ArrowLeftRight size={16} />} label="Move" page="whmove" f="whmove" p={{ itemId: it.id }} /><Act icon={<PackageMinus size={16} />} label="Goods out" page="whissue" f="whissue" p={{ itemId: it.id }} /><Act icon={<Package size={16} />} label="Pack" page="whpack" f="whpack" p={{ itemId: it.id }} />
              <Act icon={<Wrench size={16} />} label="Damage or hold" page="whstock" f="whstock" p={{ itemId: it.id }} /><Act icon={<Pencil size={16} />} label="Edit item" page="whitems" f="whitems" p={{ itemId: it.id }} />
            </div>
            <div className="-mx-2 mt-5 overflow-x-auto">{rows.length === 0 ? <p className="px-2 py-4 text-[14px] text-stone-400">No stock anywhere.</p> : <table className="w-full text-[14px]"><thead><tr><th className={TH}>Location</th><th className={TH}>Lot</th><th className={TH}>Expiry</th><th className={TH}>Condition</th><th className={TH + ' text-right'}>Qty</th></tr></thead>
              <tbody>{rows.map((r, i) => <tr key={i}><td className={TD + ' mono font-semibold'}><button className="hover:text-cyan-700" onClick={() => show({ kind: 'loc', loc: ix.locById.get(r.locId)! })}>{locName(ix, r.locId)}</button></td><td className={TD + ' mono'}>{r.lot || '–'}</td><td className={TD}><ExpiryChip date={r.expiry} /></td><td className={TD}><StatusPill s={r.status} /></td><td className={TD + ' mono text-right font-semibold'}>{fmtQty(r.qty)}</td></tr>)}</tbody></table>}</div>
          </Section>) })()}

        {view?.kind === 'loc' && (() => { const l = view.loc; const rows = (ix.stockByLoc.get(l.id) ?? []).slice().sort((a, b) => (ix.itemById.get(a.itemId)?.sku ?? '').localeCompare(ix.itemById.get(b.itemId)?.sku ?? '')); const used = rows.reduce((a, r) => a + r.qty, 0); return (
          <Section>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><div className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wide text-cyan-600"><MapPin size={14} /> Location · {l.kind}</div><h2 className="mono mt-1 text-[24px] font-extrabold tracking-tight text-stone-900">{l.code}</h2>{l.name !== l.code && <div className="text-[14px] text-stone-500">{l.name}</div>}{!l.active && <Pill tone="red">Switched off</Pill>}</div>
              <div className="w-56 text-right"><div className="mono text-[28px] font-semibold text-stone-900">{fmtQty(used)}</div><div className="text-[13px] text-stone-400">units{l.capacity ? ` of ${fmtQty(l.capacity)}` : ''}</div>{l.capacity ? <div className="mt-2"><Meter v={used / l.capacity} tone={used > l.capacity ? 'red' : used / l.capacity > 0.9 ? 'amber' : 'cyan'} /></div> : null}</div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2.5"><Act icon={<ClipboardCheck size={16} />} label="Count this location" page="whcount" f="whcount" p={{ locId: l.id }} /><Act icon={<ArrowLeftRight size={16} />} label="Move from here" page="whmove" f="whmove" p={{ locId: l.id }} /><Act icon={<Tags size={16} />} label="Print label" page="whlabels" f="whlabels" p={{ locId: l.id }} /></div>
            <div className="-mx-2 mt-5 overflow-x-auto">{rows.length === 0 ? <p className="px-2 py-4 text-[14px] text-stone-400">This location is empty.</p> : <table className="w-full text-[14px]"><thead><tr><th className={TH}>Item</th><th className={TH}>Lot</th><th className={TH}>Expiry</th><th className={TH}>Condition</th><th className={TH + ' text-right'}>Qty</th></tr></thead>
              <tbody>{rows.map((r, i) => { const it = ix.itemById.get(r.itemId); return <tr key={i}><td className={TD}><button className="text-left hover:text-cyan-700" onClick={() => it && show({ kind: 'item', item: it })}><div className="font-semibold text-stone-800">{it?.name}</div><div className="mono text-[12px] text-stone-400">{it?.sku}</div></button></td><td className={TD + ' mono'}>{r.lot || '–'}</td><td className={TD}><ExpiryChip date={r.expiry} /></td><td className={TD}><StatusPill s={r.status} /></td><td className={TD + ' mono text-right font-semibold'}>{fmtQty(r.qty)}</td></tr> })}</tbody></table>}</div>
          </Section>) })()}

        {view?.kind === 'order' && (
          <Section>
            {order === null ? <p className="py-6 text-center text-stone-400">Looking up {view.number}…</p> : order === 'offline' ? <Empty icon={<TriangleAlert size={22} />} title="Orders need a connection" sub="Try again when you are online." /> : order === 'none' ? <Empty icon={<TriangleAlert size={22} />} title={`No order ${view.number}`} sub="Check the number. Receipts (GI) and goods-out notes (GO) are listed in the ledger." /> : <>
              <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wide text-cyan-600"><Package size={14} /> Pack order</div><h2 className="mono mt-1 text-[24px] font-extrabold text-stone-900">{order.number}</h2><div className="text-[14px] text-stone-500">{order.customer}{order.reference ? ` · ${order.reference}` : ''}</div></div><Pill tone={order.status === 'dispatched' ? 'green' : order.status === 'unpacked' ? 'slate' : 'amber'}>{order.status.replace('_', ' ')}</Pill></div>
              <p className="mt-4 text-[14px] text-stone-600">{order.lines.length} line{order.lines.length === 1 ? '' : 's'}, {fmtQty(order.lines.reduce((a, l) => a + l.qty - l.unpacked_qty, 0))} units still packed.</p>
              {can('whorders') && <button onClick={() => { useWh.setState({ orderFocus: order.number }); go('whorders') }} className="mt-4 rounded-2xl bg-cyan-600 px-5 py-3 text-[15px] font-bold text-white hover:bg-cyan-700">Open order</button>}</>}
          </Section>)}
        {view && <p className="text-center text-[12.5px] text-stone-400">{STATUS_LABEL.available} stock is what can be picked. Held, repair and beyond-repair stock is shown separately.</p>}
      </div>
    </Page>)
}
