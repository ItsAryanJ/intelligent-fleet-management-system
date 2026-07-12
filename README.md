# 🚄 NCRTC Intelligent Fleet Management Platform

Enterprise-grade fleet management system for the **National Capital Region Transport Corporation (NCRTC)** Delhi–Meerut Regional Rapid Transit System (RRTS). Provides real-time vehicle tracking (AVLS), route management, duty scheduling, incident lifecycle management, analytics dashboards, AI copilot, and comprehensive reporting — all behind a role-based access control system.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React + TypeScript + Vite | React 19, Vite 8 |
| **Styling** | Tailwind CSS | v4.3 |
| **State Management** | Zustand (auth) + TanStack Query (server) | Zustand 5, TQ 5 |
| **Charts** | Recharts | v3.8 |
| **Maps** | Leaflet + React-Leaflet (OpenStreetMap tiles) | Leaflet 1.9 |
| **Animations** | Framer Motion | v12 |
| **UI Primitives** | Radix UI | Multiple packages |
| **Forms** | React Hook Form + Zod | RHF 7, Zod 4 |
| **Backend** | FastAPI (Python) | v0.115.6 |
| **ORM** | SQLAlchemy 2.0 (Async) + GeoAlchemy2 | SA 2.0.36 |
| **Database** | PostgreSQL 16 + PostGIS 3.4 | `postgis/postgis:16-3.4` |
| **Auth** | JWT (access + refresh tokens) + bcrypt | python-jose, passlib |
| **PDF Generation** | ReportLab | v4.2.5 |
| **Infrastructure** | Docker Compose + Nginx | Compose 3.9 |
| **JSON** | orjson (high-performance responses) | v3.10 |
| **System Monitoring** | psutil | v6.1 |

---

## Repository Structure

```
├── backend/
│   ├── app/
│   │   ├── core/               # Config, security, database, middleware, permissions, WebSocket, utils, exceptions
│   │   ├── features/           # Feature modules (18 routers)
│   │   │   ├── analytics/      # Executive dashboard, fleet utilization, incident analytics, driver performance
│   │   │   ├── audit/          # Audit log list, activity timeline
│   │   │   ├── auth/           # Login, register, profile, token refresh
│   │   │   ├── copilot/        # AI chat (demo mode), tool registry
│   │   │   ├── depots/         # Depot CRUD with geofence
│   │   │   ├── duties/         # Scheduling, roster, bulk assign, conflict detection, publish
│   │   │   ├── geofence/       # Geofence check, route deviation detection
│   │   │   ├── gps/            # Live tracking, history, analytics, WebSocket stream
│   │   │   ├── incidents/      # Full lifecycle, SLA monitoring, panic button
│   │   │   ├── leaves/         # Leave request/approve/reject/cancel
│   │   │   ├── notices/        # CMS with targeting, read/acknowledge tracking
│   │   │   ├── notifications/  # In-app notifications, WebSocket delivery
│   │   │   ├── reports/        # PDF/CSV report generation
│   │   │   ├── routes/         # Route and stop management
│   │   │   ├── search/         # Global search (Ctrl+K)
│   │   │   ├── uploads/        # File upload/download with validation
│   │   │   ├── users/          # User CRUD, role assignment
│   │   │   └── vehicles/       # Vehicle CRUD, health status
│   │   ├── services/
│   │   │   └── gps_simulator.py  # Autonomous GPS simulation engine (762 lines)
│   │   ├── models.py           # SQLAlchemy models (20+ tables, 13 enums)
│   │   ├── seed.py             # Demo data generator
│   │   └── main.py             # FastAPI app factory, lifespan, router registration
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── features/           # 15 feature pages
│   │   │   ├── analytics/      # Analytics dashboard
│   │   │   ├── audit/          # Audit log viewer
│   │   │   ├── auth/           # Login page
│   │   │   ├── avls/           # Live map + GPS history replay
│   │   │   ├── copilot/        # AI copilot chat
│   │   │   ├── dashboard/      # Role-dispatched dashboard
│   │   │   ├── duties/         # Duty management + roster
│   │   │   ├── incidents/      # Incident management
│   │   │   ├── leaves/         # Leave management
│   │   │   ├── notices/        # Notice board
│   │   │   ├── reports/        # Report generation
│   │   │   ├── routes/         # Route network
│   │   │   ├── system/         # System health (admin only)
│   │   │   ├── users/          # User management
│   │   │   └── vehicles/       # Vehicle fleet
│   │   ├── components/         # Shared UI components (AppShell, Toast, ErrorBoundary, PermissionGuard)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Utilities
│   │   ├── store/              # Zustand stores (auth)
│   │   └── types/              # TypeScript type definitions
│   ├── Dockerfile
│   └── package.json
├── .github/workflows/ci.yml    # GitHub Actions CI pipeline
├── docker-compose.yml
└── README.md
```

