import { useEffect, useState } from 'react'
import type { Host } from '../types'

interface LogFilterState {
  host_id: string
  source: string
  level: string
  q: string
}

interface LogFilterProps {
  filters: LogFilterState
  onChange: (filters: LogFilterState) => void
  live: boolean
  onToggleLive: () => void
}

export default function LogFilter({ filters, onChange, live, onToggleLive }: LogFilterProps) {
  const [hosts, setHosts] = useState<Host[]>([])

  useEffect(() => {
    const token = localStorage.getItem('shipit_token')
    fetch('/api/hosts', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setHosts(data))
      .catch(() => {})
  }, [])

  const update = (key: keyof LogFilterState, value: string) => {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="log-filters">
      <select
        value={filters.host_id}
        onChange={(e) => update('host_id', e.target.value)}
      >
        <option value="">All Hosts</option>
        {hosts.map((h) => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>

      <select
        value={filters.source}
        onChange={(e) => update('source', e.target.value)}
      >
        <option value="">All Sources</option>
        <option value="container">Container</option>
        <option value="system">System</option>
      </select>

      <select
        value={filters.level}
        onChange={(e) => update('level', e.target.value)}
      >
        <option value="">All Levels</option>
        <option value="error">Error</option>
        <option value="warn">Warn</option>
        <option value="info">Info</option>
        <option value="debug">Debug</option>
      </select>

      <input
        type="text"
        className="search-input"
        placeholder="Search logs..."
        value={filters.q}
        onChange={(e) => update('q', e.target.value)}
      />

      <button
        className={`live-toggle ${live ? 'active' : ''}`}
        onClick={onToggleLive}
      >
        {live && <span className="live-dot" />}
        Live
      </button>
    </div>
  )
}
