import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
export function QrImg({ text, size = 120 }: { text: string; size?: number }) {
  const [src, setSrc] = useState('')
  useEffect(() => { QRCode.toDataURL(text, { margin: 1, width: size * 2, color: { dark: '#0b1b33', light: '#ffffff' } }).then(setSrc) }, [text, size])
  return src ? <img src={src} width={size} height={size} alt={text} className="rounded-lg" /> : <div style={{ width: size, height: size }} className="rounded-lg bg-stone-100" />
}
