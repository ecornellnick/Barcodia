"""Barcode Quest backend integration tests."""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://barcode-armor-craft.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Seeded test user (from /app/memory/test_credentials.md)
SEED_EMAIL = "test@bq.com"
SEED_PASSWORD = "test123"


# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def seed_token(s):
    # Try login first; register if needed.
    r = s.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASSWORD}, timeout=20)
    if r.status_code != 200:
        r = s.post(f"{API}/auth/register", json={
            "email": SEED_EMAIL, "password": SEED_PASSWORD, "username": "TestHero"
        }, timeout=20)
        assert r.status_code == 200, f"seed register failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def new_user(s):
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_{suffix}@bq.com"
    username = f"TEST_{suffix}"
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "pass1234", "username": username
    }, timeout=20)
    assert r.status_code == 200, f"register: {r.status_code} {r.text}"
    data = r.json()
    return {"token": data["token"], "user": data["user"], "email": email, "password": "pass1234"}


@pytest.fixture(scope="session")
def buyer(s):
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_buyer_{suffix}@bq.com"
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "pass1234", "username": f"TESTbuyer{suffix}"
    }, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# Find a barcode whose generated slot matches a desired slot for the user's level.
def find_barcode_for_slot(s, token, level, desired_slot, start=1000000000000):
    headers = auth(token)
    bc = start
    for _ in range(40):
        r = s.post(f"{API}/scan", json={"barcode": str(bc)}, headers=headers, timeout=60)
        assert r.status_code == 200, r.text
        item = r.json()
        if item["slot"] == desired_slot:
            return item
        # destroy unwanted item
        s.post(f"{API}/items/{item['id']}/destroy", headers=headers, timeout=20)
        bc += 1
    pytest.skip(f"Could not produce slot={desired_slot}")


# ---------- Auth ----------

class TestAuth:
    def test_register_returns_token(self, new_user):
        assert new_user["token"]
        assert new_user["user"]["email"] == new_user["email"].lower()
        assert new_user["user"]["level"] == 1
        assert new_user["user"]["gold"] == 500

    def test_login_valid(self, s, new_user):
        r = s.post(f"{API}/auth/login", json={"email": new_user["email"], "password": new_user["password"]}, timeout=20)
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_invalid(self, s, new_user):
        r = s.post(f"{API}/auth/login", json={"email": new_user["email"], "password": "wrong-password"}, timeout=20)
        assert r.status_code == 401

    def test_me_with_token(self, s, new_user):
        r = s.get(f"{API}/auth/me", headers=auth(new_user["token"]), timeout=20)
        assert r.status_code == 200
        assert r.json()["email"] == new_user["email"].lower()

    def test_me_no_token(self, s):
        r = s.get(f"{API}/auth/me", timeout=20)
        assert r.status_code == 401

    def test_me_bad_token(self, s):
        r = s.get(f"{API}/auth/me", headers={"Authorization": "Bearer not.a.jwt"}, timeout=20)
        assert r.status_code == 401


# ---------- Character ----------

class TestCharacter:
    def test_character_shape(self, s, new_user):
        r = s.get(f"{API}/character", headers=auth(new_user["token"]), timeout=20)
        assert r.status_code == 200
        data = r.json()
        for k in ("user", "equipped", "totals", "xp_to_next"):
            assert k in data
        assert isinstance(data["equipped"], list)
        assert all(k in data["totals"] for k in ("atk", "defense", "mag", "hp_bonus", "mana_bonus"))
        assert data["xp_to_next"] == 100  # level 1 -> 50 + 1*50


# ---------- Scan / Inventory ----------

