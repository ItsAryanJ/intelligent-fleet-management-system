"""
Core utility functions shared across features.
"""

import math


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth
    using the Haversine formula.

    Args:
        lat1, lon1: Latitude/longitude of point 1 (in degrees).
        lat2, lon2: Latitude/longitude of point 2 (in degrees).

    Returns:
        Distance in kilometers.
    """
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return 6371.0 * c  # Earth radius in km


def point_to_segment_distance_km(
    lat: float, lon: float,
    seg_lat1: float, seg_lon1: float,
    seg_lat2: float, seg_lon2: float,
) -> float:
    """
    Approximate distance from a point to a line segment on the Earth's surface.
    Uses projection onto the segment to find the nearest point.

    Returns:
        Distance in kilometers from the point to the nearest point on the segment.
    """
    # Convert to radians
    lat, lon = math.radians(lat), math.radians(lon)
    lat1, lon1 = math.radians(seg_lat1), math.radians(seg_lon1)
    lat2, lon2 = math.radians(seg_lat2), math.radians(seg_lon2)

    # Vector from A to B
    d_lat = lat2 - lat1
    d_lon = lon2 - lon1

    # If segment is a point, return distance to that point
    seg_len_sq = d_lat ** 2 + d_lon ** 2
    if seg_len_sq < 1e-12:
        return haversine_km(math.degrees(lat), math.degrees(lon),
                           math.degrees(lat1), math.degrees(lon1))

    # Project point onto segment, clamped to [0, 1]
    t = max(0, min(1, ((lat - lat1) * d_lat + (lon - lon1) * d_lon) / seg_len_sq))

    proj_lat = lat1 + t * d_lat
    proj_lon = lon1 + t * d_lon

    return haversine_km(math.degrees(lat), math.degrees(lon),
                       math.degrees(proj_lat), math.degrees(proj_lon))
