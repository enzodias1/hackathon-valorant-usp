"""Exports precomputed JSON for the web app into web/public/data/.

  index.json                    list of matches (+ teams) for navigation
  matches/<match_id>.json       one match: players, rounds, events with win probability, positions for the minimap

Win probabilities are exported from the RED team's perspective (wp_red = P(Red wins the round)) so the
front-end can draw a single momentum line per match without knowing who attacked each round.
"""
import json
import math
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / "data" / "processed"
OUT = ROOT / "web" / "public" / "data"
LOOKUP = json.loads((ROOT / "data" / "meta" / "lookup.json").read_text(encoding="utf-8"))
SHEET = ROOT / "para_equipe" / "nomes_dos_times.xlsx"


def team_names():
    """slug -> {name, tag}: filled spreadsheet wins over the automatic suggestion."""
    df = pd.read_excel(SHEET)
    cols = list(df.columns)
    slug, sug, fix, tag = cols[0], cols[1], cols[2], cols[3]
    out = {}
    for r in df.itertuples(index=False):
        vals = dict(zip(cols, r))
        name = vals[fix] if isinstance(vals[fix], str) and vals[fix].strip() else vals[sug]
        short = vals[tag] if isinstance(vals[tag], str) and vals[tag].strip() else name
        out[vals[slug]] = {"name": name.strip(), "tag": short.strip()}
    return out


def clean(o):
    """NaN -> None, numpy scalars -> python, round floats."""
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    if isinstance(o, list):
        return [clean(v) for v in o]
    if hasattr(o, "item"):
        o = o.item()
    if isinstance(o, float):
        return None if math.isnan(o) else round(o, 4)
    return o


def write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(clean(obj), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main():
    names = team_names()
    t = {n: pd.read_parquet(P / f"{n}.parquet") for n in ("matches", "player_match", "rounds", "kills", "wp_events", "wp_states", "wp_credits", "player_round")}
    m, pm, rd, kl, ev, st, cr, pr = (t[k] for k in ("matches", "player_match", "rounds", "kills", "wp_events", "wp_states", "wp_credits", "player_round"))

    agents_by_name = {a["name"]: a for a in LOOKUP["agents"].values()}
    wpa_pm = cr.groupby(["match_id", "puuid"]).wpa.sum() * 100
    adr = pr.groupby(["match_id", "puuid"]).damage.mean()
    p0 = st[st.kind == "start"].set_index(["match_id", "round_num"]).p_atk
    ev_by = {k: g for k, g in ev.groupby(["match_id", "round_num"])}
    kl_by = {k: g.set_index("kill_idx") for k, g in kl.groupby(["match_id", "round_num"])}
    rd_by = {k: g for k, g in rd.groupby("match_id")}
    pm_by = {k: g for k, g in pm.groupby("match_id")}

    index = []
    for mt in m.sort_values("date").itertuples(index=False):
        mid = mt.match_id
        mp = LOOKUP["maps"].get(mt.map_code, {})
        players = []
        for p in pm_by[mid].itertuples(index=False):
            a = agents_by_name.get(p.agent, {})
            players.append({
                "puuid": p.puuid, "name": p.name, "color": p.team_color, "agent": p.agent, "agent_icon": a.get("icon"), "role": p.role,
                "kills": p.kills, "deaths": p.deaths, "assists": p.assists, "acs": p.score / max(p.rounds, 1),
                "adr": adr.get((mid, p.puuid)), "wpa": wpa_pm.get((mid, p.puuid), 0.0),
            })
        rounds = []
        for r in rd_by[mid].sort_values("round_num").itertuples(index=False):
            key = (mid, r.round_num)
            red_is_atk = r.attacker_color == "Red"
            to_red = (lambda p: p) if red_is_atk else (lambda p: 1 - p)
            events = []
            kg = kl_by.get(key)
            for e in ev_by.get(key, pd.DataFrame()).itertuples(index=False):
                item = {"t": e.t_round_ms, "type": e.event, "actor": e.actor, "wp_red_before": to_red(e.p_atk_before), "wp_red_after": to_red(e.p_atk_after), "wpa": e.wpa * 100}
                if e.event == "kill":
                    k = kg.loc[int(e.kill_idx)]
                    item.update({"victim": e.victim, "weapon": k.weapon, "first_blood": bool(k.first_blood),
                                 "traded": bool(k.traded), "is_trade": bool(k.is_trade), "teamkill": bool(k.teamkill),
                                 "victim_xy": [k.victim_x, k.victim_y], "killer_xy": None if pd.isna(k.killer_x) else [k.killer_x, k.killer_y],
                                 "assistants": [a for a in k.assistants.split(",") if a]})
                events.append(item)
            rounds.append({
                "n": r.round_num + 1, "half": r.half, "attacker": r.attacker_color, "winner": r.winner_color, "result": r.result_code,
                "score_before": {r.attacker_color: r.score_atk_before, r.defender_color: r.score_def_before},
                "buy": {r.attacker_color: r.atk_buy, r.defender_color: r.def_buy},
                "loadout": {r.attacker_color: r.atk_loadout, r.defender_color: r.def_loadout},
                "wp_red_start": to_red(p0[key]),
                "plant": {"t": r.plant_time_ms, "site": r.plant_site, "by": r.planter, "xy": [r.plant_x, r.plant_y]} if r.planted else None,
                "defuse": {"t": r.defuse_time_ms, "by": r.defuser} if r.defused else None,
                "anomalous": bool(r.anomalous), "events": events,
            })
        teams = {c: {"slug": s, **names.get(s, {"name": s, "tag": s})} for c, s in (("Red", mt.team_red), ("Blue", mt.team_blue))}
        doc = {
            "id": mid, "competition": mt.competition, "stage": mt.stage, "series_id": mt.series_id, "game_in_series": mt.game_in_series,
            "date": mt.date.isoformat(), "length_min": mt.length_min, "game_version": mt.game_version,
            "map": {"code": mt.map_code, "name": mt.map, "minimap": mp.get("minimap"), "splash": mp.get("splash"),
                    "transform": {k: mp.get(k) for k in ("xMultiplier", "yMultiplier", "xScalarToAdd", "yScalarToAdd")}},
            "teams": teams, "score": {"Red": mt.rounds_red, "Blue": mt.rounds_blue},
            "winner": "Red" if mt.winner == mt.team_red else "Blue",
            "players": players, "rounds": rounds,
        }
        write(OUT / "matches" / f"{mid}.json", doc)
        index.append({"id": mid, "date": doc["date"], "competition": mt.competition, "stage": mt.stage, "map": mt.map,
                      "red": mt.team_red, "blue": mt.team_blue, "score": doc["score"], "winner": doc["winner"]})

    write(OUT / "index.json", {"teams": names, "matches": index})
    size = sum(f.stat().st_size for f in (OUT / "matches").glob("*.json"))
    print(f"exported {len(index)} matches ({size / 1e6:.1f} MB) -> {OUT}")


if __name__ == "__main__":
    main()