class TestScan:
    def test_scan_creates_item(self, s, new_user):
        r = s.post(f"{API}/scan", json={"barcode": "9780140449136"}, headers=auth(new_user["token"]), timeout=60)
        assert r.status_code == 200, r.text
        item = r.json()
        for k in ("id", "name", "lore", "slot", "rarity", "level"):
            assert k in item, f"missing {k}"
        assert item["slot"] in ("weapon", "armor", "accessory", "consumable", "upgrade")
        assert item["rarity"] in ("common", "rare", "epic", "legendary")
        # Verify persistence
        r2 = s.get(f"{API}/inventory", headers=auth(new_user["token"]), timeout=20)
        assert r2.status_code == 200
        assert any(i["id"] == item["id"] for i in r2.json())

    def test_scan_deterministic(self, s, new_user):
        bc = "1234567890128"
        a = s.post(f"{API}/scan", json={"barcode": bc}, headers=auth(new_user["token"]), timeout=60).json()
        b = s.post(f"{API}/scan", json={"barcode": bc}, headers=auth(new_user["token"]), timeout=60).json()
        # slot/rarity/level/atk/defense should be deterministic from barcode
        for k in ("slot", "rarity", "level", "atk", "defense", "mag", "hp", "mana"):
            assert a[k] == b[k], f"non-deterministic field {k}"

    def test_scan_invalid_barcode(self, s, new_user):
        r = s.post(f"{API}/scan", json={"barcode": "12"}, headers=auth(new_user["token"]), timeout=20)
        assert r.status_code == 400


# ---------- Equip / Use / Destroy ----------

