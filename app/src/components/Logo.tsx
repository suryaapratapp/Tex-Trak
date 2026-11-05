/** Tex-Trak mark: a "T" drawn as a tracked route (three scan nodes) on an iris gradient. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Tex-Trak">
      <defs><linearGradient id="tt-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7c6cff" /><stop offset="1" stopColor="#3a2f98" /></linearGradient></defs>
      <rect width="48" height="48" rx="14" fill="url(#tt-g)" />
      <path d="M13 16h22M24 16v19" stroke="#fff" strokeWidth="4.4" strokeLinecap="round" fill="none" />
      <circle cx="13" cy="16" r="4" fill="#fff" /><circle cx="35" cy="16" r="4" fill="#fff" /><circle cx="24" cy="35" r="5" fill="#34e0c4" stroke="#fff" strokeWidth="2.4" />
    </svg>)
}
