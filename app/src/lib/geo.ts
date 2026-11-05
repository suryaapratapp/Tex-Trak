export type LL = [number, number] // [lat, lng]
const R = 6371000
const rad = (d: number) => (d * Math.PI) / 180

export function dist(a: LL, b: LL) {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1])
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
export function bearing(a: LL, b: LL) {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]))
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}
export function cumulative(pts: LL[]) {
  const c = [0]
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + dist(pts[i - 1], pts[i]))
  return c
}
/** Point + heading at distance d (m) along polyline */
export function along(pts: LL[], cum: number[], d: number): { pos: LL; heading: number } {
  const total = cum[cum.length - 1]
  d = Math.max(0, Math.min(total, d))
  let lo = 0, hi = cum.length - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m }
  const seg = cum[hi] - cum[lo] || 1
  const f = (d - cum[lo]) / seg
  const a = pts[lo], b = pts[hi]
  return { pos: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], heading: bearing(a, b) }
}
/** Shortest distance (m) from point to polyline (local equirectangular projection) */
export function distToPoly(p: LL, pts: LL[]) {
  const k = Math.cos(rad(p[0]))
  const px = p[1] * k * 111320, py = p[0] * 110540
  let best = Infinity
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1][1] * k * 111320, ay = pts[i - 1][0] * 110540
    const bx = pts[i][1] * k * 111320, by = pts[i][0] * 110540
    const dx = bx - ax, dy = by - ay
    const l2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    if (d < best) best = d
  }
  return best
}
export const lerp = (a: number, b: number, f: number) => a + (b - a) * f

export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Compact synchronous SHA-256 (hex) — mirrors the pgcrypto digest() used by the DB custody trigger */
const K: number[] = [], H0: number[] = []
;(() => {
  let n = 2, i = 0
  const frac = (x: number) => x - Math.floor(x)
  while (i < 64) {
    let p = true
    for (let d = 2; d * d <= n; d++) if (n % d === 0) { p = false; break }
    if (p) { if (i < 8) H0.push((frac(Math.sqrt(n)) * 2 ** 32) | 0); K.push((frac(Math.cbrt(n)) * 2 ** 32) | 0); i++ }
    n++
  }
})()
export function sha256(msg: string): string {
  const bytes = new TextEncoder().encode(msg)
  const l = bytes.length, withPad = new Uint8Array(((l + 9 + 63) >> 6) << 6)
  withPad.set(bytes); withPad[l] = 0x80
  const dv = new DataView(withPad.buffer)
  dv.setUint32(withPad.length - 4, (l * 8) >>> 0); dv.setUint32(withPad.length - 8, Math.floor((l * 8) / 2 ** 32))
  const h = H0.slice(), w = new Array<number>(64)
  const rr = (x: number, n: number) => (x >>> n) | (x << (32 - n))
  for (let o = 0; o < withPad.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0
      const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('')
}
