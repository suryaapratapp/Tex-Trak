// Pretend to be an RFID reader. Sends tag reads to the ingest-rfid function.
//   INGEST_TOKEN=... node tools/rfid-sim.mjs R-DOCK-01 E28011606000020D1A2B3C4D [more EPCs...]
// Optional: INGEST_URL (defaults to the project function URL)
const url = process.env.INGEST_URL ?? 'https://qhxdqgkpebmpzzuzqcla.supabase.co/functions/v1/ingest-rfid'
const token = process.env.INGEST_TOKEN
const [reader, ...epcs] = process.argv.slice(2)
if (!token || !reader || epcs.length === 0) { console.error('Usage: INGEST_TOKEN=... node tools/rfid-sim.mjs <reader-code> <epc> [epc...]'); process.exit(1) }
const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ingest-token': token }, body: JSON.stringify({ reader, reads: epcs.map((epc) => ({ epc, ts: new Date().toISOString() })) }) })
console.log(res.status, await res.text())
