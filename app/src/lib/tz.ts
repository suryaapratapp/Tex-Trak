/** Everything in Tex-Trak is shown in UK time (Europe/London, GMT in winter and BST in summer), wherever the device is. */
export const UK_TZ = 'Europe/London'

// Dates and times formatted anywhere in the app default to UK time, unless a call asks for another zone.
const patch = (name: 'toLocaleString' | 'toLocaleDateString' | 'toLocaleTimeString') => {
  const orig = Date.prototype[name] as (l?: Intl.LocalesArgument, o?: Intl.DateTimeFormatOptions) => string
  Date.prototype[name] = function (this: Date, locales?: Intl.LocalesArgument, opts?: Intl.DateTimeFormatOptions) { return orig.call(this, locales, opts?.timeZone ? opts : { ...(opts ?? {}), timeZone: UK_TZ }) } as never
}
patch('toLocaleString'); patch('toLocaleDateString'); patch('toLocaleTimeString')

const parts = (d: Date) => { const o: Record<string, number> = {}; for (const p of new Intl.DateTimeFormat('en-GB', { timeZone: UK_TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d)) if (p.type !== 'literal') o[p.type] = +p.value; return o }
const pad = (n: number) => String(n).padStart(2, '0')

/** The UK calendar day of an instant, as YYYY-MM-DD. */
export const ukDayKey = (d: Date = new Date()) => { const p = parts(d); return `${p.year}-${pad(p.month)}-${pad(p.day)}` }
/** The hour (0 to 23) in the UK. */
export const ukHour = (d: Date = new Date()) => parts(d).hour
/** UK offset from UTC at an instant, in minutes (0 in winter, 60 in summer). */
const ukOffset = (t: number) => { const p = parts(new Date(t)); return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000) / 60000 }
/** The instant when a UK wall-clock time happens. */
export const ukInstant = (y: number, m: number, d: number, hh = 0, mm = 0) => { const guess = Date.UTC(y, m - 1, d, hh, mm); const a = guess - ukOffset(guess) * 60000; return new Date(guess - ukOffset(a) * 60000) }
/** Midnight at the start of a UK day (YYYY-MM-DD). */
export const ukStartOf = (key: string) => { const [y, m, d] = key.split('-').map(Number); return ukInstant(y, m, d) }
/** A UK day key moved forward or back by whole days. */
export const ukAddDays = (key: string, n: number) => { const [y, m, d] = key.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}` }
/** A value from a date-and-time box (YYYY-MM-DDTHH:mm) read as UK time, returned as an ISO instant. */
export const ukLocalToIso = (v: string) => { const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); return m ? ukInstant(+m[1], +m[2], +m[3], +m[4], +m[5]).toISOString() : new Date(v).toISOString() }
/** Whole days from the UK today to a UK date (YYYY-MM-DD). */
export const ukDaysTo = (key: string) => Math.round((Date.UTC(...(key.split('-').map(Number) as [number, number, number]).map((n, i) => (i === 1 ? n - 1 : n)) as [number, number, number]) - Date.UTC(...(ukDayKey().split('-').map(Number) as [number, number, number]).map((n, i) => (i === 1 ? n - 1 : n)) as [number, number, number])) / 86400000)
