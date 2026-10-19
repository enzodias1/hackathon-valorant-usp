"""Builds data/meta/lookup.json: static game metadata (agents, weapons, gear, maps) keyed by the IDs used in match files.

Source: valorant-api.com snapshots in data/meta/*.json (game metadata only, no match data).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
META = ROOT / "data" / "meta"

ROLE_PT = {"Duelist": "Duelista", "Initiator": "Iniciador", "Controller": "Controlador", "Sentinel": "Sentinela"}


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

    # Agent-ability "weapons" that appear as finishingDamage.damageItem but are not in the weapons catalog.
    # Identified empirically by the killer's agent (Chamber / Neon).
    for uuid, name in {
        "856d9a7e-4b06-dc37-15dc-9d809c37cb90": "Caçadora (Chamber)",
        "39099fb5-4293-def4-1e09-2e9080ce7456": "Marca Registrada (Chamber)",
        "": "Marca Registrada (Chamber)",
        "95336ae4-45d4-1032-cfaf-6bad01910607": "Sobrecarga (Neon)",
    }.items():
        weapons[uuid] = {"name": name, "category": "Ability", "cost": 0, "icon": None}

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
