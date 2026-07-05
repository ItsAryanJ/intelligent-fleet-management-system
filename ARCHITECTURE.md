# Architecture — NCRTC Fleet Management Platform

System architecture documentation with diagrams. All information verified against the current implementation.

---

## 1. System Architecture

```mermaid
graph TB
    subgraph Client["Browser (React 19 + Vite)"]
        FE["React Frontend<br/>:5173 / :80"]
    end

    subgraph Backend["FastAPI Backend (:8000)"]
        MW["Middleware Layer<br/>CORS, RequestID, Timing, Error Handlers"]
        R["18 Feature Routers"]
        SVC["Services"]
        SIM["GPS Simulator<br/>(Background Task)"]
        WS["WebSocket Managers<br/>gps_manager + notification_manager"]
    end

    subgraph Database["PostgreSQL 16 + PostGIS 3.4"]
        DB["ncrtc_fleet<br/>20+ Tables"]
    end

    FE -->|"REST API /api/*"| MW
    FE <-->|"WebSocket /api/gps/ws"| WS
    FE <-->|"WebSocket /api/notifications/ws"| WS
    MW --> R
    R --> DB
    SVC --> DB
    SIM -->|"Tick every 5s"| DB
    SIM -->|"Broadcast"| WS

    style Client fill:#EFF6FF,stroke:#2563EB
    style Backend fill:#F0FDF4,stroke:#16A34A
    style Database fill:#FFF7ED,stroke:#EA580C
```

---

## 2. Request Lifecycle

```mermaid
sequenceDiagram
    participant C as Client
    participant MW as Middleware
    participant AUTH as Auth Dependencies
    participant R as Router
    participant DB as PostgreSQL

    C->>MW: HTTP Request
    MW->>MW: Add X-Request-ID
    MW->>MW: Start timing
    MW->>AUTH: Extract JWT from Authorization header
    AUTH->>AUTH: verify_access_token(token)
    AUTH->>DB: Load user + role + permissions
    AUTH-->>R: Inject CurrentUser
    R->>R: Check require_permission(Permission.X)
    R->>DB: Execute query (async SQLAlchemy)
    DB-->>R: Result
    R-->>MW: Response
    MW->>MW: Add X-Process-Time header
    MW-->>C: JSON Response (orjson)
```

### Middleware Stack (applied in order)

| Middleware | Purpose |
|-----------|---------|
| `CORSMiddleware` | Cross-origin resource sharing for frontend |
| `RequestIDMiddleware` | Generates `X-Request-ID` UUID for each request |
| `TimingMiddleware` | Adds `X-Process-Time` header (ms) |
| `AppException` handler | Catches custom exceptions → structured JSON errors |
| `ValidationError` handler | Catches Pydantic validation errors → 422 with field details |

---

## 3. GPS Data Flow

```mermaid
graph LR
    subgraph Simulator["GPS Simulator (asyncio task)"]
        TICK["Tick Loop<br/>every 5s"]
        PHYS["Vehicle Physics<br/>Speed, Heading, Phase"]
        INTERP["Position Interpolation<br/>Route → Waypoints → lat/lng"]
    end

    subgraph Persistence["Database Writes"]
        VEH["UPDATE vehicles<br/>last_latitude, last_longitude,<br/>last_speed, last_heading"]
        VH["UPDATE vehicle_health<br/>fuel_level, odometer"]
        PING["INSERT gps_pings<br/>Historical telemetry"]
    end

    subgraph Broadcast["WebSocket Broadcast"]
        WS["gps_manager.broadcast()"]
        CLIENT["Connected Clients<br/>(AVLS Map Page)"]
    end

    TICK --> PHYS
    PHYS --> INTERP
    INTERP --> VEH
    INTERP --> VH
    INTERP --> PING
    INTERP --> WS
    WS --> CLIENT

    style Simulator fill:#EFF6FF,stroke:#2563EB
    style Persistence fill:#FFF7ED,stroke:#EA580C
    style Broadcast fill:#F0FDF4,stroke:#16A34A
```

### Vehicle Movement Phases

```mermaid
stateDiagram-v2
    [*] --> STOPPED: Station dwell
    STOPPED --> DEPARTING: Dwell expired
    DEPARTING --> ACCELERATING: Speed >= 15 km/h
    ACCELERATING --> CRUISING: Speed >= 35 km/h
    CRUISING --> BRAKING: Progress > 70% of segment
    BRAKING --> STOPPED: Arrived at stop

    STOPPED --> STOPPED: Terminal reversal (direction *= -1)
```

