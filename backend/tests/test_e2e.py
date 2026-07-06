"""
NCRTC Fleet Management — End-to-End Test Matrix
Tests all critical paths: Auth, RBAC, CRUD, AVLS, Copilot, Reports, etc.
Run: pytest tests/test_e2e.py -v
"""

import pytest
import httpx
from datetime import date, timedelta

BASE_URL = "http://localhost:8000"

# ── Test fixtures ────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    """HTTP client for API tests."""
    return httpx.Client(base_url=BASE_URL, timeout=30.0)


@pytest.fixture(scope="module")
def admin_token(client):
    """Login as admin and get token."""
    res = client.post("/api/auth/login", json={
        "email": "admin@ncrtc.in",
        "password": "pass@123",
    })
    if res.status_code == 200:
        return res.json()["access_token"]
    pytest.skip("Admin login failed — seed data may not be loaded")


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ═══════════════════════════════════════════════════════════════════════
# MODULE 1: AUTHENTICATION
# ═══════════════════════════════════════════════════════════════════════

class TestAuthentication:
    def test_login_success(self, client):
        res = client.post("/api/auth/login", json={
            "email": "admin@ncrtc.in", "password": "password123",
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert "user" in data

    def test_login_invalid_credentials(self, client):
        res = client.post("/api/auth/login", json={
            "email": "nonexistent@ncrtc.in", "password": "wrong",
        })
        assert res.status_code in [401, 422]

    def test_protected_route_without_token(self, client):
        res = client.get("/api/vehicles")
        assert res.status_code in [401, 403]

    def test_protected_route_with_token(self, client, auth_headers):
        res = client.get("/api/vehicles", headers=auth_headers)
        assert res.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# MODULE 2: RBAC & PERMISSIONS
# ═══════════════════════════════════════════════════════════════════════

class TestRBAC:
    def test_admin_can_list_users(self, client, auth_headers):
        res = client.get("/api/users", headers=auth_headers)
        assert res.status_code == 200
        assert "items" in res.json()

    def test_admin_can_list_depots(self, client, auth_headers):
        res = client.get("/api/depots", headers=auth_headers)
        assert res.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# MODULE 3: VEHICLES CRUD
# ═══════════════════════════════════════════════════════════════════════

class TestVehicles:
    def test_list_vehicles(self, client, auth_headers):
        res = client.get("/api/vehicles", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_vehicle_has_required_fields(self, client, auth_headers):
        res = client.get("/api/vehicles?page_size=1", headers=auth_headers)
        if res.status_code == 200 and res.json().get("items"):
            v = res.json()["items"][0]
            assert "registration_no" in v or "id" in v


# ═══════════════════════════════════════════════════════════════════════
# MODULE 4: ROUTES
# ═══════════════════════════════════════════════════════════════════════

class TestRoutes:
    def test_list_routes(self, client, auth_headers):
        res = client.get("/api/routes", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        # Routes returns a flat list, not {items: [...]}
        assert isinstance(data, list)

    def test_route_has_stops(self, client, auth_headers):
        res = client.get("/api/routes", headers=auth_headers)
        if res.status_code == 200 and len(res.json()) > 0:
            route_id = res.json()[0]["id"]
            stops_res = client.get(f"/api/routes/{route_id}", headers=auth_headers)
            assert stops_res.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# MODULE 5: DUTIES / SCHEDULING
# ═══════════════════════════════════════════════════════════════════════

class TestDuties:
    def test_list_duties(self, client, auth_headers):
        res = client.get("/api/duties", headers=auth_headers)
        assert res.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# MODULE 6: INCIDENTS
# ═══════════════════════════════════════════════════════════════════════

class TestIncidents:
    def test_list_incidents(self, client, auth_headers):
        res = client.get("/api/incidents", headers=auth_headers)
        assert res.status_code == 200
        assert "items" in res.json()


# ═══════════════════════════════════════════════════════════════════════
# MODULE 7: NOTICES
# ═══════════════════════════════════════════════════════════════════════

class TestNotices:
    def test_list_notices(self, client, auth_headers):
        res = client.get("/api/notices", headers=auth_headers)
        assert res.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# MODULE 8: NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════════════

class TestNotifications:
    def test_list_notifications(self, client, auth_headers):
        res = client.get("/api/notifications", headers=auth_headers)
        assert res.status_code == 200

    def test_unread_count(self, client, auth_headers):
        res = client.get("/api/notifications/unread-count", headers=auth_headers)
        assert res.status_code == 200
        assert "count" in res.json()


# ═══════════════════════════════════════════════════════════════════════
# MODULE 9: REPORTS
# ═══════════════════════════════════════════════════════════════════════

class TestReports:
    def test_list_reports(self, client, auth_headers):
        res = client.get("/api/reports", headers=auth_headers)
        assert res.status_code == 200

    def test_generate_csv_report(self, client, auth_headers):
        res = client.post("/api/reports/generate", headers=auth_headers, json={
            "report_type": "DAILY_FLEET",
            "report_format": "CSV",
        })
        assert res.status_code == 200

    def test_generate_pdf_report(self, client, auth_headers):
        res = client.post("/api/reports/generate", headers=auth_headers, json={
            "report_type": "DAILY_FLEET",
            "report_format": "PDF",
        })
        assert res.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# MODULE 10: AUDIT
# ═══════════════════════════════════════════════════════════════════════

class TestAudit:
    def test_list_audit_logs(self, client, auth_headers):
        res = client.get("/api/audit", headers=auth_headers)
        assert res.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# MODULE 11: AI COPILOT
# ═══════════════════════════════════════════════════════════════════════

class TestCopilot:
    def test_chat_basic(self, client, auth_headers):
        res = client.post("/api/copilot/chat", headers=auth_headers, json={
            "message": "What is today's fleet status?",
        })
        assert res.status_code == 200
        assert "response" in res.json()

    def test_copilot_tools_list(self, client, auth_headers):
        res = client.get("/api/copilot/tools", headers=auth_headers)
        assert res.status_code == 200
        assert "tools" in res.json()

    def test_copilot_history(self, client, auth_headers):
        res = client.get("/api/copilot/history", headers=auth_headers)
        assert res.status_code == 200

    def test_copilot_analytics(self, client, auth_headers):
        res = client.get("/api/copilot/analytics", headers=auth_headers)
        assert res.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# MODULE 12: LEAVE MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════

class TestLeaves:
    def test_list_leaves(self, client, auth_headers):
        res = client.get("/api/leaves", headers=auth_headers)
        assert res.status_code == 200

    def test_create_leave_request(self, client, auth_headers):
        res = client.post("/api/leaves", headers=auth_headers, json={
            "start_date": str(date.today() + timedelta(days=10)),
            "end_date": str(date.today() + timedelta(days=12)),
            "reason": "Test leave request",
            "leave_type": "casual",
        })
        assert res.status_code in [200, 201]


# ═══════════════════════════════════════════════════════════════════════
# MODULE 13: GEOFENCE & ROUTE DEVIATION
# ═══════════════════════════════════════════════════════════════════════

class TestGeofence:
    def test_geofence_status(self, client, auth_headers):
        res = client.get("/api/geo/geofence/status", headers=auth_headers)
        assert res.status_code == 200

    def test_route_deviation_summary(self, client, auth_headers):
        res = client.get("/api/geo/route-deviation/summary", headers=auth_headers)
        assert res.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# MODULE 14: SYSTEM HEALTH
# ═══════════════════════════════════════════════════════════════════════

class TestSystemHealth:
    def test_health_check(self, client):
        res = client.get("/api/health")
        assert res.status_code == 200

    def test_system_health_endpoint(self, client, auth_headers):
        res = client.get("/api/system/health", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "status" in data
        assert "system" in data


# ═══════════════════════════════════════════════════════════════════════
# MODULE 15: SEARCH
# ═══════════════════════════════════════════════════════════════════════

class TestSearch:
    def test_global_search(self, client, auth_headers):
        res = client.get("/api/search?q=RRTS", headers=auth_headers)
        assert res.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# MODULE 16: FILE UPLOADS
# ═══════════════════════════════════════════════════════════════════════

class TestFileUploads:
    def test_list_uploads(self, client, auth_headers):
        res = client.get("/api/uploads", headers=auth_headers)
        assert res.status_code == 200

    def test_upload_validation_rejects_bad_type(self, client, auth_headers):
        files = {"file": ("test.exe", b"malware", "application/octet-stream")}
        data = {"category": "incidents"}
        res = client.post("/api/uploads", headers=auth_headers, files=files, data=data)
        assert res.status_code == 400


# ═══════════════════════════════════════════════════════════════════════
# MODULE 17: GPS / AVLS
# ═══════════════════════════════════════════════════════════════════════

class TestGPS:
    def test_gps_live(self, client, auth_headers):
        res = client.get("/api/gps/live", headers=auth_headers)
        assert res.status_code == 200

    def test_analytics_dashboard(self, client, auth_headers):
        res = client.get("/api/analytics/dashboard", headers=auth_headers)
        assert res.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# MODULE 18: INCIDENT LIFECYCLE (NEW)
# ═══════════════════════════════════════════════════════════════════════

class TestIncidentLifecycle:
    def test_incident_lifecycle_endpoints_exist(self, client, auth_headers):
        """Verify the lifecycle endpoint patterns exist (may return 404 for missing IDs)."""
        # Just check the incidents list first
        res = client.get("/api/incidents", headers=auth_headers)
        assert res.status_code == 200
        items = res.json().get("items", [])
        if items:
            inc_id = items[0]["id"]
            # Events endpoint should work
            events_res = client.get(f"/api/incidents/{inc_id}/events", headers=auth_headers)
            assert events_res.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# MODULE 19: ROSTER PUBLISH (NEW)
# ═══════════════════════════════════════════════════════════════════════

class TestRosterPublish:
    def test_conflict_detection(self, client, auth_headers):
        res = client.get("/api/duties/conflicts", headers=auth_headers,
                         params={"target_date": str(date.today())})
        assert res.status_code == 200
        assert "conflicts" in res.json()


# ═══════════════════════════════════════════════════════════════════════
# MODULE 20: NOTICE READERS (NEW)
# ═══════════════════════════════════════════════════════════════════════

class TestNoticeReaders:
    def test_notice_feed(self, client, auth_headers):
        res = client.get("/api/notices/feed", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
