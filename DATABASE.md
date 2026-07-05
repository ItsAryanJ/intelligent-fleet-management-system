# Database Schema — NCRTC Fleet Management Platform

Complete database schema documentation generated from [`backend/app/models.py`](backend/app/models.py).

**Engine:** PostgreSQL 16 + PostGIS 3.4
**ORM:** SQLAlchemy 2.0 (Async) + GeoAlchemy2
**Driver:** asyncpg

---

## Base Model

All tables inherit from a shared `BaseModel` mixin providing:

| Column | Type | Description |
|--------|------|-------------|
| `id` | `UUID` (PK) | Auto-generated `uuid4()` |
| `created_at` | `DateTime(tz)` | Row creation timestamp (UTC) |
| `updated_at` | `DateTime(tz)` | Last update timestamp (UTC, auto) |
| `created_by` | `String(100)` | User ID who created the record |
| `updated_by` | `String(100)` | User ID who last updated |
| `is_deleted` | `Boolean` | Soft-delete flag (default: `false`) |

---

## Enums

13 PostgreSQL-backed enums:

| Enum | Values |
|------|--------|
| `VehicleType` | `BUS`, `TRAIN`, `METRO`, `TRAM` |
| `VehicleStatus` | `ACTIVE`, `INACTIVE`, `MAINTENANCE`, `BREAKDOWN` |
| `VehicleHealth` (enum) | *(see MaintenanceStatus)* |
| `MaintenanceStatus` | `UP_TO_DATE`, `DUE_SOON`, `OVERDUE`, `IN_PROGRESS` |
| `IncidentType` | `BREAKDOWN`, `ACCIDENT`, `SECURITY`, `COMPLAINT`, `ROUTE_DEVIATION`, `OTHER` |
| `IncidentSeverity` | `P1`, `P2`, `P3` |
| `IncidentStatus` | `OPEN`, `ACKNOWLEDGED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` |
| `DutyStatus` | `DRAFT`, `PUBLISHED`, `ACKNOWLEDGED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `ShiftType` | `MORNING`, `AFTERNOON`, `EVENING`, `NIGHT`, `SPLIT` |
| `NotificationType` | `DUTY_PUBLISHED`, `INCIDENT_ASSIGNED`, `NOTICE_PUBLISHED`, `LEAVE_STATUS`, `SYSTEM`, `GEOFENCE_BREACH`, `ROUTE_DEVIATION` |
| `LeaveStatus` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `ReportType` | `DAILY_FLEET`, `INCIDENT`, `DRIVER`, `EXECUTIVE`, `DEPOT`, `UTILIZATION` |
| `ReportFormat` | `PDF`, `CSV`, `EXCEL` |
| `NoticePriority` | `LOW`, `NORMAL`, `HIGH`, `URGENT` |
| `NoticeTargetType` | `ALL`, `ROLE`, `DEPOT`, `USER` |
| `StopType` | `REGULAR`, `TERMINAL`, `DEPOT` |

---

## Tables

### `roles`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `name` | String(50) | UNIQUE, NOT NULL | Role name (e.g., `ADMIN`) |
| `description` | String(255) | | Human-readable description |
| `is_active` | Boolean | Default: `true` | Active flag |
| *base fields* | | | `created_at`, `updated_at`, etc. |

**Relationships:** `users` (one-to-many)

---

### `depots`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `name` | String(255) | NOT NULL | Depot name |
| `code` | String(50) | UNIQUE, NOT NULL | Short code (e.g., `SKK`) |
| `address` | String(500) | | Street address |
| `city` | String(100) | Default: `NCR` | City |
| `state` | String(100) | Default: `Delhi NCR` | State |
| `latitude` | Float | NOT NULL | Geofence center lat |
| `longitude` | Float | NOT NULL | Geofence center lng |
| `geofence_radius_m` | Float | Default: `500.0` | Geofence radius in meters |
| `capacity` | Integer | Default: `50` | Max vehicle capacity |
| `contact_phone` | String(20) | | Contact phone |
| `contact_email` | String(255) | | Contact email |

**Relationships:** `users`, `vehicles`, `routes` (one-to-many)

---

### `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `email` | String(255) | UNIQUE, NOT NULL, indexed | Login email |
| `password_hash` | String(255) | NOT NULL | bcrypt hash |
| `first_name` | String(100) | NOT NULL | |
| `last_name` | String(100) | NOT NULL | |
| `employee_id` | String(50) | UNIQUE, NOT NULL | Employee ID (e.g., `NCRTC-0001`) |
| `phone` | String(20) | | Phone number |
| `avatar_url` | String(500) | | Profile picture URL |
| `role_id` | UUID | FK → `roles.id`, NOT NULL | Assigned role |
| `depot_id` | UUID | FK → `depots.id` | Assigned depot (nullable) |
| `is_active` | Boolean | Default: `true` | Active flag |
| `last_login` | DateTime(tz) | | Last login timestamp |

