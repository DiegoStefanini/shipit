import { useState, useEffect, useCallback } from 'react'
import { usePolling } from '../hooks/usePolling'
import { apiFetch } from '../api'
import type { NotificationChannel, AlertRule, AlertHistoryEntry } from '../types'

type Tab = 'channels' | 'rules' | 'history'

export default function Alerts() {
  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [rules, setRules] = useState<AlertRule[]>([])
  const [history, setHistory] = useState<AlertHistoryEntry[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyOffset, setHistoryOffset] = useState(0)
  const [tab, setTab] = useState<Tab>('channels')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')

  // Channel form
  const [chName, setChName] = useState('')
  const [chType, setChType] = useState<'telegram' | 'discord'>('telegram')
  const [chBotToken, setChBotToken] = useState('')
  const [chChatId, setChChatId] = useState('')
  const [chWebhookUrl, setChWebhookUrl] = useState('')
  const [chSaving, setChSaving] = useState(false)
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null)

  // Rule form
  const [ruleName, setRuleName] = useState('')
  const [ruleType, setRuleType] = useState<'metric_threshold' | 'service_down' | 'security' | 'deploy'>('metric_threshold')
  const [ruleCondition, setRuleCondition] = useState('{}')
  const [ruleChannelIds, setRuleChannelIds] = useState<string[]>([])
  const [ruleCooldown, setRuleCooldown] = useState(300)
  const [ruleSaving, setRuleSaving] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)

  const fetchChannels = useCallback(() => {
    apiFetch('/api/alerts/channels')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(setChannels)
      .catch(() => {})
  }, [])

  const fetchRules = useCallback(() => {
    apiFetch('/api/alerts/rules')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(setRules)
      .catch(() => {})
  }, [])

  const fetchHistory = useCallback((offset = 0) => {
    apiFetch(`/api/alerts/history?limit=50&offset=${offset}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(data => {
        if (offset === 0) {
          setHistory(data.history)
        } else {
          setHistory(prev => [...prev, ...data.history])
        }
        setHistoryTotal(data.total)
        setHistoryOffset(offset)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    Promise.all([
      apiFetch('/api/alerts/channels').then(r => r.json()),
      apiFetch('/api/alerts/rules').then(r => r.json()),
      apiFetch('/api/alerts/history?limit=50&offset=0').then(r => r.json()),
    ])
      .then(([ch, ru, hi]) => {
        setChannels(ch)
        setRules(ru)
        setHistory(hi.history)
        setHistoryTotal(hi.total)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  usePolling(() => {
    fetchChannels()
    fetchRules()
    if (tab === 'history') fetchHistory(0)
  }, 30_000)

  // --- Channel CRUD ---

  const resetChannelForm = () => {
    setChName('')
    setChType('telegram')
    setChBotToken('')
    setChChatId('')
    setChWebhookUrl('')
    setEditingChannelId(null)
  }

  const handleSaveChannel = async () => {
    if (!chName) return
    setChSaving(true)
    setActionMsg('')

    const config = chType === 'telegram'
      ? { bot_token: chBotToken, chat_id: chChatId }
      : { webhook_url: chWebhookUrl }

    try {
      if (editingChannelId) {
        const r = await apiFetch(`/api/alerts/channels/${editingChannelId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: chName, type: chType, config }),
        })
        if (!r.ok) throw new Error('Update failed')
        setActionMsg('Channel updated')
      } else {
        const r = await apiFetch('/api/alerts/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: chName, type: chType, config }),
        })
        if (!r.ok) throw new Error('Create failed')
        setActionMsg('Channel created')
      }
      resetChannelForm()
      fetchChannels()
    } catch {
      setActionMsg('Error saving channel')
    } finally {
      setChSaving(false)
    }
  }

  const handleEditChannel = (ch: NotificationChannel) => {
    setEditingChannelId(ch.id)
    setChName(ch.name)
    setChType(ch.type)
    try {
      const cfg = JSON.parse(ch.config)
      if (ch.type === 'telegram') {
        setChBotToken(cfg.bot_token ?? '')
        setChChatId(cfg.chat_id ?? '')
      } else {
        setChWebhookUrl(cfg.webhook_url ?? '')
      }
    } catch {
      // ignore parse error
    }
  }

  const handleDeleteChannel = async (id: string) => {
    setActionMsg('')
    const r = await apiFetch(`/api/alerts/channels/${id}`, { method: 'DELETE' })
    if (r.ok) {
      setActionMsg('Channel deleted')
      fetchChannels()
    } else {
      setActionMsg('Error deleting channel')
    }
  }

  const handleTestChannel = async (id: string) => {
    setActionMsg('')
    const r = await apiFetch(`/api/alerts/channels/${id}/test`, { method: 'POST' })
    const data = await r.json()
    setActionMsg(data.success ? 'Test notification sent!' : 'Test failed')
  }

  const handleToggleChannel = async (ch: NotificationChannel) => {
    await apiFetch(`/api/alerts/channels/${ch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !ch.enabled }),
    })
    fetchChannels()
  }

  // --- Rule CRUD ---

  const resetRuleForm = () => {
    setRuleName('')
    setRuleType('metric_threshold')
    setRuleCondition('{}')
    setRuleChannelIds([])
    setRuleCooldown(300)
    setEditingRuleId(null)
  }

  const handleSaveRule = async () => {
    if (!ruleName || ruleChannelIds.length === 0) return
    setRuleSaving(true)
    setActionMsg('')

    let parsedCondition: unknown
    try {
      parsedCondition = JSON.parse(ruleCondition)
    } catch {
      setActionMsg('Invalid JSON in condition')
      setRuleSaving(false)
      return
    }

    try {
      if (editingRuleId) {
        const r = await apiFetch(`/api/alerts/rules/${editingRuleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: ruleName, type: ruleType, condition: parsedCondition, channel_ids: ruleChannelIds, cooldown: ruleCooldown }),
        })
        if (!r.ok) throw new Error('Update failed')
        setActionMsg('Rule updated')
      } else {
        const r = await apiFetch('/api/alerts/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: ruleName, type: ruleType, condition: parsedCondition, channel_ids: ruleChannelIds, cooldown: ruleCooldown }),
        })
        if (!r.ok) throw new Error('Create failed')
        setActionMsg('Rule created')
      }
      resetRuleForm()
      fetchRules()
    } catch {
      setActionMsg('Error saving rule')
    } finally {
      setRuleSaving(false)
    }
  }

  const handleEditRule = (rule: AlertRule) => {
    setEditingRuleId(rule.id)
    setRuleName(rule.name)
    setRuleType(rule.type)
    setRuleCondition(rule.condition)
    try {
      setRuleChannelIds(JSON.parse(rule.channel_ids))
    } catch {
      setRuleChannelIds([])
    }
    setRuleCooldown(rule.cooldown)
  }

  const handleDeleteRule = async (id: string) => {
    setActionMsg('')
    const r = await apiFetch(`/api/alerts/rules/${id}`, { method: 'DELETE' })
    if (r.ok) {
      setActionMsg('Rule deleted')
      fetchRules()
    } else {
      setActionMsg('Error deleting rule')
    }
  }

  const handleToggleRule = async (rule: AlertRule) => {
    await apiFetch(`/api/alerts/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled }),
    })
    fetchRules()
  }

  const toggleChannelSelection = (id: string) => {
    setRuleChannelIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const formatTime = (ts: number) => new Date(ts).toLocaleString()

  if (loading) return <div className="loading">Loading alerts...</div>
  if (error) return <div className="error-msg">{error}</div>

  return (
    <div className="alerts-page">
      <div className="page-header">
        <h1>Alerts</h1>
      </div>

      {/* Stats */}
      <div className="alerts-stats">
        <div className="alerts-stat-card">
          <div className="stat-value">{channels.filter(c => c.enabled).length}</div>
          <div className="stat-label">Active Channels</div>
        </div>
        <div className="alerts-stat-card">
          <div className="stat-value">{rules.filter(r => r.enabled).length}</div>
          <div className="stat-label">Active Rules</div>
        </div>
        <div className="alerts-stat-card">
          <div className="stat-value">{historyTotal}</div>
          <div className="stat-label">Total Alerts</div>
        </div>
      </div>

      {actionMsg && (
        <div className={actionMsg.startsWith('Error') ? 'error-msg' : 'success-msg'}>
          {actionMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="alerts-tabs">
        <button className={tab === 'channels' ? 'active' : ''} onClick={() => setTab('channels')}>
          Channels ({channels.length})
        </button>
        <button className={tab === 'rules' ? 'active' : ''} onClick={() => setTab('rules')}>
          Rules ({rules.length})
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => { setTab('history'); fetchHistory(0); }}>
          History ({historyTotal})
        </button>
      </div>

      {/* Channels tab */}
      {tab === 'channels' && (
        <>
          <div className="alerts-form-card">
            <h3>{editingChannelId ? 'Edit Channel' : 'New Channel'}</h3>
            <div className="alerts-form-row">
              <input
                type="text"
                placeholder="Channel name"
                value={chName}
                onChange={e => setChName(e.target.value)}
              />
              <select value={chType} onChange={e => setChType(e.target.value as 'telegram' | 'discord')}>
                <option value="telegram">Telegram</option>
                <option value="discord">Discord</option>
              </select>
            </div>
            {chType === 'telegram' ? (
              <div className="alerts-form-row">
                <input
                  type="text"
                  placeholder="Bot Token"
                  value={chBotToken}
                  onChange={e => setChBotToken(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Chat ID"
                  value={chChatId}
                  onChange={e => setChChatId(e.target.value)}
                />
              </div>
            ) : (
              <div className="alerts-form-row">
                <input
                  type="text"
                  placeholder="Webhook URL"
                  value={chWebhookUrl}
                  onChange={e => setChWebhookUrl(e.target.value)}
                />
              </div>
            )}
            <div className="alerts-form-actions">
              <button className="btn btn-primary" onClick={handleSaveChannel} disabled={chSaving || !chName}>
                {chSaving ? 'Saving...' : editingChannelId ? 'Update' : 'Create'}
              </button>
              {editingChannelId && (
                <button className="btn" onClick={resetChannelForm}>Cancel</button>
              )}
            </div>
          </div>

          <div className="alerts-list">
            {channels.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">&#128276;</div>
                <h2>No channels configured</h2>
                <p className="text-muted">Add a Telegram or Discord channel to receive notifications.</p>
              </div>
            ) : (
              channels.map(ch => (
                <div key={ch.id} className={`alerts-list-item ${!ch.enabled ? 'disabled' : ''}`}>
                  <div className="alerts-list-item-info">
                    <span className={`alerts-type-badge ${ch.type}`}>{ch.type}</span>
                    <span className="alerts-list-item-name">{ch.name}</span>
                    {!ch.enabled && <span className="alerts-disabled-badge">Disabled</span>}
                  </div>
                  <div className="alerts-list-item-actions">
                    <button className="btn btn-sm" onClick={() => handleTestChannel(ch.id)}>Test</button>
                    <button className="btn btn-sm" onClick={() => handleToggleChannel(ch)}>
                      {ch.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button className="btn btn-sm" onClick={() => handleEditChannel(ch)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteChannel(ch.id)}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Rules tab */}
      {tab === 'rules' && (
        <>
          <div className="alerts-form-card">
            <h3>{editingRuleId ? 'Edit Rule' : 'New Rule'}</h3>
            <div className="alerts-form-row">
              <input
                type="text"
                placeholder="Rule name"
                value={ruleName}
                onChange={e => setRuleName(e.target.value)}
              />
              <select value={ruleType} onChange={e => setRuleType(e.target.value as AlertRule['type'])}>
                <option value="metric_threshold">Metric Threshold</option>
                <option value="service_down">Service Down</option>
                <option value="security">Security</option>
                <option value="deploy">Deploy Failed</option>
              </select>
            </div>
            <div className="form-group">
              <label>Condition (JSON)</label>
              <input
                type="text"
                value={ruleCondition}
                onChange={e => setRuleCondition(e.target.value)}
                placeholder='{"metric_name":"cpu","operator":">","value":90}'
              />
              <div className="form-hint">
                {ruleType === 'metric_threshold' && 'Example: {"metric_name":"cpu","operator":">","value":90}'}
                {ruleType === 'service_down' && 'Example: {"host_id":"optional-host-id"}'}
                {ruleType === 'security' && 'Example: {"min_count":10,"window_minutes":60}'}
                {ruleType === 'deploy' && 'Example: {"project_id":"optional-project-id"}'}
              </div>
            </div>
            <div className="form-group">
              <label>Cooldown (seconds)</label>
              <input
                type="number"
                value={ruleCooldown}
                onChange={e => setRuleCooldown(parseInt(e.target.value) || 300)}
              />
            </div>
            <div className="form-group">
              <label>Notify Channels</label>
              <div className="alerts-channel-select">
                {channels.map(ch => (
                  <label key={ch.id} className="alerts-channel-option">
                    <input
                      type="checkbox"
                      checked={ruleChannelIds.includes(ch.id)}
                      onChange={() => toggleChannelSelection(ch.id)}
                    />
                    <span>{ch.name} ({ch.type})</span>
                  </label>
                ))}
                {channels.length === 0 && <span className="text-muted">No channels available. Create one first.</span>}
              </div>
            </div>
            <div className="alerts-form-actions">
              <button className="btn btn-primary" onClick={handleSaveRule} disabled={ruleSaving || !ruleName || ruleChannelIds.length === 0}>
                {ruleSaving ? 'Saving...' : editingRuleId ? 'Update' : 'Create'}
              </button>
              {editingRuleId && (
                <button className="btn" onClick={resetRuleForm}>Cancel</button>
              )}
            </div>
          </div>

          <div className="alerts-list">
            {rules.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">&#9888;</div>
                <h2>No alert rules</h2>
                <p className="text-muted">Create rules to get notified about issues.</p>
              </div>
            ) : (
              rules.map(rule => (
                <div key={rule.id} className={`alerts-list-item ${!rule.enabled ? 'disabled' : ''}`}>
                  <div className="alerts-list-item-info">
                    <span className={`alerts-type-badge rule-${rule.type}`}>{rule.type.replace('_', ' ')}</span>
                    <span className="alerts-list-item-name">{rule.name}</span>
                    {!rule.enabled && <span className="alerts-disabled-badge">Disabled</span>}
                    {rule.last_triggered_at && (
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                        Last: {formatTime(rule.last_triggered_at)}
                      </span>
                    )}
                  </div>
                  <div className="alerts-list-item-actions">
                    <button className="btn btn-sm" onClick={() => handleToggleRule(rule)}>
                      {rule.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button className="btn btn-sm" onClick={() => handleEditRule(rule)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteRule(rule.id)}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <>
          <table className="alerts-history-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Rule</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No alert history</td></tr>
              ) : (
                history.map(h => (
                  <tr key={h.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatTime(h.triggered_at)}</td>
                    <td>{h.rule_name ?? '-'}</td>
                    <td>{h.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {history.length < historyTotal && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="btn" onClick={() => fetchHistory(historyOffset + 50)}>
                Load more ({historyTotal - history.length} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
