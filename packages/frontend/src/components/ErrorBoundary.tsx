import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ margin: '48px auto', maxWidth: 520, textAlign: 'center', padding: 32 }}>
          <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
          <p className="text-muted" style={{ marginBottom: 16 }}>
            An unexpected error occurred. You can try again or go back to the dashboard.
          </p>
          {this.state.error && (
            <div className="error-msg" style={{ marginBottom: 16, textAlign: 'left', fontSize: '0.85rem' }}>
              {this.state.error.message}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={this.handleReset}>
              Try Again
            </button>
            <button className="btn" onClick={() => { window.location.href = '/' }}>
              Go to Dashboard
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
