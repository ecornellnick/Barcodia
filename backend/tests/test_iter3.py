"""Iteration 3 backend tests — new schema, equip slots, scan dup, battle."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL", "https://barcode-armor-craft.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

NEW_STAT_KEYS = {"atk", "int_stat", "def_stat", "res", "dex", "mob", "crit", "luk", "hp", "mana"}
GEAR_SLOTS = {"head", "chest", "leg_l", "leg_r", "arm_l", "arm_r",
              "main_hand", "off_hand", "trinket", "ring", "necklace"}
ALL_SLOTS = GEAR_SLOTS | {"consumable", "upgrade"}


def _register(prefix="TEST"):
    suf = uuid.uuid4().hex[:8]
    body = {
        "email": f"{prefix.lower()}_{suf}@bq.com",
        "password": "test1234",
        "username": f"{prefix}{suf[:6]}",
    }
    r = requests.post(f"{API}/auth/register", json=body, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    return data["token"], data["user"]


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Auth / character regression ----------

@pytest.fixture(scope="module")
def session():
    token, user = _register("TESTITER3")
    return {"token": token, "user": user, "headers": _headers(token)}


def test_register_and_me(session):
    r = requests.get(f"{API}/auth/me", headers=session["headers"], timeout=15)
    assert r.status_code == 200
    u = r.json()
    assert u["email"]
    assert u["stamina"] >= 0
    assert u["stamina_max"] >= 5
    assert u["difficulty_tier"] >= 1


def test_login_existing(session):
    r = requests.post(f"{API}/auth/login", json={
        "email": session["user"]["email"], "password": "test1234"
    }, timeout=15)
    assert r.status_code == 200
    assert "token" in r.json()


def test_character_endpoint_has_new_stats(session):
    r = requests.get(f"{API}/character", headers=session["headers"], timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "user" in data and "equipped" in data and "totals" in data
    totals = data["totals"]
    for k in ("atk", "int_stat", "def_stat", "res", "dex", "mob", "crit", "luk", "hp_bonus", "mana_bonus"):
        assert k in totals, f"Missing total key: {k}"
    u = data["user"]
    assert u["stamina_max"] >= 5
    assert "difficulty_tier" in u


# ---------- Scan schema ----------

def test_scan_returns_new_schema(session):
    bc = "8901234567890"  # fresh barcode
    r = requests.post(f"{API}/scan", json={"barcode": bc}, headers=session["headers"], timeout=60)
    assert r.status_code == 200, r.text
    item = r.json()
    assert item.get("duplicate") is not True
    assert item["slot"] in ALL_SLOTS
    for k in ("element", "material", "shape", "weight", "family", "two_handed"):
        assert k in item, f"Missing trait {k}"
    for k in NEW_STAT_KEYS:
        assert k in item, f"Missing stat {k}"
    assert "defense" not in item and "mag" not in item


def test_scan_duplicate_returns_echo_shards(session):
    bc = f"8800{uuid.uuid4().hex[:8]}"
    r1 = requests.post(f"{API}/scan", json={"barcode": bc}, headers=session["headers"], timeout=60)
    assert r1.status_code == 200
    assert r1.json().get("duplicate") is not True

    r2 = requests.post(f"{API}/scan", json={"barcode": bc}, headers=session["headers"], timeout=20)
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2.get("duplicate") is True
    assert d2["echo_shards_gold"] > 0
    assert d2["scan_count"] == 2
    g2 = d2["echo_shards_gold"]

    r3 = requests.post(f"{API}/scan", json={"barcode": bc}, headers=session["headers"], timeout=20)
    d3 = r3.json()
    assert d3.get("duplicate") is True
    assert d3["scan_count"] == 3
    # Third scan should be roughly half the second (integer division)
    assert d3["echo_shards_gold"] <= max(1, g2 // 2) + 1


def test_scan_ai_no_real_product_in_name(session):
    """AI must never echo real product brand names."""
    forbidden_hints = [
        ("Pepsi can", ["pepsi"]),
        ("Coca-Cola bottle", ["coca", "cola"]),
        ("iPhone charger", ["iphone", "apple"]),
        ("Heinz Ketchup", ["heinz", "ketchup"]),
    ]
    leaks = []
    for i, (hint, forbidden) in enumerate(forbidden_hints):
        bc = f"77{i}{uuid.uuid4().hex[:10]}"
        r = requests.post(f"{API}/scan", json={"barcode": bc, "hint": hint},
                          headers=session["headers"], timeout=60)
        assert r.status_code == 200, r.text
        item = r.json()
        if item.get("duplicate"):
            continue
        name_lower = (item.get("name") or "").lower()
        for f in forbidden:
            if f in name_lower:
                leaks.append((hint, item["name"]))
    assert not leaks, f"AI leaked product names: {leaks}"


# ---------- Equip slots / two-handed ----------

def _scan_until_slot(session, target_slots, max_tries=40, hint=None):
    for i in range(max_tries):
        bc = f"99{i:02d}{uuid.uuid4().hex[:10]}"
        body = {"barcode": bc}
        if hint:
            body["hint"] = hint
        r = requests.post(f"{API}/scan", json=body, headers=session["headers"], timeout=60)
        if r.status_code != 200:
            continue
        item = r.json()
        if item.get("duplicate"):
            continue
        if item["slot"] in target_slots:
            return item
    return None


def test_equip_leg_l_and_leg_r_independent(session):
    leg1 = _scan_until_slot(session, {"leg_l", "leg_r"})
    leg2 = _scan_until_slot(session, {"leg_l", "leg_r"})
    if not leg1 or not leg2:
        pytest.skip("Could not find two leg items")
    # Equip first into leg_l
    r1 = requests.post(f"{API}/items/{leg1['id']}/equip", json={"slot": "leg_l"},
                       headers=session["headers"], timeout=15)
    assert r1.status_code == 200, r1.text
    assert r1.json()["equip_slot"] == "leg_l"
    # Equip second into leg_r
    r2 = requests.post(f"{API}/items/{leg2['id']}/equip", json={"slot": "leg_r"},
                       headers=session["headers"], timeout=15)
    assert r2.status_code == 200, r2.text
    assert r2.json()["equip_slot"] == "leg_r"
    # Verify both equipped independently
    char = requests.get(f"{API}/character", headers=session["headers"], timeout=15).json()
    equipped_ids = {it["id"]: it.get("equip_slot") for it in char["equipped"]}
    assert leg1["id"] in equipped_ids and equipped_ids[leg1["id"]] == "leg_l"
    assert leg2["id"] in equipped_ids and equipped_ids[leg2["id"]] == "leg_r"


def test_twohand_auto_unequips_offhand(session):
    # Equip an off_hand first
    oh = _scan_until_slot(session, {"off_hand"})
    th = None
    # Try hard to find a 2H main_hand
    for i in range(60):
        bc = f"2H{i:02d}{uuid.uuid4().hex[:10]}"
        r = requests.post(f"{API}/scan", json={"barcode": bc, "hint": "longbow ranged"},
                          headers=session["headers"], timeout=60)
        if r.status_code != 200:
            continue
        item = r.json()
        if item.get("duplicate"):
            continue
        if item["slot"] == "main_hand" and item.get("two_handed"):
            th = item
            break
    if not oh or not th:
        pytest.skip(f"Could not find off_hand({bool(oh)}) and 2H main_hand({bool(th)})")
    # Equip off_hand
    requests.post(f"{API}/items/{oh['id']}/equip", json={"slot": "off_hand"},
                  headers=session["headers"], timeout=15)
    # Equip 2H main_hand
    r = requests.post(f"{API}/items/{th['id']}/equip", json={"slot": "main_hand"},
                      headers=session["headers"], timeout=15)
    assert r.status_code == 200, r.text
    char = requests.get(f"{API}/character", headers=session["headers"], timeout=15).json()
    equipped_ids = {it["id"]: it for it in char["equipped"]}
    # off_hand should NOT be equipped now
    assert oh["id"] not in equipped_ids, "off_hand still equipped after 2H main_hand"
    assert th["id"] in equipped_ids


# ---------- Battle ----------

def test_battle_preview_shape(session):
    r = requests.get(f"{API}/battle/preview", headers=session["headers"], timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "enemy" in d and "stamina" in d and "stamina_max" in d and "difficulty_tier" in d
    e = d["enemy"]
    for k in ("id", "name", "archetype", "portrait", "tier", "elite", "hp", "max_hp",
              "atk", "int_stat", "def_stat", "res", "dex", "mob", "crit"):
        assert k in e, f"Enemy missing key {k}"


def test_battle_skip_changes_enemy(session):
    r1 = requests.get(f"{API}/battle/preview", headers=session["headers"], timeout=15).json()
    eid1 = r1["enemy"]["id"]
    r2 = requests.post(f"{API}/battle/skip", headers=session["headers"], timeout=15)
    assert r2.status_code == 200
    eid2 = r2.json()["enemy"]["id"]
    assert eid1 != eid2


def test_battle_fight_resolves(session):
    pre = requests.get(f"{API}/battle/preview", headers=session["headers"], timeout=15).json()
    stamina_before = pre["stamina"]
    if stamina_before < 1:
        pytest.skip("No stamina")
    r = requests.post(f"{API}/battle/fight", headers=session["headers"], timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "win" in d and "log" in d and "enemy" in d and "rewards" in d
    assert "user" in d and "next_enemy" in d
    assert isinstance(d["log"], list) and len(d["log"]) > 0
    rw = d["rewards"]
    assert "xp" in rw and "gold" in rw and "item" in rw
    # Stamina decremented
    assert d["user"]["stamina"] == stamina_before - 1


def test_battle_no_stamina_returns_400(session):
    # Drain stamina
    drained_count = 0
    for _ in range(15):
        pre = requests.get(f"{API}/battle/preview", headers=session["headers"], timeout=15).json()
        if pre["stamina"] < 1:
            break
        r = requests.post(f"{API}/battle/fight", headers=session["headers"], timeout=30)
        if r.status_code != 200:
            break
        drained_count += 1
    # Now should be 0
    pre = requests.get(f"{API}/battle/preview", headers=session["headers"], timeout=15).json()
    if pre["stamina"] >= 1:
        pytest.skip(f"Could not drain stamina (still at {pre['stamina']})")
    r = requests.post(f"{API}/battle/fight", headers=session["headers"], timeout=15)
    assert r.status_code == 400


# ---------- Regression: market + inventory + use/destroy ----------

def test_inventory_returns_items(session):
    r = requests.get(f"{API}/inventory", headers=session["headers"], timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_market_listings_endpoint(session):
    r = requests.get(f"{API}/market/listings", headers=session["headers"], timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_market_list_buy_cancel_flow():
    """End-to-end market flow with two fresh users."""
    # Seller
    s_tok, s_user = _register("SELLER")
    sh = _headers(s_tok)
    # Scan something
    bc = f"MKT{uuid.uuid4().hex[:10]}"
    r = requests.post(f"{API}/scan", json={"barcode": bc}, headers=sh, timeout=60)
    item = r.json()
    if item.get("duplicate"):
        pytest.skip("Unexpected duplicate on fresh user")

    # If equippable, that's fine; just list it
    pb = requests.get(f"{API}/market/price-band/{item['id']}", headers=sh, timeout=15).json()
    price = pb["min_price"]
    lr = requests.post(f"{API}/market/list",
                       json={"item_id": item["id"], "price": price},
                       headers=sh, timeout=15)
    assert lr.status_code == 200, lr.text
    listing = lr.json()

    # Buyer
    b_tok, b_user = _register("BUYER")
    bh = _headers(b_tok)
    # Buyer has 500 gold default
    br = requests.post(f"{API}/market/buy/{listing['id']}", headers=bh, timeout=15)
    assert br.status_code == 200, br.text

    # Seller should cancel a NEW listing
    bc2 = f"MKTC{uuid.uuid4().hex[:10]}"
    r2 = requests.post(f"{API}/scan", json={"barcode": bc2}, headers=sh, timeout=60).json()
    pb2 = requests.get(f"{API}/market/price-band/{r2['id']}", headers=sh, timeout=15).json()
    lr2 = requests.post(f"{API}/market/list",
                        json={"item_id": r2["id"], "price": pb2["min_price"]},
                        headers=sh, timeout=15).json()
    cr = requests.post(f"{API}/market/cancel/{lr2['id']}", headers=sh, timeout=15)
    assert cr.status_code == 200


def test_destroy_item():
    tok, _ = _register("DESTROY")
    h = _headers(tok)
    bc = f"DST{uuid.uuid4().hex[:10]}"
    item = requests.post(f"{API}/scan", json={"barcode": bc}, headers=h, timeout=60).json()
    r = requests.post(f"{API}/items/{item['id']}/destroy", headers=h, timeout=15)
    assert r.status_code == 200
    # Verify gone
    inv = requests.get(f"{API}/inventory", headers=h, timeout=15).json()
    assert not any(i["id"] == item["id"] for i in inv)
