"""
SQLAlchemy models — All database tables for the NCRTC Fleet Management Platform.
Organized as a single models module for Phase 2, with all 20+ tables.
"""

import uuid
from datetime import datetime, timezone, date, time

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, AuditMixin


# =============================================================================
# ENUMS
# =============================================================================

import enum


class VehicleStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    MAINTENANCE = "MAINTENANCE"
    BREAKDOWN = "BREAKDOWN"
    RETIRED = "RETIRED"


class VehicleType(str, enum.Enum):
    BUS = "BUS"
    MINIBUS = "MINIBUS"
    ELECTRIC_BUS = "ELECTRIC_BUS"
    AC_BUS = "AC_BUS"
    METRO_FEEDER = "METRO_FEEDER"


class DutyStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ShiftType(str, enum.Enum):
    MORNING = "MORNING"
    AFTERNOON = "AFTERNOON"
    EVENING = "EVENING"
    NIGHT = "NIGHT"
    SPLIT = "SPLIT"


class IncidentType(str, enum.Enum):
    BREAKDOWN = "BREAKDOWN"
    ACCIDENT = "ACCIDENT"
    DELAY = "DELAY"
    COMPLAINT = "COMPLAINT"
    SECURITY = "SECURITY"
    ROUTE_DEVIATION = "ROUTE_DEVIATION"
    OTHER = "OTHER"


