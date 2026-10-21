"""ETL: raw match JSONs -> normalized parquet tables in data/processed/.

Usage: python pipeline/etl.py "<path to Dados .Json>"

Tables
  matches        one row per map played
  player_match   one row per player per match (scoreboard + agent)
  rounds         one row per round (sides, result, plant/defuse, team economy)
  player_round   one row per player per round (economy, combat, KAST parts, clutch)
  kills          one row per kill, in chronological order, with alive counts before/after and trade links
  positions      player positions snapshot at each kill / plant / defuse
  damage         damage dealt per (round, dealer, receiver)
"""
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "processed"
LOOKUP = json.loads((ROOT / "data" / "meta" / "lookup.json").read_text(encoding="utf-8"))

TRADE_WINDOW_MS = 5000
FILE_RE = re.compile(
    r"^(?P<prefix>.+?)_(?P<seq>\d+)(?P<game>[a-z]?)_(?P<date>\d\d-\d\d-\d\d)_"
    r"(?P<a>.+)_(?P<sa>\d+)_x_(?P<sb>\d+)_(?P<b>.+)_(?P<map>[a-z]+)\.json$"
)


def side_of(color, attacker_color):
    return "Ataque" if color == attacker_color else "Defesa"


def half_of(rn):
    return "1º tempo" if rn < 12 else "2º tempo" if rn < 24 else "Prorrogação"


def buy_type(total_loadout, round_num):
    """Team-level buy classification on summed loadout value (5 players)."""
    if round_num in (0, 12):
        return "Pistol"
    if total_loadout < 5000:
        return "Eco"
    if total_loadout < 10000:
        return "Semi-eco"
    if total_loadout < 20000:
        return "Semi-buy"
    return "Full buy"


def weapon_name(uuid):
    w = LOOKUP["weapons"].get((uuid or "").lower())
    return w["name"] if w else None


def weapon_cat(uuid):
    w = LOOKUP["weapons"].get((uuid or "").lower())
    return w["category"] if w else None


