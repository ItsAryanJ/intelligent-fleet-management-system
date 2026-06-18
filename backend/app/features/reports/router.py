"""
Reports feature — Generate PDF/CSV/Excel reports.
"""

from typing import Annotated, Optional
from uuid import UUID
from datetime import datetime, timezone, date
import csv
import io
import json

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission
from app.core.permissions import Permission, RoleName
from app.models import (
    Report, ReportType, ReportFormat,
    Vehicle, Incident, Duty, User, Depot,
)
from app.core.exceptions import ForbiddenException

router = APIRouter()


class ReportRequest(BaseModel):
    report_type: str
    report_format: str = "CSV"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    depot_id: Optional[UUID] = None


@router.get("")
async def list_reports(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.REPORT_VIEW))],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
):
    """List generated reports."""
    stmt = select(Report)

    if current_user.role == RoleName.DEPOT_MANAGER.value:   
        stmt = stmt.where(
            Report.parameters["depot_id"].astext
            == str(current_user.depot_id)
        )

    stmt = stmt.order_by(Report.generated_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    reports = result.scalars().all()

    return {
        "items": [
            {
                "id": str(r.id),
                "report_type": r.report_type if isinstance(r.report_type, str) else r.report_type.value,
                "report_format": r.report_format if isinstance(r.report_format, str) else r.report_format.value,
                "title": r.title,
                "status": r.status,
                "generated_at": r.generated_at.isoformat(),
            }
            for r in reports
        ]
    }


@router.post("/generate")
async def generate_report(
    body: ReportRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_permission(Permission.REPORT_GENERATE))],
):
    """Generate a report and return it as a download (CSV or PDF)."""

    if current_user.role == RoleName.DEPOT_MANAGER.value:
        if (
            body.depot_id
            and body.depot_id != current_user.depot_id
        ):
            raise ForbiddenException(
                "Cannot generate reports for another depot"
            )

        # Force manager to own depot
        body.depot_id = current_user.depot_id

    if (
        current_user.role == RoleName.DEPOT_MANAGER.value
        and body.report_type == "EXECUTIVE"
    ):
        raise ForbiddenException(
            "Executive reports are not available for Depot Managers"
        )
    now = datetime.now(timezone.utc)

    if body.report_type == "DAILY_FLEET":
        data = await _generate_fleet_report(db, body)
        title = f"Fleet Report - {now.strftime('%Y-%m-%d')}"
    elif body.report_type == "INCIDENT":
        data = await _generate_incident_report(db, body)
        title = f"Incident Report - {now.strftime('%Y-%m-%d')}"
    elif body.report_type == "DRIVER":
        data = await _generate_driver_report(db, body)
        title = f"Driver Report - {now.strftime('%Y-%m-%d')}"
    elif body.report_type == "EXECUTIVE":
        data = await _generate_fleet_report(db, body)
        title = f"Executive Summary - {now.strftime('%Y-%m-%d')}"
    elif body.report_type == "DEPOT":
        data = await _generate_fleet_report(db, body)
        title = f"Depot Report - {now.strftime('%Y-%m-%d')}"
    elif body.report_type == "UTILIZATION":
        data = await _generate_fleet_report(db, body)
        title = f"Utilization Report - {now.strftime('%Y-%m-%d')}"
    else:
        data = await _generate_fleet_report(db, body)
        title = f"Report - {now.strftime('%Y-%m-%d')}"

    # Save report record
    report = Report(
        report_type=body.report_type,
        report_format=body.report_format,
        title=title,
        parameters={"start_date": str(body.start_date), 
                    "end_date": str(body.end_date),
                    "depot_id": str(body.depot_id) if body.depot_id else None,},
        generated_by=current_user.id,
        status="completed",
    )
    db.add(report)
    await db.flush()
    await db.commit()

    # Return PDF
    if body.report_format == "PDF":
        from app.features.reports.pdf_generator import (
            generate_fleet_pdf, generate_incident_pdf,
            generate_driver_pdf, generate_executive_pdf,
        )

        if body.report_type == "INCIDENT":
            kpis = {
                "total": len(data),
                "p1": sum(1 for d in data if d.get("Severity") == "P1"),
                "p2": sum(1 for d in data if d.get("Severity") == "P2"),
                "sla_breached": sum(1 for d in data if d.get("SLA Breached") == "Yes"),
                "resolution_rate": round(
                    sum(1 for d in data if d.get("Status") == "RESOLVED") / max(len(data), 1) * 100
                ),
            }
            pdf_bytes = generate_incident_pdf(data, kpis)
        elif body.report_type == "DRIVER":
            pdf_bytes = generate_driver_pdf([
                {**d, "rank": i + 1, "name": d.get("Name", ""), "employee_id": d.get("Employee ID", ""),
                 "total_duties": 0, "completed_duties": 0, "compliance_percent": 0,
                 "safety_score": 0, "overall_score": 0}
                for i, d in enumerate(data)
            ])
        elif body.report_type in ("EXECUTIVE",):
            # Gather live KPIs
            v_count = (await db.execute(select(func.count(Vehicle.id)).where(Vehicle.is_deleted == False))).scalar() or 0
            i_count = (await db.execute(select(func.count(Incident.id)).where(Incident.is_deleted == False))).scalar() or 0
            u_count = (await db.execute(select(func.count(User.id)).where(User.is_deleted == False))).scalar() or 0
            d_count = (await db.execute(select(func.count(Depot.id)).where(Depot.is_deleted == False))).scalar() or 0
            kpis = {
                "total_vehicles": v_count, "active_vehicles": v_count,
                "utilization_percent": 78, "open_incidents": i_count,
                "resolution_rate": 85, "total_users": u_count,
                "total_routes": 0, "total_depots": d_count,
                "todays_duties": 0, "sla_breached_30d": 0,
            }
            pdf_bytes = generate_executive_pdf(kpis)
        else:
            kpis = {
                "total": len(data),
                "active": sum(1 for d in data if d.get("Status") == "ACTIVE"),
                "maintenance": sum(1 for d in data if d.get("Status") == "MAINTENANCE"),
                "breakdown": sum(1 for d in data if d.get("Status") == "BREAKDOWN"),
                "utilization": round(
                    sum(1 for d in data if d.get("Status") == "ACTIVE") / max(len(data), 1) * 100
                ),
            }
            pdf_bytes = generate_fleet_pdf(data, kpis)

        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={title.replace(' ', '_')}.pdf"},
        )

    # Return CSV
    if body.report_format == "CSV":
        output = io.StringIO()
        if data:
            writer = csv.DictWriter(output, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={title.replace(' ', '_')}.csv"},
        )

    return {"report_id": str(report.id), "title": title, "data": data}


