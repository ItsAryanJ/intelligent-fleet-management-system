"""
Seed data generator — Realistic NCR transport data.
Run: python -m app.seed.run
"""

import asyncio
import random
import uuid
import math
from datetime import datetime, timezone, timedelta, date, time

from sqlalchemy import select
from app.core.database import engine, async_session_factory, Base
from app.core.security import hash_password
from app.core.permissions import Permission, RoleName, ROLE_PERMISSIONS
from app.models import (
    Depot, Vehicle, VehicleHealth, User, Role, PermissionModel, RolePermission,
    Route, Stop, RouteStop, Duty, GPSPing, Incident, IncidentEvent,
    Notice, Notification, AuditLog, LeaveRequest,
    VehicleStatus, VehicleType, DutyStatus, ShiftType,
    IncidentType, IncidentSeverity, IncidentStatus,
    NoticePriority, NoticeTargetType, NotificationType,
    LeaveStatus, MaintenanceStatus, StopType,
)


# ═══════════════════════════════════════════════════════════════════════
# NCR Region Depot Data
# ═══════════════════════════════════════════════════════════════════════
DEPOTS_DATA = [
    {"name": "Anand Vihar Terminal Depot", "code": "DEP-AVT", "lat": 28.6469, "lon": 77.3164, "city": "Delhi", "capacity": 60},
    {"name": "Meerut City Depot", "code": "DEP-MRT", "lat": 28.9845, "lon": 77.7064, "city": "Meerut", "capacity": 40},
    {"name": "Ghaziabad Central Depot", "code": "DEP-GZB", "lat": 28.6692, "lon": 77.4538, "city": "Ghaziabad", "capacity": 50},
    {"name": "Modinagar Depot", "code": "DEP-MDN", "lat": 28.8320, "lon": 77.5750, "city": "Modinagar", "capacity": 30},
    {"name": "Duhai Junction Depot", "code": "DEP-DUH", "lat": 28.7092, "lon": 77.4869, "city": "Duhai", "capacity": 35},
]

# NCR Route Stop Coordinates (along RRTS corridor roughly)
STOPS_DATA = [
    # Anand Vihar to Meerut corridor
    {"name": "Sarai Kale Khan", "code": "SKK", "lat": 28.5897, "lon": 77.2583, "type": "TERMINAL"},
    {"name": "New Ashok Nagar", "code": "NAN", "lat": 28.5937, "lon": 77.3042, "type": "REGULAR"},
    {"name": "Anand Vihar", "code": "AVR", "lat": 28.6469, "lon": 77.3164, "type": "TERMINAL"},
    {"name": "Kaushambi", "code": "KSH", "lat": 28.6397, "lon": 77.3248, "type": "REGULAR"},
    {"name": "Vaishali", "code": "VSH", "lat": 28.6422, "lon": 77.3374, "type": "REGULAR"},
    {"name": "Indirapuram", "code": "INP", "lat": 28.6412, "lon": 77.3614, "type": "REGULAR"},
    {"name": "Sahibabad", "code": "SHB", "lat": 28.6716, "lon": 77.3690, "type": "REGULAR"},
    {"name": "Ghaziabad", "code": "GZB", "lat": 28.6692, "lon": 77.4538, "type": "REGULAR"},
    {"name": "Guldhar", "code": "GDR", "lat": 28.6892, "lon": 77.4739, "type": "REGULAR"},
    {"name": "Duhai", "code": "DUH", "lat": 28.7092, "lon": 77.4869, "type": "REGULAR"},
    {"name": "Duhai Depot", "code": "DHD", "lat": 28.7192, "lon": 77.4960, "type": "DEPOT"},
    {"name": "Murad Nagar", "code": "MRN", "lat": 28.7785, "lon": 77.4997, "type": "REGULAR"},
    {"name": "Modi Nagar South", "code": "MDS", "lat": 28.8020, "lon": 77.5450, "type": "REGULAR"},
    {"name": "Modi Nagar North", "code": "MDN", "lat": 28.8320, "lon": 77.5750, "type": "REGULAR"},
    {"name": "Meerut South", "code": "MRS", "lat": 28.9145, "lon": 77.6564, "type": "REGULAR"},
    # Additional stops
    {"name": "Partapur", "code": "PTP", "lat": 28.9345, "lon": 77.6764, "type": "REGULAR"},
    {"name": "Meerut Central", "code": "MRC", "lat": 28.9645, "lon": 77.6964, "type": "REGULAR"},
    {"name": "Brahmpuri", "code": "BHP", "lat": 28.9745, "lon": 77.7064, "type": "REGULAR"},
    {"name": "Meerut City", "code": "MRT", "lat": 28.9845, "lon": 77.7064, "type": "TERMINAL"},
    {"name": "Noida Sector 62", "code": "N62", "lat": 28.6277, "lon": 77.3651, "type": "REGULAR"},
    {"name": "Noida Sector 137", "code": "N137", "lat": 28.5671, "lon": 77.3926, "type": "REGULAR"},
    {"name": "Greater Noida", "code": "GN", "lat": 28.4744, "lon": 77.5040, "type": "TERMINAL"},
    {"name": "Crossing Republik", "code": "CRK", "lat": 28.6377, "lon": 77.3942, "type": "REGULAR"},
    {"name": "Raj Nagar Extension", "code": "RNE", "lat": 28.6932, "lon": 77.4310, "type": "REGULAR"},
    {"name": "Loni", "code": "LON", "lat": 28.7318, "lon": 77.2864, "type": "REGULAR"},
    {"name": "Tronica City", "code": "TRC", "lat": 28.7518, "lon": 77.3064, "type": "REGULAR"},
    {"name": "Dasna", "code": "DSN", "lat": 28.6800, "lon": 77.5200, "type": "REGULAR"},
    {"name": "Pilkhuwa", "code": "PKW", "lat": 28.7100, "lon": 77.5900, "type": "REGULAR"},
    {"name": "Hapur", "code": "HPR", "lat": 28.7309, "lon": 77.7750, "type": "TERMINAL"},
    {"name": "Bulandshahr Road", "code": "BSR", "lat": 28.6500, "lon": 77.5500, "type": "REGULAR"},
]

