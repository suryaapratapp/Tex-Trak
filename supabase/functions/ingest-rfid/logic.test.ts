import { parsePayload, inferStatus, toIso } from './logic.ts'
let fail = 0; const eq = (n: string, a: unknown, b: unknown) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fail++; console.log('FAIL', n, JSON.stringify(a), '!=', JSON.stringify(b)) } else console.log('ok  ', n) }
const q = new URLSearchParams()
eq('ours', parsePayload('application/json', JSON.stringify({ reader: 'R-1', reads: [{ epc: 'e28011606000020d1a2b3c4d', ts: '2026-11-06T09:30:00Z', rssi: -52 }] }), q), { reader: 'R-1', reads: [{ epc: 'E28011606000020D1A2B3C4D', ts: '2026-11-06T09:30:00.000Z', rssi: -52 }] })
eq('impinj', parsePayload('application/json', JSON.stringify({ tag_reads: [{ epcHex: 'E2801160600002AABBCC0001', antennaPort: 1, firstSeenTimestamp: 1793860000000000, peakRssi: -60 }] }), new URLSearchParams('reader=R-DOCK')).reads[0].ts, '2026-11-05T06:26:40.000Z')
eq('zebra array', parsePayload('application/json', JSON.stringify([{ data: { idHex: 'E2801160600002AABBCC0002' }, hostName: 'fx7500-dock' }]), q), { reader: 'fx7500-dock', reads: [{ epc: 'E2801160600002AABBCC0002', ts: undefined, rssi: undefined }] })
eq('plain hex array', parsePayload('application/json', JSON.stringify({ readerName: 'R-9', tags: ['0xE2801160600002AABBCC0003', 'E2801160600002AABBCC0003'] }), q).reads.length, 1)
eq('text lines', parsePayload('text/plain', 'E2801160600002AABBCC0004\nE2801160600002AABBCC0005, 2026-11-06T10:00:00Z\n', new URLSearchParams('reader=R-T')), { reader: 'R-T', reads: [{ epc: 'E2801160600002AABBCC0004' }, { epc: 'E2801160600002AABBCC0005', ts: '2026-11-06T10:00:00.000Z' }] })
eq('junk', parsePayload('application/json', '{"hello":"world","n":5}', q).reads.length, 0)
eq('short epc ignored', parsePayload('application/json', '{"epc":"1234"}', q).reads.length, 0)
eq('seconds ts', toIso(1793860000), '2026-11-05T06:26:40.000Z')
eq('status dirty', inferStatus('dirty', 'in_use'), 'in_cage'); eq('status ward', inferStatus('clinical', 'in_stock'), 'in_use'); eq('status store missing', inferStatus('store', 'missing'), 'in_stock'); eq('status ward keeps soiled', inferStatus('clinical', 'soiled'), 'soiled')
console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0)
