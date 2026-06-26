"""
GPS Simulator — Autonomous real-time vehicle movement engine.

Runs as a background asyncio task inside FastAPI's lifespan.
Vehicles follow their assigned routes (Route → RouteStops → Stops),
with realistic speed profiles, acceleration, braking, station dwell
times, and terminal reversals.

Produces:
  - Continuous Vehicle table updates (last_latitude, last_longitude, etc.)
  - Continuous GPSPing inserts (historical telemetry)
  - WebSocket broadcasts via gps_manager for live frontend updates
"""

from __future__ import annotations

import asyncio
import logging
import math
import random
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.database import async_session_factory
from app.core.websocket import gps_manager
from app.models import (
    Vehicle, VehicleStatus, Route, RouteStop, Stop, Duty, GPSPing,
)

logger = logging.getLogger("gps_simulator")
logger.setLevel(logging.INFO)

settings = get_settings()


# =============================================================================
# Constants
# =============================================================================

# Speed profile ranges (km/h)  — each vehicle gets a random value within range
SPEED_DEPARTING = (15, 30)
SPEED_ACCELERATING = (35, 50)
SPEED_CRUISING = (60, 80)
SPEED_BRAKING = (20, 35)

# Acceleration / deceleration per tick (km/h per tick)
ACCEL_RATE = (3.0, 6.0)   # how fast the vehicle speeds up per tick
DECEL_RATE = (4.0, 7.0)   # how fast the vehicle slows down per tick

# Station dwell time (seconds)
DWELL_TIME_RANGE = (15, 30)

# Braking zone — start braking when progress > this fraction of a segment
BRAKING_ZONE_THRESHOLD = 0.70

# Earth radius in metres for haversine
EARTH_RADIUS_M = 6_371_000


# =============================================================================
# Enums
# =============================================================================

class MovementPhase(str, Enum):
    """Phases of vehicle movement between stations."""
    STOPPED = "STOPPED"
    DEPARTING = "DEPARTING"
    ACCELERATING = "ACCELERATING"
    CRUISING = "CRUISING"
    BRAKING = "BRAKING"


# =============================================================================
# Data classes
# =============================================================================

@dataclass
class Waypoint:
    """A single waypoint on the route (derived from RouteStop → Stop)."""
    latitude: float
    longitude: float
    stop_name: str
    stop_id: uuid.UUID


@dataclass
class CachedRoute:
    """Pre-loaded route data to avoid per-tick database reads."""
    route_id: uuid.UUID
    route_name: str
    waypoints: list[Waypoint] = field(default_factory=list)
    segment_distances_m: list[float] = field(default_factory=list)


@dataclass
class VehicleState:
    """In-memory simulation state for a single vehicle."""
    vehicle_id: uuid.UUID
    registration_no: str

    # Route assignment
    assigned_route: Optional[CachedRoute] = None

    # Position on route
    current_segment: int = 0       # index into route waypoints (from-stop)
    progress: float = 0.0          # 0.0–1.0 progress between current pair

    # Direction: +1 = forward through waypoints, -1 = reverse
    direction: int = 1

    # Speed (km/h)
    current_speed: float = 0.0
    target_speed: float = 0.0

    # Per-vehicle "personality" — randomized once at init
    cruise_speed: float = 70.0     # individual cruising speed
    accel_rate: float = 4.5        # km/h gained per tick
    decel_rate: float = 5.5        # km/h lost per tick

    # Heading (compass degrees, 0=north, 90=east)
    heading: float = 0.0

    # Station stop state
    waiting_at_station: bool = False
    wait_until: Optional[datetime] = None

    # Movement phase
    phase: MovementPhase = MovementPhase.STOPPED

    # Current interpolated position
    latitude: float = 0.0
    longitude: float = 0.0


# =============================================================================
# Utilities
# =============================================================================

def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in metres."""
    rlat1, rlon1 = math.radians(lat1), math.radians(lon1)
    rlat2, rlon2 = math.radians(lat2), math.radians(lon2)
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    return EARTH_RADIUS_M * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def compute_heading(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute compass bearing from point 1 to point 2 (0–360 degrees)."""
    rlat1, rlon1 = math.radians(lat1), math.radians(lon1)
    rlat2, rlon2 = math.radians(lat2), math.radians(lon2)
    dlon = rlon2 - rlon1
    x = math.sin(dlon) * math.cos(rlat2)
    y = math.cos(rlat1) * math.sin(rlat2) - math.sin(rlat1) * math.cos(rlat2) * math.cos(dlon)
    bearing = math.degrees(math.atan2(x, y))
    return (bearing + 360) % 360


