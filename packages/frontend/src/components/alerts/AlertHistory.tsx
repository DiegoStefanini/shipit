import type { AlertHistoryEntry } from '../../types'

interface AlertHistoryProps {
  history: AlertHistoryEntry[]
  historyTotal: number
  onLoadMore: () => void
  formatTime: (ts: number) => string
}

export default function AlertHistory({ history, historyTotal, onLoadMore, formatTime }: AlertHistoryProps) {
  return (
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
          <button className="btn" onClick={onLoadMore}>
            Load more ({historyTotal - history.length} remaining)
          </button>
        </div>
      )}
    </>
  )
}