ROUTES_DATA = [
    {"name": "Anand Vihar - Meerut Express", "code": "RT-001", "stops": ["AVR", "KSH", "SHB", "GZB", "DUH", "MRN", "MDN", "MRS", "MRT"], "distance": 82, "duration": 120, "color": "#3B82F6"},
    {"name": "Delhi - Ghaziabad Shuttle", "code": "RT-002", "stops": ["SKK", "NAN", "AVR", "KSH", "VSH", "INP", "SHB", "GZB"], "distance": 28, "duration": 55, "color": "#10B981"},
    {"name": "Ghaziabad - Meerut Local", "code": "RT-003", "stops": ["GZB", "GDR", "DUH", "MRN", "MDS", "MDN", "MRS", "PTP", "MRC", "BHP", "MRT"], "distance": 58, "duration": 90, "color": "#F59E0B"},
    {"name": "Anand Vihar - Duhai Depot", "code": "RT-004", "stops": ["AVR", "KSH", "INP", "SHB", "GZB", "GDR", "DUH", "DHD"], "distance": 35, "duration": 60, "color": "#EF4444"},
    {"name": "Noida Connector", "code": "RT-005", "stops": ["AVR", "KSH", "VSH", "N62", "CRK", "N137"], "distance": 22, "duration": 45, "color": "#8B5CF6"},
    {"name": "Meerut City Circular", "code": "RT-006", "stops": ["MRS", "PTP", "MRC", "BHP", "MRT", "MRC", "PTP", "MRS"], "distance": 15, "duration": 40, "color": "#EC4899"},
    {"name": "Greater Noida Express", "code": "RT-007", "stops": ["AVR", "NAN", "N62", "N137", "GN"], "distance": 40, "duration": 70, "color": "#14B8A6"},
    {"name": "Loni - Ghaziabad Link", "code": "RT-008", "stops": ["LON", "TRC", "SHB", "GZB"], "distance": 18, "duration": 35, "color": "#F97316"},
    {"name": "Hapur Express", "code": "RT-009", "stops": ["GZB", "DUH", "DSN", "PKW", "HPR"], "distance": 45, "duration": 75, "color": "#06B6D4"},
    {"name": "Raj Nagar - Ghaziabad", "code": "RT-010", "stops": ["RNE", "INP", "SHB", "GZB"], "distance": 12, "duration": 25, "color": "#84CC16"},
    {"name": "Delhi - Modinagar Fast", "code": "RT-011", "stops": ["AVR", "GZB", "DUH", "MRN", "MDN"], "distance": 50, "duration": 80, "color": "#A855F7"},
    {"name": "Duhai - Meerut South", "code": "RT-012", "stops": ["DUH", "MRN", "MDS", "MDN", "MRS"], "distance": 30, "duration": 50, "color": "#F43F5E"},
    {"name": "Noida - Greater Noida Shuttle", "code": "RT-013", "stops": ["N62", "CRK", "N137", "GN"], "distance": 20, "duration": 35, "color": "#0EA5E9"},
    {"name": "Bulandshahr Road Link", "code": "RT-014", "stops": ["GZB", "BSR", "DSN", "PKW"], "distance": 25, "duration": 40, "color": "#D946EF"},
    {"name": "Anand Vihar - Hapur Express", "code": "RT-015", "stops": ["AVR", "KSH", "SHB", "GZB", "DUH", "DSN", "PKW", "HPR"], "distance": 65, "duration": 100, "color": "#22C55E"},
]

