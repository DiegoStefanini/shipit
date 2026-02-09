import { Link } from 'react-router-dom'
import DeployStatus from './DeployStatus'
import { getConfig } from '../config'
import { timeAgo } from '../utils/time'
import type { Project } from '../types'

interface ProjectCardProps {
  project: Project
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const { baseDomain } = getConfig()
  const liveUrl = `https://${project.name}.${baseDomain}`

  return (
    <Link to={`/projects/${project.id}`} className="card project-card">
      <div className="project-card-header">
        <span className="project-card-name">{project.name}</span>
        <DeployStatus status={project.status} />
      </div>
      <div className="project-card-repo">{project.gitea_repo}</div>
      {project.language && (
        <span className="project-card-lang">{project.language}</span>
      )}
      <div className="project-card-footer">
        <span>{timeAgo(project.updated_at)}</span>
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="link-primary"
          onClick={(e) => e.stopPropagation()}
        >
          Visit
        </a>
      </div>
    </Link>
  )
}
