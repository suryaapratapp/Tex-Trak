import { Component, type ErrorInfo, type ReactNode } from 'react'
import { toast } from '../lib/toast'

/** Keeps one broken page from blanking the whole app: shows a plain message and a way back. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: Error, info: ErrorInfo) { console.error(e, info.componentStack); toast.error('Something went wrong on this page.') }
  componentDidUpdate(prev: { resetKey?: string }) { if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false }) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="mx-auto mt-16 max-w-[460px] rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-[19px] font-extrabold text-stone-900">This page could not be shown</h2>
        <p className="mt-2 text-[14.5px] text-stone-500">Nothing has been lost. Try again, or open another page from the menu. If it keeps happening, tell surya@circai.co.uk what you were doing.</p>
        <button onClick={() => this.setState({ failed: false })} className="mt-5 rounded-2xl bg-violet-600 px-6 py-2.5 text-[14.5px] font-bold text-white hover:bg-violet-700">Try again</button>
      </div>)
  }
}
