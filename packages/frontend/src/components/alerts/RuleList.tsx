import type { AlertRule } from '../../types'

interface RuleListProps {
  rules: AlertRule[]
  onToggle: (rule: AlertRule) => void
  onEdit: (rule: AlertRule) => void
  onDelete: (id: string) => void
  formatTime: (ts: number) => string
}

export default function RuleList({ rules, onToggle, onEdit, onDelete, formatTime }: RuleListProps) {
  if (rules.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#9888;</div>
        <h2>No alert rules</h2>
        <p className="text-muted">Create rules to get notified about issues.</p>
      </div>
    )
  }

  return (
    <div className="alerts-list">
      {rules.map(rule => (
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
            <button className="btn btn-sm" onClick={() => onToggle(rule)}>
              {rule.enabled ? 'Disable' : 'Enable'}
            </button>
            <button className="btn btn-sm" onClick={() => onEdit(rule)}>Edit</button>
            <button className="btn btn-sm btn-danger" onClick={() => onDelete(rule.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}
