import { Link } from 'react-router-dom'
import type { Project } from '../../types'

interface HostProjectsProps {
  projects: Project[]
}

export default function HostProjects({ projects }: HostProjectsProps) {
  return (
    <>
      <h2 className="section-title" style={{ marginTop: 32 }}>Projects on this Host</h2>
      {projects.length === 0 ? (
        <div className="empty-state" style={{ padding: 32 }}>
          <p>No projects deployed on this host.</p>
        </div>
      ) : (
        <div className="deploy-list">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="deploy-item" style={{ display: 'block' }}>
              <div className="deploy-item-header" style={{ cursor: 'pointer' }}>
                <div className="deploy-item-info">
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span className="text-muted">{p.gitea_repo}</span>
                </div>
                <span className={`deploy-badge deploy-badge-${p.status || 'idle'}`}>{p.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
