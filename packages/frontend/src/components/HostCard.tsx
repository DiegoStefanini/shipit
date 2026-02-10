import { Link } from 'react-router-dom'
import StatusIndicator from './StatusIndicator'
import { timeAgo } from '../utils/time'
import type { Host } from '../types'

interface HostCardProps {
  host: Host
}

export default function HostCard({ host }: HostCardProps) {
  const statusValue = host.status === 'online' ? 'online' : host.status === 'offline' ? 'offline' : 'unknown'

  return (
    <Link to={`/hosts/${host.id}`} className="card host-card">
      <div className="host-card-header">
        <span className="host-card-name">{host.name}</span>
        <StatusIndicator status={statusValue} />
      </div>
      <div className="host-card-ip">{host.ip_address}</div>
      <div className="host-card-badges">
        <span className={`badge badge-${host.type}`}>{host.type.toUpperCase()}</span>
        {host.has_docker === 1 && <span className="badge badge-docker">Docker</span>}
      </div>
      <div className="host-card-footer">
        <span>{host.last_seen_at ? timeAgo(host.last_seen_at) : 'Never seen'}</span>
      </div>
    </Link>
  )
}
