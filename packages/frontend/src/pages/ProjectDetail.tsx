import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import DeployStatus from '../components/DeployStatus'
import LogViewer from '../components/LogViewer'
import { apiFetch } from '../api'
import { usePolling } from '../hooks/usePolling'
import { useToast } from '../components/Toast'
import { getConfig } from '../config'
import { timeAgo } from '../utils/time'
import type { Project, Deploy } from '../types'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [project, setProject] = useState<Project | null>(null)
  const [deploys, setDeploys] = useState<Deploy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [expandedDeploy, setExpandedDeploy] = useState<string | null>(null)

  const fetchProject = useCallback(() => {
    Promise.all([
      apiFetch(`/api/projects/${id}`).then((r) => {
        if (!r.ok) throw new Error('Project not found')
        return r.json()
      }),
      apiFetch(`/api/projects/${id}/deploys`).then((r) => {
        if (!r.ok) return []
        return r.json()
      }),
    ])
      .then(([proj, deps]) => {
        setProject(proj)
        setDeploys(deps)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  const isBuilding = project?.status === 'building'
  usePolling(fetchProject, isBuilding ? 3_000 : 15_000)

  const handleDeploy = async () => {
    setDeploying(true)
    try {
      const res = await apiFetch(`/api/projects/${id}/deploy`, { method: 'POST' })
      if (!res.ok) throw new Error('Deploy failed to start')
      toast('Deploy queued', 'success')
      fetchProject()
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setDeploying(false)
    }
  }

  const handleDelete = async () => {
    try {
      const res = await apiFetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete project')
      toast('Project deleted', 'info')
      navigate('/')
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  const isStopped = project?.status === 'stopped'

  const handleToggleOnline = async () => {
    setToggling(true)
    try {
      const endpoint = isStopped ? 'start' : 'stop'
      const res = await apiFetch(`/api/projects/${id}/${endpoint}`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to ${endpoint} project`)
      }
      toast(isStopped ? 'Rebuild queued' : 'Project stopped', 'success')
      fetchProject()
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setToggling(false)
    }
  }

  const toggleDeploy = (deployId: string) => {
    setExpandedDeploy(expandedDeploy === deployId ? null : deployId)
  }

  if (loading) return <div className="loading">Loading...</div>
  if (error && !project) return <div className="error-msg">{error}</div>
  if (!project) return <div className="error-msg">Project not found</div>

  const { baseDomain } = getConfig()
  const liveUrl = `https://${project.name}.${baseDomain}`

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
            <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="link-primary">
              {liveUrl}
            </a>
          </div>
        </div>
        <div className="detail-actions">
          <Link to={`/projects/${id}/settings`} className="btn">
            Settings
          </Link>
          <button
            className={isStopped ? 'btn btn-primary' : 'btn btn-warning'}
            onClick={handleToggleOnline}
            disabled={toggling || project.status === 'building'}
          >
            {toggling ? (isStopped ? 'Starting...' : 'Stopping...') : (isStopped ? 'Start' : 'Stop')}
          </button>
          <button className="btn btn-primary" onClick={handleDeploy} disabled={deploying || isStopped}>
            {deploying ? 'Deploying...' : 'Deploy'}
          </button>
          <button className="btn btn-danger" onClick={() => setShowConfirm(true)}>
            Delete
          </button>
        </div>
      </div>

      <h2 className="section-title">Deploys</h2>
      {deploys.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#128230;</div>
          <p>No deploys yet. Click Deploy to get started.</p>
        </div>
      ) : (
        <div className="deploy-list">
          {deploys.map((d) => (
            <div key={d.id} className="deploy-item">
              <div
                className="deploy-item-header"
                role="button"
                tabIndex={0}
                onClick={() => toggleDeploy(d.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleDeploy(d.id)
                  }
                }}
              >
                <div className="deploy-item-info">
                  <DeployStatus status={d.status} />
                  <span>{d.id.slice(0, 8)}</span>
                  {d.commit_msg && <span className="text-muted"> — {d.commit_msg}</span>}
                </div>
                <span className="deploy-time">{timeAgo(d.started_at)}</span>
              </div>
              {expandedDeploy === d.id && (
                <div className="deploy-item-logs">
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
