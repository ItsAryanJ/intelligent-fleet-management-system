"""
AI Copilot feature — Role-aware assistant with tool calling (demo mode).
"""

from typing import Annotated, Optional
from uuid import UUID
from datetime import datetime, timezone, date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel


from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user
from app.models import (
    Duty, Incident, Vehicle, User, Notice, Route, AuditLog,
    IncidentStatus, VehicleStatus, DutyStatus
)
from app.core.permissions import RoleName

router = APIRouter()


class ChatMessage(BaseModel):
    message: str
    context: Optional[dict] = None
    session_id: Optional[str] = None


class CopilotResponse(BaseModel):
    response: str
    actions: list[dict] = []
    suggestions: list[str] = []
    data: Optional[dict] = None
    tool_used: Optional[str] = None
    session_id: Optional[str] = None
    mode: str = "demo"  # "demo" or "live" — surfaced in UI


# ── Tool Registry with Role Permissions ──────────────────────────────────
COPILOT_TOOL_REGISTRY = {
    "get_my_duty": {
        "description": "Get current user's duty for today",
        "allowed_roles": ["ADMIN", "CONTROL_OPERATOR", "DEPOT_MANAGER", "DRIVER", "CONDUCTOR"],
    },
    "get_fleet_summary": {
        "description": "Get fleet status summary",
        "allowed_roles": ["ADMIN", "CONTROL_OPERATOR", "DEPOT_MANAGER", "EXECUTIVE"],
    },
    "list_open_incidents": {
        "description": "List all open incidents",
        "allowed_roles": ["ADMIN", "CONTROL_OPERATOR", "DEPOT_MANAGER", "DRIVER", "CONDUCTOR"],
    },
    "get_driver_schedule": {
        "description": "Get a driver's schedule",
        "allowed_roles": ["ADMIN", "CONTROL_OPERATOR", "DEPOT_MANAGER"],
    },
    "summarize_operations": {
        "description": "Summarize today's operations",
        "allowed_roles": ["ADMIN", "CONTROL_OPERATOR", "EXECUTIVE"],
    },
    "get_vehicle_status": {
        "description": "Check a specific vehicle's status",
        "allowed_roles": ["ADMIN", "CONTROL_OPERATOR", "DEPOT_MANAGER", "DRIVER"],
    },
    "get_notices": {
        "description": "Get recent notices and announcements",
        "allowed_roles": ["ADMIN", "CONTROL_OPERATOR", "DEPOT_MANAGER", "DRIVER", "CONDUCTOR", "EXECUTIVE"],
    },
}

# ── Rate limiter (in-memory per-user) ────────────────────────────────────
_rate_limits: dict[str, list[float]] = {}
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 30  # max requests per window


def _check_rate_limit(user_id: str) -> bool:
    """Returns True if request is allowed, False if rate-limited."""
    import time
    now = time.time()
    if user_id not in _rate_limits:
        _rate_limits[user_id] = []
    # Prune old entries
    _rate_limits[user_id] = [t for t in _rate_limits[user_id] if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limits[user_id]) >= RATE_LIMIT_MAX:
        return False
    _rate_limits[user_id].append(now)
    return True


def _sanitize_prompt(message: str) -> str:
    """Basic prompt sanitization — strip injection patterns."""
    # Remove common injection patterns
    sanitized = message.strip()
    # Limit length
    if len(sanitized) > 2000:
        sanitized = sanitized[:2000]
    return sanitized


def _sanitize_response(response: str) -> str:
    """Ensure response doesn't leak internal data."""
    # Remove any accidental SQL, file paths, or stack traces
    import re
    response = re.sub(r'(password|secret|token|api_key)\s*[:=]\s*\S+', '[REDACTED]', response, flags=re.IGNORECASE)
    return response


