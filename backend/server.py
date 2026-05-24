"""Barcodia backend – barcode-scanning RPG with battle + expanded stats."""
import os
import hashlib
import logging
import random
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Literal, Tuple, Any

import jwt
import bcrypt
import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("barcodia")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
JWT_ALG = "HS256"
JWT_TTL_HOURS = 24 * 30
STAMINA_REGEN_SECONDS = 180  # 1 stamina / 3 minutes
CHANGE_ENEMY_COOLDOWN_SECONDS = 300  # 5 minutes between free enemy rerolls in battle
SIGIL_CHARGE_MAX = 100
SIGIL_CHARGE_COST = 10
SIGIL_CHARGE_REGEN_SECONDS = 90  # +1 Sigil Charge every 90 seconds
DUPLICATE_ECHO_WINDOW_HOURS = 24
TALENT_TEST_MODE = True  # Prototype setting: gives tester enough points to exercise the tree.
TALENT_TEST_TOTAL_POINTS = 60
TALENT_RESET_TEST_FREE = True
INVENTORY_MAX = 50
PREMIUM_CURRENCY_KEY = "aether_gems"
PREMIUM_CURRENCY_NAME = "Aether Gems"
DAILY_COMPLETE_GEM_REWARD = 5
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "")

# Frontend image assets are served by the backend in local/dev so admin-uploaded
# assets can be previewed and used by the mobile app without rebundling.
PROJECT_DIR = ROOT_DIR.parent
FRONTEND_DIR = PROJECT_DIR / "frontend"
FRONTEND_IMAGES_DIR = FRONTEND_DIR / "assets" / "images"
FRONTEND_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# Cinematics live at the repo root in /Cinematics for now. These files are
# authoring/runtime media assets, not personal reference-only concept files.
# The Dev Mode cinematic viewer uses this static mount to test playback without
# bundling large MP4s into the Expo app.
CINEMATICS_DIR = PROJECT_DIR / "Cinematics"
CINEMATICS_DIR.mkdir(parents=True, exist_ok=True)


client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Barcodia API")
app.mount("/assets", StaticFiles(directory=str(FRONTEND_IMAGES_DIR)), name="assets")
app.mount("/cinematics", StaticFiles(directory=str(CINEMATICS_DIR)), name="cinematics")
ADMIN_STATIC_DIR = ROOT_DIR / "admin" / "assets"
ADMIN_STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/admin/assets", StaticFiles(directory=str(ADMIN_STATIC_DIR)), name="admin_assets")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)


# ---------------- Slots & enums ----------------

# 11 equip slots + special non-equip slots
GEAR_SLOTS = [
    "head", "chest", "leg_l", "leg_r", "arm_l", "arm_r",
    "main_hand", "off_hand", "trinket", "ring", "necklace",
]
ALL_SLOTS = GEAR_SLOTS + ["consumable", "upgrade"]

Slot = Literal[
    "head", "chest", "leg_l", "leg_r", "arm_l", "arm_r",
    "main_hand", "off_hand", "trinket", "ring", "necklace",
    "consumable", "upgrade",
]
Rarity = Literal["common", "rare", "epic", "legendary"]

ELEMENTS = ["none", "fire", "lightning", "ice", "holy", "shadow", "nature"]
MATERIALS = ["metal", "wood", "leather", "cloth", "stone", "crystal"]
SHAPES = ["long", "round", "sharp", "blunt", "ranged"]
WEIGHTS = ["light", "medium", "heavy"]
FAMILIES = [
    "hardware", "kitchen", "electronics", "fabric",
    "consumable_drink", "energy_drink", "coffee", "water", "consumable_food", "medicine",
    "cleaning", "toy", "decor", "office", "jewelry",
]


# ---------------- Models ----------------

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    username: str = Field(min_length=2, max_length=20)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str


class AvatarIn(BaseModel):
    avatar: str


class RealmTravelIn(BaseModel):
    realm: str
    location_id: str


class TokenOut(BaseModel):
    token: str
    user: dict


class ListIn(BaseModel):
    item_id: str
    price: int


class ScanIn(BaseModel):
    barcode: str
    hint: Optional[str] = None


class UpgradeIn(BaseModel):
    target_item_id: str
    scroll_item_id: str


class EquipIn(BaseModel):
    slot: Optional[str] = None  # for ambiguous slots (rings, arms, legs)


class BattleActionIn(BaseModel):
    # Player-facing label is Skill, not Magic. Mode is explicit so Quick Hunt and Adventure never share state.
    action: Literal["weapon", "skill", "ability", "item", "flee"] = "weapon"
    item_id: Optional[str] = None
    skill_id: Optional[str] = None
    mode: Optional[Literal["quick", "adventure"]] = None


class TalentSpendIn(BaseModel):
    talent_id: str


class TalentResetIn(BaseModel):
    confirm: bool = True


class AdminJsonSaveIn(BaseModel):
    key: str
    data: Any


class AdminConfigSaveIn(BaseModel):
    data: Any


# ---------------- Store / Admin Asset Models ----------------

class StoreBuyIn(BaseModel):
    quantity: int = Field(default=1, ge=1, le=99)


class RealmTraverseIn(BaseModel):
    realm: str
    location_id: str


# ---------------- Helpers ----------------

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_TTL_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


async def regen_stamina(user: dict) -> dict:
    """Mutates and returns user with regenerated stamina."""
    max_stam = stamina_max(user["level"])
    cur = user.get("stamina", max_stam)
    last_raw = user.get("stamina_updated_at")
    if last_raw is None:
        last = now_utc()
    elif isinstance(last_raw, str):
        last = datetime.fromisoformat(last_raw.replace("Z", "+00:00"))
    else:
        last = last_raw
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
    if cur >= max_stam:
        new_cur = max_stam
        last = now_utc()
    else:
        elapsed = (now_utc() - last).total_seconds()
        gain = int(elapsed // STAMINA_REGEN_SECONDS)
        if gain > 0:
            new_cur = min(max_stam, cur + gain)
            last = last + timedelta(seconds=gain * STAMINA_REGEN_SECONDS)
        else:
            new_cur = cur
    user["stamina"] = new_cur
    user["stamina_max"] = max_stam
    user["stamina_updated_at"] = last
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"stamina": new_cur, "stamina_updated_at": last}},
    )
    return user


def _coerce_utc(value) -> datetime:
    if value is None:
        return now_utc()
    if isinstance(value, str):
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    else:
        dt = value
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


async def regen_sigil_charge(user: dict) -> dict:
    """Regenerate Sigil Charge, the scan resource used by the barcode transmuter."""
    max_charge = int(user.get("sigil_charge_max", SIGIL_CHARGE_MAX) or SIGIL_CHARGE_MAX)
    cur = int(user.get("sigil_charge", max_charge) or 0)
    last = _coerce_utc(user.get("sigil_charge_updated_at"))

    if cur >= max_charge:
        new_cur = max_charge
        last = now_utc()
    else:
        elapsed = max(0, (now_utc() - last).total_seconds())
        gain = int(elapsed // SIGIL_CHARGE_REGEN_SECONDS)
        if gain > 0:
            new_cur = min(max_charge, cur + gain)
            last = last + timedelta(seconds=gain * SIGIL_CHARGE_REGEN_SECONDS)
        else:
            new_cur = cur

    user["sigil_charge"] = new_cur
    user["sigil_charge_max"] = max_charge
    user["sigil_charge_updated_at"] = last
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"sigil_charge": new_cur, "sigil_charge_max": max_charge, "sigil_charge_updated_at": last}},
    )
    return user


def seconds_until_next_regen(current: int, maximum: int, last_value, interval_seconds: int) -> int:
    """Seconds remaining until the next resource point regenerates. Returns 0 if full."""
    if current >= maximum:
        return 0
    last = _coerce_utc(last_value)
    elapsed = max(0, int((now_utc() - last).total_seconds()))
    remaining = interval_seconds - (elapsed % interval_seconds)
    return max(1, remaining if remaining <= interval_seconds else interval_seconds)


def seconds_until_change_enemy(preview: Optional[dict]) -> int:
    if not preview:
        return 0
    last = preview.get("changed_enemy_at") or preview.get("created_at")
    if not last:
        return 0
    elapsed = max(0, int((now_utc() - _coerce_utc(last)).total_seconds()))
    return max(0, CHANGE_ENEMY_COOLDOWN_SECONDS - elapsed)


def stamina_display_payload(user: dict) -> dict:
    max_stam = int(user.get("stamina_max", stamina_max(user["level"])))
    cur = int(user.get("stamina", max_stam))
    return {
        "stamina": cur,
        "stamina_max": max_stam,
        "stamina_next_seconds": seconds_until_next_regen(cur, max_stam, user.get("stamina_updated_at"), STAMINA_REGEN_SECONDS),
        "stamina_regen_seconds": STAMINA_REGEN_SECONDS,
    }


def sigil_display_payload(user: dict) -> dict:
    max_charge = int(user.get("sigil_charge_max", SIGIL_CHARGE_MAX) or SIGIL_CHARGE_MAX)
    cur = int(user.get("sigil_charge", max_charge) or 0)
    return {
        "sigil_charge": cur,
        "sigil_charge_max": max_charge,
        "sigil_next_seconds": seconds_until_next_regen(cur, max_charge, user.get("sigil_charge_updated_at"), SIGIL_CHARGE_REGEN_SECONDS),
        "sigil_regen_seconds": SIGIL_CHARGE_REGEN_SECONDS,
    }


def stamina_max(level: int) -> int:
    return 5 + level // 2


async def get_current_user(cred: HTTPAuthorizationCredentials = Depends(bearer)):
    if not cred:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user = await regen_stamina(user)
    user = await regen_sigil_charge(user)
    return user


def xp_to_next(level: int) -> int:
    return 50 + level * 50


# ---------------- RPG class affinity system ----------------

CLASS_META = {
    "infantry": {"label": "Infantry", "icon": "⚔️"},
    "lancer": {"label": "Lancer", "icon": "🔱"},
    "cavalry": {"label": "Cavalry", "icon": "🐎"},
    "archer": {"label": "Archer", "icon": "🏹"},
    "assassin": {"label": "Assassin", "icon": "🗡️"},
    "flier": {"label": "Flier", "icon": "🪽"},
    "aquatic": {"label": "Aquatic", "icon": "🌊"},
    "mage": {"label": "Mage", "icon": "✨"},
    "healer": {"label": "Healer", "icon": "💚"},
    "holy": {"label": "Holy", "icon": "☀️"},
    "demon": {"label": "Demon", "icon": "☠️"},
}


def enemy_portrait_asset(monster_id: str = "", name: str = "", tags: Optional[list] = None, kind: str = "") -> str:
    """Return a bundled portrait asset that matches the enemy name/archetype.

    Important: this function should never fall back to slime for humanoid enemies.
    Slime art should only be used for actual slime/spore-type monsters.
    """
    text = f"{monster_id} {name} {kind}".lower()
    tags = [str(t).lower() for t in (tags or [])]

    if "boss" in kind or "thornwarden" in text or "elder" in text:
        return "asset:enemy_boss_thorn"
    if "tree" in text or "treant" in text or "root" in text or "thorn" in text or "hollow" in text:
        return "asset:enemy_tree"
    if "bat" in text or "flier" in tags:
        return "asset:enemy_bat"
    if "wolf" in text or "hound" in text:
        return "asset:enemy_wolf" if "hell" not in text else "asset:enemy_hell_hound"
    if "skeleton" in text or "bone" in text:
        return "asset:enemy_skeleton"
    if "mage" in text or "wisp" in text or "spirit" in text:
        return "asset:enemy_dark_mage" if "dark" in text or "mage" in text else "asset:enemy_wisp"
    if "knight" in text or "armored" in text or "guard" in text:
        return "asset:enemy_knight"
    if "orc" in text or "berserker" in text:
        return "asset:enemy_orc"
    if "goblin" in text or "imp" in text:
        return "asset:enemy_goblin"
    if "bandit" in text or "archer" in text or "assassin" in text or "rogue" in text or "shadow" in text:
        return "asset:enemy_shadow_assassin"
    if "ice" in text or "golem" in text or "crystal" in text:
        return "asset:enemy_ice_golem"
    if "wyvern" in text or "dragon" in text:
        return "asset:enemy_wyvern"
    if "red slime" in text or "ember slime" in text:
        return "asset:enemy_red_slime"
    if "slime" in text or "slimeling" in text or "spore" in text:
        return "asset:enemy_slime"
    if "demon" in tags:
        return "asset:enemy_dark_mage"
    if "assassin" in tags or "archer" in tags:
        return "asset:enemy_shadow_assassin"
    return "asset:enemy_goblin"

ADVANTAGE = {
    "infantry": ["lancer"],
    "lancer": ["cavalry"],
    "cavalry": ["infantry"],
    "archer": ["flier"],
    "holy": ["demon"],
    "demon": ["holy"],
}


# ---------------- Talent tree prototype ----------------
# This is intentionally data-driven and small for V1 testing. The user currently
# receives TALENT_TEST_TOTAL_POINTS so the whole tree can be tested quickly.
# Later this should become: level-up grants points, reset costs gold, and class
# branches scale with class proficiency requirements.
TALENT_TREE = [
    # Generic trunk. Each node unlocks the next node once the previous node is fully ranked.
    {"id": "gen_hp_1", "tree": "generic", "name": "Vital Root", "icon": "❤️", "max_rank": 5, "cost": 1, "effects": {"hp_bonus": 10}, "description": "+10 max HP per rank.", "position": 1},
    {"id": "gen_mana_1", "tree": "generic", "name": "Deep Focus", "icon": "🔷", "max_rank": 5, "cost": 1, "requires": "gen_hp_1", "effects": {"mana_bonus": 5}, "description": "+5 max Mana per rank.", "position": 2},
    {"id": "gen_def_1", "tree": "generic", "name": "Iron Skin", "icon": "🛡️", "max_rank": 3, "cost": 1, "requires": "gen_mana_1", "effects": {"def_stat": 1}, "description": "+1 DEF per rank.", "position": 3},
    {"id": "gen_res_1", "tree": "generic", "name": "Steady Mind", "icon": "🔹", "max_rank": 3, "cost": 1, "requires": "gen_def_1", "effects": {"res": 1}, "description": "+1 RES per rank.", "position": 4},

    # Class branches. These are intentionally short for testing, but already support branch/unlock logic.
    {"id": "infantry_atk_1", "tree": "infantry", "name": "Footwork Drill", "icon": "⚔️", "max_rank": 3, "cost": 1, "requires_class": "infantry", "effects": {"atk": 1}, "description": "+1 ATK per rank while building Infantry style.", "position": 1},
    {"id": "infantry_guard_1", "tree": "infantry", "name": "Shield Discipline", "icon": "🛡️", "max_rank": 3, "cost": 1, "requires": "infantry_atk_1", "requires_class": "infantry", "effects": {"def_stat": 1}, "description": "+1 DEF per rank.", "position": 2},

    {"id": "lancer_pierce_1", "tree": "lancer", "name": "Piercing Form", "icon": "🔱", "max_rank": 3, "cost": 1, "requires_class": "lancer", "effects": {"atk": 1}, "description": "+1 ATK per rank for polearm builds.", "position": 1},
    {"id": "lancer_brace_1", "tree": "lancer", "name": "Brace Stance", "icon": "🛡️", "max_rank": 3, "cost": 1, "requires": "lancer_pierce_1", "requires_class": "lancer", "effects": {"def_stat": 1}, "description": "+1 DEF per rank. Helps hold against charges.", "position": 2},

    {"id": "archer_eye_1", "tree": "archer", "name": "Eagle Eye", "icon": "🏹", "max_rank": 3, "cost": 1, "requires_class": "archer", "effects": {"dex": 1}, "description": "+1 DEX per rank.", "position": 1},
    {"id": "archer_crit_1", "tree": "archer", "name": "True Shot", "icon": "🎯", "max_rank": 3, "cost": 1, "requires": "archer_eye_1", "requires_class": "archer", "effects": {"crit": 1}, "description": "+1 CRIT per rank.", "position": 2},

    {"id": "mage_focus_1", "tree": "mage", "name": "Arcane Focus", "icon": "✨", "max_rank": 3, "cost": 1, "requires_class": "mage", "effects": {"int_stat": 1}, "description": "+1 INT per rank.", "position": 1},
    {"id": "mage_reserve_1", "tree": "mage", "name": "Mana Reserve", "icon": "🔷", "max_rank": 3, "cost": 1, "requires": "mage_focus_1", "requires_class": "mage", "effects": {"mana_bonus": 8}, "description": "+8 max Mana per rank.", "position": 2},

    {"id": "healer_grace_1", "tree": "healer", "name": "Gentle Grace", "icon": "💚", "max_rank": 3, "cost": 1, "requires_class": "healer", "effects": {"res": 1, "mana_bonus": 2}, "description": "+1 RES and +2 Mana per rank.", "position": 1},
    {"id": "healer_light_1", "tree": "healer", "name": "Light Touch", "icon": "☀️", "max_rank": 3, "cost": 1, "requires": "healer_grace_1", "requires_class": "healer", "effects": {"int_stat": 1}, "description": "+1 INT per rank for offensive support skills.", "position": 2},

    {"id": "holy_light_1", "tree": "holy", "name": "Sacred Light", "icon": "☀️", "max_rank": 3, "cost": 1, "requires_class": "holy", "effects": {"int_stat": 1}, "description": "+1 INT per rank for holy builds.", "position": 1},
    {"id": "demon_edge_1", "tree": "demon", "name": "Umbral Edge", "icon": "☠️", "max_rank": 3, "cost": 1, "requires_class": "demon", "effects": {"atk": 1, "int_stat": 1}, "description": "+1 ATK and +1 INT per rank for dark hybrid builds.", "position": 1},
]

TALENT_BY_ID = {t["id"]: t for t in TALENT_TREE}


def talent_points_total(user: dict) -> int:
    if TALENT_TEST_MODE:
        return TALENT_TEST_TOTAL_POINTS
    return max(0, int(user.get("level", 1)) - 1)


def talent_points_spent(talents: dict) -> int:
    total = 0
    for talent_id, rank in (talents or {}).items():
        t = TALENT_BY_ID.get(talent_id)
        if t:
            total += int(rank or 0) * int(t.get("cost", 1))
    return total


def talent_effect_totals(talents: dict) -> dict:
    out = {"atk": 0, "int_stat": 0, "def_stat": 0, "res": 0, "dex": 0, "mob": 0, "crit": 0, "luk": 0, "hp_bonus": 0, "mana_bonus": 0}
    for talent_id, rank in (talents or {}).items():
        t = TALENT_BY_ID.get(talent_id)
        if not t:
            continue
        for key, val in (t.get("effects") or {}).items():
            if key in out:
                out[key] += int(val) * int(rank or 0)
    return out