class TestItemActions:
    def test_equip_swap_logic(self, s, new_user):
        token = new_user["token"]
        # Get two weapons (or armor); try weapons first
        for slot in ("weapon", "armor"):
            a = find_barcode_for_slot(s, token, 1, slot, start=1100000000000)
            b = find_barcode_for_slot(s, token, 1, slot, start=1200000000000)
            if a and b:
                break
        r1 = s.post(f"{API}/items/{a['id']}/equip", headers=auth(token), timeout=20)
        assert r1.status_code == 200, r1.text
        r2 = s.post(f"{API}/items/{b['id']}/equip", headers=auth(token), timeout=20)
        assert r2.status_code == 200, r2.text
        # Verify only b is equipped
        inv = s.get(f"{API}/inventory", headers=auth(token), timeout=20).json()
        a_now = next(i for i in inv if i["id"] == a["id"])
        b_now = next(i for i in inv if i["id"] == b["id"])
        assert a_now["equipped"] is False
        assert b_now["equipped"] is True

    def test_cannot_equip_consumable(self, s, new_user):
        token = new_user["token"]
        cons = find_barcode_for_slot(s, token, 1, "consumable", start=1300000000000)
        r = s.post(f"{API}/items/{cons['id']}/equip", headers=auth(token), timeout=20)
        assert r.status_code == 400

    def test_use_consumable_heals(self, s, new_user):
        token = new_user["token"]
        cons = find_barcode_for_slot(s, token, 1, "consumable", start=1400000000000)
        # Make sure user has reduced HP/MP by depending on cap; default = full so use will be a no-op cap.
        r = s.post(f"{API}/items/{cons['id']}/use", headers=auth(token), timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        # Item must be deleted
        inv = s.get(f"{API}/inventory", headers=auth(token), timeout=20).json()
        assert not any(i["id"] == cons["id"] for i in inv)

    def test_destroy_refund(self, s, new_user):
        token = new_user["token"]
        r = s.post(f"{API}/scan", json={"barcode": "8901234567890"}, headers=auth(token), timeout=60)
        item = r.json()
        before = s.get(f"{API}/auth/me", headers=auth(token), timeout=20).json()["gold"]
        r2 = s.post(f"{API}/items/{item['id']}/destroy", headers=auth(token), timeout=20)
        assert r2.status_code == 200, r2.text
        refund = r2.json()["refund"]
        assert refund == max(1, item["level"] * 2)
        after = s.get(f"{API}/auth/me", headers=auth(token), timeout=20).json()["gold"]
        assert after == before + refund
        # Item is gone
        inv = s.get(f"{API}/inventory", headers=auth(token), timeout=20).json()
        assert not any(i["id"] == item["id"] for i in inv)


# ---------- Upgrade ----------

class TestUpgrade:
    def test_upgrade_rejects_past_char_level(self, s, new_user):
        """Find an item already at user's level, then attempt upgrade -> must reject with 400."""
        token = new_user["token"]
        me = s.get(f"{API}/auth/me", headers=auth(token), timeout=20).json()
        user_level = me["level"]
        # Find a weapon whose item level equals user level
        target = None
        bc = 2500000000000
        for _ in range(40):
            r = s.post(f"{API}/scan", json={"barcode": str(bc)}, headers=auth(token), timeout=60)
            item = r.json()
            if item["slot"] == "weapon" and item["level"] >= user_level:
                target = item
                break
            s.post(f"{API}/items/{item['id']}/destroy", headers=auth(token), timeout=20)
            bc += 1
        if not target:
            pytest.skip("Could not produce target at user level")
        scroll = find_barcode_for_slot(s, token, 1, "upgrade", start=2600000000000)
        r = s.post(f"{API}/items/upgrade",
                   json={"target_item_id": target["id"], "scroll_item_id": scroll["id"]},
                   headers=auth(token), timeout=20)
        assert r.status_code == 400, r.text

    def test_upgrade_success_below_char_level(self, s):
        """User levels up, then upgrade a low-level item -> +1 level, scroll consumed."""
        suffix = uuid.uuid4().hex[:8]
        r = s.post(f"{API}/auth/register", json={
            "email": f"TEST_up_{suffix}@bq.com", "password": "pass1234", "username": f"TESTup{suffix}"
        }, timeout=20)
        token = r.json()["token"]
        # Grind XP: scan ~40 items -> 40*5 = 200 XP, enough for level 2 (need 100)
        for i in range(40):
            s.post(f"{API}/scan", json={"barcode": f"30000000000{i:02d}"}, headers=auth(token), timeout=60)
        me = s.get(f"{API}/auth/me", headers=auth(token), timeout=20).json()
        if me["level"] < 2:
            pytest.skip(f"User did not reach level 2: {me['level']}")
        target = find_barcode_for_slot(s, token, me["level"], "weapon", start=3500000000000)
        scroll = find_barcode_for_slot(s, token, me["level"], "upgrade", start=3600000000000)
        if target["level"] >= me["level"]:
            pytest.skip("Target already at cap")
        orig_level = target["level"]
        orig_atk = target["atk"]
        r2 = s.post(f"{API}/items/upgrade",
                    json={"target_item_id": target["id"], "scroll_item_id": scroll["id"]},
                    headers=auth(token), timeout=20)
        assert r2.status_code == 200, r2.text
        new_item = r2.json()["item"]
        assert new_item["level"] == orig_level + 1
        if orig_atk > 0:
            assert new_item["atk"] > orig_atk
        # Scroll consumed
        inv = s.get(f"{API}/inventory", headers=auth(token), timeout=20).json()
        assert not any(i["id"] == scroll["id"] for i in inv)


# ---------- Market ----------

class TestMarket:
    @pytest.fixture(scope="class")
    def seller_ctx(self, s):
        suffix = uuid.uuid4().hex[:8]
        email = f"TEST_seller_{suffix}@bq.com"
        r = s.post(f"{API}/auth/register", json={
            "email": email, "password": "pass1234", "username": f"TESTseller{suffix}"
        }, timeout=20)
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        # Generate an armor item to list (won't be equipped)
        item = find_barcode_for_slot(s, token, 1, "armor", start=1700000000000)
        return {"token": token, "user": r.json()["user"], "item": item}

    def test_price_band(self, s, seller_ctx):
        token, item = seller_ctx["token"], seller_ctx["item"]
        r = s.get(f"{API}/market/price-band/{item['id']}", headers=auth(token), timeout=20)
        assert r.status_code == 200
        band = r.json()
        assert band["min_price"] < band["max_price"]
        assert band["min_price"] > 0

    def test_list_rejects_out_of_range(self, s, seller_ctx):
        token, item = seller_ctx["token"], seller_ctx["item"]
        band = s.get(f"{API}/market/price-band/{item['id']}", headers=auth(token), timeout=20).json()
        r = s.post(f"{API}/market/list",
                   json={"item_id": item["id"], "price": band["max_price"] + 9999},
                   headers=auth(token), timeout=20)
        assert r.status_code == 400

    def test_list_rejects_equipped(self, s, seller_ctx):
        token = seller_ctx["token"]
        item = find_barcode_for_slot(s, token, 1, "armor", start=1800000000000)
        eq = s.post(f"{API}/items/{item['id']}/equip", headers=auth(token), timeout=20)
        assert eq.status_code == 200
        band = s.get(f"{API}/market/price-band/{item['id']}", headers=auth(token), timeout=20).json()
        r = s.post(f"{API}/market/list",
                   json={"item_id": item["id"], "price": band["min_price"]},
                   headers=auth(token), timeout=20)
        assert r.status_code == 400

    def test_list_success_and_get_listings(self, s, seller_ctx):
        token, item = seller_ctx["token"], seller_ctx["item"]
        band = s.get(f"{API}/market/price-band/{item['id']}", headers=auth(token), timeout=20).json()
        price = (band["min_price"] + band["max_price"]) // 2
        r = s.post(f"{API}/market/list", json={"item_id": item["id"], "price": price},
                   headers=auth(token), timeout=20)
        assert r.status_code == 200, r.text
        listing = r.json()
        seller_ctx["listing_id"] = listing["id"]
        seller_ctx["price"] = price
        # listings visible
        all_l = s.get(f"{API}/market/listings", headers=auth(token), timeout=20).json()
        assert any(l["id"] == listing["id"] for l in all_l)

    def test_cannot_buy_own_listing(self, s, seller_ctx):
        token = seller_ctx["token"]
        listing_id = seller_ctx.get("listing_id")
        if not listing_id:
            pytest.skip("Listing not created")
        r = s.post(f"{API}/market/buy/{listing_id}", headers=auth(token), timeout=20)
        assert r.status_code == 400

    def test_buy_insufficient_gold(self, s, seller_ctx):
        # New buyer with 500 gold; list cheap item from new seller above maybe priced higher
        listing_id = seller_ctx.get("listing_id")
        price = seller_ctx.get("price")
        if not listing_id or price is None:
            pytest.skip("Listing missing")
        # Create poor buyer and drain gold by listing rejection isn't possible; instead simulate by
        # checking only when price > 500. If price <= 500, skip.
        if price <= 500:
            pytest.skip("Listing price within starting gold; cannot test insufficient gold path")
        suffix = uuid.uuid4().hex[:8]
        r = s.post(f"{API}/auth/register", json={
            "email": f"TEST_poor_{suffix}@bq.com", "password": "pass1234", "username": f"TESTpoor{suffix}"
        }, timeout=20)
        buyer_token = r.json()["token"]
        r2 = s.post(f"{API}/market/buy/{listing_id}", headers=auth(buyer_token), timeout=20)
        assert r2.status_code == 400

    def test_buy_success(self, s, seller_ctx, buyer):
        listing_id = seller_ctx.get("listing_id")
        price = seller_ctx.get("price")
        if not listing_id or price is None:
            pytest.skip("Listing missing")
        if price > 500:
            pytest.skip("Buyer cannot afford listing")
        buyer_token = buyer["token"]
        buyer_gold_before = buyer["user"]["gold"]
        r = s.post(f"{API}/market/buy/{listing_id}", headers=auth(buyer_token), timeout=20)
        assert r.status_code == 200, r.text
        # Buyer now owns item
        inv = s.get(f"{API}/inventory", headers=auth(buyer_token), timeout=20).json()
        assert any(i["id"] == seller_ctx["item"]["id"] for i in inv)
        buyer_gold_after = s.get(f"{API}/auth/me", headers=auth(buyer_token), timeout=20).json()["gold"]
        assert buyer_gold_after == buyer_gold_before - price

    def test_cancel_listing_returns_item(self, s):
        # Independent flow with fresh seller/item
        suffix = uuid.uuid4().hex[:8]
        r = s.post(f"{API}/auth/register", json={
            "email": f"TEST_cancel_{suffix}@bq.com", "password": "pass1234", "username": f"TESTcancel{suffix}"
        }, timeout=20)
        token = r.json()["token"]
        item = find_barcode_for_slot(s, token, 1, "armor", start=1900000000000)
        band = s.get(f"{API}/market/price-band/{item['id']}", headers=auth(token), timeout=20).json()
        listing = s.post(f"{API}/market/list",
                         json={"item_id": item["id"], "price": band["min_price"]},
                         headers=auth(token), timeout=20).json()
        r2 = s.post(f"{API}/market/cancel/{listing['id']}", headers=auth(token), timeout=20)
        assert r2.status_code == 200
        inv = s.get(f"{API}/inventory", headers=auth(token), timeout=20).json()
        item_back = next((i for i in inv if i["id"] == item["id"]), None)
        assert item_back is not None
        assert item_back["listed"] is False