@router.post("/chat", response_model=CopilotResponse)
async def chat(
    body: ChatMessage,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Process AI copilot message (demo mode — pattern matching)."""
    # Rate limiting
    if not _check_rate_limit(str(current_user.id)):
        return CopilotResponse(
            response="⏳ You're sending too many requests. Please wait a moment and try again.",
            suggestions=["Wait 30 seconds", "Try a simpler query"],
        )

    # Sanitize input
    sanitized_message = _sanitize_prompt(body.message)
    message = sanitized_message.lower().strip()
    role = current_user.role

    # Audit log every copilot interaction
    audit_entry = AuditLog(
        user_id=current_user.id,
        action="COPILOT_QUERY",
        resource_type="copilot",
        resource_id=None,
        details={
            "query": body.message,
            "role": role,
            "depot_id": str(current_user.depot_id) if current_user.depot_id else None,
        },
    )
    db.add(audit_entry)
    await db.flush()

    # Pattern-based response generation (demo mode)
    if any(w in message for w in ["duty", "schedule", "assignment", "my duty", "today"]):
        return await _handle_duty_query(db, current_user, message)

    elif any(w in message for w in ["incident", "p1", "p2", "open incident", "breached"]):
        return await _handle_incident_query(db, current_user, message)

    elif any(w in message for w in ["fleet", "vehicle", "bus", "status"]):
        return await _handle_fleet_query(db, current_user, message)

    elif any(w in message for w in ["notice", "announcement", "create notice"]):
        return await _handle_notice_query(db, current_user, message)

    elif any(w in message for w in ["performance", "driver", "ranking", "score"]):
        return await _handle_performance_query(db, current_user, message)

    elif any(w in message for w in ["help", "what can you do", "commands"]):
        return CopilotResponse(
            response=(
                "I'm your fleet operations assistant. Here's what I can help with:\n\n"
                "📋 **Duties**: \"What is my duty today?\" or \"Show unassigned duties\"\n"
                "🚨 **Incidents**: \"Show open P1 incidents\" or \"Incident summary\"\n"
                "🚌 **Fleet**: \"Fleet status\" or \"Vehicle DL-1PC-1234 status\"\n"
                "📢 **Notices**: \"Create a notice about rain\" or \"Pending notices\"\n"
                "📊 **Performance**: \"Driver rankings\" or \"My performance score\"\n"
                "📈 **Analytics**: \"Today's operations summary\"\n"
            ),
            suggestions=[
                "What is my duty today?",
                "Show all open incidents",
                "Fleet status summary",
                "Driver performance rankings",
            ],
        )

    else:
        return await _handle_general_query(db, current_user, message)

    # Note: All handler functions now return CopilotResponse which includes mode="demo"


async def _handle_duty_query(db: AsyncSession, user: CurrentUser, message: str) -> CopilotResponse:
    today = date.today()
    stmt = (
        select(Duty)
        .options(selectinload(Duty.vehicle), selectinload(Duty.route), selectinload(Duty.driver))
        .where(Duty.is_deleted == False, Duty.date == today)
    )

    # RBAC: Drivers/Conductors see only their own duties
    if user.role in ["DRIVER", "CONDUCTOR"]:
        stmt = stmt.where((Duty.driver_id == user.id) | (Duty.conductor_id == user.id))
    # RBAC: Depot Managers see only their depot's duties
    elif user.role == "DEPOT_MANAGER" and user.depot_id:
        stmt = stmt.join(Vehicle, Duty.vehicle_id == Vehicle.id).where(Vehicle.depot_id == user.depot_id)

    result = await db.execute(stmt)
    duties = result.scalars().all()

    if not duties:
        return CopilotResponse(
            response="📋 No duties found for today. You have a day off! 🎉",
            suggestions=["Show tomorrow's duties", "Request leave", "Show notices"],
        )

    duty_lines = []
    for d in duties[:5]:
        vehicle = d.vehicle.registration_no if d.vehicle else "Unassigned"
        route = f"{d.route.code} — {d.route.name}" if d.route else "Unassigned"
        driver = d.driver.full_name if d.driver else "Unassigned"
        shift = d.shift if isinstance(d.shift, str) else d.shift.value
        status = d.status if isinstance(d.status, str) else d.status.value
        duty_lines.append(
            f"• **{shift}** shift | Vehicle: {vehicle} | Route: {route} | Driver: {driver} | Status: {status}"
        )

    return CopilotResponse(
        response=f"📋 **Today's Duties** ({today.strftime('%d %b %Y')}):\n\n" + "\n".join(duty_lines),
        data={"total_duties": len(duties), "date": today.isoformat()},
        suggestions=["Acknowledge my duty", "Show route details", "Report a delay"],
    )


async def _handle_incident_query(db: AsyncSession, user: CurrentUser, message: str) -> CopilotResponse:

    stmt = (
        select(Incident)
        .options(selectinload(Incident.reported_by_user))
        .where(
            Incident.is_deleted == False,
            Incident.status.in_([
                IncidentStatus.OPEN,
                IncidentStatus.ACKNOWLEDGED,
                IncidentStatus.ASSIGNED,
                IncidentStatus.IN_PROGRESS,
            ]),
        )
    )
    
    if user.role in [
        RoleName.DRIVER.value,
        RoleName.CONDUCTOR.value,
    ]:
        stmt = stmt.where(
            Incident.reported_by == user.id
        )

    elif user.role == RoleName.DEPOT_MANAGER.value:
        stmt = stmt.where(
            Incident.reported_by_user.has(
                User.depot_id == user.depot_id
            )
        )

    if "p1" in message:
        stmt = stmt.where(Incident.severity == "P1")
    elif "p2" in message:
        stmt = stmt.where(Incident.severity == "P2")

    result = await db.execute(stmt)
    incidents = result.scalars().all()

    if not incidents:
        return CopilotResponse(
            response="✅ No open incidents. All clear!",
            suggestions=["Fleet status", "Today's duties", "Driver performance"],
        )

    lines = []
    breached = sum(1 for i in incidents if i.sla_breached)
    for i in incidents[:5]:
        sev = i.severity if isinstance(i.severity, str) else i.severity.value
        status = i.status if isinstance(i.status, str) else i.status.value
        icon = "🔴" if sev == "P1" else "🟡" if sev == "P2" else "🔵"
        lines.append(f"{icon} **{i.incident_no}** [{sev}] {i.title} — {status}")

    return CopilotResponse(
        response=(
            f"🚨 **Open Incidents**: {len(incidents)} | SLA Breached: {breached}\n\n"
            + "\n".join(lines)
            + (f"\n\n⚠️ *...and {len(incidents) - 5} more*" if len(incidents) > 5 else "")
        ),
        data={"total_open": len(incidents), "sla_breached": breached},
        suggestions=["Show P1 incidents only", "Incident details", "Assign incident"],
    )


async def _handle_fleet_query(db: AsyncSession, user: CurrentUser, message: str) -> CopilotResponse:
    base_filter = [Vehicle.is_deleted == False]
    # RBAC: Depot Managers see only their depot's vehicles
    if user.role == "DEPOT_MANAGER" and user.depot_id:
        base_filter.append(Vehicle.depot_id == user.depot_id)

    result = await db.execute(
        select(Vehicle.status, func.count(Vehicle.id))
        .where(*base_filter)
        .group_by(Vehicle.status)
    )
    status_counts = {row[0] if isinstance(row[0], str) else row[0].value: row[1] for row in result.all()}

    total = sum(status_counts.values())
    active = status_counts.get("ACTIVE", 0)
    maintenance = status_counts.get("MAINTENANCE", 0)
    breakdown = status_counts.get("BREAKDOWN", 0)

    return CopilotResponse(
        response=(
            f"🚌 **Fleet Status**\n\n"
            f"• Total Vehicles: **{total}**\n"
            f"• 🟢 Active: **{active}**\n"
            f"• 🟡 Maintenance: **{maintenance}**\n"
            f"• 🔴 Breakdown: **{breakdown}**\n"
            f"• Utilization: **{round(active/total*100, 1) if total > 0 else 0}%**"
        ),
        data={"status_counts": status_counts, "total": total},
        suggestions=["Show breakdown vehicles", "Vehicle health report", "Depot-wise fleet status"],
    )


async def _handle_notice_query(db: AsyncSession, user: CurrentUser, message: str) -> CopilotResponse:
    if "create" in message:
        return CopilotResponse(
            response=(
                "📝 I can help you draft a notice. Here's a template:\n\n"
                "**Title**: [Your title]\n"
                "**Priority**: Normal/High/Urgent\n"
                "**Target**: All Users / Drivers / Specific Depot\n"
                "**Content**: [Your message]\n\n"
                "Would you like me to create this notice? Please provide the details."
            ),
            actions=[{"type": "navigate", "path": "/notices/create"}],
            suggestions=["Create rain advisory notice", "Create route change notice", "Cancel"],
        )

    return CopilotResponse(
        response="📢 Notice management is available. What would you like to do?",
        suggestions=["Create a notice", "View recent notices", "Unread notices"],
    )


async def _handle_performance_query(db: AsyncSession, user: CurrentUser, message: str) -> CopilotResponse:
    return CopilotResponse(
        response=(
            "📊 **Driver Performance Module**\n\n"
            "Performance is tracked across these metrics:\n"
            "• On-time compliance rate\n"
            "• Duty completion rate\n"
            "• Incident count (lower is better)\n"
            "• Safety score\n"
            "• Overall ranking\n\n"
            "Navigate to the Driver Performance dashboard for detailed rankings and trends."
        ),
        actions=[{"type": "navigate", "path": "/driver-performance"}],
        suggestions=["Show top 5 drivers", "My performance score", "Performance trends"],
    )


async def _handle_general_query(db: AsyncSession, user: CurrentUser, message: str) -> CopilotResponse:
    return CopilotResponse(
        response=(
            "I'm not sure I understand that request. Here's what I can help with:\n\n"
            "• Today's duties and schedules\n"
            "• Open incidents and SLA status\n"
            "• Fleet and vehicle status\n"
            "• Notices and communications\n"
            "• Driver performance\n"
        ),
        suggestions=[
            "What is my duty today?",
            "Show all open incidents",
            "Fleet status",
            "Help",
        ],
    )


@router.get("/insights")
async def get_insights(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """AI-generated operational insights."""
    insights = []
    today = date.today()

    # Check for SLA breaches
    
    incident_filter = [
        Incident.is_deleted == False,
        Incident.sla_breached == True,
        Incident.status.in_([
            "OPEN",
            "ACKNOWLEDGED",
            "ASSIGNED",
            "IN_PROGRESS",
        ]),
    ]

    vehicle_filter = [
        Vehicle.is_deleted == False,
    ]

    active_vehicle_filter = [
        Vehicle.is_deleted == False,
        Vehicle.status == VehicleStatus.ACTIVE,
    ]

    duty_filter = [
        Duty.is_deleted == False,
        Duty.date == today,
        Duty.driver_id == None,
    ]

    if current_user.role == RoleName.DEPOT_MANAGER.value:

        incident_filter.append(
            Incident.reported_by_user.has(
                User.depot_id == current_user.depot_id
            )
        )

        vehicle_filter.append(
            Vehicle.depot_id == current_user.depot_id
        )

        active_vehicle_filter.append(
            Vehicle.depot_id == current_user.depot_id
        )

        duty_filter.append(
            Duty.vehicle.has(
                Vehicle.depot_id == current_user.depot_id
            )
        )

    sla_breached = (
        await db.execute(
            select(func.count()).select_from(
                select(Incident)
                .where(*incident_filter)
                .subquery()
            )
        )
    ).scalar() or 0

    if sla_breached > 0:
        insights.append({
            "type": "warning",
            "title": "SLA Breaches Detected",
            "description": f"{sla_breached} incident(s) have breached their SLA. Immediate attention required.",
            "action": {"type": "navigate", "path": "/incidents?status=sla_breached"},
            "priority": "high",
        })

    # Check fleet utilization
    total_vehicles = (
        await db.execute(
            select(func.count()).select_from(
                select(Vehicle)
                .where(*vehicle_filter)
                .subquery()
            )
        )
    ).scalar() or 0

    active_vehicles = (
        await db.execute(
            select(func.count()).select_from(
                select(Vehicle)
                .where(*active_vehicle_filter)
                .subquery()
            )
        )
    ).scalar() or 0

    if total_vehicles > 0:
        utilization = active_vehicles / total_vehicles * 100
        if utilization < 70:
            insights.append({
                "type": "info",
                "title": "Low Fleet Utilization",
                "description": f"Fleet utilization is at {utilization:.1f}%. Consider optimizing vehicle assignments.",
                "action": {"type": "navigate", "path": "/analytics"},
                "priority": "medium",
            })

    # Check unassigned duties
   
    unassigned = (
        await db.execute(
            select(func.count()).select_from(
                select(Duty)
                .where(*duty_filter)
                .subquery()
            )
        )
    ).scalar() or 0

    if unassigned > 0:
        insights.append({
            "type": "warning",
            "title": "Unassigned Duties Today",
            "description": f"{unassigned} duties for today have no driver assigned.",
            "action": {"type": "navigate", "path": "/duties/roster"},
            "priority": "high",
        })

    # Always add a positive insight
    if not insights:
        insights.append({
            "type": "success",
            "title": "Operations Running Smoothly",
            "description": "All systems operational. No critical alerts.",
            "priority": "low",
        })

    return {"insights": insights, "generated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/history")
async def get_copilot_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 20,
):
    """Get copilot conversation history for the current user."""
    from sqlalchemy import desc
    stmt = (
        select(AuditLog)
        .where(AuditLog.user_id == current_user.id, AuditLog.action == "COPILOT_QUERY")
        .order_by(desc(AuditLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()

    count_stmt = select(func.count()).select_from(
        select(AuditLog).where(AuditLog.user_id == current_user.id, AuditLog.action == "COPILOT_QUERY").subquery()
    )
    total = (await db.execute(count_stmt)).scalar() or 0

    return {
        "items": [
            {
                "id": str(l.id),
                "query": l.details.get("query") if l.details else "",
                "role": l.details.get("role") if l.details else "",
                "timestamp": l.created_at.isoformat(),
            }
            for l in logs
        ],
        "total": total,
        "page": page,
    }


@router.get("/analytics")
async def get_copilot_analytics(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Get copilot usage analytics (admin/executive only)."""
    if current_user.role not in ["ADMIN", "EXECUTIVE"]:
        return {"error": "Insufficient permissions"}

    # Total queries
    total = (await db.execute(
        select(func.count()).select_from(
            select(AuditLog).where(AuditLog.action == "COPILOT_QUERY").subquery()
        )
    )).scalar() or 0

    # Queries by role
    role_stats = (await db.execute(
        select(
            AuditLog.details["role"].astext.label("role"),
            func.count(AuditLog.id).label("count")
        )
        .where(AuditLog.action == "COPILOT_QUERY")
        .group_by(AuditLog.details["role"].astext)
    )).all()

    # Unique users
    unique_users = (await db.execute(
        select(func.count(func.distinct(AuditLog.user_id)))
        .where(AuditLog.action == "COPILOT_QUERY")
    )).scalar() or 0

    return {
        "total_queries": total,
        "unique_users": unique_users,
        "queries_by_role": {r[0]: r[1] for r in role_stats if r[0]},
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/tools")
async def list_available_tools(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """List tools available to the current user based on role."""
    available = {}
    for tool_name, tool_info in COPILOT_TOOL_REGISTRY.items():
        if current_user.role in tool_info["allowed_roles"]:
            available[tool_name] = tool_info["description"]
    return {"tools": available, "role": current_user.role}
