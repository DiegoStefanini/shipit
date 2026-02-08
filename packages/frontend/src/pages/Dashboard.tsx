import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ProjectCard from '../components/ProjectCard'
import { apiFetch } from '../api'

interface Project {
  id: string
  name: string
  gitea_repo: string
  status: string
  updated_at: number
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    apiFetch('/api/projects')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch projects')
        return r.json()
      })
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.gitea_repo.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="loading">Loading projects...</div>
  if (error) return <div className="error-msg">{error}</div>

  return (
    <div>
      <div className="page-header">
        <h1>Projects</h1>
        <input
          type="text"
          className="search-input"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <h2>No projects found</h2>
          <p>
            {projects.length === 0 ? (
              <>
                Get started by <Link to="/new" style={{ color: '#10b981' }}>creating your first project</Link>.
              </>
            ) : (
              'No projects match your search.'
            )}
          </p>
        </div>
      ) : (
        <div className="project-grid">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  )
}
