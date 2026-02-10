import { useState, useEffect, useCallback } from 'react'
import { Skeleton } from '../components/Skeleton'
import { usePolling } from '../hooks/usePolling'
import { apiFetch } from '../api'
import type { SecurityOverview, SecurityAlert, SecurityDecision, Host } from '../types'

type Tab = 'alerts' | 'blocked'

export default function Security() {
  const [overview, setOverview] = useState<SecurityOverview | null>(null)
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [alertsTotal, setAlertsTotal] = useState(0)
  const [alertsOffset, setAlertsOffset] = useState(0)
  const [decisions, setDecisions] = useState<SecurityDecision[]>([])
  const [hosts, setHosts] = useState<Host[]>([])
  const [tab, setTab] = useState<Tab>('alerts')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Block form state
  const [blockHostId, setBlockHostId] = useState('')
  const [blockIp, setBlockIp] = useState('')
  const [blockDuration, setBlockDuration] = useState('24h')
  const [blockReason, setBlockReason] = useState('')
  const [blocking, setBlocking] = useState(false)
  const [actionMsg, setActionMsg] = useState('')

  const fetchOverview = useCallback(() => {
    apiFetch('/api/security/overview')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(setOverview)
      .catch(e => console.error('Failed to fetch security overview:', e))
  }, [])

  const fetchAlerts = useCallback((offset = 0) => {
    apiFetch(`/api/security/alerts?limit=50&offset=${offset}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(data => {
        if (offset === 0) {
          setAlerts(data.alerts)
        } else {
          setAlerts(prev => [...prev, ...data.alerts])
        }
        setAlertsTotal(data.total)
        setAlertsOffset(offset)
      })
      .catch(e => console.error('Failed to fetch security alerts:', e))
  }, [])

  const fetchDecisions = useCallback(() => {
    apiFetch('/api/security/decisions')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(setDecisions)
      .catch(e => console.error('Failed to fetch security decisions:', e))
  }, [])

  const fetchHosts = useCallback(() => {
    apiFetch('/api/hosts')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((data: Host[]) => {
        setHosts(data.filter(h => h.has_crowdsec))
        if (data.length > 0 && !blockHostId) {
          const csHosts = data.filter(h => h.has_crowdsec)
          if (csHosts.length > 0) setBlockHostId(csHosts[0].id)
        }
      })
      .catch(e => console.error('Failed to fetch hosts:', e))
  }, [blockHostId])

  useEffect(() => {
    Promise.all([
      apiFetch('/api/security/overview').then(r => r.json()),
      apiFetch('/api/security/alerts?limit=50&offset=0').then(r => r.json()),
      apiFetch('/api/security/decisions').then(r => r.json()),
      apiFetch('/api/hosts').then(r => r.json()),
    ])
      .then(([ov, al, dec, h]) => {
        setOverview(ov)
        setAlerts(al.alerts)
        setAlertsTotal(al.total)
        setDecisions(dec)
        const csHosts = (h as Host[]).filter(host => host.has_crowdsec)
        setHosts(csHosts)
        if (csHosts.length > 0) setBlockHostId(csHosts[0].id)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  usePolling(() => {
    fetchOverview()
    fetchDecisions()
  }, 60_000)

  const handleBlock = async () => {
    if (!blockHostId || !blockIp) return
    setBlocking(true)
    setActionMsg('')
    try {
      const r = await apiFetch('/api/security/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host_id: blockHostId, ip: blockIp, duration: blockDuration, reason: blockReason }),
      })
      const data = await r.json()
      setActionMsg(data.success ? 'IP blocked' : `Error: ${data.message}`)
      if (data.success) {
        setBlockIp('')
        setBlockReason('')
        fetchDecisions()
      }
    } catch {
      setActionMsg('Request failed')
    } finally {
      setBlocking(false)
    }
  }

  const handleUnblock = async (hostId: string, ip: string) => {
    setActionMsg('')
    try {
      const r = await apiFetch('/api/security/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host_id: hostId, ip }),
      })
      const data = await r.json()
      setActionMsg(data.success ? 'IP unblocked' : `Error: ${data.message}`)
      if (data.success) fetchDecisions()
    } catch {
      setActionMsg('Request failed')
    }
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleString()
  }

  if (loading) return (
    <div className="security-page" role="status">
      <div className="page-header">
        <h1>Security</h1>
      </div>
      <div className="security-stats">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="security-stat-card">
            <Skeleton width="60%" height="28px" />
            <div style={{ marginTop: 8 }}><Skeleton width="80%" height="12px" /></div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20 }}>
        <Skeleton height="200px" />
      </div>
    </div>
  )
  if (error) return <div className="error-msg" role="alert">{error}</div>

  const topScenario = overview?.top_scenarios?.[0]?.scenario ?? '-'
  const topCountry = overview?.top_countries?.[0]?.source_country ?? '-'

  // Chart: alerts per hour
  const maxCount = overview?.alerts_per_hour
    ? Math.max(...overview.alerts_per_hour.map(a => a.count), 1)
    : 1

  return (
    <div className="security-page">
      <div className="page-header">
        <h1>Security</h1>
      </div>

      {/* Stats */}
      <div className="security-stats">
        <div className="security-stat-card alert">
          <div className="stat-value">{overview?.total_alerts_24h ?? 0}</div>
          <div className="stat-label">Alerts (24h)</div>
        </div>
        <div className="security-stat-card active">
          <div className="stat-value">{overview?.active_decisions ?? 0}</div>
          <div className="stat-label">Active Bans</div>
        </div>
        <div className="security-stat-card">
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>{topScenario}</div>
          <div className="stat-label">Top Scenario</div>
        </div>
        <div className="security-stat-card">
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>{topCountry}</div>
          <div className="stat-label">Top Country</div>
        </div>
      </div>

      {/* Alert chart */}
      {overview && overview.alerts_per_hour.length > 0 && (
        <div className="alert-chart">
          <div className="alert-chart-title">Alerts per hour (last 24h)</div>
          <div className="alert-bars">
            {overview.alerts_per_hour.map((item, i) => (
              <div
                key={i}
                className="alert-bar"
                style={{ height: `${(item.count / maxCount) * 100}%` }}
                title={`${new Date(item.hour).toLocaleTimeString()}: ${item.count} alerts`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action message */}
      {actionMsg && (
        <div className={actionMsg.startsWith('Error') ? 'error-msg' : 'success-msg'} role="alert">
          {actionMsg}
        </div>
      )}

      {/* Manual block form */}
      <div className="block-form">
        <select
          value={blockHostId}
          onChange={e => setBlockHostId(e.target.value)}
        >
          {hosts.map(h => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="IP address"
          value={blockIp}
          onChange={e => setBlockIp(e.target.value)}
        />
        <input
          type="text"
          placeholder="Duration (24h)"
          value={blockDuration}
          onChange={e => setBlockDuration(e.target.value)}
          style={{ maxWidth: 120 }}
        />
        <input
          type="text"
          placeholder="Reason"
          value={blockReason}
          onChange={e => setBlockReason(e.target.value)}
        />
        <button
          className="btn btn-danger"
          onClick={handleBlock}
          disabled={blocking || !blockIp}
        >
          {blocking ? 'Blocking...' : 'Block IP'}
        </button>
      </div>

      {/* Tabs */}
      <div className="security-tabs">
        <button className={tab === 'alerts' ? 'active' : ''} onClick={() => setTab('alerts')}>
          Alerts ({overview?.total_alerts_24h ?? 0})
        </button>
        <button className={tab === 'blocked' ? 'active' : ''} onClick={() => setTab('blocked')}>
          Blocked IPs ({decisions.length})
        </button>
      </div>

      {/* Alerts table */}
      {tab === 'alerts' && (
        <>
          <table className="security-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Host</th>
                <th>Scenario</th>
                <th>Source IP</th>
                <th>Country</th>
                <th>Events</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No alerts</td></tr>
              ) : (
                alerts.map(a => (
                  <tr key={a.id}>
                    <td>{formatTime(a.collected_at)}</td>
                    <td>{a.host_name || a.host_id}</td>
                    <td><span className="scenario-badge">{a.scenario}</span></td>
                    <td><span className="ip-badge">{a.source_ip}</span></td>
                    <td><span className="country-badge">{a.source_country || '-'}</span></td>
                    <td>{a.events_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {alerts.length < alertsTotal && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                className="btn"
                onClick={() => fetchAlerts(alertsOffset + 50)}
              >
                Load more ({alertsTotal - alerts.length} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {/* Blocked IPs table */}
      {tab === 'blocked' && (
        <table className="security-table">
          <thead>
            <tr>
              <th>IP</th>
              <th>Host</th>
              <th>Type</th>
              <th>Scenario</th>
              <th>Duration</th>
              <th>Origin</th>
              <th>Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {decisions.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No active bans</td></tr>
            ) : (
              decisions.map(d => (
                <tr key={d.id}>
                  <td><span className="ip-badge">{d.source_ip}</span></td>
                  <td>{d.host_name || d.host_id}</td>
                  <td>{d.type}</td>
                  <td><span className="scenario-badge">{d.scenario || '-'}</span></td>
                  <td>{d.duration || '-'}</td>
                  <td>{d.origin}</td>
                  <td>{d.expires_at ? formatTime(d.expires_at) : '-'}</td>
                  <td>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      onClick={() => handleUnblock(d.host_id, d.source_ip)}
                      aria-label={`Unblock IP ${d.source_ip}`}
                    >
                      Unblock
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