def parse_match(path: Path, data_root: Path, T):
    d = json.loads(path.read_text(encoding="utf-8"))
    m = FILE_RE.match(path.name)
    if not m:
        raise ValueError(f"unexpected filename {path.name}")
    rel = path.parent.relative_to(data_root).parts
    competition = rel[0]
    stage = rel[1] if len(rel) > 1 else None

    info = d["matchInfo"]
    mid = info["matchId"]
    teams = {t["teamId"]: t for t in d["teams"]}
    sa, sb = int(m["sa"]), int(m["sb"])
    # filename lists team A/B with their scores; map to Red/Blue by rounds won (scores never tie in this data)
    by_score = {t["roundsWon"]: c for c, t in teams.items()}
    name_of = {by_score[sa]: m["a"], by_score[sb]: m["b"]}
    map_code = info["mapId"].split("/")[-1]
    series_key = f"{competition}|{stage}|{m['seq']}" if m["game"] else f"{competition}|{stage}|{m['seq']}|{mid}"

    T["matches"].append({
        "match_id": mid,
        "file": path.name,
        "competition": competition,
        "stage": stage,
        "series_id": series_key,
        "game_in_series": m["game"] or None,
        "date": datetime.fromtimestamp(info["gameStartMillis"] / 1000, tz=timezone.utc),
        "map_code": map_code,
        "map": LOOKUP["maps"].get(map_code, {}).get("name", m["map"].title()),
        "game_version": info["gameVersion"].split("-shipping")[0].replace("release-", ""),
        "length_min": round(info["gameLengthMillis"] / 60000, 1),
        "team_red": name_of["Red"],
        "team_blue": name_of["Blue"],
        "rounds_red": teams["Red"]["roundsWon"],
        "rounds_blue": teams["Blue"]["roundsWon"],
        "winner": name_of["Red"] if teams["Red"]["won"] else name_of["Blue"],
        "rounds_total": len(d["roundResults"]),
    })

    players = [p for p in d["players"] if not p["isObserver"]]
    color_of = {p["puuid"]: p["teamId"] for p in players}
    for p in players:
        a = LOOKUP["agents"].get((p["characterId"] or "").lower(), {})
        s = p["stats"]
        ac = s.get("abilityCasts") or {}
        T["player_match"].append({
            "match_id": mid, "puuid": p["puuid"], "name": f'{p["gameName"]}#{p["tagLine"]}',
            "team_color": p["teamId"], "team": name_of[p["teamId"]], "opponent": name_of["Blue" if p["teamId"] == "Red" else "Red"],
            "won": teams[p["teamId"]]["won"], "party_id": p["partyId"],
            "agent": a.get("name"), "role": a.get("role"),
            "score": s["score"], "rounds": s["roundsPlayed"], "kills": s["kills"], "deaths": s["deaths"], "assists": s["assists"],
            "casts_c": ac.get("grenadeCasts"), "casts_q": ac.get("ability1Casts"), "casts_e": ac.get("ability2Casts"), "casts_x": ac.get("ultimateCasts"),
        })

    score = {"Red": 0, "Blue": 0}
    for r in d["roundResults"]:
        rn = r["roundNum"]
        win_color = r["winningTeam"]
        atk = win_color if r["winningTeamRole"] == "Attacker" else ("Blue" if win_color == "Red" else "Red")
        dfn = "Blue" if atk == "Red" else "Red"
        pstats = {ps["puuid"]: ps for ps in r["playerStats"]}

        # --- team economy
        team_loadout = defaultdict(int); team_spent = defaultdict(int); team_bank = defaultdict(int)
        for pu, ps in pstats.items():
            e = ps["economy"] or {}
            team_loadout[color_of[pu]] += e.get("loadoutValue", 0)
            team_spent[color_of[pu]] += e.get("spent", 0)
            team_bank[color_of[pu]] += e.get("remaining", 0)

        # --- kills in chronological order, with alive counts and revive handling
        raw = [k for ps in r["playerStats"] for k in ps["kills"]]
        raw.sort(key=lambda k: (k["timeSinceRoundStartMillis"], k["timeSinceGameStartMillis"]))
        alive = {pu: True for pu in color_of}
        kills = []
        for i, k in enumerate(raw):
            victim, killer = k["victim"], k["killer"]
            revived = not alive.get(victim, True)  # died twice -> was revived in between
            if revived:
                alive[victim] = True
            before = {c: sum(1 for pu, al in alive.items() if al and color_of[pu] == c) for c in ("Red", "Blue")}
            alive[victim] = False
            after = {c: sum(1 for pu, al in alive.items() if al and color_of[pu] == c) for c in ("Red", "Blue")}
            locs = {pl["puuid"]: pl for pl in (k.get("playerLocations") or [])}
            kl = locs.get(killer)
            fd = k["finishingDamage"]
            kc, vc = color_of.get(killer), color_of[victim]
            row = {
                "match_id": mid, "round_num": rn, "kill_idx": i,
                "t_round_ms": k["timeSinceRoundStartMillis"], "t_game_ms": k["timeSinceGameStartMillis"],
                "killer": killer, "victim": victim, "killer_color": kc, "victim_color": vc,
                "killer_side": side_of(kc, atk) if kc else None, "victim_side": side_of(vc, atk),
                "teamkill": kc == vc, "self_kill": killer == victim,
                "damage_type": fd["damageType"], "weapon_id": fd["damageItem"].lower(),
                "weapon": weapon_name(fd["damageItem"]) if fd["damageType"] == "Weapon" else fd["damageItem"] or fd["damageType"],
                "weapon_cat": weapon_cat(fd["damageItem"]) if fd["damageType"] == "Weapon" else fd["damageType"],
                "secondary_fire": fd["isSecondaryFireMode"],
                "assistants": [a for a in (k.get("assistants") or [])],
                "victim_x": k["victimLocation"]["x"], "victim_y": k["victimLocation"]["y"],
                "killer_x": kl["location"]["x"] if kl else None, "killer_y": kl["location"]["y"] if kl else None,
                "killer_view": kl["viewRadians"] if kl else None,
                "atk_alive_before": before[atk], "def_alive_before": before[dfn],
                "atk_alive_after": after[atk], "def_alive_after": after[dfn],
                "spike_planted_before": r["plantRoundTime"] > 0 and r["bombPlanter"] is not None and k["timeSinceRoundStartMillis"] > r["plantRoundTime"],
                "victim_was_revived": revived,
                "first_blood": i == 0,
                "traded": False, "traded_by": None, "trade_delay_ms": None, "is_trade": False,
            }
            kills.append(row)
            for pl in locs.values():
                T["positions"].append({"match_id": mid, "round_num": rn, "event": "kill", "event_idx": i, "t_round_ms": row["t_round_ms"],
                                       "puuid": pl["puuid"], "color": color_of.get(pl["puuid"]), "x": pl["location"]["x"], "y": pl["location"]["y"], "view": pl["viewRadians"]})

        # trades: victim's death is "traded" if a teammate kills the killer within TRADE_WINDOW_MS
        for a in kills:
            if a["teamkill"] or a["self_kill"] or a["killer_color"] is None:
                continue
            for b in kills:
                if b["kill_idx"] <= a["kill_idx"]:
                    continue
                dt = b["t_round_ms"] - a["t_round_ms"]
                if dt > TRADE_WINDOW_MS:
                    break
                if b["victim"] == a["killer"] and b["killer_color"] == a["victim_color"] and not b["teamkill"]:
                    a.update(traded=True, traded_by=b["killer"], trade_delay_ms=dt)
                    b["is_trade"] = True
                    break
        T["kills"].extend(kills)

        # --- clutches: first moment a team is down to 1 alive while enemies remain
        clutch = {}
        for kr in kills:
            for c, n_after in (("Red", kr["atk_alive_after"] if atk == "Red" else kr["def_alive_after"]),
                               ("Blue", kr["atk_alive_after"] if atk == "Blue" else kr["def_alive_after"])):
                enemy = kr["def_alive_after"] if c == atk else kr["atk_alive_after"]
                if c not in clutch and n_after == 1 and enemy >= 1:
                    # the remaining alive player of color c
                    dead = {x["victim"] for x in kills if x["kill_idx"] <= kr["kill_idx"]}
                    last = [pu for pu in color_of if color_of[pu] == c and pu not in dead]
                    if len(last) == 1:
                        clutch[c] = (last[0], enemy)

        # --- per-player round rows
        deaths = defaultdict(list)
        for kr in kills:
            deaths[kr["victim"]].append(kr)
        kills_by = defaultdict(int); assists_by = defaultdict(int)
        for kr in kills:
            if not kr["teamkill"] and not kr["self_kill"]:
                kills_by[kr["killer"]] += 1
                for a in kr["assistants"]:
                    assists_by[a] += 1
        fb = next((kr for kr in kills if not kr["teamkill"] and not kr["self_kill"]), None)
        for pu, ps in pstats.items():
            c = color_of[pu]
            e = ps["economy"] or {}
            dmg = [x for x in (ps.get("damage") or []) if color_of.get(x["receiver"]) and color_of[x["receiver"]] != c]
            for x in ps.get("damage") or []:
                T["damage"].append({"match_id": mid, "round_num": rn, "dealer": pu, "receiver": x["receiver"], "damage": x["damage"],
                                    "headshots": x["headshots"], "bodyshots": x["bodyshots"], "legshots": x["legshots"],
                                    "friendly": color_of.get(x["receiver"]) == c})
            my_deaths = deaths.get(pu, [])
            final_death = my_deaths[-1] if my_deaths else None
            cl = clutch.get(c)
            T["player_round"].append({
                "match_id": mid, "round_num": rn, "puuid": pu, "team_color": c, "side": side_of(c, atk),
                "won_round": c == win_color,
                "loadout": e.get("loadoutValue", 0), "spent": e.get("spent", 0), "bank": e.get("remaining", 0),
                # empty = no weapon recorded (the "" key in the catalog is only for kills, see meta.py)
                "weapon": weapon_name(e["weapon"]) if e.get("weapon") else None, "weapon_cat": weapon_cat(e["weapon"]) if e.get("weapon") else None,
                "armor": LOOKUP["gear"].get((e.get("armor") or "").lower(), {}).get("name"),
                "kills": kills_by[pu], "assists": assists_by[pu], "died": bool(my_deaths),
                "survived": final_death is None,
                "traded": bool(final_death and final_death["traded"]),
                "damage": sum(x["damage"] for x in dmg),
                "headshots": sum(x["headshots"] for x in dmg), "bodyshots": sum(x["bodyshots"] for x in dmg), "legshots": sum(x["legshots"] for x in dmg),
                "score": ps["score"],
                "first_kill": bool(fb and fb["killer"] == pu), "first_death": bool(fb and fb["victim"] == pu),
                "clutch_vs": cl[1] if cl and cl[0] == pu else 0,
                "clutch_won": bool(cl and cl[0] == pu and c == win_color),
                "planted": r["bombPlanter"] == pu, "defused": r["bombDefuser"] == pu,
            })

        for ev, locs in (("plant", r.get("plantPlayerLocations")), ("defuse", r.get("defusePlayerLocations"))):
            for pl in locs or []:
                T["positions"].append({"match_id": mid, "round_num": rn, "event": ev, "event_idx": -1,
                                       "t_round_ms": r["plantRoundTime"] if ev == "plant" else r["defuseRoundTime"],
                                       "puuid": pl["puuid"], "color": color_of.get(pl["puuid"]), "x": pl["location"]["x"], "y": pl["location"]["y"], "view": pl["viewRadians"]})

        planted = r["bombPlanter"] is not None
        # data anomaly: round ended by elimination but the loser still had players alive (e.g. 'Crush' map-bug deaths)
        loser_alive = (kills[-1]["def_alive_after"] if win_color == atk else kills[-1]["atk_alive_after"]) if kills else 5
        anomalous = (r["roundResultCode"] == "Elimination" and loser_alive > 0) or any(kr["damage_type"] == "Crush" for kr in kills)
        T["rounds"].append({
            "match_id": mid, "round_num": rn, "half": half_of(rn),
            "attacker_color": atk, "defender_color": dfn,
            "attacker": name_of[atk], "defender": name_of[dfn],
            "winner_color": win_color, "winner": name_of[win_color], "winner_side": side_of(win_color, atk),
            "result": r["roundResult"], "result_code": r["roundResultCode"] or "Timer",
            "score_atk_before": score[atk], "score_def_before": score[dfn],
            "planted": planted, "plant_time_ms": r["plantRoundTime"] if planted else None, "plant_site": r["plantSite"] or None,
            "planter": r["bombPlanter"], "plant_x": r["plantLocation"]["x"] if planted else None, "plant_y": r["plantLocation"]["y"] if planted else None,
            "defused": r["bombDefuser"] is not None, "defuse_time_ms": r["defuseRoundTime"] or None, "defuser": r["bombDefuser"],
            "atk_loadout": team_loadout[atk], "def_loadout": team_loadout[dfn],
            "atk_spent": team_spent[atk], "def_spent": team_spent[dfn],
            "atk_bank": team_bank[atk], "def_bank": team_bank[dfn],
            "atk_buy": buy_type(team_loadout[atk], rn), "def_buy": buy_type(team_loadout[dfn], rn),
            "n_kills": len(kills),
            "first_blood_side": fb["killer_side"] if fb else None,
            "anomalous": anomalous,
        })
        score[win_color] += 1