**Relationships:** `role`, `depot`, `duties_as_driver`, `duties_as_conductor`, `incidents_reported`, `notifications`, `leave_requests`

**Hybrid property:** `full_name` → `"{first_name} {last_name}"`

---

### `vehicles`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `registration_no` | String(50) | UNIQUE, NOT NULL | Vehicle registration (e.g., `RRTS-001`) |
| `vehicle_type` | Enum(`VehicleType`) | NOT NULL | BUS/TRAIN/METRO/TRAM |
| `make` | String(100) | | Manufacturer (ALSTOM, Bombardier, CAF) |
| `model` | String(100) | | Model designation |
| `year` | Integer | | Manufacturing year |
| `status` | Enum(`VehicleStatus`) | Default: `ACTIVE` | Operational status |
| `depot_id` | UUID | FK → `depots.id` | Assigned depot |
| `capacity` | Integer | Default: `40` | Passenger capacity |
| `color` | String(50) | | Vehicle color |
| `chassis_no` | String(100) | | Chassis number |
| `engine_no` | String(100) | | Engine number |
| `insurance_expiry` | Date | | Insurance expiration |
| `fitness_expiry` | Date | | Fitness certificate expiration |
| `last_latitude` | Float | | Last known GPS latitude |
| `last_longitude` | Float | | Last known GPS longitude |
| `last_speed` | Float | Default: `0` | Last known speed (km/h) |
| `last_heading` | Float | Default: `0` | Last known heading (0-360°) |
| `last_gps_time` | DateTime(tz) | | Last GPS ping timestamp |
| `ignition_on` | Boolean | Default: `false` | Ignition status |

**Relationships:** `depot`, `health` (one-to-one), `gps_pings`, `duties`, `incidents`

---

### `vehicle_health`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `vehicle_id` | UUID | FK → `vehicles.id`, UNIQUE | One-to-one with vehicle |
| `fuel_level` | Float | Default: `100.0` | Fuel level (%) |
| `odometer` | Float | Default: `0.0` | Total distance (km) |
| `engine_hours` | Float | Default: `0.0` | Total engine hours |
| `last_service_date` | Date | | Last maintenance date |
| `next_service_date` | Date | | Next scheduled maintenance |
| `maintenance_status` | Enum(`MaintenanceStatus`) | Default: `UP_TO_DATE` | |
| `health_score` | Float | Default: `100.0` | Overall health score (0-100) |
| `tire_pressure_ok` | Boolean | Default: `true` | |
| `engine_temp_ok` | Boolean | Default: `true` | |
| `battery_voltage` | Float | Default: `12.6` | Battery voltage |
| `brake_status_ok` | Boolean | Default: `true` | |

---

### `gps_pings`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `vehicle_id` | UUID | FK → `vehicles.id`, indexed | Source vehicle |
| `latitude` | Float | NOT NULL | GPS latitude |
| `longitude` | Float | NOT NULL | GPS longitude |
| `speed` | Float | Default: `0` | Speed (km/h) |
| `heading` | Float | Default: `0` | Heading (degrees) |
| `ignition_on` | Boolean | Default: `true` | Ignition state at ping time |
| `timestamp` | DateTime(tz) | NOT NULL, indexed | Ping timestamp |

> **Volume:** GPS pings accumulate rapidly (~12,750 seeded, continuous growth from simulator). Index on `(vehicle_id, timestamp)` is critical.

