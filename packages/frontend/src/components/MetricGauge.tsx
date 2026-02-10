interface MetricGaugeProps {
  label: string
  value: number       // 0-100 percentage
  maxLabel?: string   // e.g., "8 GB"
  color?: string
}

export default function MetricGauge({ label, value, maxLabel, color }: MetricGaugeProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const fillClass = clamped >= 90 ? 'danger' : clamped >= 70 ? 'warning' : ''

  return (
    <div>
      <div className="metric-label">
        <span>{label}</span>
        <span>{clamped.toFixed(1)}%{maxLabel ? ` of ${maxLabel}` : ''}</span>
      </div>
      <div className="metric-bar">
        <div
          className={`metric-bar-fill ${fillClass}`}
          style={{
            width: `${clamped}%`,
            background: !fillClass && color ? color : undefined,
          }}
        />
      </div>
    </div>
  )
}
