import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { useStore } from '../store'
import { useQr, useQrLoad, useQrOrg } from './store'

/** Loads the shared curtain data for the page, and lets Super Admin choose which client's data to look at. */
export function QrShell({ children }: { children: ReactNode }) {
  useQrLoad(); const org = useQrOrg(); const { loaded, error, org: loadedOrg } = useQr(); const user = useAuth((s) => s.user); const orgs = useAuth((s) => s.orgs); const role = useStore((s) => s.role); const set = useStore((s) => s.set)
  const ready = loaded && loadedOrg === org
  return (
    <>
      {user?.role === 'superadmin' && role === 'superadmin' && <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-6 pt-5 sm:px-10"><span className="text-[13.5px] text-stone-500">Showing curtain data for</span><select value={org} onChange={(e) => set({ qrOrg: e.target.value })} className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-[14px] font-medium" aria-label="Client">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}
      {error ? <div className="p-10 text-center text-[14.5px] text-rose-600">Could not load the data: {error}</div> : ready ? children : <div className="p-10 text-center text-[14.5px] text-stone-400">Loading…</div>}
    </>)
}