class IncidentSeverity(str, enum.Enum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"


class IncidentStatus(str, enum.Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class NoticeTargetType(str, enum.Enum):
    ALL = "ALL"
    ROLE = "ROLE"
    DEPOT = "DEPOT"
    INDIVIDUAL = "INDIVIDUAL"


class NoticePriority(str, enum.Enum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


class NotificationType(str, enum.Enum):
    DUTY_ASSIGNED = "DUTY_ASSIGNED"
    DUTY_PUBLISHED = "DUTY_PUBLISHED"
    INCIDENT_ASSIGNED = "INCIDENT_ASSIGNED"
    INCIDENT_ESCALATION = "INCIDENT_ESCALATION"
    NOTICE_PUBLISHED = "NOTICE_PUBLISHED"
    GEOFENCE_BREACH = "GEOFENCE_BREACH"
    ROUTE_DEVIATION = "ROUTE_DEVIATION"
    LEAVE_STATUS = "LEAVE_STATUS"
    SYSTEM = "SYSTEM"


class LeaveStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class MaintenanceStatus(str, enum.Enum):
    OK = "OK"
    SERVICE_DUE = "SERVICE_DUE"
    OVERDUE = "OVERDUE"
    IN_SERVICE = "IN_SERVICE"


class ReportType(str, enum.Enum):
    DAILY_FLEET = "DAILY_FLEET"
    DEPOT = "DEPOT"
    VEHICLE = "VEHICLE"
    DRIVER = "DRIVER"
    INCIDENT = "INCIDENT"
    UTILIZATION = "UTILIZATION"


class ReportFormat(str, enum.Enum):
    PDF = "PDF"
    CSV = "CSV"
    EXCEL = "EXCEL"


class StopType(str, enum.Enum):
    REGULAR = "REGULAR"
    TERMINAL = "TERMINAL"
    DEPOT = "DEPOT"
    EXPRESS = "EXPRESS"


# =============================================================================
# MODELS
# =============================================================================


class Depot(AuditMixin, Base):
    """Fleet depots / garages."""
    __tablename__ = "depots"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str] = mapped_column(String(100), default="NCR")
    state: Mapped[str] = mapped_column(String(100), default="Delhi NCR")
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location = Column(Geometry("POINT", srid=4326), nullable=True)
    geofence = Column(Geometry("POLYGON", srid=4326), nullable=True)
    geofence_radius_m: Mapped[float] = mapped_column(Float, default=500.0)
    capacity: Mapped[int] = mapped_column(Integer, default=50)
    contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    vehicles = relationship("Vehicle", back_populates="depot", lazy="selectin")
    users = relationship("User", back_populates="depot", lazy="selectin")
    routes = relationship("Route", back_populates="depot", lazy="selectin")


class Role(Base):
    """System roles."""
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    users = relationship("User", back_populates="role", lazy="selectin")
    permissions = relationship("RolePermission", back_populates="role", lazy="selectin", cascade="all, delete-orphan")


class PermissionModel(Base):
    """Permission definitions."""
    __tablename__ = "permissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), default="general")

    # Relationships
    roles = relationship("RolePermission", back_populates="permission", lazy="selectin")


class RolePermission(Base):
    """Many-to-many: Role ↔ Permission."""
    __tablename__ = "role_permissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    permission_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("permissions.id"), nullable=False)

    role = relationship("Role", back_populates="permissions")
    permission = relationship("PermissionModel", back_populates="roles")

    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )


class User(AuditMixin, Base):
    """Platform users — admins, operators, drivers, conductors, executives."""
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    employee_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Foreign keys
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    depot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("depots.id"), nullable=True)

    # Relationships
    role = relationship("Role", back_populates="users", lazy="joined")
    depot = relationship("Depot", back_populates="users", lazy="joined")
    driver_duties = relationship("Duty", back_populates="driver", foreign_keys="[Duty.driver_id]", lazy="selectin")
    conductor_duties = relationship("Duty", back_populates="conductor", foreign_keys="[Duty.conductor_id]", lazy="selectin")
    reported_incidents = relationship("Incident", back_populates="reported_by_user", foreign_keys="[Incident.reported_by]", lazy="selectin")
    assigned_incidents = relationship("Incident", back_populates="assigned_to_user", foreign_keys="[Incident.assigned_to]", lazy="selectin")
    notifications = relationship("Notification", back_populates="user", lazy="selectin")
    leave_requests = relationship("LeaveRequest",back_populates="user",foreign_keys="LeaveRequest.user_id",lazy="selectin")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class Vehicle(AuditMixin, Base):
    """Fleet vehicles."""
    __tablename__ = "vehicles"

    registration_no: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    vehicle_type: Mapped[str] = mapped_column(SAEnum(VehicleType), default=VehicleType.BUS)
    make: Mapped[str] = mapped_column(String(100), default="Tata")
    model: Mapped[str] = mapped_column(String(100), default="Starbus")
    year: Mapped[int] = mapped_column(Integer, default=2023)
    capacity: Mapped[int] = mapped_column(Integer, default=40)
    status: Mapped[str] = mapped_column(SAEnum(VehicleStatus), default=VehicleStatus.ACTIVE)
    color: Mapped[str] = mapped_column(String(50), default="White")
    chassis_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    engine_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    insurance_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    fitness_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_heading: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_gps_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ignition_on: Mapped[bool] = mapped_column(Boolean, default=False)

    # Foreign keys
    depot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("depots.id"), nullable=False)

    # Relationships
    depot = relationship("Depot", back_populates="vehicles", lazy="joined")
    health = relationship("VehicleHealth", back_populates="vehicle", uselist=False, lazy="joined")
    duties = relationship("Duty", back_populates="vehicle", lazy="selectin")
    gps_pings = relationship("GPSPing", back_populates="vehicle", lazy="noload")
    incidents = relationship("Incident", back_populates="vehicle", lazy="selectin")


class VehicleHealth(AuditMixin, Base):
    """Vehicle health and maintenance tracking."""
    __tablename__ = "vehicle_health"

    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vehicles.id"), unique=True, nullable=False
    )
    fuel_level: Mapped[float] = mapped_column(Float, default=100.0)  # percentage
    odometer: Mapped[float] = mapped_column(Float, default=0.0)  # km
    engine_hours: Mapped[float] = mapped_column(Float, default=0.0)
    last_service_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_service_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    maintenance_status: Mapped[str] = mapped_column(
        SAEnum(MaintenanceStatus), default=MaintenanceStatus.OK
    )
    health_score: Mapped[float] = mapped_column(Float, default=100.0)  # 0-100
    tire_pressure_ok: Mapped[bool] = mapped_column(Boolean, default=True)
    engine_temp_ok: Mapped[bool] = mapped_column(Boolean, default=True)
    battery_voltage: Mapped[float] = mapped_column(Float, default=12.6)
    brake_status_ok: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    vehicle = relationship("Vehicle", back_populates="health")


