# NCRTC Fleet Management — API Documentation

> Base URL: `http://localhost:8000/api`  
> Auth: All endpoints (except `/auth/login`, `/health`) require a `Bearer <token>` header.  
> Interactive Docs: [Swagger UI](http://localhost:8000/docs) · [ReDoc](http://localhost:8000/redoc)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Vehicles](#3-vehicles)
4. [Routes & Stops](#4-routes--stops)
5. [Duties / Scheduling](#5-duties--scheduling)
6. [GPS & AVLS](#6-gps--avls)
7. [Incidents](#7-incidents)
8. [Notices (CMS)](#8-notices-cms)
9. [Notifications](#9-notifications)
10. [Leave Management](#10-leave-management)
11. [Analytics](#11-analytics)
12. [Reports](#12-reports)
13. [Audit Log](#13-audit-log)
14. [Search](#14-search)
15. [AI Copilot](#15-ai-copilot)
16. [Geofence & Route Deviation](#16-geofence--route-deviation)
17. [File Uploads](#17-file-uploads)
18. [Depots](#18-depots)
19. [System Health](#19-system-health)
20. [WebSocket](#20-websocket)

---

## 1. Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/auth/login` | Login with email and password | ❌ |
| `POST` | `/auth/refresh` | Refresh an expired access token | ✅ Refresh token |
| `GET` | `/auth/me` | Get current user profile | ✅ |

### `POST /auth/login`

**Request:**
```json
{
  "email": "admin@ncrtc.in",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbG...",
  "refresh_token": "eyJhbG...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "admin@ncrtc.in",
    "first_name": "System",
    "last_name": "Admin",
    "role": "ADMIN",
    "depot_id": "uuid",
    "permissions": ["vehicle.view", "vehicle.edit", ...]
  }
}
```

---

## 2. Users

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/users` | List users (paginated, filterable) | `user.view` |
| `GET` | `/users/{id}` | Get user by ID | `user.view` |
| `POST` | `/users` | Create a new user | `user.edit` |
| `PUT` | `/users/{id}` | Update a user | `user.edit` |
| `DELETE` | `/users/{id}` | Soft-delete a user | `user.edit` |

**Query Parameters (GET /users):**
- `page` (int, default: 1)
- `page_size` (int, default: 20, max: 50)
- `search` (string) — searches name, email, employee ID
- `role` (string) — filter by role name
- `depot_id` (UUID) — filter by depot

**RBAC:** DEPOT_MANAGERs only see users in their own depot.

---

## 3. Vehicles

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/vehicles` | List vehicles (paginated, filterable) | `vehicle.view` |
| `GET` | `/vehicles/{id}` | Get vehicle details with health | `vehicle.view` |
| `POST` | `/vehicles` | Register a new vehicle | `vehicle.edit` |
| `PUT` | `/vehicles/{id}` | Update vehicle details | `vehicle.edit` |

**Query Parameters (GET /vehicles):**
- `page`, `page_size` — pagination
- `search` — searches registration number
- `status` — `ACTIVE`, `MAINTENANCE`, `BREAKDOWN`, `RETIRED`
- `depot_id` — filter by depot
- `vehicle_type` — `BUS`, `MINIBUS`, `ELECTRIC_BUS`

**Response includes:** registration, make/model, GPS coordinates, speed, heading, fuel level, health score, depot info.

**RBAC:** DEPOT_MANAGERs only see vehicles assigned to their depot.

---

## 4. Routes & Stops

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/routes` | List all routes | Any authenticated |
| `GET` | `/routes/{id}` | Get route with ordered stops | Any authenticated |
| `POST` | `/routes` | Create a new route | `route.edit` |
| `PUT` | `/routes/{id}` | Update route details | `route.edit` |
| `GET` | `/routes/stops/list` | List all stops | Any authenticated |
| `POST` | `/routes/stops` | Create a new stop | `route.edit` |

**Query Parameters (GET /routes):**
- `depot_id` (UUID) — filter routes by depot
- `is_active` (bool) — filter by active status

**Route Response includes:** name, code, distance_km, estimated_duration_mins, frequency_mins, color, is_circular, stop_count, ordered stops with coordinates.

---

## 5. Duties / Scheduling

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/duties` | List duties (filterable by date, shift, depot) | `duty.view` |
| `GET` | `/duties/{id}` | Get duty details | `duty.view` |
| `POST` | `/duties` | Create a new duty assignment | `duty.edit` |
| `PUT` | `/duties/{id}` | Update duty details | `duty.edit` |

**Query Parameters (GET /duties):**
- `date` (YYYY-MM-DD) — filter by date (defaults to today)
- `shift` — `MORNING`, `AFTERNOON`, `EVENING`, `NIGHT`
- `depot_id` — filter by depot
- `driver_id`, `conductor_id` — filter by assigned personnel
- `status` — `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`

**RBAC:** DRIVER/CONDUCTOR see only their own duties. DEPOT_MANAGER sees depot-scoped duties.

---

## 6. GPS & AVLS

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/gps/live` | Get all vehicles' latest GPS positions | `gps.view` |
| `GET` | `/gps/latest` | Get latest GPS pings (all vehicles) | `gps.view` |
| `GET` | `/gps/vehicle/{id}/history` | Historical GPS trail for a vehicle | `gps.view` |
| `GET` | `/gps/vehicle/{id}/trips` | Trip analytics for a vehicle | `gps.view` |
| `WS` | `/ws/gps` | WebSocket for real-time GPS updates | JWT via query param |

**Query Parameters (GET /gps/vehicle/{id}/history):**
- `start` (ISO datetime) — start of time range
- `end` (ISO datetime) — end of time range
- `limit` (int, default: 500) — max pings to return

**WebSocket Message Format:**
```json
{
  "type": "gps_update",
  "vehicle_id": "uuid",
  "registration_no": "DL-01-XX-1234",
  "latitude": 28.7041,
  "longitude": 77.1025,
  "speed": 65.3,
  "heading": 145.2,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 7. Incidents

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/incidents` | List incidents (paginated, filterable) | `incident.view` |
| `GET` | `/incidents/{id}` | Get incident with timeline events | `incident.view` |
| `POST` | `/incidents` | Report a new incident | `incident.create` |
| `PUT` | `/incidents/{id}` | Update incident details | `incident.edit` |
| `POST` | `/incidents/{id}/assign` | Assign incident to a user | `incident.edit` |
| `POST` | `/incidents/{id}/resolve` | Resolve an incident | `incident.edit` |
| `POST` | `/incidents/panic` | Emergency panic button (creates P1) | `incident.create` |
| `GET` | `/incidents/{id}/events` | Get incident timeline events | `incident.view` |
| `GET` | `/incidents/sla-status` | SLA breach summary | `incident.view` |

**Query Parameters (GET /incidents):**
- `page`, `page_size` — pagination
- `severity` — `P1`, `P2`, `P3`
- `status` — `OPEN`, `ACKNOWLEDGED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`
- `incident_type` — `BREAKDOWN`, `ACCIDENT`, `SECURITY`, `ROUTE_DEVIATION`, `COMPLAINT`, `OTHER`

**SLA Deadlines:**
| Severity | Response Time |
|----------|--------------|
| P1 | 1 hour |
| P2 | 4 hours |
| P3 | 24 hours |

---

## 8. Notices (CMS)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/notices` | List all notices (admin view) | `notice.view` |
| `GET` | `/notices/feed` | Get notices targeted to current user | Any authenticated |
| `GET` | `/notices/{id}` | Get notice detail | `notice.view` |
| `POST` | `/notices` | Create a new notice (draft) | `notice.edit` |
| `POST` | `/notices/{id}/publish` | Publish a draft notice | `notice.edit` |
| `POST` | `/notices/{id}/read` | Mark notice as read | Any authenticated |
| `POST` | `/notices/{id}/acknowledge` | Acknowledge a notice | Any authenticated |

**Targeting:** Notices can target `ALL` users, specific `ROLE`s, specific `DEPOT`s, or individual `USER`s.

**Priority Levels:** `LOW`, `NORMAL`, `HIGH`, `URGENT`

---

## 9. Notifications

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/notifications` | List notifications for current user | Any authenticated |
| `GET` | `/notifications/unread-count` | Get unread notification count | Any authenticated |
| `POST` | `/notifications/{id}/read` | Mark a notification as read | Any authenticated |
| `POST` | `/notifications/read-all` | Mark all notifications as read | Any authenticated |
| `WS` | `/ws/notifications` | WebSocket for real-time notifications | JWT via query param |

**Notification Types:** `INCIDENT_ASSIGNED`, `INCIDENT_RESOLVED`, `LEAVE_STATUS`, `DUTY_ASSIGNED`, `SYSTEM`, `NOTICE_PUBLISHED`

---

## 10. Leave Management

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/leaves` | List leave requests | Any authenticated |
| `POST` | `/leaves` | Submit a leave request | Any authenticated |
| `POST` | `/leaves/{id}/approve` | Approve a leave request | `leave.approve` |
| `POST` | `/leaves/{id}/reject` | Reject a leave request | `leave.approve` |
| `POST` | `/leaves/{id}/cancel` | Cancel own leave request | Any authenticated |

**Request Body (POST /leaves):**
```json
{
  "start_date": "2024-02-01",
  "end_date": "2024-02-03",
  "reason": "Family function",
  "leave_type": "casual"
}
```

**Leave Types:** `casual`, `sick`, `emergency`, `planned`  
**Statuses:** `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`

**RBAC:** DRIVER/CONDUCTOR see only their own. DEPOT_MANAGER sees depot-scoped. ADMIN sees all. Notifications are sent on approve/reject.

---

## 11. Analytics

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/analytics/executive` | Executive dashboard KPIs | `analytics.view` |
| `GET` | `/analytics/fleet-utilization` | Fleet status breakdown | `analytics.view` |
| `GET` | `/analytics/incidents` | Incident analytics by type/severity/status | `analytics.view` |
| `GET` | `/analytics/driver-performance` | Driver ranking by score | `analytics.view` |
| `GET` | `/analytics/depot/{depot_id}` | Depot-specific analytics | `analytics.view` |
| `GET` | `/analytics/trend` | Daily operations trend | `analytics.view` |
| `GET` | `/analytics/dashboard` | Combined dashboard data | `analytics.view` |

**Driver Score Formula:** `overall_score = (compliance % × 0.6) + (safety_score × 0.4)`  
**Safety Score:** `100 - (incident_count × 5)`, minimum 0

**RBAC:** DEPOT_MANAGERs see only data from their depot. Executives cannot access other depots.

---

## 12. Reports

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/reports` | List previously generated reports | `report.view` |
| `POST` | `/reports/generate` | Generate and download a report | `report.generate` |

**Request Body (POST /reports/generate):**
```json
{
  "report_type": "DAILY_FLEET",
  "report_format": "PDF",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "depot_id": "uuid (optional)"
}
```

**Report Types:** `DAILY_FLEET`, `INCIDENT`, `DRIVER`, `EXECUTIVE`, `DEPOT`, `UTILIZATION`  
**Formats:** `CSV`, `PDF`

**Response:** File download (`Content-Disposition: attachment`) with appropriate MIME type.

**RBAC:** DEPOT_MANAGERs are forced to their own depot and cannot generate `EXECUTIVE` reports.

---

## 13. Audit Log

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/audit` | List audit log entries (paginated) | `audit.view` |

**Query Parameters:**
- `page`, `page_size` — pagination
- `action` — filter by action type (`CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `REJECT`, etc.)
- `resource_type` — filter by entity (`vehicle`, `incident`, `leave_request`, `copilot_query`, etc.)

---

## 14. Search

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/search?q=<query>` | Global cross-entity search | Any authenticated |

**Query Parameters:**
- `q` (string, 2-100 chars) — search term
- `limit` (int, default: 10, max: 50)

**Searches across:** Vehicles (registration no), Users (name, email, employee ID), Routes (name, code), Incidents (incident no, title), Notices (title).

**RBAC:** DEPOT_MANAGERs only see results from their depot.

**Response:**
```json
{
  "query": "RRTS",
  "total": 3,
  "results": [
    {
      "type": "route",
      "id": "uuid",
      "title": "RRTS-01 — Delhi-Meerut Express",
      "subtitle": "82.5 km",
      "link": "/routes/uuid"
    }
  ]
}
```

---

## 15. AI Copilot

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `POST` | `/copilot/chat` | Send a message to the AI copilot | `copilot.use` |
| `GET` | `/copilot/tools` | List available copilot tools for current role | `copilot.use` |
| `GET` | `/copilot/history` | Get copilot conversation history | `copilot.use` |
| `GET` | `/copilot/analytics` | Copilot usage analytics | `copilot.use` |

**Request Body (POST /copilot/chat):**
```json
{
  "message": "What is today's fleet status?"
}
```

**Response:**
```json
{
  "response": "Currently 42 out of 50 vehicles are active (84% utilization)...",
  "tools_used": ["fleet_status"],
  "suggestions": ["Show incident summary", "Driver rankings"]
}
```

**Rate Limit:** 30 requests per 60 seconds per user.  
**Security:** Prompts are sanitized (max 2000 chars, injection patterns stripped). Responses are redacted (passwords, secrets, tokens removed).

---

## 16. Geofence & Route Deviation

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/geo/geofence/check` | Check if a lat/lon is within any depot geofence | `geofence.view` |
| `GET` | `/geo/geofence/status` | Geofence status for all depots (vehicles inside/outside) | `geofence.view` |
| `GET` | `/geo/route-deviation/summary` | Route deviation summary for active vehicles | `geofence.view` |

**Query Parameters (GET /geo/geofence/check):**
- `latitude` (float)
- `longitude` (float)

**Geofence Check Response:**
```json
{
  "in_any_depot": true,
  "depot_name": "Anand Vihar Depot",
  "depot_id": "uuid",
  "distance_m": 125.3,
  "alert_type": null
}
```

---

## 17. File Uploads

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/uploads` | List uploaded files | Any authenticated |
| `POST` | `/uploads` | Upload a file | Any authenticated |

**Upload Constraints:**
- Max size: 10MB
- Allowed types: `image/jpeg`, `image/png`, `application/pdf`
- Allowed extensions: `.jpg`, `.jpeg`, `.png`, `.pdf`
- Categories: `incidents`, `notices`, `profiles`, `reports`

**Request:** `multipart/form-data` with `file` and `category` fields.

---

## 18. Depots

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/depots` | List all depots | Any authenticated |
| `GET` | `/depots/{id}` | Get depot details | Any authenticated |
| `POST` | `/depots` | Create a new depot | `depot.edit` |
| `PUT` | `/depots/{id}` | Update depot details | `depot.edit` |

**Depot fields:** name, code, city, address, latitude, longitude, geofence_radius_m.

---

## 19. System Health

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/health` | Basic health check (no auth) | ❌ |
| `GET` | `/system/health` | Detailed system metrics (CPU, memory, disk) | ✅ |

**System Health Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "system": {
    "cpu_percent": 23.5,
    "memory_total_gb": 16.0,
    "memory_used_gb": 8.2,
    "memory_percent": 51.3,
    "disk_total_gb": 500.0,
    "disk_used_gb": 120.5,
    "disk_percent": 24.1,
    "uptime_hours": 168.5
  },
  "services": {
    "database": "connected",
    "websocket": "active",
    "geofence_engine": "active"
  }
}
```

---

## 20. WebSocket

Two WebSocket endpoints are available for real-time updates:

| Endpoint | Description | Auth |
|----------|-------------|------|
| `ws://localhost:8000/ws/gps?token=<jwt>` | Real-time GPS vehicle positions | JWT via `token` query param |
| `ws://localhost:8000/ws/notifications?token=<jwt>` | Real-time user notifications | JWT via `token` query param |

**Connection flow:**
1. Authenticate via `POST /auth/login` to get a JWT
2. Connect to WebSocket with `?token=<access_token>`
3. Server validates the token and accepts/rejects the connection
4. Server pushes updates as JSON messages
5. Client should send periodic `ping` messages for keepalive

---

## Common Response Patterns

### Paginated Lists
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "page_size": 20
}
```

### Error Responses
```json
{
  "detail": "Vehicle not found"
}
```

| Status Code | Meaning |
|-------------|---------|
| `400` | Bad request / validation error |
| `401` | Unauthorized (missing or invalid token) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Resource not found |
| `409` | Conflict (duplicate resource) |
| `422` | Unprocessable entity (validation) |
| `500` | Internal server error |
