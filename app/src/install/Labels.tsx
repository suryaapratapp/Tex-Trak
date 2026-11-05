import { useState } from 'react'
import { Printer } from 'lucide-react'
import { Card } from '../components/ui'
import { QrImg } from './QrImg'
import { BAYS, bayCode, curtainCode, useInst } from './store'

export function Labels() {
  const curtains = useInst((s) => s.curtains); const [kind, setKind] = useState<'curtain' | 'bay'>('curtain')
  const cs = Object.values(curtains).filter((c) => c.id.startsWith('CUR-2')).slice(0, 24)
  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3"><div className="inline-flex rounded-full bg-stone-200/60 p-1">{(['curtain', 'bay'] as const).map((k) => <button key={k} onClick={() => setKind(k)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${kind === k ? 'bg-white shadow-sm' : 'text-stone-600'}`}>{k === 'curtain' ? 'Curtain labels' : 'Bay labels'}</button>)}</div>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-bold text-white"><Printer size={15} /> Print</button></div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {kind === 'curtain' ? cs.map((c) => <Card key={c.id} className="flex flex-col items-center p-4 text-center"><QrImg text={curtainCode(c.id)} size={112} /><div className="mt-2 text-sm font-extrabold text-stone-900">{c.id}</div><div className="text-[11px] text-stone-500">{c.type}</div></Card>)
          : BAYS.map((b) => <Card key={b.id} className="flex flex-col items-center p-4 text-center"><QrImg text={bayCode(b.id)} size={112} /><div className="mt-2 text-sm font-extrabold text-stone-900">{b.ward}</div><div className="text-[11px] text-stone-500">Bay {b.n} · Floor {b.floor}</div></Card>)}</div>
    </div>)
}
