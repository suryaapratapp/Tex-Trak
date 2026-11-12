import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { Page } from '../components/ui'
import { go, useStore } from '../store'
import { hasFeature } from '../sim/registry'
import { buildFocus, useInsights, type Sev } from './intel'
import { csvDownload, fmtDate, fmtMoney, fmtQty, fmtWhen, KIND_LABEL, useWh } from './store'
import { btnGhost, ExpiryChip, Meter, Pill, Section, TD, TH } from './ui'

const SEV_TONE: Record<Sev, 'red' | 'amber' | 'blue' | 'slate'> = { critical: 'red', high: 'amber', medium: 'amber', info: 'blue' }
const Stat = ({ l, v, tone }: { l: string; v: string | number; tone?: string }) => <div className="card p-4"><div className="text-[12px] font-bold uppercase tracking-wide text-stone-400">{l}</div><div className={`mono mt-1.5 text-[26px] font-semibold ${tone ?? 'text-stone-900'}`}>{v}</div></div>
const Why = ({ children }: { children: string }) => <p className="mb-3 text-[13.5px] leading-snug text-stone-500">{children}</p>
const None = ({ children }: { children: string }) => <p className="py-3 text-[14px] text-stone-400">{children}</p>

export default function Insights() {
  const { data, error, loading } = useInsights(); const role = useStore((s) => s.role)
  const focus = useMemo(() => (data ? buildFocus(data) : []), [data])
  if (loading && !data) return <Page title="Stock insights"><p className="p-10 text-center text-stone-400">Reading your stock…</p></Page>
  if (!data) return <Page title="Stock insights"><p className="p-10 text-center text-rose-600">{error || 'Could not load the insights.'}</p></Page>
  const d = data
  return (
    <Page title="Stock insights" sub="What the numbers say about your stock, in plain words. Based on the last 30 and 90 days of movement.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat l="Need reordering" v={d.summary.low} tone={d.summary.low ? 'text-amber-600' : undefined} /><Stat l="Out of stock" v={d.summary.out_of_stock} tone={d.summary.out_of_stock ? 'text-rose-600' : undefined} />
        <Stat l="Expiring in 30 days" v={d.expiry.d30 + d.expiry.expired} tone={d.expiry.d30 + d.expiry.expired ? 'text-amber-600' : undefined} /><Stat l="Value at risk (expiry)" v={fmtMoney(d.expiry.value_at_risk)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Section title="Today’s focus" sub="The short list, in order of importance.">
          {focus.length === 0 ? <None>Nothing needs attention right now.</None> : <ul className="space-y-2.5">{focus.map((f) => <li key={f.id} className="rounded-2xl border border-stone-100 p-3.5"><div className="flex flex-wrap items-center gap-2"><span className="text-[14.5px] font-bold text-stone-900">{f.title}</span><Pill tone={SEV_TONE[f.sev]}>{f.sev}</Pill></div><p className="mt-1 text-[13px] text-stone-500">{f.why}</p>{hasFeature(role, f.page) && <button onClick={() => { if (f.prefill) useWh.getState().setPrefill(f.prefill); go(f.page) }} className="mt-2 text-[13px] font-bold text-cyan-700">{f.label} →</button>}</li>)}</ul>}
        </Section>

        <Section title="Suggested reorders" sub="Worked out from how fast each item is used, how long the supplier takes, and what is on the shelf."
          right={d.reorder.length > 0 ? <button onClick={() => csvDownload('reorder-list.csv', [['SKU', 'Item', 'Supplier', 'Available', 'Used per day', 'Days of cover', 'Lead time (days)', 'Suggested order'], ...d.reorder.map((r) => [r.sku, r.name, r.supplier, r.avail, r.vel.toFixed(2), r.cover ?? '', r.lead_time_days, r.sugg])])} className={btnGhost + ' !px-3 !py-1.5 !text-[13px]'}><Download size={14} className="mr-1 inline" />CSV</button> : undefined}>
          {d.reorder.length === 0 ? <None>Everything is above its reorder level and has enough cover.</None> : (
            <div className="-mx-2 overflow-x-auto"><table className="w-full text-[14px]"><thead><tr><th className={TH}>Item</th><th className={TH + ' text-right'}>Have</th><th className={TH + ' text-right'}>Cover</th><th className={TH + ' text-right'}>Order</th></tr></thead>
              <tbody>{d.reorder.map((r) => <tr key={r.id}><td className={TD}><div className="font-semibold text-stone-800">{r.name}</div><div className="mono text-[12px] text-stone-400">{r.sku}{r.supplier ? ` · ${r.supplier}` : ''}</div></td><td className={TD + ' mono text-right'}>{fmtQty(r.avail)}</td><td className={TD + ' text-right'}>{r.cover == null ? <span className="text-stone-300">no recent use</span> : <Pill tone={r.cover < r.lead_time_days ? 'red' : 'amber'}>{r.cover} days</Pill>}</td><td className={TD + ' mono text-right font-bold text-cyan-700'}>{fmtQty(r.sugg)}</td></tr>)}</tbody></table></div>)}
        </Section>

        <Section title="Expiry watch" sub="First-expiry-first-out is automatic when picking. This shows what is closest.">
          <div className="mb-3 flex gap-2"><Pill tone={d.expiry.expired ? 'red' : 'slate'}>{d.expiry.expired} expired</Pill><Pill tone={d.expiry.d30 ? 'amber' : 'slate'}>{d.expiry.d30} within 30 days</Pill><Pill>{d.expiry.d60} within 60 days</Pill></div>
          {d.expiry.rows.length === 0 ? <None>No stock expires in the next 60 days.</None> : <div className="-mx-2 overflow-x-auto"><table className="w-full text-[14px]"><thead><tr><th className={TH}>Item</th><th className={TH}>Where</th><th className={TH}>Expires</th><th className={TH + ' text-right'}>Qty</th></tr></thead><tbody>{d.expiry.rows.map((r, i) => <tr key={i}><td className={TD}><div className="font-semibold text-stone-800">{r.name}</div><div className="mono text-[12px] text-stone-400">{r.sku}{r.lot ? ` · lot ${r.lot}` : ''}</div></td><td className={TD + ' mono'}>{r.loc}</td><td className={TD}><ExpiryChip date={r.expiry} /></td><td className={TD + ' mono text-right'}>{fmtQty(r.qty)}</td></tr>)}</tbody></table></div>}
        </Section>

        <Section title="What moves, what sits" sub="Items ranked by how much value leaves the warehouse (last 90 days). A = the few that matter most.">
          <div className="mb-4 grid grid-cols-4 gap-2 text-center">{[['A', d.abc.a, 'Top 80%'], ['B', d.abc.b, 'Next 15%'], ['C', d.abc.c, 'Last 5%'], ['Idle', d.abc.idle, 'No use']].map(([k, v, s]) => <div key={k as string} className="rounded-2xl bg-stone-50 p-3"><div className="mono text-[22px] font-semibold text-stone-900">{v}</div><div className="text-[12.5px] font-bold text-stone-600">{k}</div><div className="text-[11.5px] text-stone-400">{s}</div></div>)}</div>
          {d.abc.top.length > 0 && <ul className="mb-4 space-y-1.5">{d.abc.top.map((t) => <li key={t.id} className="flex justify-between text-[14px]"><span className="truncate font-semibold text-stone-700">{t.name}</span><span className="mono text-stone-400">{fmtMoney(t.v)}</span></li>)}</ul>}
          <div className="text-[13px] font-bold text-stone-500">Not moved in 90 days</div>
          {d.dead.length === 0 ? <None>Everything on the shelf has been used or received recently.</None> : <ul className="mt-2 space-y-1.5">{d.dead.slice(0, 8).map((t) => <li key={t.id} className="flex justify-between gap-3 text-[14px]"><span className="truncate text-stone-700">{t.name} <span className="mono text-[12px] text-stone-400">{t.sku}</span></span><span className="mono shrink-0 text-stone-500">{fmtQty(t.qty)} · {fmtMoney(t.val ?? 0)}</span></li>)}</ul>}
        </Section>

        <Section title="Space" sub="Locations that are nearly full or over capacity.">
          <div className="mb-3 flex gap-2"><Pill tone={d.utilisation.over ? 'red' : 'slate'}>{d.utilisation.over} over</Pill><Pill tone={d.utilisation.high ? 'amber' : 'slate'}>{d.utilisation.high} nearly full</Pill><Pill>{d.utilisation.empty} empty</Pill></div>
          {d.utilisation.rows.length === 0 ? <None>No location is close to its limit. Set a capacity on a location to track it.</None> : <ul className="space-y-3">{d.utilisation.rows.map((r) => <li key={r.code}><div className="mb-1 flex justify-between text-[14px]"><span className="font-semibold text-stone-800"><span className="mono">{r.code}</span> <span className="text-stone-400">{r.name !== r.code ? r.name : ''}</span></span><span className="mono text-stone-500">{fmtQty(r.used)} / {fmtQty(r.capacity)} · {r.pct}%</span></div><Meter v={r.pct / 100} tone={r.pct > 100 ? 'red' : 'amber'} /></li>)}</ul>}
        </Section>

        <Section title="Accuracy and unusual activity" sub="Where counts keep disagreeing with the system, and adjustments that look out of the ordinary.">
          {d.variance.length === 0 ? <None>No corrections in the last 90 days.</None> : <ul className="mb-4 space-y-1.5">{d.variance.map((v) => <li key={v.code} className="flex justify-between text-[14px]"><span className="mono font-semibold text-stone-800">{v.code}</span><span className="text-stone-500">{v.n} correction{v.n === 1 ? '' : 's'} · {fmtQty(v.units)} units</span></li>)}</ul>}
          {d.anomalies.length > 0 && <><div className="text-[13px] font-bold text-rose-700">Unusually large this week</div><ul className="mt-2 space-y-2">{d.anomalies.map((a, i) => <li key={i} className="rounded-xl bg-rose-50 px-3 py-2 text-[13.5px] text-rose-900"><b>{KIND_LABEL[a.kind] ?? a.kind}</b> of {fmtQty(a.qty)} × {a.sku}{a.loc ? ` at ${a.loc}` : ''} by {a.by_name}, {fmtWhen(a.created_at)}{a.reason ? ` (“${a.reason}”)` : ''}</li>)}</ul></>}
        </Section>

        {(d.stuck.length > 0 || d.old_orders.length > 0 || d.count_next.length > 0) && <Section title="Housekeeping" sub="Things that are waiting on someone.">
          {d.stuck.length > 0 && <><div className="text-[13px] font-bold text-stone-500">Stuck in repair or quarantine</div><ul className="mb-4 mt-2 space-y-1.5">{d.stuck.map((s, i) => <li key={i} className="flex justify-between gap-3 text-[14px]"><span className="truncate text-stone-700">{s.name} · <span className="mono">{s.loc}</span></span><span className="shrink-0 text-stone-500">{fmtQty(s.qty)} · {s.days}d in {s.status}</span></li>)}</ul></>}
          {d.old_orders.length > 0 && <><div className="text-[13px] font-bold text-stone-500">Packed orders waiting</div><ul className="mb-4 mt-2 space-y-1.5">{d.old_orders.map((o) => <li key={o.number} className="flex justify-between text-[14px]"><span className="text-stone-700"><span className="mono font-semibold">{o.number}</span> · {o.customer}</span><span className="text-stone-500">{o.days} days</span></li>)}</ul></>}
          {d.count_next.length > 0 && <><div className="text-[13px] font-bold text-stone-500">Suggested counts</div><ul className="mt-2 space-y-1.5">{d.count_next.map((c) => <li key={c.id} className="flex items-center justify-between gap-3 text-[14px]"><span className="text-stone-700"><span className="mono font-semibold">{c.code}</span> · {fmtQty(c.units)} units</span><span className="flex items-center gap-3 text-stone-500">{c.last_count ? `last ${fmtDate(c.last_count)}` : 'never counted'}{hasFeature(role, 'whcount') && <button onClick={() => { useWh.getState().setPrefill({ locId: c.id }); go('whcount') }} className="font-bold text-cyan-700">Count</button>}</span></li>)}</ul></>}
        </Section>}
      </div>
    </Page>)
}
