export interface Project {
  id: string
  name: string
  gitea_repo: string
  gitea_url: string
  branch: string
  language?: string
  container_id?: string
  host_id?: string
  status: string
  env_vars?: string
  created_at: number
  updated_at: number
}

export interface Host {
  id: string
  name: string
  type: 'vm' | 'ct'
  proxmox_vmid?: number
  ip_address: string
  ssh_port: number
  ssh_user: string
  ssh_key_path?: string
  has_docker: number
  has_crowdsec: number
  status: string
  last_seen_at?: number
  poll_interval: number
  created_at: number
  updated_at: number
}

export interface HostMetrics {
  cpu: number
  memory: { used: number; total: number }
  disk: { used: number; total: number }
  netin: number
  netout: number
  uptime: number
  status: string
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

export interface MonitoringOverview {
  host_id: string
  host_name: string
  host_type: string
  status: string
  last_seen_at?: number
  metrics: Record<string, number>
}

export interface MetricSeries {
  host_id: string
  from: number
  to: number
  series: Record<string, Array<{ t: number; v: number }>>
}

export interface ContainerMetrics {
  host_id: string
  containers: Record<string, Record<string, number>>
}

export interface LogEntry {
  id: number
  host_id: string
  host_name?: string
  source: string
  container_name?: string
  service_name?: string
  level: string
  message: string
  timestamp: number
  collected_at: number
}

export interface LogsResponse {
  logs: LogEntry[]
  total: number
  limit: number
  offset: number
}

export interface SecurityOverview {
  total_alerts_24h: number
  active_decisions: number
  top_scenarios: Array<{ scenario: string; count: number }>
  top_countries: Array<{ source_country: string; count: number }>
  alerts_per_hour: Array<{ hour: number; count: number }>
}

export interface SecurityAlert {
  id: number
  host_id: string
  host_name?: string
  alert_id: string
  scenario: string
  source_ip: string
  source_country?: string
  source_as?: string
  events_count: number
  start_at?: string
  stop_at?: string
  collected_at: number
}

export interface SecurityDecision {
  id: number
  host_id: string
  host_name?: string
  decision_id: string
  source_ip: string
  type: string
  scenario?: string
  duration?: string
  origin: string
  created_at: number
  expires_at?: number
}

export interface NotificationChannel {
  id: string
  name: string
  type: 'telegram' | 'discord'
  config: string
  enabled: number
  created_at: number
}

export interface AlertRule {
  id: string
  name: string
  type: 'metric_threshold' | 'service_down' | 'security' | 'deploy'
  condition: string
  channel_ids: string
  cooldown: number
  enabled: number
  last_triggered_at?: number
  created_at: number
}

export interface AlertHistoryEntry {
  id: number
  rule_name?: string
  message: string
  triggered_at: number
}
