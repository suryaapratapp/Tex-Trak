import { useState } from 'react'
import { CloudOff, RefreshCw, TriangleAlert, X } from 'lucide-react'
import { useNet } from '../lib/offline'
import { useQr } from '../qr/store'
import { ScanLog } from '../qr/ScanLog'

/** One strip that always says whether the phone is online and whether anything is still waiting to be sent. */
export function SyncBar() {
  const online = useNet((s) => s.online); const { ops, flushing, flush } = useQr(); const [open, setOpen] = useState(false)
  const pending = ops.filter((o) => o.state === 'pending').length; const failed = ops.filter((o) => o.state === 'failed').length
  if (online && !pending && !failed) return null
  const tone = failed ? 'bg-rose-50 text-rose-900 border-rose-200' : !online ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-cyan-50 text-cyan-800 border-cyan-200'
  return (
    <>
      <button onClick={() => setOpen(true)} className={`flex w-full items-center justify-center gap-2.5 border-b px-4 py-2 text-[13.5px] font-medium ${tone}`}>
        {failed ? <TriangleAlert size={16} /> : !online ? <CloudOff size={16} /> : <RefreshCw size={16} className={flushing ? 'animate-spin' : ''} />}
        {failed ? `${failed} scan${failed === 1 ? '' : 's'} could not be saved. Tap to review.` : !online ? `You are offline. ${pending ? `${pending} scan${pending === 1 ? ' is' : 's are'} saved on this phone and will send automatically.` : 'Scans are saved on this phone and will send automatically.'}` : `Sending ${pending} saved scan${pending === 1 ? '' : 's'}…`}
      </button>
      {open && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-900/40 sm:items-center" onClick={() => setOpen(false)}>
        <div className="max-h-[85vh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl bg-stone-50 p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between"><h2 className="text-[18px] font-semibold text-stone-900">Saved scans</h2><button onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white"><X size={16} /></button></div>
          <p className="mb-4 text-[14px] text-stone-500">{online ? 'Connected.' : 'Not connected.'} {pending} waiting, {failed} not saved.</p>
          {online && pending > 0 && <button onClick={() => void flush()} className="mb-4 rounded-lg bg-cyan-600 px-4 py-2.5 text-[14px] font-medium text-white">Send now</button>}
          <ScanLog title="Latest" limit={30} /></div></div>}
    </>)
}
