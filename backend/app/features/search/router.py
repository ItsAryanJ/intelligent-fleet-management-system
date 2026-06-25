"""
Search feature — Global search across all entities.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import RoleName
from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user
from app.models import Vehicle, User, Route, Incident, Notice
from app.features.notices.router import _can_view_notice

router = APIRouter()


@router.get("")
async def global_search(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    q: str = Query(min_length=2, max_length=100),
    limit: int = Query(10, ge=1, le=50),
):
    """Search across all entities — powers Ctrl+K command palette."""
    query = f"%{q}%"
    results = []

    # Search vehicles
    vehicle_stmt = (
        select(Vehicle)
        .where(
            Vehicle.is_deleted == False,
            Vehicle.registration_no.ilike(query),
        )
    )

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        vehicle_stmt = vehicle_stmt.where(
            Vehicle.depot_id == current_user.depot_id
        )

    vehicle_stmt = vehicle_stmt.limit(limit)

    vehicles = await db.execute(vehicle_stmt)

    for v in vehicles.scalars().all():
        results.append({
            "type": "vehicle",
            "id": str(v.id),
            "title": v.registration_no,
            "subtitle": f"{v.make} {v.model} — {v.status if isinstance(v.status, str) else v.status.value}",
            "link": f"/vehicles/{v.id}",
        })

    # Search users
    user_stmt = (
        select(User)
        .where(
            User.is_deleted == False,
            or_(
                User.first_name.ilike(query),
                User.last_name.ilike(query),
                User.email.ilike(query),
                User.employee_id.ilike(query),
            ),
        )
    )

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        user_stmt = user_stmt.where(
            User.depot_id == current_user.depot_id
        )

    user_stmt = user_stmt.limit(limit)

    users = await db.execute(user_stmt)

    for u in users.scalars().all():
        results.append({
            "type": "user",
            "id": str(u.id),
            "title": u.full_name,
            "subtitle": f"{u.employee_id} — {u.email}",
            "link": f"/users/{u.id}",
        })

    # Search routes
    route_stmt = (
        select(Route)
        .where(
            Route.is_deleted == False,
            or_(
                Route.name.ilike(query),
                Route.code.ilike(query),
            ),
        )
    )

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        route_stmt = route_stmt.where(
            Route.depot_id == current_user.depot_id
        )

    route_stmt = route_stmt.limit(limit)

    routes = await db.execute(route_stmt)

    for r in routes.scalars().all():
        results.append({
            "type": "route",
            "id": str(r.id),
            "title": f"{r.code} — {r.name}",
            "subtitle": f"{r.distance_km} km",
            "link": f"/routes/{r.id}",
        })

    # Search incidents
    incident_stmt = (
    select(Incident)
        .where(
            Incident.is_deleted == False,
            or_(
                Incident.incident_no.ilike(query),
                Incident.title.ilike(query),
            ),
        )
    )

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        incident_stmt = incident_stmt.where(
            Incident.reported_by_user.has(
                User.depot_id == current_user.depot_id
            )
        )

    incident_stmt = incident_stmt.limit(limit)

    incidents = await db.execute(incident_stmt)

    for i in incidents.scalars().all():
        results.append({
            "type": "incident",
            "id": str(i.id),
            "title": i.incident_no,
            "subtitle": i.title,
            "link": f"/incidents/{i.id}",
        })

    # Search notices
    notices = await db.execute(
        select(Notice)
        .where(Notice.is_deleted == False, Notice.title.ilike(query))
        .limit(limit)
    )
    for n in notices.scalars().all():
        if not _can_view_notice(n, current_user):
            continue

        results.append({
            "type": "notice",
            "id": str(n.id),
            "title": n.title,
            "subtitle": f"Notice — {n.priority if isinstance(n.priority, str) else n.priority.value}",
            "link": f"/notices/{n.id}",
        })

    return {"query": q, "total": len(results), "results": results[:limit]}
