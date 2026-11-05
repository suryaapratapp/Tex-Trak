import { parsePacket } from './codec.mjs'
// Official Teltonika Codec 8 example (1 record)
const hex = '000000000000003608010000016B40D8EA30010000000000000000000000000000000105021503010101425E0F01F10000601A014E0000000000000000010000C7CF'
const p = parsePacket(Buffer.from(hex, 'hex'))
console.log(JSON.stringify(p.records[0]))
if (p.count !== 1 || p.records[0].io[66] !== 24079 || p.records[0].io[241] !== 24602) { console.error('FAIL'); process.exit(1) }
console.log('codec 8 selftest OK')
