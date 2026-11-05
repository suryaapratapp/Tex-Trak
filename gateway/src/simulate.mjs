// Pretends to be a TAT240: logs in with the IMEI and streams Codec 8E positions along a London route.
// Usage: node src/simulate.mjs [host] [port] [imei] [packets]
import net from 'node:net'
import { encode8E, encodeLogin } from './encode.mjs'

const [host = '127.0.0.1', port = '5027', imei = '862129084785066', packets = '8'] = process.argv.slice(2)
const route = [[51.5295, -0.285], [51.5246, -0.2], [51.5246, -0.134]] // Decon plant -> hospital (straight-line demo)
const pos = (f) => { const s = Math.min(route.length - 2, Math.floor(f * (route.length - 1))); const g = f * (route.length - 1) - s; return [route[s][0] + (route[s + 1][0] - route[s][0]) * g, route[s][1] + (route[s + 1][1] - route[s][1]) * g] }

export function runSimulator({ host, port, imei, packets, delayMs = 1000 }) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(+port, host); let n = 0; const acks = []
    sock.on('error', reject)
    sock.on('connect', () => sock.write(encodeLogin(imei)))
    sock.on('data', (d) => {
      if (d.length === 1) { if (d[0] !== 1) { sock.end(); return reject(new Error('login rejected')) }; return send() }
      acks.push(d.readUInt32BE(0)); if (acks.length === +packets) { sock.end(); resolve(acks) } else setTimeout(send, delayMs)
    })
    function send() {
      const [lat, lng] = pos(n / Math.max(1, +packets - 1)); n++
      sock.write(encode8E([{ ts: new Date().toISOString(), lat, lng, alt: 30, heading: 90, sats: 11, speed: 32, mv: 7100 - n * 5, gsm: 4 }]))
    }
  })
}
if (import.meta.url === `file://${process.argv[1]}`) runSimulator({ host, port, imei, packets }).then((a) => console.log('acked', a.join(','))).catch((e) => { console.error(e.message); process.exit(1) })