---

### `routes`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `name` | String(255) | NOT NULL | Route name |
| `code` | String(50) | UNIQUE, NOT NULL | Route code (e.g., `RRTS-01`) |
| `description` | Text | | Route description |
| `depot_id` | UUID | FK → `depots.id` | Operating depot |
| `distance_km` | Float | Default: `0.0` | Total route distance |
| `estimated_duration_mins` | Integer | Default: `60` | Estimated journey time |
| `frequency_mins` | Integer | Default: `15` | Service frequency |
| `color` | String(10) | Default: `#3B82F6` | Map display color (hex) |
| `is_active` | Boolean | Default: `true` | Route is operational |
| `is_circular` | Boolean | Default: `false` | Circular route flag |

**Relationships:** `depot`, `route_stops`, `stops` (via `route_stops`), `duties`

---

### `stops`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `name` | String(255) | NOT NULL | Station name |
| `code` | String(50) | UNIQUE, NOT NULL | Station code |
| `latitude` | Float | NOT NULL | GPS latitude |
| `longitude` | Float | NOT NULL | GPS longitude |
| `stop_type` | Enum(`StopType`) | Default: `REGULAR` | REGULAR/TERMINAL/DEPOT |
| `address` | String(500) | | Address |
| `is_active` | Boolean | Default: `true` | Active flag |

---

### `route_stops` (junction table)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `route_id` | UUID | FK → `routes.id` | |
| `stop_id` | UUID | FK → `stops.id` | |
| `sequence` | Integer | NOT NULL | Stop order (1-indexed) |
| `distance_from_start_km` | Float | Default: `0.0` | Cumulative distance |
| `scheduled_arrival_offset_mins` | Integer | Default: `0` | Minutes from route start |
| `scheduled_departure_offset_mins` | Integer | Default: `0` | Departure offset |
| `is_timing_point` | Boolean | Default: `false` | Mandatory stop |

---

### `duties`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `date` | Date | NOT NULL | Duty date |
| `shift` | Enum(`ShiftType`) | NOT NULL | MORNING/AFTERNOON/EVENING/NIGHT/SPLIT |
| `status` | Enum(`DutyStatus`) | Default: `DRAFT` | Lifecycle status |
| `start_time` | Time | | Shift start time |
| `end_time` | Time | | Shift end time |
| `vehicle_id` | UUID | FK → `vehicles.id` | Assigned vehicle |
| `driver_id` | UUID | FK → `users.id` | Assigned driver |
| `conductor_id` | UUID | FK → `users.id` | Assigned conductor |
| `route_id` | UUID | FK → `routes.id` | Assigned route |
| `remarks` | Text | | Notes |
| `acknowledged_at` | DateTime(tz) | | When duty was acknowledged |

**Relationships:** `vehicle`, `driver`, `conductor`, `route`

---

### `incidents`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `incident_no` | String(50) | UNIQUE, NOT NULL | Formatted ID (e.g., `INC-20260705-A1B2C3`) |
| `incident_type` | Enum(`IncidentType`) | NOT NULL | Category |
| `severity` | Enum(`IncidentSeverity`) | Default: `P3` | P1/P2/P3 |
| `status` | Enum(`IncidentStatus`) | Default: `OPEN` | Lifecycle state |
| `title` | String(500) | NOT NULL | Short description |
| `description` | Text | | Detailed description |
| `vehicle_id` | UUID | FK → `vehicles.id` | Related vehicle |
| `route_id` | UUID | FK → `routes.id` | Related route (for deviations) |
| `reported_by` | UUID | FK → `users.id` | Reporting user |
| `assigned_to` | UUID | FK → `users.id` | Assigned handler |
| `latitude` | Float | | Incident GPS lat |
| `longitude` | Float | | Incident GPS lng |
| `location_description` | String(500) | | Textual location |
| `sla_deadline` | DateTime(tz) | | SLA expiration timestamp |
| `sla_breached` | Boolean | Default: `false` | SLA was breached |
| `acknowledged_at` | DateTime(tz) | | When acknowledged |
| `resolved_at` | DateTime(tz) | | When resolved |
| `closed_at` | DateTime(tz) | | When closed |
| `resolution_notes` | Text | | Resolution description |

