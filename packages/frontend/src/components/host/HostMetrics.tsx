import type { HostMetrics as HostMetricsType } from '../../types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

interface HostMetricsProps {
  metrics: HostMetricsType
}

export default function HostMetrics({ metrics }: HostMetricsProps) {
  return (
    <>
      <h2 className="section-title">Metrics</h2>
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">CPU</div>
          <div className="metric-bar">
            <div
              className="metric-bar-fill"
              style={{
                width: `${Math.min(metrics.cpu, 100)}%`,
                background: metrics.cpu > 80 ? 'var(--error)' : 'var(--primary)',
              }}
            />
          </div>
          <div className="metric-value">{metrics.cpu.toFixed(1)}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Memory</div>
          <div className="metric-bar">
            <div
              className="metric-bar-fill"
              style={{
                width: `${metrics.memory.total > 0 ? (metrics.memory.used / metrics.memory.total) * 100 : 0}%`,
                background: metrics.memory.total > 0 && (metrics.memory.used / metrics.memory.total) > 0.8 ? 'var(--error)' : 'var(--blue)',
              }}
            />
          </div>
          <div className="metric-value">
            {formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Disk</div>
          <div className="metric-bar">
            <div
              className="metric-bar-fill"
              style={{
                width: `${metrics.disk.total > 0 ? (metrics.disk.used / metrics.disk.total) * 100 : 0}%`,
                background: metrics.disk.total > 0 && (metrics.disk.used / metrics.disk.total) > 0.8 ? 'var(--warning)' : 'var(--primary)',
              }}
            />
          </div>
          <div className="metric-value">
            {formatBytes(metrics.disk.used)} / {formatBytes(metrics.disk.total)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Network</div>
          <div className="metric-value" style={{ marginTop: 8 }}>
            In: {formatBytes(metrics.netin)} / Out: {formatBytes(metrics.netout)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Uptime</div>
          <div className="metric-value" style={{ marginTop: 8 }}>
            {formatUptime(metrics.uptime)}
          </div>
        </div>
      </div>
    </>
  )
}
