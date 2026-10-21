"""Walkable grid of each map (for the round replay to move players along corridors instead of through walls).

The official minimap image is the floor plan: gray pixels = floor, transparent = outside, and the thin WHITE lines are the
walls between neighboring areas (counting them as floor let paths cut through walls). Each map becomes an
N x N grid in minimap uv space (same space as toMinimap in the site), plus the attacker/defender spawn points (callouts
"Surgimento"). Validated against the recorded positions: they must land on walkable cells.

Writes web/public/data/maps/<code>.json:  {"n": N, "walk": "<base64 bitset, row-major (v, then u)>", "spawn": {"atk": [u, v], "def": [u, v]}}
Minimap images are cached in data/processed/minimaps/ (game metadata from valorant-api.com, no match data).
"""
import base64
import io
import json
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image
from scipy.ndimage import binary_dilation

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / "data" / "processed"
OUT = ROOT / "web" / "public" / "data" / "maps"
LOOKUP = json.loads((ROOT / "data" / "meta" / "lookup.json").read_text(encoding="utf-8"))
N = 160  # ~0.7 m per cell: corridors and doors are several cells wide
MIN_FLOOR = 0.5  # share of floor pixels for a cell to count as floor
WALL_LUM = 220  # white lines (walls); the floor is ~118-134 gray and ramps/platforms a lighter gray (< 220)
WALL_GROW = 1  # px (of 1024): thicken the wall lines a bit; 2+ starts closing real passages (non-mobility agents start "jumping")
EARLY_MS = 4000  # positions this early are still next to the spawn


def minimap(code):
    cache = P / "minimaps" / f"{code}.png"
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        url = LOOKUP["maps"][code]["minimap"]
        cache.write_bytes(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read())
    return Image.open(io.BytesIO(cache.read_bytes())).convert("RGBA")


def to_uv(x, y, mp):
    # same formula as web/src/lib/minimap.ts (axes swapped)
    return y * mp["xMultiplier"] + mp["xScalarToAdd"], x * mp["yMultiplier"] + mp["yScalarToAdd"]


def empirical_spawns(early, mp):
    """Median position of each side in the first seconds of the round (players are still next to their spawn)."""
    out = {}
    for side, sel in (("atk", early.color == early.attacker_color), ("def", early.color != early.attacker_color)):
        g = early[sel]
        if len(g) >= 20:
            out[side] = [round(v, 4) for v in to_uv(float(g.x.median()), float(g.y.median()), mp)]
    return out


def build(code):
    rgba = np.asarray(minimap(code))
    opaque = rgba[:, :, 3] > 0
    wall = binary_dilation(opaque & (rgba[:, :, :3].mean(axis=2) >= WALL_LUM), iterations=WALL_GROW)
    floor_px = (opaque & ~wall).astype(np.uint8) * 255
    # share of floor pixels per cell: area average over the WHOLE image (1024 is not a multiple of N; cropping misaligns the grid)
    share = np.asarray(Image.fromarray(floor_px).resize((N, N), Image.Resampling.BOX)) / 255
    floor = share >= MIN_FLOOR
    mp = LOOKUP["maps"][code]
    spawn = {}
    for c in mp["callouts"]:
        if c["region"] == "Surgimento":
            spawn["atk" if "Atacante" in c["super"] else "def"] = [round(v, 4) for v in to_uv(c["x"], c["y"], mp)]
    return floor, spawn


def main():
    matches = pd.read_parquet(P / "matches.parquet")[["match_id", "map_code"]]
    pos = pd.read_parquet(P / "positions.parquet", columns=["match_id", "round_num", "t_round_ms", "color", "x", "y"]).merge(matches, on="match_id")
    rounds = pd.read_parquet(P / "rounds.parquet", columns=["match_id", "round_num", "attacker_color"])
    early = pos[pos.t_round_ms < EARLY_MS].merge(rounds, on=["match_id", "round_num"])
    OUT.mkdir(parents=True, exist_ok=True)
    for code in sorted(matches.map_code.unique()):
        floor, spawn = build(code)
        mp = LOOKUP["maps"][code]
        emp = empirical_spawns(early[early.map_code == code], mp)
        # official callout when the map has one; otherwise where each side is in the first seconds (Lotus, Summit)
        gap = {k: round(float(np.hypot(spawn[k][0] - emp[k][0], spawn[k][1] - emp[k][1]) / abs(mp["xMultiplier"]) / 100), 1)
               for k in spawn if k in emp}
        spawn = {k: spawn.get(k, emp.get(k)) for k in ("atk", "def") if k in spawn or k in emp}
        p = pos[pos.map_code == code]
        u, v = to_uv(p.x.to_numpy(), p.y.to_numpy(), mp)
        i, j = np.clip((v * N).astype(int), 0, N - 1), np.clip((u * N).astype(int), 0, N - 1)
        on_floor = floor[i, j].mean()
        bits = np.packbits(floor.astype(np.uint8).ravel())
        (OUT / f"{code}.json").write_text(json.dumps({"n": N, "walk": base64.b64encode(bits.tobytes()).decode(), "spawn": spawn}), encoding="utf-8")
        print(f"{code:9s} {mp['name']:9s} floor {floor.mean():5.1%} of the grid | recorded positions on the floor: {on_floor:6.2%} "
              f"(n={len(p)}) | spawns: {sorted(spawn)} | callout vs. first seconds (m): {gap or 'no callout'}")


if __name__ == "__main__":
    main()
