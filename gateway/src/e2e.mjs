// End-to-end test: simulator -> gateway -> (mock) ingest endpoint. No hardware or Supabase secret needed.
import http from 'node:http'
import { spawn } from 'node:child_process'
import { runSimulator } from './simulate.mjs'

const got = []
const mock = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { got.push({ token: req.headers['x-ingest-token'], body: JSON.parse(b) }); res.end('{"stored":1}') }) })
await new Promise((r) => mock.listen(0, r))
const gw = spawn('node', ['src/server.mjs'], { env: { ...process.env, PORT: '15027', INGEST_URL: `http://127.0.0.1:${mock.address().port}`, INGEST_TOKEN: 'test-token' }, stdio: ['ignore', 'pipe', 'inherit'] })
await new Promise((r) => gw.stdout.on('data', (d) => d.toString().includes('listening') && r()))
let ok = true
try {
  const acks = await runSimulator({ host: '127.0.0.1', port: 15027, imei: '862129084785066', packets: 3, delayMs: 50 })
  const recs = got.flatMap((g) => g.body.records)
  console.log('acks', acks, 'records forwarded', recs.length, 'first', recs[0].lat.toFixed(4), recs[0].lng.toFixed(4), 'io', JSON.stringify(recs[0].io))
  if (acks.join() !== '1,1,1' || recs.length !== 3 || got[0].token !== 'test-token' || got[0].body.imei !== '862129084785066') ok = false
  await runSimulator({ host: '127.0.0.1', port: 15027, imei: '000000000000000', packets: 1 }).then(() => (ok = false), () => console.log('unknown IMEI correctly rejected'))
} catch (e) { console.error(e); ok = false }
gw.kill(); mock.close()
console.log(ok ? 'E2E OK' : 'E2E FAILED'); process.exit(ok ? 0 : 1)