VEHICLE_MAKES = [
    ("Tata", "Starbus Ultra"),
    ("Tata", "Starbus EV"),
    ("Ashok Leyland", "Viking"),
    ("Ashok Leyland", "Lynx"),
    ("Volvo", "8400"),
    ("BYD", "K9"),
    ("Olectra", "Evey"),
    ("JBM", "Eco-Life"),
]

FIRST_NAMES = ["Rajesh", "Sunil", "Amit", "Deepak", "Vikram", "Sandeep", "Rahul", "Manoj", "Pradeep", "Anil", "Sanjay", "Ravi", "Vijay", "Ashok", "Naveen", "Rakesh", "Suresh", "Dinesh", "Yogesh", "Mukesh", "Anita", "Sunita", "Pooja", "Kavita", "Shalini", "Meena", "Neha", "Priya", "Anjali", "Rekha"]
LAST_NAMES = ["Kumar", "Singh", "Sharma", "Verma", "Gupta", "Yadav", "Joshi", "Tiwari", "Pandey", "Mishra", "Chauhan", "Rao", "Patel", "Nair", "Reddy", "Saxena", "Agarwal", "Malhotra", "Kapoor", "Mehta"]

INCIDENT_TITLES = {
    "BREAKDOWN": ["Engine failure on route", "Flat tire near stop", "Battery dead — vehicle stranded", "AC malfunction in peak hours", "Transmission issue reported"],
    "ACCIDENT": ["Minor collision at intersection", "Side mirror hit by auto", "Rear-end collision at signal", "Pedestrian close call reported"],
    "DELAY": ["Heavy traffic delay — 30+ min", "Road construction causing diversion", "VIP movement — route blocked", "Waterlogging on route", "Signal failure at crossing"],
    "COMPLAINT": ["Passenger complaint — overcrowding", "Driver behavior complaint", "Bus cleanliness issue", "AC not working complaint"],
    "SECURITY": ["Suspicious object found", "Passenger altercation", "Chain snatching reported", "Eve teasing complaint"],
    "ROUTE_DEVIATION": ["Unauthorized route change", "GPS shows off-route movement", "Driver took different path"],
}


