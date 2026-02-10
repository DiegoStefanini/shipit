import { useEffect, useState, useCallback, type FormEvent } from 'react'
import HostCard from '../components/HostCard'
import { usePolling } from '../hooks/usePolling'
import { apiFetch } from '../api'
import { useToast } from '../components/Toast'
import type { Host } from '../types'

const defaultForm = {
  name: '',
  type: 'vm' as 'vm' | 'ct',
  proxmox_vmid: '',
  ip_address: '',
  ssh_port: '22',
  ssh_user: 'root',
  ssh_key_path: '',
  has_docker: false,
  has_crowdsec: false,
}

export default function Hosts() {
  const { toast } = useToast()
  const [hosts, setHosts] = useState<Host[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [submitting, setSubmitting] = useState(false)

  const fetchHosts = useCallback(() => {
    apiFetch('/api/hosts')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch hosts')
        return r.json()
      })
      .then(setHosts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchHosts()
  }, [fetchHosts])

  usePolling(fetchHosts, 30_000)

  const filtered = hosts.filter(
    (h) =>
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.ip_address.includes(search)
  )

  const stats = {
    total: hosts.length,
    online: hosts.filter((h) => h.status === 'online').length,
    offline: hosts.filter((h) => h.status === 'offline').length,
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.ip_address) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        type: form.type,
        ip_address: form.ip_address,
        ssh_port: parseInt(form.ssh_port) || 22,
        ssh_user: form.ssh_user || 'root',
        has_docker: form.has_docker ? 1 : 0,
        has_crowdsec: form.has_crowdsec ? 1 : 0,
      }
      if (form.proxmox_vmid) body.proxmox_vmid = parseInt(form.proxmox_vmid)
      if (form.ssh_key_path) body.ssh_key_path = form.ssh_key_path
      const res = await apiFetch('/api/hosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create host')
      }
      toast('Host created', 'success')
      setForm(defaultForm)
      setShowForm(false)
      fetchHosts()
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Hosts</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            type="text"
            className="search-input"
            placeholder="Search hosts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Host'}
          </button>
        </div>
      </div>

      {!loading && hosts.length > 0 && (
        <div className="stats-bar">
          <div className="stat">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat">
            <span className="stat-value stat-running">{stats.online}</span>
            <span className="stat-label">Online</span>
          </div>
          <div className="stat">
            <span className="stat-value stat-failed">{stats.offline}</span>
            <span className="stat-label">Offline</span>
          </div>
        </div>
      )}

      {showForm && (
        <div className="settings-section" style={{ marginBottom: 24 }}>
          <h2>Add Host</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="docker-host"
                required
              />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as 'vm' | 'ct' })}
              >
                <option value="vm">VM</option>
                <option value="ct">CT</option>
              </select>
            </div>
            <div className="form-group">
              <label>Proxmox VMID (optional)</label>
              <input
                type="text"
                value={form.proxmox_vmid}
                onChange={(e) => setForm({ ...form, proxmox_vmid: e.target.value })}
                placeholder="101"
              />
            </div>
            <div className="form-group">
              <label>IP Address</label>
              <input
                type="text"
                value={form.ip_address}
                onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                placeholder="192.168.1.44"
                required
              />
            </div>
            <div className="form-group">
              <label>SSH Port</label>
              <input
                type="text"
                value={form.ssh_port}
                onChange={(e) => setForm({ ...form, ssh_port: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>SSH User</label>
              <input
                type="text"
                value={form.ssh_user}
                onChange={(e) => setForm({ ...form, ssh_user: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>SSH Key Path</label>
              <input
                type="text"
                value={form.ssh_key_path}
                onChange={(e) => setForm({ ...form, ssh_key_path: e.target.value })}
                placeholder="/home/shipit/.ssh/id_ed25519"
              />
            </div>
            <div className="checkbox-group">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={form.has_docker}
                  onChange={(e) => setForm({ ...form, has_docker: e.target.checked })}
                />
                Has Docker
              </label>
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={form.has_crowdsec}
                  onChange={(e) => setForm({ ...form, has_crowdsec: e.target.checked })}
                />
                Has CrowdSec
              </label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Host'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : error ? (
        <div className="error-msg">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#9881;</div>
          <h2>No hosts found</h2>
          <p>
            {hosts.length === 0
              ? 'Get started by adding your first host.'
              : 'No hosts match your search.'}
          </p>
        </div>
      ) : (
        <div className="project-grid">
          {filtered.map((h) => (
            <HostCard key={h.id} host={h} />
          ))}
        </div>
      )}
    </div>
  )
}
