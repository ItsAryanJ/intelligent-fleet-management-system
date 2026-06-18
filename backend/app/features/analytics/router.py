"""
Analytics feature — Executive dashboards, KPIs, charts.
"""

from typing import Annotated, Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta, date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission
from app.core.permissions import Permission, RoleName
from app.models import (
    Vehicle, VehicleStatus, VehicleHealth,
    Incident, IncidentStatus, IncidentSeverity,
    Duty, DutyStatus, User, Depot, Route,
    GPSPing, Notification, AuditLog,
)
from app.core.exceptions import ForbiddenException

router = APIRouter()


@router.get("/executive")
async def executive_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.ANALYTICS_VIEW))],
):
    """Executive dashboard KPIs."""
    if current_user.role == RoleName.DEPOT_MANAGER.value:
        raise ForbiddenException(
            "Executive dashboard is not available for depot managers"
        )
    # Total vehicles
    total_vehicles = (await db.execute(
        select(func.count()).select_from(
            select(Vehicle).where(Vehicle.is_deleted == False).subquery()
        )
    )).scalar() or 0

    # Active vehicles
    active_vehicles = (await db.execute(
        select(func.count()).select_from(
            select(Vehicle).where(
                Vehicle.is_deleted == False,
                Vehicle.status == VehicleStatus.ACTIVE,
            ).subquery()
        )
    )).scalar() or 0

    # Open incidents
    open_incidents = (await db.execute(
        select(func.count()).select_from(
            select(Incident).where(
                Incident.is_deleted == False,
                Incident.status.in_(["OPEN", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS"]),
            ).subquery()
        )
    )).scalar() or 0

    # Resolved incidents (last 30 days)
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    resolved_incidents = (await db.execute(
        select(func.count()).select_from(
            select(Incident).where(
                Incident.is_deleted == False,
                Incident.status.in_(["RESOLVED", "CLOSED"]),
                Incident.resolved_at >= thirty_days_ago,
            ).subquery()
        )
    )).scalar() or 0

    total_incidents_30d = (await db.execute(
        select(func.count()).select_from(
            select(Incident).where(
                Incident.is_deleted == False,
                Incident.created_at >= thirty_days_ago,
            ).subquery()
        )
    )).scalar() or 0

    resolution_rate = round((resolved_incidents / total_incidents_30d * 100) if total_incidents_30d > 0 else 0, 1)
    utilization = round((active_vehicles / total_vehicles * 100) if total_vehicles > 0 else 0, 1)

    # Total users
    total_users = (await db.execute(
        select(func.count()).select_from(
            select(User).where(User.is_deleted == False).subquery()
        )
    )).scalar() or 0

    # Total routes
    total_routes = (await db.execute(
        select(func.count()).select_from(
            select(Route).where(Route.is_deleted == False, Route.is_active == True).subquery()
        )
    )).scalar() or 0

    # Total depots
    total_depots = (await db.execute(
        select(func.count()).select_from(
            select(Depot).where(Depot.is_deleted == False).subquery()
        )
    )).scalar() or 0

    # Today's duties
    today = date.today()
    todays_duties = (await db.execute(
        select(func.count()).select_from(
            select(Duty).where(Duty.is_deleted == False, Duty.date == today).subquery()
        )
    )).scalar() or 0

    # SLA breached
    sla_breached = (await db.execute(
        select(func.count()).select_from(
            select(Incident).where(
                Incident.is_deleted == False,
                Incident.sla_breached == True,
                Incident.created_at >= thirty_days_ago,
            ).subquery()
        )
    )).scalar() or 0

    return {
        "kpis": {
            "total_vehicles": total_vehicles,
            "active_vehicles": active_vehicles,
            "utilization_percent": utilization,
            "open_incidents": open_incidents,
            "resolution_rate": resolution_rate,
            "sla_breached_30d": sla_breached,
            "total_users": total_users,
            "total_routes": total_routes,
            "total_depots": total_depots,
            "todays_duties": todays_duties,
        },
    }


@router.get("/fleet-utilization")
async def fleet_utilization(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.ANALYTICS_VIEW))],
    days: int = Query(30, ge=7, le=90),
):
    """Fleet utilization trends over time."""
    stmt = (
        select(Vehicle.status, func.count(Vehicle.id))
        .where(Vehicle.is_deleted == False)
    )

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        stmt = stmt.where(
            Vehicle.depot_id == current_user.depot_id
        )

    stmt = stmt.group_by(Vehicle.status)

    result = await db.execute(stmt)

    status_breakdown = {row[0] if isinstance(row[0], str) else row[0].value: row[1] for row in result.all()}

    return {
        "status_breakdown": status_breakdown,
        "period_days": days,
    }


