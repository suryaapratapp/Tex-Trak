import type { XY } from './world'

export interface UZone { id: string; name: string; x: number; y: number; w: number; h: number; ward?: string; door: XY }
export interface UReader { id: string; at: XY; label: string }
export interface UFloor { id: '1' | '2' | '3'; name: string; zones: UZone[]; readers: UReader[]; lift: XY; stair: [XY, XY] }

const corridor = 320
const floor = (id: '1' | '2' | '3', name: string, a: [string, string, string?], b: [string, string, string?], services: [string, string][]): UFloor => {
  const zones: UZone[] = [
    { id: `${id}-${a[0]}`, name: a[1], x: 100, y: 50, w: 470, h: 240, ward: a[2], door: [335, 290] },
    { id: `${id}-${b[0]}`, name: b[1], x: 580, y: 50, w: 440, h: 240, ward: b[2], door: [800, 290] },
    { id: `${id}-S1`, name: services[0][1], x: 100, y: 350, w: 300, h: 240, door: [250, 350] },
    { id: `${id}-S2`, name: services[1][1], x: 410, y: 350, w: 300, h: 240, door: [560, 350] },
    { id: `${id}-S3`, name: 'Staff & stores', x: 720, y: 350, w: 300, h: 240, door: [870, 350] },
  ]
  return { id, name, zones, lift: [570, corridor], stair: [[100, corridor], [1020, corridor]],
    readers: [
      { id: `R-F${id}-${a[0]}`, at: zones[0].door, label: `${a[1]} entrance` }, { id: `R-F${id}-${b[0]}`, at: zones[1].door, label: `${b[1]} entrance` },
      { id: `R-F${id}-LIFT`, at: [570, corridor], label: 'Lift lobby' }, { id: `R-F${id}-STAIR`, at: [100, corridor], label: 'Stair core' },
    ] }
}
export const UPPER: Record<'1' | '2' | '3', UFloor> = {
  '1': floor('1', 'Floor 1', ['1A', 'Surgical Ward 1A', '1A'], ['1B', 'Cardiology 1B', '1B'], [['x', 'Radiology'], ['y', 'Pharmacy']]),
  '2': floor('2', 'Floor 2', ['2A', 'Ward 2A', '2A'], ['2B', 'Ward 2B', '2B'], [['x', 'Day Treatment'], ['y', 'Therapy & Rehab']]),
  '3': floor('3', 'Floor 3', ['3A', 'Ward 3A', '3A'], ['3B', 'Ward 3B', '3B'], [['x', 'Oncology Suite'], ['y', 'Education Centre']]),
}
export const FLOOR_LABEL: Record<string, string> = { G: 'Ground floor', '1': 'Floor 1', '2': 'Floor 2', '3': 'Floor 3' }
