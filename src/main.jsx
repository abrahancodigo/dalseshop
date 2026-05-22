import { Component, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import AppRouter from '@/router'
import Providers from '@/components/Providers'
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
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
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
