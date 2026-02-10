import type { NotificationChannel } from '../../types'

interface ChannelListProps {
  channels: NotificationChannel[]
  onTest: (id: string) => void
  onToggle: (ch: NotificationChannel) => void
  onEdit: (ch: NotificationChannel) => void
  onDelete: (id: string) => void
}

export default function ChannelList({ channels, onTest, onToggle, onEdit, onDelete }: ChannelListProps) {
  if (channels.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#128276;</div>
        <h2>No channels configured</h2>
        <p className="text-muted">Add a Telegram or Discord channel to receive notifications.</p>
      </div>
    )
  }

  return (
    <div className="alerts-list">
      {channels.map(ch => (
        <div key={ch.id} className={`alerts-list-item ${!ch.enabled ? 'disabled' : ''}`}>
          <div className="alerts-list-item-info">
            <span className={`alerts-type-badge ${ch.type}`}>{ch.type}</span>
            <span className="alerts-list-item-name">{ch.name}</span>
            {!ch.enabled && <span className="alerts-disabled-badge">Disabled</span>}
          </div>
          <div className="alerts-list-item-actions">
            <button className="btn btn-sm" onClick={() => onTest(ch.id)}>Test</button>
            <button className="btn btn-sm" onClick={() => onToggle(ch)}>
              {ch.enabled ? 'Disable' : 'Enable'}
            </button>
            <button className="btn btn-sm" onClick={() => onEdit(ch)}>Edit</button>
            <button className="btn btn-sm btn-danger" onClick={() => onDelete(ch.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}
