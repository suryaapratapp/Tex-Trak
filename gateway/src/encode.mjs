// Teltonika Codec 8 Extended ENCODER — used by the simulator/tests (mirrors what a real TAT240 sends)
import { crc16ibm } from './codec.mjs'

export function encodeLogin(imei) { const b = Buffer.from(imei, 'ascii'); const h = Buffer.alloc(2); h.writeUInt16BE(b.length); return Buffer.concat([h, b]) }

export function encode8E(records) {
  const parts = [Buffer.from([0x8e, records.length])]
  for (const r of records) {
    const b = Buffer.alloc(8 + 1 + 4 + 4 + 2 + 2 + 1 + 2 + 2 + 2)
    let o = 0
    b.writeBigUInt64BE(BigInt(new Date(r.ts).getTime()), o); o += 8
    b[o++] = 1
    b.writeInt32BE(Math.round(r.lng * 1e7), o); o += 4
    b.writeInt32BE(Math.round(r.lat * 1e7), o); o += 4
    b.writeInt16BE(r.alt ?? 0, o); o += 2
    b.writeUInt16BE(Math.round(r.heading ?? 0), o); o += 2
    b[o++] = r.sats ?? 0
    b.writeUInt16BE(Math.round(r.speed ?? 0), o); o += 2
    b.writeUInt16BE(0, o); o += 2 // event id
    const io1 = [[21, r.gsm ?? 4]], io2 = [[67, r.mv ?? 7100]]
    b.writeUInt16BE(io1.length + io2.length, o); o += 2
    const g = (list, size) => { const x = Buffer.alloc(2 + list.length * (2 + size)); let p = 0; x.writeUInt16BE(list.length, p); p += 2; for (const [id, v] of list) { x.writeUInt16BE(id, p); p += 2; x.writeUIntBE(v, p, size); p += size } return x }
    parts.push(b, g(io1, 1), g(io2, 2), g([], 4), g([], 8), Buffer.from([0, 0]))
  }
  parts.push(Buffer.from([records.length]))
  const data = Buffer.concat(parts)
  const head = Buffer.alloc(8); head.writeUInt32BE(0, 0); head.writeUInt32BE(data.length, 4)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc16ibm(data))
  return Buffer.concat([head, data, crc])
}
