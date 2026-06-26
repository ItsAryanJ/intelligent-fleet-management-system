"""
NCRTC Demo Data Seed Script — Generates realistic operational data.
Run: python -m app.seed
"""

import asyncio
import random
import uuid
import math
from datetime import datetime, timezone, timedelta, date, time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.core.security import hash_password
from app.models import (
    Base, Depot, Role, User, Vehicle, Route, Stop, RouteStop, Duty,
    Incident, Notice, GPSPing, Notification, LeaveRequest, Report, AuditLog,
    VehicleType, VehicleStatus, IncidentType, IncidentSeverity, IncidentStatus,
    DutyStatus, ShiftType, NotificationType, LeaveStatus, ReportType, ReportFormat,
    NoticePriority, NoticeTargetType, StopType,
)

settings = get_settings()

# ── NCRTC Delhi-Meerut Route Data ────────────────────────────────────────

DEPOT_DATA = [
    {"name": "Sarai Kale Khan Depot", "code": "SKK", "city": "Delhi", "lat": 28.5894, "lon": 77.2556, "radius": 500},
    {"name": "Anand Vihar Depot", "code": "AVH", "city": "Delhi", "lat": 28.6466, "lon": 77.3163, "radius": 400},
    {"name": "Ghaziabad Depot", "code": "GZB", "city": "Ghaziabad", "lat": 28.6692, "lon": 77.4380, "radius": 600},
    {"name": "Murad Nagar Depot", "code": "MNR", "city": "Murad Nagar", "lat": 28.7767, "lon": 77.4851, "radius": 350},
    {"name": "Meerut South Depot", "code": "MRT", "city": "Meerut", "lat": 28.9845, "lon": 77.7064, "radius": 500},
]

ROUTE_DATA = [
    {"name": "Delhi-Meerut Express", "code": "RRTS-01", "stops": ["Sarai Kale Khan", "New Ashok Nagar", "Anand Vihar", "Ghaziabad", "Guldhar", "Duhai", "Duhai Depot", "Murad Nagar", "Modi Nagar South", "Modi Nagar North", "Meerut South", "Shatabdi Nagar", "Meerut Central"]},
    {"name": "Sarai Kale Khan-Ghaziabad Shuttle", "code": "RRTS-02", "stops": ["Sarai Kale Khan", "New Ashok Nagar", "Anand Vihar", "Ghaziabad"]},
    {"name": "Ghaziabad-Meerut Semi Express", "code": "RRTS-03", "stops": ["Ghaziabad", "Duhai", "Murad Nagar", "Modi Nagar South", "Meerut South", "Meerut Central"]},
    {"name": "Morning Peak Service", "code": "RRTS-04", "stops": ["Meerut Central", "Meerut South", "Murad Nagar", "Ghaziabad", "Anand Vihar", "Sarai Kale Khan"]},
    {"name": "Evening Peak Reverse", "code": "RRTS-05", "stops": ["Sarai Kale Khan", "Anand Vihar", "Ghaziabad", "Murad Nagar", "Meerut South"]},
    {"name": "All-Stops Local", "code": "RRTS-06", "stops": ["Sarai Kale Khan", "New Ashok Nagar", "Anand Vihar", "Ghaziabad", "Guldhar", "Duhai", "Duhai Depot", "Murad Nagar", "Modi Nagar South", "Modi Nagar North", "Meerut South", "Shatabdi Nagar", "Meerut Central"]},
    {"name": "Depot Shunting Route A", "code": "SHNT-01", "stops": ["Duhai Depot", "Ghaziabad", "Duhai Depot"]},
    {"name": "Depot Shunting Route B", "code": "SHNT-02", "stops": ["Sarai Kale Khan", "New Ashok Nagar", "Sarai Kale Khan"]},
    {"name": "Night Maintenance Run", "code": "MAINT-01", "stops": ["Ghaziabad", "Duhai Depot", "Murad Nagar", "Ghaziabad"]},
    {"name": "Weekend Express", "code": "RRTS-07", "stops": ["Sarai Kale Khan", "Ghaziabad", "Murad Nagar", "Meerut Central"]},
    {"name": "Peak-Hour Special A", "code": "RRTS-08", "stops": ["Anand Vihar", "Ghaziabad", "Duhai", "Murad Nagar"]},
    {"name": "Peak-Hour Special B", "code": "RRTS-09", "stops": ["Murad Nagar", "Modi Nagar South", "Meerut South", "Meerut Central"]},
    {"name": "Holiday Service", "code": "RRTS-10", "stops": ["Sarai Kale Khan", "Anand Vihar", "Ghaziabad", "Meerut Central"]},
    {"name": "Late Night Service", "code": "RRTS-11", "stops": ["Meerut Central", "Ghaziabad", "Sarai Kale Khan"]},
    {"name": "Early Morning Service", "code": "RRTS-12", "stops": ["Sarai Kale Khan", "Ghaziabad", "Meerut Central"]},
]