def build_talent_state(user: dict, class_state: Optional[dict] = None) -> dict:
    talents = user.get("talents") or {}
    total = talent_points_total(user)
    spent = talent_points_spent(talents)
    scores = (class_state or {}).get("scores") or user.get("class_affinity") or {}
    nodes = []
    effects = talent_effect_totals(talents)
    for t in TALENT_TREE:
        node = dict(t)
        rank = int(talents.get(t["id"], 0) or 0)
        prereq_id = t.get("requires")
        prereq_met = True
        prereq_label = ""
        if prereq_id:
            prereq = TALENT_BY_ID.get(prereq_id)
            prereq_rank = int(talents.get(prereq_id, 0) or 0)
            prereq_max = int((prereq or {}).get("max_rank", 1))
            prereq_met = prereq_rank >= prereq_max
            prereq_label = (prereq or {}).get("name", prereq_id)
        req = t.get("requires_class")
        pct = int(scores.get(req, 0) or 0) if req else 0
        enough_points = (total - spent) >= int(t.get("cost", 1))
        can_rank = rank < int(t.get("max_rank", 1)) and enough_points and prereq_met
        total_added = {}
        for key, val in (t.get("effects") or {}).items():
            total_added[key] = int(val) * rank
        node.update({
            "rank": rank,
            "can_rank": can_rank,
            "locked": not prereq_met,
            "locked_text": f"Unlock by maxing {prereq_label}" if not prereq_met else "",
            "class_affinity": pct,
            "total_added": total_added,
            "warning": bool(req and pct < 15),
            "warning_text": "Low proficiency for this branch" if req and pct < 15 else "",
        })
        nodes.append(node)
    return {
        "test_mode": TALENT_TEST_MODE,
        "reset_free": TALENT_RESET_TEST_FREE,
        "points_total": total,
        "points_spent": spent,
        "points_available": max(0, total - spent),
        "talents": talents,
        "nodes": nodes,
        "effects": effects,
        "reset_cost": 0 if TALENT_RESET_TEST_FREE else max(25, int(user.get("level", 1)) * 20),
    }


def class_chip(key: str) -> dict:
    meta = CLASS_META.get(key, {"label": key.title(), "icon": "◇"})
    return {"key": key, **meta}

def class_chips(keys: list[str]) -> list[dict]:
    return [class_chip(k) for k in keys if k in CLASS_META]

def upgrade_xp_to_next(level: int) -> int:
    return max(20, int(25 * (max(1, level) ** 1.5)))

def infer_item_class_tags(item: dict) -> list[str]:
    slot = item.get("slot")
    shape = item.get("shape")
    family = item.get("family")
    elem = item.get("element")
    name = (item.get("name") or "").lower()
    tags: list[str] = []
    if slot == "main_hand":
        if shape == "long" or any(w in name for w in ("spear", "lance", "halberd", "pike")):
            tags.append("lancer")
        elif shape == "ranged" or any(w in name for w in ("bow", "crossbow")):
            tags.append("archer")
        elif any(w in name for w in ("dagger", "stiletto", "knife", "dirk")):
            tags.append("assassin")
        elif item.get("int_stat", 0) > item.get("atk", 0):
            tags.append("mage")
        else:
            tags.append("infantry")
    elif slot in ("off_hand", "trinket", "ring", "necklace"):
        if item.get("int_stat", 0) > item.get("atk", 0) or family in ("office", "electronics"):
            tags.append("mage")
    if elem == "holy":
        tags.append("holy")
    if elem == "shadow":
        tags.append("demon")
    if family == "medicine" or "mender" in name or "remedy" in name:
        tags.append("healer")
    # no duplicate tags, preserve order
    out=[]
    for t in tags:
        if t not in out:
            out.append(t)
    return out or (["mage"] if item.get("int_stat",0) > item.get("atk",0) else ["infantry"])

def item_effective_vs(item: dict) -> list[str]:
    tags = infer_item_class_tags(item)
    eff=[]
    for t in tags:
        eff.extend(ADVANTAGE.get(t, []))
    # Bows explicitly punish fliers. Holy and Demon only counter each other.
    out=[]
    for e in eff:
        if e not in out:
            out.append(e)
    return out


def item_icon_for(item: dict) -> str:
    """Small RPG-style icon for inventory/battle rewards.

    Keep this deterministic and cheap. Frontend also has a fallback, but the
    backend should stamp scanned/dropped items so scans never crash when the
    UI asks for an icon.
    """
    slot = item.get("slot")
    shape = item.get("shape")
    family = item.get("family")
    element = item.get("element")
    name = (item.get("name") or "").lower()

    if slot == "upgrade":
        if "armor" in name:
            return "🔷"
        if "weapon" in name:
            return "🔶"
        return "💠"
    if slot == "consumable":
        if family == "medicine" or "heal" in name or "remedy" in name:
            return "💖"
        if family in ("drink", "coffee") or "mana" in name or "tonic" in name:
            return "🧪"
        return "🍖"
    if slot == "main_hand":
        if shape == "ranged" or any(w in name for w in ("bow", "crossbow")):
            return "🏹"
        if shape == "long" or any(w in name for w in ("lance", "spear", "halberd", "pike")):
            return "🔱"
        if any(w in name for w in ("staff", "wand", "tome", "rod")) or (item.get("int_stat", 0) > item.get("atk", 0)):
            return "🪄"
        if any(w in name for w in ("dagger", "knife", "stiletto", "dirk")):
            return "🗡️"
        return "⚔️"
    if slot == "off_hand":
        if any(w in name for w in ("shield", "buckler", "ward")):
            return "🛡️"
        return "📘" if item.get("int_stat",0) > item.get("atk",0) else "🗡️"
    if slot == "head":
        return "🪖"
    if slot == "chest":
        return "🧥" if item.get("int_stat",0) > item.get("def_stat",0) else "🛡️"
    if slot in ("left_arm", "right_arm"):
        return "🧤"
    if slot in ("left_leg", "right_leg"):
        return "🥾"
    if slot == "ring":
        return "💍"
    if slot == "necklace":
        return "📿"
    if slot == "trinket":
        if element == "holy":
            return "☀️"
        if element == "shadow":
            return "☠️"
        return "🧿"
    return "✨"

def equipped_affinity(equipped: list[dict], historical: Optional[dict] = None) -> dict:
    score = {k: 0 for k in CLASS_META.keys()}
    if historical:
        # Historical playstyle matters, but equipment is the strongest live signal.
        for k, v in historical.items():
            if k in score:
                score[k] += int(v)
    for it in equipped:
        tags = it.get("class_tags") or infer_item_class_tags(it)
        for tag in tags:
            if tag in score:
                score[tag] += 8 if it.get("slot") == "main_hand" else 3
        # clothie identity: high INT / healing / holy support pushes mage/healer.
        if it.get("int_stat",0) > it.get("atk",0):
            score["mage"] += 3
        if it.get("family") == "medicine" or it.get("element") == "holy":
            score["healer"] += 1
    primary = max(score, key=lambda k: score[k]) if score else "infantry"
    ordered = sorted(score.items(), key=lambda kv: kv[1], reverse=True)
    secondary = ordered[1][0] if len(ordered) > 1 and ordered[1][1] > 0 else None
    return {
        "primary": class_chip(primary if score.get(primary,0)>0 else "infantry"),
        "secondary": class_chip(secondary) if secondary else None,
        "scores": score,
        "legend": [
            {"from": class_chip("infantry"), "to": class_chip("lancer")},
            {"from": class_chip("lancer"), "to": class_chip("cavalry")},
            {"from": class_chip("cavalry"), "to": class_chip("infantry")},
            {"from": class_chip("archer"), "to": class_chip("flier")},
            {"from": class_chip("holy"), "to": class_chip("demon")},
            {"from": class_chip("demon"), "to": class_chip("holy")},
        ],
    }

async def adjust_class_affinity(user_id: str, deltas: dict):
    inc = {f"class_affinity.{k}": int(v) for k, v in deltas.items() if k in CLASS_META and v}
    if inc:
        await db.users.update_one({"id": user_id}, {"$inc": inc})


# ---------------- Trait & item generation ----------------

def _seed_rand(barcode: str, salt: str = "") -> random.Random:
    h = hashlib.sha256((barcode + salt).encode()).hexdigest()
    return random.Random(int(h[:16], 16))