---

## Feature Modules

| # | Module | Backend Prefix | Frontend Route | Description |
|---|--------|---------------|----------------|-------------|
| 1 | **Authentication** | `/api/auth` | `/login` | JWT login/register, profile view, token refresh |
| 2 | **Dashboard** | `/api/analytics` | `/dashboard` | Role-dispatched executive KPIs, utilization charts |
| 3 | **AVLS (Live Tracking)** | `/api/gps` | `/avls` | Real-time fleet map, vehicle markers, WebSocket stream |
| 4 | **GPS History** | `/api/gps` | `/avls/history` | Historical GPS replay with polyline, speed filtering |
| 5 | **Vehicles** | `/api/vehicles` | `/vehicles` | Fleet CRUD, health status (fuel, odometer, maintenance) |
| 6 | **Routes** | `/api/routes` | `/routes` | Route & stop management, route-stop sequencing |
| 7 | **Duties** | `/api/duties` | `/duties` | Shift scheduling, date filters, paginated list |
| 8 | **Roster** | `/api/duties/roster` | `/roster` | Weekly roster grid, bulk assign, conflict detection, publish |
| 9 | **Incidents** | `/api/incidents` | `/incidents` | Full lifecycle (6 states), SLA monitoring, panic button, timeline events |
| 10 | **Notices (CMS)** | `/api/notices` | `/notices` | Content management with targeting (ALL/ROLE/DEPOT/USER), read tracking |
| 11 | **Analytics** | `/api/analytics` | `/analytics` | Fleet utilization, incident trends, driver performance rankings, depot analytics |
| 12 | **Users** | `/api/users` | `/users` | User CRUD, role assignment, search/filter, pagination |
| 13 | **AI Copilot** | `/api/copilot` | `/copilot` | Natural-language chat with tool registry (demo mode) |
| 14 | **Reports** | `/api/reports` | `/reports` | Generate/download PDF and CSV reports (fleet, incident, driver, executive) |
| 15 | **Audit Log** | `/api/audit` | `/audit` | System audit trail, activity timeline |
| 16 | **Leaves** | `/api/leaves` | `/leaves` | Leave request/approve/reject/cancel with notifications |
| 17 | **Geofence** | `/api/geo` | — | Depot geofence check, route deviation detection with auto-incident creation |
| 18 | **Notifications** | `/api/notifications` | — | In-app notification center, mark read, WebSocket real-time delivery |
| 19 | **Global Search** | `/api/search` | — | Cross-entity search (vehicles, users, routes, incidents, notices) |
| 20 | **File Uploads** | `/api/uploads` | — | File upload/download/delete with validation (JPG, PNG, PDF) |
| 21 | **System Health** | `/api/system/health` | `/system-health` | CPU, memory, disk, DB probe, WebSocket count, GPS simulator status |
| 22 | **Depots** | `/api/depots` | — | Depot CRUD with geofence radius and capacity |

---

## Quick Start (Docker)

```bash
# Clone and start all services
git clone https://github.com/ItsAryanJ/intelligent-fleet-management-system.git
cd intelligent-fleet-management-system
docker compose up --build -d
```

This starts 3 containers:

| Container | Port | Description |
|-----------|------|-------------|
| `ncrtc-db` | 5432 | PostgreSQL 16 + PostGIS 3.4 |
| `ncrtc-backend` | 8000 | FastAPI + auto-seed + GPS simulator |
| `ncrtc-frontend` | 80 | React app served via Nginx |

The backend container **automatically** runs the seed script on first boot, creating demo data. Subsequent starts skip seeding (idempotent check).

