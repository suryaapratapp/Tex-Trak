import { useEffect, useId, useMemo } from 'react'
import { Building2, UserRound } from 'lucide-react'
import { useInfra } from '../lib/infra'
import { useWh, useWhOrg } from './store'
import { Field, inputCls } from './ui'

/** Where is it going? Type anything, or pick one of your customers or sites. Never mandatory unless the screen says so. */
export function DestinationField({ label, value, onChange, required, hint, placeholder }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; hint?: string; placeholder?: string }) {
  const org = useWhOrg(); const partners = useWh((s) => s.partners); const sites = useInfra((x) => x.sites); const id = useId()
  useEffect(() => { void useInfra.getState().load() }, [])
  const siteList = useMemo(() => [...new Map(sites.filter((x) => x.org_id === org || x.org_id === null).map((x) => [x.name, x])).values()].sort((a, b) => a.name.localeCompare(b.name)), [sites, org])
  const people = useMemo(() => partners.filter((p) => p.kind !== 'supplier' && p.name), [partners])
  const chips = [...people.map((p) => ({ name: p.name, site: false })), ...siteList.map((x) => ({ name: x.name, site: true }))].filter((c, i, a) => a.findIndex((d) => d.name.toLowerCase() === c.name.toLowerCase()) === i)
  const q = value.trim().toLowerCase(); const shown = (q ? chips.filter((c) => c.name.toLowerCase().includes(q) && c.name.toLowerCase() !== q) : chips).slice(0, 6)
  return (
    <Field label={label} required={required} hint={hint}>
      <input value={value} onChange={(e) => onChange(e.target.value)} list={id} className={inputCls} placeholder={placeholder ?? 'Pick from the list or type'} autoComplete="off" />
      <datalist id={id}>{chips.map((c) => <option key={c.name} value={c.name} label={c.site ? 'Site' : 'Customer'} />)}</datalist>
      {shown.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{shown.map((c) => <button key={c.name} type="button" onClick={() => onChange(c.name)} className="flex max-w-full items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-stone-700 hover:border-cyan-300 hover:bg-cyan-50">{c.site ? <Building2 size={13} className="shrink-0 text-stone-400" /> : <UserRound size={13} className="shrink-0 text-stone-400" />}<span className="truncate">{c.name}</span></button>)}</div>}
    </Field>)
}