class Route(AuditMixin, Base):
    """Transit routes."""
    __tablename__ = "routes"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    geometry = Column(Geometry("LINESTRING", srid=4326), nullable=True)
    distance_km: Mapped[float] = mapped_column(Float, default=0.0)
    estimated_duration_mins: Mapped[int] = mapped_column(Integer, default=60)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_circular: Mapped[bool] = mapped_column(Boolean, default=False)
    frequency_mins: Mapped[int] = mapped_column(Integer, default=15)  # headway
    first_departure: Mapped[time | None] = mapped_column(Time, nullable=True)
    last_departure: Mapped[time | None] = mapped_column(Time, nullable=True)
    color: Mapped[str] = mapped_column(String(20), default="#3B82F6")

    # Foreign keys
    depot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("depots.id"), nullable=False)

    # Relationships
    depot = relationship("Depot", back_populates="routes", lazy="joined")
    route_stops = relationship("RouteStop", back_populates="route", lazy="selectin", order_by="RouteStop.sequence")
    duties = relationship("Duty", back_populates="route", lazy="selectin")


class Stop(AuditMixin, Base):
    """Transit stops / stations."""
    __tablename__ = "stops"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location = Column(Geometry("POINT", srid=4326), nullable=True)
    stop_type: Mapped[str] = mapped_column(SAEnum(StopType), default=StopType.REGULAR)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    shelter_available: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    route_stops = relationship("RouteStop", back_populates="stop", lazy="selectin")


class RouteStop(Base):
    """Ordered stops within a route."""
    __tablename__ = "route_stops"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=False)
    stop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stops.id"), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    distance_from_start_km: Mapped[float] = mapped_column(Float, default=0.0)
    scheduled_arrival_offset_mins: Mapped[int] = mapped_column(Integer, default=0)
    scheduled_departure_offset_mins: Mapped[int] = mapped_column(Integer, default=0)
    is_timing_point: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    route = relationship("Route", back_populates="route_stops")
    stop = relationship("Stop", back_populates="route_stops")

    __table_args__ = (
        UniqueConstraint("route_id", "sequence", name="uq_route_stop_sequence"),
        Index("ix_route_stops_route_id", "route_id"),
    )


class Duty(AuditMixin, Base):
    """Daily duty assignments."""
    __tablename__ = "duties"

    date: Mapped[date] = mapped_column(Date, nullable=False)
    shift: Mapped[str] = mapped_column(SAEnum(ShiftType), default=ShiftType.MORNING)
    status: Mapped[str] = mapped_column(SAEnum(DutyStatus), default=DutyStatus.DRAFT)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    actual_start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Foreign keys
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=True)
    driver_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    conductor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    route_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=True)

    # Relationships
    vehicle = relationship("Vehicle", back_populates="duties", lazy="joined")
    driver = relationship("User", back_populates="driver_duties", foreign_keys=[driver_id], lazy="joined")
    conductor = relationship("User", back_populates="conductor_duties", foreign_keys=[conductor_id], lazy="joined")
    route = relationship("Route", back_populates="duties", lazy="joined")

    __table_args__ = (
        Index("ix_duties_date", "date"),
        Index("ix_duties_driver_date", "driver_id", "date"),
        Index("ix_duties_vehicle_date", "vehicle_id", "date"),
    )


class GPSPing(Base):
    """Vehicle GPS telemetry data — high-volume, time-series."""
    __tablename__ = "gps_pings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location = Column(Geometry("POINT", srid=4326), nullable=True)
    speed: Mapped[float] = mapped_column(Float, default=0.0)  # km/h
    heading: Mapped[float] = mapped_column(Float, default=0.0)  # degrees
    altitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    ignition_on: Mapped[bool] = mapped_column(Boolean, default=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False #, index=True
    )

    # Relationships
    vehicle = relationship("Vehicle", back_populates="gps_pings")

    __table_args__ = (
        Index("ix_gps_pings_vehicle_timestamp", "vehicle_id", "timestamp"),
        Index("ix_gps_pings_timestamp", "timestamp"),
    )


