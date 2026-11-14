import type { Source } from '../pages/ShipmentContents'

/** Hand-off from Warehouse and Curtains screens to "New shipment": which tab to open and what to tick. */
export interface ShipStart { tab: Exclude<Source, 'typed'>; status?: string; match?: string }
let draft: ShipStart | null = null
export const setShipDraft = (d: ShipStart) => { draft = d }
export const peekShipDraft = (): ShipStart | null => draft
export const clearShipDraft = () => { draft = null }