def derive_traits(barcode: str) -> dict:
    """Hidden traits seeded from the barcode digits. Stable across scans."""
    digits = [int(c) for c in barcode if c.isdigit()]
    if not digits:
        digits = [sum(ord(c) for c in barcode) % 10]
    s = sum(digits)
    rng = _seed_rand(barcode, "traits")
    material = MATERIALS[s % len(MATERIALS)]
    element = ELEMENTS[(digits[0] if len(digits) > 0 else 0) % len(ELEMENTS)]
    shape = SHAPES[(digits[-1] if digits else 0) % len(SHAPES)]
    weight = WEIGHTS[(s // 3) % len(WEIGHTS)]
    family_idx = (digits[len(digits) // 2] if digits else 0) % len(FAMILIES)
    family = FAMILIES[family_idx]
    # "uncommonness" — unusual digit patterns boost loot luck
    unique_digits = len(set(digits))
    uncommonness = min(1.0, unique_digits / 10.0 + rng.random() * 0.15)
    return {
        "material": material,
        "element": element,
        "shape": shape,
        "weight": weight,
        "family": family,
        "uncommonness": uncommonness,
    }


def hint_to_family_overrides(hint: str) -> dict:
    """Override certain traits when a real-world product hint/category is provided.

    Important design rule: Barcodia should transmute real-world category into fantasy output.
    A drink should become a drink-like potion/tonic, food should become food/rations,
    tools should become weapons, clothing should become armor, etc.
    """
    h = (hint or "").lower().strip()
    out: dict = {}

    # More specific categories first.
    kw_family = [
        (("energy drink", "monster", "red bull", "celsius", "bang", "rockstar", "prime energy", "5-hour", "5 hour"), "energy_drink", "lightning"),
        (("coffee", "espresso", "latte", "cappuccino", "cold brew", "caffeine"), "coffee", "shadow"),
        (("water", "seltzer", "sparkling water", "mineral water"), "water", "holy"),
        (("soda", "cola", "pop", "juice", "tea", "drink", "beverage", "gatorade", "powerade", "sports drink"), "consumable_drink", None),
        (("medicine", "medication", "vitamin", "bandage", "first aid", "ibuprofen", "tylenol", "aspirin", "cough", "cold medicine"), "medicine", "holy"),
        (("hot sauce", "spice", "pepper", "salsa", "chili"), "consumable_food", "fire"),
        (("food", "pizza", "burger", "snack", "chips", "candy", "bread", "cereal", "cookie", "cracker", "protein bar", "jerky", "soup", "pasta", "rice", "apple", "fruit"), "consumable_food", None),
        (("hammer", "wrench", "screwdriver", "nail", "saw", "drill", "tool", "pliers", "socket", "ratchet"), "hardware", None),
        (("knife", "spoon", "fork", "pan", "pot", "kitchen", "utensil"), "kitchen", None),
        (("battery", "flashlight", "phone", "charger", "cable", "headphone", "earbud", "usb", "keyboard", "mouse", "electronic", "gaming", "controller"), "electronics", "lightning"),
        (("shirt", "pants", "sock", "fabric", "cloth", "towel", "blanket", "jacket", "coat", "hat", "glove", "boot", "shoe", "clothing"), "fabric", None),
        (("ring", "necklace", "bracelet", "jewelry", "earring", "watch"), "jewelry", None),
        (("book", "pencil", "pen", "paper", "notebook", "marker", "folder", "binder", "office", "school"), "office", None),
        (("cleaner", "cleaning", "bleach", "detergent", "soap", "shampoo", "lotion", "spray", "disinfect", "sanitizer"), "cleaning", "holy"),
        (("toy", "game", "plush", "doll", "figure", "lego", "ball"), "toy", "nature"),
        (("candle", "lighter", "match", "decor", "ornament"), "decor", "fire"),
    ]
    for kws, fam, elem in kw_family:
        if any(k in h for k in kws):
            out["family"] = fam
            if elem:
                out["element"] = elem
            break

    kw_shape = [
        (("hammer", "mallet", "wrench", "bat"), "blunt"),
        (("knife", "blade", "razor", "scissors"), "sharp"),
        (("screwdriver", "spear", "pen", "pencil", "wand", "rod"), "long"),
        (("ball", "can", "bottle", "jar", "ring"), "round"),
        (("bow", "gun", "remote", "controller"), "ranged"),
    ]
    for kws, sh in kw_shape:
        if any(k in h for k in kws):
            out["shape"] = sh
            break

    return out


def consumable_kind_for_family(family: str) -> str:
    if family == "energy_drink":
        return "stamina"
    if family == "coffee":
        return "focus"
    if family == "water":
        return "hydration"
    if family == "medicine":
        return "healing"
    if family == "consumable_food":
        return "food"
    if family == "cleaning":
        return "cleanse"
    return "drink"


def family_to_slot(traits: dict, rng: random.Random) -> Slot:
    """Map family + shape to a slot. Fantasy transmutation rules."""
    fam = traits["family"]
    shape = traits["shape"]
    if fam in ("consumable_drink", "energy_drink", "coffee", "water", "consumable_food", "medicine", "cleaning"):
        return "consumable"
    if fam == "fabric":
        # Clothing/fabric becomes practical equipment for body slots.
        return rng.choice(["chest", "head", "leg_l", "leg_r", "arm_l", "arm_r"])
    if fam == "jewelry":
        return rng.choice(["ring", "necklace", "arm_l", "arm_r", "trinket"])
    if fam == "toy":
        return rng.choice(["trinket", "off_hand", "ring"])
    if fam == "decor":
        return rng.choice(["trinket", "ring", "necklace"])
    if fam == "office":
        # Writing tools and books become scholar gear: wands, tomes, relics.
        return rng.choice(["main_hand", "off_hand", "trinket", "necklace"])
    if fam == "electronics":
        # Tech becomes lightning/arcane gear more often than literal weapons.
        return rng.choice(["trinket", "ring", "necklace", "off_hand", "main_hand"])
    if fam in ("hardware", "kitchen"):
        # Tools and kitchen blades become weapons or off-hand gear.
        if shape == "sharp":
            return rng.choice(["main_hand", "off_hand"])
        return "main_hand"
    return rng.choice(GEAR_SLOTS)


def is_upgrade_material(barcode: str) -> bool:
    """Rare: certain barcode endings yield upgrade scrolls."""
    if not barcode:
        return False
    return barcode[-1] in ("3", "7")


# Fantasy subtype tables — picked by slot + element + shape
SUBTYPE_TABLE = {
    "main_hand": {
        "blunt": ["Mace", "Warhammer", "Maul", "Cudgel"],
        "sharp": ["Sword", "Sabre", "Falchion", "Cleaver"],
        "long": ["Spear", "Halberd", "Pike", "Lance"],
        "round": ["Orb-Staff", "Crystal Rod", "Wand", "Sceptre"],
        "ranged": ["Longbow", "Crossbow", "Hand-Cannon"],
    },
    "off_hand": {
        "blunt": ["Buckler", "Iron Tower-Shield"],
        "sharp": ["Dagger", "Stiletto", "Kris"],
        "long": ["Parrying Dirk", "Off-Spike"],
        "round": ["Focus Orb", "Catalyst", "Tome"],
        "ranged": ["Throwing Knife Set"],
    },
    "head": {"_": ["Helm", "Hood", "Crown", "Circlet", "Mask"]},
    "chest": {"_": ["Plate Cuirass", "Robe", "Tunic", "Brigandine", "Mail Hauberk"]},
    "leg_l": {"_": ["Greave", "Boot", "Sabaton"]},
    "leg_r": {"_": ["Greave", "Boot", "Sabaton"]},
    "arm_l": {"_": ["Pauldron", "Bracer", "Vambrace"]},
    "arm_r": {"_": ["Pauldron", "Bracer", "Vambrace"]},
    "trinket": {"_": ["Talisman", "Sigil", "Effigy"]},
    "ring": {"_": ["Signet", "Band", "Loop"]},
    "necklace": {"_": ["Pendant", "Amulet", "Choker"]},
    "consumable": {"_": ["Potion", "Phial", "Elixir", "Tonic"]},
    "upgrade": {"_": ["Weapon Shard", "Armor Shard", "Echo Shard", "Runestone Fragment"]},
}

PREFIX_BY_RARITY = {
    "common": ["Worn", "Sturdy", "Rusted", "Plain", "Tarnished"],
    "rare": ["Glimmering", "Keen", "Runed", "Verdant", "Silvered"],
    "epic": ["Stormforged", "Eclipse-Touched", "Voidbound", "Radiant", "Soul-Etched"],
    "legendary": ["Astral", "Dragonsoul", "Celestial", "Mythbound", "Aeonsworn"],
}

ELEMENT_PREFIX = {
    "fire": "Ember",
    "lightning": "Thunder",
    "ice": "Frost",
    "holy": "Lumen",
    "shadow": "Umbral",
    "nature": "Verdant",
    "none": "",
}


def roll_rarity(rng: random.Random, char_level: int, luck_bias: float) -> Rarity:
    roll = rng.random() * 100 - luck_bias * 8
    bonus = min(char_level, 20)
    if roll < 60 - bonus:
        return "common"
    elif roll < 86 - bonus * 0.5:
        return "rare"
    elif roll < 97:
        return "epic"
    return "legendary"


def two_handed_for(slot: str, shape: str, rng: random.Random) -> bool:
    if slot != "main_hand":
        return False
    if shape == "ranged":
        return True
    if shape == "long":
        return True
    return rng.random() < 0.18  # ~18% greatswords/mauls


def gen_stats_for(slot: str, level: int, rarity: Rarity, element: str, traits: dict, rng: random.Random, two_hand: bool) -> dict:
    """RPG-first stat generation. Physical weapons mostly ATK; caster gear mostly INT/RES. Mobility is rare and capped."""
    rar_mult = {"common": 1.0, "rare": 1.45, "epic": 1.95, "legendary": 2.7}[rarity]
    s = {"atk": 0, "int_stat": 0, "def_stat": 0, "res": 0, "dex": 0, "mob": 0,
         "crit": 0, "luk": 0, "hp": 0, "mana": 0, "stamina_restore": 0}
    base = max(1, level)
    shape = traits.get("shape", "")
    family = traits.get("family", "")

    def pick(lo: float, hi: float) -> int:
        return max(1, int(base * rar_mult * rng.uniform(lo, hi)))

    caster_family = family in ("office", "electronics") or element in ("holy", "shadow", "ice", "lightning") and shape in ("round", "long")

    if slot == "main_hand":
        if shape in ("long", "sharp", "blunt", "ranged") and not caster_family:
            s["atk"] = pick(1.2, 2.1)
            # Hybrid flavor exists, but physical weapons should not become random INT sticks.
            if element in ("holy", "shadow", "fire", "lightning", "ice") and rarity in ("epic", "legendary") and rng.random() < 0.35:
                s["int_stat"] = pick(0.15, 0.35)
        else:
            s["int_stat"] = pick(1.2, 2.0)
            s["mana"] = pick(0.6, 1.4)
            if rng.random() < 0.35:
                s["res"] = pick(0.25, 0.6)
        if two_hand:
            s["atk"] = int(s["atk"] * 1.35)
            s["int_stat"] = int(s["int_stat"] * 1.25)
            if rng.random() < 0.45:
                s["mob"] = -1  # heavy weapons can slow initiative.
        if shape == "ranged":
            s["dex"] = pick(0.4, 0.9)
        s["crit"] = pick(0.1, 0.35) if rng.random() < 0.6 else 0
    elif slot == "off_hand":
        if caster_family or element in ("holy", "shadow", "lightning", "ice"):
            s["int_stat"] = pick(0.5, 1.1)
            s["res"] = pick(0.3, 0.8)
            s["mana"] = pick(0.3, 0.8)
        else:
            s["atk"] = pick(0.4, 0.9)
            s["def_stat"] = pick(0.3, 0.8)
        s["crit"] = pick(0.1, 0.25) if rng.random() < 0.35 else 0
    elif slot == "head":
        s["def_stat"] = pick(0.6, 1.1)
        s["res"] = pick(0.4, 0.9)
        s["hp"] = pick(0.4, 1.0)
    elif slot == "chest":
        # robes are squishier physically but better for INT/RES; armor is sturdy.
        if family in ("fabric", "office") and rng.random() < 0.45:
            s["res"] = pick(0.8, 1.5)
            s["int_stat"] = pick(0.4, 0.9)
            s["mana"] = pick(0.5, 1.1)
            s["def_stat"] = pick(0.25, 0.55)
        else:
            s["def_stat"] = pick(1.0, 1.8)
            s["res"] = pick(0.5, 1.0)
            s["hp"] = pick(1.0, 1.8)
    elif slot in ("leg_l", "leg_r"):
        s["def_stat"] = pick(0.45, 0.9)
        s["hp"] = pick(0.3, 0.8)
        # Mobility boots are intentionally rare and small.
        mob_chance = 0.10 + (0.05 if rarity in ("rare", "epic", "legendary") else 0)
        if rng.random() < mob_chance:
            s["mob"] = 1 + (1 if rarity in ("epic", "legendary") and rng.random() < 0.35 else 0)
    elif slot in ("arm_l", "arm_r"):
        s["def_stat"] = pick(0.4, 0.9)
        s["dex"] = pick(0.3, 0.7)
        s["crit"] = pick(0.1, 0.2) if rng.random() < 0.45 else 0
    elif slot == "trinket":
        s["luk"] = pick(0.7, 1.2)
        if rng.random() < 0.55:
            s["crit"] = pick(0.2, 0.5)
        if rng.random() < 0.08 and rarity in ("epic", "legendary"):
            s["mob"] = 1
    elif slot == "ring":
        if rng.random() < 0.55:
            s["int_stat"] = pick(0.4, 0.9)
            s["mana"] = pick(0.6, 1.2)
        else:
            s["atk"] = pick(0.4, 0.9)
            s["dex"] = pick(0.3, 0.7)
    elif slot == "necklace":
        s["res"] = pick(0.6, 1.2)
        s["mana"] = pick(0.5, 1.1)
        s["int_stat"] = pick(0.3, 0.7)
    elif slot == "consumable":
        kind = consumable_kind_for_family(traits.get("family", "consumable_drink"))
        potency = int((18 + level * 8) * rar_mult)
        if kind == "stamina":
            s["stamina_restore"] = max(1, int(1 + rar_mult))
            s["mana"] = max(5, potency // 2)
            s["mob"] = 1 if rarity != "common" else 0
        elif kind == "focus":
            s["mana"] = max(8, potency)
            s["dex"] = max(1, pick(0.2, 0.6))
            s["stamina_restore"] = 1 if rarity in ("rare", "epic", "legendary") else 0
        elif kind == "hydration":
            s["hp"] = max(8, potency // 2)
            s["mana"] = max(6, potency // 2)
            s["stamina_restore"] = 1
        elif kind == "healing":
            s["hp"] = max(20, int(potency * 1.35))
            s["res"] = max(1, pick(0.2, 0.5))
        elif kind == "food":
            s["hp"] = max(15, potency)
            s["stamina_restore"] = 1 if rarity != "common" else 0
        elif kind == "cleanse":
            s["hp"] = max(8, potency // 2)
            s["res"] = max(1, pick(0.3, 0.7))
        else:
            s[rng.choice(["hp", "mana"])] = potency
    elif slot == "upgrade":
        # Shards add upgrade XP. They are not gear and should not give combat stats.
        s["upgrade_xp_value"] = int((10 + level * 5) * rar_mult)
    return s

def fallback_name(slot: str, shape: str, rarity: Rarity, element: str, rng: random.Random, family: Optional[str] = None) -> str:
    family = family or ""
    if slot == "consumable":
        consumable_tables = {
            "energy_drink": ["Storm Surge Tonic", "Lightning Stamina Draught", "Voltstep Elixir", "Thunderwake Flask"],
            "coffee": ["Focus Brew", "Midnight Clarity Roast", "Scholar's Wake Draught", "Darkbean Elixir"],
            "water": ["Hydration Flask", "Clearwell Phial", "Springlight Tonic", "Purestream Vial"],
            "medicine": ["Mender's Draught", "Restoration Phial", "Vitality Tonic", "Saintleaf Remedy"],
            "consumable_food": ["Trail Ration", "Hearthbite Meal", "Adventurer's Morsel", "Fortifying Snack"],
            "cleaning": ["Cleansing Reagent", "Purity Tonic", "Brightwash Phial", "Sanctified Solution"],
            "consumable_drink": ["Mana Fizz", "Sparkling Elixir", "Quicksip Tonic", "Bubbling Draught"],
        }
        choices = consumable_tables.get(family, consumable_tables["consumable_drink"])
        base = rng.choice(choices)
        if rarity in ("epic", "legendary"):
            elem_pref = ELEMENT_PREFIX.get(element, "")
            if elem_pref:
                return f"{elem_pref} {base}"
        return base

    if slot == "upgrade":
        return rng.choice(["Weapon Shard", "Armor Shard", "Echo Shard", "Runestone Fragment", "Resonance Crystal"])

    table = SUBTYPE_TABLE[slot]
    bases = table.get(shape) or table.get("_") or ["Relic"]
    base = rng.choice(bases)
    pref_choices = PREFIX_BY_RARITY[rarity]
    pref = rng.choice(pref_choices)
    elem_pref = ELEMENT_PREFIX.get(element, "")
    if elem_pref and rarity in ("rare", "epic", "legendary"):
        return f"{elem_pref} {base}"
    return f"{pref} {base}"


def fallback_lore(slot: str, family: str, element: str) -> str:
    if slot == "consumable":
        lore_by_family = {
            "energy_drink": "A crackling tonic that turns restless energy into battlefield momentum.",
            "coffee": "A dark brew favored by night scholars and quick-handed duelists.",
            "water": "A clear restorative flask blessed for long roads and longer battles.",
            "medicine": "A careful remedy distilled for recovery when adventure cuts too deep.",
            "consumable_food": "A compact ration that restores strength without slowing the journey.",
            "cleaning": "A purifying reagent that washes away grime, hexes, and lesser wounds.",
            "consumable_drink": "A fizzing fantasy draught bottled from everyday refreshment.",
        }
        return lore_by_family.get(family, lore_by_family["consumable_drink"])
    if family == "electronics":
        return "A humming arcane device transmuted from captured sparks and hidden circuitry."
    if family == "fabric":
        return "Protective gear woven from mundane cloth and awakened thread."
    if family in ("hardware", "kitchen"):
        return "A practical tool reborn as an adventurer's weapon through barcode alchemy."
    if family == "office":
        return "Scholar's gear shaped from paper, ink, and disciplined imagination."
    if family == "jewelry":
        return "A small adornment awakened into a charm of quiet power."
    if family == "toy":
        return "A playful relic carrying the strange courage of imagined battles."
    return "An artifact of unknown origin, transmuted from the ordinary world."


async def ai_flavor(slot: str, rarity: Rarity, level: int, element: str, traits: dict, fallback: str, hint: Optional[str]) -> dict:
    """Claude Haiku 4.5 — fantasy NAME + LORE only. Never echoes real product."""
    if not EMERGENT_LLM_KEY:
        return {"name": fallback, "lore": fallback_lore(slot, traits.get("family", ""), element)}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        sys_msg = (
            "You write fantasy/anime RPG item names + one-line lore. "
            "CRITICAL: Never repeat real-world product/brand names — instead, transmute the inspiration into pure fantasy. "
            'Respond in STRICT JSON: {"name": string, "lore": string}. '
            "Name: 2-5 words, fantasy-anime tone. Lore: one evocative sentence, max 28 words."
        )
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"item-{uuid.uuid4()}",
                       system_message=sys_msg).with_model("anthropic", "claude-haiku-4-5-20251001")
        prompt = (
            f"Slot: {slot}\nRarity: {rarity}\nLevel: {level}\nElement: {element}\n"
            f"Material: {traits['material']}\nShape: {traits['shape']}\nWeight: {traits['weight']}\n"
            f"Family inspiration: {traits['family']}\n"
            f"Real product hint (NEVER mention by name, only let it influence theme): {hint or 'none'}\n"
            f"Fallback base: {fallback}\n"
            "Generate JSON now."
        )
        resp = await chat.send_message(UserMessage(text=prompt))
        text = resp.strip() if isinstance(resp, str) else str(resp)
        import json, re
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            parsed = json.loads(m.group(0))
            name = str(parsed.get("name", "")).strip() or fallback
            lore = str(parsed.get("lore", "")).strip() or "Its story is yet untold."
            return {"name": name[:60], "lore": lore[:200]}
    except Exception as e:
        logger.warning(f"AI flavor failed: {e}")
    return {"name": fallback, "lore": "Its story is yet untold."}


def calc_price_band(item: dict) -> Tuple[int, int]:
    rarity_base = {"common": 20, "rare": 90, "epic": 320, "legendary": 1300}[item["rarity"]]
    power = sum(item.get(k, 0) for k in ("atk", "int_stat", "def_stat", "res", "dex", "mob", "crit", "luk", "hp", "mana"))
    base = rarity_base + item["level"] * 12 + power * 2
    return int(base * 0.5), int(base * 2.0)


def stamina_max_for_user(u: dict) -> int:
    return stamina_max(u["level"])



# ---------------- Daily goals / adventure progression ----------------

DAILY_GOAL_DEFS = [
    {"key": "quick_wins", "label": "Win 5 Quick Hunts", "target": 5, "reward_gold": 35, "reward_xp": 10},
    {"key": "scans", "label": "Scan 3 items", "target": 3, "reward_gold": 25, "reward_xp": 8},
    {"key": "destroy", "label": "Destroy 1 item", "target": 1, "reward_gold": 20, "reward_xp": 5},
    {"key": "use_item", "label": "Use 1 consumable", "target": 1, "reward_gold": 20, "reward_xp": 5},
    {"key": "adventure_win", "label": "Win 1 Adventure node", "target": 1, "reward_gold": 40, "reward_xp": 12},
]

ADVENTURE_BIOMES = {
    1: {
        "name": "Whisperwood Forest",
        "subtitle": "A glowing trail curls around ancient roots.",
        "biome": "forest",
        "background": "forest_sigil_path",
        "accent": "#68D391",
        "nodes": [
            {"node": 1, "kind": "normal", "name": "Moss Trail", "enemy": "Green Slimeling", "x": 24, "y": 90},
            {"node": 2, "kind": "normal", "name": "Fern Bend", "enemy": "Cave Bat", "x": 62, "y": 165},
            {"node": 3, "kind": "normal", "name": "Root Steps", "enemy": "Briar Rat", "x": 38, "y": 250},
            {"node": 4, "kind": "elite", "name": "Old Hollow", "enemy": "Thorn Imp", "x": 70, "y": 335},
            {"node": 5, "kind": "miniboss", "name": "Scary Tree", "enemy": "Hollowroot Watcher", "x": 48, "y": 430},
            {"node": 6, "kind": "normal", "name": "Lantern Moss", "enemy": "Forest Wisp", "x": 24, "y": 520},
            {"node": 7, "kind": "elite", "name": "Wolf Gate", "enemy": "Moonfang Wolf", "x": 68, "y": 605},
            {"node": 8, "kind": "normal", "name": "Bluecap Ring", "enemy": "Sporeling", "x": 36, "y": 700},
            {"node": 9, "kind": "elite", "name": "Thorn Bridge", "enemy": "Briar Knight", "x": 66, "y": 785},
            {"node": 10, "kind": "boss", "name": "Boss Clearing", "enemy": "Elder Thornwarden", "x": 50, "y": 890},
        ],
    }
}

def today_key() -> str:
    return now_utc().date().isoformat()

def daily_goal_template() -> dict:
    return {
        "date": today_key(),
        "claimed_all": False,
        "premium_currency_key": PREMIUM_CURRENCY_KEY,
        "premium_currency_name": PREMIUM_CURRENCY_NAME,
        "complete_reward": DAILY_COMPLETE_GEM_REWARD,
        "progress": {g["key"]: 0 for g in DAILY_GOAL_DEFS},
        "claimed": {g["key"]: False for g in DAILY_GOAL_DEFS},
    }

def normalize_daily_goals(user: dict) -> dict:
    dg = user.get("daily_goals") or {}
    if dg.get("date") != today_key():
        return daily_goal_template()
    tmpl = daily_goal_template()
    tmpl.update(dg)
    tmpl["progress"] = {**daily_goal_template()["progress"], **(dg.get("progress") or {})}
    tmpl["claimed"] = {**daily_goal_template()["claimed"], **(dg.get("claimed") or {})}
    tmpl["premium_currency_key"] = PREMIUM_CURRENCY_KEY
    tmpl["premium_currency_name"] = PREMIUM_CURRENCY_NAME
    tmpl["complete_reward"] = DAILY_COMPLETE_GEM_REWARD
    return tmpl

def build_daily_payload(user: dict) -> dict:
    dg = normalize_daily_goals(user)
    goals = []
    all_done = True
    for g in DAILY_GOAL_DEFS:
        cur = int(dg["progress"].get(g["key"], 0) or 0)
        target = int(g["target"])
        done = cur >= target
        all_done = all_done and done
        goals.append({**g, "progress": min(cur, target), "done": done, "claimed": bool(dg["claimed"].get(g["key"], False))})
    return {"date": dg["date"], "goals": goals, "all_done": all_done, "claimed_all": bool(dg.get("claimed_all", False)), "complete_reward": DAILY_COMPLETE_GEM_REWARD, "premium_currency_key": PREMIUM_CURRENCY_KEY, "premium_currency_name": PREMIUM_CURRENCY_NAME, "currency_balance": int(user.get(PREMIUM_CURRENCY_KEY, 0) or 0)}

async def ensure_daily_on_user(user: dict) -> dict:
    dg = normalize_daily_goals(user)
    if dg != (user.get("daily_goals") or {}):
        await db.users.update_one({"id": user["id"]}, {"$set": {"daily_goals": dg}})
        user["daily_goals"] = dg
    return user

async def credit_daily_goal(user_id: str, key: str, amount: int = 1):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return
    dg = normalize_daily_goals(user)
    if key in dg["progress"]:
        target = next((g["target"] for g in DAILY_GOAL_DEFS if g["key"] == key), 999)
        dg["progress"][key] = min(int(target), int(dg["progress"].get(key, 0) or 0) + amount)
        await db.users.update_one({"id": user_id}, {"$set": {"daily_goals": dg}})

async def auto_claim_completed_daily_goals(user: dict) -> dict:
    dg = normalize_daily_goals(user)
    inc = {"gold": 0}
    xp_gain = 0
    changed = False
    for g in DAILY_GOAL_DEFS:
        key = g["key"]
        if int(dg["progress"].get(key, 0) or 0) >= int(g["target"]) and not dg["claimed"].get(key, False):
            dg["claimed"][key] = True
            inc["gold"] += int(g.get("reward_gold", 0))
            xp_gain += int(g.get("reward_xp", 0))
            changed = True
    all_done = all(int(dg["progress"].get(g["key"], 0) or 0) >= int(g["target"]) for g in DAILY_GOAL_DEFS)
    if all_done and not dg.get("claimed_all", False):
        dg["claimed_all"] = True
        inc[PREMIUM_CURRENCY_KEY] = DAILY_COMPLETE_GEM_REWARD
        changed = True
    if changed:
        update = {"daily_goals": dg}
        ops = {"$set": update}
        inc = {k: v for k, v in inc.items() if v}
        if inc:
            ops["$inc"] = inc
        await db.users.update_one({"id": user["id"]}, ops)
        if xp_gain:
            await grant_xp(user["id"], xp_gain)
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return fresh or user


# Battle state isolation helpers. Quick Hunt and Adventure must never share the same
# preview/enemy document. A user can have one stored quick hunt enemy and one stored
# adventure-node enemy at the same time. The active mode simply decides which state
# battle/fight should resolve.
BATTLE_MODE_QUICK = "quick"
BATTLE_MODE_ADVENTURE = "adventure"

def battle_state_query(user_id: str, mode: str) -> dict:
    return {"user_id": user_id, "battle_mode": mode}

def normalize_battle_mode(mode: Optional[str]) -> str:
    return BATTLE_MODE_ADVENTURE if mode == BATTLE_MODE_ADVENTURE else BATTLE_MODE_QUICK

async def set_active_battle_mode(user_id: str, mode: str):
    await db.users.update_one({"id": user_id}, {"$set": {"active_battle_mode": normalize_battle_mode(mode)}})

def active_battle_mode_for(user: dict) -> str:
    return normalize_battle_mode(user.get("active_battle_mode"))

# Initial enemy-pool metadata. This is the foundation for an admin-editable system.
# Bosses/minibosses are adventure-only and should never leak into Quick Hunt.
ENEMY_POOL_RULES = {
    "shared": ["Green Slimeling", "Cave Bat", "Moonfang Wolf", "Forest Wisp"],
    "quick_hunt": ["Green Slimeling", "Cave Bat", "Bandit Archer", "Goblin Scout", "Moonfang Wolf"],
    "adventure_tier_1_forest": [
        "Green Slimeling", "Cave Bat", "Briar Rat", "Thorn Imp",
        "Hollowroot Watcher", "Forest Wisp", "Moonfang Wolf", "Sporeling",
        "Briar Knight", "Elder Thornwarden",
    ],
    "quick_hunt_excluded_roles": ["miniboss", "boss"],
}

def get_adventure_progress(user: dict) -> dict:
    prog = user.get("adventure_progress") or {"tier": 1, "highest_node": 0, "completed": []}
    completed = sorted({int(x) for x in (prog.get("completed") or []) if str(x).isdigit()})
    # Trust actual completed nodes over any stale highest_node value from older builds.
    # This prevents old Quick Hunt/adventure bugs from pushing the map forward incorrectly.
    contiguous = 0
    for n in range(1, 11):
        if n in completed:
            contiguous = n
        else:
            break
    return {"tier": int(prog.get("tier", 1) or 1), "highest_node": contiguous, "completed": completed}

def build_adventure_map(user: dict) -> dict:
    prog = get_adventure_progress(user)
    tier = prog["tier"]
    biome = ADVENTURE_BIOMES.get(tier) or {**ADVENTURE_BIOMES[1], "name": f"Tier {tier} Forest Depths", "subtitle": "The forest path grows darker and stronger enemies wait ahead."}
    completed = set(prog["completed"])
    highest = max(0, min(10, int(prog["highest_node"])))
    current_node = 1 if highest <= 0 else min(10, highest + 1)
    nodes = []
    for n in biome["nodes"]:
        node_no = int(n["node"])
        completed_node = node_no in completed
        unlocked = node_no == current_node or completed_node
        nodes.append({**n, "completed": completed_node, "unlocked": unlocked, "current": (node_no == current_node and not completed_node)})
    return {"tier": tier, "name": biome["name"], "subtitle": biome["subtitle"], "biome": biome["biome"], "background": biome["background"], "accent": biome["accent"], "progress": {**prog, "highest_node": highest, "current_node": current_node}, "nodes": nodes}

def adventure_node_def(tier: int, node_no: int) -> dict:
    biome = ADVENTURE_BIOMES.get(tier) or ADVENTURE_BIOMES[1]
    for n in biome["nodes"]:
        if int(n["node"]) == int(node_no):
            return n
    raise HTTPException(404, "Adventure node not found")

def gen_adventure_enemy(tier: int, node_no: int) -> dict:
    node = adventure_node_def(tier, node_no)
    kind = node.get("kind", "normal")
    base = 16 + tier * 4 + node_no * 3
    mult = {"normal": 1.0, "elite": 1.25, "miniboss": 1.65, "boss": 2.25}.get(kind, 1.0)
    tags_by_kind = {"normal": ["infantry"], "elite": ["assassin"], "miniboss": ["lancer", "nature"], "boss": ["demon", "infantry"]}
    tags = [t for t in tags_by_kind.get(kind, ["infantry"]) if t in CLASS_META]
    if not tags:
        tags = ["infantry"]
    hp = int(base * mult)
    atk = max(2, int(2 + tier + node_no * 0.45 + (2 if kind in ("miniboss", "boss") else 0)))
    enemy = {
        "id": str(uuid.uuid4()), "monster_id": f"adv_t{tier}_n{node_no}", "name": node["enemy"],
        "archetype": tags[0], "class_tags": tags, "class_chips": class_chips(tags),
        "portrait": enemy_portrait_asset(f"adv_t{tier}_n{node_no}", node.get("enemy", ""), tags, kind),
        "tier": tier, "elite": kind in ("elite", "miniboss", "boss"), "hp": hp, "max_hp": hp,
        "atk": atk, "int_stat": max(1, tier + (2 if "demon" in tags else 0)), "def_stat": max(0, tier + node_no // 4),
        "res": max(0, tier + node_no // 5), "dex": max(1, tier + node_no // 3), "mob": min(10, 1 + node_no // 3),
        "crit": 2 + node_no, "blind_turns": 0,
        "xp_reward": int((8 + node_no * 2 + tier * 4) * (0.7 if kind == "normal" else 1.0)),
        "gold_reward": int((5 + node_no + tier * 3) * (1.0 if kind == "normal" else 1.4)),
        "adventure_kind": kind,
    }
    return enemy

async def adventure_boss_reward(user_id: str, tier: int, node_no: int) -> Optional[dict]:
    if node_no not in (5, 10):
        return None
    user = await db.users.find_one({"id": user_id})
    level = max(1, int(user.get("level", 1) if user else 1)) + tier
    kind = "boss" if node_no == 10 else "miniboss"
    slot = "chest" if kind == "miniboss" else "main_hand"
    rarity = "rare" if tier <= 1 else "epic"
    name = "Hollowroot Barkplate" if node_no == 5 else "Thornwarden Relicblade"
    traits = {"element":"nature", "material":"wood", "shape":"sharp" if slot=="main_hand" else "round", "weight":"medium", "family":"fabric" if slot=="chest" else "hardware", "uncommonness": 0.85}
    rng = random.Random(tier * 100 + node_no)
    stats = gen_stats_for(slot, level, rarity, traits["element"], traits, rng, two_handed_for(slot, traits["shape"], rng))
    item = {"id": str(uuid.uuid4()), "owner_id": user_id, "barcode": f"BOSS-T{tier}-N{node_no}", "name": name, "lore": "A milestone reward earned from the forest path.", "slot": slot, "rarity": rarity, "level": level, "element": traits["element"], "material": traits["material"], "shape": traits["shape"], "weight": traits["weight"], "family": traits["family"], "two_handed": slot=="main_hand", "equipped": False, "listed": False, "class_tags": [], "effective_vs": [], "upgrade_xp": 0, "upgrade_xp_to_next": upgrade_xp_to_next(level), "created_at": now_utc(), **stats}
    item["class_tags"] = infer_item_class_tags(item)
    item["effective_vs"] = item_effective_vs(item)
    item["icon"] = item_icon_for(item)
    await db.items.insert_one(dict(item))
    item.pop("_id", None)
    return item

# ---------------- Routes ----------------

@api.get("/")
async def root():
    return {"message": "Barcodia API"}


def new_user_doc(user_id: str, email: str, username: str, password_hash: Optional[str], avatar: str, provider: str) -> dict:
    return {
        "id": user_id,
        "email": email,
        "username": username,
        "password": password_hash,
        "avatar": avatar,
        "level": 1,
        "xp": 0,
        "gold": 500,
        PREMIUM_CURRENCY_KEY: 0,
        "hp": 100,
        "mana": 50,
        "max_hp": 100,
        "max_mana": 50,
        "stamina": 5,
        "stamina_max": 5,
        "stamina_updated_at": now_utc(),
        "sigil_charge": SIGIL_CHARGE_MAX,
        "sigil_charge_max": SIGIL_CHARGE_MAX,
        "sigil_charge_updated_at": now_utc(),
        "difficulty_tier": 1,
        "battles_won": 0,
        "battles_lost": 0,
        "class_affinity": {},
        "talents": {},
        "daily_goals": {},
        "adventure_progress": {"tier": 1, "highest_node": 0, "completed": []},
        "auth_provider": provider,
        "created_at": now_utc(),
    }


@api.post("/auth/register", response_model=TokenOut)
async def register(body: RegisterIn):
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(400, "Email already registered")
    if await db.users.find_one({"username": body.username}):
        raise HTTPException(400, "Username taken")
    user_id = str(uuid.uuid4())
    doc = new_user_doc(user_id, body.email.lower(), body.username,
                       hash_password(body.password), "preset:1", "password")
    await db.users.insert_one(doc)
    doc.pop("password", None)
    doc.pop("_id", None)
    return TokenOut(token=make_token(user_id), user=doc)


@api.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not user.get("password") or not verify_password(body.password, user["password"]):
        raise HTTPException(401, "Invalid credentials")
    user.pop("password", None)
    user.pop("_id", None)
    return TokenOut(token=make_token(user["id"]), user=user)


@api.post("/auth/google/session", response_model=TokenOut)
async def google_session(body: GoogleSessionIn):
    try:
        async with httpx.AsyncClient(timeout=15.0) as cli:
            resp = await cli.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": body.session_id},
            )
        if resp.status_code != 200:
            raise HTTPException(401, "Google session invalid")
        data = resp.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google session error: {e}")
        raise HTTPException(502, "Auth service unavailable")

    email = (data.get("email") or "").lower().strip()
    name = (data.get("name") or "").strip()
    picture = data.get("picture") or ""
    if not email:
        raise HTTPException(400, "No email in Google session")

    user = await db.users.find_one({"email": email})
    if user:
        user_id = user["id"]
        if picture and not (user.get("avatar") or "").startswith("data:"):
            await db.users.update_one({"id": user_id}, {"$set": {"avatar": picture}})
    else:
        base = name or email.split("@")[0]
        username = base[:20]
        suf = 0
        while await db.users.find_one({"username": username}):
            suf += 1
            username = f"{base[:16]}{suf}"
        user_id = str(uuid.uuid4())
        doc = new_user_doc(user_id, email, username, None, picture or "preset:1", "google")
        await db.users.insert_one(doc)

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return TokenOut(token=make_token(user_id), user=user)


@api.put("/auth/avatar")
async def update_avatar(body: AvatarIn, user=Depends(get_current_user)):
    val = body.avatar.strip()
    if not val:
        raise HTTPException(400, "Empty avatar")
    if not (val.startswith("preset:") or val.startswith("http://")
            or val.startswith("https://") or val.startswith("data:image/")):
        raise HTTPException(400, "Invalid avatar format")
    if val.startswith("data:image/") and len(val) > 1_500_000:
        raise HTTPException(400, "Avatar too large")
    await db.users.update_one({"id": user["id"]}, {"$set": {"avatar": val}})
    return await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    user = await ensure_daily_on_user(user)
    user.update(stamina_display_payload(user))
    user.update(sigil_display_payload(user))
    user["premium_currency_key"] = PREMIUM_CURRENCY_KEY
    user["premium_currency_name"] = PREMIUM_CURRENCY_NAME
    user[PREMIUM_CURRENCY_KEY] = int(user.get(PREMIUM_CURRENCY_KEY, 0) or 0)
    return user


# ---------------- Realm / World Foundation ----------------

DEFAULT_REALM_DATA = {
    "realms": [
        {
            "id": "real",
            "label": "Real World",
            "short_label": "Real",
            "accent": "#38BDF8",
            "locations": [
                {"id": "bedroom", "name": "Bedroom", "subtitle": "", "type": "home", "image": "asset:realms/bedroom_clean.png", "unlocked": True, "current_default": True, "hotspots": [
                    {"id": "computer", "label": "Computer", "icon": "▭", "x_pct": 18, "y_pct": 31, "width_pct": 12, "height_pct": 10, "action_type": "open_computer"},
                    {"id": "window", "label": "Window", "icon": "□", "x_pct": 51, "y_pct": 22, "width_pct": 14, "height_pct": 12, "action_type": "change_scene", "linked_location": "bedroom_window"},
                    {"id": "bed", "label": "Bed", "icon": "▰", "x_pct": 70, "y_pct": 52, "width_pct": 18, "height_pct": 12, "action_type": "rest"},
                    {"id": "kitchen_door", "label": "Kitchen", "icon": "⌂", "x_pct": 82, "y_pct": 62, "width_pct": 14, "height_pct": 12, "action_type": "change_scene", "linked_location": "kitchen"}
                ]},
                {"id": "bedroom_window", "name": "Bedroom Window", "subtitle": "Looking outside", "type": "window", "image": "asset:realms/bedroom_window_day.png", "unlocked": True, "hotspots": [
                    {"id": "back_to_bedroom", "label": "Back", "icon": "←", "x_pct": 10, "y_pct": 10, "width_pct": 16, "height_pct": 10, "action_type": "change_scene", "linked_location": "bedroom"}
                ]},
                {"id": "kitchen", "name": "Kitchen", "subtitle": "Home kitchen", "type": "home", "image": "asset:realms/kitchen_day.png", "unlocked": True, "hotspots": [
                    {"id": "back_to_bedroom", "label": "Bedroom", "icon": "←", "x_pct": 12, "y_pct": 12, "width_pct": 16, "height_pct": 10, "action_type": "change_scene", "linked_location": "bedroom"},
                    {"id": "mom", "label": "Mom", "icon": "♡", "x_pct": 54, "y_pct": 50, "width_pct": 18, "height_pct": 16, "action_type": "open_dialogue"}
                ]},
                {"id": "grocery_store", "name": "Grocery Store", "subtitle": "", "type": "store", "image": "", "unlocked": False},
                {"id": "hotel", "name": "Hotel", "subtitle": "", "type": "rest", "image": "", "unlocked": False},
                {"id": "coffee_shop", "name": "Coffee Shop", "subtitle": "", "type": "social", "image": "", "unlocked": False},
            ],
        },
        {
            "id": "fantasy",
            "label": "Fantasy Realm",
            "short_label": "Fantasy",
            "accent": "#A855F7",
            "locations": [
                {"id": "whisperwood_forest", "name": "Whisperwood Forest", "subtitle": "", "type": "forest", "image": "asset:realms/whisperwood_beacon_clean.png", "unlocked": True, "current_default": True, "hotspots": ["Resonance Beacon", "Forest Path", "Traveler Camp"]},
                {"id": "town_square", "name": "Town Square", "subtitle": "", "type": "town", "image": "", "unlocked": True},
                {"id": "rusty_tavern", "name": "The Rusty Tavern", "subtitle": "", "type": "tavern", "image": "", "unlocked": True},
                {"id": "blacksmith", "name": "Blacksmith", "subtitle": "", "type": "shop", "image": "", "unlocked": True},
                {"id": "adventure_gate", "name": "Adventure Gate", "subtitle": "", "type": "adventure", "image": "", "unlocked": True},
            ],
        },
    ]
}

REALM_DATA_FILE = ROOT_DIR / "data" / "realms" / "locations.json"


def normalize_realm_data(data: Any) -> dict:
    """Repair old admin saves and keep realm data in the backend shape.

    Older admin builds accidentally saved realm_locations as a flat list, or even
    as [[realms...]]. The game expects {"realms": [{... locations: [...] }]}.
    This normalizer accepts all of those shapes and returns the canonical one.
    """
    if isinstance(data, dict) and isinstance(data.get("realms"), list):
        realms = data.get("realms") or []
    elif isinstance(data, list) and len(data) == 1 and isinstance(data[0], list) and all(isinstance(x, dict) and "locations" in x for x in data[0]):
        realms = data[0]
    elif isinstance(data, list) and all(isinstance(x, dict) and "locations" in x for x in data):
        realms = data
    elif isinstance(data, list):
        # Treat a flat admin location list as locations and group by realm_id.
        real_locations = []
        fantasy_locations = []
        for loc in data:
            if not isinstance(loc, dict):
                continue
            clean = dict(loc)
            realm_id = clean.pop("realm_id", clean.pop("realm", None)) or ("fantasy" if str(clean.get("id", "")).startswith("whisper") else "real")
            if realm_id == "fantasy":
                fantasy_locations.append(clean)
            else:
                real_locations.append(clean)
        realms = [
            {"id": "real", "label": "Real World", "short_label": "Real", "accent": "#38BDF8", "locations": real_locations},
            {"id": "fantasy", "label": "Fantasy Realm", "short_label": "Fantasy", "accent": "#A855F7", "locations": fantasy_locations},
        ]
    else:
        realms = DEFAULT_REALM_DATA["realms"]

    # Merge in required default locations without overwriting admin hotspot edits.
    out_realms = []
    defaults_by_id = {r.get("id"): r for r in DEFAULT_REALM_DATA["realms"]}
    for realm in realms:
        if not isinstance(realm, dict):
            continue
        rid = realm.get("id") or "real"
        default_realm = defaults_by_id.get(rid, {})
        merged = {**default_realm, **realm}
        locs = [l for l in (realm.get("locations") or []) if isinstance(l, dict)]
        by_id = {l.get("id") or l.get("location_id") or l.get("name"): l for l in locs}
        for dloc in default_realm.get("locations", []):
            did = dloc.get("id")
            if did not in by_id:
                locs.append(dloc)
            else:
                existing = by_id[did]
                for k, v in dloc.items():
                    existing.setdefault(k, v)
        merged["locations"] = locs
        out_realms.append(merged)
    if not any(r.get("id") == "real" for r in out_realms):
        out_realms.append(defaults_by_id["real"])
    if not any(r.get("id") == "fantasy" for r in out_realms):
        out_realms.append(defaults_by_id["fantasy"])
    return {"realms": out_realms}


def read_realm_data() -> dict:
    REALM_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not REALM_DATA_FILE.exists():
        REALM_DATA_FILE.write_text(json_dumps_pretty(DEFAULT_REALM_DATA))
    import json
    try:
        raw = json.loads(REALM_DATA_FILE.read_text())
    except Exception:
        raw = DEFAULT_REALM_DATA
    data = normalize_realm_data(raw)
    # Persist repairs so bad old shapes do not keep breaking admin/game.
    if data != raw:
        REALM_DATA_FILE.write_text(json_dumps_pretty(data))
    return data


def find_realm(data: dict, realm_id: str) -> Optional[dict]:
    return next((r for r in data.get("realms", []) if r.get("id") == realm_id), None)


def default_location_for(realm: dict) -> dict:
    locations = realm.get("locations", []) or []
    return next((l for l in locations if l.get("current_default")), locations[0] if locations else {"id": "unknown", "name": "Unknown", "unlocked": True})


def find_location(realm: dict, loc_id: str) -> Optional[dict]:
    return next((l for l in realm.get("locations", []) if l.get("id") == loc_id), None)




STORY_DIALOGUES_FILE = ROOT_DIR / "data" / "story" / "dialogues.json"


def read_story_dialogues_for_game() -> list:
    """Read Story Builder scenes for the runtime game UI.

    The admin has evolved over time, so this accepts all known shapes:
    - a plain list of scenes
    - {"data": [...]} wrappers
    - dictionaries keyed by id
    """
    import json
    if not STORY_DIALOGUES_FILE.exists():
        return []
    try:
        raw = json.loads(STORY_DIALOGUES_FILE.read_text())
    except Exception:
        return []
    if isinstance(raw, dict) and isinstance(raw.get("data"), list):
        raw = raw.get("data")
    elif isinstance(raw, dict):
        raw = list(raw.values())
    if not isinstance(raw, list):
        return []
    scenes = []
    for idx, scene in enumerate(raw):
        if isinstance(scene, dict) and not scene.get("archived") and scene.get("enabled", True) is not False:
            normalized = dict(scene)
            normalized.setdefault("id", f"story_scene_{idx}")
            normalized.setdefault("title", normalized.get("name") or normalized.get("id"))
            normalized.setdefault("trigger_type", normalized.get("trigger") or "tap_npc")
            normalized.setdefault("priority", 100)
            normalized.setdefault("lines", normalized.get("dialogue_lines") or [])
            normalized.setdefault("choices", [])
            normalized.setdefault("effects", [])
            normalized.setdefault("conditions", [])
            scenes.append(normalized)
    return scenes




STORY_CHARACTERS_FILE = ROOT_DIR / "data" / "story" / "characters.json"


def read_story_characters_for_game() -> list:
    """Read Character Builder data for runtime dialogue name/avatar resolution."""
    import json
    if not STORY_CHARACTERS_FILE.exists():
        return []
    try:
        raw = json.loads(STORY_CHARACTERS_FILE.read_text())
    except Exception:
        return []
    if isinstance(raw, dict) and isinstance(raw.get("data"), list):
        raw = raw.get("data")
    elif isinstance(raw, dict):
        raw = list(raw.values())
    if not isinstance(raw, list):
        return []
    out = []
    for idx, char in enumerate(raw):
        if isinstance(char, dict) and not char.get("archived"):
            c = dict(char)
            c.setdefault("id", c.get("name") or f"character_{idx}")
            c.setdefault("name", c.get("id"))
            out.append(c)
    return out

def story_value_matches(actual: Any, expected: Any) -> bool:
    if isinstance(expected, str):
        lowered = expected.lower().strip()
        if lowered == "true":
            expected = True
        elif lowered == "false":
            expected = False
    return actual == expected


def story_conditions_met(scene: dict, user: dict) -> bool:
    """Small first pass for story gating.

    Supports simple flag conditions now. Missing flags are treated as False.
    Full persistent story-state/player-flag support can expand this later.
    """
    conditions = scene.get("conditions") or []
    if not isinstance(conditions, list):
        return True
    flags = user.get("story_flags") or user.get("flags") or {}
    if not isinstance(flags, dict):
        flags = {}
    for cond in conditions:
        if not isinstance(cond, dict):
            continue
        flag = cond.get("flag") or cond.get("id") or cond.get("key")
        if not flag:
            continue
        op = cond.get("operator") or "equals"
        expected = cond.get("value", True)
        actual = flags.get(flag, False)
        if op == "equals" and not story_value_matches(actual, expected):
            return False
        if op == "not_equals" and story_value_matches(actual, expected):
            return False
    return True


def scene_attached_to_location(scene: dict, location_id: str) -> bool:
    if not location_id:
        return False
    candidates = [
        scene.get("location_id"),
        scene.get("location"),
        scene.get("linked_location"),
        scene.get("background_id"),
        scene.get("scene_location_id"),
    ]
    return any(str(c or "") == str(location_id) for c in candidates)


def story_scenes_for_location(location_id: str, user: dict) -> list:
    scenes = [s for s in read_story_dialogues_for_game() if scene_attached_to_location(s, location_id) and story_conditions_met(s, user)]
    return sorted(scenes, key=lambda s: int(s.get("priority") or 100), reverse=True)

def build_realm_payload(user: dict) -> dict:
    data = read_realm_data()
    realms = data.get("realms", [])
    current_realm_id = user.get("current_realm") or "real"
    realm = find_realm(data, current_realm_id) or (realms[0] if realms else {"id": "real", "label": "Real World", "locations": []})
    current_location_id = user.get("current_location_id") or default_location_for(realm).get("id")
    location = find_location(realm, current_location_id) or default_location_for(realm)
    location_story_scenes = story_scenes_for_location(location.get("id"), user)
    all_story_scenes = [s for s in read_story_dialogues_for_game() if story_conditions_met(s, user)]
    story_characters = read_story_characters_for_game()
    return {
        "current_realm": realm.get("id"),
        "current_location_id": location.get("id"),
        "realm": realm,
        "location": location,
        "realms": realms,
        # These fields are the runtime bridge from Admin Story Builder -> Game.
        # active_story_scenes are attached to the current location/background.
        # story_scenes lets hotspots open linked Story Builder scenes by id.
        "active_story_scenes": location_story_scenes,
        "story_scenes": all_story_scenes,
        "story_characters": story_characters,
    }


@api.get("/realm")
async def get_realm(user=Depends(get_current_user)):
    payload = build_realm_payload(user)
    # Persist safe defaults so the UI and future quests always have a source of truth.
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"current_realm": payload["current_realm"], "current_location_id": payload["current_location_id"]}},
    )
    return payload


@api.post("/realm/traverse")
async def traverse_realm(body: RealmTraverseIn, user=Depends(get_current_user)):
    data = read_realm_data()
    realm = find_realm(data, body.realm)
    if not realm:
        raise HTTPException(404, "Realm not found")
    loc = find_location(realm, body.location_id)
    if not loc:
        raise HTTPException(404, "Location not found")
    if loc.get("unlocked") is False:
        raise HTTPException(400, "This location is locked")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"current_realm": realm.get("id"), "current_location_id": loc.get("id")}},
    )
    user["current_realm"] = realm.get("id")
    user["current_location_id"] = loc.get("id")
    return build_realm_payload(user)


@api.post("/realm/rest")
async def realm_rest(user=Depends(get_current_user)):
    # Testing foundation: resting in the real-world bedroom restores HP and Mana only.
    # Future versions can add cooldowns, time passage, buffs, or story gates.
    updates = {"hp": int(user.get("max_hp", user.get("hp", 1))), "mana": int(user.get("max_mana", user.get("mana", 1)))}
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    user.update(updates)
    user.update(stamina_display_payload(user))
    user.update(sigil_display_payload(user))
    user["premium_currency_key"] = PREMIUM_CURRENCY_KEY
    user["premium_currency_name"] = PREMIUM_CURRENCY_NAME
    user[PREMIUM_CURRENCY_KEY] = int(user.get(PREMIUM_CURRENCY_KEY, 0) or 0)
    user.pop("password", None)
    user.pop("_id", None)
    return user


@api.get("/daily-goals")
async def daily_goals(user=Depends(get_current_user)):
    user = await ensure_daily_on_user(user)
    user = await auto_claim_completed_daily_goals(user)
    return build_daily_payload(user)

@api.get("/adventure/map")
async def adventure_map(user=Depends(get_current_user)):
    return build_adventure_map(user)

@api.post("/adventure/start/{node_no}")
async def adventure_start(node_no: int, user=Depends(get_current_user)):
    prog = get_adventure_progress(user)
    tier = prog["tier"]
    current_node = min(10, int(prog.get("highest_node", 0) or 0) + 1)
    if node_no < 1 or node_no > 10:
        raise HTTPException(400, "Invalid adventure node")
    if node_no in set(prog.get("completed", [])):
        raise HTTPException(400, "This node has already been cleared. Push forward to the highlighted node.")
    if node_no != current_node:
        raise HTTPException(400, f"Node {node_no} is locked. Continue at the highlighted node {current_node}.")
    if int(user.get("stamina", 0) or 0) < 1:
        raise HTTPException(400, "Not enough Battle Stamina (1 required)")
    now = now_utc()
    new_stamina = max(0, int(user.get("stamina", 0) or 0) - 1)
    await db.users.update_one({"id": user["id"]}, {"$set": {"stamina": new_stamina, "stamina_updated_at": now}})
    enemy = gen_adventure_enemy(tier, node_no)
    await db.battle_previews.update_one(
        battle_state_query(user["id"], BATTLE_MODE_ADVENTURE),
        {"$set": {"user_id": user["id"], "enemy": enemy, "turn": "player", "created_at": now, "battle_mode": BATTLE_MODE_ADVENTURE, "adventure_tier": tier, "adventure_node": node_no}},
        upsert=True,
    )
    await set_active_battle_mode(user["id"], BATTLE_MODE_ADVENTURE)
    user["active_battle_mode"] = BATTLE_MODE_ADVENTURE
    totals, equipped = await compute_totals(user["id"])
    class_state = equipped_affinity(equipped, user.get("class_affinity"))
    main = main_weapon_from(equipped)
    skills = build_player_skills(class_state, equipped)
    payload = {
        "ok": True, "enemy": enemy, "mode": BATTLE_MODE_ADVENTURE, "difficulty_tier": user.get("difficulty_tier", 1),
        "tier": tier, "adventure_tier": tier, "node": node_no, "adventure_node": node_no,
        "class_state": class_state, "main_weapon": main, "totals": totals, "skills": skills, "turn": "player", "battle_active": True,
        "change_enemy_seconds": 0, "change_enemy_ready": False,
    }
    payload.update(stamina_display_payload(user))
    payload.update(sigil_display_payload(user))
    return payload


# ---------------- Character / stats ----------------

def base_stats() -> dict:
    return {"atk": 1, "int_stat": 1, "def_stat": 1, "res": 1, "dex": 2, "mob": 2,
            "crit": 1, "luk": 1, "hp_bonus": 0, "mana_bonus": 0}


async def compute_totals(user_id: str) -> Tuple[dict, list]:
    equipped = await db.items.find(
        {"owner_id": user_id, "equipped": True}, {"_id": 0}
    ).to_list(20)
    t = base_stats()
    for it in equipped:
        t["atk"] += it.get("atk", 0)
        t["int_stat"] += it.get("int_stat", 0)
        t["def_stat"] += it.get("def_stat", 0)
        t["res"] += it.get("res", 0)
        t["dex"] += it.get("dex", 0)
        t["mob"] += it.get("mob", 0)
        t["crit"] += it.get("crit", 0)
        t["luk"] += it.get("luk", 0)
        if it["slot"] not in ("consumable", "upgrade"):
            t["hp_bonus"] += it.get("hp", 0)
            t["mana_bonus"] += it.get("mana", 0)
    # Talent bonuses are character-growth bonuses and should stack with gear.
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user:
        for key, val in talent_effect_totals(user.get("talents") or {}).items():
            if key in t:
                t[key] += val
    # Initiative should matter but never explode. Clamp the final live value.
    t["mob"] = max(0, min(10, t.get("mob", 0)))
    return t, equipped


@api.get("/character")
async def get_character(user=Depends(get_current_user)):
    totals, equipped = await compute_totals(user["id"])
    class_state = equipped_affinity(equipped, user.get("class_affinity"))
    talent_state = build_talent_state(user, class_state)
    user.update(stamina_display_payload(user))
    user.update(sigil_display_payload(user))
    # Display effective vitals after equipment/talent bonuses. Base max_hp/max_mana stay stored
    # on the user, while this payload shows the actual current character sheet values.
    display_user = dict(user)
    display_user["max_hp"] = int(user.get("max_hp", 100)) + int(totals.get("hp_bonus", 0) or 0)
    display_user["max_mana"] = int(user.get("max_mana", 50)) + int(totals.get("mana_bonus", 0) or 0)
    display_user["hp"] = min(int(display_user.get("hp", display_user["max_hp"])), display_user["max_hp"])
    display_user["mana"] = min(int(display_user.get("mana", display_user["max_mana"])), display_user["max_mana"])
    display_user["premium_currency_key"] = PREMIUM_CURRENCY_KEY
    display_user["premium_currency_name"] = PREMIUM_CURRENCY_NAME
    display_user[PREMIUM_CURRENCY_KEY] = int(user.get(PREMIUM_CURRENCY_KEY, 0) or 0)
    return {
        "user": display_user,
        "equipped": equipped,
        "totals": totals,
        "class_state": class_state,
        "talent_state": talent_state,
        "xp_to_next": xp_to_next(user["level"]),
    }


async def grant_xp(user_id: str, amount: int):
    user = await db.users.find_one({"id": user_id})
    if not user:
        return
    xp = user["xp"] + amount
    level = user["level"]
    leveled = False
    while xp >= xp_to_next(level):
        xp -= xp_to_next(level)
        level += 1
        leveled = True
    updates: dict = {"xp": xp, "level": level}
    if leveled:
        updates["max_hp"] = 100 + (level - 1) * 25
        updates["max_mana"] = 50 + (level - 1) * 12
        updates["hp"] = updates["max_hp"]
        updates["mana"] = updates["max_mana"]
        updates["stamina_max"] = stamina_max(level)
        updates["stamina"] = stamina_max(level)
    await db.users.update_one({"id": user_id}, {"$set": updates})


def normalize_product_hint(text: str) -> dict:
    """Convert product/category text into Barcodia family/element traits."""
    return hint_to_family_overrides(text or "")


async def lookup_product_hint(barcode: str) -> dict:
    """Return cached or free product metadata for barcode classification.

    V1B uses Open Food Facts first because it is free and useful for food/drink.
    Unknown or non-food products fall back to deterministic barcode traits.
    """
    cached = await db.product_cache.find_one({"barcode": barcode}, {"_id": 0})
    if cached:
        return cached

    doc = {
        "barcode": barcode,
        "source": "fallback",
        "product_name": "",
        "brand": "",
        "category_text": "",
        "hint": "",
        "traits": {},
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }

    try:
        url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
        params = {"fields": "product_name,brands,categories,categories_tags,quantity"}
        async with httpx.AsyncClient(timeout=6.0) as cli:
            resp = await cli.get(url, params=params)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == 1 and isinstance(data.get("product"), dict):
                product = data["product"]
                name = str(product.get("product_name") or "").strip()
                brand = str(product.get("brands") or "").strip()
                cats = " ".join([
                    str(product.get("categories") or ""),
                    " ".join(product.get("categories_tags") or []),
                    str(product.get("quantity") or ""),
                ]).strip()
                hint = " ".join(x for x in [name, brand, cats] if x).strip()
                doc.update({
                    "source": "open_food_facts",
                    "product_name": name,
                    "brand": brand,
                    "category_text": cats,
                    "hint": hint,
                    "traits": normalize_product_hint(hint),
                    "updated_at": now_utc(),
                })
    except Exception as e:
        logger.info(f"Product lookup fallback for {barcode}: {e}")

    await db.product_cache.update_one({"barcode": barcode}, {"$set": doc}, upsert=True)
    return doc


def is_recent_duplicate(prior_scan: Optional[dict]) -> bool:
    if not prior_scan:
        return False
    updated = _coerce_utc(prior_scan.get("updated_at") or prior_scan.get("created_at"))
    return (now_utc() - updated) < timedelta(hours=DUPLICATE_ECHO_WINDOW_HOURS)


# ---------------- Scan ----------------

@api.post("/scan")
async def scan(body: ScanIn, user=Depends(get_current_user)):
    bc = body.barcode.strip()
    if not bc or len(bc) < 4:
        raise HTTPException(400, "Invalid barcode")

    charge = int(user.get("sigil_charge", SIGIL_CHARGE_MAX) or 0)
    if charge < SIGIL_CHARGE_COST:
        raise HTTPException(400, f"The scanner needs {SIGIL_CHARGE_COST} Sigil Charge to transmute again.")

    inv_count = await db.items.count_documents({"owner_id": user["id"], "listed": False})
    if inv_count >= INVENTORY_MAX:
        raise HTTPException(400, f"Inventory full ({INVENTORY_MAX}/{INVENTORY_MAX}). Destroy or list an item before scanning.")

    prior = await db.user_scans.find_one({"user_id": user["id"], "barcode": bc})
    scan_count = int(prior.get("count", 0)) if prior else 0
    recent_duplicate = is_recent_duplicate(prior)

    product = await lookup_product_hint(bc)
    product_hint = body.hint or product.get("hint") or ""

    traits = derive_traits(bc)
    traits.update(product.get("traits") or {})
    traits.update(hint_to_family_overrides(product_hint))

    # Add scan-count salt so repeat scans can produce related but not identical transmutations.
    rng = _seed_rand(bc, f"item-{scan_count + 1}")

    if recent_duplicate and rng.random() < 0.45:
        # Same-day repeats are useful but less explosive: mostly upgrade materials / echo shards.
        slot = "upgrade"
        rarity = "common" if rng.random() < 0.82 else "rare"
    elif is_upgrade_material(bc) and rng.random() < 0.35:
        slot = "upgrade"
        rarity = roll_rarity(rng, user["level"], traits["uncommonness"] * 0.75)
    else:
        slot = family_to_slot(traits, rng)
        rarity = roll_rarity(rng, user["level"], traits["uncommonness"])

    rarity_bias = {"common": 0.55, "rare": 0.72, "epic": 0.88, "legendary": 1.0}[rarity]
    level = max(1, min(user["level"], int(round(user["level"] * rarity_bias * rng.uniform(0.7, 1.0)))))
    two_h = two_handed_for(slot, traits["shape"], rng)
    stats = gen_stats_for(slot, level, rarity, traits["element"], traits, rng, two_h)
    fb = fallback_name(slot, traits["shape"], rarity, traits["element"], rng, traits.get("family"))
    if recent_duplicate and slot == "upgrade":
        fb = rng.choice(["Weapon Shard", "Armor Shard", "Echo Shard", "Runestone Fragment"])

    flavor = await ai_flavor(slot, rarity, level, traits["element"], traits, fb, product_hint)

    item = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "barcode": bc,
        "name": flavor["name"],
        "lore": flavor["lore"],
        "slot": slot,
        "rarity": rarity,
        "level": level,
        "element": traits["element"],
        "material": traits["material"],
        "shape": traits["shape"],
        "weight": traits["weight"],
        "family": traits["family"],
        "two_handed": two_h,
        "equipped": False,
        "listed": False,
        "scan_count": scan_count + 1,
        "recent_duplicate": recent_duplicate,
        "product_source": product.get("source", "fallback"),
        "class_tags": [],
        "effective_vs": [],
        "upgrade_xp": 0,
        "upgrade_xp_to_next": upgrade_xp_to_next(level),
        "created_at": now_utc(),
        **stats,
    }
    item["class_tags"] = infer_item_class_tags(item)
    item["effective_vs"] = item_effective_vs(item)
    item["icon"] = item_icon_for(item)
    await db.items.insert_one(dict(item))
    item.pop("_id", None)

    now = now_utc()
    await db.user_scans.update_one(
        {"user_id": user["id"], "barcode": bc},
        {"$setOnInsert": {"user_id": user["id"], "barcode": bc, "created_at": now},
         "$set": {"updated_at": now}, "$inc": {"count": 1}},
        upsert=True,
    )

    # Spend Sigil Charge only after the item and scan record are saved.
    new_charge = max(0, charge - SIGIL_CHARGE_COST)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"sigil_charge": new_charge, "sigil_charge_updated_at": now}},
    )

    xp_gain = 5 if not recent_duplicate else 2
    if scan_count == 0:
        xp_gain += 3  # first discovery bonus
    await grant_xp(user["id"], xp_gain)
    await credit_daily_goal(user["id"], "scans", 1)

    item["sigil_charge"] = new_charge
    item["sigil_charge_max"] = int(user.get("sigil_charge_max", SIGIL_CHARGE_MAX) or SIGIL_CHARGE_MAX)
    item["discovery_bonus"] = scan_count == 0
    item["message"] = (
        "First discovery bonus!" if scan_count == 0 else
        "Echo transmutation: duplicate scans are converted more safely within the daily echo window." if recent_duplicate else
        "The sigil has recharged since your last scan of this barcode."
    )
    return item


