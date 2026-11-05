import { KIND_COLOR, KIND_GLYPH, KIND_LABEL } from '../sim/registry'

export function MapLegend({ compact = false }: { compact?: boolean }) {
  const kinds = compact ? ['recycler', 'port', 'incinerator'] : ['hospital', 'decon', 'facility', 'recycler', 'port', 'incinerator', 'hub', 'community']
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-[500] flex max-w-[calc(100%-1rem)] flex-wrap gap-x-3 gap-y-1 rounded-xl border border-stone-200 bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-stone-700 shadow-md">
      {kinds.map((k) => <span key={k} className="flex items-center gap-1.5"><i className="grid h-4 w-4 place-items-center rounded text-[10px] text-white" style={{ background: KIND_COLOR[k] }}>{KIND_GLYPH[k]}</i>{KIND_LABEL[k]}{k === 'port' || k === 'incinerator' ? <b className="text-rose-600">⚠</b> : null}</span>)}
    </div>)
}
