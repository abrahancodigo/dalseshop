import { Component, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import AppRouter from '@/router'
import Providers from '@/components/Providers'
import { resetScrollLock } from '@/lib/scrollLock'
import '@/app/globals.css'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo })
    console.error('ErrorBoundary caught:', error, errorInfo)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', color: 'red', background: '#fff' }}>
          <h1>Error: {this.state.error.message}</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{this.state.error.stack}</pre>
          {this.state.errorInfo && (
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, marginTop: 20, color: '#666' }}>
              {this.state.errorInfo.componentStack}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

function ScrollToTop() {
  const location = useLocation()
  const pathname = location.pathname

  // Cada cambio de ruta:
  //   1) `scrollTo(0,0)` sincronizado con el router (el user NUNCA ve la
  //      página a media altura antes del paint).
  //   2-3) 2 rAFs en cascada: para cuando el layout asincrónico (fonts,
  //      hero de home, lazy sections) estira la página después del primer
  //      paint.
  //
  // GUARDIÁN anti-"scroll undo": los rAF de papeleo pueden caer DENTRO del
  // rAF de `unlockScroll` (que restaura `prevY` al cerrar un modal). Si el
  // user YA bajó (scroll > 4px), NO lo subimos. Y si hay un overlay abierto
  // (body overflow:hidden), no tocamos el scroll.
  const scrollToTop = () => {
    if (typeof window === 'undefined') return
    const overflow = getComputedStyle(document.body).overflow
    if (overflow === 'hidden') return
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    } catch {
      window.scrollTo(0, 0)
    }
  }

  // PASE 1 — sincronizado con router
  useEffect(() => {
    resetScrollLock()
    scrollToTop()
  }, [pathname])

  // PASE 2 — 2 rAFs en cascada, solo si estamos == 0 (el scroll que dejó
  // el layout, no del user).
  useEffect(() => {
    let raf1, raf2, cancelled = false
    raf1 = requestAnimationFrame(() => {
      if (cancelled) return
      raf2 = requestAnimationFrame(() => {
        if (cancelled) return
        if (window.scrollY > 4) return  // el user ya bajó
        scrollToTop()
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
    }
  }, [pathname])

  // Primera carga en URL profunda: `history.scrollRestoration = 'manual'`
  // para que el browser no memorice "donde me dejé la última vez".
  useEffect(() => {
    history.scrollRestoration = 'manual'
    return () => { history.scrollRestoration = 'auto' }
  }, [])

  return null
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <ErrorBoundary>
    <BrowserRouter>
      <ScrollToTop />
      <Providers>
        <AppRouter />
      </Providers>
    </BrowserRouter>
  </ErrorBoundary>
)