def validate(T):
    issues = []
    pm = pd.DataFrame(T["player_match"]); pr = pd.DataFrame(T["player_round"]); rd = pd.DataFrame(T["rounds"]); kl = pd.DataFrame(T["kills"])
    # scoreboard kills (Riot) vs kills recomputed from events (teamkills / self-kills excluded on our side)
    k = pr.groupby(["match_id", "puuid"])["kills"].sum().rename("k_ev")
    j = pm.set_index(["match_id", "puuid"]).join(k)
    diff = (j["kills"] - j["k_ev"]).abs()
    issues.append(f"player-match kill mismatches: {(diff > 0).sum()} rows (max diff {diff.max()})")
    # elimination rounds: the losing side must end with 0 alive
    last = kl.sort_values("kill_idx").groupby(["match_id", "round_num"]).tail(1).set_index(["match_id", "round_num"])
    el = rd[rd.result_code == "Elimination"].set_index(["match_id", "round_num"]).join(last[["atk_alive_after", "def_alive_after"]])
    bad = el[((el.winner_side == "Ataque") & (el.def_alive_after != 0)) | ((el.winner_side == "Defesa") & (el.atk_alive_after != 0))]
    issues.append(f"elimination rounds where loser still alive: {len(bad)} / {len(el)}")
    issues.append(f"revived-victim kills: {int(kl.victim_was_revived.sum())}")
    issues.append(f"negative alive counts: {int((kl[['atk_alive_after','def_alive_after']] < 0).any(axis=1).sum())}")
    issues.append(f"trade rate (deaths traded within {TRADE_WINDOW_MS} ms): {kl.traded.mean():.1%}")
    return issues


def main(data_root):
    data_root = Path(data_root)
    T = defaultdict(list)
    files = sorted(data_root.rglob("*.json"))
    for f in files:
        parse_match(f, data_root, T)
    OUT.mkdir(parents=True, exist_ok=True)
    for name, rows in T.items():
        df = pd.DataFrame(rows)
        if name == "kills":
            df["assistants"] = df["assistants"].apply(lambda xs: ",".join(xs))
        df.to_parquet(OUT / f"{name}.parquet", index=False)
        print(f"{name:13s} {len(df):>8,d} rows")
    for line in validate(T):
        print("CHECK", line)


if __name__ == "__main__":
    main(sys.argv[1])
