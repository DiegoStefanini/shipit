# ShipIt v2

Infrastructure management platform for Proxmox homelabs. Deploy, monitor, and secure Docker services from a single control plane.

## Features

- **Deploy** — Git push to Gitea triggers SSH-based Docker builds on remote hosts
- **Monitoring** — System metrics via Proxmox API + Docker container stats via SSH
- **Logs** — Centralized log viewer (journald, container, HTTP) with live WebSocket streaming
- **Security** — CrowdSec integration with alerts, decisions, manual IP block/unblock
- **Alerts** — Rule-based alerting via Telegram and Discord webhooks
- **Self-deploy** — Auto-updates via Gitea Actions with health check and rollback

## Architecture

```
                    Gitea (CT 201)
                         |
                    webhook push
                         v
    Browser  --->  ShipIt (CT 200)  --->  Docker Host (VM 101)
     React          Express + SQLite        Docker containers
     SPA            bare metal              via SSH
```

- **Frontend**: React 19 + Vite 6 (served by Nginx)
- **Backend**: Express + TypeScript + SQLite (better-sqlite3)
- **Communication**: Proxmox API (metrics) + SSH (deploy, logs, security)
- **No agents** on managed hosts

## Quick Start

```bash
# Install dependencies
npm install

# Backend development
cd packages/backend
cp ../../.env.example ../../.env  # edit with your values
npm run dev

# Frontend development (separate terminal)
cd packages/frontend
npm run dev
```

## Project Structure

```
packages/
  backend/         Express API server
    src/
      routes/      API endpoints
      services/    SSH, Proxmox, CrowdSec, notifier, collectors
      engine/      Build & deploy engine
      middleware/   Auth, validation, rate limiting
      validation/  Zod schemas
      db/          SQLite schema & connection
      ws/          WebSocket handlers (live logs)
      __tests__/   Vitest API tests
  frontend/        React SPA
    src/
      pages/       Route pages
      components/  Reusable UI components
      hooks/       Custom React hooks
  cli/             CLI tool
deploy/            systemd, nginx, install scripts
```

## Environment Variables

See [.env.example](.env.example) for all available options.

## Testing

```bash
cd packages/backend
npm test          # run all tests
npm run test:watch  # watch mode
```

## Deploy Flow

```
PC local -> git push -> Gitea (CT 201) -> webhook -> ShipIt API (CT 200)
  -> SSH to target host -> git clone + docker build + docker run
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, TypeScript |
| Backend | Express, TypeScript, SQLite |
| Validation | Zod |
| Auth | JWT (7-day expiry) |
| Security | helmet, CORS, rate limiting, CrowdSec |
| Logging | pino (structured JSON) |
| Testing | Vitest + supertest |
| CI/CD | Gitea Actions |
| Reverse Proxy | Nginx + Cloudflare Tunnel |

## License

Private project.