@api.get("/inventory")
async def get_inventory(user=Depends(get_current_user)):
    items = await db.items.find(
        {"owner_id": user["id"], "listed": False}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return items


# ---------------- Equip / use / destroy / upgrade ----------------

def normalize_equip_target(item: dict, requested_slot: Optional[str]) -> Optional[str]:
    """Return the slot to put this item in. Some items can go in either left or right."""
    s = item["slot"]
    if s in ("ring",):
        # rings only have one slot (just "ring")
        return "ring"
    if s in ("leg_l", "leg_r"):
        if requested_slot in ("leg_l", "leg_r"):
            return requested_slot
        return s
    if s in ("arm_l", "arm_r"):
        if requested_slot in ("arm_l", "arm_r"):
            return requested_slot
        return s
    if s in ("main_hand", "off_hand"):
        # off_hand item can also go to main_hand if requested (e.g., dual-wield dagger)
        if requested_slot in ("main_hand", "off_hand"):
            return requested_slot
        return s
    return s


@api.post("/items/{item_id}/equip")
async def equip_item(item_id: str, body: EquipIn = None, user=Depends(get_current_user)):
    item = await db.items.find_one({"id": item_id, "owner_id": user["id"]})
    if not item:
        raise HTTPException(404, "Item not found")
    if item["slot"] in ("consumable", "upgrade"):
        raise HTTPException(400, "This item cannot be equipped")
    if item.get("listed"):
        raise HTTPException(400, "Item is listed on market")

    target_slot = normalize_equip_target(item, body.slot if body else None)
    # Two-handed handling
    if item.get("two_handed") and target_slot == "main_hand":
        await db.items.update_many(
            {"owner_id": user["id"], "equip_slot": {"$in": ["main_hand", "off_hand"]}, "equipped": True},
            {"$set": {"equipped": False}},
        )
    else:
        # If equipping into main/off and existing main_hand is 2H, unequip it
        if target_slot in ("main_hand", "off_hand"):
            existing_main = await db.items.find_one({"owner_id": user["id"], "equip_slot": "main_hand", "equipped": True})
            if existing_main and existing_main.get("two_handed"):
                await db.items.update_one({"id": existing_main["id"]}, {"$set": {"equipped": False}})
        # Unequip current occupant of target_slot
        await db.items.update_many(
            {"owner_id": user["id"], "equip_slot": target_slot, "equipped": True},
            {"$set": {"equipped": False}},
        )

    await db.items.update_one(
        {"id": item_id},
        {"$set": {"equipped": True, "equip_slot": target_slot}},
    )
    await grant_xp(user["id"], 2)
    return {"ok": True, "equip_slot": target_slot}


@api.post("/items/{item_id}/unequip")
async def unequip_item(item_id: str, user=Depends(get_current_user)):
    res = await db.items.update_one(
        {"id": item_id, "owner_id": user["id"]}, {"$set": {"equipped": False}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Item not found")
    return {"ok": True}


@api.post("/items/{item_id}/use")
async def use_item(item_id: str, user=Depends(get_current_user)):
    item = await db.items.find_one({"id": item_id, "owner_id": user["id"]})
    if not item:
        raise HTTPException(404, "Item not found")
    if item["slot"] != "consumable":
        raise HTTPException(400, "Not a consumable")

    new_hp = min(user["max_hp"], user["hp"] + item.get("hp", 0))
    new_mana = min(user["max_mana"], user["mana"] + item.get("mana", 0))
    stamina_gain = int(item.get("stamina_restore", 0) or 0)
    new_stamina = min(stamina_max(user["level"]), user.get("stamina", stamina_max(user["level"])) + stamina_gain)

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"hp": new_hp, "mana": new_mana, "stamina": new_stamina, "stamina_updated_at": now_utc()}},
    )
    await db.items.delete_one({"id": item_id})
    await credit_daily_goal(user["id"], "use_item", 1)
    return {"ok": True, "hp": new_hp, "mana": new_mana, "stamina": new_stamina}


