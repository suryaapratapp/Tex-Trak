import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { inputCls } from '../qr/ui'

/** Password field with a Show / Hide button. */
export function PasswordInput({ value, onChange, autoComplete, id, placeholder }: { value: string; onChange: (v: string) => void; autoComplete?: string; id?: string; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} placeholder={placeholder} className={`${inputCls} pr-24`} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} className="absolute inset-y-0 right-0 flex items-center gap-1.5 rounded-r-lg px-4 text-[13.5px] font-medium text-stone-500 hover:text-stone-900">{show ? <EyeOff size={17} /> : <Eye size={17} />}{show ? 'Hide' : 'Show'}</button>
    </div>)
}
