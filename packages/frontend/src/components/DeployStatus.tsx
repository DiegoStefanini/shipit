interface DeployStatusProps {
  status: string
}

const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: '#f59e0b22', color: '#f59e0b', label: 'Pending' },
  building: { bg: '#3b82f622', color: '#3b82f6', label: 'Building' },
  success: { bg: '#10b98122', color: '#10b981', label: 'Success' },
  failed: { bg: '#ef444422', color: '#ef4444', label: 'Failed' },
  idle: { bg: '#a1a1aa22', color: '#a1a1aa', label: 'Idle' },
}

export default function DeployStatus({ status }: DeployStatusProps) {
  const s = statusStyles[status] ?? statusStyles.idle
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 600,
        background: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  )
}
