# Customer Support Ticketing System

A scalable, microservices-based customer support ticketing system with ticket management, agent responses, resolution workflows, and performance reporting.

## Architecture

Five independent microservices communicate via HTTP REST APIs, orchestrated through an NGINX API Gateway.

| Service | Port | Responsibility |
|---|---|---|
| **API Gateway** (nginx) | 80 / 808x | Serves the frontend; reverse-proxies all `/api/*` requests |
| **Ticket Service** | 3001 | Ticket creation, updates, status tracking, priority management |
| **Support Service** | 3002 | Agent assignment, responses/interaction history, resolution |
| **Notification Service** | 3003 | Sends alerts (email/SMS simulation) on ticket events |
| **Reporting Service** | 3004 | Performance reports — ticket stats, response times, priority breakdown |
| **PostgreSQL** | 5432 | Persistent storage for tickets, assignments, and response history |

All services are containerised with Docker using Alpine-based images.

---

## API Endpoints

### Ticket Service (`/api/tickets`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/tickets` | Create a new ticket (`title`, `description`, `priority`) |
| `GET` | `/api/tickets` | List all tickets |
| `GET` | `/api/tickets/:id` | Get a single ticket with full response history |
| `PUT` | `/api/tickets/:id` | Update ticket title, description, or priority |
| `PATCH` | `/api/tickets/:id/priority` | Update priority only (`LOW`/`MEDIUM`/`HIGH`/`URGENT`) |

### Support Service (`/api/support`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/support/:id/assign` | Assign ticket to a support agent |
| `POST` | `/api/support/:id/respond` | Add an agent response/message to a ticket |
| `POST` | `/api/support/:id/resolve` | Mark a ticket as resolved with optional notes |

### Reporting Service (`/api/reports`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/reports/summary` | Summary: counts by status/priority, avg resolution time |
| `GET` | `/api/reports/tickets` | Per-ticket performance table with age and response count |

---

## Running with Docker Compose

The project has three environment configurations. They can run simultaneously without port conflicts.

### Development (port 8081)
```bash
docker compose -f docker-compose.dev.yml up -d --build
```
Access at: `http://localhost:8081`

### Testing (port 8082)
```bash
docker compose -f docker-compose.test.yml up -d --build
```
Access at: `http://localhost:8082`

### Production (port 8083)
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Access at: `http://localhost:8083`

---

## Deploying to Kubernetes

Kubernetes manifests are provided in the `k8s/` directory for all services.

### 1. Build images locally (Minikube / Docker Desktop)
```bash
docker build -t ticket-service:latest       ./ticket-service
docker build -t support-service:latest      ./support-service
docker build -t notification-service:latest ./notification-service
docker build -t reporting-service:latest    ./reporting-service
docker build -t api-gateway:latest          ./api-gateway
```

### 2. Apply all manifests
```bash
kubectl apply -f k8s/
```

### 3. Access the application
The `api-gateway` is exposed as a `NodePort` on port `30080`.

```bash
# Minikube
minikube service api-gateway

# Docker Desktop
# Open http://localhost:30080
```

---

## Technologies Used
- **Node.js / Express** — Microservice backends
- **PostgreSQL** — Relational database
- **NGINX** — API Gateway and static frontend server
- **HTML / CSS / JavaScript** — Vanilla frontend with dark-mode UI
- **Docker & Docker Compose** — Containerisation and local orchestration (dev/test/prod)
- **Kubernetes** — Production container orchestration
