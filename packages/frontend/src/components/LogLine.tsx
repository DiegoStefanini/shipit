import { useState } from 'react'
import type { LogEntry } from '../types'

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

interface LogLineProps {
  entry: LogEntry
  showHost?: boolean
}

export default function LogLine({ entry, showHost }: LogLineProps) {
  const [expanded, setExpanded] = useState(false)

  const sourceLabel = entry.source === 'container'
    ? entry.container_name ?? 'container'
    : entry.service_name || 'system'

  return (
    <div className="log-line" onClick={() => setExpanded(!expanded)}>
      <span className="log-time">{formatTime(entry.timestamp)}</span>
      {showHost && entry.host_name && (
        <span className="log-host">{entry.host_name}</span>
      )}
      <span className="log-source">{sourceLabel}</span>
      <span className={`log-level ${entry.level}`}>{entry.level}</span>
      <span className={`log-message ${expanded ? 'expanded' : ''}`}>
        {entry.message}
      </span>
    </div>
  )
}
