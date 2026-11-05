import { Page } from '../components/ui'
import { InstOverview } from '../install/Overview'
import { Floors } from '../install/Floors'
import { ScanPage } from '../install/ScanPage'
import { Curtains } from '../install/Curtains'
import { Labels } from '../install/Labels'
import { Runs } from '../install/Runs'
import { useStore } from '../store'

const TABS = [['overview', 'Overview'], ['scan', 'Scan'], ['floors', 'Floors'], ['curtains', 'Curtains'], ['runs', 'Van runs'], ['labels', 'Labels']] as const
export default function Installations() {
  const { instTab, set } = useStore()
  const View = { overview: InstOverview, scan: ScanPage, floors: Floors, curtains: Curtains, runs: Runs, labels: Labels }[instTab as 'overview'] ?? InstOverview
  return (
    <Page title="Installations" sub="Curtains installed and taken down by QR code.">
      <div className="no-print scroll-thin mb-5 flex gap-1 overflow-x-auto"><div className="inline-flex rounded-full bg-stone-200/60 p-1">{TABS.map(([k, l]) => <button key={k} onClick={() => set({ instTab: k })} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${instTab === k ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}>{l}</button>)}</div></div>
      <View />
    </Page>)
}
