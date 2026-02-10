import { useEffect, useState, useCallback } from 'react'
import HostOverviewCard from '../components/HostOverviewCard'
import MetricChart from '../components/MetricChart'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { usePolling } from '../hooks/usePolling'
import { apiFetch } from '../api'
import type { MonitoringOverview, MetricSeries, ContainerMetrics } from '../types'

const TIME_RANGES = [
  { label: '1h', ms: 3600_000 },
  { label: '6h', ms: 6 * 3600_000 },
  { label: '24h', ms: 24 * 3600_000 },
  { label: '7d', ms: 7 * 24 * 3600_000 },
]

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / 1024).toFixed(1) + ' KB'
}

export default function Monitoring() {
  const [overview, setOverview] = useState<MonitoringOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedHost, setSelectedHost] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState(3600_000)
  const [series, setSeries] = useState<MetricSeries | null>(null)
  const [containers, setContainers] = useState<ContainerMetrics | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchOverview = useCallback(() => {
    apiFetch('/api/monitoring/overview')
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch monitoring data')
        return r.json()
      })
      .then(setOverview)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  usePolling(fetchOverview, 30_000)

  // Fetch detail when host selected or time range changes
  useEffect(() => {
    if (!selectedHost) {
      setSeries(null)
      setContainers(null)
      return
    }

    setDetailLoading(true)
    const now = Date.now()
    const from = now - timeRange

    Promise.all([
      apiFetch(`/api/monitoring/hosts/${selectedHost}?from=${from}&to=${now}`).then(r => r.json()),
      apiFetch(`/api/monitoring/hosts/${selectedHost}/containers`).then(r => r.json()),
    ])
      .then(([seriesData, containerData]) => {
        setSeries(seriesData)
        setContainers(containerData)
      })
      .catch(() => {
        setSeries(null)
        setContainers(null)
      })
      .finally(() => setDetailLoading(false))
  }, [selectedHost, timeRange])

  const selectedOverview = overview.find(h => h.host_id === selectedHost)

  // Compute memory % series from used/total
  const memoryPercentSeries = series?.series?.memory_used && series?.series?.memory_total
    ? series.series.memory_used.map((point, i) => {
        const total = series.series.memory_total?.[i]?.v || 1
        return { t: point.t, v: (point.v / total) * 100 }
      })
    : undefined

  return (
    <div>
      <div className="page-header">
        <h1>Monitoring</h1>
      </div>

      {loading ? (
        <div className="monitoring-grid" role="status">
          {[1, 2, 3].map(i => (
            <div key={i} className="host-overview-card">
              <Skeleton width="60%" height="20px" />
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Skeleton height="20px" />
                <Skeleton height="20px" />
                <Skeleton height="20px" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="error-msg" role="alert">{error}</div>
      ) : overview.length === 0 ? (
        <EmptyState icon="monitoring" title="No hosts configured">
          Add hosts in the Hosts section to start monitoring.
        </EmptyState>
      ) : (
        <>
          <div className="monitoring-grid">
            {overview.map(host => (
              <HostOverviewCard
                key={host.host_id}
                data={host}
                selected={selectedHost === host.host_id}
                onClick={() => setSelectedHost(
                  selectedHost === host.host_id ? null : host.host_id
                )}
              />
            ))}
          </div>

          {selectedHost && selectedOverview && (
            <div className="monitoring-detail">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2>{selectedOverview.host_name} — Detail</h2>
                <div className="time-range-selector">
                  {TIME_RANGES.map(tr => (
                    <button
                      key={tr.label}
                      className={timeRange === tr.ms ? 'active' : ''}
                      onClick={() => setTimeRange(tr.ms)}
                    >
                      {tr.label}
                    </button>
                  ))}
                </div>
              </div>

              {detailLoading ? (
                <div className="charts-grid">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="metric-chart-container">
                      <Skeleton width="40%" height="16px" />
                      <div style={{ marginTop: 12 }}>
                        <Skeleton height="120px" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="charts-grid">
                    <MetricChart
                      data={series?.series?.cpu ?? []}
                      label="CPU Usage"
                      unit="%"
                      color="var(--primary)"
                    />
                    {memoryPercentSeries ? (
                      <MetricChart
                        data={memoryPercentSeries}
                        label="Memory Usage"
                        unit="%"
                        color="var(--blue)"
                      />
                    ) : (
                      <MetricChart
                        data={series?.series?.memory_used ?? []}
                        label="Memory Used"
                        unit="bytes"
                        color="var(--blue)"
                      />
                    )}
                    <MetricChart
                      data={series?.series?.netin ?? []}
                      label="Network In"
                      unit="bytes"
                      color="var(--primary)"
                    />
                    <MetricChart
                      data={series?.series?.netout ?? []}
                      label="Network Out"
                      unit="bytes"
                      color="var(--warning)"
                    />
                  </div>

                  {containers && Object.keys(containers.containers).length > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <h3 className="section-title">Docker Containers</h3>
                      <table className="container-metrics-table">
                        <thead>
                          <tr>
                            <th>Container</th>
                            <th>CPU</th>
                            <th>Memory</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(containers.containers).map(([name, metrics]) => (
                            <tr key={name}>
                              <td>{name}</td>
                              <td>{(metrics.container_cpu ?? 0).toFixed(1)}%</td>
                              <td>
                                {formatBytes(metrics.container_memory_used ?? 0)} / {formatBytes(metrics.container_memory_total ?? 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