### Deadlock Prevention

The simulator uses three strategies to avoid PostgreSQL deadlocks:
1. **Deterministic lock ordering** — Vehicle states sorted by `vehicle_id` before DB writes
2. **Single transaction** — All updates in one `BEGIN` block to minimize lock duration
3. **Retry with backoff** — Up to 3 retries with exponential delay (0.2s, 0.4s, 0.8s)

---

## 4. Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AUTH as /api/auth
    participant SEC as security.py
    participant DB as PostgreSQL

    Note over C,DB: Login Flow
    C->>AUTH: POST /api/auth/login {email, password}
    AUTH->>DB: SELECT user WHERE email = ?
    DB-->>AUTH: User record
    AUTH->>SEC: verify_password(password, hash)
    SEC-->>AUTH: Valid ✓
    AUTH->>SEC: create_access_token(user_id, role)
    AUTH->>SEC: create_refresh_token(user_id)
    AUTH->>DB: UPDATE user SET last_login = now()
    AUTH-->>C: {access_token, refresh_token, user}

    Note over C,DB: Authenticated Request
    C->>AUTH: GET /api/vehicles (Authorization: Bearer <token>)
    AUTH->>SEC: verify_access_token(token)
    SEC-->>AUTH: {sub: user_id, role: ADMIN}
    AUTH->>DB: Load user, role, permissions
    AUTH-->>C: Response data

    Note over C,DB: Token Refresh
    C->>AUTH: POST /api/auth/refresh {refresh_token}
    AUTH->>SEC: verify_refresh_token(token)
    AUTH->>SEC: create_access_token(user_id, role)
    AUTH-->>C: {access_token}
```

### Token Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `JWT_ALGORITHM` | `HS256` | Signing algorithm |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token lifetime |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |
| `SECRET_KEY` | *(must change in prod)* | Shared signing secret |

---

## 5. AI Copilot Architecture

```mermaid
graph TB
    USER["User Query<br/>'Show fleet status'"]
    CHAT["POST /api/copilot/chat"]
    PERM["Role-Based Tool Filtering<br/>COPILOT_TOOL_REGISTRY"]
    MATCH["Pattern Matching Engine<br/>(Demo Mode)"]
    TOOLS["Tool Execution<br/>fleet_overview, incident_summary,<br/>vehicle_lookup, gps_check, etc."]
    AUDIT["AuditLog Entry<br/>resource_type='copilot'"]
    RESP["Structured Response<br/>{message, tool_used, data}"]

    USER --> CHAT
    CHAT --> PERM
    PERM --> MATCH
    MATCH --> TOOLS
    TOOLS --> AUDIT
    TOOLS --> RESP

    style USER fill:#EFF6FF,stroke:#2563EB
    style AUDIT fill:#FFF7ED,stroke:#EA580C
