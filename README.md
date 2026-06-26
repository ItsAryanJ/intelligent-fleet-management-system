# NCRTC Intelligent Fleet Management Platform

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + TypeScript + Vite |
| **Styling** | Tailwind CSS 4 + Custom Design System |
| **State** | Zustand (auth) + TanStack Query (server) |
| **Charts** | Recharts |
| **Maps** | Leaflet + OpenStreetMap (free tiles) |
| **Animations** | Framer Motion |
| **Backend** | FastAPI (Python) + Async SQLAlchemy |
| **Database** | PostgreSQL 16 + PostGIS |
| **Auth** | JWT (access + refresh tokens) + bcrypt |
| **Infrastructure** | Docker Compose + Nginx |

## 📋 Modules

| # | Module | Description |
|---|--------|-------------|
| 1 | **Dashboard** | Executive KPIs, utilization charts, incident donut, AI insights |
| 2 | **AVLS** | Live fleet map with 30s auto-refresh, vehicle markers, detail sidebar |
| 3 | **Vehicles** | Fleet management with health bars, fuel, GPS status, card grid |
| 4 | **Routes** | Route network with color-coded cards, stops, frequency |
| 5 | **Duties** | Shift-grouped scheduling, date nav, bulk assign, conflict detection |
| 6 | **Incidents** | SLA tracking, severity filtering, timeline events, panic button |
| 7 | **Notices** | CMS with priority badges, read/acknowledge tracking |
| 8 | **Analytics** | Fleet utilization, incident trends, driver rankings |
| 9 | **Users** | RBAC user management with role badges, search, pagination |
| 10 | **AI Copilot** | Chat interface with suggestion chips, role-aware responses |
| 11 | **Reports** | CSV/PDF report generation and download |
| 12 | **Audit** | System audit log with activity timeline |
| 14 | **Notifications** | In-app notification center |
| 15 | **Depots** | Depot management with geofencing |
| 16 | **GPS** | Historical replay, trip analytics, WebSocket streaming |

## 🏗️ Architecture

```

intelligent-fleet-management-system/
├── backend/
│   ├── app/
│   │   ├── core/              # Configuration, Database, Security, Middleware, WebSocket
│   │   ├── features/          # Feature modules (Auth, Vehicles, GPS, Routes, Reports, etc.)
│   │   ├── services/          # Background services (GPS Simulator)
│   │   ├── models.py          # SQLAlchemy ORM models with PostGIS support
│   │   ├── seed.py            # Realistic NCRTC demo data generator
│   │   └── main.py            # FastAPI application & lifespan events
│   ├── uploads/               # Uploaded files
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/        # Shared UI components
│   │   ├── features/          # Feature pages (Dashboard, AVLS, Vehicles, etc.)
│   │   ├── hooks/             # Custom React hooks (GPS WebSocket, Notifications)
│   │   ├── lib/               # API client & utilities
│   │   ├── store/             # Zustand state management
│   │   └── types/             # TypeScript interfaces
│   ├── package.json
│   └── Dockerfile
│
├── infrastructure/
│   └── postgres/
│       └── init.sql
│
└── docker-compose.yml
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local dev)
- Python 3.11+ (for local dev)

### With Docker
```bash
docker compose up --build
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api
- API Docs: http://localhost:8000/docs

### Local Development

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python -m app.seed         # Seed database
uvicorn app.main:app --reload
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ncrtc.in | password123 |
| All other roles | `<first>.<last><N>@ncrtc.in` | ncrtc2024 |

## 🗄️ Seed Data

The seed generator creates realistic NCR transport data:
- **5** depots (Anand Vihar, Meerut, Ghaziabad, Modinagar, Duhai)
- **50** vehicles (Tata, Ashok Leyland, Volvo, BYD, Olectra)
- **100** users across 6 roles
- **15** routes along the RRTS corridor
- **30** stops with real NCR coordinates
- **7 days** of duty schedules (~250 duties)
- **~6000** GPS pings with realistic movement
- **50** incidents with SLA tracking
- **20** notices and announcements
- **100** audit log entries

## 🔒 RBAC Roles

| Role | Access |
|------|--------|
| ADMIN | Full system access |
| EXECUTIVE | Analytics, reports, read-only fleet |
| CONTROL_OPERATOR | Full operations access |
| DEPOT_MANAGER | Depot-scoped management |
| DRIVER | Own duties, notices, panic button |
| CONDUCTOR | Own duties, notices |

