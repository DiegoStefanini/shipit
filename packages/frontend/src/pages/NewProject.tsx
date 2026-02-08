import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'

export default function NewProject() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [giteaRepo, setGiteaRepo] = useState('')
  const [giteaUrl, setGiteaUrl] = useState('http://192.168.1.44:3000')
  const [branch, setBranch] = useState('main')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
        body: JSON.stringify({ name, gitea_repo: giteaRepo, gitea_url: giteaUrl, branch }),
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
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>New Project</h1>
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
          <div className="form-hint">Becomes the subdomain: {name || 'my-app'}.stefaniniserver.com</div>
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
        <button type="submit" className="btn btn-primary" disabled={submitting || !!nameError}>
          {submitting ? 'Creating...' : 'Create Project'}
        </button>
      </form>
    </div>
  )
}
