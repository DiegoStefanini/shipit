import { Routes, Route, Link, NavLink, Navigate, useNavigate } from 'react-router-dom'
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
import ErrorBoundary from './components/ErrorBoundary'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('shipit_token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Inline SVG icons — tiny, no deps
const icons = {
  projects: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>,
  hosts: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="12" height="5" rx="1"/><rect x="2" y="9" width="12" height="5" rx="1"/><circle cx="4.5" cy="4.5" r=".5" fill="currentColor" stroke="none"/><circle cx="4.5" cy="11.5" r=".5" fill="currentColor" stroke="none"/></svg>,
  monitoring: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 12 5 7 8 9 11 4 14 8"/></svg>,
  logs: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><line x1="5.5" y1="5" x2="10.5" y2="5"/><line x1="5.5" y1="7.5" x2="10.5" y2="7.5"/><line x1="5.5" y1="10" x2="8" y2="10"/></svg>,
  security: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.5l5.5 2v4c0 3.5-2.5 5.5-5.5 7-3-1.5-5.5-3.5-5.5-7v-4L8 1.5z"/></svg>,
  alerts: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13a2 2 0 004 0"/><path d="M8 2a4.5 4.5 0 00-4.5 4.5c0 2.5-1 3.5-1 3.5h11s-1-1-1-3.5A4.5 4.5 0 008 2z"/></svg>,
}

export default function App() {
  const navigate = useNavigate()
  const [username, setUsername] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
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
    setMenuOpen(false)
    navigate('/login')
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <ToastProvider>
      <div className="app">
        {token && (
          <header className="navbar">
            <Link to="/" className="navbar-logo">
              <svg className="logo-svg" viewBox="0 0 24 28" width="16" height="19" fill="none">
                <path d="M12 1 L22 13 L17.5 13 L17.5 21.5 L20.5 26 L3.5 26 L6.5 21.5 L6.5 13 L2 13 Z" fill="#f97316"/>
                <rect x="9" y="16" width="6" height="1.5" rx=".75" fill="#3b82f6" opacity=".55"/>
              </svg>
              ShipIt
            </Link>
            <button
              className="navbar-toggle"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
            <nav className={`navbar-links ${menuOpen ? 'open' : ''}`}>
              <NavLink to="/" end className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                {icons.projects} Projects
              </NavLink>
              <NavLink to="/hosts" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                {icons.hosts} Hosts
              </NavLink>
              <NavLink to="/monitoring" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                {icons.monitoring} Monitoring
              </NavLink>
              <NavLink to="/logs" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                {icons.logs} Logs
              </NavLink>
              <NavLink to="/security" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                {icons.security} Security
              </NavLink>
              <NavLink to="/alerts" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                {icons.alerts} Alerts
              </NavLink>
            </nav>
            <div className="navbar-right">
              {username && <span className="navbar-user">{username}</span>}
              <Link to="/new" className="btn btn-primary" onClick={closeMenu}>
                + New
              </Link>
              <Link to="/settings" className="btn" onClick={closeMenu}>
                Settings
              </Link>
              <button className="btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </header>
        )}
        <main className={token ? 'main-content' : ''}>
          <ErrorBoundary>
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
          </ErrorBoundary>
        </main>
      </div>
    </ToastProvider>
  )
}
