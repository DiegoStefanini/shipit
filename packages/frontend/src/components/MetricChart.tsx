interface MetricChartProps {
  data: Array<{ t: number; v: number }>
  label: string
  unit?: string
  color?: string
  height?: number
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatValue(v: number, unit?: string): string {
  if (unit === 'bytes') {
    if (v >= 1024 * 1024 * 1024) return (v / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
    if (v >= 1024 * 1024) return (v / (1024 * 1024)).toFixed(1) + ' MB'
    if (v >= 1024) return (v / 1024).toFixed(1) + ' KB'
    return v.toFixed(0) + ' B'
  }
  if (unit === '%') return v.toFixed(1) + '%'
  if (unit === 'seconds') {
    const h = Math.floor(v / 3600)
    const m = Math.floor((v % 3600) / 60)
    return `${h}h ${m}m`
  }
  return v.toFixed(1)
}

export default function MetricChart({ data, label, unit, color = 'var(--primary)', height = 120 }: MetricChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="metric-chart-container">
        <div className="metric-chart-header">
          <span style={{ fontWeight: 600 }}>{label}</span>
        </div>
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No data available
        </div>
      </div>
    )
  }

  const padding = { top: 10, right: 10, bottom: 25, left: 50 }
  const width = 600
  const totalHeight = height + padding.top + padding.bottom

  const values = data.map(d => d.v)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const range = maxV - minV || 1

  const minT = data[0].t
  const maxT = data[data.length - 1].t
  const timeRange = maxT - minT || 1

  const scaleX = (t: number) => padding.left + ((t - minT) / timeRange) * (width - padding.left - padding.right)
  const scaleY = (v: number) => padding.top + height - ((v - minV) / range) * height

  const points = data.map(d => `${scaleX(d.t)},${scaleY(d.v)}`).join(' ')
  const areaPoints = `${scaleX(data[0].t)},${scaleY(minV)} ${points} ${scaleX(data[data.length - 1].t)},${scaleY(minV)}`

  // Time labels (show 4-5 evenly spaced)
  const labelCount = Math.min(5, data.length)
  const timeLabels: Array<{ t: number; x: number }> = []
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.floor((i / (labelCount - 1 || 1)) * (data.length - 1))
    timeLabels.push({ t: data[idx].t, x: scaleX(data[idx].t) })
  }

  const lastValue = data[data.length - 1].v

  return (
    <div className="metric-chart-container">
      <div className="metric-chart-header">
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{formatValue(lastValue, unit)}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${totalHeight}`} style={{ width: '100%', height: 'auto' }}>
        {/* Y-axis labels */}
        <text x={padding.left - 6} y={padding.top + 4} textAnchor="end" fill="var(--text-muted)" fontSize="10">
          {formatValue(maxV, unit)}
        </text>
        <text x={padding.left - 6} y={padding.top + height} textAnchor="end" fill="var(--text-muted)" fontSize="10">
          {formatValue(minV, unit)}
        </text>

        {/* Grid lines */}
        <line x1={padding.left} y1={padding.top} x2={width - padding.right} y2={padding.top}
          stroke="var(--border)" strokeWidth="0.5" />
        <line x1={padding.left} y1={padding.top + height} x2={width - padding.right} y2={padding.top + height}
          stroke="var(--border)" strokeWidth="0.5" />

        {/* Area fill */}
        <polygon points={areaPoints} fill={color} opacity="0.1" />

        {/* Line */}
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

        {/* X-axis time labels */}
        {timeLabels.map((tl, i) => (
          <text key={i} x={tl.x} y={totalHeight - 4} textAnchor="middle" fill="var(--text-muted)" fontSize="10">
            {formatTime(tl.t)}
          </text>
        ))}
      </svg>
    </div>
  )
}
