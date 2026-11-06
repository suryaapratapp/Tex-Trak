// Teltonika TCP gateway: TAT240 -> (Codec 8/8E over TCP) -> this process -> Supabase edge function /ingest-tracker
import net from 'node:net'
import { parseImei, parsePacket } from './codec.mjs'

const PORT = +(process.env.PORT ?? 5027)
const INGEST_URL = process.env.INGEST_URL
const INGEST_TOKEN = process.env.INGEST_TOKEN
// Optional extra allow-list. Normally leave it unset: the ingest function only accepts IMEIs the Super Admin has registered and switched on.
const ALLOWED = process.env.ALLOWED_IMEIS ? process.env.ALLOWED_IMEIS.split(',').map((x) => x.trim()) : null
if (!INGEST_URL || !INGEST_TOKEN) { console.error('Set INGEST_URL and INGEST_TOKEN'); process.exit(1) }

async function forward(imei, records) {
  const r = await fetch(INGEST_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ingest-token': INGEST_TOKEN }, body: JSON.stringify({ imei, records }) })
  if (!r.ok) throw new Error(`ingest ${r.status}: ${await r.text()}`)
}

net.createServer((sock) => {
  let imei = null, buf = Buffer.alloc(0)
  sock.setTimeout(15 * 60 * 1000, () => sock.destroy())
  sock.on('error', () => {})
  sock.on('data', async (chunk) => {
    buf = Buffer.concat([buf, chunk])
    try {
      if (!imei) {
        const p = parseImei(buf); if (!p) return
        buf = buf.subarray(p.used)
        if (!/^\d{15}$/.test(p.imei) || (ALLOWED && !ALLOWED.includes(p.imei))) { console.warn('rejected IMEI', p.imei); sock.write(Buffer.from([0])); return sock.end() }
        imei = p.imei; sock.write(Buffer.from([1])); console.log('login', imei)
      }
      for (;;) {
        const pkt = parsePacket(buf); if (!pkt) break
        buf = buf.subarray(pkt.used)
        await forward(imei, pkt.records)
        const ack = Buffer.alloc(4); ack.writeUInt32BE(pkt.count); sock.write(ack) // device re-sends until ACKed
        console.log(`${imei}: ${pkt.count} record(s) stored`)
      }
    } catch (e) { console.error('error', e.message); sock.destroy() }
  })
}).listen(PORT, () => console.log(`Teltonika gateway listening on :${PORT}`))