**Relationships:** `vehicle`, `reported_by_user`, `assigned_to_user`, `events`

---

### `incident_events` (timeline)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `incident_id` | UUID | FK → `incidents.id` | Parent incident |
| `event_type` | String(50) | NOT NULL | `created`, `acknowledged`, `assigned`, `in_progress`, `resolved`, `closed` |
| `description` | Text | | Event description |
| `created_by` | UUID | FK → `users.id` | User who triggered event |
| `created_at` | DateTime(tz) | | Event timestamp |

---

### `notices`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `title` | String(500) | NOT NULL | Notice title |
| `content` | Text | NOT NULL | Notice body |
| `content_type` | String(20) | Default: `markdown` | Content format |
| `summary` | String(500) | | Short summary |
| `priority` | Enum(`NoticePriority`) | Default: `NORMAL` | LOW/NORMAL/HIGH/URGENT |
| `target_type` | Enum(`NoticeTargetType`) | Default: `ALL` | ALL/ROLE/DEPOT/USER |
| `target_roles` | JSON | | List of role names (when type=ROLE) |
| `target_depot_ids` | JSON | | List of depot UUIDs (when type=DEPOT) |
| `target_user_ids` | JSON | | List of user UUIDs (when type=USER) |
| `is_published` | Boolean | Default: `false` | Published flag |
| `published_at` | DateTime(tz) | | Publication timestamp |
| `published_by` | UUID | FK → `users.id` | Publisher |
| `language` | String(10) | Default: `en` | Content language |

---

### `notice_reads`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `notice_id` | UUID | FK → `notices.id` | |
| `user_id` | UUID | FK → `users.id` | |
| `read_at` | DateTime(tz) | Default: `now()` | When read |
| `acknowledged_at` | DateTime(tz) | | When explicitly acknowledged |

---

### `notifications`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `users.id`, NOT NULL | Target user |
| `notification_type` | Enum(`NotificationType`) | NOT NULL | Event type |
| `title` | String(255) | NOT NULL | Notification title |
| `message` | Text | | Notification body |
| `link` | String(500) | | Frontend route to navigate |
| `is_read` | Boolean | Default: `false` | Read status |
| `read_at` | DateTime(tz) | | When marked read |

---

### `leave_requests`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `users.id`, NOT NULL | Requesting user |
| `start_date` | Date | NOT NULL | Leave start |
| `end_date` | Date | NOT NULL | Leave end |
| `reason` | Text | NOT NULL | Reason for leave |
| `leave_type` | String(50) | Default: `casual` | casual/sick/emergency/planned |
| `status` | Enum(`LeaveStatus`) | Default: `PENDING` | PENDING/APPROVED/REJECTED/CANCELLED |
| `approved_by` | UUID | FK → `users.id` | Approving manager |
| `approved_at` | DateTime(tz) | | Approval timestamp |
| `rejection_reason` | Text | | Reason for rejection |

---

### `reports`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `report_type` | Enum(`ReportType`) | NOT NULL | Report category |
| `report_format` | Enum(`ReportFormat`) | NOT NULL | PDF/CSV/EXCEL |
| `title` | String(255) | | Report title |
| `parameters` | JSON | | Generation parameters (dates, depot, etc.) |
| `generated_by` | UUID | FK → `users.id` | Requesting user |
| `generated_at` | DateTime(tz) | Default: `now()` | Generation timestamp |
| `status` | String(50) | Default: `pending` | `pending` / `completed` / `failed` |

---

### `audit_logs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `users.id` | Actor |
| `action` | String(100) | NOT NULL | Action performed (e.g., `LOGIN`, `CREATE`, `GEOFENCE_ALERT`) |
| `resource_type` | String(100) | | Entity type (e.g., `vehicle`, `copilot`, `file_upload`) |
| `resource_id` | String(255) | | Entity ID |
| `details` | JSON | | Additional context |
| `ip_address` | String(50) | | Client IP address |
| `created_at` | DateTime(tz) | | Event timestamp |

> **Note:** The uploads system uses `audit_logs` with `action='FILE_UPLOAD'` as its metadata store rather than a dedicated files table.