@api.post("/items/{item_id}/destroy")
async def destroy_item(item_id: str, user=Depends(get_current_user)):
    item = await db.items.find_one({"id": item_id, "owner_id": user["id"]})
    if not item:
        raise HTTPException(404, "Item not found")
    refund = max(1, item["level"] * 2)
    await db.users.update_one({"id": user["id"]}, {"$inc": {"gold": refund}})
    await db.items.delete_one({"id": item_id})
    await credit_daily_goal(user["id"], "destroy", 1)
    return {"ok": True, "refund": refund}


@api.post("/items/upgrade")
async def upgrade_item(body: UpgradeIn, user=Depends(get_current_user)):
    target = await db.items.find_one({"id": body.target_item_id, "owner_id": user["id"]})
    shard = await db.items.find_one({"id": body.scroll_item_id, "owner_id": user["id"]})
    if not target or not shard:
        raise HTTPException(404, "Items not found")
    if shard["slot"] != "upgrade":
        raise HTTPException(400, "Shard item must be an upgrade material")
    if target["slot"] in ("consumable", "upgrade"):
        raise HTTPException(400, "Cannot upgrade this item")

    level = int(target.get("level", 1))
    cur_xp = int(target.get("upgrade_xp", 0) or 0)
    gained = int(shard.get("upgrade_xp_value", 0) or shard.get("atk", 0) or 10)
    cur_xp += max(1, gained)
    leveled = False
    stat_updates = {}

    # User level is a soft cap: gear cannot leap beyond character level + 2 in early testing.
    cap = max(user["level"] + 2, 3)
    while level < cap and cur_xp >= upgrade_xp_to_next(level):
        cur_xp -= upgrade_xp_to_next(level)
        level += 1
        leveled = True
        # RPG identity: improve what the item already is good at.
        for k in ("atk", "int_stat", "def_stat", "res", "dex", "crit", "luk", "hp", "mana"):
            v = int(target.get(k, 0) or stat_updates.get(k, 0) or 0)
            if v:
                stat_updates[k] = stat_updates.get(k, v) + 1
        if target.get("mob", 0) and level % 3 == 0:
            stat_updates["mob"] = min(10, int(target.get("mob", 0)) + 1)

    updates: dict = {
        "level": level,
        "upgrade_xp": cur_xp,
        "upgrade_xp_to_next": upgrade_xp_to_next(level),
    }
    updates.update(stat_updates)
    await db.items.update_one({"id": target["id"]}, {"$set": updates})
    await db.items.delete_one({"id": shard["id"]})
    await grant_xp(user["id"], 6 + (12 if leveled else 0))
    upgraded = await db.items.find_one({"id": target["id"]}, {"_id": 0})
    return {"ok": True, "item": upgraded, "xp_added": gained, "leveled": leveled}



