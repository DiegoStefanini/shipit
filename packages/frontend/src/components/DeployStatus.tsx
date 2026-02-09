interface DeployStatusProps {
  status: string
}

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  building: 'Building',
  success: 'Success',
  failed: 'Failed',
  running: 'Running',
  idle: 'Idle',
}

export default function DeployStatus({ status }: DeployStatusProps) {
  const label = statusLabels[status] ?? statusLabels.idle
  return (
    <span className={`deploy-badge deploy-badge-${status || 'idle'}`}>
      {status === 'building' && <span className="deploy-badge-dot" />}
      {label}
    </span>
  )
}
