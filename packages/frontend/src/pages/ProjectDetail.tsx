import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DeployStatus from '../components/DeployStatus'
import LogViewer from '../components/LogViewer'

interface Deploy {
  id: string
  status: string
  started_at: number
  log?: string
}

interface Project {
  id: string
  name: string
  gitea_repo: string
  gitea_url: string
  branch: string
  status: string
  deploys: Deploy[]
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [expandedDeploy, setExpandedDeploy] = useState<string | null>(null)

  const fetchProject = () => {
    fetch(`/api/projects/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Project not found')
        return r.json()
      })
      .then(setProject)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchProject()
  }, [id])

  const handleDeploy = async () => {
    setDeploying(true)
    try {
      const res = await fetch(`/api/projects/${id}/deploy`, { method: 'POST' })
      if (!res.ok) throw new Error('Deploy failed to start')
      fetchProject()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeploying(false)
    }
  }

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete project')
      navigate('/')
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (loading) return <div className="loading">Loading...</div>
  if (error && !project) return <div className="error-msg">{error}</div>
  if (!project) return <div className="error-msg">Project not found</div>

  const liveUrl = `https://${project.name}.stefaniniserver.com`

  return (
    <div>
      {error && <div className="error-msg">{error}</div>}

      <div className="detail-header">
        <div>
          <h1>{project.name}</h1>
          <div className="detail-meta">
            <span>{project.gitea_repo}</span>
            <span>Branch: {project.branch}</span>
            <DeployStatus status={project.status} />
            <a href={liveUrl} target="_blank" rel="noopener noreferrer">
              {liveUrl}
            </a>
          </div>
        </div>
        <div className="detail-actions">
          <button className="btn btn-primary" onClick={handleDeploy} disabled={deploying}>
            {deploying ? 'Deploying...' : 'Deploy'}
          </button>
          <button className="btn btn-danger" onClick={() => setShowConfirm(true)}>
            Delete
          </button>
        </div>
      </div>

      <h2 className="section-title">Deploys</h2>
      {project.deploys.length === 0 ? (
        <div className="empty-state">
          <p>No deploys yet. Click Deploy to get started.</p>
        </div>
      ) : (
        <div className="deploy-list">
          {project.deploys.map((d) => (
            <div key={d.id} className="deploy-item">
              <div
                className="deploy-item-header"
                onClick={() => setExpandedDeploy(expandedDeploy === d.id ? null : d.id)}
              >
                <div className="deploy-item-info">
                  <DeployStatus status={d.status} />
                  <span>{d.id.slice(0, 8)}</span>
                </div>
                <span className="deploy-time">{new Date(d.started_at).toLocaleString()}</span>
              </div>
              {expandedDeploy === d.id && (
                <div style={{ padding: '0 16px 16px' }}>
                  <LogViewer deployId={d.id} status={d.status} log={d.log} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showConfirm && (
        <div className="confirm-overlay" onClick={() => setShowConfirm(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Project</h3>
            <p>Are you sure you want to delete "{project.name}"? This action cannot be undone.</p>
            <div className="confirm-dialog-actions">
              <button className="btn" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
