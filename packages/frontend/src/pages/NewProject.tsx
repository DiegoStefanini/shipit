import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { getConfig } from '../config'
import type { Host } from '../types'

export default function NewProject() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [giteaRepo, setGiteaRepo] = useState('')
  const [giteaUrl, setGiteaUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [hostId, setHostId] = useState('')
  const [hosts, setHosts] = useState<Host[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const { giteaUrl: defaultUrl } = getConfig()
    setGiteaUrl(defaultUrl)
    apiFetch('/api/hosts')
      .then((r) => (r.ok ? r.json() : []))
      .then(setHosts)
      .catch(() => {})
  }, [])

  const { baseDomain } = getConfig()
  const nameRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/
  const nameError = name && !nameRegex.test(name) ? 'Only lowercase letters, numbers, and hyphens allowed' : ''

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (nameError || !name || !giteaRepo) return

    setSubmitting(true)
    setError('')

    try {
      const res = await apiFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, gitea_repo: giteaRepo, gitea_url: giteaUrl, branch, host_id: hostId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create project')
      }
      const project = await res.json()
      navigate(`/projects/${project.id}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="form-container">
      <h1 className="form-title">New Project</h1>
      {error && <div className="error-msg">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Project Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            placeholder="my-app"
            required
          />
          {nameError && <div className="form-error">{nameError}</div>}
          <div className="form-hint">Becomes the subdomain: {name || 'my-app'}.{baseDomain}</div>
        </div>
        <div className="form-group">
          <label>Gitea Repository</label>
          <input
            type="text"
            value={giteaRepo}
            onChange={(e) => setGiteaRepo(e.target.value)}
            placeholder="owner/repo"
            required
          />
          <div className="form-hint">Format: owner/repo</div>
        </div>
        <div className="form-group">
          <label>Gitea URL</label>
          <input
            type="url"
            value={giteaUrl}
            onChange={(e) => setGiteaUrl(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Branch</label>
          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Target Host</label>
          <select value={hostId} onChange={(e) => setHostId(e.target.value)} required>
            <option value="">Select a host...</option>
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.ip_address})
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={submitting || !!nameError}>
          {submitting ? 'Creating...' : 'Create Project'}
        </button>
      </form>
    </div>
  )
}
