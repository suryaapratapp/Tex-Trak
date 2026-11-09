import { Fragment, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import { Page } from '../components/ui'
import md from '../content/TRAINING.md?raw'

const inline = (t: string): ReactNode[] => t.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((x, i) => x.startsWith('**') ? <b key={i} className="font-semibold text-stone-900">{x.slice(2, -2)}</b> : x.startsWith('`') ? <code key={i} className="mono rounded bg-stone-100 px-1.5 py-0.5 text-[0.88em]">{x.slice(1, -1)}</code> : x.startsWith('*') && x.length > 2 ? <i key={i}>{x.slice(1, -1)}</i> : <Fragment key={i}>{x}</Fragment>)
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** A small Markdown reader, enough for the training guide. */
function Doc({ src }: { src: string }) {
  const lines = src.split('\n'); const out: ReactNode[] = []; let i = 0; let k = 0
  while (i < lines.length) {
    const l = lines[i]
    if (l.startsWith('```')) { const code: string[] = []; i++; while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]); i++; out.push(<pre key={k++} className="mono my-4 overflow-x-auto rounded-lg bg-stone-50 p-4 text-[13px] leading-relaxed text-stone-700">{code.join('\n')}</pre>); continue }
    if (/^#{1,3} /.test(l)) { const n = l.match(/^#+/)![0].length; const t = l.replace(/^#+ /, ''); const cls = n === 1 ? 'mt-2 text-[30px] font-semibold tracking-tight' : n === 2 ? 'mt-10 border-t border-stone-200 pt-8 text-[22px] font-semibold tracking-tight' : 'mt-6 text-[17px] font-semibold'; out.push(n === 1 ? <h1 key={k++} id={slug(t)} className={cls}>{t}</h1> : n === 2 ? <h2 key={k++} id={slug(t)} className={cls}>{t}</h2> : <h3 key={k++} id={slug(t)} className={cls}>{t}</h3>); i++; continue }
    if (l.trim() === '---') { i++; continue }
    if (l.startsWith('|')) {
      const rows: string[][] = []; while (i < lines.length && lines[i].startsWith('|')) { if (!/^\|[\s:|-]+\|$/.test(lines[i])) rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim())); i++ }
      out.push(<div key={k++} className="my-4 overflow-x-auto rounded-lg border border-stone-200"><table className="w-full text-left text-[14px]"><thead><tr>{rows[0].map((c, j) => <th key={j} className="bg-stone-50 px-4 py-2.5 font-semibold">{inline(c)}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{rows.slice(1).map((r, j) => <tr key={j}>{r.map((c, m) => <td key={m} className="px-4 py-2.5 align-top text-stone-700">{inline(c)}</td>)}</tr>)}</tbody></table></div>); continue
    }
    if (/^(\s*)([-*]|\d+\.) /.test(l)) {
      const ordered = /^\s*\d+\./.test(l); const items: { d: number; t: string }[] = []
      while (i < lines.length && /^(\s*)([-*]|\d+\.) /.test(lines[i])) { const m = lines[i].match(/^(\s*)([-*]|\d+\.) (.*)$/)!; items.push({ d: m[1].length >= 2 ? 1 : 0, t: m[3] }); i++ }
      const Tag = ordered ? 'ol' : 'ul'; out.push(<Tag key={k++} className={`my-3 space-y-1.5 pl-6 text-[15px] leading-relaxed text-stone-700 ${ordered ? 'list-decimal' : 'list-disc'}`}>{items.map((it, j) => <li key={j} className={it.d ? 'ml-5 list-[circle]' : ''}>{inline(it.t)}</li>)}</Tag>); continue
    }
    if (l.trim() === '') { i++; continue }
    const para: string[] = [l]; i++; while (i < lines.length && lines[i].trim() !== '' && !/^(#|```|\||---|\s*([-*]|\d+\.) )/.test(lines[i])) para.push(lines[i++])
    out.push(<p key={k++} className="my-3 text-[15px] leading-relaxed text-stone-700">{inline(para.join(' '))}</p>)
  }
  return <>{out}</>
}

export default function Help() {
  const toc = md.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.replace('## ', ''))
  return (
    <Page title="Help and training" sub="How to set up and use Tex-Trak." right={<button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[14px] font-medium text-stone-700 hover:bg-stone-50"><Printer size={16} /> Print or save as PDF</button>}>
      <div className="grid items-start gap-8 lg:grid-cols-[240px_1fr]">
        <nav className="card sticky top-4 hidden p-4 lg:block"><div className="mb-2 px-2 text-[12px] font-semibold uppercase tracking-wider text-stone-400">Contents</div>{toc.map((t) => <a key={t} href={`#${slug(t)}`} onClick={(e) => { e.preventDefault(); document.getElementById(slug(t))?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} className="block rounded-md px-2 py-1.5 text-[13.5px] text-stone-600 hover:bg-stone-50 hover:text-stone-900">{t}</a>)}</nav>
        <article className="card max-w-[820px] p-8"><Doc src={md.replace(/^# .*\n/, '')} /></article>
      </div>{createPortal(<div className="print-only" style={{ fontFamily: 'Inter, Arial, sans-serif', maxWidth: 760, margin: '0 auto' }}><div style={{ borderBottom: '3px solid #6759e4', paddingBottom: 8, marginBottom: 12, fontSize: 12, letterSpacing: 2, fontWeight: 700, color: '#6759e4' }}>TEX-TRAK · TRAINING GUIDE</div><Doc src={md.replace(/^# .*\n/, '')} /></div>, document.body)}</Page>)
}