STOP_COORDINATES = {
    "Sarai Kale Khan": (28.5894, 77.2556),
    "New Ashok Nagar": (28.6116, 77.2852),
    "Anand Vihar": (28.6466, 77.3163),
    "Ghaziabad": (28.6692, 77.4380),
    "Guldhar": (28.6901, 77.4488),
    "Duhai": (28.7120, 77.4588),
    "Duhai Depot": (28.7200, 77.4620),
    "Murad Nagar": (28.7767, 77.4851),
    "Modi Nagar South": (28.8200, 77.5700),
    "Modi Nagar North": (28.8400, 77.5900),
    "Meerut South": (28.9845, 77.7064),
    "Shatabdi Nagar": (28.9900, 77.7100),
    "Meerut Central": (29.0000, 77.7200),
}

# Use only VALID enum values from models.py
INCIDENT_TYPES_DATA = [
    ("Brake system failure during service", IncidentType.BREAKDOWN, IncidentSeverity.P1),
    ("Signal passing at danger (SPAD)", IncidentType.SECURITY, IncidentSeverity.P1),
    ("Pantograph damage during monsoon", IncidentType.BREAKDOWN, IncidentSeverity.P2),
    ("Passenger emergency alarm activated", IncidentType.COMPLAINT, IncidentSeverity.P2),
    ("AC failure in coach B", IncidentType.BREAKDOWN, IncidentSeverity.P3),
    ("Door malfunction at Ghaziabad", IncidentType.BREAKDOWN, IncidentSeverity.P2),
    ("Track obstruction near Murad Nagar", IncidentType.SECURITY, IncidentSeverity.P1),
    ("Power supply interruption", IncidentType.BREAKDOWN, IncidentSeverity.P2),
    ("Unauthorized person on track", IncidentType.SECURITY, IncidentSeverity.P1),
    ("CCTV camera malfunction", IncidentType.SECURITY, IncidentSeverity.P3),
    ("Medical emergency on board", IncidentType.COMPLAINT, IncidentSeverity.P2),
    ("Graffiti vandalism on exterior", IncidentType.OTHER, IncidentSeverity.P3),
    ("Wheel flat detected", IncidentType.BREAKDOWN, IncidentSeverity.P2),
    ("Route deviation near Modi Nagar", IncidentType.ROUTE_DEVIATION, IncidentSeverity.P2),
    ("Geofence breach — unauthorized depot entry", IncidentType.SECURITY, IncidentSeverity.P2),
]

NOTICE_TITLES = [
    "Revised Timetable Effective Monday",
    "Safety Briefing Mandatory for All Drivers",
    "Monsoon Season Operational Guidelines",
    "New Uniform Distribution Schedule",
    "Holiday Duty Roster Published",
    "Track Maintenance: Block Section Updates",
    "COVID-19 Protocol Reminder",
    "Employee Recognition Awards Ceremony",
    "Fire Safety Drill — All Depots",
    "Annual Medical Checkup Schedule",
    "Emergency Contact Numbers Updated",
    "New Driver Training Module Available",
    "Passenger Feedback Summary Q2",
    "Depot Cleanliness Drive",
    "Diwali Holiday Operations Plan",
    "Salary Revision Notice",
    "Canteen Menu Update",
    "Parking Allocation Changes",
    "IT System Maintenance Window",
    "New Safety Equipment Issued",
]