async def seed_database():
    """Main seed function — populates all tables with realistic NCR data."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        print("🌱 Seeding database with NCR transport data...")

        # 1. Roles
        print("  → Creating roles...")
        roles = {}
        for role_name in RoleName:
            role = Role(name=role_name.value, description=f"{role_name.value} role")
            session.add(role)
            roles[role_name.value] = role
        await session.flush()

        # 2. Permissions
        print("  → Creating permissions...")
        permissions = {}
        for perm in Permission:
            p = PermissionModel(code=perm.value, description=perm.value, category=perm.value.split(".")[0])
            session.add(p)
            permissions[perm.value] = p
        await session.flush()

        # 3. Role-Permission mappings
        print("  → Mapping role permissions...")
        for role_name, perms in ROLE_PERMISSIONS.items():
            for perm in perms:
                rp = RolePermission(
                    role_id=roles[role_name.value].id,
                    permission_id=permissions[perm.value].id,
                )
                session.add(rp)
        await session.flush()

        # 4. Depots
        print("  → Creating depots...")
        depots = []
        for d in DEPOTS_DATA:
            depot = Depot(
                name=d["name"], code=d["code"],
                latitude=d["lat"], longitude=d["lon"],
                city=d["city"], state="Delhi NCR",
                capacity=d["capacity"],
                address=f"{d['name']}, {d['city']}, NCR",
                geofence_radius_m=500.0,
            )
            session.add(depot)
            depots.append(depot)
        await session.flush()

        # 5. Stops
        print("  → Creating stops...")
        stops = {}
        for s in STOPS_DATA:
            stop = Stop(
                name=s["name"], code=s["code"],
                latitude=s["lat"], longitude=s["lon"],
                stop_type=s["type"],
                address=f"{s['name']}, NCR",
            )
            session.add(stop)
            stops[s["code"]] = stop
        await session.flush()

        # 6. Routes and RouteStops
        print("  → Creating routes...")
        routes = []
        for r in ROUTES_DATA:
            depot_idx = hash(r["code"]) % len(depots)
            route = Route(
                name=r["name"], code=r["code"],
                depot_id=depots[depot_idx].id,
                distance_km=r["distance"],
                estimated_duration_mins=r["duration"],
                color=r["color"],
                frequency_mins=random.choice([10, 15, 20, 30]),
                first_departure=time(5, 30),
                last_departure=time(22, 30),
            )
            session.add(route)
            routes.append(route)
        await session.flush()

        # Create RouteStops
        for i, r in enumerate(ROUTES_DATA):
            for seq, stop_code in enumerate(r["stops"], 1):
                if stop_code in stops:
                    rs = RouteStop(
                        route_id=routes[i].id,
                        stop_id=stops[stop_code].id,
                        sequence=seq,
                        distance_from_start_km=round(r["distance"] * seq / len(r["stops"]), 1),
                        scheduled_arrival_offset_mins=round(r["duration"] * seq / len(r["stops"])),
                    )
                    session.add(rs)
        await session.flush()

        # 7. Vehicles (50)
        print("  → Creating 50 vehicles...")
        vehicles = []
        vehicle_types = list(VehicleType)
        states = ["DL", "UP", "HR"]
        for i in range(50):
            state = random.choice(states)
            series = random.randint(1, 14)
            number = random.randint(1000, 9999)
            letters = random.choice(["PC", "AC", "TC", "PA", "AB"])
            reg_no = f"{state}-{series:02d}{letters}-{number}"
            make, model = random.choice(VEHICLE_MAKES)
            v_type = random.choice(vehicle_types)
            depot = random.choice(depots)
            status = random.choices(
                list(VehicleStatus),
                weights=[70, 5, 15, 8, 2],
                k=1
            )[0]

            vehicle = Vehicle(
                registration_no=reg_no,
                vehicle_type=v_type,
                make=make, model=model,
                year=random.randint(2020, 2025),
                capacity=random.choice([30, 35, 40, 45, 50]),
                status=status,
                depot_id=depot.id,
                color=random.choice(["White", "Silver", "Blue", "Red", "Green"]),
                ignition_on=status == VehicleStatus.ACTIVE,
            )
            session.add(vehicle)
            vehicles.append(vehicle)
        await session.flush()

        # Create VehicleHealth for each
        for v in vehicles:
            health = VehicleHealth(
                vehicle_id=v.id,
                fuel_level=round(random.uniform(20, 100), 1),
                odometer=round(random.uniform(5000, 150000), 1),
                engine_hours=round(random.uniform(500, 10000), 1),
                health_score=round(random.uniform(60, 100), 1),
                battery_voltage=round(random.uniform(11.5, 13.0), 1),
                last_service_date=date.today() - timedelta(days=random.randint(10, 180)),
                next_service_date=date.today() + timedelta(days=random.randint(10, 90)),
            )
            session.add(health)
        await session.flush()

        # 8. Users (100)
        print("  → Creating 100 users...")
        users = []
        default_password = hash_password("password123")

        # Create specific admin account
        admin = User(
            email="admin@ncrtc.in",
            password_hash=default_password,
            first_name="System",
            last_name="Administrator",
            employee_id="NCRTC-0001",
            phone="+91-9876543210",
            role_id=roles["ADMIN"].id,
            depot_id=depots[0].id,
        )
        session.add(admin)
        users.append(admin)

        # Role distribution for remaining 99 users
        role_distribution = [
            ("ADMIN", 2),
            ("CONTROL_OPERATOR", 8),
            ("DEPOT_MANAGER", 5),
            ("DRIVER", 50),
            ("CONDUCTOR", 25),
            ("EXECUTIVE", 9),
        ]

        user_idx = 2
        for role_name, count in role_distribution:
            for j in range(count):
                first = random.choice(FIRST_NAMES)
                last = random.choice(LAST_NAMES)
                depot = random.choice(depots)
                user = User(
                    email=f"{first.lower()}.{last.lower()}{user_idx}@ncrtc.in",
                    password_hash=default_password,
                    first_name=first,
                    last_name=last,
                    employee_id=f"NCRTC-{user_idx:04d}",
                    phone=f"+91-{random.randint(7000000000, 9999999999)}",
                    role_id=roles[role_name].id,
                    depot_id=depot.id,
                    is_active=True,
                )
                session.add(user)
                users.append(user)
                user_idx += 1
        await session.flush()

        # Get drivers and conductors for duty assignment
        drivers = [u for u in users if u.role_id == roles["DRIVER"].id]
        conductors = [u for u in users if u.role_id == roles["CONDUCTOR"].id]
        operators = [u for u in users if u.role_id == roles["CONTROL_OPERATOR"].id]

        # 9. Duties (7 days)
        print("  → Creating 7 days of duties...")
        today = date.today()
        duties = []
        shifts = list(ShiftType)[:4]  # MORNING, AFTERNOON, EVENING, NIGHT
        shift_times = {
            ShiftType.MORNING: (time(6, 0), time(14, 0)),
            ShiftType.AFTERNOON: (time(14, 0), time(22, 0)),
            ShiftType.EVENING: (time(16, 0), time(23, 0)),
            ShiftType.NIGHT: (time(22, 0), time(6, 0)),
        }

        for day_offset in range(-3, 4):  # 3 days back, today, 3 days ahead
            duty_date = today + timedelta(days=day_offset)
            active_vehicles = [v for v in vehicles if v.status == VehicleStatus.ACTIVE]

            for i, vehicle in enumerate(active_vehicles[:35]):  # Max 35 duties per day
                route = random.choice(routes)
                shift = random.choice(shifts)
                driver = random.choice(drivers) if drivers else None
                conductor = random.choice(conductors) if conductors else None
                start_t, end_t = shift_times[shift]

                status = DutyStatus.COMPLETED if day_offset < 0 else (
                    DutyStatus.PUBLISHED if day_offset == 0 else DutyStatus.DRAFT
                )

                duty = Duty(
                    date=duty_date,
                    shift=shift,
                    status=status,
                    vehicle_id=vehicle.id,
                    driver_id=driver.id if driver else None,
                    conductor_id=conductor.id if conductor else None,
                    route_id=route.id,
                    start_time=start_t,
                    end_time=end_t,
                )
                session.add(duty)
                duties.append(duty)
        await session.flush()

        # 10. GPS Pings (generate realistic movement data)
        print("  → Generating GPS pings (this may take a moment)...")
        active_vehicles = [v for v in vehicles if v.status == VehicleStatus.ACTIVE]

        for v in active_vehicles[:30]:  # 30 vehicles with GPS data
            route = random.choice(routes)
            route_stops_codes = ROUTES_DATA[routes.index(route)]["stops"]
            route_stop_coords = [(stops[c].latitude, stops[c].longitude) for c in route_stops_codes if c in stops]

            if len(route_stop_coords) < 2:
                continue

            # Generate pings along the route
            base_time = datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 6))

            for ping_idx in range(200):  # 200 pings per vehicle
                progress = (ping_idx / 200)
                segment_idx = int(progress * (len(route_stop_coords) - 1))
                segment_idx = min(segment_idx, len(route_stop_coords) - 2)
                segment_progress = (progress * (len(route_stop_coords) - 1)) - segment_idx

                lat1, lon1 = route_stop_coords[segment_idx]
                lat2, lon2 = route_stop_coords[segment_idx + 1]

                lat = lat1 + (lat2 - lat1) * segment_progress + random.uniform(-0.0005, 0.0005)
                lon = lon1 + (lon2 - lon1) * segment_progress + random.uniform(-0.0005, 0.0005)

                speed = random.uniform(15, 60) if random.random() > 0.1 else random.uniform(0, 5)
                heading = math.degrees(math.atan2(lon2 - lon1, lat2 - lat1)) % 360

                ping = GPSPing(
                    vehicle_id=v.id,
                    latitude=round(lat, 6),
                    longitude=round(lon, 6),
                    speed=round(speed, 1),
                    heading=round(heading, 1),
                    ignition_on=True,
                    timestamp=base_time + timedelta(seconds=ping_idx * 30),
                )
                session.add(ping)

            # Update vehicle's last known position
            v.last_latitude = round(lat, 6)
            v.last_longitude = round(lon, 6)
            v.last_speed = round(speed, 1)
            v.last_heading = round(heading, 1)
            v.last_gps_time = base_time + timedelta(seconds=199 * 30)

        await session.flush()

        # 11. Incidents (50)
        print("  → Creating 50 incidents...")
        incident_types = list(IncidentType)
        for i in range(50):
            inc_type = random.choice(incident_types)
            type_str = inc_type.value if isinstance(inc_type, IncidentType) else inc_type
            severity = random.choices(
                [IncidentSeverity.P1, IncidentSeverity.P2, IncidentSeverity.P3],
                weights=[10, 30, 60], k=1
            )[0]
            status = random.choice(list(IncidentStatus))
            reporter = random.choice(users)
            vehicle = random.choice(vehicles)
            created_at = datetime.now(timezone.utc) - timedelta(
                days=random.randint(0, 30),
                hours=random.randint(0, 23),
            )

            titles = INCIDENT_TITLES.get(type_str, ["General incident reported"])
            title = random.choice(titles)

            sla_hours = {"P1": 1, "P2": 4, "P3": 24}
            sev_str = severity.value if isinstance(severity, IncidentSeverity) else severity
            sla_deadline = created_at + timedelta(hours=sla_hours.get(sev_str, 24))
            breached = random.random() < 0.2

            incident_no = f"INC-{created_at.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

            incident = Incident(
                incident_no=incident_no,
                incident_type=inc_type,
                severity=severity,
                status=status,
                title=title,
                description=f"Details: {title}. Reported from vehicle {vehicle.registration_no}.",
                vehicle_id=vehicle.id,
                latitude=vehicle.last_latitude or random.uniform(28.5, 29.0),
                longitude=vehicle.last_longitude or random.uniform(77.2, 77.8),
                reported_by=reporter.id,
                assigned_to=random.choice(operators).id if operators and random.random() > 0.3 else None,
                sla_deadline=sla_deadline,
                sla_breached=breached,
                created_by=str(reporter.id),
            )
            incident.created_at = created_at

            if status in [IncidentStatus.RESOLVED, IncidentStatus.CLOSED]:
                incident.resolved_at = created_at + timedelta(hours=random.randint(1, 12))

            session.add(incident)
            await session.flush()

            # Add events
            event = IncidentEvent(
                incident_id=incident.id,
                event_type="created",
                description=f"Incident reported: {title}",
                created_by=reporter.id,
            )
            event.created_at = created_at
            session.add(event)

        await session.flush()

        # 12. Notices (20)
        print("  → Creating 20 notices...")
        notice_contents = [
            ("Heavy Rain Advisory", "Due to heavy rainfall expected in NCR, all drivers are advised to exercise caution. Reduce speed in waterlogged areas.", "URGENT"),
            ("Route RT-003 Diversion", "Route RT-003 will be diverted via Modi Nagar bypass from 10 AM to 4 PM due to road repair.", "HIGH"),
            ("Monthly Safety Meeting", "All drivers and conductors are required to attend the monthly safety briefing on Saturday at 10 AM.", "NORMAL"),
            ("New Duty Roster Published", "The duty roster for next week has been published. Please check your assignments.", "NORMAL"),
            ("EV Charging Protocol Update", "Updated charging protocol for electric buses. Please follow the new guidelines.", "HIGH"),
            ("Festival Schedule Changes", "Modified schedules will be in effect during the upcoming festival. Check updated timings.", "NORMAL"),
            ("Maintenance Shutdown Notice", "Depot DEP-GZB will undergo maintenance shutdown this weekend.", "HIGH"),
            ("Driver Performance Awards", "Congratulations to top-performing drivers this month!", "LOW"),
            ("New GPS Tracking System", "Upgraded GPS tracking system has been deployed across all vehicles.", "NORMAL"),
            ("Emergency Contact Update", "Please update your emergency contact information in the system.", "NORMAL"),
            ("Fuel Efficiency Tips", "Tips for improving fuel efficiency during summer operations.", "LOW"),
            ("Safety Equipment Check", "All vehicles must complete safety equipment inspection by Friday.", "HIGH"),
            ("AC Maintenance Schedule", "AC servicing schedule for summer months has been released.", "NORMAL"),
            ("Traffic Update — NH24", "Major traffic congestion expected on NH24 due to construction.", "HIGH"),
            ("Staff Welfare Meeting", "Staff welfare meeting scheduled for next Thursday.", "LOW"),
            ("New Route RT-016 Launch", "New route connecting Noida to Hapur via Ghaziabad launching next week.", "NORMAL"),
            ("Diwali Holiday Schedule", "Holiday schedule and special services for Diwali week.", "HIGH"),
            ("Insurance Renewal Reminder", "Vehicle insurance renewals due this month. Check your vehicle status.", "URGENT"),
            ("Driver Training Workshop", "Defensive driving training workshop next Monday at Anand Vihar depot.", "NORMAL"),
            ("Pollution Check Compliance", "All vehicles must complete pollution checks before month-end.", "HIGH"),
        ]

        for i, (title, content, priority) in enumerate(notice_contents):
            notice = Notice(
                title=title,
                content=content,
                content_type="markdown",
                summary=content[:100],
                priority=priority,
                target_type=NoticeTargetType.ALL,
                is_published=random.random() > 0.2,
                published_at=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30)),
                published_by=random.choice(operators).id if operators else admin.id,
                language="en",
                created_by=str(admin.id),
            )
            session.add(notice)
        await session.flush()

        # 13. Audit logs
        print("  → Creating audit logs...")
        actions = ["LOGIN", "LOGOUT", "CREATE", "UPDATE", "DELETE", "VIEW", "PUBLISH", "ASSIGN"]
        resources = ["user", "vehicle", "route", "duty", "incident", "notice"]
        for i in range(100):
            log = AuditLog(
                user_id=random.choice(users).id,
                action=random.choice(actions),
                resource_type=random.choice(resources),
                resource_id=str(uuid.uuid4()),
                details={"action": "seed_data"},
                ip_address=f"192.168.1.{random.randint(1, 254)}",
            )
            log.created_at = datetime.now(timezone.utc) - timedelta(
                hours=random.randint(0, 168)
            )
            session.add(log)
        await session.flush()

        await session.commit()
        print("✅ Database seeded successfully!")
        print(f"   📊 {len(depots)} depots, {len(vehicles)} vehicles, {len(users)} users")
        print(f"   🛣️  {len(routes)} routes, {len(stops)} stops")
        print(f"   📋 {len(duties)} duties, ~6000 GPS pings")
        print(f"   🚨 50 incidents, 20 notices")
        print(f"\n   🔑 Login: admin@ncrtc.in / password123")


if __name__ == "__main__":
    asyncio.run(seed_database())
