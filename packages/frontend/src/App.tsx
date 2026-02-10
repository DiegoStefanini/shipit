import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import NewProject from './pages/NewProject'
import ProjectDetail from './pages/ProjectDetail'
import ProjectSettings from './pages/ProjectSettings'
import Hosts from './pages/Hosts'
import HostDetail from './pages/HostDetail'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Monitoring from './pages/Monitoring'
import Security from './pages/Security'
import Alerts from './pages/Alerts'
import Logs from './pages/Logs'
import { ToastProvider } from './components/Toast'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('shipit_token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const navigate = useNavigate()
  const [username, setUsername] = useState<string | null>(null)
  const token = localStorage.getItem('shipit_token')

  useEffect(() => {
    if (!token) {
      setUsername(null)
      return
    }
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => setUsername(data.username))
      .catch(() => setUsername(null))
  }, [token])

  const handleLogout = () => {
    localStorage.removeItem('shipit_token')
    setUsername(null)
    navigate('/login')
  }

  return (
    <ToastProvider>
      <div className="app">
        {token && (
          <header className="navbar">
            <Link to="/" className="navbar-logo">
              <span className="logo-icon">&#9650;</span> ShipIt
            </Link>
            <nav className="navbar-links">
              <Link to="/" className="navbar-link">Projects</Link>
              <Link to="/hosts" className="navbar-link">Hosts</Link>
              <Link to="/monitoring" className="navbar-link">Monitoring</Link>
              <Link to="/logs" className="navbar-link">Logs</Link>
              <Link to="/security" className="navbar-link">Security</Link>
              <Link to="/alerts" className="navbar-link">Alerts</Link>
            </nav>
            <div className="navbar-right">
              {username && <span className="navbar-user">{username}</span>}
              <Link to="/new" className="btn btn-primary">
                + New Project
              </Link>
              <Link to="/settings" className="btn">
                Settings
              </Link>
              <button className="btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </header>
        )}
        <main className={token ? 'main-content' : ''}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/new" element={<ProtectedRoute><NewProject /></ProtectedRoute>} />
            <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
            <Route path="/projects/:id/settings" element={<ProtectedRoute><ProjectSettings /></ProtectedRoute>} />
            <Route path="/hosts" element={<ProtectedRoute><Hosts /></ProtectedRoute>} />
            <Route path="/hosts/:id" element={<ProtectedRoute><HostDetail /></ProtectedRoute>} />
            <Route path="/monitoring" element={<ProtectedRoute><Monitoring /></ProtectedRoute>} />
            <Route path="/logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
            <Route path="/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
            <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  )
}
