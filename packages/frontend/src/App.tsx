import { Routes, Route, Link } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import NewProject from './pages/NewProject'
import ProjectDetail from './pages/ProjectDetail'

export default function App() {
  return (
    <div className="app">
      <header className="navbar">
        <Link to="/" className="navbar-logo">
          <span className="logo-icon">&#9650;</span> ShipIt
        </Link>
        <Link to="/new" className="btn btn-primary">
          + New Project
        </Link>
      </header>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<NewProject />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
        </Routes>
      </main>
    </div>
  )
}
