import type { NotificationChannel } from '../../types'

interface ChannelFormProps {
  chName: string
  chType: 'telegram' | 'discord'
  chBotToken: string
  chChatId: string
  chWebhookUrl: string
  chSaving: boolean
  editingChannelId: string | null
  onChNameChange: (v: string) => void
  onChTypeChange: (v: 'telegram' | 'discord') => void
  onChBotTokenChange: (v: string) => void
  onChChatIdChange: (v: string) => void
  onChWebhookUrlChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}

export default function ChannelForm({
  chName,
  chType,
  chBotToken,
  chChatId,
  chWebhookUrl,
  chSaving,
  editingChannelId,
  onChNameChange,
  onChTypeChange,
  onChBotTokenChange,
  onChChatIdChange,
  onChWebhookUrlChange,
  onSave,
  onCancel,
}: ChannelFormProps) {
  return (
    <div className="alerts-form-card">
      <h3>{editingChannelId ? 'Edit Channel' : 'New Channel'}</h3>
      <div className="alerts-form-row">
        <input
          type="text"
          placeholder="Channel name"
          value={chName}
          onChange={e => onChNameChange(e.target.value)}
        />
        <select value={chType} onChange={e => onChTypeChange(e.target.value as 'telegram' | 'discord')}>
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
            onChange={e => onChBotTokenChange(e.target.value)}
          />
          <input
            type="text"
            placeholder="Chat ID"
            value={chChatId}
            onChange={e => onChChatIdChange(e.target.value)}
          />
        </div>
      ) : (
        <div className="alerts-form-row">
          <input
            type="text"
            placeholder="Webhook URL"
            value={chWebhookUrl}
            onChange={e => onChWebhookUrlChange(e.target.value)}
          />
        </div>
      )}
      <div className="alerts-form-actions">
        <button className="btn btn-primary" onClick={onSave} disabled={chSaving || !chName}>
          {chSaving ? 'Saving...' : editingChannelId ? 'Update' : 'Create'}
        </button>
        {editingChannelId && (
          <button className="btn" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </div>
  )
}