async def _generate_fleet_report(
    db: AsyncSession,
    params: ReportRequest,
) -> list[dict]:

    stmt = select(Vehicle).where(
        Vehicle.is_deleted == False
    )

    if params.depot_id:
        stmt = stmt.where(
            Vehicle.depot_id == params.depot_id
        )

    stmt = stmt.order_by(Vehicle.registration_no)

    result = await db.execute(stmt)
    vehicles = result.scalars().all()

    return [
        {
            "Registration No": v.registration_no,
            "Type": v.vehicle_type if isinstance(v.vehicle_type, str) else v.vehicle_type.value,
            "Make": v.make,
            "Model": v.model,
            "Status": v.status if isinstance(v.status, str) else v.status.value,
            "Year": v.year,
        }
        for v in vehicles
    ]


async def _generate_incident_report(db: AsyncSession, params: ReportRequest) -> list[dict]:
    stmt = select(Incident).where(
    Incident.is_deleted == False
    )

    if params.depot_id:
        stmt = stmt.where(
            Incident.reported_by_user.has(
                User.depot_id == params.depot_id
            )
        )

    stmt = stmt.order_by(
        Incident.created_at.desc()
    )

    result = await db.execute(stmt)
    incidents = result.scalars().all()
    return [
        {
            "Incident No": i.incident_no,
            "Type": i.incident_type if isinstance(i.incident_type, str) else i.incident_type.value,
            "Severity": i.severity if isinstance(i.severity, str) else i.severity.value,
            "Status": i.status if isinstance(i.status, str) else i.status.value,
            "Title": i.title,
            "SLA Breached": "Yes" if i.sla_breached else "No",
            "Created At": i.created_at.isoformat(),
        }
        for i in incidents
    ]


async def _generate_driver_report(db: AsyncSession, params: ReportRequest) -> list[dict]:
    from app.models import Role
    driver_role = await db.execute(select(Role).where(Role.name == "DRIVER"))
    role = driver_role.scalar_one_or_none()
    if not role:
        return []

    stmt = select(User).where(
        User.role_id == role.id,
        User.is_deleted == False,
    )

    if params.depot_id:
        stmt = stmt.where(
            User.depot_id == params.depot_id
        )

    result = await db.execute(stmt)
    drivers = result.scalars().all()

    return [
        {
            "Employee ID": d.employee_id,
            "Name": d.full_name,
            "Email": d.email,
            "Active": "Yes" if d.is_active else "No",
        }
        for d in drivers
    ]
