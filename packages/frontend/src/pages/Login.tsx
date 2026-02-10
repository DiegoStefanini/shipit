import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username || !password) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Invalid credentials')
      }
      const { token } = await res.json()
      localStorage.setItem('shipit_token', token)
      navigate('/')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <svg className="logo-svg" viewBox="0 0 24 28" width="32" height="37" fill="none">
            <defs>
              <linearGradient id="logo-grad" x1="12" y1="1" x2="12" y2="26" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fb923c"/>
                <stop offset="100%" stopColor="#ea580c"/>
              </linearGradient>
            </defs>
            <path d="M12 1 L22 13 L17.5 13 L17.5 21.5 L20.5 26 L3.5 26 L6.5 21.5 L6.5 13 L2 13 Z" fill="url(#logo-grad)"/>
            <rect x="9" y="16" width="6" height="1.5" rx=".75" fill="#3b82f6" opacity=".55"/>
          </svg>
          <h1>ShipIt</h1>
        </div>
        <p className="login-kicker">Control Plane</p>
        <p className="login-subtitle">Sign in to your account</p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary login-btn" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
