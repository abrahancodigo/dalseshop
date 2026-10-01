import { Component } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AppRouter from '@/router'
import ScrollRestoration from '@/components/ScrollRestoration'
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
          <h1>No pudimos mostrar esta página.</h1>
          <button onClick={() => window.location.reload()}>Volver a intentar</button>
          {import.meta.env.DEV && <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{this.state.error.stack}</pre>}
          {import.meta.env.DEV && this.state.errorInfo && (
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

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <ErrorBoundary>
    <BrowserRouter>
      <ScrollRestoration />
      <Providers>
        <AppRouter />
      </Providers>
    </BrowserRouter>
  </ErrorBoundary>
)
