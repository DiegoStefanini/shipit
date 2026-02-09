interface AppConfig {
  baseDomain: string
  giteaUrl: string
}

let _config: AppConfig = { baseDomain: 'localhost', giteaUrl: 'http://localhost:3000' }

export async function loadConfig(): Promise<void> {
  try {
    const res = await fetch('/api/config')
    if (res.ok) {
      _config = await res.json()
    }
  } catch {
    // Use defaults
  }
}

export function getConfig(): AppConfig {
  return _config
}
