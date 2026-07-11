# 🎬 NCRTC Fleet Management Platform — Demo Script

This document provides a step-by-step walkthrough to demonstrate every major feature of the platform. Follow the sequence below for a smooth 15–20 minute demo.

---

## Prerequisites

```bash
docker compose up --build -d
# Wait ~30s for seed + GPS simulator to start
# Open http://localhost
```

---

## 1. Login & Role-Based Access (2 min)

1. **Login as Admin:** `admin@ncrtc.in` / `pass@123`
2. Point out the **sidebar navigation** — all 15 modules visible
3. Show the **user avatar badge** in the top-right with role label
4. **Logout** (click avatar → Logout)
5. **Login as Driver:** `driver@ncrtc.in` / `pass@123`
6. Note the **restricted sidebar** — only Dashboard, Incidents (own), Duties (own), Notices
7. Logout, re-login as Admin for the rest of the demo

---

## 2. Executive Dashboard (2 min)

1. Navigate to **Dashboard** (`/dashboard`)
2. Walk through KPI cards: Total Vehicles, Active Fleet, Open Incidents, SLA Compliance
3. Point out the **charts** — fleet utilization, incident trends
4. Note: data is live — numbers reflect current seed state

---

## 3. AVLS — Real-Time Fleet Map (3 min)

1. Navigate to **AVLS** (`/avls`)
2. Show the **live map** with vehicle markers moving in real-time
3. Point out the **status filter** (Active/Maintenance/Breakdown)
4. **Click a vehicle marker** → Side panel opens with:
   - Registration number, vehicle type, depot
   - Speed, heading, fuel level, health score
   - Ignition status, GPS coordinates
   - Route name (if assigned)
   - Last updated timestamp
5. Note the **WebSocket indicator** showing connection status

---

## 4. GPS History Replay (1 min)

1. Navigate to **AVLS → History** (`/avls/history`)
2. Select a vehicle and date range
3. Show the **route polyline** rendered on the map
4. Point out speed/stop data in the timeline

---

## 5. Vehicle Fleet Management (2 min)

1. Navigate to **Vehicles** (`/vehicles`)
2. Show the **grid layout** with status badges and health scores
3. **Add a vehicle** (click "Add Vehicle")
4. **Search** by registration number
5. **Filter** by status (Active/Maintenance/Breakdown)
6. **Click a vehicle card** → show detail view

---

## 6. Route Network (2 min)

1. Navigate to **Routes** (`/routes`)
2. Show the **route cards** with stop counts and distance
3. **Click a route** to see ordered stops
4. **Create a new route** with the "Add Route" button
5. Point out: routes are depot-scoped for Depot Managers

---

## 7. Incident Management (3 min)

1. Navigate to **Incidents** (`/incidents`)
2. Show the **severity filters** (P1 Critical → P4 Low)
3. **Click an incident** → Detail drawer opens
4. Walk through the **timeline** showing state transitions
5. **Demonstrate lifecycle:** Acknowledge → Start → Close (with mandatory notes)
6. Point out the **SLA badge** — shows time remaining or BREACHED
7. Show the **file upload** section in the incident drawer

---

## 8. Duty Scheduling & Roster (2 min)

1. Navigate to **Duties** (`/duties`)
2. Show the **date picker** and shift groups (Morning/Afternoon/Evening/Night)
3. Navigate to **Roster** (`/roster`)
4. Show the **weekly grid** with driver assignments
5. **Create a duty** — demonstrate the conflict detection (409 error if double-booked)

---

## 9. Notice Board (CMS) (1 min)

1. Navigate to **Notices** (`/notices`)
2. Show **Published/Draft tabs**
3. **Click a notice** → show read-receipt roster (who read it, when)
4. **Create a notice** with targeting (ALL/ROLE/DEPOT/USER)

---

## 10. Analytics & Reports (1 min)

1. Navigate to **Analytics** (`/analytics`)
2. Show fleet utilization, incident analytics, driver performance
3. Navigate to **Reports** (`/reports`)
4. Generate a sample PDF/CSV report

---

## 11. System Health (Admin Only) (1 min)

1. Navigate to **System Health** (`/system-health`)
2. Show: Database status, CPU/Memory/Disk, WebSocket connections, GPS Simulator status
3. Point out: this is live system telemetry via `psutil`

---

## Key Technical Highlights to Call Out

- **PostGIS geofencing:** Depot polygons with `ST_Contains` spatial queries
- **60s SLA sweeper:** Background async task that auto-marks breached incidents
- **WebSocket real-time:** GPS positions + notifications push to all connected clients
- **Depot RBAC scoping:** Depot managers only see their own depot's data at the query level
- **JTI token denylist:** Logout actually invalidates the JWT
- **Error envelope:** All errors return `{error: {code, message, request_id, timestamp}}`
- **18 backend routers, 15 frontend pages** — fully wired end-to-end
