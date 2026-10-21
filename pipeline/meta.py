"""Builds data/meta/lookup.json: static game metadata (agents, weapons, gear, maps) keyed by the IDs used in match files.

Source: valorant-api.com snapshots in data/meta/*.json (game metadata only, no match data).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
META = ROOT / "data" / "meta"

ROLE_PT = {"Duelist": "Duelista", "Initiator": "Iniciador", "Controller": "Controlador", "Sentinel": "Sentinela"}
ABILITY_SLOTS = ("Ability1", "Ability2", "Grenade", "Ultimate")


def load(name):
    return json.loads((META / f"{name}.json").read_text(encoding="utf-8"))["data"]


def build():
    agents = {}
    for a in load("agents"):
        role = a.get("role") or {}
        agents[a["uuid"].lower()] = {
            "name": a["displayName"],
            "role": role.get("displayName"),
            "icon": a.get("displayIcon"),
            "minimap_icon": a.get("minimapPortrait"),
            # slot as it appears in finishingDamage.damageItem ("GrenadeAbility" there = "Grenade" here)
            "abilities": {b["slot"]: {"name": b["displayName"], "icon": b.get("displayIcon")}
                          for b in a.get("abilities") or [] if b.get("slot") in ABILITY_SLOTS},
        }

    weapons = {}
    for w in load("weapons"):
        cat = (w.get("category") or "").split("::")[-1]
        shop = w.get("shopData") or {}
        weapons[w["uuid"].lower()] = {
            "name": w["displayName"],
            "category": cat,
            "cost": shop.get("cost", 0),
            "icon": w.get("killStreamIcon") or w.get("displayIcon"),
        }

    # Agent-ability "weapons": they appear as finishingDamage.damageItem with damageType "Weapon" but are not in the weapons
    # catalog. Identified from the data (killer is always that agent): Headhunter is used every round and scoped in 38% of
    # its kills; Tour de Force is rare (ultimate) and scoped in ~100%. From patch 13.02 on, Tour de Force kills come with an
    # EMPTY damageItem, so "" maps to it here; only use this key for weapon kills (an empty loadout weapon means no weapon).
    by_name = {a["name"]: a for a in agents.values()}
    for uuid, (agent, slot) in {
        "856d9a7e-4b06-dc37-15dc-9d809c37cb90": ("Chamber", "Ability1"),  # Caçador de Cabeças
        "39099fb5-4293-def4-1e09-2e9080ce7456": ("Chamber", "Ultimate"),  # Tour de Force (up to patch 13.01)
        "": ("Chamber", "Ultimate"),  # Tour de Force (patch 13.02+)
        "95336ae4-45d4-1032-cfaf-6bad01910607": ("Neon", "Ultimate"),  # Sobrecarga
    }.items():
        ab = by_name[agent]["abilities"][slot]
        weapons[uuid] = {"name": ab["name"], "category": "Ability", "cost": 0, "icon": ab["icon"], "agent": agent, "slot": slot}

    gear = {g["uuid"].lower(): {"name": g["displayName"], "cost": (g.get("shopData") or {}).get("cost", 0)} for g in load("gear")}

    maps = {}
    for m in load("maps"):
        code = m["mapUrl"].split("/")[-1]
        maps[code] = {
            "name": m["displayName"],
            "minimap": m.get("displayIcon"),
            "splash": m.get("splash"),
            # world (x, y) -> minimap uv: u = y * xMultiplier + xScalarToAdd ; v = x * yMultiplier + yScalarToAdd
            "xMultiplier": m.get("xMultiplier"),
            "yMultiplier": m.get("yMultiplier"),
            "xScalarToAdd": m.get("xScalarToAdd"),
            "yScalarToAdd": m.get("yScalarToAdd"),
            "callouts": [
                {"region": c["regionName"], "super": c["superRegionName"], "x": c["location"]["x"], "y": c["location"]["y"]}
                for c in (m.get("callouts") or [])
            ],
        }

    lookup = {"agents": agents, "weapons": weapons, "gear": gear, "maps": maps}
    (META / "lookup.json").write_text(json.dumps(lookup, ensure_ascii=False, indent=1), encoding="utf-8")
    return lookup


if __name__ == "__main__":
    lk = build()
    print({k: len(v) for k, v in lk.items()})
