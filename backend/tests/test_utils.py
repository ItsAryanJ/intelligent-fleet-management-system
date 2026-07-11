"""
Test: Utilities — haversine distance, sanitize functions.
"""

from app.core.utils import haversine_km


class TestHaversine:
    """Unit tests for haversine_km utility."""

    def test_same_point_zero_distance(self):
        """Same coordinates should return 0 distance."""
        assert haversine_km(28.6139, 77.2090, 28.6139, 77.2090) == 0.0

    def test_known_distance_delhi_meerut(self):
        """Delhi to Meerut is approximately 70 km."""
        dist = haversine_km(28.6139, 77.2090, 28.9845, 77.7064)
        assert 55 < dist < 85  # Reasonable range

    def test_short_distance(self):
        """Two points a few hundred meters apart."""
        dist = haversine_km(28.5894, 77.2556, 28.5894, 77.2606)
        assert 0.3 < dist < 0.7  # Should be roughly 0.5 km

    def test_negative_coordinates(self):
        """Haversine should work with negative lat/lon (southern hemisphere)."""
        dist = haversine_km(-33.8688, 151.2093, -33.8700, 151.2100)
        assert dist > 0
        assert dist < 1  # Very close points


class TestFileUploadSecurity:
    """Test file upload sanitization functions."""

    def test_sanitize_filename_removes_path(self):
        """Sanitize should strip directory traversal."""
        from app.features.uploads.router import _sanitize_filename
        result = _sanitize_filename("../../etc/passwd")
        assert ".." not in result

    def test_sanitize_filename_keeps_safe_chars(self):
        """Sanitize should keep alphanumeric, dots, hyphens, underscores."""
        from app.features.uploads.router import _sanitize_filename
        result = _sanitize_filename("my-photo_2024.jpg")
        assert "my-photo_2024.jpg" in result

    def test_sanitize_filename_handles_empty(self):
        """Empty filename should produce a non-empty result."""
        from app.features.uploads.router import _sanitize_filename
        result = _sanitize_filename("")
        assert len(result) > 0
