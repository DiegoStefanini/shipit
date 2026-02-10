import { useState, useEffect, useCallback } from 'react'
import { usePolling } from '../hooks/usePolling'
import { apiFetch } from '../api'
import ChannelForm from '../components/alerts/ChannelForm'
import ChannelList from '../components/alerts/ChannelList'
import RuleForm from '../components/alerts/RuleForm'
import RuleList from '../components/alerts/RuleList'
import AlertHistory from '../components/alerts/AlertHistory'
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
      .catch(e => console.error('Failed to fetch channels:', e))
  }, [])

  const fetchRules = useCallback(() => {
    apiFetch('/api/alerts/rules')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(setRules)
      .catch(e => console.error('Failed to fetch rules:', e))
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
      .catch(e => console.error('Failed to fetch alert history:', e))
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
          <ChannelForm
            chName={chName}
            chType={chType}
            chBotToken={chBotToken}
            chChatId={chChatId}
            chWebhookUrl={chWebhookUrl}
            chSaving={chSaving}
            editingChannelId={editingChannelId}
            onChNameChange={setChName}
            onChTypeChange={setChType}
            onChBotTokenChange={setChBotToken}
            onChChatIdChange={setChChatId}
            onChWebhookUrlChange={setChWebhookUrl}
            onSave={handleSaveChannel}
            onCancel={resetChannelForm}
          />
          <ChannelList
            channels={channels}
            onTest={handleTestChannel}
            onToggle={handleToggleChannel}
            onEdit={handleEditChannel}
            onDelete={handleDeleteChannel}
          />
        </>
      )}

      {/* Rules tab */}
      {tab === 'rules' && (
        <>
          <RuleForm
            ruleName={ruleName}
            ruleType={ruleType}
            ruleCondition={ruleCondition}
            ruleChannelIds={ruleChannelIds}
            ruleCooldown={ruleCooldown}
            ruleSaving={ruleSaving}
            editingRuleId={editingRuleId}
            channels={channels}
            onRuleNameChange={setRuleName}
            onRuleTypeChange={setRuleType}
            onRuleConditionChange={setRuleCondition}
            onToggleChannel={toggleChannelSelection}
            onRuleCooldownChange={setRuleCooldown}
            onSave={handleSaveRule}
            onCancel={resetRuleForm}
          />
          <RuleList
            rules={rules}
            onToggle={handleToggleRule}
            onEdit={handleEditRule}
            onDelete={handleDeleteRule}
            formatTime={formatTime}
          />
        </>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <AlertHistory
          history={history}
          historyTotal={historyTotal}
          onLoadMore={() => fetchHistory(historyOffset + 50)}
          formatTime={formatTime}
        />
      )}
    </div>
  )
}
