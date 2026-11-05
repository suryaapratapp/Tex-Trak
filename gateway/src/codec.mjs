// Teltonika AVL codec 8 / 8 Extended parser (TAT240, FMB, FMC … share this protocol)
export function crc16ibm(buf) {
  let crc = 0
  for (const b of buf) { crc ^= b; for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1 }
  return crc & 0xffff
}

/** Parse the IMEI login packet: 2-byte length + ASCII IMEI */
export function parseImei(buf) {
  if (buf.length < 2) return null
  const len = buf.readUInt16BE(0)
  if (buf.length < 2 + len) return null
  return { imei: buf.subarray(2, 2 + len).toString('ascii'), used: 2 + len }
}

/** Try to parse one TCP AVL packet from the head of buf. Returns null if incomplete. */
export function parsePacket(buf) {
  if (buf.length < 12) return null
  if (buf.readUInt32BE(0) !== 0) throw new Error('bad preamble')
  const dataLen = buf.readUInt32BE(4)
  const total = 8 + dataLen + 4
  if (buf.length < total) return null
  const data = buf.subarray(8, 8 + dataLen)
  const crc = buf.readUInt32BE(8 + dataLen)
  if (crc16ibm(data) !== crc) throw new Error('crc mismatch')
  const codec = data[0], count = data[1]
  const ext = codec === 0x8e
  if (codec !== 0x08 && !ext) throw new Error(`unsupported codec 0x${codec.toString(16)}`)
  let o = 2
  const u8 = () => data[o++]
  const u16 = () => { const v = data.readUInt16BE(o); o += 2; return v }
  const readN = (n) => { let v = 0n; for (let i = 0; i < n; i++) v = (v << 8n) | BigInt(data[o++]); return v }
  const records = []
  for (let r = 0; r < count; r++) {
    const ts = Number(data.readBigUInt64BE(o)); o += 8
    const priority = u8()
    const lng = data.readInt32BE(o) / 1e7; o += 4
    const lat = data.readInt32BE(o) / 1e7; o += 4
    const alt = data.readInt16BE(o); o += 2
    const heading = u16()
    const sats = u8()
    const speed = u16()
    const eventId = ext ? u16() : u8()
    const total = ext ? u16() : u8()
    const io = {}
    for (const size of [1, 2, 4, 8]) {
      const n = ext ? u16() : u8()
      for (let i = 0; i < n; i++) { const id = ext ? u16() : u8(); const v = readN(size); io[id] = Number(v) }
    }
    if (ext) { const n = u16(); for (let i = 0; i < n; i++) { const id = u16(); const len = u16(); io[id] = data.subarray(o, o + len).toString('hex'); o += len } }
    records.push({ ts: new Date(ts).toISOString(), priority, lat, lng, alt, heading, sats, speed, eventId, ioTotal: total, io })
  }
  if (data[o] !== count) throw new Error('record count mismatch')
  return { codec, count, records, used: total }
}