```

### Copilot Modes

| Mode | Config | Behavior |
|------|--------|----------|
| `demo` (default) | `COPILOT_MODE=demo` | Pattern-matching against query text, executes local DB tools |
| `live` | `COPILOT_MODE=live` + `GEMINI_API_KEY` | External LLM integration (not yet implemented) |

### Tool Registry (role-filtered)

Tools are registered in `COPILOT_TOOL_REGISTRY` and filtered by the user's role at query time. Each query is logged to the `audit_logs` table.

---

## 6. Database Entity Relationship

```mermaid
erDiagram
    ROLE ||--o{ USER : "has many"
    DEPOT ||--o{ USER : "has many"
    DEPOT ||--o{ VEHICLE : "has many"
    DEPOT ||--o{ ROUTE : "has many"

    USER ||--o{ DUTY : "driver"
    USER ||--o{ DUTY : "conductor"
    VEHICLE ||--o{ DUTY : "assigned"
    ROUTE ||--o{ DUTY : "route"

    VEHICLE ||--|| VEHICLE_HEALTH : "has one"
    VEHICLE ||--o{ GPS_PING : "has many"
    VEHICLE ||--o{ INCIDENT : "reported on"

    ROUTE ||--o{ ROUTE_STOP : "has many"
    STOP ||--o{ ROUTE_STOP : "has many"

    USER ||--o{ INCIDENT : "reported by"
    USER ||--o{ INCIDENT : "assigned to"
    INCIDENT ||--o{ INCIDENT_EVENT : "has many"

    USER ||--o{ NOTIFICATION : "has many"
    USER ||--o{ LEAVE_REQUEST : "has many"
    USER ||--o{ AUDIT_LOG : "performed by"

    NOTICE ||--o{ NOTICE_READ : "has many"
    USER ||--o{ NOTICE_READ : "read by"

    REPORT }o--|| USER : "generated by"
```

### Key Design Patterns

- **Soft deletes:** All entities use `is_deleted` boolean flag (inherited from `BaseModel`)
- **Audit fields:** `created_by`, `updated_by`, `created_at`, `updated_at` on all entities
- **UUID primary keys:** All tables use `uuid.uuid4()` as default
- **Enum constraints:** 13 PostgreSQL-backed enums for type safety

---

## 7. Incident State Machine

```mermaid
stateDiagram-v2
    [*] --> OPEN: Incident created
    OPEN --> ACKNOWLEDGED: Control room acknowledges
    ACKNOWLEDGED --> ASSIGNED: Handler assigned
    ACKNOWLEDGED --> IN_PROGRESS: Work started directly
    ASSIGNED --> IN_PROGRESS: Handler begins work
    IN_PROGRESS --> RESOLVED: Issue fixed (notes required)
    RESOLVED --> CLOSED: Verified and closed
    CLOSED --> [*]

    note right of OPEN
        SLA timer starts
        P1: 1 hour
        P2: 4 hours
        P3: 24 hours
    end note

    note right of RESOLVED
        SLA breach checked
        Resolution notes required
    end note
```

### Incident Severity Levels

| Severity | SLA Deadline | Examples |
|----------|-------------|---------|
| **P1** (Critical) | 1 hour | Brake failure, track obstruction, SPAD |
| **P2** (High) | 4 hours | Pantograph damage, door malfunction, route deviation |
| **P3** (Low) | 24 hours | AC failure, CCTV malfunction, graffiti |

### Valid State Transitions

| Current State | Allowed Next States |
|--------------|-------------------|
| `OPEN` | `ACKNOWLEDGED` |
| `ACKNOWLEDGED` | `ASSIGNED`, `IN_PROGRESS` |
| `ASSIGNED` | `IN_PROGRESS` |
| `IN_PROGRESS` | `RESOLVED` |
| `RESOLVED` | `CLOSED` |
| `CLOSED` | *(none)* |

---

## 8. Frontend Architecture

```mermaid
graph TB
    subgraph App["React Application"]
        ROUTER["React Router v7<br/>BrowserRouter"]
        GUARD["PermissionGuard<br/>Role + Permission checks"]
        SHELL["AppShell<br/>Sidebar + Header + Content"]
    end

    subgraph State["State Management"]
        ZUSTAND["Zustand<br/>Auth Store (token, user, permissions)"]
        TANSTACK["TanStack Query<br/>Server state (API cache, refetch)"]
    end

    subgraph Pages["15 Feature Pages"]
        DASH["Dashboard"]
        AVLS["AVLS + History"]
        VEH["Vehicles"]
        INC["Incidents"]
        OTHER["... 11 more"]
    end

    ROUTER --> GUARD
    GUARD --> SHELL
    SHELL --> Pages
    Pages --> TANSTACK
    Pages --> ZUSTAND

    style App fill:#EFF6FF,stroke:#2563EB
    style State fill:#F0FDF4,stroke:#16A34A
    style Pages fill:#FFF7ED,stroke:#EA580C
```

### Frontend Route → Permission Mapping

| Route | Permission Required | Role Restriction |
|-------|-------------------|-----------------|
| `/dashboard` | *(any authenticated)* | — |
| `/avls`, `/avls/history` | `gps.view` | — |
| `/vehicles` | `vehicle.view` | — |
| `/routes` | `route.view` | — |
| `/duties`, `/roster` | `duty.view` | — |
| `/incidents` | `incident.view` | — |
| `/notices` | `notice.view` | — |
| `/analytics` | `analytics.view` | — |
| `/users` | `user.view` | — |
| `/copilot` | `copilot.use` | — |
| `/reports` | `report.view` | — |
| `/audit` | `audit.view` | — |
| `/leaves` | *(any authenticated)* | — |
| `/system-health` | — | `ADMIN` only |
