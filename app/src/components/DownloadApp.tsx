import { Apple, Download, Smartphone } from 'lucide-react'
import { isNative } from '../lib/offline'

export const APK_URL = '/downloads/Tex-Trak.apk'
export const APK_VERSION = '1.4'
/** Set to the TestFlight or App Store link once the iPhone app is published. Empty = shown as "coming soon". */
export const IOS_URL = ''

const ios = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)

function Store({ icon, name, note, href, download }: { icon: React.ReactNode; name: string; note: string; href?: string; download?: string }) {
  const body = (<>
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${href ? 'bg-cyan-600 text-white' : 'bg-stone-200 text-stone-500'}`}>{icon}</span>
    <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-stone-900">{name}</span><span className="block text-[12px] text-stone-500">{note}</span></span>
    {href ? <Download size={17} className="shrink-0 text-cyan-700" /> : <span className="shrink-0 rounded-full bg-stone-200 px-2 py-0.5 text-[10.5px] font-semibold text-stone-500">Coming soon</span>}</>)
  const cls = 'flex items-center gap-3 rounded-lg border p-3 transition '
  return href
    ? <a href={href} download={download} className={cls + 'border-cyan-200 bg-cyan-50 hover:border-cyan-300 hover:bg-cyan-100/70'}>{body}</a>
    : <div className={cls + 'border-stone-200 bg-stone-50'}>{body}</div>
}

/** "Download the mobile app": separate Android and iPhone entries. Hidden inside the installed app itself. */
export function DownloadApp({ variant }: { variant: 'card' | 'link' }) {
  if (isNative) return null
  const href = ios ? IOS_URL : APK_URL
  if (variant === 'link') return (
    <a href={href || undefined} download={ios ? undefined : 'Tex-Trak.apk'} onClick={(e) => { if (!href) { e.preventDefault(); alert('The iPhone app is coming soon. Android users can download it now.') } }}
      className="mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-cyan-700 transition hover:bg-cyan-50">
      <Smartphone size={15} />Download the mobile app<span className="ml-auto text-[11px] text-stone-400">{ios ? 'iPhone' : 'Android'}</span></a>)
  return (
    <div className="mt-4 rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2 text-[14.5px] font-semibold text-stone-900"><Smartphone size={17} className="text-cyan-600" />Download the mobile app</div>
      <div className="mt-0.5 text-[12.5px] text-stone-500">Scans offline and tracks in the background.</div>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <Store icon={<Smartphone size={18} />} name="Android" note={`APK · version ${APK_VERSION}`} href={APK_URL} download="Tex-Trak.apk" />
        <Store icon={<Apple size={18} />} name="iPhone and iPad" note="TestFlight / App Store" href={IOS_URL || undefined} />
      </div></div>)
}
