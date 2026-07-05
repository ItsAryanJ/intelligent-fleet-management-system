# API Reference — NCRTC Fleet Management Platform

Complete REST API documentation for all 18 feature modules + 2 system endpoints. All endpoints verified against the current router implementations.

**Base URL:** `http://localhost:8000/api`
**Auth:** JWT Bearer token (header: `Authorization: Bearer <access_token>`)
**Content-Type:** `application/json` (unless noted otherwise)
**Response format:** JSON (via orjson)

> **Interactive docs:** Swagger UI at [/docs](http://localhost:8000/docs) and ReDoc at [/redoc](http://localhost:8000/redoc)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Depots](#3-depots)
4. [Vehicles](#4-vehicles)
5. [Routes](#5-routes)
6. [Duties](#6-duties)
7. [GPS & AVLS](#7-gps--avls)
8. [Incidents](#8-incidents)
9. [Notices & CMS](#9-notices--cms)
10. [Notifications](#10-notifications)
11. [Analytics](#11-analytics)
12. [Reports](#12-reports)
13. [Audit](#13-audit)
14. [Search](#14-search)
15. [AI Copilot](#15-ai-copilot)
16. [Geofence & Route Deviation](#16-geofence--route-deviation)
17. [Leave Management](#17-leave-management)
18. [File Uploads](#18-file-uploads)
19. [System](#19-system)

---

## 1. Authentication

**Prefix:** `/api/auth`
**Tag:** Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/login` | ❌ | Login and receive JWT tokens |
| `POST` | `/auth/refresh` | ❌ | Refresh access token |
| `POST` | `/auth/logout` | ✅ | Logout (client discards tokens) |
| `GET` | `/auth/me` | ✅ | Get current user profile |
| `POST` | `/auth/change-password` | ✅ | Change own password |

### `POST /api/auth/login`

**Request:**
```json
{
  "email": "admin@ncrtc.in",
  "password": "password123"
}
```
- `email` — Valid email address (required)
- `password` — String, 6–128 chars (required)

**Response:** `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": "uuid",
    "email": "admin@ncrtc.in",
    "first_name": "System",
    "last_name": "Admin",
    "employee_id": "NCRTC-0000",
    "role": "ADMIN",
    "permissions": ["vehicle.view", "vehicle.edit", ...],
    "depot_id": "uuid | null",
    "depot_name": "Sarai Kale Khan Depot | null",
    "avatar_url": null
  }
}
```

### `POST /api/auth/refresh`

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:** `200 OK` — Same structure as login response.

### `GET /api/auth/me`

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "admin@ncrtc.in",
  "first_name": "System",
  "last_name": "Admin",
  "employee_id": "NCRTC-0000",
  "phone": "+91-9999999999",
  "avatar_url": null,
  "role": "ADMIN",
  "role_id": "uuid",
  "permissions": ["vehicle.view", ...],
  "depot_id": "uuid",
  "depot_name": "Sarai Kale Khan Depot",
  "is_active": true,
  "last_login": "2026-07-05T10:00:00Z",
  "created_at": "2026-07-01T00:00:00Z"
}
```

### `POST /api/auth/change-password`

**Request:**
```json
{
  "current_password": "password123",
  "new_password": "newSecurePassword456"
}
```
- `new_password` — 8–128 chars

**Response:** `200 OK` — `{"message": "Password changed successfully"}`

---

## 2. Users

**Prefix:** `/api/users`
**Tag:** Users
**Permission:** `user.view` (read), `user.manage` (write)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `GET` | `/users` | ✅ | `user.view` | List users (paginated, filterable) |
| `POST` | `/users` | ✅ | `user.manage` | Create a new user |
| `GET` | `/users/{id}` | ✅ | `user.view` | Get user by ID |
| `PUT` | `/users/{id}` | ✅ | `user.manage` | Update user |
| `DELETE` | `/users/{id}` | ✅ | `user.manage` | Soft-delete user |
| `GET` | `/users/roles/list` | ✅ | `user.view` | List all roles |
| `PUT` | `/users/{id}/role` | ✅ | `user.manage` | Assign role to user |

### `GET /api/users`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `search` | string | | Filter by name, email, employee_id |
| `role` | string | | Filter by role name |
| `depot_id` | UUID | | Filter by depot |
| `is_active` | boolean | | Filter by active status |
| `page` | int | `1` | Page number |
| `page_size` | int | `20` | Results per page |
| `sort_by` | string | `created_at` | Sort field |
| `sort_order` | string | `desc` | `asc` or `desc` |

> **Depot scoping:** DEPOT_MANAGER role automatically filters to own depot.

---

## 3. Depots

**Prefix:** `/api/depots`
**Tag:** Depots
**Permission:** `depot.view` (read), `depot.edit` (write)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `GET` | `/depots` | ✅ | `depot.view` | List all depots |
| `POST` | `/depots` | ✅ | `depot.edit` | Create a depot |
| `GET` | `/depots/{id}` | ✅ | `depot.view` | Get depot by ID |
| `PUT` | `/depots/{id}` | ✅ | `depot.edit` | Update depot |
| `DELETE` | `/depots/{id}` | ✅ | `depot.edit` | Soft-delete depot |
| `GET` | `/depots/{id}/stats` | ✅ | `depot.view` | Depot statistics (vehicle/user/route counts) |

### Depot Create/Update Body:
```json
{
  "name": "New Depot",
  "code": "NDP",
  "address": "Sector 62, Noida",
  "city": "Noida",
  "state": "Uttar Pradesh",
  "latitude": 28.6270,
  "longitude": 77.3730,
  "geofence_radius_m": 500,
  "capacity": 60,
  "contact_phone": "+91-1234567890",
  "contact_email": "depot@ncrtc.in"
}
```

---

## 4. Vehicles

**Prefix:** `/api/vehicles`
**Tag:** Vehicles
**Permission:** `vehicle.view` (read), `vehicle.edit` (write)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `GET` | `/vehicles` | ✅ | `vehicle.view` | List vehicles (paginated, filterable) |
| `POST` | `/vehicles` | ✅ | `vehicle.edit` | Create vehicle |
| `GET` | `/vehicles/{id}` | ✅ | `vehicle.view` | Get vehicle with health data |
| `PUT` | `/vehicles/{id}` | ✅ | `vehicle.edit` | Update vehicle |
| `DELETE` | `/vehicles/{id}` | ✅ | `vehicle.edit` | Soft-delete vehicle |
| `GET` | `/vehicles/{id}/health` | ✅ | `vehicle.view` | Get vehicle health record |
| `PUT` | `/vehicles/{id}/health` | ✅ | `vehicle.edit` | Update vehicle health |

### `GET /api/vehicles`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `search` | string | | Filter by registration_no, make, model |
| `status` | string | | Filter by VehicleStatus |
| `vehicle_type` | string | | Filter by VehicleType |
| `depot_id` | UUID | | Filter by depot |
| `page` | int | `1` | |
| `page_size` | int | `20` | |

---

## 5. Routes

**Prefix:** `/api/routes`
**Tag:** Routes
**Permission:** `route.view` (read), `route.edit` (write)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `GET` | `/routes` | ✅ | `route.view` | List routes with stop count |
| `POST` | `/routes` | ✅ | `route.edit` | Create route |
| `GET` | `/routes/{id}` | ✅ | `route.view` | Get route with full stop details |
| `PUT` | `/routes/{id}` | ✅ | `route.edit` | Update route |
| `DELETE` | `/routes/{id}` | ✅ | `route.edit` | Soft-delete route |
| `GET` | `/routes/stops/all` | ✅ | `route.view` | List all stops |
| `POST` | `/routes/stops` | ✅ | `route.edit` | Create a new stop |
| `PUT` | `/routes/stops/{id}` | ✅ | `route.edit` | Update stop |
| `DELETE` | `/routes/stops/{id}` | ✅ | `route.edit` | Delete stop |
| `POST` | `/routes/{id}/stops` | ✅ | `route.edit` | Add stop to route (set sequence) |
| `DELETE` | `/routes/{route_id}/stops/{stop_id}` | ✅ | `route.edit` | Remove stop from route |

---

## 6. Duties

**Prefix:** `/api/duties`
**Tag:** Duties
**Permission:** `duty.view` (read), `duty.assign` (create/update), `duty.publish` (publish/complete)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `GET` | `/duties` | ✅ | `duty.view` | List duties (paginated, filterable) |
| `POST` | `/duties` | ✅ | `duty.assign` | Create duty |
| `GET` | `/duties/{id}` | ✅ | `duty.view` | Get duty details |
| `PUT` | `/duties/{id}` | ✅ | `duty.assign` | Update duty |
| `DELETE` | `/duties/{id}` | ✅ | `duty.assign` | Delete duty |
| `POST` | `/duties/{id}/publish` | ✅ | `duty.publish` | Publish duty (sends notifications) |
| `POST` | `/duties/{id}/complete` | ✅ | `duty.publish` | Mark duty as completed |
| `POST` | `/duties/{id}/cancel` | ✅ | `duty.assign` | Cancel duty |
| `POST` | `/duties/{id}/acknowledge` | ✅ | ✅ (driver/conductor) | Acknowledge assigned duty |
| `GET` | `/duties/roster/weekly` | ✅ | `duty.view` | Get weekly roster grid |
| `POST` | `/duties/roster/bulk-assign` | ✅ | `duty.assign` | Bulk assign duties with conflict detection |
| `POST` | `/duties/roster/publish-week` | ✅ | `duty.publish` | Publish all DRAFT duties for a week |

### `GET /api/duties`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `date` | date | | Filter by exact date |
| `date_from` | date | | Start of date range |
| `date_to` | date | | End of date range |
| `shift` | string | | ShiftType filter |
| `status` | string | | DutyStatus filter |
| `driver_id` | UUID | | Filter by driver |
| `vehicle_id` | UUID | | Filter by vehicle |
| `route_id` | UUID | | Filter by route |
| `page` | int | `1` | |
| `page_size` | int | `20` | |

### `POST /api/duties/roster/bulk-assign`

**Request:**
```json
{
  "duties": [
    {
      "date": "2026-07-05",
      "shift": "MORNING",
      "start_time": "05:00",
      "end_time": "13:00",
      "driver_id": "uuid",
      "conductor_id": "uuid",
      "vehicle_id": "uuid",
      "route_id": "uuid"
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "created": 5,
  "conflicts": [
    {
      "duty": {...},
      "conflict_type": "DRIVER_ALREADY_ASSIGNED",
      "message": "Driver already has a duty on this date/shift"
    }
  ]
}
```

---

## 7. GPS & AVLS

**Prefix:** `/api/gps`
**Tag:** GPS & AVLS
**Permission:** `gps.view`

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `GET` | `/gps/live` | ✅ | `gps.view` | All active vehicle positions |
| `GET` | `/gps/vehicle/{id}` | ✅ | `gps.view` | Single vehicle current position |
| `GET` | `/gps/history/{vehicle_id}` | ✅ | `gps.view` | Historical GPS pings |
| `GET` | `/gps/analytics` | ✅ | `gps.view` | GPS analytics (avg speed, distance, alerts) |
| `WebSocket` | `/gps/ws?token=<jwt>` | ✅ (query) | | Real-time GPS stream |

### `GET /api/gps/history/{vehicle_id}`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `start_time` | datetime | 24h ago | Start of time range (ISO 8601) |
| `end_time` | datetime | now | End of time range |
| `limit` | int | `500` | Max pings to return |

> **Speed filter:** Pings with speed > 200 km/h (`MAX_PLAUSIBLE_SPEED_KMH`) are automatically excluded.

**Response:** `200 OK`
```json
{
  "vehicle_id": "uuid",
  "registration_no": "RRTS-001",
  "pings": [
    {
      "latitude": 28.5894,
      "longitude": 77.2556,
      "speed": 65.3,
      "heading": 45.0,
      "timestamp": "2026-07-05T06:00:00Z",
      "ignition_on": true
    }
  ],
  "total_count": 150,
  "distance_km": 42.7
}
```

### WebSocket: `ws://host:8000/api/gps/ws?token=<jwt>`

**Connection:** Authenticate via `token` query parameter.

**Incoming messages (server → client):**
```json
{
  "type": "gps_update",
  "vehicle_id": "uuid",
  "registration_no": "RRTS-001",
  "latitude": 28.6692,
  "longitude": 77.4380,
  "speed": 72.5,
  "heading": 45.0,
  "timestamp": "2026-07-05T10:30:00Z"
}
```

Broadcasts occur every 5 seconds (configurable via `GPS_SIMULATOR_INTERVAL_SECONDS`).

---

## 8. Incidents

**Prefix:** `/api/incidents`
**Tag:** Incidents
**Permission:** `incident.view` (read), `incident.create`, `incident.assign`, `incident.resolve`

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `GET` | `/incidents` | ✅ | `incident.view` | List incidents (paginated, filterable) |
| `POST` | `/incidents` | ✅ | `incident.create` | Create incident |
| `GET` | `/incidents/{id}` | ✅ | `incident.view` | Get incident with timeline events |
| `PUT` | `/incidents/{id}` | ✅ | `incident.assign` | Update incident |
| `DELETE` | `/incidents/{id}` | ✅ | `incident.assign` | Soft-delete incident |
| `POST` | `/incidents/{id}/acknowledge` | ✅ | `incident.assign` | Acknowledge incident |
| `POST` | `/incidents/{id}/assign` | ✅ | `incident.assign` | Assign handler |
| `POST` | `/incidents/{id}/start` | ✅ | `incident.assign` | Move to IN_PROGRESS |
| `POST` | `/incidents/{id}/resolve` | ✅ | `incident.resolve` | Resolve incident (notes required) |
| `POST` | `/incidents/{id}/close` | ✅ | `incident.resolve` | Close resolved incident |
| `POST` | `/incidents/{id}/events` | ✅ | `incident.assign` | Add timeline event |
| `POST` | `/incidents/panic` | ✅ | `incident.create` | Emergency panic button |
| `GET` | `/incidents/stats/summary` | ✅ | `incident.view` | Incident statistics summary |

### `GET /api/incidents`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `search` | string | | Search in incident_no, title |
| `status` | string | | Filter by IncidentStatus |
| `severity` | string | | Filter by IncidentSeverity |
| `incident_type` | string | | Filter by IncidentType |
| `vehicle_id` | UUID | | Filter by vehicle |
| `sla_breached` | boolean | | Filter SLA-breached incidents |
| `date_from` | date | | Start date |
| `date_to` | date | | End date |
| `page` | int | `1` | |
| `page_size` | int | `20` | |

### `POST /api/incidents/panic`

Emergency incident creation with automatic P1 severity.

**Request:**
```json
{
  "title": "Emergency brake failure",
  "description": "Complete brake system failure on approach to Ghaziabad",
  "vehicle_id": "uuid",
  "latitude": 28.6692,
  "longitude": 77.4380
}
```

**Response:** Creates a `P1`/`OPEN` incident and returns the full incident object.

### State Transitions

```
POST /{id}/acknowledge  →  OPEN → ACKNOWLEDGED
POST /{id}/assign       →  ACKNOWLEDGED → ASSIGNED
POST /{id}/start        →  ACKNOWLEDGED/ASSIGNED → IN_PROGRESS
POST /{id}/resolve      →  IN_PROGRESS → RESOLVED  (requires resolution_notes)
POST /{id}/close        →  RESOLVED → CLOSED
```

---

## 9. Notices & CMS

**Prefix:** `/api/notices`
**Tag:** Notices & CMS
**Permission:** `notice.view` (read), `notice.publish` (write)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `GET` | `/notices` | ✅ | `notice.view` | List notices (paginated) |
| `POST` | `/notices` | ✅ | `notice.publish` | Create notice |
| `GET` | `/notices/{id}` | ✅ | `notice.view` | Get notice with read stats |
| `PUT` | `/notices/{id}` | ✅ | `notice.publish` | Update notice |
| `DELETE` | `/notices/{id}` | ✅ | `notice.publish` | Soft-delete notice |
| `POST` | `/notices/{id}/publish` | ✅ | `notice.publish` | Publish notice (sends notifications to targets) |
| `POST` | `/notices/{id}/read` | ✅ | `notice.view` | Mark notice as read |
| `POST` | `/notices/{id}/acknowledge` | ✅ | `notice.view` | Acknowledge notice |
| `GET` | `/notices/{id}/reads` | ✅ | `notice.publish` | Get read/acknowledge stats |

### Notice Targeting

```json
{
  "title": "Safety Briefing Required",
  "content": "All drivers must attend...",
  "content_type": "markdown",
  "priority": "HIGH",
  "target_type": "ROLE",
  "target_roles": ["DRIVER", "CONDUCTOR"]
}
```

| `target_type` | Additional fields | Description |
|--------------|------------------|-------------|
| `ALL` | *(none)* | All users |
| `ROLE` | `target_roles: string[]` | Users with specified roles |
| `DEPOT` | `target_depot_ids: UUID[]` | Users at specified depots |
| `USER` | `target_user_ids: UUID[]` | Specific individual users |

---

## 10. Notifications

**Prefix:** `/api/notifications`
**Tag:** Notifications

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `GET` | `/notifications` | ✅ | *(own)* | List user's notifications |
| `GET` | `/notifications/unread-count` | ✅ | *(own)* | Get unread notification count |
| `POST` | `/notifications/{id}/read` | ✅ | *(own)* | Mark single notification as read |
| `POST` | `/notifications/mark-all-read` | ✅ | *(own)* | Mark all as read |
| `WebSocket` | `/notifications/ws?token=<jwt>` | ✅ (query) | | Real-time notification stream |

### `GET /api/notifications`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `is_read` | boolean | | Filter by read status |
| `notification_type` | string | | Filter by NotificationType |
| `page` | int | `1` | |
| `page_size` | int | `20` | |

### WebSocket: `ws://host:8000/api/notifications/ws?token=<jwt>`

**Server → Client events:**
```json
{
  "type": "notification",
  "data": {
    "id": "uuid",
    "notification_type": "INCIDENT_ASSIGNED",
    "title": "Incident assigned to you",
    "message": "INC-20260705-001 has been assigned...",
    "link": "/incidents",
    "created_at": "2026-07-05T10:30:00Z"
  }
}
```

**Client → Server:** Send `ping` text frames; server responds with `pong`.

---

## 11. Analytics

**Prefix:** `/api/analytics`
**Tag:** Analytics
**Permission:** `analytics.view`

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `GET` | `/analytics/dashboard` | ✅ | `analytics.view` | Executive dashboard KPIs |
| `GET` | `/analytics/fleet-utilization` | ✅ | `analytics.view` | Fleet utilization metrics |
| `GET` | `/analytics/incident-analytics` | ✅ | `analytics.view` | Incident analysis metrics |
| `GET` | `/analytics/driver-performance` | ✅ | `analytics.view` | Driver performance rankings |
| `GET` | `/analytics/depot-analytics` | ✅ | `analytics.view` | Per-depot analytics |
| `GET` | `/analytics/weekly-trend` | ✅ | `analytics.view` | Weekly trend data (7 days) |

### `GET /api/analytics/dashboard`

**Response:** `200 OK`
```json
{
  "total_vehicles": 50,
  "active_vehicles": 35,
  "maintenance_vehicles": 8,
  "breakdown_vehicles": 3,
  "total_users": 101,
  "total_routes": 15,
  "total_depots": 5,
  "todays_duties": 20,
  "duties_completed": 12,
  "open_incidents": 15,
  "critical_incidents": 3,
  "sla_compliance_percent": 82.5,
  "utilization_percent": 70.0,
  "avg_health_score": 78.3,
  "unread_notices": 5,
  "pending_leaves": 8
}
```

### `GET /api/analytics/driver-performance`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | int | `30` | Analysis period (days) |
| `depot_id` | UUID | | Filter by depot |
| `limit` | int | `20` | Max results |

**Response:** Ranked list of drivers with duty completion, compliance, safety, and overall scores.

---

## 12. Reports

**Prefix:** `/api/reports`
**Tag:** Reports
**Permission:** `report.view` (list), `report.generate` (create)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `GET` | `/reports` | ✅ | `report.view` | List generated reports |
| `POST` | `/reports/generate` | ✅ | `report.generate` | Generate a report |
| `GET` | `/reports/{id}` | ✅ | `report.view` | Get report metadata |
| `GET` | `/reports/{id}/download` | ✅ | `report.view` | Download report file |
| `DELETE` | `/reports/{id}` | ✅ | `report.generate` | Delete report |

### `POST /api/reports/generate`

**Request:**
```json
{
  "report_type": "DAILY_FLEET",
  "report_format": "PDF",
  "title": "Fleet Status Report",
  "parameters": {
    "depot_id": "uuid",
    "date_from": "2026-07-01",
    "date_to": "2026-07-05"
  }
}
```

**Supported report types:**

| Type | Formats | Content |
|------|---------|---------|
| `DAILY_FLEET` | PDF, CSV | Vehicle inventory with health status and KPIs |
| `INCIDENT` | PDF, CSV | Incident analysis with severity/SLA metrics |
| `DRIVER` | PDF, CSV | Driver performance rankings |
| `EXECUTIVE` | PDF | Executive summary with all KPIs |
| `DEPOT` | CSV | Per-depot analytics |
| `UTILIZATION` | CSV | Fleet utilization metrics |

---

## 13. Audit

**Prefix:** `/api/audit`
**Tag:** Audit
**Permission:** `audit.view`

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `GET` | `/audit` | ✅ | `audit.view` | List audit log entries |
| `GET` | `/audit/timeline` | ✅ | `audit.view` | Activity timeline |

### `GET /api/audit`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `user_id` | UUID | | Filter by actor |
| `action` | string | | Filter by action type |
| `resource_type` | string | | Filter by entity type |
| `date_from` | datetime | | Start date |
| `date_to` | datetime | | End date |
| `page` | int | `1` | |
| `page_size` | int | `50` | |

---

## 14. Search

**Prefix:** `/api/search`
**Tag:** Search

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `GET` | `/search` | ✅ | *(authenticated)* | Global search across all entities |

### `GET /api/search`

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | ✅ | Search query (min 2 chars) |
| `type` | string | | Entity type filter: `vehicle`, `user`, `route`, `incident`, `notice` |
| `limit` | int | | Max results per entity type (default: 5) |

**Response:** `200 OK`
```json
{
  "results": {
    "vehicles": [{"id": "uuid", "registration_no": "RRTS-001", "type": "vehicle", ...}],
    "users": [{"id": "uuid", "name": "Rajesh Sharma", "type": "user", ...}],
    "routes": [...],
    "incidents": [...],
    "notices": [...]
  },
  "total_count": 12,
  "query": "RRTS"
}
```

---

## 15. AI Copilot

**Prefix:** `/api/copilot`
**Tag:** AI Copilot
**Permission:** `copilot.use`

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `POST` | `/copilot/chat` | ✅ | `copilot.use` | Send message to AI copilot |
| `GET` | `/copilot/tools` | ✅ | `copilot.use` | List available tools for user's role |

### `POST /api/copilot/chat`

**Request:**
```json
{
  "message": "Show fleet status",
  "conversation_id": "optional-uuid"
}
```

**Response:** `200 OK`
```json
{
  "message": "Here's the current fleet overview...",
  "tool_used": "fleet_overview",
  "data": {
    "total_vehicles": 50,
    "active": 35,
    "maintenance": 8,
    "utilization_percent": 70.0
  },
  "suggestions": [
    "Show incident summary",
    "Check vehicle RRTS-001",
    "Show driver performance"
  ]
}
```

> **Note:** Currently operates in `demo` mode (pattern matching against query text). All queries are logged to the audit trail.

---

## 16. Geofence & Route Deviation

**Prefix:** `/api/geo`
**Tag:** Geofence & Route Deviation
**Permission:** `geofence.view`

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `GET` | `/geo/check/{vehicle_id}` | ✅ | `geofence.view` | Check if vehicle is within depot geofence |
| `GET` | `/geo/status` | ✅ | `geofence.view` | Geofence status for all active vehicles |
| `GET` | `/geo/route-deviation/{vehicle_id}` | ✅ | `geofence.view` | Check vehicle for route deviation |
| `GET` | `/geo/route-deviation/summary` | ✅ | `geofence.view` | Route deviation summary for all vehicles |

### `GET /api/geo/check/{vehicle_id}`

**Response:** `200 OK`
```json
{
  "vehicle_id": "uuid",
  "registration_no": "RRTS-001",
  "in_geofence": true,
  "depot_name": "Ghaziabad Depot",
  "distance_from_depot_m": 234.5,
  "geofence_radius_m": 600.0
}
```

### `GET /api/geo/route-deviation/{vehicle_id}`

Calculates minimum distance from vehicle's last known position to all segments of the vehicle's assigned route.

**Response:** `200 OK`
```json
{
  "vehicle_id": "uuid",
  "registration_no": "RRTS-001",
  "is_deviating": true,
  "deviation_distance_km": 2.3,
  "threshold_km": 0.5,
  "route_name": "Delhi-Meerut Express",
  "last_latitude": 28.75,
  "last_longitude": 77.52
}
```

> **Auto-incident:** When deviation is detected and exceeds the threshold, a `ROUTE_DEVIATION` incident is automatically created with severity `P2`.

---

## 17. Leave Management

**Prefix:** `/api/leaves`
**Tag:** Leave Management

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `GET` | `/leaves` | ✅ | *(own/manage)* | List leave requests |
| `POST` | `/leaves` | ✅ | *(authenticated)* | Submit leave request |
| `GET` | `/leaves/{id}` | ✅ | *(own/manage)* | Get leave request details |
| `POST` | `/leaves/{id}/approve` | ✅ | `leave.approve` | Approve leave request |
| `POST` | `/leaves/{id}/reject` | ✅ | `leave.approve` | Reject leave request |
| `POST` | `/leaves/{id}/cancel` | ✅ | *(own)* | Cancel own leave request |

### `POST /api/leaves`

**Request:**
```json
{
  "start_date": "2026-07-10",
  "end_date": "2026-07-12",
  "reason": "Family function",
  "leave_type": "casual"
}
```

Leave types: `casual`, `sick`, `emergency`, `planned`

### `POST /api/leaves/{id}/reject`

**Request:**
```json
{
  "rejection_reason": "Insufficient staff coverage on requested dates"
}
```

---

## 18. File Uploads

**Prefix:** `/api/uploads`
**Tag:** File Uploads

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| `POST` | `/uploads/{category}` | ✅ | *(authenticated)* | Upload file |
| `GET` | `/uploads/{category}/{filename}` | ✅ | *(authenticated)* | Download file |
| `DELETE` | `/uploads/{category}/{filename}` | ✅ | *(owner/admin)* | Delete file |
| `GET` | `/uploads/{category}` | ✅ | *(authenticated)* | List files in category |

### Categories

| Category | Upload directory | Use case |
|----------|-----------------|----------|
| `incidents` | `uploads/incidents/` | Incident evidence photos |
| `notices` | `uploads/notices/` | Notice attachments |
| `profiles` | `uploads/profiles/` | User avatar photos |
| `reports` | `uploads/reports/` | Generated report files |

### `POST /api/uploads/{category}`

**Content-Type:** `multipart/form-data`

**Constraints:**
- Max file size: 10 MB (configurable via `UPLOAD_MAX_SIZE_MB`)
- Allowed MIME types: `image/jpeg`, `image/png`, `application/pdf`
- Allowed extensions: `.jpg`, `.jpeg`, `.png`, `.pdf`

**Response:** `200 OK`
```json
{
  "filename": "a1b2c3d4_photo.jpg",
  "url": "/api/uploads/incidents/a1b2c3d4_photo.jpg",
  "category": "incidents",
  "size_bytes": 245760,
  "content_type": "image/jpeg"
}
```

---

## 19. System

**Tag:** System
**No prefix** (defined in `main.py`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health` | ❌ | Basic health check |
| `GET` | `/api/system/health` | ❌ | Full system diagnostics |

### `GET /api/health`

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "development"
}
```

### `GET /api/system/health`

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "development",
  "system": {
    "cpu_percent": 12.5,
    "memory_total_gb": 16.0,
    "memory_used_gb": 8.3,
    "memory_percent": 51.9,
    "disk_total_gb": 512.0,
    "disk_used_gb": 234.5,
    "disk_percent": 45.8,
    "uptime_hours": 720.5
  },
  "services": {
    "database": "connected",
    "websocket": "active (3 connections)",
    "gps_simulator": "running"
  }
}
```

---

## Error Responses

All errors follow a consistent structure:

```json
{
  "detail": "Error message",
  "error_code": "ERROR_CODE"
}
```

| HTTP Status | Error Code | Exception Class | Description |
|-------------|-----------|----------------|-------------|
| `400` | `BAD_REQUEST` | `BadRequestException` | Invalid request data |
| `401` | `UNAUTHORIZED` | `UnauthorizedException` | Missing/invalid JWT |
| `403` | `FORBIDDEN` | `ForbiddenException` | Insufficient permissions |
| `404` | `NOT_FOUND` | `NotFoundException` | Resource not found |
| `409` | `CONFLICT` | `ConflictException` | Duplicate resource |
| `422` | `VALIDATION_ERROR` | `ValidationException` | Field-level validation errors |
| `429` | `RATE_LIMIT_EXCEEDED` | `RateLimitException` | Rate limit exceeded |
| `500` | `INTERNAL_ERROR` | `AppException` | Server error |

---

## Pagination

Paginated endpoints return:

```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "page_size": 20,
  "total_pages": 8
}
```

Standard query parameters: `page` (1-indexed), `page_size` (default: 20).

---

## Rate Limiting

Default: **60 requests per minute** per client (configurable via `RATE_LIMIT_PER_MINUTE`).

Returns `429 Too Many Requests` when exceeded.
