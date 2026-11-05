import { Layout } from './components/Layout'
import { useStore } from './store'
import Command from './pages/Command'
import FleetMap from './pages/FleetMap'
import Twin from './pages/Twin'
import Lifecycle from './pages/Lifecycle'
import Planner from './pages/Planner'
import Shipments from './pages/Shipments'
import Assets from './pages/Assets'
import Provenance from './pages/Provenance'
import Alerts from './pages/Alerts'
import Esg from './pages/Esg'
import Devices from './pages/Devices'
import Inventory from './pages/Inventory'
import Installations from './pages/Installations'
import ItemJourney from './pages/ItemJourney'

const PAGES: Record<string, () => React.ReactElement> = { command: Command, map: FleetMap, twin: Twin, lifecycle: Lifecycle, planner: Planner, shipments: Shipments, assets: Assets, provenance: Provenance, alerts: Alerts, esg: Esg, devices: Devices, inventory: Inventory, install: Installations, item: ItemJourney }
export default function App() {
  const page = useStore((s) => s.page)
  const P = PAGES[page] ?? Command
  return <Layout><P /></Layout>
}