def interpolate_position(wp_a: Waypoint, wp_b: Waypoint, t: float) -> tuple[float, float]:
    """Linearly interpolate between two waypoints. t in [0, 1]."""
    t = max(0.0, min(1.0, t))
    lat = wp_a.latitude + (wp_b.latitude - wp_a.latitude) * t
    lon = wp_a.longitude + (wp_b.longitude - wp_a.longitude) * t
    return lat, lon


# =============================================================================
# GPS Simulator
# =============================================================================

class GPSSimulator:
    """
    Autonomous GPS simulation engine.

    Lifecycle:
        simulator = GPSSimulator()
        await simulator.start()   # called in lifespan startup
        ...
        await simulator.stop()    # called in lifespan shutdown
    """

    def __init__(self) -> None:
        self._task: Optional[asyncio.Task] = None
        self._running = False
        self._vehicle_states: list[VehicleState] = []
        self._route_cache: dict[uuid.UUID, CachedRoute] = {}
        self._tick_interval: float = float(settings.GPS_SIMULATOR_INTERVAL_SECONDS)

    # ── Public API ──────────────────────────────────────────────────────

    async def start(self) -> None:
        """Initialize simulation state and begin the background loop."""
        if not settings.GPS_SIMULATOR_ENABLED:
            logger.info("GPS Simulator is disabled via config.")
            return

        logger.info("🚦 GPS Simulator starting...")
        await self._load_routes()
        await self._load_vehicles()

        if not self._vehicle_states:
            logger.warning("No active vehicles found — simulator idle.")
            return

        self._running = True
        self._task = asyncio.create_task(self._main_loop(), name="gps-simulator")
        logger.info(
            "📡 GPS Simulator running — %d vehicles, %d routes, interval=%ss",
            len(self._vehicle_states),
            len(self._route_cache),
            self._tick_interval,
        )

    async def stop(self) -> None:
        """Gracefully shut down the simulator."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("📡 GPS Simulator stopped.")

    # ── Data Loading ────────────────────────────────────────────────────

    async def _load_routes(self) -> None:
        """Load all active routes with their ordered stops into cache."""
        async with async_session_factory() as session:
            stmt = (
                select(Route)
                .where(Route.is_active == True)
                .options(
                    selectinload(Route.route_stops).selectinload(RouteStop.stop)
                )
            )
            result = await session.execute(stmt)
            routes = result.scalars().all()

            for route in routes:
                ordered_stops = sorted(route.route_stops, key=lambda rs: rs.sequence)
                waypoints = [
                    Waypoint(
                        latitude=rs.stop.latitude,
                        longitude=rs.stop.longitude,
                        stop_name=rs.stop.name,
                        stop_id=rs.stop.id,
                    )
                    for rs in ordered_stops
                    if rs.stop is not None
                ]

                if len(waypoints) < 2:
                    continue  # Need at least 2 stops to simulate movement

                # Pre-compute segment distances
                seg_distances = []
                for i in range(len(waypoints) - 1):
                    dist = haversine_distance_m(
                        waypoints[i].latitude, waypoints[i].longitude,
                        waypoints[i + 1].latitude, waypoints[i + 1].longitude,
                    )
                    seg_distances.append(max(dist, 1.0))  # floor at 1m to avoid /0

                cached = CachedRoute(
                    route_id=route.id,
                    route_name=route.name,
                    waypoints=waypoints,
                    segment_distances_m=seg_distances,
                )
                self._route_cache[route.id] = cached

        logger.info("🛤️  Loaded %d routes into cache.", len(self._route_cache))

    async def _load_vehicles(self) -> None:
        """Load active vehicles, assign routes, create initial states."""
        if not self._route_cache:
            logger.warning("No routes cached — cannot assign vehicles.")
            return

        today = datetime.now(timezone.utc).date()
        route_list = list(self._route_cache.values())

        async with async_session_factory() as session:
            # Load ACTIVE vehicles
            v_stmt = (
                select(Vehicle)
                .where(Vehicle.status == VehicleStatus.ACTIVE, Vehicle.is_deleted == False)
            )
            v_result = await session.execute(v_stmt)
            vehicles = v_result.scalars().all()

            # Load today's duties to find route assignments
            d_stmt = (
                select(Duty)
                .where(Duty.date == today, Duty.route_id.isnot(None), Duty.vehicle_id.isnot(None))
            )
            d_result = await session.execute(d_stmt)
            duties = d_result.scalars().all()

            # Build vehicle → route mapping from duties
            duty_route_map: dict[uuid.UUID, uuid.UUID] = {}
            for duty in duties:
                if duty.vehicle_id and duty.route_id:
                    duty_route_map[duty.vehicle_id] = duty.route_id

        # Group vehicles by route to compute staggered offsets
        route_vehicle_groups: dict[uuid.UUID, list[Vehicle]] = {}

        for vehicle in vehicles:
            # Determine route: duty first, then random
            route_id = duty_route_map.get(vehicle.id)
            cached_route: Optional[CachedRoute] = None

            if route_id and route_id in self._route_cache:
                cached_route = self._route_cache[route_id]
            else:
                cached_route = random.choice(route_list)

            if cached_route is None:
                continue

            if cached_route.route_id not in route_vehicle_groups:
                route_vehicle_groups[cached_route.route_id] = []
            route_vehicle_groups[cached_route.route_id].append(vehicle)

        # Create vehicle states with staggered offsets
        for route_id, group_vehicles in route_vehicle_groups.items():
            cached_route = self._route_cache[route_id]
            total_segments = len(cached_route.waypoints) - 1

            for idx, vehicle in enumerate(group_vehicles):
                # Distribute vehicles evenly across the route
                if len(group_vehicles) > 1:
                    total_route_progress = idx / len(group_vehicles)
                    # Convert total route progress to segment + progress within segment
                    segment_float = total_route_progress * total_segments
                    segment_idx = int(segment_float)
                    segment_progress = segment_float - segment_idx
                    segment_idx = min(segment_idx, total_segments - 1)
                else:
                    segment_idx = random.randint(0, max(0, total_segments - 1))
                    segment_progress = random.uniform(0.1, 0.9)

                # Randomize vehicle "personality"
                cruise = random.uniform(*SPEED_CRUISING)
                accel = random.uniform(*ACCEL_RATE)
                decel = random.uniform(*DECEL_RATE)

                # Compute initial position
                wp_a = cached_route.waypoints[segment_idx]
                wp_b = cached_route.waypoints[segment_idx + 1]
                lat, lon = interpolate_position(wp_a, wp_b, segment_progress)

                # Random initial direction for variety
                direction = random.choice([1, -1])

                # Start at a random cruising speed (already in motion)
                initial_speed = random.uniform(40, cruise)

                state = VehicleState(
                    vehicle_id=vehicle.id,
                    registration_no=vehicle.registration_no,
                    assigned_route=cached_route,
                    current_segment=segment_idx,
                    progress=segment_progress,
                    direction=direction,
                    current_speed=initial_speed,
                    target_speed=cruise,
                    cruise_speed=cruise,
                    accel_rate=accel,
                    decel_rate=decel,
                    heading=compute_heading(wp_a.latitude, wp_a.longitude,
                                            wp_b.latitude, wp_b.longitude),
                    phase=MovementPhase.CRUISING,
                    latitude=lat,
                    longitude=lon,
                )
                self._vehicle_states.append(state)

        logger.info(
            "🚆 Initialized %d vehicle states across %d routes.",
            len(self._vehicle_states),
            len(route_vehicle_groups),
        )

    # ── Main Simulation Loop ────────────────────────────────────────────

    async def _main_loop(self) -> None:
        """Background loop — tick all vehicles and persist/broadcast."""
        logger.info("🔄 Simulation loop started (interval=%.1fs)", self._tick_interval)

        while self._running:
            try:
                tick_start = asyncio.get_event_loop().time()

                # Tick every vehicle independently (fault-tolerant)
                for state in self._vehicle_states:
                    try:
                        self._tick_vehicle(state, self._tick_interval)
                    except Exception:
                        logger.exception(
                            "Error ticking vehicle %s (%s) — skipping",
                            state.registration_no, state.vehicle_id,
                        )

                # Persist to DB and broadcast via WebSocket
                await self._persist_and_broadcast()

                # Sleep for the remainder of the interval
                elapsed = asyncio.get_event_loop().time() - tick_start
                sleep_time = max(0.1, self._tick_interval - elapsed)
                await asyncio.sleep(sleep_time)

            except asyncio.CancelledError:
                logger.info("Simulation loop cancelled.")
                break
            except Exception:
                logger.exception("Unhandled error in simulation loop — recovering in 5s")
                await asyncio.sleep(5.0)

    # ── Per-Vehicle Physics ─────────────────────────────────────────────

    def _tick_vehicle(self, state: VehicleState, dt: float) -> None:
        """
        Advance one vehicle by dt seconds.

        Physics flow:
        1. If waiting at station and dwell time not expired → stay still.
        2. If dwell time expired → depart.
        3. Compute target speed based on phase.
        4. Smoothly approach target speed (acceleration / braking).
        5. Convert speed to distance, then to route progress.
        6. Detect station arrival, terminal reversal.
        7. Update heading and interpolated position.
        """
        route = state.assigned_route
        if route is None or len(route.waypoints) < 2:
            return

        now = datetime.now(timezone.utc)

        # ── Station dwell ───────────────────────────────────────────────
        if state.waiting_at_station:
            if state.wait_until and now < state.wait_until:
                # Still dwelling — stay at speed 0
                state.current_speed = 0.0
                state.target_speed = 0.0
                state.phase = MovementPhase.STOPPED
                return
            else:
                # Dwell time expired — depart
                state.waiting_at_station = False
                state.wait_until = None
                state.phase = MovementPhase.DEPARTING
                state.target_speed = random.uniform(*SPEED_DEPARTING)

        # ── Phase-based target speed ────────────────────────────────────
        if state.phase == MovementPhase.DEPARTING:
            state.target_speed = random.uniform(*SPEED_DEPARTING)
            if state.current_speed >= SPEED_DEPARTING[0]:
                state.phase = MovementPhase.ACCELERATING

        elif state.phase == MovementPhase.ACCELERATING:
            state.target_speed = random.uniform(*SPEED_ACCELERATING)
            if state.current_speed >= SPEED_ACCELERATING[0]:
                state.phase = MovementPhase.CRUISING

        elif state.phase == MovementPhase.CRUISING:
            state.target_speed = state.cruise_speed

        elif state.phase == MovementPhase.BRAKING:
            # Gradually bring down to 0
            remaining_progress = 1.0 - state.progress
            if remaining_progress < 0.1:
                state.target_speed = 0.0
            else:
                state.target_speed = max(0.0, state.cruise_speed * remaining_progress * 1.5)
                state.target_speed = min(state.target_speed, random.uniform(*SPEED_BRAKING))

        # ── Smooth speed adjustment ─────────────────────────────────────
        if state.current_speed < state.target_speed:
            state.current_speed = min(
                state.current_speed + state.accel_rate,
                state.target_speed,
            )
        elif state.current_speed > state.target_speed:
            state.current_speed = max(
                state.current_speed - state.decel_rate,
                state.target_speed,
            )

        # Clamp speed to non-negative
        state.current_speed = max(0.0, state.current_speed)

        # ── Distance from speed ─────────────────────────────────────────
        # speed (km/h) → m/s → distance in metres
        distance_m = (state.current_speed / 3.6) * dt

        if distance_m < 0.01:
            # Effectively stationary — update position but don't advance
            self._update_interpolated_position(state)
            return

        # ── Convert distance to route progress ─────────────────────────
        max_segment = len(route.waypoints) - 2  # last valid segment index

        segment_length = route.segment_distances_m[state.current_segment]
        progress_delta = distance_m / segment_length
        state.progress += progress_delta

        # ── Advance through segments ────────────────────────────────────
        while state.progress >= 1.0 and self._has_next_segment(state, max_segment):
            state.progress -= 1.0
            next_seg = state.current_segment + state.direction

            # Check if we've arrived at the next stop → station dwell
            state.current_segment = next_seg

            # Trigger station stop
            state.waiting_at_station = True
            dwell = random.uniform(*DWELL_TIME_RANGE)
            state.wait_until = now + timedelta(seconds=dwell)
            state.current_speed = 0.0
            state.target_speed = 0.0
            state.phase = MovementPhase.STOPPED
            state.progress = 0.0  # At the start of the new segment

            # Update position to exact station coordinates
            self._update_interpolated_position(state)
            return

        # ── Terminal reversal check ─────────────────────────────────────
        if not self._has_next_segment(state, max_segment) and state.progress >= 1.0:
            # Arrived at terminal station
            state.progress = 0.0
            state.direction *= -1  # Reverse direction
            state.waiting_at_station = True
            dwell = random.uniform(*DWELL_TIME_RANGE) + 10  # Longer dwell at terminal
            state.wait_until = now + timedelta(seconds=dwell)
            state.current_speed = 0.0
            state.target_speed = 0.0
            state.phase = MovementPhase.STOPPED

            # Snap to the terminal station
            if state.direction == 1:
                # Was going forward, now reversing from the end
                # Stay at current segment start
                pass
            else:
                # Was going backward, now reversing from the beginning
                state.current_segment = 0

            self._update_interpolated_position(state)
            return

        # ── Braking zone detection ──────────────────────────────────────
        if state.progress > BRAKING_ZONE_THRESHOLD and state.phase != MovementPhase.BRAKING:
            state.phase = MovementPhase.BRAKING

        # ── Update position & heading ───────────────────────────────────
        self._update_interpolated_position(state)

    def _has_next_segment(self, state: VehicleState, max_segment: int) -> bool:
        """Check if there's a next segment in the current direction."""
        next_seg = state.current_segment + state.direction
        return 0 <= next_seg <= max_segment

    def _update_interpolated_position(self, state: VehicleState) -> None:
        """Compute current lat/lon and heading from route progress."""
        route = state.assigned_route
        if route is None:
            return

        max_segment = len(route.waypoints) - 2
        seg = max(0, min(state.current_segment, max_segment))

        # Determine the two waypoints for interpolation based on direction
        if state.direction == 1:
            wp_from = route.waypoints[seg]
            wp_to = route.waypoints[seg + 1]
        else:
            # Reverse: swap from/to so progress still goes 0→1
            wp_from = route.waypoints[seg + 1]
            wp_to = route.waypoints[seg]

        lat, lon = interpolate_position(wp_from, wp_to, state.progress)
        state.latitude = lat
        state.longitude = lon

        # Update heading (direction of travel)
        state.heading = compute_heading(
            wp_from.latitude, wp_from.longitude,
            wp_to.latitude, wp_to.longitude,
        )

    # ── Database Persistence & WebSocket Broadcast ──────────────────────

    async def _persist_and_broadcast(self) -> None:
        """
        Batch-update Vehicle rows, insert GPSPing records, and
        broadcast updates over WebSocket — all in one DB transaction.
        """
        now = datetime.now(timezone.utc)

        # Prepare broadcast payloads (built before DB to minimize lock time)
        broadcast_payloads: list[dict] = []

        try:
            async with async_session_factory() as session:
                for state in self._vehicle_states:
                    if state.assigned_route is None:
                        continue

                    # Update Vehicle row
                    await session.execute(
                        update(Vehicle)
                        .where(Vehicle.id == state.vehicle_id)
                        .values(
                            last_latitude=round(state.latitude, 6),
                            last_longitude=round(state.longitude, 6),
                            last_speed=round(state.current_speed, 1),
                            last_heading=round(state.heading, 1),
                            last_gps_time=now,
                            ignition_on=True,
                        )
                    )

                    # Insert GPSPing
                    ping = GPSPing(
                        id=uuid.uuid4(),
                        vehicle_id=state.vehicle_id,
                        latitude=round(state.latitude, 6),
                        longitude=round(state.longitude, 6),
                        speed=round(state.current_speed, 1),
                        heading=round(state.heading, 1),
                        ignition_on=True,
                        timestamp=now,
                    )
                    session.add(ping)

                    # Build broadcast payload
                    broadcast_payloads.append({
                        "type": "gps_update",
                        "vehicle_id": str(state.vehicle_id),
                        "registration_no": state.registration_no,
                        "latitude": round(state.latitude, 6),
                        "longitude": round(state.longitude, 6),
                        "speed": round(state.current_speed, 1),
                        "heading": round(state.heading, 1),
                        "timestamp": now.isoformat(),
                    })

                await session.commit()

        except Exception:
            logger.exception("Database persistence error — will retry next tick")
            return

        # Broadcast via WebSocket (outside DB transaction)
        if gps_manager.connection_count > 0:
            for payload in broadcast_payloads:
                try:
                    await gps_manager.broadcast(payload)
                except Exception:
                    logger.exception("WebSocket broadcast error for vehicle %s", payload.get("vehicle_id"))

            logger.debug(
                "📡 Broadcast %d vehicle updates to %d clients",
                len(broadcast_payloads),
                gps_manager.connection_count,
            )


# =============================================================================
# Module-level singleton
# =============================================================================

gps_simulator = GPSSimulator()