# ---------------- NPC Store ----------------

STORE_DATA_FILE = ROOT_DIR / "data" / "store" / "gold_store.json"


def public_asset_url(asset_key: Optional[str]) -> Optional[str]:
    if not asset_key:
        return None
    if asset_key.startswith("http://") or asset_key.startswith("https://"):
        return asset_key
    if asset_key.startswith("asset:"):
        rel = asset_key.replace("asset:", "", 1).lstrip("/")
        return f"/assets/{rel}"
    return None


def normalize_store_item(raw: dict) -> dict:
    item = dict(raw or {})
    item.setdefault("id", item.get("store_id") or str(uuid.uuid4()))
    item.setdefault("name", "Unnamed Store Item")
    item.setdefault("item_type", item.get("slot") or "consumable")
    item.setdefault("slot", item.get("slot") or ("main_hand" if item.get("item_type") == "weapon" else item.get("item_type", "consumable")))
    item.setdefault("rarity", "common")
    item.setdefault("level", 1)
    item.setdefault("gold_cost", int(item.get("gold_cost") or item.get("price_gold") or item.get("price") or item.get("gold") or 100))
    item.setdefault("description", item.get("lore") or "A store item prepared by the Barcodia admin.")
    item.setdefault("icon", item.get("icon") or "🧪")
    item["image_url"] = public_asset_url(item.get("image") or item.get("portrait"))
    return item


def read_store_items() -> list:
    if not STORE_DATA_FILE.exists():
        STORE_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        STORE_DATA_FILE.write_text(json_dumps_pretty([]))
    import json
    data = json.loads(STORE_DATA_FILE.read_text() or "[]")
    if isinstance(data, dict):
        data = data.get("items", [])
    return [normalize_store_item(x) for x in data if isinstance(x, dict)]


def store_item_to_inventory_doc(store_item: dict, user_id: str) -> dict:
    slot = store_item.get("slot") or "consumable"
    item_type = store_item.get("item_type") or slot
    stats = store_item.get("stats") if isinstance(store_item.get("stats"), dict) else {}
    def stat(name, default=0):
        return int(store_item.get(name, stats.get(name, default)) or 0)
    return {
        "id": str(uuid.uuid4()),
        "owner_id": user_id,
        "barcode": f"store:{store_item.get('id')}",
        "name": store_item.get("name", "Store Item"),
        "lore": store_item.get("description") or store_item.get("lore") or "Purchased from the Store.",
        "slot": slot,
        "rarity": store_item.get("rarity", "common"),
        "level": int(store_item.get("level", 1) or 1),
        "element": store_item.get("element", "none"),
        "material": store_item.get("material", "metal"),
        "shape": store_item.get("shape", "long"),
        "weight": store_item.get("weight", "medium"),
        "family": store_item.get("family", item_type),
        "two_handed": bool(store_item.get("two_handed", False)),
        "atk": stat("atk"), "int_stat": stat("int_stat"), "def_stat": stat("def_stat"), "res": stat("res"),
        "dex": stat("dex"), "mob": stat("mob"), "crit": stat("crit"), "luk": stat("luk"),
        "hp": stat("hp"), "mana": stat("mana"), "stamina_restore": stat("stamina_restore"),
        "icon": store_item.get("icon") or item_icon_for(store_item),
        "image": store_item.get("image"),
        "class_tags": store_item.get("class_tags", []),
        "effective_vs": store_item.get("effective_vs", []),
        "equipped": False,
        "listed": False,
        "created_at": now_utc(),
        "source": "gold_store",
        "store_item_id": store_item.get("id"),
    }


@api.get("/store/gold")
async def get_gold_store(user=Depends(get_current_user)):
    items = [x for x in read_store_items() if x.get("enabled", True) and x.get("can_appear_in_store", True)]
    return {"items": items, "gold": int(user.get("gold", 0)), "inventory_max": INVENTORY_MAX}


@api.post("/store/gold/buy/{store_item_id}")
async def buy_gold_store_item(store_item_id: str, body: StoreBuyIn, user=Depends(get_current_user)):
    if body.quantity != 1:
        raise HTTPException(400, "Quantity purchases are not enabled yet")
    store_items = read_store_items()
    store_item = next((x for x in store_items if x.get("id") == store_item_id), None)
    if not store_item or not store_item.get("enabled", True):
        raise HTTPException(404, "Store item not found")
    cost = int(store_item.get("gold_cost", 0) or 0)
    if int(user.get("gold", 0)) < cost:
        raise HTTPException(400, "Not enough gold")
    inv_count = await db.items.count_documents({"owner_id": user["id"], "listed": {"$ne": True}})
    if inv_count >= INVENTORY_MAX:
        raise HTTPException(400, "Inventory full")
    item_doc = store_item_to_inventory_doc(store_item, user["id"])
    await db.users.update_one({"id": user["id"]}, {"$inc": {"gold": -cost}})
    await db.items.insert_one(dict(item_doc))
    item_doc.pop("_id", None)
    return {"ok": True, "item": item_doc, "gold_spent": cost, "gold": int(user.get("gold", 0)) - cost}


# ---------------- Trading House ----------------

