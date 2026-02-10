import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../api'
import { useToast } from '../components/Toast'

export default function Settings() {
  const { toast } = useToast()
  const [url, setUrl] = useState('')
  const [tokenId, setTokenId] = useState('')
  const [tokenSecret, setTokenSecret] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    apiFetch('/api/settings/proxmox')
      .then((r) => {
        if (!r.ok) return {}
        return r.json()
      })
      .then((data: any) => {
        if (data.url) setUrl(data.url)
        if (data.tokenId) setTokenId(data.tokenId)
        if (data.tokenSecret) setTokenSecret(data.tokenSecret)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await apiFetch('/api/settings/proxmox', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, tokenId, tokenSecret }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast('Proxmox settings saved', 'success')
    } catch {
      toast('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await apiFetch('/api/settings/proxmox/test', { method: 'POST' })
      const data = await res.json()
      setTestResult(data)
    } catch {
      setTestResult({ success: false, message: 'Request failed' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <form onSubmit={handleSave}>
        <section className="settings-section">
          <h2>Proxmox API</h2>
          <div className="form-group">
            <label>URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://192.168.1.150:8006"
            />
            <div className="form-hint">Proxmox VE API endpoint (e.g., https://192.168.1.150:8006)</div>
          </div>
          <div className="form-group">
            <label>Token ID</label>
            <input
              type="text"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              placeholder="shipit@pam!shipit-token"
            />
            <div className="form-hint">Format: user@realm!token-name</div>
          </div>
          <div className="form-group">
            <label>Token Secret</label>
            <input
              type="text"
              className="password-input"
              value={tokenSecret}
              onChange={(e) => setTokenSecret(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="btn" onClick={handleTest} disabled={testing}>
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {testResult && (
            <div
              className={testResult.success ? 'success-msg' : 'error-msg'}
              style={{ marginTop: 16 }}
            >
              {testResult.message}
            </div>
          )}
        </section>
      </form>
    </div>
  )
}
