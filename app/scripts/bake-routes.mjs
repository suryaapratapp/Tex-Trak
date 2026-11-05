// Bakes real road geometry (OSRM) for the demo routes into src/sim/routes.json
import fs from 'node:fs'
const P = {
  DECON: [-0.2850, 51.5295], HOSP: [-0.1340, 51.5246], RECY: [0.1450, 51.5330],
  SYN: [-0.2760, 51.5088], PORT: [0.3570, 51.4540], HUB: [-0.0030, 51.5410], COMM: [-0.1430, 51.5415],
}
const pairs = { decon_hosp:['DECON','HOSP'], hosp_decon:['HOSP','DECON'], hosp_recy:['HOSP','RECY'],
  decon_recy:['DECON','RECY'], decon_port:['DECON','PORT'], hub_comm:['HUB','COMM'], syn_hosp:['SYN','HOSP'], hosp_syn:['HOSP','SYN'] }
const out = {}
for (const [k,[a,b]] of Object.entries(pairs)) {
  const url = `https://router.project-osrm.org/route/v1/driving/${P[a]};${P[b]}?overview=full&geometries=geojson`
  const r = await (await fetch(url)).json()
  const route = r.routes[0]
  const pts = route.geometry.coordinates
  const step = Math.max(1, Math.floor(pts.length / 220))
  const dec = pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map(([lng, lat]) => [+lat.toFixed(5), +lng.toFixed(5)])
  out[k] = { pts: dec, meters: Math.round(route.distance), osrmSeconds: Math.round(route.duration) }
  console.log(k, dec.length, 'pts', (route.distance/1000).toFixed(1), 'km', Math.round(route.duration/60), 'min')
}
fs.writeFileSync(new URL('../src/sim/routes.json', import.meta.url), JSON.stringify(out))