@api.get("/market/price-band/{item_id}")
async def price_band(item_id: str, user=Depends(get_current_user)):
    item = await db.items.find_one({"id": item_id, "owner_id": user["id"]}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Item not found")
    lo, hi = calc_price_band(item)
    return {"min_price": lo, "max_price": hi}


@api.post("/market/list")
async def list_item(body: ListIn, user=Depends(get_current_user)):
    item = await db.items.find_one({"id": body.item_id, "owner_id": user["id"]})
    if not item:
        raise HTTPException(404, "Item not found")
    if item.get("listed"):
        raise HTTPException(400, "Already listed")
    if item.get("equipped"):
        raise HTTPException(400, "Unequip before listing")
    lo, hi = calc_price_band(item)
    if body.price < lo or body.price > hi:
        raise HTTPException(400, f"Price must be between {lo} and {hi} gold")
    item.pop("_id", None)
    listing = {
        "id": str(uuid.uuid4()),
        "item": item,
        "seller_id": user["id"],
        "seller_name": user["username"],
        "price": body.price,
        "min_price": lo,
        "max_price": hi,
        "created_at": now_utc(),
    }
    await db.listings.insert_one(dict(listing))
    await db.items.update_one({"id": body.item_id}, {"$set": {"listed": True}})
    listing.pop("_id", None)
    return listing


@api.get("/market/listings")
async def get_listings(user=Depends(get_current_user)):
    return await db.listings.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.post("/market/cancel/{listing_id}")
async def cancel_listing(listing_id: str, user=Depends(get_current_user)):
    listing = await db.listings.find_one({"id": listing_id})
    if not listing or listing["seller_id"] != user["id"]:
        raise HTTPException(404, "Listing not found")
    await db.items.update_one(
        {"id": listing["item"]["id"], "owner_id": user["id"]}, {"$set": {"listed": False}}
    )
    await db.listings.delete_one({"id": listing_id})
    return {"ok": True}


@api.post("/market/buy/{listing_id}")
async def buy_listing(listing_id: str, user=Depends(get_current_user)):
    listing = await db.listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(404, "Listing not found")
    if listing["seller_id"] == user["id"]:
        raise HTTPException(400, "Cannot buy your own listing")
    if user["gold"] < listing["price"]:
        raise HTTPException(400, "Not enough gold")
    await db.users.update_one({"id": user["id"]}, {"$inc": {"gold": -listing["price"]}})
    await db.users.update_one({"id": listing["seller_id"]}, {"$inc": {"gold": listing["price"]}})
    await db.items.update_one(
        {"id": listing["item"]["id"]},
        {"$set": {"owner_id": user["id"], "equipped": False, "listed": False}},
    )
    await db.listings.delete_one({"id": listing_id})
    return {"ok": True}


# ---------------- Battle ----------------

MONSTER_DATA_FILE = ROOT_DIR / "data" / "monsters.json"

SKILL_LIBRARY = {
    "throw_sand": {
        "id": "throw_sand", "name": "Throw Sand", "class_key": "neutral", "icon": "🌫️",
        "mp_cost": 0, "power": 1, "kind": "status", "scales_with": "none",
        "status": "blind", "status_chance": 10,
        "description": "A desperate handful of grit. Tiny damage with a small chance to blind for one enemy turn.",
    },
    "pole_jab": {
        "id": "pole_jab", "name": "Pole Jab", "class_key": "lancer", "icon": "🔱",
        "mp_cost": 3, "power": 7, "kind": "physical", "scales_with": "atk",
        "effective_vs": ["cavalry"],
        "description": "A basic spear thrust. Effective against Cavalry, but rusty outside Lancer training.",
    },
    "guard_break": {
        "id": "guard_break", "name": "Guard Break", "class_key": "infantry", "icon": "⚔️",
        "mp_cost": 4, "power": 7, "kind": "physical", "scales_with": "atk",
        "effective_vs": ["lancer"],
        "description": "A practical infantry strike that pressures Lancers.",
    },
    "quick_shot": {
        "id": "quick_shot", "name": "Quick Shot", "class_key": "archer", "icon": "🏹",
        "mp_cost": 4, "power": 6, "kind": "physical", "scales_with": "atk",
        "effective_vs": ["flier"],
        "description": "A fast ranged shot. Especially useful against Fliers.",
    },
    "shadow_cut": {
        "id": "shadow_cut", "name": "Shadow Cut", "class_key": "assassin", "icon": "🗡️",
        "mp_cost": 5, "power": 6, "kind": "physical", "scales_with": "atk",
        "description": "A quick cut with improved critical potential. Assassin training keeps it sharp.",
    },
    "mana_spark": {
        "id": "mana_spark", "name": "Mana Spark", "class_key": "mage", "icon": "✨",
        "mp_cost": 6, "power": 8, "kind": "spell", "scales_with": "int",
        "description": "A simple arcane bolt. Damage scales with INT and targets RES.",
    },
    "radiant_bolt": {
        "id": "radiant_bolt", "name": "Radiant Bolt", "class_key": "healer", "icon": "💚",
        "mp_cost": 5, "power": 6, "kind": "spell", "scales_with": "int",
        "effective_vs": ["demon"],
        "description": "A healer's offensive prayer. Light damage that keeps clothies from being helpless.",
    },
    "smite_light": {
        "id": "smite_light", "name": "Smite Light", "class_key": "holy", "icon": "☀️",
        "mp_cost": 6, "power": 8, "kind": "spell", "scales_with": "int",
        "effective_vs": ["demon"],
        "description": "A holy strike. Super-effective against Demon enemies.",
    },
    "umbral_bolt": {
        "id": "umbral_bolt", "name": "Umbral Bolt", "class_key": "demon", "icon": "☠️",
        "mp_cost": 6, "power": 8, "kind": "spell", "scales_with": "int",
        "effective_vs": ["holy"],
        "description": "A dark bolt. Super-effective against Holy enemies.",
    },
    "rider_charge": {
        "id": "rider_charge", "name": "Rider Charge", "class_key": "cavalry", "icon": "🐎",
        "mp_cost": 5, "power": 7, "kind": "physical", "scales_with": "atk",
        "effective_vs": ["infantry"],
        "description": "A mounted-style rush. Best when your build leans Cavalry.",
    },
    "wing_clip": {
        "id": "wing_clip", "name": "Wing Clip", "class_key": "flier", "icon": "🪽",
        "mp_cost": 5, "power": 6, "kind": "physical", "scales_with": "atk",
        "description": "A mobile strike from awkward angles. Flier training improves it.",
    },
    "tidal_slap": {
        "id": "tidal_slap", "name": "Tidal Slap", "class_key": "aquatic", "icon": "🌊",
        "mp_cost": 4, "power": 6, "kind": "spell", "scales_with": "int",
        "description": "A watery slap of force. Better with Aquatic affinity.",
    },
}

CLASS_STARTER_SKILL = {
    "infantry": "guard_break", "lancer": "pole_jab", "cavalry": "rider_charge", "archer": "quick_shot",
    "assassin": "shadow_cut", "flier": "wing_clip", "aquatic": "tidal_slap", "mage": "mana_spark",
    "healer": "radiant_bolt", "holy": "smite_light", "demon": "umbral_bolt",
}

def class_affinity_percent(class_state: dict, class_key: str) -> int:
    if class_key in ("neutral", "none", ""):
        return 100
    scores = class_state.get("scores") or {}
    top = max([int(v) for v in scores.values()] + [1])
    val = int(scores.get(class_key, 0) or 0)
    return max(0, min(100, round((val / top) * 100)))

def skill_modifier_for(class_state: dict, skill: dict) -> dict:
    class_key = skill.get("class_key", "neutral")
    pct = class_affinity_percent(class_state, class_key)
    if class_key == "neutral":
        return {"affinity_percent": 100, "damage_modifier": 1.0, "accuracy_modifier": 0, "affinity_status": "Neutral", "warning": False}
    primary = class_state.get("primary", {}).get("key")
    secondary = (class_state.get("secondary") or {}).get("key")
    if primary == class_key:
        return {"affinity_percent": pct, "damage_modifier": 1.0, "accuracy_modifier": 0, "affinity_status": "Trained", "warning": False}
    if secondary == class_key or pct >= 45:
        return {"affinity_percent": pct, "damage_modifier": 0.75, "accuracy_modifier": -5, "affinity_status": "Rusty", "warning": True}
    return {"affinity_percent": pct, "damage_modifier": 0.45, "accuracy_modifier": -10, "affinity_status": "Out of Class", "warning": True}

def build_player_skills(class_state: dict, equipped: list[dict]) -> list[dict]:
    skill_ids = ["throw_sand"]
    primary = class_state.get("primary", {}).get("key", "infantry")
    secondary = (class_state.get("secondary") or {}).get("key")
    if primary in CLASS_STARTER_SKILL:
        skill_ids.append(CLASS_STARTER_SKILL[primary])
    if secondary in CLASS_STARTER_SKILL:
        skill_ids.append(CLASS_STARTER_SKILL[secondary])
    # A tiny preview of the learn/retain future: if the player has any lancer-leaning gear, keep Pole Jab visible.
    if any("lancer" in (it.get("class_tags") or infer_item_class_tags(it)) for it in equipped):
        skill_ids.append("pole_jab")
    unique=[]
    for sid in skill_ids:
        if sid not in unique:
            unique.append(sid)
    out=[]
    for sid in unique[:5]:
        base = dict(SKILL_LIBRARY[sid])
        mod = skill_modifier_for(class_state, base)
        base.update(mod)
        base["class_chip"] = class_chip(base.get("class_key")) if base.get("class_key") in CLASS_META else {"key":"neutral","label":"Neutral","icon":"◇"}
        penalty = round((1 - mod["damage_modifier"]) * 100)
        base["penalty_text"] = f"-{penalty}% damage" if penalty else "Full power"
        base["status_text"] = base.get("affinity_status", "Trained")
        out.append(base)
    return out

def load_monsters() -> list[dict]:
    import json
    if MONSTER_DATA_FILE.exists():
        try:
            return json.loads(MONSTER_DATA_FILE.read_text())
        except Exception as e:
            logger.warning("Failed to load monsters.json: %s", e)
    return [
        {"id":"green_slimeling","name":"Green Slimeling","class_tags":["infantry"],"tier_min":1,"hp":14,"atk":2,"int_stat":1,"def_stat":0,"res":0,"dex":1,"mob":1,"crit":0,"xp":10,"gold":5,"portrait":"asset:enemy_slime"},
        {"id":"cave_bat","name":"Cave Bat","class_tags":["flier","assassin"],"tier_min":1,"hp":12,"atk":2,"int_stat":1,"def_stat":0,"res":0,"dex":3,"mob":5,"crit":1,"xp":12,"gold":6,"portrait":"asset:enemy_bat"},
    ]

def effectiveness_multiplier(attacker_tags: list[str], defender_tags: list[str]) -> Tuple[float, list[str]]:
    hits=[]
    mult=1.0
    for a in attacker_tags:
        for d in ADVANTAGE.get(a, []):
            if d in defender_tags:
                mult = max(mult, 1.5)
                hits.append(d)
    return mult, hits

def main_weapon_from(equipped: list[dict]) -> Optional[dict]:
    for it in equipped:
        if it.get("equip_slot") == "main_hand" or it.get("slot") == "main_hand":
            return it
    return None

def gen_enemy(tier: int, salt: str = "") -> dict:
    rng = random.Random(hash(f"{tier}-{salt}-{uuid.uuid4()}") & 0xffffffff)
    monsters = load_monsters()
    eligible = [m for m in monsters if int(m.get("tier_min",1)) <= tier] or monsters[:1]
    pool = eligible[-8:] if len(eligible) > 8 else eligible
    m = dict(rng.choice(pool))
    tags = list(m.get("class_tags") or ["infantry"])
    scale = max(0, tier - int(m.get("tier_min", 1)))
    hp = int(m.get("hp", 14)) + scale * 6 + rng.randint(0, 4)
    atk = int(m.get("atk", 2)) + scale // 2
    int_stat = int(m.get("int_stat", 1)) + scale // 2
    def_stat = int(m.get("def_stat", 0)) + scale // 3
    res = int(m.get("res", 0)) + scale // 3
    dex = int(m.get("dex", 1)) + scale // 3
    mob = min(10, int(m.get("mob", 1)) + scale // 4)
    crit = min(20, int(m.get("crit", 0)) + scale // 5)
    if "mage" in tags or "healer" in tags:
        hp = max(10, hp - 3); def_stat = max(0, def_stat - 1); int_stat += 1; res += 1
    is_elite = rng.random() < 0.08 and tier >= 5
    name = m.get("name", "Unknown Monster")
    if is_elite:
        name = "Elite " + name; hp = int(hp * 1.45); atk = int(atk * 1.2); int_stat = int(int_stat * 1.2)
    return {
        "id": str(uuid.uuid4()), "monster_id": m.get("id", name.lower().replace(" ","_")), "name": name,
        "archetype": tags[0], "class_tags": tags, "class_chips": class_chips(tags),
        "portrait": enemy_portrait_asset(m.get("id", ""), name, tags, "elite" if is_elite else "normal"),
        "tier": tier, "elite": is_elite, "hp": hp, "max_hp": hp, "atk": atk, "int_stat": int_stat,
        "def_stat": def_stat, "res": res, "dex": dex, "mob": mob, "crit": crit,
        "blind_turns": 0, "xp_reward": int(m.get("xp", 10)) + tier * 2, "gold_reward": int(m.get("gold", 5)) + tier,
    }

async def ensure_battle_state(user: dict, mode: str = BATTLE_MODE_QUICK) -> dict:
    mode = normalize_battle_mode(mode)
    preview = await db.battle_previews.find_one(battle_state_query(user["id"], mode))
    if preview and preview.get("enemy"):
        enemy = preview["enemy"]; enemy.pop("_id", None) if isinstance(enemy, dict) else None
        await set_active_battle_mode(user["id"], mode)
        user["active_battle_mode"] = mode
        return {"enemy": enemy, "turn": preview.get("turn", "player"), "started": True, "user": user, "preview": preview}

    if int(user.get("stamina", 0) or 0) < 1:
        raise HTTPException(400, "Not enough Battle Stamina (1 required)")

    # Entering combat costs stamina immediately. This prevents free reroll/flee/retry loops
    # and makes the resource behavior visible as soon as battle begins.
    new_stamina = max(0, int(user.get("stamina", 0) or 0) - 1)
    now = now_utc()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"stamina": new_stamina, "stamina_updated_at": now}},
    )
    user["stamina"] = new_stamina
    user["stamina_updated_at"] = now

    enemy = gen_enemy(user.get("difficulty_tier", 1), salt=user["id"] + str(now.timestamp()))
    await db.battle_previews.update_one(
        battle_state_query(user["id"], BATTLE_MODE_QUICK),
        {"$set": {"user_id": user["id"], "enemy": enemy, "turn": "player", "created_at": now, "battle_mode": BATTLE_MODE_QUICK},
         "$unset": {"adventure_tier": "", "adventure_node": ""}},
        upsert=True,
    )
    await set_active_battle_mode(user["id"], BATTLE_MODE_QUICK)
    user["active_battle_mode"] = BATTLE_MODE_QUICK
    return {"enemy": enemy, "turn": "player", "started": False, "user": user, "preview": {"battle_mode": BATTLE_MODE_QUICK}}


@api.get("/talents")
async def get_talents(user=Depends(get_current_user)):
    totals, equipped = await compute_totals(user["id"])
    class_state = equipped_affinity(equipped, user.get("class_affinity"))
    return build_talent_state(user, class_state)


@api.post("/talents/spend")
async def spend_talent(body: TalentSpendIn, user=Depends(get_current_user)):
    talent = TALENT_BY_ID.get(body.talent_id)
    if not talent:
        raise HTTPException(404, "Talent not found")
    talents = dict(user.get("talents") or {})
    rank = int(talents.get(body.talent_id, 0) or 0)
    if rank >= int(talent.get("max_rank", 1)):
        raise HTTPException(400, "Talent is already max rank")
    total = talent_points_total(user)
    spent = talent_points_spent(talents)
    cost = int(talent.get("cost", 1))
    if total - spent < cost:
        raise HTTPException(400, "Not enough talent points")
    talents[body.talent_id] = rank + 1
    await db.users.update_one({"id": user["id"]}, {"$set": {"talents": talents}})
    user["talents"] = talents
    totals, equipped = await compute_totals(user["id"])
    class_state = equipped_affinity(equipped, user.get("class_affinity"))
    return build_talent_state(user, class_state)


@api.post("/talents/reset")
async def reset_talents(body: TalentResetIn, user=Depends(get_current_user)):
    if not body.confirm:
        raise HTTPException(400, "Reset not confirmed")
    cost = 0 if TALENT_RESET_TEST_FREE else max(25, int(user.get("level", 1)) * 20)
    if cost and int(user.get("gold", 0)) < cost:
        raise HTTPException(400, "Not enough gold to reset talents")
    update = {"talents": {}}
    if cost:
        update["gold"] = int(user.get("gold", 0)) - cost
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    user["talents"] = {}
    if cost:
        user["gold"] = update["gold"]
    totals, equipped = await compute_totals(user["id"])
    class_state = equipped_affinity(equipped, user.get("class_affinity"))
    return build_talent_state(user, class_state)


@api.get("/battle/preview")
async def battle_preview(user=Depends(get_current_user)):
    # /battle/preview is Quick Hunt only. Adventure nodes are started through /adventure/start/{node}.
    # This separation prevents an Adventure enemy from replacing the player's saved Quick Hunt enemy.
    state = await ensure_battle_state(user, BATTLE_MODE_QUICK)
    user = state.get("user", user)
    enemy = state["enemy"]
    preview = await db.battle_previews.find_one(battle_state_query(user["id"], BATTLE_MODE_QUICK))
    change_seconds = seconds_until_change_enemy(preview)
    totals, equipped = await compute_totals(user["id"])
    class_state = equipped_affinity(equipped, user.get("class_affinity"))
    main = main_weapon_from(equipped)
    skills = build_player_skills(class_state, equipped)
    preview_mode = (preview or {}).get("battle_mode", "quick")
    payload = {
        "enemy": enemy,
        "difficulty_tier": user.get("difficulty_tier", 1), "class_state": class_state,
        "main_weapon": main, "totals": totals, "skills": skills, "turn": state.get("turn", "player"),
        "battle_active": True,
        "mode": preview_mode,
        "adventure_node": (preview or {}).get("adventure_node"),
        "adventure_tier": (preview or {}).get("adventure_tier"),
        "change_enemy_seconds": change_seconds,
        "change_enemy_ready": change_seconds <= 0,
    }
    payload.update(stamina_display_payload(user))
    payload.update(sigil_display_payload(user))
    return payload

@api.post("/battle/skip")
async def battle_skip(user=Depends(get_current_user)):
    preview = await db.battle_previews.find_one(battle_state_query(user["id"], BATTLE_MODE_QUICK))
    remaining = seconds_until_change_enemy(preview)
    if remaining > 0:
        raise HTTPException(400, f"Enemy can be changed again in {remaining} seconds")
    tier = user.get("difficulty_tier", 1)
    enemy = gen_enemy(tier, salt=user["id"] + "-skip-" + uuid.uuid4().hex[:6])
    await db.battle_previews.update_one(battle_state_query(user["id"], BATTLE_MODE_QUICK), {"$set": {"user_id": user["id"], "battle_mode": BATTLE_MODE_QUICK, "enemy": enemy, "turn": "player", "created_at": now_utc(), "changed_enemy_at": now_utc()}}, upsert=True)
    await set_active_battle_mode(user["id"], BATTLE_MODE_QUICK)
    return {"enemy": enemy, "turn": "player", "change_enemy_seconds": CHANGE_ENEMY_COOLDOWN_SECONDS, "change_enemy_ready": False}

