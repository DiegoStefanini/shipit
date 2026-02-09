import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import ProjectCard from '../components/ProjectCard'
import { ProjectCardSkeleton } from '../components/Skeleton'
import { usePolling } from '../hooks/usePolling'
import { apiFetch } from '../api'
import type { Project } from '../types'

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const fetchProjects = useCallback(() => {
    apiFetch('/api/projects')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch projects')
        return r.json()
      })
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  usePolling(fetchProjects, 30_000)

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.gitea_repo.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: projects.length,
    running: projects.filter((p) => p.status === 'running').length,
    failed: projects.filter((p) => p.status === 'failed').length,
    building: projects.filter((p) => p.status === 'building').length,
  }

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

      {!loading && projects.length > 0 && (
        <div className="stats-bar">
          <div className="stat">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat">
            <span className="stat-value stat-running">{stats.running}</span>
            <span className="stat-label">Running</span>
          </div>
          <div className="stat">
            <span className="stat-value stat-failed">{stats.failed}</span>
            <span className="stat-label">Failed</span>
          </div>
          <div className="stat">
            <span className="stat-value stat-building">{stats.building}</span>
            <span className="stat-label">Building</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="project-grid">
          {[1, 2, 3].map((i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="error-msg">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#9650;</div>
          <h2>No projects found</h2>
          <p>
            {projects.length === 0 ? (
              <>
                Get started by <Link to="/new" className="link-primary">creating your first project</Link>.
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
