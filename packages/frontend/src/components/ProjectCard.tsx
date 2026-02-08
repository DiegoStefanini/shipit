import { Link } from 'react-router-dom'
import DeployStatus from './DeployStatus'

interface Project {
  id: string
  name: string
  gitea_repo: string
  status: string
  updated_at: number
}

interface ProjectCardProps {
  project: Project
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const liveUrl = `https://${project.name}.stefaniniserver.com`

  return (
    <Link to={`/projects/${project.id}`} className="card project-card">
      <div className="project-card-name">
        {project.name}
        <DeployStatus status={project.status} />
      </div>
      <div className="project-card-repo">{project.gitea_repo}</div>
      <a
        href={liveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="project-card-url"
        onClick={(e) => e.stopPropagation()}
      >
        {liveUrl}
      </a>
      <div className="project-card-footer">
        <span>Updated: {new Date(project.updated_at).toLocaleString()}</span>
      </div>
    </Link>
  )
}