**Access the app:** [http://localhost](http://localhost)
**API docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Local Development

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 16 with PostGIS 3.4
- (or just Docker)

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # Linux/macOS

# Install dependencies
pip install -r requirements.txt

# Configure environment (copy and edit)
cp .env.example .env

# Run seed script (first time only)
python -m app.seed

# Run seed script with only GPS data (this is important if you want to generate new GPS data without affecting other seeded data)
python -m app.seed --reseed-gps

# Start development server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend dev server runs on `http://localhost:5173` and proxies API requests to the backend.

---

## Default Credentials

| Email | Password | Role |
|-------|----------|------|
| `admin@ncrtc.in` | `pass@123` | ADMIN |
| `control.operator@ncrtc.in` | `pass@123` | CONTROL_OPERATOR |
| `depot.manager@ncrtc.in` | `pass@123` | DEPOT_MANAGER |
| `driver@ncrtc.in` | `pass@123` | DRIVER |
| `conductor@ncrtc.in` | `pass@123` | CONDUCTOR |
| `executive@ncrtc.in` | `pass@123` | EXECUTIVE |


All other seeded users use password: `ncrtc@2026`

---

## Seed Data

The seed script (`python -m app.seed`) generates realistic NCRTC operational data:

| Entity | Count | Details |
|--------|-------|---------|
| Depots | 5 | Sarai Kale Khan, Anand Vihar, Ghaziabad, Murad Nagar, Meerut South |
| Roles | 6 | ADMIN, CONTROL_OPERATOR, DEPOT_MANAGER, DRIVER, CONDUCTOR, EXECUTIVE |
| Users | 106 | 3 admin, 8 control ops, 5 depot mgrs, 45 drivers, 30 conductors, 9 executives + 6 default account for each roles|
| Vehicles | 50 | ALSTOM, Bombardier, CAF trainsets with health records |
| Stops | 13 | Real NCRTC Delhi–Meerut stations with coordinates |
| Routes | 15 | Express, local, shuttle, maintenance, and peak-hour services |
| Duties | ~140 | 7 days of shift assignments across 5 shifts |
| GPS Pings | ~12,750 | Route-following trajectories with GPS jitter (3 days × 50 vehicles) |
| Incidents | 50 | With full timeline events matching state progression |
| Notices | 20 | Published notices with various priorities |
| Leave Requests | 30 | Various statuses and types |
| Reports | 10 | Pre-generated report history |
| Notifications | ~150 | Distributed across first 30 users |

**Re-seed GPS data only:**
```bash
python -m app.seed --reseed-gps
```

---

## RBAC — Roles & Permissions

6 roles with granular permission enforcement:

| Permission | ADMIN | CONTROL_OPERATOR | DEPOT_MANAGER | EXECUTIVE | DRIVER | CONDUCTOR |
|-----------|:-----:|:----------------:|:-------------:|:---------:|:------:|:---------:|
| `vehicle.view` | ✅ | ✅ | ✅ (own depot) | ✅ | ✅ | ✅ |
| `vehicle.edit` | ✅ | ✅ | ✅ (own depot) | — | — | — |
| `route.view` | ✅ | ✅ | ✅ (own depot) | ✅ | ✅ | ✅ |
| `route.edit` | ✅ | ✅ | — | — | — | — |
| `duty.view` | ✅ | ✅ | ✅ (own depot) | ✅ | Own only | Own only |
| `duty.assign` | ✅ | ✅ | ✅ (own depot) | — | — | — |
| `duty.publish` | ✅ | ✅ | ✅ | — | — | — |
| `incident.view` | ✅ | ✅ | ✅ (own depot) | ✅ | Own only | Own only |
| `incident.create` | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| `incident.assign` | ✅ | ✅ | ✅ (own depot) | — | — | — |
| `incident.resolve` | ✅ | ✅ | ✅ (own depot) | — | — | — |
| `notice.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `notice.publish` | ✅ | ✅ | — | — | — | — |
| `analytics.view` | ✅ | ✅ | ✅ (own depot) | ✅ | — | — |
| `report.view` | ✅ | ✅ | ✅ (own depot) | ✅ | — | — |
| `report.generate` | ✅ | ✅ | ✅ (own depot) | ✅ | — | — |
| `user.view` | ✅ | ✅ | ✅ (own depot) | — | — | — |
| `user.manage` | ✅ | — | — | — | — | — |
| `depot.view` | ✅ | ✅ | ✅ (own depot) | ✅ | — | — |
| `depot.edit` | ✅ | — | — | — | — | — |
| `gps.view` | ✅ | ✅ | ✅ (own depot) | ✅ | — | — |
| `copilot.use` | ✅ | ✅ | ✅ | ✅ | — | — |
| `audit.view` | ✅ | — | — | — | — | — |
| `geofence.view` | ✅ | ✅ | ✅ (own depot) | — | — | — |
| `leave.approve` | ✅ | — | ✅ (own depot) | — | — | — |

> **Depot scoping:** Depot Managers automatically see only data belonging to their assigned depot. This is enforced at the query level in every router.

---

## WebSocket Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `ws://host:8000/api/gps/ws?token=<jwt>` | JWT via query param | Real-time GPS updates for all vehicles. Broadcasts `gps_update` events with lat/lng/speed/heading every 5s (configurable). |
| `ws://host:8000/api/notifications/ws?token=<jwt>` | JWT via query param | Real-time notification delivery. Supports `ping`/`pong` keepalive. Event types: `DUTY_PUBLISHED`, `INCIDENT_ASSIGNED`, `LEAVE_STATUS`, `GEOFENCE_BREACH`, etc. |

---

## GPS Simulator

An autonomous background engine that runs inside the FastAPI lifespan. It simulates realistic vehicle movement along routes:

- **Movement phases:** STOPPED → DEPARTING → ACCELERATING → CRUISING → BRAKING
- **Station dwell:** 15–30s at intermediate stops, longer at terminals
- **Terminal reversal:** Vehicles reverse direction at route endpoints
- **Speed profiles:** 15–80 km/h with per-vehicle randomized "personality" (cruise speed, accel/decel rates)
- **Persistence:** Updates `Vehicle.last_latitude/longitude/speed/heading` + inserts `GPSPing` records + broadcasts via WebSocket
- **Deadlock handling:** Deterministic lock ordering + exponential backoff retry (up to 3 attempts)

**Configuration:**

| Variable | Default | Description |
|----------|---------|-------------|
| `GPS_SIMULATOR_ENABLED` | `true` | Enable/disable the simulator |
| `GPS_SIMULATOR_INTERVAL_SECONDS` | `5` | Tick interval in seconds |
| `GPS_SIMULATOR_VEHICLE_COUNT` | `50` | Max vehicles to simulate |

---

## Environment Variables

See [`backend/.env.example`](backend/.env.example) for the full reference. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `development` | `development` or `production` |
| `SECRET_KEY` | *(change in prod)* | JWT signing secret |
| `POSTGRES_HOST` | `localhost` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |
| `POSTGRES_DB` | `ncrtc_fleet` | Database name |
| `POSTGRES_USER` | `ncrtc_admin` | Database user |
| `POSTGRES_PASSWORD` | *(see .env.example)* | Database password |
| `GPS_SIMULATOR_ENABLED` | `true` | Enable GPS simulator |
| `COPILOT_MODE` | `demo` | `demo` (pattern matching) or `live` |
| `CORS_ORIGINS` | `["http://localhost:5173", ...]` | Allowed CORS origins |

---

## Testing

The backend includes a pytest suite covering core modules:

```bash
cd backend

# Run all unit tests (no database required)
python -m pytest tests/ -m "not integration" -v

# Run with coverage
python -m pytest tests/ --cov=app --cov-report=term-missing

# Run only security tests
python -m pytest tests/test_security.py -v
```

**Test modules:**

| File | Scope | Tests |
|------|-------|-------|
| `test_security.py` | JTI denylist (deny_token, is_token_denied) | 3 |
| `test_exceptions.py` | Exception hierarchy (status codes, error codes) | 8 |
| `test_utils.py` | Haversine distance, file upload sanitization | 7 |
| `test_health.py` | Health endpoints (requires app context) | 2 |
| `test_auth.py` | Auth flow (login, protected routes, logout) | 5 |

> **Integration tests** (marked `@pytest.mark.integration`) require a live PostgreSQL+PostGIS instance. These run automatically in CI via the `postgis/postgis:16-3.4` service container.

---

## CI/CD

GitHub Actions runs on every push to `main`/`develop` and on pull requests:

```yaml
# .github/workflows/ci.yml
Jobs:
  1. backend-lint-test     # ruff lint + pytest (PostGIS service container)
  2. frontend-build        # TypeScript type-check + Vite production build
```

---

## Related Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — System architecture diagrams (Mermaid)

> **Note:** The following docs are referenced for completeness but may not exist yet as standalone files. The primary reference is this README and the interactive API docs at `/docs`.

---

## License

Proprietary — NCRTC Internal Use Only.
