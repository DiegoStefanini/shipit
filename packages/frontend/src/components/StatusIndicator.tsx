interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'unknown'
}

export default function StatusIndicator({ status }: StatusIndicatorProps) {
  return <span className={`status-dot ${status}`} title={status} />
}
