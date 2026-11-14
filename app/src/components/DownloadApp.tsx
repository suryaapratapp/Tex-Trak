import { useState } from 'react'
import { Download, Plus, Share, Smartphone, X } from 'lucide-react'
import { isNative } from '../lib/offline'

export const APK_URL = '/downloads/Tex-Trak.apk'
export const APK_VERSION = '1.4'
/** Optional: once a TestFlight or App Store link exists, set it here and the iPhone button opens it instead of the install guide. */
export const IOS_URL = ''

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
const onIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
const installed = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)

export function AndroidLogo({ size = 20 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M6 9.5h12v8.2a1.3 1.3 0 0 1-1.3 1.3H15v2.3a1.2 1.2 0 0 1-2.4 0V19h-1.2v2.3a1.2 1.2 0 0 1-2.4 0V19H7.3A1.3 1.3 0 0 1 6 17.7z" />
    <rect x="2.6" y="9.6" width="2.4" height="7" rx="1.2" /><rect x="19" y="9.6" width="2.4" height="7" rx="1.2" />
    <path d="M6.2 8.4a5.8 5.8 0 0 1 11.6 0z" /><path d="M8.3 3.2 9.4 5M15.7 3.2 14.6 5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" />
    <circle cx="9.6" cy="6.4" r=".7" fill="#fff" /><circle cx="14.4" cy="6.4" r=".7" fill="#fff" /></svg>)
}
export const AppleLogo = ({ size = 20 }: { size?: number }) => <svg width={size * 0.814} height={size} viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" /></svg>

function Guide({ onClose }: { onClose: () => void }) {
  const steps: [React.ReactNode, string][] = [
    [<span key="1" className="font-semibold">1</span>, 'Open this website in Safari on your iPhone or iPad (not inside another app).'],
    [<Share key="2" size={16} />, 'Tap the Share button at the bottom of the screen.'],
    [<Plus key="3" size={16} />, 'Choose Add to Home Screen, then tap Add.'],
    [<Smartphone key="4" size={16} />, 'Open Tex-Trak from your Home Screen. It runs full screen like an app. Sign in as usual.'],
  ]
  return (
    <div className="fixed inset-0 z-[3000] grid place-items-center bg-stone-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-stone-900 text-white"><AppleLogo size={20} /></span>
          <div className="flex-1"><div className="text-[16px] font-semibold text-stone-900">Tex-Trak on iPhone and iPad</div><div className="text-[12.5px] text-stone-500">Free, no App Store needed</div></div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-stone-100"><X size={17} /></button></div>
        <ol className="mt-4 space-y-3">{steps.map(([ic, t], i) => <li key={i} className="flex items-start gap-3 text-[14px] text-stone-700"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cyan-50 text-cyan-700">{ic}</span><span>{t}</span></li>)}</ol>
        <p className="mt-4 rounded-lg bg-stone-50 p-3 text-[12.5px] text-stone-500">QR scanning and signing in work as normal. On iPhone, location is only recorded while the app is open on screen. For tracking with the screen off, use an Android phone or a hardware tracker.</p>
        {!onIos && <p className="mt-3 text-[12.5px] text-stone-500">You are not on an iPhone. Open this page on your iPhone to install.</p>}
      </div></div>)
}

function Store({ logo, tone, name, note, onClick, href, download }: { logo: React.ReactNode; tone: string; name: string; note: string; onClick?: () => void; href?: string; download?: string }) {
  const cls = 'flex w-full items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-cyan-300 hover:shadow-sm'
  const body = (<><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white ${tone}`}>{logo}</span>
    <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-stone-900">{name}</span><span className="block text-[12px] text-stone-500">{note}</span></span>
    <Download size={17} className="shrink-0 text-cyan-700" /></>)
  return href ? <a href={href} download={download} className={cls}>{body}</a> : <button type="button" onClick={onClick} className={cls}>{body}</button>
}

/** "Download the mobile app": separate Android and iPhone entries. Hidden inside the installed app. */
export function DownloadApp({ variant }: { variant: 'card' | 'link' }) {
  const [guide, setGuide] = useState(false)
  if (isNative || installed) return null
  const iosHref = IOS_URL || undefined
  if (variant === 'link') return (<>
    <a href={onIos ? iosHref : APK_URL} download={onIos ? undefined : 'Tex-Trak.apk'} onClick={onIos && !iosHref ? (e) => { e.preventDefault(); setGuide(true) } : undefined}
      className="mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-cyan-700 transition hover:bg-cyan-50">
      {onIos ? <AppleLogo size={15} /> : <AndroidLogo size={15} />}Download the mobile app<span className="ml-auto text-[11px] text-stone-400">{onIos ? 'iPhone' : 'Android'}</span></a>
    {guide && <Guide onClose={() => setGuide(false)} />}</>)
  return (
    <div className="mt-4 rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2 text-[14.5px] font-semibold text-stone-900"><Smartphone size={17} className="text-cyan-600" />Download the mobile app</div>
      <div className="mt-0.5 text-[12.5px] text-stone-500">Scans QR codes, works offline for scanning.</div>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <Store logo={<AndroidLogo size={22} />} tone="bg-[#3ddc84] !text-stone-900" name="Android" note={`APK · version ${APK_VERSION}`} href={APK_URL} download="Tex-Trak.apk" />
        <Store logo={<AppleLogo size={20} />} tone="bg-stone-900" name="iPhone and iPad" note={IOS_URL ? 'TestFlight / App Store' : 'Free: add to Home Screen'} href={iosHref} onClick={() => setGuide(true)} />
      </div>
      {guide && <Guide onClose={() => setGuide(false)} />}
    </div>)
}
