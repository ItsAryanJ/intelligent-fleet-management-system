# NCRTC Intelligent Fleet Management Platform — Architecture

## System Overview

The NCRTC Intelligent Fleet Management Platform is a real-time transit operations system for the National Capital Region Transport Corporation. It provides live vehicle tracking (AVLS), duty scheduling with roster publishing, incident lifecycle management, CMS notices, AI copilot assistance, and comprehensive analytics.

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React + TypeScript + Vite | React 18, Vite 5 |
| **UI Framework** | Tailwind CSS + Framer Motion | v3 / v11 |
| **State Management** | Zustand + TanStack Query | v4 / v5 |
| **Backend** | FastAPI (Python) | 0.100+ |
| **ORM** | SQLAlchemy 2.0 (Async) | 2.0+ |
| **Database** | PostgreSQL 15 + PostGIS 3.4 | via Docker |
| **Real-time** | WebSockets (native FastAPI) | — |
| **Containerization** | Docker Compose | v3.8 |
| **Auth** | JWT (HS256) via python-jose | — |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (React)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │Dashboard │ │ AVLS Map │ │Incidents │ │Copilot │ │
│  │(6 roles) │ │+ History │ │Lifecycle │ │  Chat  │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ │
│       └─────┬──────┴────────────┴────────────┘      │
│             │  Axios + React Query                   │
│             ▼                                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │   WebSocket (GPS Stream + Notifications)        │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP/WS
┌──────────────────────▼──────────────────────────────┐
│                    BACKEND (FastAPI)                  │
│  ┌──────────────────────────────────────────────┐   │
│  │            API Router Layer                    │   │
│  │  /auth  /vehicles  /routes  /duties  /gps     │   │
│  │  /incidents  /notices  /copilot  /analytics   │   │
│  │  /users  /reports  /audit  /notifications     │   │
│  │  /leaves  /depots  /system/health             │   │
│  └──────────────┬───────────────────────────────┘   │
│                 │                                     │
│  ┌──────────────▼───────────────────────────────┐   │
│  │          Core Services                        │   │
│  │  ┌──────────┐ ┌────────────┐ ┌────────────┐  │   │
│  │  │  RBAC    │ │ WebSocket  │ │    GPS     │  │   │
│  │  │  Engine  │ │  Manager   │ │ Simulator  │  │   │
│  │  └──────────┘ └────────────┘ └────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
│                 │                                     │
│  ┌──────────────▼───────────────────────────────┐   │
│  │      SQLAlchemy 2.0 Async ORM                 │   │
│  │      20+ Models with AuditMixin               │   │
│  └──────────────┬───────────────────────────────┘   │
└──────────────────┼──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│           PostgreSQL 15 + PostGIS 3.4                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐  │
│  │ Users  │ │Vehicles│ │  GPS   │ │  Incidents   │  │
│  │ Roles  │ │ Health │ │ Pings  │ │  Events      │  │
│  │ Perms  │ │ Routes │ │ Stops  │ │  Notices     │  │
│  └────────┘ └────────┘ └────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. RBAC — Role-Based Access Control
- **6 roles**: ADMIN, CONTROL_OPERATOR, DEPOT_MANAGER, DRIVER, CONDUCTOR, EXECUTIVE
- Permissions are mapped at the role level (not individual user)
- `DEPOT_MANAGER` users are **depot-scoped**: they only see vehicles, routes, duties, and incidents within their depot
- Frontend uses `PermissionGuard` component and Zustand `hasPermission()` for route/UI gating
- Backend uses `require_permission()` dependency injection

### 2. GPS Simulator (Background Engine)
- Runs as an `asyncio.Task` inside FastAPI's lifespan
- Vehicles follow pre-loaded `Route → RouteStop → Stop` waypoints
- Realistic speed profiles: departing → accelerating → cruising → braking → dwell
- Produces: Vehicle table updates, GPSPing inserts, WebSocket broadcasts via `gps_manager`
- ~5-second tick interval (configurable via `GPS_SIMULATOR_INTERVAL_SECONDS`)

### 3. Incident Lifecycle (State Machine)
```
OPEN → ACKNOWLEDGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
```
- Each transition is validated via `VALID_TRANSITIONS` dict
- Every state change creates an `IncidentEvent` for the audit timeline
- SLA tracking: `sla_deadline` computed at creation, `sla_breached` flagged at resolution
- Panic button: dedicated `/incidents/panic` endpoint with geolocation

### 4. WebSocket Architecture
- Two independent `ConnectionManager` instances:
  - `gps_manager`: Broadcasts GPS updates to AVLS clients
  - `notification_manager`: Pushes real-time notifications
- Both support metadata-tagged connections for future depot-scoped filtering
- Client authenticates via `?token=<JWT>` query parameter

