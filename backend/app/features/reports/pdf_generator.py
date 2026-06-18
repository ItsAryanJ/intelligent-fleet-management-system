"""
PDF Report Generator — Uses ReportLab to generate branded PDF reports.
Supports fleet, incident, driver, executive, depot, and utilization reports.
"""

import io
from datetime import datetime, timezone, date, timedelta
from typing import Optional
from uuid import UUID

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
    PageBreak, HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT


# ── Brand Colors ─────────────────────────────────────────────────────────
BRAND_PRIMARY = colors.HexColor("#2563EB")
BRAND_DARK = colors.HexColor("#1E293B")
BRAND_LIGHT = colors.HexColor("#F8FAFC")
BRAND_BORDER = colors.HexColor("#E2E8F0")


def _build_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        "ReportTitle", parent=styles["Title"],
        fontSize=22, textColor=BRAND_DARK, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "ReportSubtitle", parent=styles["Normal"],
        fontSize=10, textColor=colors.gray, spaceAfter=20,
    ))
    styles.add(ParagraphStyle(
        "SectionHeader", parent=styles["Heading2"],
        fontSize=14, textColor=BRAND_PRIMARY, spaceBefore=16, spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "KPIValue", parent=styles["Normal"],
        fontSize=20, textColor=BRAND_DARK, alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        "KPILabel", parent=styles["Normal"],
        fontSize=8, textColor=colors.gray, alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        "FooterStyle", parent=styles["Normal"],
        fontSize=7, textColor=colors.gray, alignment=TA_CENTER,
    ))
    return styles


def _header_footer(canvas, doc):
    """Add branded header and footer to each page."""
    canvas.saveState()
    # Header line
    canvas.setStrokeColor(BRAND_PRIMARY)
    canvas.setLineWidth(2)
    canvas.line(50, A4[1] - 40, A4[0] - 50, A4[1] - 40)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(BRAND_PRIMARY)
    canvas.drawString(50, A4[1] - 35, "NCRTC Fleet Management Platform")
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.gray)
    canvas.drawRightString(A4[0] - 50, A4[1] - 35, f"Generated: {datetime.now().strftime('%d %b %Y, %H:%M')}")
    # Footer
    canvas.setStrokeColor(BRAND_BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(50, 40, A4[0] - 50, 40)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.gray)
    canvas.drawString(50, 28, "Confidential — NCRTC Internal Use Only")
    canvas.drawRightString(A4[0] - 50, 28, f"Page {doc.page}")
    canvas.restoreState()


def _build_table(headers: list[str], rows: list[list], col_widths=None):
    """Build a styled table."""
    data = [headers] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, -1), 7),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, BRAND_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BRAND_LIGHT]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def _build_kpi_row(kpis: list[tuple[str, str]]):
    """Build a KPI summary row."""
    data = [[kpi[1] for kpi in kpis], [kpi[0] for kpi in kpis]]
    t = Table(data)
    t.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 18),
        ("FONTSIZE", (0, 1), (-1, 1), 7),
        ("TEXTCOLOR", (0, 0), (-1, 0), BRAND_PRIMARY),
        ("TEXTCOLOR", (0, 1), (-1, 1), colors.gray),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("BOX", (0, 0), (-1, -1), 0.5, BRAND_BORDER),
    ]))
    return t


