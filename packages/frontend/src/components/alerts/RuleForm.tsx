import type { AlertRule, NotificationChannel } from '../../types'

interface RuleFormProps {
  ruleName: string
  ruleType: AlertRule['type']
  ruleCondition: string
  ruleChannelIds: string[]
  ruleCooldown: number
  ruleSaving: boolean
  editingRuleId: string | null
  channels: NotificationChannel[]
  onRuleNameChange: (v: string) => void
  onRuleTypeChange: (v: AlertRule['type']) => void
  onRuleConditionChange: (v: string) => void
  onToggleChannel: (id: string) => void
  onRuleCooldownChange: (v: number) => void
  onSave: () => void
  onCancel: () => void
}

export default function RuleForm({
  ruleName,
  ruleType,
  ruleCondition,
  ruleChannelIds,
  ruleCooldown,
  ruleSaving,
  editingRuleId,
  channels,
  onRuleNameChange,
  onRuleTypeChange,
  onRuleConditionChange,
  onToggleChannel,
  onRuleCooldownChange,
  onSave,
  onCancel,
}: RuleFormProps) {
  return (
    <div className="alerts-form-card">
      <h3>{editingRuleId ? 'Edit Rule' : 'New Rule'}</h3>
      <div className="alerts-form-row">
        <input
          type="text"
          placeholder="Rule name"
          value={ruleName}
          onChange={e => onRuleNameChange(e.target.value)}
        />
        <select value={ruleType} onChange={e => onRuleTypeChange(e.target.value as AlertRule['type'])}>
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
          onChange={e => onRuleConditionChange(e.target.value)}
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
          onChange={e => onRuleCooldownChange(parseInt(e.target.value) || 300)}
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
                onChange={() => onToggleChannel(ch.id)}
              />
              <span>{ch.name} ({ch.type})</span>
            </label>
          ))}
          {channels.length === 0 && <span className="text-muted">No channels available. Create one first.</span>}
        </div>
      </div>
      <div className="alerts-form-actions">
        <button className="btn btn-primary" onClick={onSave} disabled={ruleSaving || !ruleName || ruleChannelIds.length === 0}>
          {ruleSaving ? 'Saving...' : editingRuleId ? 'Update' : 'Create'}
        </button>
        {editingRuleId && (
          <button className="btn" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </div>
  )
}
