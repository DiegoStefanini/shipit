import StatusIndicator from './StatusIndicator'
import MetricGauge from './MetricGauge'
import type { MonitoringOverview } from '../types'

interface HostOverviewCardProps {
  data: MonitoringOverview
  onClick: () => void
  selected: boolean
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / 1024).toFixed(1) + ' KB'
}

export default function HostOverviewCard({ data, onClick, selected }: HostOverviewCardProps) {
  const m = data.metrics
  const statusValue = data.status === 'online' ? 'online' : data.status === 'offline' ? 'offline' : 'unknown'

  const cpuPct = m.cpu ?? 0
  const memPct = m.memory_total ? (m.memory_used / m.memory_total) * 100 : 0
  const diskPct = m.disk_total ? (m.disk_used / m.disk_total) * 100 : 0

  const hasMetrics = Object.keys(m).length > 0

  return (
    <div
      className="host-overview-card"
      onClick={onClick}
      style={selected ? { borderColor: 'var(--primary)' } : undefined}
    >
      <div className="host-header">
        <StatusIndicator status={statusValue} />
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{data.host_name}</span>
        <span className={`badge badge-${data.host_type}`} style={{ marginLeft: 'auto' }}>
          {data.host_type.toUpperCase()}
        </span>
      </div>

      {hasMetrics ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <MetricGauge label="CPU" value={cpuPct} />
          <MetricGauge label="RAM" value={memPct} maxLabel={m.memory_total ? formatBytes(m.memory_total) : undefined} />
          <MetricGauge label="Disk" value={diskPct} maxLabel={m.disk_total ? formatBytes(m.disk_total) : undefined} />
        </div>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '12px 0' }}>
          No metrics collected yet
        </div>
      )}
    </div>
  )
}
