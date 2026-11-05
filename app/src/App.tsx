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
import ItemJourney from './pages/ItemJourney'
import Admin from './pages/Admin'
import Scan from './pages/Scan'
import Insights from './pages/Insights'
import QrDashboard from './qr/Dashboard'
import Products from './qr/Products'
import Install from './qr/Install'
import Takedown from './qr/Takedown'
import Register from './qr/Register'
import Labels from './qr/Labels'
import Locations from './qr/Locations'
import Reports from './qr/Reports'
import Users from './qr/Users'
import Account from './qr/Account'

const PAGES: Record<string, () => React.ReactElement> = { qrdash: QrDashboard, qrproducts: Products, qrinstall: Install, qrtakedown: Takedown, qrregister: Register, qrlabels: Labels, qrlocations: Locations, qrreports: Reports, qrusers: Users, account: Account, admin: Admin, scan: Scan, insights: Insights, command: Command, map: FleetMap, twin: Twin, lifecycle: Lifecycle, planner: Planner, shipments: Shipments, assets: Assets, provenance: Provenance, alerts: Alerts, esg: Esg, devices: Devices, inventory: Inventory,  item: ItemJourney }
export default function App() {
  const page = useStore((s) => s.page)
  const P = PAGES[page] ?? Command
  return <Layout><P /></Layout>
}