@router.get("/incidents")
async def incident_analytics(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.ANALYTICS_VIEW))],
    days: int = Query(30, ge=7, le=90),
):
    """Incident analytics and trends."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    incident_filter = [
        Incident.is_deleted == False,
        Incident.created_at >= cutoff,
    ]

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        incident_filter.append(
            Incident.reported_by_user.has(
                User.depot_id == current_user.depot_id
            )
        )
        
    # By type
    type_result = await db.execute(
        select(
            Incident.incident_type,
            func.count(Incident.id)
        )
        .where(*incident_filter)
        .group_by(Incident.incident_type)
    )
    by_type = {row[0] if isinstance(row[0], str) else row[0].value: row[1] for row in type_result.all()}

    # By severity
    severity_result = await db.execute(
        select(
            Incident.severity,
            func.count(Incident.id)
        )
        .where(*incident_filter)
        .group_by(Incident.severity)
    )
    by_severity = {row[0] if isinstance(row[0], str) else row[0].value: row[1] for row in severity_result.all()}

    # By status
    status_result = await db.execute(
        select(
            Incident.status,
            func.count(Incident.id)
        )
        .where(*incident_filter)
        .group_by(Incident.status)
    )
    by_status = {row[0] if isinstance(row[0], str) else row[0].value: row[1] for row in status_result.all()}

    return {
        "by_type": by_type,
        "by_severity": by_severity,
        "by_status": by_status,
        "period_days": days,
    }


@router.get("/driver-performance")
async def driver_performance(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.ANALYTICS_VIEW))],
):
    """Driver performance rankings."""
    # Get drivers with their duty and incident counts
    from app.models import Role
    driver_role = await db.execute(select(Role).where(Role.name == "DRIVER"))
    driver_role_obj = driver_role.scalar_one_or_none()

    if not driver_role_obj:
        return {"drivers": []}

    drivers_stmt = select(User).where(
        User.is_deleted == False,
        User.role_id == driver_role_obj.id,
    )

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        drivers_stmt = drivers_stmt.where(
            User.depot_id == current_user.depot_id
        )

    drivers_result = await db.execute(drivers_stmt)
    drivers = drivers_result.scalars().all()

    rankings = []
    for driver in drivers:
        # Duty count
        duty_count = (await db.execute(
            select(func.count()).select_from(
                select(Duty).where(Duty.driver_id == driver.id, Duty.is_deleted == False).subquery()
            )
        )).scalar() or 0

        # Completed duties
        completed = (await db.execute(
            select(func.count()).select_from(
                select(Duty).where(
                    Duty.driver_id == driver.id,
                    Duty.is_deleted == False,
                    Duty.status.in_(["COMPLETED", "ACKNOWLEDGED"]),
                ).subquery()
            )
        )).scalar() or 0

        # Incident count
        incident_count = (await db.execute(
            select(func.count()).select_from(
                select(Incident).where(
                    Incident.reported_by == driver.id,
                    Incident.is_deleted == False,
                ).subquery()
            )
        )).scalar() or 0

        compliance = round((completed / duty_count * 100) if duty_count > 0 else 100, 1)
        # Safety score: 100 - (incidents * 5), min 0
        safety_score = max(0, 100 - (incident_count * 5))

        rankings.append({
            "driver_id": str(driver.id),
            "name": driver.full_name,
            "employee_id": driver.employee_id,
            "total_duties": duty_count,
            "completed_duties": completed,
            "compliance_percent": compliance,
            "incident_count": incident_count,
            "safety_score": safety_score,
            "overall_score": round((compliance * 0.6 + safety_score * 0.4), 1),
        })

    rankings.sort(key=lambda x: x["overall_score"], reverse=True)
    for i, r in enumerate(rankings):
        r["rank"] = i + 1

    return {"drivers": rankings}


@router.get("/depot/{depot_id}")
async def depot_analytics(
    depot_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.ANALYTICS_VIEW))],
):
    """Depot-specific analytics."""
    # Vehicles in depot
    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and depot_id != current_user.depot_id
    ):
        raise ForbiddenException(
            "Cannot access another depot"
        )
    vehicle_count = (await db.execute(
        select(func.count()).select_from(
            select(Vehicle).where(Vehicle.depot_id == depot_id, Vehicle.is_deleted == False).subquery()
        )
    )).scalar() or 0

    active_count = (await db.execute(
        select(func.count()).select_from(
            select(Vehicle).where(
                Vehicle.depot_id == depot_id,
                Vehicle.is_deleted == False,
                Vehicle.status == VehicleStatus.ACTIVE,
            ).subquery()
        )
    )).scalar() or 0

    # Users in depot
    user_count = (await db.execute(
        select(func.count()).select_from(
            select(User).where(User.depot_id == depot_id, User.is_deleted == False).subquery()
        )
    )).scalar() or 0

    return {
        "depot_id": str(depot_id),
        "total_vehicles": vehicle_count,
        "active_vehicles": active_count,
        "total_users": user_count,
        "utilization_percent": round((active_count / vehicle_count * 100) if vehicle_count > 0 else 0, 1),
    }


@router.get("/trend")
async def weekly_trend(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[
        CurrentUser,
        Depends(require_permission(Permission.ANALYTICS_VIEW))
    ],
    days: int = Query(7, ge=1, le=30),
):
    """Daily operations trend for the past N days."""

    DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    today = date.today()

    vehicle_filter = [Vehicle.is_deleted == False]

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        vehicle_filter.append(
            Vehicle.depot_id == current_user.depot_id
        )

    total_vehicles = (
        await db.execute(
            select(func.count()).select_from(
                select(Vehicle)
                .where(*vehicle_filter)
                .subquery()
            )
        )
    ).scalar() or 1

    trend = []

    for offset in range(days - 1, -1, -1):
        target = today - timedelta(days=offset)
        day_label = DAY_NAMES[target.weekday()]

        # Duties
        duty_stmt = select(Duty).where(
            Duty.is_deleted == False,
            Duty.date == target,
        )

        if current_user.role == RoleName.DEPOT_MANAGER.value:
            duty_stmt = duty_stmt.where(
                Duty.driver.has(
                    User.depot_id == current_user.depot_id
                )
            )

        duty_count = (
            await db.execute(
                select(func.count()).select_from(
                    duty_stmt.subquery()
                )
            )
        ).scalar() or 0

        # Incidents
        day_start = datetime.combine(
            target,
            datetime.min.time()
        ).replace(tzinfo=timezone.utc)

        day_end = day_start + timedelta(days=1)

        incident_stmt = select(Incident).where(
            Incident.is_deleted == False,
            Incident.created_at >= day_start,
            Incident.created_at < day_end,
        )

        if current_user.role == RoleName.DEPOT_MANAGER.value:
            incident_stmt = incident_stmt.where(
                Incident.reported_by_user.has(
                    User.depot_id == current_user.depot_id
                )
            )

        incident_count = (
            await db.execute(
                select(func.count()).select_from(
                    incident_stmt.subquery()
                )
            )
        ).scalar() or 0

        # Active vehicles
        active_stmt = select(Vehicle).where(
            Vehicle.is_deleted == False,
            Vehicle.status == VehicleStatus.ACTIVE,
        )

        if current_user.role == RoleName.DEPOT_MANAGER.value:
            active_stmt = active_stmt.where(
                Vehicle.depot_id == current_user.depot_id
            )

        active = (
            await db.execute(
                select(func.count()).select_from(
                    active_stmt.subquery()
                )
            )
        ).scalar() or 0

        utilization = round(
            (active / total_vehicles * 100),
            1
        ) if total_vehicles else 0

        trend.append({
            "day": day_label,
            "date": target.isoformat(),
            "utilization": utilization,
            "incidents": incident_count,
            "duties": duty_count,
        })

    return {
        "trend": trend,
        "days": days,
    }