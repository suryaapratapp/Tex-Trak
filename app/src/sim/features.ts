export type ModuleId = 'laundry' | 'curtains' | 'warehouse' | 'assets' | 'shipments' | 'recycling' | 'core'
export const MODULES: Record<ModuleId, { label: string; blurb: string }> = {
  core: { label: 'Core', blurb: 'Home, map, alerts, intelligence, impact, scanning' },
  laundry: { label: 'Laundry (RFID)', blurb: 'Reusable textiles, RFID doorways, arrival planning' },
  curtains: { label: 'Curtains (QR)', blurb: 'Label, install, take down and report on products' },
  warehouse: { label: 'Warehouse (QR · barcode · RFID)', blurb: 'Goods in and out, packing, moves, counts and smart stock insights for any product' },
  assets: { label: 'Community assets', blurb: 'High-value equipment in the community' },
  shipments: { label: 'Shipments', blurb: 'Any delivery or collection' },
  recycling: { label: 'Recycling proof', blurb: 'Did it reach the recycler?' },
}
/** Every switchable feature. Page ids double as feature ids. Keep in step with the admin-users edge function. */
export interface Feature { id: string; label: string; module: ModuleId }
export const FEATURES: Feature[] = [
  { id: 'command', label: 'Home', module: 'core' }, { id: 'map', label: 'Live map', module: 'core' }, { id: 'alerts', label: 'Alerts', module: 'core' },
  { id: 'insights', label: 'Intelligence', module: 'core' }, { id: 'esg', label: 'Impact', module: 'core' }, { id: 'scan', label: 'Scan station', module: 'core' },
  { id: 'planner', label: 'Laundry arrivals', module: 'laundry' }, { id: 'inventory', label: 'Inventory', module: 'laundry' }, { id: 'twin', label: 'Facilities and floors', module: 'laundry' }, { id: 'lifecycle', label: 'Daily flow', module: 'laundry' },
  { id: 'assets', label: 'Community assets', module: 'assets' }, { id: 'shipments', label: 'Shipments', module: 'shipments' }, { id: 'provenance', label: 'Recycling proof', module: 'recycling' },
  { id: 'qrdash', label: 'Curtain dashboard', module: 'curtains' }, { id: 'qrproducts', label: 'Products', module: 'curtains' }, { id: 'qrinstall', label: 'Install', module: 'curtains' }, { id: 'qrtakedown', label: 'Take down', module: 'curtains' },
  { id: 'qrregister', label: 'Register labels', module: 'curtains' }, { id: 'qrlabels', label: 'QR labels (generate and print)', module: 'curtains' }, { id: 'qrlocations', label: 'Locations', module: 'curtains' },
  { id: 'qrreports', label: 'Reports', module: 'curtains' },
  { id: 'whdash', label: 'Warehouse dashboard', module: 'warehouse' }, { id: 'whscan', label: 'Smart scan', module: 'warehouse' }, { id: 'whinsights', label: 'Stock insights', module: 'warehouse' },
  { id: 'whreceive', label: 'Goods in', module: 'warehouse' }, { id: 'whissue', label: 'Goods out', module: 'warehouse' }, { id: 'whpack', label: 'Pack order', module: 'warehouse' },
  { id: 'whorders', label: 'Orders and dispatch', module: 'warehouse' }, { id: 'whunpack', label: 'Unpack', module: 'warehouse' }, { id: 'whmove', label: 'Move stock', module: 'warehouse' },
  { id: 'whstock', label: 'Damage, repair and quarantine', module: 'warehouse' }, { id: 'whcount', label: 'Cycle count', module: 'warehouse' }, { id: 'whitems', label: 'Items (add, edit, import)', module: 'warehouse' },
  { id: 'whlocations', label: 'Locations (add, edit, import)', module: 'warehouse' }, { id: 'whledger', label: 'Stock ledger', module: 'warehouse' }, { id: 'whlabels', label: 'Labels (print)', module: 'warehouse' }
]
export const featuresOf = (...m: ModuleId[]) => FEATURES.filter((f) => m.includes(f.module)).map((f) => f.id)
/** Starting points when choosing what a staff member can do. */
export const PRESETS: { id: string; label: string; help: string; features: string[] }[] = [
  { id: 'fitter', label: 'Fitter', help: 'Scan, install and take down', features: ['command', 'scan', 'qrinstall', 'qrtakedown', 'qrproducts'] },
  { id: 'supervisor', label: 'Supervisor', help: 'Fitter tools plus labels, locations and reports', features: ['command', 'scan', 'alerts', 'qrdash', 'qrproducts', 'qrinstall', 'qrtakedown', 'qrregister', 'qrlocations', 'qrreports', 'shipments', 'provenance'] },
  { id: 'warehouse', label: 'Warehouse operator', help: 'Scan, receive, pick, pack, move and count', features: ['command', 'whdash', 'whscan', 'whreceive', 'whissue', 'whpack', 'whorders', 'whunpack', 'whmove', 'whstock', 'whcount'] },
  { id: 'stockviewer', label: 'Warehouse view only', help: 'Stock, insights and the ledger, no changes', features: ['command', 'whdash', 'whscan', 'whinsights', 'whledger'] },
  { id: 'viewer', label: 'View only', help: 'Dashboards and reports, no scanning', features: ['command', 'map', 'alerts', 'insights', 'esg', 'qrdash', 'qrproducts', 'qrreports', 'shipments', 'provenance'] },
]