class Incident(AuditMixin, Base):
    """Incident records — breakdowns, accidents, delays, etc."""
    __tablename__ = "incidents"

    incident_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    incident_type: Mapped[str] = mapped_column(SAEnum(IncidentType), nullable=False)
    severity: Mapped[str] = mapped_column(SAEnum(IncidentSeverity), default=IncidentSeverity.P3)
    status: Mapped[str] = mapped_column(SAEnum(IncidentStatus), default=IncidentStatus.OPEN)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    location = Column(Geometry("POINT", srid=4326), nullable=True)
    location_description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sla_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sla_breached: Mapped[bool] = mapped_column(Boolean, default=False)

    # Foreign keys
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=True)
    reported_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    vehicle = relationship("Vehicle", back_populates="incidents", lazy="joined")
    reported_by_user = relationship("User", back_populates="reported_incidents", foreign_keys=[reported_by], lazy="joined")
    assigned_to_user = relationship("User", back_populates="assigned_incidents", foreign_keys=[assigned_to], lazy="joined")
    events = relationship("IncidentEvent", back_populates="incident", lazy="selectin", order_by="IncidentEvent.created_at")

    __table_args__ = (
        Index("ix_incidents_status", "status"),
        Index("ix_incidents_severity", "severity"),
        Index("ix_incidents_type_status", "incident_type", "status"),
    )


class IncidentEvent(Base):
    """Incident timeline events."""
    __tablename__ = "incident_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # created, assigned, acknowledged, note, resolved, closed
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    incident = relationship("Incident", back_populates="events")

    __table_args__ = (
        Index("ix_incident_events_incident_id", "incident_id"),
    )


class Notice(AuditMixin, Base):
    """CMS notices and communications."""
    __tablename__ = "notices"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(20), default="markdown")  # markdown, html, plain
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(SAEnum(NoticePriority), default=NoticePriority.NORMAL)
    target_type: Mapped[str] = mapped_column(SAEnum(NoticeTargetType), default=NoticeTargetType.ALL)
    target_roles: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # ["DRIVER", "CONDUCTOR"]
    target_depot_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    target_user_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attachment_urls: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    language: Mapped[str] = mapped_column(String(10), default="en")  # en, hi

    # Foreign keys
    published_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    reads = relationship("NoticeRead", back_populates="notice", lazy="selectin")

    __table_args__ = (
        Index("ix_notices_published", "is_published"),
        Index("ix_notices_target_type", "target_type"),
    )


class NoticeRead(Base):
    """Track which users have read/acknowledged notices."""
    __tablename__ = "notice_reads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    notice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("notices.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    read_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    notice = relationship("Notice", back_populates="reads")

    __table_args__ = (
        UniqueConstraint("notice_id", "user_id", name="uq_notice_read_user"),
    )


class Notification(AuditMixin, Base):
    """In-app notifications."""
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notification_type: Mapped[str] = mapped_column(SAEnum(NotificationType), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    user = relationship("User", back_populates="notifications")

    __table_args__ = (
        Index("ix_notifications_user_read", "user_id", "is_read"),
    )


class AuditLog(Base):
    """System audit trail — tracks all significant actions."""
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        Index("ix_audit_logs_user_id", "user_id"),
        Index("ix_audit_logs_resource", "resource_type", "resource_id"),
        Index("ix_audit_logs_created_at", "created_at"),
    )


class Report(AuditMixin, Base):
    """Generated reports."""
    __tablename__ = "reports"

    report_type: Mapped[str] = mapped_column(SAEnum(ReportType), nullable=False)
    report_format: Mapped[str] = mapped_column(SAEnum(ReportFormat), default=ReportFormat.PDF)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    parameters: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    generated_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="completed")  # pending, generating, completed, failed


class LeaveRequest(AuditMixin, Base):
    """Driver / conductor leave requests."""
    __tablename__ = "leave_requests"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    leave_type: Mapped[str] = mapped_column(String(50), default="casual")  # casual, sick, emergency, planned
    status: Mapped[str] = mapped_column(SAEnum(LeaveStatus), default=LeaveStatus.PENDING)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="leave_requests", foreign_keys=[user_id])

    __table_args__ = (
        Index("ix_leave_requests_user_dates", "user_id", "start_date", "end_date"),
    )
