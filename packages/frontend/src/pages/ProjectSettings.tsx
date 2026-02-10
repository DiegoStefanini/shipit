import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useToast } from '../components/Toast'
import type { Project, Host } from '../types'

export default function ProjectSettings() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [project, setProject] = useState<Project | null>(null)
  const [branch, setBranch] = useState('')
  const [hostId, setHostId] = useState('')
  const [hosts, setHosts] = useState<Host[]>([])
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/projects/${id}`).then((r) => {
        if (!r.ok) throw new Error('Project not found')
        return r.json()
      }),
      apiFetch('/api/hosts').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([p, h]: [Project, Host[]]) => {
        setProject(p)
        setBranch(p.branch)
        setHostId(p.host_id ?? '')
        setHosts(h)
        try {
          const vars = JSON.parse(p.env_vars ?? '{}')
          setEnvVars(Object.entries(vars).map(([key, value]) => ({ key, value: value as string })))
        } catch {
          setEnvVars([])
        }
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const envObj: Record<string, string> = {}
      envVars.forEach(({ key, value }) => {
        if (key.trim()) envObj[key.trim()] = value
      })
      const res = await apiFetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch, env_vars: envObj, host_id: hostId || null }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast('Settings saved', 'success')
    } catch {
      toast('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const addEnvVar = () => setEnvVars([...envVars, { key: '', value: '' }])

  const removeEnvVar = (index: number) =>
    setEnvVars(envVars.filter((_, i) => i !== index))

  const updateEnvVar = (index: number, field: 'key' | 'value', val: string) =>
    setEnvVars(envVars.map((v, i) => (i === index ? { ...v, [field]: val } : v)))

  if (loading) return <div className="loading">Loading...</div>
  if (!project) return <div className="error-msg">Project not found</div>

  return (
    <div className="settings-page">
      <h1>Settings — {project.name}</h1>

      <form onSubmit={handleSave}>
        <section className="settings-section">
          <h2>General</h2>
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
            <select value={hostId} onChange={(e) => setHostId(e.target.value)}>
              <option value="">No host selected</option>
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.ip_address})
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="settings-section">
          <h2>Environment Variables</h2>
          {envVars.map((v, i) => (
            <div key={i} className="env-row">
              <input
                type="text"
                placeholder="KEY"
                value={v.key}
                onChange={(e) => updateEnvVar(i, 'key', e.target.value)}
              />
              <input
                type="text"
                placeholder="value"
                value={v.value}
                onChange={(e) => updateEnvVar(i, 'value', e.target.value)}
              />
              <button type="button" className="btn btn-danger" onClick={() => removeEnvVar(i)}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="btn" onClick={addEnvVar}>
            + Add Variable
          </button>
        </section>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      <section className="settings-section danger-zone">
        <h2>Danger Zone</h2>
        <p>Deleting a project stops the running container and removes all deploy history.</p>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => navigate(`/projects/${id}`)}
        >
          Back to Project (delete from there)
        </button>
      </section>
    </div>
  )
}