def generate_fleet_pdf(vehicles: list[dict], kpis: dict) -> bytes:
    """Generate Fleet Status PDF report."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=60, bottomMargin=60)
    styles = _build_styles()
    story = []

    story.append(Paragraph("Fleet Status Report", styles["ReportTitle"]))
    story.append(Paragraph(f"Report Date: {date.today().strftime('%d %B %Y')}", styles["ReportSubtitle"]))

    # KPIs
    story.append(_build_kpi_row([
        ("Total Vehicles", str(kpis.get("total", 0))),
        ("Active", str(kpis.get("active", 0))),
        ("Maintenance", str(kpis.get("maintenance", 0))),
        ("Breakdown", str(kpis.get("breakdown", 0))),
        ("Utilization", f"{kpis.get('utilization', 0)}%"),
    ]))
    story.append(Spacer(1, 16))

    # Table
    story.append(Paragraph("Vehicle Inventory", styles["SectionHeader"]))
    headers = ["Reg No", "Type", "Make", "Model", "Status", "Year"]
    rows = [[v.get(h, "—") for h in ["Registration No", "Type", "Make", "Model", "Status", "Year"]] for v in vehicles]
    story.append(_build_table(headers, rows[:100]))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()


def generate_incident_pdf(incidents: list[dict], kpis: dict) -> bytes:
    """Generate Incident Analysis PDF report."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=60, bottomMargin=60)
    styles = _build_styles()
    story = []

    story.append(Paragraph("Incident Analysis Report", styles["ReportTitle"]))
    story.append(Paragraph(f"Report Date: {date.today().strftime('%d %B %Y')}", styles["ReportSubtitle"]))

    story.append(_build_kpi_row([
        ("Total Incidents", str(kpis.get("total", len(incidents)))),
        ("P1 Critical", str(kpis.get("p1", 0))),
        ("P2 High", str(kpis.get("p2", 0))),
        ("SLA Breached", str(kpis.get("sla_breached", 0))),
        ("Resolution Rate", f"{kpis.get('resolution_rate', 0)}%"),
    ]))
    story.append(Spacer(1, 16))

    story.append(Paragraph("Incident Details", styles["SectionHeader"]))
    headers = ["Incident #", "Type", "Severity", "Status", "Title", "SLA"]
    rows = [[i.get(h, "—") for h in ["Incident No", "Type", "Severity", "Status", "Title", "SLA Breached"]] for i in incidents]
    story.append(_build_table(headers, rows[:100]))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()


def generate_driver_pdf(drivers: list[dict]) -> bytes:
    """Generate Driver Performance PDF report."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=60, bottomMargin=60)
    styles = _build_styles()
    story = []

    story.append(Paragraph("Driver Performance Report", styles["ReportTitle"]))
    story.append(Paragraph(f"Report Date: {date.today().strftime('%d %B %Y')}", styles["ReportSubtitle"]))

    story.append(Paragraph("Driver Rankings", styles["SectionHeader"]))
    headers = ["Rank", "Name", "Employee ID", "Duties", "Completed", "Compliance %", "Safety Score", "Overall"]
    rows = [
        [str(d.get("rank", "")), d.get("name", ""), d.get("employee_id", ""),
         str(d.get("total_duties", 0)), str(d.get("completed_duties", 0)),
         f"{d.get('compliance_percent', 0)}%", str(d.get("safety_score", 0)),
         str(d.get("overall_score", 0))]
        for d in drivers
    ]
    story.append(_build_table(headers, rows[:50]))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()


def generate_executive_pdf(kpis: dict) -> bytes:
    """Generate Executive Summary PDF."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=60, bottomMargin=60)
    styles = _build_styles()
    story = []

    story.append(Paragraph("Executive Summary", styles["ReportTitle"]))
    story.append(Paragraph(f"Report Date: {date.today().strftime('%d %B %Y')} | NCRTC Operations", styles["ReportSubtitle"]))

    story.append(Paragraph("Key Performance Indicators", styles["SectionHeader"]))
    story.append(_build_kpi_row([
        ("Fleet Size", str(kpis.get("total_vehicles", 0))),
        ("Active Vehicles", str(kpis.get("active_vehicles", 0))),
        ("Utilization", f"{kpis.get('utilization_percent', 0)}%"),
        ("Open Incidents", str(kpis.get("open_incidents", 0))),
        ("Resolution Rate", f"{kpis.get('resolution_rate', 0)}%"),
    ]))
    story.append(Spacer(1, 12))
    story.append(_build_kpi_row([
        ("Total Users", str(kpis.get("total_users", 0))),
        ("Active Routes", str(kpis.get("total_routes", 0))),
        ("Depots", str(kpis.get("total_depots", 0))),
        ("Today's Duties", str(kpis.get("todays_duties", 0))),
        ("SLA Breached", str(kpis.get("sla_breached_30d", 0))),
    ]))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()
