import { useEffect, useState, useCallback, type FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import StatusIndicator from '../components/StatusIndicator'
import { apiFetch } from '../api'
import { usePolling } from '../hooks/usePolling'
import { useToast } from '../components/Toast'
import { timeAgo } from '../utils/time'
import type { Host, HostMetrics, Project } from '../types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function HostDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [host, setHost] = useState<Host | null>(null)
  const [metrics, setMetrics] = useState<HostMetrics | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    type: 'vm' as 'vm' | 'ct',
    proxmox_vmid: '',
    ip_address: '',
    ssh_port: '22',
    ssh_user: 'root',
    ssh_key_path: '',
    has_docker: false,
    has_crowdsec: false,
  })

  const fetchHost = useCallback(() => {
    apiFetch(`/api/hosts/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Host not found')
        return r.json()
      })
      .then((h: Host) => {
        setHost(h)
        setEditForm({
          name: h.name,
          type: h.type,
          proxmox_vmid: h.proxmox_vmid?.toString() ?? '',
          ip_address: h.ip_address,
          ssh_port: h.ssh_port.toString(),
          ssh_user: h.ssh_user,
          ssh_key_path: h.ssh_key_path ?? '',
          has_docker: h.has_docker === 1,
          has_crowdsec: h.has_crowdsec === 1,
        })
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const fetchMetrics = useCallback(() => {
    apiFetch(`/api/hosts/${id}/status`)
      .then((r) => {
        if (!r.ok) return null
        return r.json()
      })
      .then((m) => {
        if (m) setMetrics(m)
      })
      .catch(() => {})
  }, [id])

  const fetchProjects = useCallback(() => {
    apiFetch('/api/projects')
      .then((r) => {
        if (!r.ok) return []
        return r.json()
      })
      .then((all: Project[]) => {
        setProjects(all.filter((p) => p.host_id === id))
      })
      .catch(() => {})
  }, [id])

  useEffect(() => {
    fetchHost()
    fetchMetrics()
    fetchProjects()
  }, [fetchHost, fetchMetrics, fetchProjects])

  usePolling(() => {
    fetchHost()
    fetchMetrics()
  }, 15_000)

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await apiFetch(`/api/hosts/${id}/test`, { method: 'POST' })
      const data = await res.json()
      setTestResult(data)
    } catch {
      setTestResult({ success: false, message: 'Request failed' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: editForm.name,
        type: editForm.type,
        ip_address: editForm.ip_address,
        ssh_port: parseInt(editForm.ssh_port) || 22,
        ssh_user: editForm.ssh_user,
        has_docker: editForm.has_docker ? 1 : 0,
        has_crowdsec: editForm.has_crowdsec ? 1 : 0,
      }
      if (editForm.proxmox_vmid) body.proxmox_vmid = parseInt(editForm.proxmox_vmid)
      else body.proxmox_vmid = null
      if (editForm.ssh_key_path) body.ssh_key_path = editForm.ssh_key_path
      else body.ssh_key_path = null

      const res = await apiFetch(`/api/hosts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast('Host updated', 'success')
      setShowEdit(false)
      fetchHost()
    } catch {
      toast('Failed to save host', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      const res = await apiFetch(`/api/hosts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete host')
      toast('Host deleted', 'info')
      navigate('/hosts')
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  if (loading) return <div className="loading">Loading...</div>
  if (error && !host) return <div className="error-msg">{error}</div>
  if (!host) return <div className="error-msg">Host not found</div>

  const statusValue = host.status === 'online' ? 'online' : host.status === 'offline' ? 'offline' : 'unknown'

  return (
    <div>
      <Link to="/hosts" className="link-primary" style={{ fontSize: 14, marginBottom: 16, display: 'inline-block' }}>
        &larr; Back to Hosts
      </Link>

      <div className="detail-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {host.name}
            <StatusIndicator status={statusValue} />
          </h1>
          <div className="detail-meta">
            <span className={`badge badge-${host.type}`}>{host.type.toUpperCase()}</span>
            <span>{host.ip_address}:{host.ssh_port}</span>
            <span>User: {host.ssh_user}</span>
            {host.ssh_key_path && <span>Key: {host.ssh_key_path}</span>}
            {host.proxmox_vmid && <span>VMID: {host.proxmox_vmid}</span>}
            <span>{host.last_seen_at ? `Last seen ${timeAgo(host.last_seen_at)}` : 'Never seen'}</span>
          </div>
        </div>
        <div className="detail-actions">
          <button className="btn" onClick={() => setShowEdit(!showEdit)}>
            {showEdit ? 'Cancel' : 'Edit'}
          </button>
          <button className="btn btn-primary" onClick={handleTest} disabled={testing}>
            {testing ? 'Testing...' : 'Test SSH'}
          </button>
          <button className="btn btn-danger" onClick={() => setShowConfirm(true)}>
            Delete
          </button>
        </div>
      </div>

      {testResult && (
        <div className={testResult.success ? 'success-msg' : 'error-msg'} style={{ marginBottom: 16 }}>
          {testResult.message}
        </div>
      )}

      {showEdit && (
        <div className="settings-section" style={{ marginBottom: 24 }}>
          <h2>Edit Host</h2>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select
                value={editForm.type}
                onChange={(e) => setEditForm({ ...editForm, type: e.target.value as 'vm' | 'ct' })}
              >
                <option value="vm">VM</option>
                <option value="ct">CT</option>
              </select>
            </div>
            <div className="form-group">
              <label>Proxmox VMID (optional)</label>
              <input
                type="text"
                value={editForm.proxmox_vmid}
                onChange={(e) => setEditForm({ ...editForm, proxmox_vmid: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>IP Address</label>
              <input
                type="text"
                value={editForm.ip_address}
                onChange={(e) => setEditForm({ ...editForm, ip_address: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>SSH Port</label>
              <input
                type="text"
                value={editForm.ssh_port}
                onChange={(e) => setEditForm({ ...editForm, ssh_port: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>SSH User</label>
              <input
                type="text"
                value={editForm.ssh_user}
                onChange={(e) => setEditForm({ ...editForm, ssh_user: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>SSH Key Path</label>
              <input
                type="text"
                value={editForm.ssh_key_path}
                onChange={(e) => setEditForm({ ...editForm, ssh_key_path: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', gap: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editForm.has_docker}
                  onChange={(e) => setEditForm({ ...editForm, has_docker: e.target.checked })}
                />
                Has Docker
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editForm.has_crowdsec}
                  onChange={(e) => setEditForm({ ...editForm, has_crowdsec: e.target.checked })}
                />
                Has CrowdSec
              </label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {metrics && (
        <>
          <h2 className="section-title">Metrics</h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">CPU</div>
              <div className="metric-bar">
                <div
                  className="metric-bar-fill"
                  style={{
                    width: `${Math.min(metrics.cpu, 100)}%`,
                    background: metrics.cpu > 80 ? 'var(--error)' : 'var(--primary)',
                  }}
                />
              </div>
              <div className="metric-value">{metrics.cpu.toFixed(1)}%</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Memory</div>
              <div className="metric-bar">
                <div
                  className="metric-bar-fill"
                  style={{
                    width: `${metrics.memory.total > 0 ? (metrics.memory.used / metrics.memory.total) * 100 : 0}%`,
                    background: metrics.memory.total > 0 && (metrics.memory.used / metrics.memory.total) > 0.8 ? 'var(--error)' : 'var(--blue)',
                  }}
                />
              </div>
              <div className="metric-value">
                {formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Disk</div>
              <div className="metric-bar">
                <div
                  className="metric-bar-fill"
                  style={{
                    width: `${metrics.disk.total > 0 ? (metrics.disk.used / metrics.disk.total) * 100 : 0}%`,
                    background: metrics.disk.total > 0 && (metrics.disk.used / metrics.disk.total) > 0.8 ? 'var(--warning)' : 'var(--primary)',
                  }}
                />
              </div>
              <div className="metric-value">
                {formatBytes(metrics.disk.used)} / {formatBytes(metrics.disk.total)}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Network</div>
              <div className="metric-value" style={{ marginTop: 8 }}>
                In: {formatBytes(metrics.netin)} / Out: {formatBytes(metrics.netout)}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Uptime</div>
              <div className="metric-value" style={{ marginTop: 8 }}>
                {formatUptime(metrics.uptime)}
              </div>
            </div>
          </div>
        </>
      )}

      <h2 className="section-title" style={{ marginTop: 32 }}>Projects on this Host</h2>
      {projects.length === 0 ? (
        <div className="empty-state" style={{ padding: 32 }}>
          <p>No projects deployed on this host.</p>
        </div>
      ) : (
        <div className="deploy-list">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="deploy-item" style={{ display: 'block' }}>
              <div className="deploy-item-header" style={{ cursor: 'pointer' }}>
                <div className="deploy-item-info">
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span className="text-muted">{p.gitea_repo}</span>
                </div>
                <span className={`deploy-badge deploy-badge-${p.status || 'idle'}`}>{p.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showConfirm && (
        <div className="confirm-overlay" onClick={() => setShowConfirm(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Host</h3>
            <p>Are you sure you want to delete "{host.name}"? This action cannot be undone.</p>
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
