import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import NewProject from './pages/NewProject'
import ProjectDetail from './pages/ProjectDetail'
import Login from './pages/Login'

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
    <div className="app">
      {token && (
        <header className="navbar">
          <Link to="/" className="navbar-logo">
            <span className="logo-icon">&#9650;</span> ShipIt
          </Link>
          <div className="navbar-right">
            {username && <span className="navbar-user">{username}</span>}
            <Link to="/new" className="btn btn-primary">
              + New Project
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
        </Routes>
      </main>
    </div>
  )
}
