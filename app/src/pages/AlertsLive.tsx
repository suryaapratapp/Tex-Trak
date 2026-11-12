import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Card, Chip, Page } from '../components/ui'
import { useAuth } from '../lib/auth'
import { go } from '../store'
import { loadAttention, type Attn } from '../lib/liveAttention'
import { ago } from '../lib/status'

const TONE = { bad: 'red', warn: 'amber', info: 'blue' } as const
const LABEL = { bad: 'Urgent', warn: 'Check', info: 'For information' } as const

/** Alerts worked out from real devices, items and shipments. Each one disappears by itself when the cause is fixed. */
export default function AlertsLive() {
  const isSuper = useAuth((s) => s.user?.role === 'superadmin'); const [rows, setRows] = useState<Attn[]>([]); const [loaded, setLoaded] = useState(false)
  const load = useCallback(async () => { setRows(await loadAttention(isSuper)); setLoaded(true) }, [isSuper])
  useEffect(() => { void load(); const id = setInterval(() => void load(), 30000); return () => clearInterval(id) }, [load])
  return (
    <Page title="Alerts" sub="Offline devices, missing items, shipment problems and restricted-site entries. They clear themselves once fixed." right={<button onClick={() => void load()} className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-[13.5px] font-semibold text-stone-700 hover:bg-stone-50"><RefreshCw size={15} /> Refresh</button>}>
      <Card>{!loaded ? <div className="p-10 text-center text-stone-400">Checking…</div> : rows.length === 0 ? <div className="p-10 text-center text-[15px] text-stone-500">No alerts. Everything that is being tracked is behaving normally.</div> :
        <ul className="divide-y divide-stone-100">{rows.map((a) => <li key={a.id} className="flex flex-wrap items-start gap-4 px-6 py-4"><Chip tone={TONE[a.tone]}>{LABEL[a.tone]}</Chip><div className="min-w-0 flex-1"><div className="text-[15px] font-semibold text-stone-900">{a.title}</div><div className="mt-0.5 text-[14px] text-stone-500">{a.body}{a.at ? ` · ${ago(a.at)}` : ''}</div></div>{a.page && <button onClick={() => go(a.page!)} className="rounded-full bg-stone-100 px-4 py-1.5 text-[13px] font-semibold text-stone-700 hover:bg-stone-200">Open</button>}</li>)}</ul>}</Card>
    </Page>)
}
