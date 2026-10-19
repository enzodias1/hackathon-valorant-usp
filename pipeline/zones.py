"""Where teams die: deaths by named map region (nearest official callout) and a heat grid in minimap space.

For each team x map x side:
  zones  - deaths per region, share of the team's deaths vs. the league's share in that region,
           and the untraded-death rate vs. the league's rate in that same region (binomial z; Benjamini-Hochberg
           over all the team's region tests, since a page lists many regions)
  grid   - GRID x GRID heat grid (minimap uv space) with deaths and untraded deaths, for the heatmap drawing

Writes data/processed/zones/<team>.json
"""
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

from insights import bh_adjust, binom

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / "data" / "processed"
LOOKUP = json.loads((ROOT / "data" / "meta" / "lookup.json").read_text(encoding="utf-8"))
GRID = 32
MIN_DEATHS_ZONE = 8


def zone_label(super_region, region):
    if super_region.startswith("no Lado"):
        return "Base do ataque" if "Atacante" in super_region else "Base da defesa"
    if super_region == "Meio":
        return f"Meio · {region}"
    return f"{super_region} · {region}"


def assign_zones(df, code):
    c = LOOKUP["maps"][code]["callouts"]
    cx, cy = np.array([x["x"] for x in c]), np.array([x["y"] for x in c])
    d2 = (df.victim_x.to_numpy()[:, None] - cx[None, :]) ** 2 + (df.victim_y.to_numpy()[:, None] - cy[None, :]) ** 2
    idx = d2.argmin(axis=1)
    return [zone_label(c[i]["super"], c[i]["region"]) for i in idx]


def to_uv(df, code):
    t = LOOKUP["maps"][code]
    u = df.victim_y * t["xMultiplier"] + t["xScalarToAdd"]
    v = df.victim_x * t["yMultiplier"] + t["yScalarToAdd"]
    return u.clip(0, 0.9999), v.clip(0, 0.9999)


def main():
    m = pd.read_parquet(P / "matches.parquet")
    kl = pd.read_parquet(P / "kills.parquet")
    dc = pd.read_parquet(P / "death_context.parquet")
    pm = pd.read_parquet(P / "player_match.parquet")
    tr = pd.read_parquet(P / "team_rounds.parquet")

    d = dc.merge(kl[["match_id", "round_num", "kill_idx", "victim_side"]], on=["match_id", "round_num", "kill_idx"])
    d = d.merge(m[["match_id", "map_code", "map"]], on="match_id")
    team_of = pm.set_index(["match_id", "puuid"])["team"]
    d["team"] = team_of.reindex(pd.MultiIndex.from_frame(d[["match_id", "victim"]])).to_numpy()
    d = d[d.team.notna()]
    parts = []
    for code, g in d.groupby("map_code"):
        g = g.copy()
        g["zone"] = assign_zones(g, code)
        g["u"], g["v"] = to_uv(g, code)
        parts.append(g)
    d = pd.concat(parts)
    d["untraded"] = ~d.traded.astype(bool)

    # league baselines per map x side x zone
    lg_side = d.groupby(["map_code", "victim_side"]).size()
    lg = d.groupby(["map_code", "victim_side", "zone"]).agg(deaths=("untraded", "size"), untraded=("untraded", "mean"))
    lg["share"] = lg.deaths / lg_side.reindex(lg.index.droplevel("zone")).to_numpy()
    rounds = tr.merge(m[["match_id", "map_code"]], on="match_id").groupby(["team", "map_code", "side"]).size()

    out_dir = P / "zones"
    out_dir.mkdir(exist_ok=True)
    n_claims = 0
    for team, g in d.groupby("team"):
        maps = []
        family = {}
        for code, gm in g.groupby("map_code"):
            mp = LOOKUP["maps"][code]
            sides = {}
            for side, gs in gm.groupby("victim_side"):
                total = len(gs)
                zones = []
                for zone, gz in gs.groupby("zone"):
                    base = lg.loc[(code, side, zone)]
                    c = binom(gz.untraded.sum(), len(gz), float(base.untraded), higher_is_better=False)
                    key = f"{code}|{side}|{zone}"
                    if len(gz) >= MIN_DEATHS_ZONE:
                        family[key] = c
                    zones.append({"zone": zone, "deaths": int(len(gz)), "share": len(gz) / total, "league_share": float(base.share),
                                  "untraded_rate": float(gz.untraded.mean()), "league_untraded_rate": float(base.untraded),
                                  "isolated_rate": float(gz.isolated.mean()) if gz.isolated.notna().any() else None, "_key": key})
                zones.sort(key=lambda z: -z["deaths"])
                ij = np.floor(gs.u * GRID).astype(int) * GRID + np.floor(gs.v * GRID).astype(int)
                cells = pd.DataFrame({"cell": ij, "untraded": gs.untraded}).groupby("cell").agg(n=("untraded", "size"), un=("untraded", "sum"))
                grid = [[int(c // GRID), int(c % GRID), int(r.n), int(r.un)] for c, r in cells.iterrows()]  # [col(u), row(v), deaths, untraded]
                sides[side] = {"deaths": total, "rounds": int(rounds.get((team, code, side), 0)), "zones": zones, "grid": grid}
            maps.append({"code": code, "map": mp["name"], "minimap": mp["minimap"],
                         "transform": {k: mp[k] for k in ("xMultiplier", "yMultiplier", "xScalarToAdd", "yScalarToAdd")},
                         "deaths": int(len(gm)), "sides": sides})
        bh_adjust(family)
        for mp in maps:
            for s in mp["sides"].values():
                for z in s["zones"]:
                    c = family.get(z.pop("_key"))
                    z["significant"] = bool(c and c["significant"])
                    z["worse_than_league"] = bool(c and c["significant"] and c["good"] is False)
                    z["z"] = None if not c or c["z"] is None else round(c["z"], 2)
                    n_claims += z["significant"]
        maps.sort(key=lambda x: -x["deaths"])
        doc = {"team": team, "grid_size": GRID, "maps": maps}
        (out_dir / f"{team}.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":"), default=float), encoding="utf-8")
    print(f"zones for {d.team.nunique()} teams | deaths {len(d)} | significant zone claims {n_claims}")


if __name__ == "__main__":
    main()
