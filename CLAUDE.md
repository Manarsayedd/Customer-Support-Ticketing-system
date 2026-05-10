# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Customer Support Ticketing System** is a microservices-based application for managing customer support tickets. It features ticket creation, agent assignment, support interactions, and performance reporting across multiple independent services.

**Architecture**: Five containerized microservices communicate via HTTP REST APIs, orchestrated through an NGINX API Gateway. All services are containerized with Docker using Alpine-based images and can be deployed locally via Docker Compose or to Kubernetes.

**Tech Stack**:
- **Backend**: Node.js/Express.js (microservices)
- **Database**: PostgreSQL 15 (shared)
- **API Gateway**: NGINX
- **Frontend**: Vanilla HTML/CSS/JavaScript with dark-mode UI
- **Containerization**: Docker & Docker Compose (3 environments: dev/test/prod)
- **Orchestration**: Kubernetes manifests included

## Microservices Architecture

| Service | Port | Responsibility |
|---|---|---|
| **API Gateway** (nginx) | 8081 (dev), 8082 (test), 8083 (prod) / 80 internal | Reverse-proxy for all `/api/*` requests; serves frontend |
| **Ticket Service** | 3001 | Ticket CRUD, status tracking, priority management |
| **Support Service** | 3002 | Agent assignment, response/interaction history, resolution |
| **Notification Service** | 3003 | Alert notifications (email/SMS simulation) on ticket events |
| **Reporting Service** | 3004 | Performance analytics (summary stats, per-ticket metrics) |
| **PostgreSQL** | 5432 (dev), 5433 (test), 5434 (prod) | Shared relational storage |

## Database Schema

Three core tables in `db-init/init.sql`:
- **tickets**: Ticket metadata (title, description, status, priority, submitter, agent, timestamps)
- **support_assignments**: Agent assignment and resolution tracking (agent, assigned_at, resolved_at, notes)
- **ticket_responses**: Interaction history (agent, message, created_at)

Relationships: `support_assignments` and `ticket_responses` reference `tickets.id` with ON DELETE CASCADE.

## Running the System

### Docker Compose (Local Development)

Three isolated environments available; can run simultaneously without port conflicts.

**Development (port 8081)**:
```bash
docker compose -f docker-compose.dev.yml up -d --build
# Access at http://localhost:8081
# DB credentials: dev_user/dev_password
```

**Testing (port 8082)**:
```bash
docker compose -f docker-compose.test.yml up -d --build
# Access at http://localhost:8082
# DB credentials: test_user/test_password
# Database port: 5433
```

**Production (port 8083)**:
```bash
docker compose -f docker-compose.prod.yml up -d --build
# Access at http://localhost:8083
# DB credentials: prod_user/prod_password
# Database port: 5434
```

**Stop/Clean**:
```bash
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml down -v  # Remove volumes
```

### Kubernetes Deployment

Manifests in `k8s/` directory. Build and apply:
```bash
# Build all service images locally
docker build -t ticket-service:latest ./ticket-service
docker build -t support-service:latest ./support-service
docker build -t notification-service:latest ./notification-service
docker build -t reporting-service:latest ./reporting-service
docker build -t api-gateway:latest ./api-gateway

# Apply all manifests
kubectl apply -f k8s/

# Access via NodePort at http://localhost:30080 (Docker Desktop) or via minikube service
minikube service api-gateway
```

## API Endpoints

### Ticket Service (`/api/tickets`)
- `POST /api/tickets` — Create ticket (body: `title`, `description`, `submitted_by`)
- `GET /api/tickets` — List all tickets
- `GET /api/tickets/mine?name=<submitter>` — Get tickets by submitter name
- `GET /api/tickets/:id` — Get single ticket with full response history and assignment
- `PUT /api/tickets/:id` — Update ticket (body: `priority`, `assigned_agent`)

### Support Service (`/api/support/:id/*`)
- `POST /api/support/:id/assign` — Assign to agent (body: `support_agent`)
- `POST /api/support/:id/respond` — Add agent response (body: `agent`, `message`)
- `POST /api/support/:id/resolve` — Mark resolved (body: `resolution_notes`)

### Reporting Service (`/api/reports/*`)
- `GET /api/reports/summary` — Status/priority counts, avg resolution time, total responses
- `GET /api/reports/tickets` — Per-ticket performance with age (hours) and response count

## Service File Structure

Each microservice follows a consistent pattern:
```
<service>/
├── Dockerfile          # Alpine Node.js base, ~133 bytes, runs `npm start`
├── package.json        # Dependencies: express, pg (for DB services)
└── server.js           # Main Express app with routes, ~500-5000 lines
```

**Key patterns**:
- Services use `process.env.PORT` (fallback to service default: 3001–3004)
- Database services (ticket, support, reporting) use `pg.Pool` with connection env vars: `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`
- Notification service has no DB (stateless)
- All services call the notification service synchronously on ticket events (with try-catch to not fail if unavailable)

## Frontend Structure

Location: `api-gateway/frontend/`
- **index.html** — Customer portal (ticket submission, tracking)
- **agent.html** — Agent dashboard (ticket list, assignment, responses, resolution)
- **app.js** — Shared utilities, routing, state management
- **customer.js** — Customer page logic
- **agent.js** — Agent page logic

**Key patterns**:
- Single-page navigation without full page reloads
- Dark-mode CSS with CSS variables (`:root` defines colors, spacing, transitions)
- DOM manipulation via vanilla JS (no frameworks)
- API calls via `fetch()` with error handling and toast notifications
- Timestamps formatted via `toLocaleString()`

## Configuration Files

- **docker-compose.dev.yml, .test.yml, .prod.yml** — Service definitions, env vars, volumes, port mappings
- **api-gateway/nginx.conf** — NGINX config: root location serves frontend; `/api/*` paths proxy to backend services
- **k8s/*.yaml** — Kubernetes Deployments, Services, ConfigMaps, PersistentVolumeClaims for all services

## Development Notes

- **Environment variables** are injected at runtime via Docker Compose or Kubernetes manifests; no `.env` files in the repo
- **Inter-service communication**: Services call each other via `http://<service-name>:<port>` (e.g., `http://notification-service:3003/notify`) — assumes Docker DNS or Kubernetes DNS
- **Notification delivery** is async but non-critical; failures are logged but don't block main requests
- **Database initialization** runs automatically on container startup via `db-init/init.sql` mounted to PostgreSQL's entrypoint
- **No ORM**: All database queries use raw PostgreSQL via `pg.Pool` with parameterized queries

## Common Debugging

- **Services fail to start**: Check Docker network; ensure service names match `docker-compose.yml` and `nginx.conf`
- **Notifications not sent**: Check notification service logs; verify `http://notification-service:3003/notify` endpoint is reachable
- **Database connection errors**: Verify `DB_*` env vars match service environment; check PostgreSQL is running and initialized
- **NGINX routing issues**: Review `api-gateway/nginx.conf` proxy_pass targets; ensure backend services are healthy
- **Port conflicts**: Use different compose files for simultaneous environments (dev on 8081, test on 8082, prod on 8083)

