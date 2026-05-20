"""Tests for new iteration-2 endpoints: Google session + Avatar updates."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://barcode-armor-craft.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def user_ctx(s):
    suffix = uuid.uuid4().hex[:8]
    r = s.post(f"{API}/auth/register", json={
        "email": f"TEST_av_{suffix}@bq.com",
        "password": "pass1234",
        "username": f"TESTav{suffix}",
    }, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["token"], "user": data["user"]}


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Google session ----------

class TestGoogleSession:
    def test_endpoint_exists_rejects_bogus(self, s):
        r = s.post(f"{API}/auth/google/session",
                   json={"session_id": "bogus-not-a-real-session"}, timeout=30)
        # Emergent rejects -> our handler returns 401 (or 502 if upstream down)
        assert r.status_code in (401, 502), f"unexpected: {r.status_code} {r.text}"
        # If 401, message must mention google
        if r.status_code == 401:
            assert "google" in r.text.lower() or "invalid" in r.text.lower()

    def test_endpoint_validates_input(self, s):
        # Missing session_id field => 422 from pydantic
        r = s.post(f"{API}/auth/google/session", json={}, timeout=10)
        assert r.status_code == 422


# ---------- Avatar update ----------

class TestAvatar:
    def test_preset_success_and_persists(self, s, user_ctx):
        token = user_ctx["token"]
        r = s.put(f"{API}/auth/avatar", json={"avatar": "preset:3"},
                  headers=auth(token), timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["avatar"] == "preset:3"
        # Verify persistence via /auth/me
        me = s.get(f"{API}/auth/me", headers=auth(token), timeout=20).json()
        assert me["avatar"] == "preset:3"

    def test_preset_8_accepted(self, s, user_ctx):
        token = user_ctx["token"]
        r = s.put(f"{API}/auth/avatar", json={"avatar": "preset:8"},
                  headers=auth(token), timeout=20)
        assert r.status_code == 200
        assert r.json()["avatar"] == "preset:8"

    def test_https_url_accepted(self, s, user_ctx):
        token = user_ctx["token"]
        r = s.put(f"{API}/auth/avatar",
                  json={"avatar": "https://example.com/avatar.png"},
                  headers=auth(token), timeout=20)
        assert r.status_code == 200
        assert r.json()["avatar"].startswith("https://")

    def test_data_uri_small_accepted(self, s, user_ctx):
        token = user_ctx["token"]
        tiny = "data:image/png;base64," + ("A" * 100)
        r = s.put(f"{API}/auth/avatar", json={"avatar": tiny},
                  headers=auth(token), timeout=20)
        assert r.status_code == 200

    def test_empty_string_rejected(self, s, user_ctx):
        token = user_ctx["token"]
        r = s.put(f"{API}/auth/avatar", json={"avatar": "   "},
                  headers=auth(token), timeout=20)
        assert r.status_code == 400

    def test_malformed_rejected(self, s, user_ctx):
        token = user_ctx["token"]
        r = s.put(f"{API}/auth/avatar", json={"avatar": "ftp://nope/x.png"},
                  headers=auth(token), timeout=20)
        assert r.status_code == 400

    def test_oversize_data_uri_rejected(self, s, user_ctx):
        token = user_ctx["token"]
        big = "data:image/png;base64," + ("A" * 1_600_000)
        r = s.put(f"{API}/auth/avatar", json={"avatar": big},
                  headers=auth(token), timeout=30)
        assert r.status_code == 400

    def test_unauthorized_no_token(self, s):
        r = s.put(f"{API}/auth/avatar", json={"avatar": "preset:1"}, timeout=10)
        assert r.status_code == 401


# ---------- Regression: existing critical endpoints still work ----------

class TestRegression:
    def test_seed_login(self, s):
        r = s.post(f"{API}/auth/login",
                   json={"email": "test@bq.com", "password": "test123"}, timeout=20)
        assert r.status_code == 200
        assert "token" in r.json()

    def test_character(self, s, user_ctx):
        r = s.get(f"{API}/character", headers=auth(user_ctx["token"]), timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "user" in data and "equipped" in data and "totals" in data

    def test_inventory(self, s, user_ctx):
        r = s.get(f"{API}/inventory", headers=auth(user_ctx["token"]), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_market_listings(self, s, user_ctx):
        r = s.get(f"{API}/market/listings", headers=auth(user_ctx["token"]), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_scan_creates_item(self, s, user_ctx):
        r = s.post(f"{API}/scan", json={"barcode": "9780140449136"},
                   headers=auth(user_ctx["token"]), timeout=60)
        assert r.status_code == 200
        item = r.json()
        assert "id" in item and item["slot"] in (
            "weapon", "armor", "accessory", "consumable", "upgrade"
        )
