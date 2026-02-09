export interface Project {
  id: string
  name: string
  gitea_repo: string
  gitea_url: string
  branch: string
  language?: string
  container_id?: string
  status: string
  env_vars?: string
  created_at: number
  updated_at: number
}

export interface Deploy {
  id: string
  project_id: string
  commit_sha?: string
  commit_msg?: string
  status: string
  log?: string
  started_at: number
  finished_at?: number
  image_id?: string
}
