import { useCallback, useEffect, useRef, useState } from 'react'
import LogFilter from '../components/LogFilter'
import LogLine from '../components/LogLine'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import type { LogEntry, LogsResponse } from '../types'
import { usePolling } from '../hooks/usePolling'

interface Filters {
  host_id: string
  source: string
  level: string
  q: string
}

export default function Logs() {
  const [filters, setFilters] = useState<Filters>({
    host_id: '',
    source: '',
    level: '',
    q: '',
  })
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [live, setLive] = useState(false)
  const [liveLines, setLiveLines] = useState<LogEntry[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const liveIdRef = useRef(0)

  const fetchLogs = useCallback(async (newOffset = 0) => {
    const token = localStorage.getItem('shipit_token')
    const params = new URLSearchParams()
    if (filters.host_id) params.set('host_id', filters.host_id)
    if (filters.source) params.set('source', filters.source)
    if (filters.level) params.set('level', filters.level)
    if (filters.q) params.set('q', filters.q)
    params.set('limit', '100')
    params.set('offset', String(newOffset))

    setLoading(true)
    try {
      const res = await fetch(`/api/logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data: LogsResponse = await res.json()
      if (newOffset === 0) {
        setLogs(data.logs)
      } else {
        setLogs((prev) => [...prev, ...data.logs])
      }
      setTotal(data.total)
      setOffset(newOffset)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchLogs(0)
  }, [fetchLogs])

  usePolling(() => {
    if (!live) fetchLogs(0)
  }, 30_000, !live)

  // WebSocket for live mode
  useEffect(() => {
    if (!live) {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setLiveLines([])
      return
    }

    if (!filters.host_id) {
      return
    }

    const source = filters.source || 'system'
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws/logs/live/${filters.host_id}/${source}`,
    )
    wsRef.current = ws
    const id = ++liveIdRef.current

    ws.onmessage = (e) => {
      if (id !== liveIdRef.current) return
      try {
        const data = JSON.parse(e.data)
        if (data.error) return
        const entry: LogEntry = {
          id: Date.now() + Math.random(),
          host_id: data.hostId ?? filters.host_id,
          source: data.source ?? source,
          level: 'info',
          message: data.line ?? '',
          timestamp: data.ts ?? Date.now(),
          collected_at: Date.now(),
        }
        setLiveLines((prev) => [entry, ...prev].slice(0, 200))
      } catch {
        // ignore
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [live, filters.host_id, filters.source])

  const handleLoadMore = () => {
    fetchLogs(offset + 100)
  }

  const displayLogs = live ? liveLines : logs

  return (
    <div className="logs-page">
      <div className="page-header">
        <h1>Logs</h1>
      </div>

      <LogFilter
        filters={filters}
        onChange={setFilters}
        live={live}
        onToggleLive={() => setLive(!live)}
      />

      <p className="log-count">
        {live
          ? `${liveLines.length} live lines`
          : `${total} log entries`}
        {live && !filters.host_id && (
          <span style={{ marginLeft: 8, color: 'var(--warning)' }}>
            Select a host for live mode
          </span>
        )}
      </p>

      <div className="log-list">
        {loading && displayLogs.length === 0 ? (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column' as const, gap: 6 }} role="status">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <Skeleton key={i} height="24px" />
            ))}
          </div>
        ) : displayLogs.length === 0 ? (
          <EmptyState icon="logs" title="No logs found">
            Adjust filters or wait for new log entries.
          </EmptyState>
        ) : (
          <>
            {displayLogs.map((entry) => (
              <LogLine key={entry.id} entry={entry} showHost={!filters.host_id} />
            ))}
            {!live && logs.length < total && (
              <button className="load-more" onClick={handleLoadMore} disabled={loading}>
                {loading ? 'Loading...' : `Load more (${logs.length} / ${total})`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