def enemy_attack_once(enemy: dict, p_hp: int, p_def: int, p_res: int, p_dex: int, p_mob: int, rng: random.Random, log: list[dict]) -> int:
    enemy_tags = enemy.get("class_tags") or [enemy.get("archetype", "infantry")]
    blind_turns = int(enemy.get("blind_turns", 0) or 0)
    hit_chance = max(35, 72 + enemy.get("dex", 1) - p_dex - max(0, p_mob-enemy.get("mob",0))*2)
    if blind_turns > 0:
        hit_chance -= 35
        enemy["blind_turns"] = max(0, blind_turns - 1)
    if rng.randint(1,100) > hit_chance:
        log.append({"side":"enemy","kind":"miss","dmg":0,"msg":f"{enemy['name']} misses{' while blinded' if blind_turns > 0 else ''}."})
        return p_hp
    use_spell = ("mage" in enemy_tags or "healer" in enemy_tags or "demon" in enemy_tags or "holy" in enemy_tags) and enemy.get("int_stat",0) >= enemy.get("atk",0)
    if use_spell:
        base = max(1, enemy.get("int_stat",1) + rng.randint(-1,2) - p_res//2)
        verb = "casts"; kind = "skill"
    else:
        base = max(1, enemy.get("atk",1) + rng.randint(-1,2) - p_def//2)
        verb = "strikes"; kind = "attack"
    crit = rng.randint(1,100) <= enemy.get("crit",0)
    dmg = int(base * (1.5 if crit else 1.0))
    p_hp -= dmg
    log.append({"side":"enemy","kind":kind,"dmg":dmg,"crit":crit,"msg":f"{enemy['name']} {verb} for {dmg}{' (CRIT!)' if crit else ''}."})
    return p_hp

@api.post("/battle/fight")
async def battle_fight(body: BattleActionIn = BattleActionIn(), user=Depends(get_current_user)):
    # Prefer the mode supplied by the client. The old active_battle_mode fallback remains
    # only for backwards compatibility. This prevents Adventure battles from leaking into Quick Hunt.
    battle_mode = normalize_battle_mode(body.mode) if body.mode else active_battle_mode_for(user)
    state = await ensure_battle_state(user, battle_mode)
    user = state.get("user", user)
    enemy = state["enemy"]
    enemy.pop("_id", None) if isinstance(enemy, dict) else None
    preview_doc = await db.battle_previews.find_one(battle_state_query(user["id"], battle_mode)) or {}
    battle_mode = preview_doc.get("battle_mode", battle_mode)
    adventure_node_no = int(preview_doc.get("adventure_node", 0) or 0)
    adventure_tier_no = int(preview_doc.get("adventure_tier", user.get("difficulty_tier", 1)) or 1)
    if state.get("turn") != "player":
        await db.battle_previews.update_one(battle_state_query(user["id"], battle_mode), {"$set": {"turn": "player"}})

    totals, equipped = await compute_totals(user["id"])
    class_state = equipped_affinity(equipped, user.get("class_affinity"))
    skills = build_player_skills(class_state, equipped)
    primary_key = class_state.get("primary", {}).get("key", "infantry")
    main = main_weapon_from(equipped)
    main_name = main.get("name") if main else "Bare Hands"
    main_tags = (main.get("class_tags") if main else None) or ([primary_key] if primary_key in CLASS_META else ["infantry"])

    p_hp = user["hp"]; p_mana = user["mana"]
    p_atk = totals["atk"]; p_int = totals["int_stat"]
    p_def = totals["def_stat"]; p_res = totals["res"]
    p_dex = totals["dex"]; p_mob = totals["mob"]; p_crit = totals["crit"]; p_luk = totals["luk"]
    enemy_tags = enemy.get("class_tags") or [enemy.get("archetype", "infantry")]
    log: List[dict] = []
    rng = random.Random(uuid.uuid4().int & 0xffffffff)
    action = "skill" if body.action == "ability" else body.action

    if action == "flee":
        flee_chance = min(85, max(25, 45 + (p_mob - enemy.get("mob",0))*8))
        escaped = rng.randint(1,100) <= flee_chance
        if escaped:
            await db.battle_previews.delete_one(battle_state_query(user["id"], battle_mode))
            fresh = await db.users.find_one({"id": user["id"]}, {"_id":0,"password":0})
            return {"resolved": True, "win": False, "escaped": True, "log": [{"side":"player","kind":"flee","dmg":0,"msg":"You escaped!"}], "enemy": enemy, "rewards": {"xp":0,"gold":0,"item":None}, "user": fresh, "next_enemy": gen_enemy(user.get("difficulty_tier",1), salt=user["id"]+"flee"), "class_state": class_state, "main_weapon": main, "skills": skills, "turn": "player"}
        log.append({"side":"player","kind":"flee","dmg":0,"msg":"Escape failed!"})
    elif action == "item":
        if not body.item_id:
            raise HTTPException(400, "Choose an item first")
        q = {"owner_id": user["id"], "slot": "consumable", "listed": False}
        item = await db.items.find_one({"id": body.item_id, **q})
        if not item:
            raise HTTPException(400, "That item is no longer usable")
        heal = int(item.get("hp",0) or 0); mana = int(item.get("mana",0) or 0)
        p_hp = min(user["max_hp"] + totals["hp_bonus"], p_hp + heal)
        p_mana = min(user["max_mana"] + totals["mana_bonus"], p_mana + mana)
        await db.items.delete_one({"id": item["id"]})
        log.append({"side":"player","kind":"item","dmg":0,"msg":f"You use {item['name']} (+{heal} HP, +{mana} Mana)."})
    elif action == "skill":
        skill = next((s for s in skills if s["id"] == (body.skill_id or "")), None) or skills[0]
        cost = int(skill.get("mp_cost", 0) or 0)
        if p_mana < cost:
            log.append({"side":"player","kind":"miss","dmg":0,"msg":f"Not enough Mana for {skill['name']}."})
        else:
            p_mana -= cost
            s_tags = [skill.get("class_key")] if skill.get("class_key") in CLASS_META else [primary_key]
            if skill.get("class_key") == "healer": s_tags = ["healer", "holy"]
            mult, hits = effectiveness_multiplier(s_tags + (skill.get("effective_vs") or []), enemy_tags)
            mod = float(skill.get("damage_modifier", 1.0) or 1.0)
            if skill.get("kind") == "spell":
                base = max(1, p_int + int(skill.get("power", 1)) + rng.randint(-1,2) - enemy.get("res",0)//2)
            elif skill.get("kind") == "status":
                base = max(1, int(skill.get("power",1)))
            else:
                base = max(1, p_atk + int(skill.get("power", 1)) + rng.randint(-1,2) - enemy.get("def_stat",0)//2)
            crit = rng.random()*100 < max(1, p_crit * 0.6)
            dmg = int(base * mod * mult * (1.5 if crit else 1.0))
            enemy["hp"] -= dmg
            await adjust_class_affinity(user["id"], {skill.get("class_key", primary_key): 2})
            status_msg = ""
            if skill.get("status") == "blind" and rng.randint(1,100) <= int(skill.get("status_chance",0)):
                enemy["blind_turns"] = max(1, int(enemy.get("blind_turns",0) or 0), 1)
                status_msg = " Blind!"
            eff = " Effective!" if hits else ""
            rusty = f" ({skill.get('status_text')})" if skill.get("warning") else ""
            log.append({"side":"player","kind":"skill","dmg":dmg,"crit":crit,"effective":bool(hits),"msg":f"{skill['name']}{rusty}{eff} {dmg} damage{status_msg}{' (CRIT!)' if crit else ''}."})
    else:
        hit_chance = max(45, 78 + p_dex - enemy.get("dex",1) - max(0, enemy.get("mob",0)-p_mob)*2)
        if rng.randint(1,100) > hit_chance:
            log.append({"side":"player","kind":"miss","dmg":0,"msg":f"{main_name} misses!"})
        else:
            mult, hits = effectiveness_multiplier(main_tags, enemy_tags)
            base = max(1, p_atk + rng.randint(-1, 3) - enemy.get("def_stat",0)//2)
            crit = rng.random()*100 < p_crit
            dmg = int(base * mult * (1.6 if crit else 1.0))
            enemy["hp"] -= dmg
            await adjust_class_affinity(user["id"], {main_tags[0]: 1})
            eff = " Effective!" if hits else ""
            log.append({"side":"player","kind":"attack","dmg":dmg,"crit":crit,"effective":bool(hits),"msg":f"{main_name} strikes.{eff} {dmg} damage{' (CRIT!)' if crit else ''}."})

    resolved = False; win = False; escaped = False
    rewards = {"xp":0,"gold":0,"item":None}
    new_tier = user.get("difficulty_tier", 1)
    if enemy.get("hp", 0) <= 0:
        resolved = True; win = True
        rewards["xp"] = int(enemy.get("xp_reward", 10 + new_tier * 4)); rewards["gold"] = int(enemy.get("gold_reward", 5 + new_tier * 3 + p_luk))
        if battle_mode == "adventure":
            if adventure_node_no in (5, 10):
                rewards["item"] = await adventure_boss_reward(user["id"], adventure_tier_no, adventure_node_no)
            prog = get_adventure_progress(user)
            completed = sorted(set(prog.get("completed", [])) | {adventure_node_no})
            highest = max(prog.get("highest_node", 0), adventure_node_no)
            next_tier = adventure_tier_no + 1 if adventure_node_no >= 10 else adventure_tier_no
            new_prog = {"tier": next_tier, "highest_node": 0 if adventure_node_no >= 10 else highest, "completed": [] if adventure_node_no >= 10 else completed}
            await db.users.update_one({"id":user["id"]}, {"$set":{"hp":max(1,p_hp),"mana":max(0,p_mana),"adventure_progress":new_prog}, "$inc":{"battles_won":1}})
            await credit_daily_goal(user["id"], "adventure_win", 1)
            next_enemy = gen_adventure_enemy(next_tier, 1)
        else:
            if rng.randint(1,100) <= min(80, 18 + p_luk*2 + (40 if enemy.get("elite") else 0)):
                rewards["item"] = await drop_loot(user["id"], new_tier)
            new_tier += 1
            await db.users.update_one({"id":user["id"]}, {"$set":{"hp":max(1,p_hp),"mana":max(0,p_mana),"difficulty_tier":new_tier}, "$inc":{"battles_won":1}})
            await credit_daily_goal(user["id"], "quick_wins", 1)
            next_enemy = gen_enemy(new_tier, salt=user["id"]+"preview-next")
        await grant_xp(user["id"], rewards["xp"]); await db.users.update_one({"id":user["id"]}, {"$inc":{"gold":rewards["gold"]}})
        fresh_for_daily = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
        if fresh_for_daily:
            await auto_claim_completed_daily_goals(fresh_for_daily)
        await db.battle_previews.delete_one(battle_state_query(user["id"], battle_mode))
    else:
        p_hp = enemy_attack_once(enemy, p_hp, p_def, p_res, p_dex, p_mob, rng, log)
        if p_hp <= 0:
            resolved = True; win = False
            if battle_mode == "adventure":
                await db.users.update_one({"id":user["id"]}, {"$set":{"hp":1,"mana":max(0,p_mana)}, "$inc":{"battles_lost":1}})
                next_enemy = gen_adventure_enemy(adventure_tier_no, adventure_node_no or 1)
            else:
                new_tier = max(1, new_tier-1)
                await db.users.update_one({"id":user["id"]}, {"$set":{"hp":1,"mana":max(0,p_mana),"difficulty_tier":new_tier}, "$inc":{"battles_lost":1}})
                next_enemy = gen_enemy(new_tier, salt=user["id"]+"preview-next-loss")
            await db.battle_previews.delete_one(battle_state_query(user["id"], battle_mode))
        else:
            await db.users.update_one({"id":user["id"]}, {"$set":{"hp":max(1,p_hp),"mana":max(0,p_mana)}})
            await db.battle_previews.update_one(battle_state_query(user["id"], battle_mode), {"$set": {"user_id": user["id"], "battle_mode": battle_mode, "enemy": enemy, "turn": "player", "updated_at": now_utc()}}, upsert=True)
            next_enemy = enemy

    fresh = await db.users.find_one({"id":user["id"]}, {"_id":0,"password":0})
    if not resolved:
        next_enemy = enemy
    refreshed_state = equipped_affinity(equipped, fresh.get("class_affinity") if fresh else user.get("class_affinity"))
    refreshed_skills = build_player_skills(refreshed_state, equipped)
    return {"resolved": resolved, "win": win, "escaped": escaped, "log": log, "enemy": enemy, "rewards": rewards, "user": fresh, "next_enemy": next_enemy, "class_state": refreshed_state, "main_weapon": main, "skills": refreshed_skills, "turn": "player"}


async def drop_loot(user_id: str, tier: int) -> dict:
    """Generate a loot item from a virtual barcode tied to tier."""
    fake_bc = f"LOOT-{tier}-{uuid.uuid4().hex[:8]}"
    user = await db.users.find_one({"id": user_id})
    traits = derive_traits(fake_bc)
    rng = _seed_rand(fake_bc, "loot")
    slot = family_to_slot(traits, rng)
    rarity = roll_rarity(rng, user["level"], traits["uncommonness"] + 0.2)
    rar_bias = {"common": 0.6, "rare": 0.75, "epic": 0.9, "legendary": 1.0}[rarity]
    level = max(1, min(user["level"], int(round(user["level"] * rar_bias))))
    two_h = two_handed_for(slot, traits["shape"], rng)
    stats = gen_stats_for(slot, level, rarity, traits["element"], traits, rng, two_h)
    fb = fallback_name(slot, traits["shape"], rarity, traits["element"], rng, traits.get("family"))
    flavor = {"name": fb, "lore": "Spoils of battle."}
    item = {
        "id": str(uuid.uuid4()),
        "owner_id": user_id,
        "barcode": fake_bc,
        "name": flavor["name"], "lore": flavor["lore"],
        "slot": slot, "rarity": rarity, "level": level,
        "element": traits["element"], "material": traits["material"],
        "shape": traits["shape"], "weight": traits["weight"], "family": traits["family"],
        "two_handed": two_h,
        "equipped": False, "listed": False,
        "class_tags": [], "effective_vs": [],
        "upgrade_xp": 0, "upgrade_xp_to_next": upgrade_xp_to_next(level),
        "created_at": now_utc(), **stats,
    }
    item["class_tags"] = infer_item_class_tags(item)
    item["effective_vs"] = item_effective_vs(item)
    item["icon"] = item_icon_for(item)
    await db.items.insert_one(dict(item))
    item.pop("_id", None)
    return item


# ---------------- Admin Foundation ----------------
# Browser-only prototype admin panel. Do not expose admin controls inside the Expo app.
# Local setup: add ADMIN_SECRET=your-local-admin-password to backend/.env.

ADMIN_DATA_FILES = {
    "enemies_shared": ROOT_DIR / "data" / "enemies" / "shared.json",
    "enemies_quick_hunt": ROOT_DIR / "data" / "enemies" / "quick_hunt.json",
    "enemies_tier_1_forest": ROOT_DIR / "data" / "enemies" / "adventure" / "tier_1_forest.json",
    "adventure_tiers": ROOT_DIR / "data" / "adventure" / "tiers.json",
    "game_config": ROOT_DIR / "data" / "config" / "game_config.json",
    "store_gold": ROOT_DIR / "data" / "store" / "gold_store.json",
    "realm_locations": ROOT_DIR / "data" / "realms" / "locations.json",
    "story_dialogues": ROOT_DIR / "data" / "story" / "dialogues.json",
    "story_characters": ROOT_DIR / "data" / "story" / "characters.json",
    "story_flags": ROOT_DIR / "data" / "story" / "flags.json",
    "story_quests": ROOT_DIR / "data" / "story" / "quests.json",
    "story_items": ROOT_DIR / "data" / "story" / "items.json",
}

ADMIN_DATA_LABELS = {
    "enemies_shared": "Shared Enemies",
    "enemies_quick_hunt": "Quick Hunt Enemies",
    "enemies_tier_1_forest": "Tier 1 Forest Nodes",
    "adventure_tiers": "Adventure Tiers",
    "game_config": "Game Config",
    "store_gold": "Gold Store Items",
    "realm_locations": "Realm Locations",
    "story_dialogues": "Story Dialogue Events",
    "story_characters": "Story Characters",
    "story_flags": "Story Flags",
    "story_quests": "Story Quests",
    "story_items": "Story Items / Equipment",
}


def admin_enabled() -> bool:
    return bool((ADMIN_SECRET or "").strip())


def require_admin_secret(x_admin_secret: Optional[str] = Header(default=None)):
    if not admin_enabled():
        raise HTTPException(503, "Admin panel disabled. Add ADMIN_SECRET to backend/.env and restart the server.")
    if not x_admin_secret or x_admin_secret != ADMIN_SECRET:
        raise HTTPException(401, "Invalid admin secret")
    return True


def read_admin_json_file(key: str) -> Any:
    path = ADMIN_DATA_FILES.get(key)
    if not path:
        raise HTTPException(404, "Unknown admin data file")
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        if key == "realm_locations":
            default = DEFAULT_REALM_DATA
        elif key in {"story_dialogues", "story_characters", "story_quests", "story_items"}:
            default = []
        elif key == "story_flags":
            default = {}
        elif key.startswith("enemies_") or key.startswith("store_") or key == "adventure_tiers":
            default = []
        else:
            default = {}
        path.write_text(json_dumps_pretty(default))
    import json
    try:
        return json.loads(path.read_text())
    except Exception as exc:
        raise HTTPException(500, f"Could not read {key}: {exc}")


def json_dumps_pretty(data: Any) -> str:
    import json
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def write_admin_json_file(key: str, data: Any) -> dict:
    path = ADMIN_DATA_FILES.get(key)
    if not path:
        raise HTTPException(404, "Unknown admin data file")
    path.parent.mkdir(parents=True, exist_ok=True)
    # Round-trip through JSON serialization to fail fast on bad data.
    if key == "realm_locations":
        data = normalize_realm_data(data)
    path.write_text(json_dumps_pretty(data))
    return {"ok": True, "key": key, "path": str(path.relative_to(ROOT_DIR))}



ALLOWED_ADMIN_ASSET_BUCKETS = {
    "items/weapons", "items/armor", "items/consumables", "items/materials", "items/trinkets",
    "enemies/shared", "enemies/quick_hunt", "enemies/tier_1_forest",
    "avatars", "maps", "realms",
}
ADMIN_ASSET_SIZE_HINTS = {
    "items/weapons": "512x512 PNG/WebP",
    "items/armor": "512x512 PNG/WebP",
    "items/consumables": "512x512 PNG/WebP",
    "items/materials": "512x512 PNG/WebP",
    "items/trinkets": "512x512 PNG/WebP",
    "enemies/shared": "768x768 PNG/WebP",
    "enemies/quick_hunt": "768x768 PNG/WebP",
    "enemies/tier_1_forest": "768x768 PNG/WebP",
    "avatars": "768x768 PNG/WebP",
    "maps": "1080x1920 PNG/WebP",
    "realms": "1080x1920 PNG/WebP",
}


def clean_asset_name(filename: str) -> str:
    stem = Path(filename or "asset").stem.lower()
    ext = Path(filename or "asset.png").suffix.lower() or ".png"
    if ext not in (".png", ".jpg", ".jpeg", ".webp"):
        raise HTTPException(400, "Only PNG, JPG, JPEG, and WebP images are allowed")
    cleaned = "".join(ch if ch.isalnum() else "_" for ch in stem).strip("_") or "asset"
    return f"{cleaned}_{uuid.uuid4().hex[:8]}{ext}"


def list_bucket_assets(bucket: str) -> list:
    if bucket not in ALLOWED_ADMIN_ASSET_BUCKETS:
        raise HTTPException(400, "Invalid asset bucket")
    folder = FRONTEND_IMAGES_DIR / bucket
    folder.mkdir(parents=True, exist_ok=True)
    out = []
    for path in sorted(folder.iterdir()):
        if path.is_file() and path.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
            rel = path.relative_to(FRONTEND_IMAGES_DIR).as_posix()
            out.append({"name": path.name, "bucket": bucket, "asset_key": f"asset:{rel}", "url": f"/assets/{rel}"})
    return out


@api.get("/admin/assets")
async def admin_assets(bucket: Optional[str] = None, _: bool = Depends(require_admin_secret)):
    buckets = sorted(ALLOWED_ADMIN_ASSET_BUCKETS)
    if bucket:
        return {"bucket": bucket, "size_hint": ADMIN_ASSET_SIZE_HINTS.get(bucket, "PNG/WebP"), "assets": list_bucket_assets(bucket)}
    return {"buckets": [{"bucket": b, "size_hint": ADMIN_ASSET_SIZE_HINTS.get(b, "PNG/WebP"), "assets": list_bucket_assets(b)} for b in buckets]}


@api.post("/admin/assets/upload")
async def admin_upload_asset(
    bucket: str = Form(...),
    file: UploadFile = File(...),
    _: bool = Depends(require_admin_secret),
):
    if bucket not in ALLOWED_ADMIN_ASSET_BUCKETS:
        raise HTTPException(400, "Invalid asset bucket")
    name = clean_asset_name(file.filename or "asset.png")
    folder = FRONTEND_IMAGES_DIR / bucket
    folder.mkdir(parents=True, exist_ok=True)
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image too large. Keep uploads under 8 MB.")
    dest = folder / name
    dest.write_bytes(data)
    rel = dest.relative_to(FRONTEND_IMAGES_DIR).as_posix()
    return {"ok": True, "asset_key": f"asset:{rel}", "url": f"/assets/{rel}", "bucket": bucket, "name": name}


@app.get("/admin", response_class=HTMLResponse)
async def admin_page():
    admin_html = ROOT_DIR / "admin" / "index.html"
    if not admin_html.exists():
        return HTMLResponse("<h1>Barcodia Admin</h1><p>Admin UI file missing.</p>", status_code=500)
    return HTMLResponse(admin_html.read_text())


@api.get("/admin/status")
async def admin_status():
    return {
        "enabled": admin_enabled(),
        "message": "Admin enabled" if admin_enabled() else "Admin disabled. Add ADMIN_SECRET to backend/.env and restart.",
        "available_files": list(ADMIN_DATA_FILES.keys()),
    }


@api.get("/admin/data")
async def admin_list_data(_: bool = Depends(require_admin_secret)):
    return {
        "files": [
            {"key": key, "label": ADMIN_DATA_LABELS.get(key, key), "path": str(path.relative_to(ROOT_DIR)), "exists": path.exists()}
            for key, path in ADMIN_DATA_FILES.items()
        ]
    }


@api.get("/admin/data/{key}")
async def admin_get_data(key: str, _: bool = Depends(require_admin_secret)):
    return {"key": key, "data": read_admin_json_file(key)}


@api.put("/admin/data/{key}")
async def admin_save_data(key: str, body: AdminConfigSaveIn, _: bool = Depends(require_admin_secret)):
    return write_admin_json_file(key, body.data)


@api.get("/admin/summary")
async def admin_summary(_: bool = Depends(require_admin_secret)):
    enemy_counts = {}
    for key in ("enemies_shared", "enemies_quick_hunt", "enemies_tier_1_forest"):
        data = read_admin_json_file(key)
        enemy_counts[key] = len(data) if isinstance(data, list) else 0
    tiers = read_admin_json_file("adventure_tiers")
    store = read_admin_json_file("store_gold")
    return {
        "enemy_counts": enemy_counts,
        "adventure_tiers": len(tiers) if isinstance(tiers, list) else 0,
        "store_gold_items": len(store) if isinstance(store, list) else 0,
        "realm_locations": sum(len(r.get("locations", [])) for r in (read_admin_json_file("realm_locations").get("realms", []) if isinstance(read_admin_json_file("realm_locations"), dict) else [])),
        "config": read_admin_json_file("game_config"),
    }

# ---------------- App wiring ----------------

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
