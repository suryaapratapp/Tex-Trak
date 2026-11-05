import { useMemo } from 'react'
import { fmtT, getWorld, type Ev } from '../sim/engine'
import { SrcChip } from './ui'
import { useStore } from '../store'

export function EventFeed({ filter, limit = 14, onPick }: { filter?: (e: Ev) => boolean; limit?: number; onPick?: (e: Ev) => void }) {
  const t = useStore((s) => s.t)
  const q = Math.floor(t * 2)
  const list = useMemo(() => {
    const ev = getWorld().events; let hi = ev.length - 1
    while (hi >= 0 && ev[hi].t > t) hi--
    const r: Ev[] = []
    for (let i = hi; i >= 0 && r.length < limit; i--) if (!filter || filter(ev[i])) r.push(ev[i])
    return r
  }, [q, limit, filter])
  return (
    <ul className="divide-y divide-slate-100">
      {list.length === 0 && <li className="p-4 text-sm text-slate-400">Waiting for events…</li>}
      {list.map((e) => (
        <li key={e.id} className="flex cursor-default items-start gap-2.5 px-4 py-2 hover:bg-slate-50" onClick={() => onPick?.(e)}>
          <span className="mono mt-0.5 w-[44px] shrink-0 text-[11px] text-slate-400">{fmtT(e.t).slice(0, 5)}</span>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><SrcChip s={e.src} /><span className="truncate text-[12.5px] font-medium text-slate-800">{e.title}</span></div><div className="truncate text-xs text-slate-500">{e.detail}</div></div>
        </li>
      ))}
    </ul>
  )
}
