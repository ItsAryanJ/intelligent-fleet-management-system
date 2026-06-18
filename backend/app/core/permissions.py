"""
Permission constants and RBAC definitions.
"""

from enum import Enum


class RoleName(str, Enum):
    """System roles."""
    ADMIN = "ADMIN"
    CONTROL_OPERATOR = "CONTROL_OPERATOR"
    DEPOT_MANAGER = "DEPOT_MANAGER"
    DRIVER = "DRIVER"
    CONDUCTOR = "CONDUCTOR"
    EXECUTIVE = "EXECUTIVE"


class Permission(str, Enum):
    """Granular permission definitions."""

    # Vehicle
    VEHICLE_VIEW = "vehicle.view"
    VEHICLE_EDIT = "vehicle.edit"

    # Route
    ROUTE_VIEW = "route.view"
    ROUTE_EDIT = "route.edit"
    ROUTE_PUBLISH = "route.publish"

    # Duty
    DUTY_VIEW = "duty.view"
    DUTY_ASSIGN = "duty.assign"
    DUTY_PUBLISH = "duty.publish"

    # Incident
    INCIDENT_VIEW = "incident.view"
    INCIDENT_CREATE = "incident.create"
    INCIDENT_ASSIGN = "incident.assign"
    INCIDENT_RESOLVE = "incident.resolve"

    # Notice
    NOTICE_VIEW = "notice.view"
    NOTICE_PUBLISH = "notice.publish"
    NOTICE_READ = "notice.read"

    # Analytics
    ANALYTICS_VIEW = "analytics.view"

    # User Management
    USER_VIEW = "user.view"
    USER_MANAGE = "user.manage"

    # Depot
    DEPOT_VIEW = "depot.view"
    DEPOT_EDIT = "depot.edit"

    # Report
    REPORT_VIEW = "report.view"
    REPORT_GENERATE = "report.generate"

    # Audit
    AUDIT_VIEW = "audit.view"

    # Copilot
    COPILOT_USE = "copilot.use"

    # GPS
    GPS_VIEW = "gps.view"

    # Geofence
    GEOFENCE_VIEW = "geofence.view"
    GEOFENCE_MANAGE = "geofence.manage"

    # Leave
    LEAVE_REQUEST = "leave.request"
    LEAVE_APPROVE = "leave.approve"


# ── Role → Permission Mapping ────────────────────────────────────────────
ROLE_PERMISSIONS: dict[RoleName, list[Permission]] = {
    RoleName.ADMIN: list(Permission),  # All permissions

    RoleName.CONTROL_OPERATOR: [
        Permission.VEHICLE_VIEW,
        Permission.ROUTE_VIEW,
        Permission.DUTY_VIEW,
        Permission.DUTY_ASSIGN,
        Permission.DUTY_PUBLISH,
        Permission.INCIDENT_VIEW,
        Permission.INCIDENT_CREATE,
        Permission.INCIDENT_ASSIGN,
        Permission.INCIDENT_RESOLVE,
        Permission.NOTICE_VIEW,
        Permission.NOTICE_PUBLISH,
        Permission.NOTICE_READ,
        Permission.ANALYTICS_VIEW,
        Permission.GPS_VIEW,
        Permission.GEOFENCE_VIEW,
        Permission.REPORT_VIEW,
        Permission.REPORT_GENERATE,
        Permission.COPILOT_USE,
    ],

    RoleName.DEPOT_MANAGER: [
        Permission.VEHICLE_VIEW,
        Permission.VEHICLE_EDIT,
        Permission.ROUTE_VIEW,
        Permission.DUTY_VIEW,
        Permission.DUTY_ASSIGN,
        Permission.DUTY_PUBLISH,
        Permission.INCIDENT_VIEW,
        Permission.INCIDENT_CREATE,
        Permission.INCIDENT_ASSIGN,
        Permission.INCIDENT_RESOLVE,
        Permission.NOTICE_VIEW,
        Permission.NOTICE_PUBLISH,
        Permission.NOTICE_READ,
        Permission.ANALYTICS_VIEW,
        Permission.GPS_VIEW,
        Permission.GEOFENCE_VIEW,
        Permission.REPORT_VIEW,
        Permission.REPORT_GENERATE,
        Permission.COPILOT_USE,
        Permission.USER_VIEW,
        Permission.LEAVE_APPROVE,
        Permission.DEPOT_VIEW,
        Permission.DEPOT_EDIT,
        Permission.USER_MANAGE,
    ],

    RoleName.DRIVER: [
        Permission.DUTY_VIEW,
        Permission.INCIDENT_VIEW,
        Permission.INCIDENT_CREATE,
        Permission.NOTICE_VIEW,
        Permission.NOTICE_READ,
        Permission.COPILOT_USE,
        Permission.LEAVE_REQUEST,
        Permission.ROUTE_VIEW,
    ],

    RoleName.CONDUCTOR: [
        Permission.DUTY_VIEW,
        Permission.INCIDENT_VIEW,
        Permission.INCIDENT_CREATE,
        Permission.NOTICE_VIEW,
        Permission.NOTICE_READ,
        Permission.COPILOT_USE,
        Permission.LEAVE_REQUEST,
        Permission.ROUTE_VIEW,
    ],

    RoleName.EXECUTIVE: [
        Permission.VEHICLE_VIEW,
        Permission.ROUTE_VIEW,
        Permission.DUTY_VIEW,
        Permission.INCIDENT_VIEW,
        Permission.NOTICE_VIEW,
        Permission.NOTICE_READ,
        Permission.ANALYTICS_VIEW,
        Permission.GPS_VIEW,
        Permission.GEOFENCE_VIEW,
        Permission.REPORT_VIEW,
        Permission.COPILOT_USE,
    ],
}