FIRST_NAMES = ["Rajesh", "Amit", "Suresh", "Vikram", "Arun", "Pradeep", "Naveen", "Sanjay", "Manoj", "Deepak",
               "Priya", "Sunita", "Rekha", "Meena", "Kavita", "Anita", "Neha", "Pooja", "Swati", "Divya",
               "Rahul", "Mohit", "Nitin", "Gaurav", "Rohit", "Vishal", "Ashish", "Sachin", "Pankaj", "Ravi",
               "Geeta", "Sarita", "Manju", "Shalini", "Rina", "Nisha", "Archana", "Shubha", "Pallavi", "Jyoti"]

LAST_NAMES = ["Sharma", "Singh", "Kumar", "Gupta", "Verma", "Yadav", "Joshi", "Patel", "Chauhan", "Tiwari",
              "Mishra", "Pandey", "Srivastava", "Agarwal", "Saxena", "Mehta", "Reddy", "Nair", "Iyer", "Menon"]

ROLES = ["ADMIN", "CONTROL_OPERATOR", "DEPOT_MANAGER", "DRIVER", "CONDUCTOR", "EXECUTIVE"]
ROLE_DISTRIBUTION = {
    "ADMIN": 3, "CONTROL_OPERATOR": 8, "DEPOT_MANAGER": 5,
    "DRIVER": 45, "CONDUCTOR": 30, "EXECUTIVE": 9,
}