### 5. Copilot (Demo Mode)
- Pattern-matching NLP (keyword-based intent detection)
- Surfaced as **"Demo Mode"** badge in UI — no hidden LLM claims
- Tool registry with role-based access control
- Returns structured responses with suggestions and optional data payloads

## Directory Structure

```
backend/
├── app/
│   ├── core/               # Config, DB, auth, RBAC, WebSocket, exceptions
│   │   ├── config.py       # Pydantic Settings
│   │   ├── database.py     # SQLAlchemy engine + session factory
│   │   ├── dependencies.py # FastAPI DI (auth, permissions)
│   │   ├── permissions.py  # Permission enum + role mapping
│   │   ├── security.py     # JWT creation/verification
│   │   └── websocket.py    # ConnectionManager
│   ├── features/           # Feature modules (router per feature)
│   │   ├── auth/           # Login, register, profile
│   │   ├── vehicles/       # CRUD + health
│   │   ├── routes/         # Route + stop management
│   │   ├── duties/         # Scheduling, roster publish, conflicts
│   │   ├── gps/            # Live positions, history, trip analytics, WS
│   │   ├── incidents/      # CRUD + lifecycle + panic
│   │   ├── notices/        # CMS + targeting + read tracking
│   │   ├── copilot/        # AI assistant (demo mode)
│   │   ├── analytics/      # Dashboard analytics
│   │   ├── notifications/  # In-app notifications
│   │   ├── users/          # User management
│   │   ├── reports/        # Report generation
│   │   ├── audit/          # Audit log queries
│   │   ├── leaves/         # Leave request/approval
│   │   └── depots/         # Depot management
│   ├── services/
│   │   └── gps_simulator.py  # Background GPS simulation engine
│   ├── models.py           # All SQLAlchemy models (20+ tables)
│   ├── seed.py             # Database seeding
│   └── main.py             # FastAPI app with lifespan
├── tests/                  # Pytest suite
├── Dockerfile
└── requirements.txt

frontend/
├── src/
│   ├── components/shared/  # AppShell, Modal, Toast, FormField, etc.
│   ├── features/           # Feature pages (mirrors backend)
│   │   ├── dashboard/      # Role-dispatched dashboards (6 views)
│   │   ├── avls/           # Live map + GPS History/Replay
│   │   ├── vehicles/       # Fleet management
│   │   ├── routes/         # Route management
│   │   ├── duties/         # Duty schedule + Roster grid
│   │   ├── incidents/      # Incident list + detail drawer (lifecycle)
│   │   ├── notices/        # CMS + form modal + detail drawer
│   │   ├── copilot/        # AI chat interface
│   │   ├── analytics/      # Analytics dashboard
│   │   └── ...
│   ├── store/auth.ts       # Zustand auth store
│   ├── lib/api.ts          # Axios instance
│   ├── hooks/              # Custom hooks (WebSocket, etc.)
│   ├── types/              # TypeScript interfaces
│   └── App.tsx             # Router + permission guards
├── Dockerfile
└── package.json
```

## Database Schema (Key Tables)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | Platform users (all roles) | email, role_id, depot_id, employee_id |
| `vehicles` | Fleet vehicles | registration_no, status, last_lat/lng |
| `routes` | Transit routes | code, geometry (PostGIS), stops |
| `duties` | Daily assignments | date, shift, driver_id, vehicle_id, status |
| `gps_pings` | GPS telemetry (time-series) | vehicle_id, lat/lng, speed, timestamp |
| `incidents` | Incident records | status (6-state), severity, SLA tracking |
| `incident_events` | Incident timeline | event_type, description, created_by |
| `notices` | CMS content | target_type, target_roles, target_depot_ids |
| `notice_reads` | Read tracking | notice_id, user_id, read_at |
| `notifications` | In-app notifications | user_id, type, is_read |
| `audit_logs` | System audit trail | action, resource_type, user_id |

## API Endpoints Summary

- **Auth**: POST /auth/login, POST /auth/register, GET /auth/profile
- **Vehicles**: CRUD + GET /vehicles/stats
- **Routes**: CRUD + stops management
- **Duties**: CRUD + POST /duties/publish + GET /duties/conflicts
- **GPS**: GET /live, GET /history/{id}, GET /trip-analytics/{id}, WS /stream
- **Incidents**: CRUD + /panic + /acknowledge + /assign + /in-progress + /resolve + /close + /events
- **Notices**: CRUD + /publish + /read + /acknowledge + /readers
- **Copilot**: POST /chat (demo mode)
- **System**: GET /system/health (real probes, no fabrication)

## Security

- JWT-based authentication (HS256, configurable expiry)
- Password hashing via bcrypt
- RBAC enforced at both API and UI layers
- CORS configured for frontend origin
- WebSocket authentication via token query parameter
- Depot-scoped data isolation for DEPOT_MANAGER role