async def seed_database():
    """Generate complete realistic NCRTC demo data."""
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Create all tables first
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # ── Idempotency check ─────────────────────────────────────────
        existing = await db.execute(select(Role).limit(1))
        if existing.scalar_one_or_none():
            print("⚠️  Database already seeded — skipping.")
            await engine.dispose()
            return

        print("🚄 NCRTC Demo Data Generator")
        print("=" * 60)

        # ── 1. Roles ─────────────────────────────────────────────────
        print("📋 Creating roles...")
        role_map = {}
        for role_name in ROLES:
            role = Role(name=role_name, description=f"NCRTC {role_name.replace('_', ' ').title()}")
            db.add(role)
            await db.flush()
            role_map[role_name] = role
        print(f"   ✅ {len(role_map)} roles created")

        # ── 2. Depots ────────────────────────────────────────────────
        print("🏢 Creating depots...")
        depot_map = {}
        for d in DEPOT_DATA:
            depot = Depot(
                name=d["name"], code=d["code"], city=d["city"],
                latitude=d["lat"], longitude=d["lon"],
                geofence_radius_m=d["radius"], address=f"{d['city']}, Uttar Pradesh",
            )
            db.add(depot)
            await db.flush()
            depot_map[d["code"]] = depot
        depots = list(depot_map.values())
        print(f"   ✅ {len(depots)} depots created")

        # ── 3. Users ─────────────────────────────────────────────────
        print("👤 Creating users...")
        users = []
        user_idx = 0
        password_hash = hash_password("ncrtc2024")

        # Create deterministic admin account matching README
        admin_hash = hash_password("password123")
        admin_user = User(
            first_name="System", last_name="Admin",
            email="admin@ncrtc.in",
            password_hash=admin_hash,
            employee_id="NCRTC-0000",
            phone="+91-9999999999",
            role_id=role_map["ADMIN"].id,
            depot_id=depots[0].id,
            is_active=True,
        )
        db.add(admin_user)
        users.append(admin_user)

        for role_name, count in ROLE_DISTRIBUTION.items():
            for i in range(count):
                first = random.choice(FIRST_NAMES)
                last = random.choice(LAST_NAMES)
                depot = random.choice(depots)
                user = User(
                    first_name=first, last_name=last,
                    email=f"{first.lower()}.{last.lower()}{user_idx}@ncrtc.in",
                    password_hash=password_hash,
                    employee_id=f"NCRTC-{str(user_idx + 1).zfill(4)}",
                    phone=f"+91-{random.randint(7000000000, 9999999999)}",
                    role_id=role_map[role_name].id,
                    depot_id=depot.id,
                    is_active=True,
                )
                db.add(user)
                users.append(user)
                user_idx += 1
        await db.flush()
        drivers = [u for u in users if u.role_id == role_map["DRIVER"].id]
        conductors = [u for u in users if u.role_id == role_map["CONDUCTOR"].id]
        print(f"   ✅ {len(users)} users created (incl. admin@ncrtc.in)")

        # ── 4. Vehicles ──────────────────────────────────────────────
        print("🚆 Creating vehicles...")
        vehicles = []
        vehicle_types = list(VehicleType)
        # Only use valid VehicleStatus enum members
        statuses = [VehicleStatus.ACTIVE] * 7 + [VehicleStatus.MAINTENANCE, VehicleStatus.INACTIVE, VehicleStatus.BREAKDOWN]
        for i in range(50):
            depot = depots[i % len(depots)]
            v = Vehicle(
                registration_no=f"RRTS-{str(i + 1).zfill(3)}",
                vehicle_type=random.choice(vehicle_types),
                make="ALSTOM" if i % 3 == 0 else ("Bombardier" if i % 3 == 1 else "CAF"),
                model=f"Series-{random.choice(['X', 'Y', 'Z'])}{random.randint(100, 999)}",
                year=random.randint(2022, 2026),
                status=random.choice(statuses),
                depot_id=depot.id,
                capacity=random.choice([40, 45, 50, 55]),
                color=random.choice(["White", "Blue", "Silver", "Red"]),
                chassis_no=f"CHS-{100000 + i}",
                engine_no=f"ENG-{200000 + i}",
                insurance_expiry=date.today() + timedelta(days=random.randint(180, 900)),
fitness_expiry=date.today() + timedelta(days=random.randint(90, 540)),
                last_latitude=depot.latitude + random.uniform(-0.02, 0.02),
                last_longitude=depot.longitude + random.uniform(-0.02, 0.02),
                last_speed=random.uniform(0, 80),
                last_heading=random.uniform(0, 360),
                ignition_on=random.random() > 0.3,
                last_gps_time=datetime.now(timezone.utc) - timedelta(minutes=random.randint(0, 30)),
            )
            db.add(v)
            vehicles.append(v)
        await db.flush()
        print(f"   ✅ {len(vehicles)} vehicles created")

        # ── 5. Stops (station catalog) ───────────────────────────────
        print("🛤️ Creating stops...")
        stop_map = {}
        stop_idx = 0
        for stop_name, (lat, lon) in STOP_COORDINATES.items():
            stop = Stop(
                name=stop_name,
                code=f"STP-{str(stop_idx + 1).zfill(3)}",
                latitude=lat,
                longitude=lon,
                stop_type=StopType.TERMINAL if stop_name in ("Sarai Kale Khan", "Meerut Central") else StopType.REGULAR,
                is_active=True,
            )
            db.add(stop)
            await db.flush()
            stop_map[stop_name] = stop
            stop_idx += 1
        print(f"   ✅ {len(stop_map)} stops created")

        # ── 6. Routes + RouteStops ───────────────────────────────────
        print("🛤️ Creating routes...")
        routes = []
        total_route_stops = 0
        for rd in ROUTE_DATA:
            depot = random.choice(depots)
            r = Route(
                name=rd["name"], code=rd["code"],
                distance_km=round(random.uniform(10, 82), 1),
                estimated_duration_mins=random.randint(15, 120),
                depot_id=depot.id,
                is_active=True,
                is_circular=rd["code"].startswith("SHNT"),
                frequency_mins=random.choice([10, 15, 20, 30]),
                color=random.choice(["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"]),
            )
            db.add(r)
            await db.flush()
            routes.append(r)

            # Create RouteStop associations
            for seq, stop_name in enumerate(rd["stops"]):
                if stop_name in stop_map:
                    rs = RouteStop(
                        route_id=r.id,
                        stop_id=stop_map[stop_name].id,
                        sequence=seq + 1,
                        distance_from_start_km=round(seq * random.uniform(2, 8), 1),
                        scheduled_arrival_offset_mins=seq * random.randint(3, 8),
                    )
                    db.add(rs)
                    total_route_stops += 1
        await db.flush()
        print(f"   ✅ {len(routes)} routes, {total_route_stops} route-stops created")

        # ── 7. Duties (7 days) ───────────────────────────────────────
        print("📅 Creating duties...")
        duties = []
        today = date.today()
        shifts = list(ShiftType)
        for day_offset in range(-3, 4):
            duty_date = today + timedelta(days=day_offset)
            for shift_idx in range(random.randint(15, 25)):
                driver = random.choice(drivers)
                conductor = random.choice(conductors)
                vehicle = random.choice(vehicles)
                route = random.choice(routes)
                shift_choice = random.choice(shifts)

                # Map shift to reasonable start/end times
                shift_hours = {
                    ShiftType.MORNING: (5, 13),
                    ShiftType.AFTERNOON: (13, 20),
                    ShiftType.EVENING: (16, 23),
                    ShiftType.NIGHT: (21, 5),
                    ShiftType.SPLIT: (6, 14),
                }
                start_h, end_h = shift_hours[shift_choice]

                if day_offset < 0:
                    status = DutyStatus.COMPLETED
                elif day_offset == 0:
                    status = DutyStatus.IN_PROGRESS
                else:
                    status = random.choice([DutyStatus.DRAFT, DutyStatus.PUBLISHED])

                d = Duty(
                    date=duty_date,
                    shift=shift_choice,
                    start_time=time(hour=start_h),
                    end_time=time(hour=end_h if end_h > start_h else 23),
                    driver_id=driver.id,
                    conductor_id=conductor.id,
                    vehicle_id=vehicle.id,
                    route_id=route.id,
                    status=status,
                    created_by=str(admin_user.id),
                )
                db.add(d)
                duties.append(d)
        await db.flush()
        print(f"   ✅ {len(duties)} duties created")

        # ── 8. GPS Pings (reduced to ~6000 for faster seeding) ───────
        print("📡 Generating GPS pings...")
        ping_count = 0
        for v in vehicles:
            lat, lon = v.last_latitude or 28.7, v.last_longitude or 77.5
            for hour_offset in range(120):
                ts = datetime.now(timezone.utc) - timedelta(hours=hour_offset)
                lat += random.uniform(-0.001, 0.001)
                lon += random.uniform(-0.001, 0.001)
                speed = random.uniform(0, 80) if random.random() > 0.2 else 0
                ping = GPSPing(
                    vehicle_id=v.id, latitude=lat, longitude=lon,
                    speed=round(speed, 1), heading=random.uniform(0, 360),
                    ignition_on=speed > 0, timestamp=ts,
                )
                db.add(ping)
                ping_count += 1
                if ping_count % 5000 == 0:
                    await db.flush()
                    print(f"   📡 {ping_count:,} pings...")
        await db.flush()
        print(f"   ✅ {ping_count:,} GPS pings created")

        # ── 9. Incidents ─────────────────────────────────────────────
        print("⚠️ Creating incidents...")
        incidents = []
        for i in range(50):
            title, inc_type, severity = random.choice(INCIDENT_TYPES_DATA)
            vehicle = random.choice(vehicles)
            created = datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
            status = random.choice(list(IncidentStatus))
            sla_hours = {"P1": 1, "P2": 4, "P3": 24}
            inc = Incident(
                incident_no=f"INC-{created.strftime('%Y%m%d')}-{str(i + 1).zfill(3)}",
                title=title, description=f"Detailed description of: {title}",
                incident_type=inc_type, severity=severity, status=status,
                vehicle_id=vehicle.id, reported_by=random.choice(users).id,
                latitude=28.7 + random.uniform(-0.3, 0.3),
                longitude=77.5 + random.uniform(-0.3, 0.3),
                sla_deadline=created + timedelta(hours=sla_hours.get(severity.value, 24)),
                sla_breached=random.random() > 0.8,
                created_by=str(admin_user.id),
            )
            db.add(inc)
            incidents.append(inc)
        await db.flush()
        print(f"   ✅ {len(incidents)} incidents created")

        # ── 10. Notices ──────────────────────────────────────────────
        print("📢 Creating notices...")
        valid_priorities = list(NoticePriority)
        for i, title in enumerate(NOTICE_TITLES):
            notice = Notice(
                title=title,
                content=f"This is the detailed content for: {title}. All staff are requested to take note of this communication.",
                content_type="markdown",
                summary=f"Summary: {title}",
                priority=random.choice(valid_priorities),
                target_type=NoticeTargetType.ALL,
                published_by=random.choice(users).id,
                published_at=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 60)),
                is_published=True,
                language="en",
                created_by=str(admin_user.id),
            )
            db.add(notice)
        await db.flush()
        print(f"   ✅ {len(NOTICE_TITLES)} notices created")

        # ── 11. Leave Requests ───────────────────────────────────────
        print("🏖️ Creating leave requests...")
        for i in range(30):
            user = random.choice(drivers + conductors)
            start = today + timedelta(days=random.randint(-10, 20))
            end = start + timedelta(days=random.randint(1, 5))
            lr = LeaveRequest(
                user_id=user.id, start_date=start, end_date=end,
                reason=random.choice(["Personal work", "Medical", "Family function", "Travel", "Health checkup"]),
                leave_type=random.choice(["casual", "sick", "emergency", "planned"]),
                status=random.choice(list(LeaveStatus)),
            )
            db.add(lr)
        await db.flush()
        print(f"   ✅ 30 leave requests created")

        # ── 12. Reports ──────────────────────────────────────────────
        print("📊 Creating report history...")
        for i in range(10):
            r = Report(
                report_type=random.choice(list(ReportType)),
                report_format=random.choice(list(ReportFormat)),
                title=f"Auto-Generated Report #{i + 1}",
                generated_by=random.choice(users).id,
                status="completed",
            )
            db.add(r)
        await db.flush()
        print(f"   ✅ 10 reports created")

        # ── 13. Notifications ────────────────────────────────────────
        print("🔔 Creating notifications...")
        notification_count = 0
        for user in users[:30]:
            for j in range(random.randint(3, 8)):
                n = Notification(
                    user_id=user.id,
                    notification_type=random.choice(list(NotificationType)),
                    title=random.choice(["Duty assigned", "Incident update", "Notice published", "Leave status", "System alert"]),
                    message=f"Notification message #{j + 1} for {user.first_name}",
                    is_read=random.random() > 0.5,
                )
                db.add(n)
                notification_count += 1
        await db.flush()
        print(f"   ✅ {notification_count} notifications created")

        # ── Commit ───────────────────────────────────────────────────
        await db.commit()

        print()
        print("=" * 60)
        print("🎉 SEED COMPLETE!")
        print(f"   🏢 {len(depots)} Depots")
        print(f"   👤 {len(users)} Users")
        print(f"   🚆 {len(vehicles)} Vehicles")
        print(f"   🛤️  {len(routes)} Routes, {len(stop_map)} Stops, {total_route_stops} RouteStops")
        print(f"   📅 {len(duties)} Duties (7 days)")
        print(f"   📡 {ping_count:,} GPS Pings")
        print(f"   ⚠️  {len(incidents)} Incidents")
        print(f"   📢 {len(NOTICE_TITLES)} Notices")
        print(f"   🏖️  30 Leave Requests")
        print(f"   📊 10 Reports")
        print(f"   🔔 {notification_count} Notifications")
        print()
        print("   🔑 Login: admin@ncrtc.in / password123")
        print("=" * 60)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_database())
