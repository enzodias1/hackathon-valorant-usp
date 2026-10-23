"""Exports precomputed JSON for the web app into web/public/data/ (format documented in web/DADOS.md).

  index.json                 matches, teams and players lists for navigation/search
  league.json                league-wide references
  matches/<match_id>.json    one match: players, rounds, events with win probability, everyone's positions/view for the replay
  teams/<slug>.json          one team: metrics vs league + insights, maps, economy, roster, synergy graph, decisive rounds
  players/<puuid>.json       one player: impact, role, percentiles, agents, maps, matches, best/worst moments, partners, insights

Win probabilities in match files are from the RED team's perspective (wp_red = P(Red wins the round)).
"""
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

from insights import (MIN_N, NOISE_METRICS, PLAYER_TEXT, TEAM_METRICS, TEAM_TEXT, Z_SIGNIFICANT, bh_adjust, binom, br, make_insights,
                      mean_test, pct, pp, team_counts)

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / "data" / "processed"
OUT = ROOT / "web" / "public" / "data"
LOOKUP = json.loads((ROOT / "data" / "meta" / "lookup.json").read_text(encoding="utf-8"))
SHEET = ROOT / "para_equipe" / "nomes_dos_times.xlsx"
# team annotations on the replay (things the data cannot show, e.g. an ultimate teleport inside a long gap); always labeled as such
NOTES = json.loads((ROOT / "data" / "meta" / "replay_notes.json").read_text(encoding="utf-8"))
AXES = ["Entry", "Support", "Lurker", "Clutch", "Impacto"]
PERCENTILE_COLS = ["kd", "kpr", "adr", "acs", "kast", "hs_pct", "wpa_per_round", "opening_rate", "clutch_rate"]
# finishingDamage.damageItem of ability kills (lowercased in kills.weapon_id) -> slot in the agent metadata
ABILITY_SLOT = {"ability1": "Ability1", "ability2": "Ability2", "grenadeability": "Grenade", "ultimate": "Ultimate"}
# kills that are neither a weapon nor an ability: (label, kind)
OTHER_KILL = {"Bomb": ("Spike", "spike"), "Fall": ("Queda", "fall"), "Melee": ("Faca", "melee"), "Crush": ("Esmagamento", "other")}
# player page: duels (who killed whom) and when in the round the player dies (asked for in the player interviews)
MIN_H2H = 3  # duels with the same opponent to list them
MIN_DUELS_AGENT = 10  # duels against an enemy agent to compare it
DEATH_BINS = [0, 15, 30, 45, 60, 75, 90, 1000]  # seconds since the barrier dropped
EARLY_DEATH_S = 20
MIN_DEATHS_TIMING = 25
# abilities used (totals per match from the Riot data; there is no per-moment usage): per round (C, Q, E) and ultimates per map
CAST_SLOTS = {"C": ("casts_c", "Grenade"), "Q": ("casts_q", "Ability1"), "E": ("casts_e", "Ability2")}
MIN_MAPS_ABILITIES = 2


def team_names():
    """slug -> {name, tag, institution}: the filled spreadsheet wins over the automatic suggestion."""
    df = pd.read_excel(SHEET)
    cols = list(df.columns)
    slug, sug, fix, tag, inst = cols[0], cols[1], cols[2], cols[3], cols[4]
    out = {}
    for r in df.itertuples(index=False):
        vals = dict(zip(cols, r))
        filled = lambda c: isinstance(vals[c], str) and vals[c].strip()
        name = vals[fix].strip() if filled(fix) else vals[sug]
        out[vals[slug]] = {"name": name, "tag": vals[tag].strip() if filled(tag) else name,
                           "institution": vals[inst].strip() if filled(inst) else None}
    return out


def clean(o):
    """NaN -> None, numpy -> python, round floats."""
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple, np.ndarray)):
        return [clean(v) for v in o]
    if hasattr(o, "item"):
        o = o.item()
    if isinstance(o, float):
        return None if math.isnan(o) or math.isinf(o) else (round(o, 4) if abs(o) >= 1e-3 else float(f"{o:.4g}"))
    return o


def write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(clean(obj), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def load():
    names = ["matches", "player_match", "rounds", "kills", "wp_events", "wp_states", "wp_credits", "player_round",
             "player_profile", "pairs", "team_rounds", "death_context"]
    t = {n: pd.read_parquet(P / f"{n}.parquet") for n in names}
    team_of = t["player_match"].set_index(["match_id", "puuid"])["team"]
    t["death_context"]["team"] = team_of.reindex(pd.MultiIndex.from_frame(t["death_context"][["match_id", "victim"]])).to_numpy()
    t["wp_credits"]["team"] = team_of.reindex(pd.MultiIndex.from_frame(t["wp_credits"][["match_id", "puuid"]])).to_numpy()
    t["player_round"]["team"] = team_of.reindex(pd.MultiIndex.from_frame(t["player_round"][["match_id", "puuid"]])).to_numpy()
    t["team_rounds"] = t["team_rounds"][t["team_rounds"].team.notna()]
    t["player_name"] = t["player_match"].sort_values("match_id").groupby("puuid").name.last().to_dict()
    t["agents_by_name"] = {a["name"]: a for a in LOOKUP["agents"].values()}
    add_kill_labels(t)
    # A Riot deixou de contar a ultimate do Chamber a partir do patch 13.02, o mesmo em que a Tour de Force perdeu o ID: nesses
    # mapas a contagem cai de ~1,8 para ~0,4 por mapa e vem zerada em 64–79% deles, mesmo com kills de ultimate (nenhum outro
    # agente tem isso: em 503 mapas com kill de ultimate, a contagem nunca vem zerada). Nesses mapas a contagem fica de fora e
    # o placar mostra só o mínimo garantido: os rounds em que ele matou com a Tour de Force.
    pmx = t["player_match"]
    ver = pmx.match_id.map(t["matches"].set_index("match_id").game_version).str.extract(r"(\d+)\.(\d+)").astype(int)
    pmx["ult_ok"] = ~((pmx.agent == "Chamber") & ((ver[0] > 13) | ((ver[0] == 13) & (ver[1] >= 2)))).to_numpy()
    tdf = t["kills"][t["kills"].weapon == "Tour de Force"].groupby(["match_id", "killer"]).round_num.nunique()
    pmx["ult_rounds"] = tdf.reindex(pd.MultiIndex.from_frame(pmx[["match_id", "puuid"]])).fillna(0).astype(int).to_numpy()
    for n in ("team_strength", "team_stage", "team_changes", "player_stage", "economy_team"):
        t[n] = pd.read_parquet(P / f"{n}.parquet")
    t["economy"] = json.loads((P / "economy.json").read_text(encoding="utf-8"))
    t["wpa_pm"] = t["wp_credits"].groupby(["match_id", "puuid"]).wpa.sum() * 100
    return t


def add_kill_labels(t):
    """kills.weapon_label / weapon_icon / kill_kind: what killed, readable (weapon, the agent's ability in PT, spike, fall...)."""
    k = t["kills"]
    agent = t["player_match"].set_index(["match_id", "puuid"]).agent
    labels = []
    for r in k[["match_id", "killer", "damage_type", "weapon_id"]].itertuples(index=False):
        if r.damage_type == "Weapon":
            w = LOOKUP["weapons"].get(r.weapon_id)
            kind = "weapon" if not w or w["category"] not in ("Ability", "Melee") else w["category"].lower()
            labels.append((w["name"], w["icon"], kind) if w else (None, None, "weapon"))
        elif r.damage_type == "Ability":
            a = t["agents_by_name"].get(agent.get((r.match_id, r.killer)), {})
            ab = a.get("abilities", {}).get(ABILITY_SLOT.get(r.weapon_id), {})
            labels.append((ab.get("name"), ab.get("icon"), "ability"))
        else:
            label, kind = OTHER_KILL.get(r.damage_type, (None, "other"))
            labels.append((label, None, kind))
    k["weapon_label"], k["weapon_icon"], k["kill_kind"] = zip(*labels)


# ----------------------------------------------------------------------------------------------- matches
def export_matches(t, names):
    m, pm, rd, kl, ev, st, pr = (t[k] for k in ("matches", "player_match", "rounds", "kills", "wp_events", "wp_states", "player_round"))
    adr = pr.groupby(["match_id", "puuid"]).damage.mean()
    # replay: everyone alive at each kill/plant/defuse (the victim of a kill comes in victim_xy); view in radians, game axes
    pos = pd.read_parquet(P / "positions.parquet")
    pos["view"] = pos["view"].round(2)
    pos_by = {k: g for k, g in pos.groupby("match_id")}
    agent_of = pm.set_index(["match_id", "puuid"]).agent.to_dict()
    gear_by = {k: g.set_index(["round_num", "puuid"]) for k, g in pr.groupby("match_id")}
    weapon_icon = {w["name"]: w["icon"] for w in LOOKUP["weapons"].values() if w.get("icon")}
    p0 = st[st.kind == "start"].set_index(["match_id", "round_num"]).p_atk
    margin_after = st.dropna(subset=["elim_margin"]).set_index(["match_id", "round_num", "seq"]).elim_margin.to_dict()
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
            a = t["agents_by_name"].get(p.agent, {})
            players.append({
                "puuid": p.puuid, "name": p.name, "color": p.team_color, "agent": p.agent, "agent_icon": a.get("icon"),
                "minimap_icon": a.get("minimap_icon"), "role": p.role,
                # C, Q, E, ultimate in this match (ultimate None where the Riot does not count it: Chamber from 13.02)
                "casts": [int(p.casts_c), int(p.casts_q), int(p.casts_e), int(p.casts_x) if p.ult_ok else None],
                **({} if p.ult_ok else {"ult_min": int(p.ult_rounds)}),
                "kills": p.kills, "deaths": p.deaths, "assists": p.assists, "acs": p.score / max(p.rounds, 1),
                "adr": adr.get((mid, p.puuid)), "wpa": t["wpa_pm"].get((mid, p.puuid), 0.0),
            })
        pidx = {p["puuid"]: i for i, p in enumerate(players)}
        # (round, event, event_idx) -> [[player index, x, y, view], ...]
        frames = {k: [[pidx[u], int(x), int(y), v] for u, x, y, v in zip(g.puuid, g.x, g.y, g.view) if u in pidx]
                  for k, g in pos_by[mid].groupby(["round_num", "event", "event_idx"])}
        gear = gear_by[mid]
        used_weapons = set()
        pname = {p["name"]: i for i, p in enumerate(players)}
        notes = {}
        for nt in NOTES:
            if nt["match_id"] == mid and nt["player"] in pname:
                notes.setdefault(nt["round"], []).append({"player": pname[nt["player"]], "from": nt["from_ms"], "to": nt["to_ms"],
                                                          "kind": nt["kind"], "label": nt["label"], "why": nt["why"], "by": nt["by"]})
        rounds = []
        for r in rd_by[mid].sort_values("round_num").itertuples(index=False):
            key = (mid, r.round_num)
            red_is_atk = r.attacker_color == "Red"
            to_red = (lambda p: p) if red_is_atk else (lambda p: 1 - p)
            events = []
            kg = kl_by.get(key)
            for e in ev_by.get(key, pd.DataFrame()).itertuples(index=False):
                if e.event == "revive":
                    # ressurreição (ultimate da Sage num aliado ou da Clove nela mesma): aconteceu desde o registro anterior
                    ab = t["agents_by_name"].get(agent_of.get((mid, e.actor)), {}).get("abilities", {}).get("Ultimate", {})
                    events.append({"t": e.t_round_ms, "type": "revive", "actor": e.actor, "target": e.target,
                                   "from": max([x["t"] for x in events if x["type"] != "revive"], default=0),
                                   "weapon": ab.get("name"), "weapon_icon": ab.get("icon"),
                                   "wp_red_before": to_red(e.p_atk_before), "wp_red_after": to_red(e.p_atk_after), "wpa": e.wpa * 100,
                                   "after_round_end": bool(e.post_end), "pos": []})
                    continue
                item = {"t": e.t_round_ms, "type": e.event, "actor": e.actor, "wp_red_before": to_red(e.p_atk_before),
                        "wp_red_after": to_red(e.p_atk_after), "wpa": e.wpa * 100, "after_round_end": bool(e.post_end)}
                if e.event == "kill":
                    k = kg.loc[int(e.kill_idx)]
                    margin = margin_after.get((mid, r.round_num, e.post_seq), np.nan)
                    if k.victim_side == "Ataque" and not e.post_end and not pd.isna(margin):
                        # último atacante morto com a spike plantada: folga para desarmar (tempo − corrida até a spike − 7 s)
                        item["defuse_margin"] = round(float(margin), 1)
                    item.update({"victim": e.victim, "weapon": k.weapon_label, "weapon_icon": k.weapon_icon, "kill_kind": k.kill_kind,
                                 "first_blood": bool(k.first_blood),
                                 "traded": bool(k.traded), "is_trade": bool(k.is_trade), "teamkill": bool(k.teamkill),
                                 "victim_xy": [k.victim_x, k.victim_y], "killer_xy": None if pd.isna(k.killer_x) else [k.killer_x, k.killer_y],
                                 "assistants": [a for a in k.assistants.split(",") if a]})
                item["pos"] = frames.get((r.round_num, e.event, int(e.kill_idx) if e.event == "kill" else -1), [])
                events.append(item)
            # what each player carried (aligned with `players`): [weapon, armor, loadout value]
            round_gear = []
            for p in players:
                g = gear.loc[(r.round_num, p["puuid"])] if (r.round_num, p["puuid"]) in gear.index else None
                round_gear.append(None if g is None else [g.weapon if isinstance(g.weapon, str) else None,
                                                          g.armor if isinstance(g.armor, str) else None, int(g.loadout)])
                if g is not None and isinstance(g.weapon, str):
                    used_weapons.add(g.weapon)
            rounds.append({
                "n": r.round_num + 1, "half": r.half, "attacker": r.attacker_color, "winner": r.winner_color, "result": r.result_code,
                "score_before": {r.attacker_color: r.score_atk_before, r.defender_color: r.score_def_before},
                "buy": {r.attacker_color: r.atk_buy, r.defender_color: r.def_buy},
                "loadout": {r.attacker_color: r.atk_loadout, r.defender_color: r.def_loadout},
                "wp_red_start": to_red(p0[key]),
                "plant": {"t": r.plant_time_ms, "site": r.plant_site, "by": r.planter, "xy": [r.plant_x, r.plant_y]} if r.planted else None,
                "defuse": {"t": r.defuse_time_ms, "by": r.defuser} if r.defused else None,
                "anomalous": bool(r.anomalous), "events": events, "gear": round_gear, "notes": notes.get(r.round_num + 1, []),
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
            "weapon_icons": {w: weapon_icon[w] for w in sorted(used_weapons) if w in weapon_icon},
        }
        write(OUT / "matches" / f"{mid}.json", doc)
        index.append({"id": mid, "date": doc["date"], "competition": mt.competition, "stage": mt.stage, "map": mt.map,
                      "red": mt.team_red, "blue": mt.team_blue, "score": doc["score"], "winner": doc["winner"]})
    return index


# ----------------------------------------------------------------------------------------------- teams
def export_teams(t, names):
    tr, dc, pf, pairs, m = t["team_rounds"], t["death_context"], t["player_profile"], t["pairs"], t["matches"]
    league_counts = team_counts(tr, dc)
    league_rate = {k: (s / n if n else np.nan) for k, (s, n) in league_counts.items()}
    league_buy = tr.groupby("buy").won.mean()
    league_map_atk = tr[tr.side == "Ataque"].groupby("map").won.mean()
    league_pair_trade = pairs.b_traded_a.sum() / pairs.a_deaths_b_alive.sum()
    pm = t["player_match"]
    acs = pm.groupby(["puuid", "team"]).agg(score=("score", "sum"), rounds=("rounds", "sum"))
    pf = pf.join((acs.score / acs.rounds).rename("acs"), on=["puuid", "team"])
    t["player_profile"] = pf

    summary = []
    for slug, g in tr.groupby("team"):
        d = dc[dc.team == slug]
        counts = team_counts(g, d)
        comps = {k: binom(s, n, league_rate[k], TEAM_METRICS[k][1]) for k, (s, n) in counts.items()}

        # rounds won above what the economy (model, round start) predicted
        W, E, var = g.won.sum(), g.p0.sum(), (g.p0 * (1 - g.p0)).sum()
        z = (W - E) / math.sqrt(var) if var > 0 else 0.0
        wae = {"wins": int(W), "expected": float(E), "diff": float(W - E), "per100": float((W - E) / len(g) * 100), "z": z, "n": len(g),
               "significant": bool(abs(z) >= Z_SIGNIFICANT and len(g) >= 15)}
        wae["good"] = (z > 0) if wae["significant"] else None

        buys = []
        for b, gb in g.groupby("buy"):
            Wb, Eb, vb = gb.won.sum(), gb.p0.sum(), (gb.p0 * (1 - gb.p0)).sum()
            zb = (Wb - Eb) / math.sqrt(vb) if vb > 0 else 0.0
            sig = bool(abs(zb) >= Z_SIGNIFICANT and len(gb) >= 15)
            buys.append({"buy": b, "rounds": len(gb), "n": len(gb), "win": gb.won.mean(), "expected": gb.p0.mean(),
                         "league_win": league_buy.get(b), "z": zb, "significant": sig, "good": (zb > 0) if sig else None})

        # every claim on the team page is one family for multiple-testing control (Benjamini-Hochberg)
        for k in NOISE_METRICS & comps.keys():  # no between-team signal: shown in tables, never a claim
            comps[k].update(significant=False, good=None)
        bh_adjust({**{k: c for k, c in comps.items() if k not in NOISE_METRICS}, "wins_above_expected": wae, **{f"buy:{b['buy']}": b for b in buys}})
        metrics = [{"key": k, "label": TEAM_METRICS[k][0], "higher_is_better": TEAM_METRICS[k][1], **c} for k, c in comps.items()]
        ins = make_insights(comps, TEAM_TEXT, higher_is_better={k: v[1] for k, v in TEAM_METRICS.items()})

        if wae["significant"]:
            item = {"key": "wins_above_expected", "z": round(z, 2), "n": len(g)}
            if z > 0:
                ins["strengths"].insert(0, {**item, "text": f"Vencem {W - E:.0f} rounds a mais do que a economia previa ({br(wae['per100'])} a cada 100 rounds): decisões e duelos rendem acima do equipamento."})
            else:
                ins["weaknesses"].insert(0, {**item, "text": f"Vencem {E - W:.0f} rounds a menos do que a economia previa ({br(wae['per100'])} a cada 100 rounds).",
                                             "tip": "Compare a tabela de economia: em qual tipo de compra o time rende abaixo do esperado?"})
        ins["strengths"], ins["weaknesses"] = ins["strengths"][:4], ins["weaknesses"][:4]
        # todo time mostra os dois lados, mesmo sem nada confirmado (métricas com 15+ casos; o diagnóstico compara com a média
        # da liga, então "nada abaixo da média" não quer dizer "time perfeito"):
        # - sem ponto fraco nem atenção: as 4 métricas de menos folga em relação à média;
        # - sem ponto forte: onde o time mais se destaca, ainda dentro do acaso (ou que não fica à frente em nenhuma).
        # Os textos dizem que não são confirmados; o primeiro item ("intro") é a frase de abertura do grupo.
        used = {x["key"] for part in ("strengths", "weaknesses", "attention") for x in ins[part]}
        # ordem pela diferença relativa para a liga, no sentido bom da métrica (+20% = 20% melhor que a liga), e não pelo z: com
        # poucos casos (pistols, 2 por mapa) até 78% × 50% tem z baixo e pareceria "perto da média"
        def gap(k, c):
            g = (c["value"] - c["league"]) / c["league"] if c["league"] else 0.0
            return g if TEAM_METRICS[k][1] else -g
        cand = sorted(((gap(k, c), k, c) for k, c in comps.items()
                       if k in TEAM_TEXT and k not in NOISE_METRICS and k not in used
                       and c.get("z") is not None and c.get("value") is not None and c["n"] >= MIN_N), key=lambda x: x[0])
        line = lambda g, k, c: {"key": k, "z": round(c["z"], 2), "n": int(c["n"]), "text": f"{TEAM_METRICS[k][0]}: {pct(c['value'])} (liga: {pct(c['league'])})."}
        intro = lambda text: {"key": "intro", "z": None, "text": text}
        # primeiro onde o time se destaca (só métricas à frente da liga), depois as de menos folga com o que sobrou: assim uma
        # métrica não aparece nos dois grupos, e "não fica à frente em nenhuma" só sai quando é verdade
        if not ins["strengths"]:
            ahead = [x for x in reversed(cand) if x[0] > 0 and pct(x[2]["value"]) != pct(x[2]["league"])][:4]
            if ahead:
                ins["neutral_pos"] = [intro("Nenhuma vantagem passou no teste estatístico. As maiores a favor do time:")] + [line(*x) for x in ahead]
            elif cand:
                ins["neutral_pos"] = [intro("Em nenhuma métrica o time fica à frente da liga.")]
            else:
                ins["neutral_pos"] = [intro("Poucos rounds para comparar com a liga.")]
            cand = [x for x in cand if x not in ahead]
        if not ins["weaknesses"] and not ins["attention"]:
            ins["neutral"] = ([intro("Nenhuma desvantagem passou no teste estatístico. As métricas mais perto da média (ou abaixo dela, dentro do acaso):")]
                              + [line(*x) for x in cand[:4]] if cand else [intro("Nenhuma desvantagem passou no teste estatístico.")])

        order = ["Pistol", "Eco", "Meia compra", "Forçado", "Full buy"]
        buys.sort(key=lambda x: order.index(x["buy"]) if x["buy"] in order else 99)

        maps = []
        for mp_name, gm in g.groupby("map"):
            mids = gm.match_id.unique()
            mm = m[m.match_id.isin(mids)]
            maps.append({"map": mp_name, "maps": len(mids), "map_wins": int((mm.winner == slug).sum()), "rounds": len(gm),
                         "round_win": gm.won.mean(), "atk_win": gm[gm.side == "Ataque"].won.mean(), "def_win": gm[gm.side == "Defesa"].won.mean(),
                         "league_atk_win": league_map_atk.get(mp_name)})
        maps.sort(key=lambda x: -x["maps"])

        team_rounds_n = len(g)
        roster_df = pf[pf.team == slug].sort_values("rounds", ascending=False)
        roster = []
        for p in roster_df.itertuples(index=False):
            roster.append({
                "puuid": p.puuid, "name": p.name, "rounds": p.rounds, "maps": p.maps, "agents": list(p.top_agents),
                "agent_role": p.main_agent_role,
                "kd": p.kd, "acs": p.acs, "adr": p.adr, "kast": p.kast, "wpa_per_round": p.wpa_per_round,
                "fk": p.fk, "fd": p.fd, "traded_death_rate": p.traded_death_rate, "isolated_death_rate": p.isolated_death_rate,
                "core": bool(p.rounds >= 0.2 * team_rounds_n),
            })

        core = {r["puuid"] for r in roster if r["core"]}
        pt = pairs[(pairs.team == slug) & pairs.a.isin(core) & pairs.b.isin(core)].set_index(["a", "b"])
        edges, seen = [], set()
        for (a, b) in pt.index:
            if (b, a) in seen or (a, b) in seen:
                continue
            seen.add((a, b))
            ab, ba = pt.loc[(a, b)], pt.loc[(b, a)] if (b, a) in pt.index else None
            get = lambda row, c: float(row[c]) if row is not None and pd.notna(row[c]) else 0.0
            deaths = get(ab, "a_deaths_b_alive") + get(ba, "a_deaths_b_alive")
            trades = get(ab, "b_traded_a") + get(ba, "b_traded_a")
            if get(ab, "rounds_together") < 20:
                continue
            edges.append({
                "a": a, "b": b, "rounds_together": get(ab, "rounds_together"),
                "b_traded_a": get(ab, "b_traded_a"), "a_traded_b": get(ba, "b_traded_a"),
                "a_deaths_b_alive": get(ab, "a_deaths_b_alive"), "b_deaths_a_alive": get(ba, "a_deaths_b_alive"),
                "b_assists_on_a": get(ab, "b_assists_on_a"), "a_assists_on_b": get(ba, "b_assists_on_a"),
                "trade_rate": trades / deaths if deaths else None,
                "trade_z": binom(trades, deaths, league_pair_trade)["z"] if deaths else None,
                "assists": get(ab, "b_assists_on_a") + get(ba, "b_assists_on_a"),
            })
        synergy = {"nodes": [{"puuid": r["puuid"], "name": r["name"], "agent_role": r["agent_role"], "rounds": r["rounds"]}
                             for r in roster if r["core"]],
                   "edges": edges, "league_pair_trade_rate": league_pair_trade}

        def decisive(df, col, asc):
            out = []
            for r in df.sort_values(col, ascending=asc).head(10).itertuples(index=False):
                out.append({"match_id": r.match_id, "round": r.round_num + 1, "map": r.map, "opponent": r.opponent,
                            "opponent_name": names.get(r.opponent, {}).get("name", r.opponent), "side": r.side, "wp": getattr(r, col)})
            return out

        mlist = []
        mm = m[(m.team_red == slug) | (m.team_blue == slug)].sort_values("date")
        for x in mm.itertuples(index=False):
            red = x.team_red == slug
            opp = x.team_blue if red else x.team_red
            mlist.append({"id": x.match_id, "date": x.date.isoformat(), "competition": x.competition, "stage": x.stage, "map": x.map,
                          "opponent": opp, "opponent_name": names.get(opp, {}).get("name", opp),
                          "score_for": x.rounds_red if red else x.rounds_blue, "score_against": x.rounds_blue if red else x.rounds_red,
                          "won": x.winner == slug})

        info = names.get(slug, {"name": slug, "tag": slug, "institution": None})
        doc = {
            "slug": slug, **info,
            "record": {"maps": len(mlist), "map_wins": sum(x["won"] for x in mlist), "rounds": team_rounds_n, "round_win": g.won.mean()},
            "metrics": metrics, "wins_above_expected": wae, "insights": ins,
            "maps": maps, "buys": buys, "roster": roster, "synergy": synergy,
            "decisive": {"throws": decisive(g[g.throw], "wp_max", False), "comebacks": decisive(g[g.comeback], "wp_min", True)},
            "matches": mlist,
            "strength": team_strength(t, slug),
            "economy": team_economy(t, slug),
            "evolution": team_evolution(t, slug, [r["puuid"] for r in roster if r["core"]]),
        }
        write(OUT / "teams" / f"{slug}.json", doc)
        summary.append({"slug": slug, "name": info["name"], "tag": info["tag"], "maps": len(mlist), "map_wins": doc["record"]["map_wins"],
                        "rounds": team_rounds_n, "round_win": doc["record"]["round_win"],
                        "competitions": sorted({x["competition"] for x in mlist}),
                        "strength_rank": doc["strength"]["rank"], "strength": doc["strength"]["p_vs_avg"]})
    league = {"team_rates": league_rate, "buy_win": league_buy.to_dict(), "map_atk_win": league_map_atk.to_dict(),
              "pair_trade_rate": league_pair_trade}
    return summary, league


def team_strength(t, slug):
    s = t["team_strength"].set_index("team")
    r = s.loc[slug]
    return {"theta": float(r.theta), "p_vs_avg": float(r.p_vs_avg), "rank": int(r["rank"]), "of": int(len(s)),
            "reliable": bool(r.rounds >= 100)}


ECON_TEXT = {
    "perdeu o pistol": "Depois de perder o pistol",
    "perdeu o round anterior": "Depois de perder um round sem dinheiro para full buy",
}


def team_economy(t, slug):
    """What the team did when it could not afford a full buy, and what happened next. Descriptive only:
    the league-wide "force vs save" comparison is not shown as a recommendation (observational, few force cases)."""
    lg, et = t["economy"]["contexts"], t["economy_team"]
    verb = {"Eco": "fez eco", "Meia compra": "fez meia compra", "Forçado": "forçou"}
    out = []
    for ctx in lg:
        rows = et[(et.team == slug) & (et.context == ctx)]
        n = int(rows.n.sum())
        decisions = {r.decision: {"n": int(r.n), "win_now": r.wins / r.n, "rounds_next3": None if pd.isna(r.rounds_next3) else float(r.rounds_next3)}
                     for r in rows.itertuples(index=False)}
        text = None
        if n >= 5:
            mine = max(decisions, key=lambda k: decisions[k]["n"])
            text = f"{ECON_TEXT[ctx]}, o time {verb[mine]} em {decisions[mine]['n']} de {n} vezes."
        out.append({"context": ctx, "label": ECON_TEXT[ctx], "n": n, "decisions": decisions, "insight": text})
    return out


def team_evolution(t, slug, core):
    st = t["team_stage"][t["team_stage"].team == slug].sort_values("etapa_idx")
    ch = t["team_changes"][t["team_changes"].team == slug]
    stages = [{"etapa": r.etapa, "date": r.date.isoformat(), "maps": int(r.maps), "rounds": int(r.rounds), "round_win": r.round_win,
               "opp_strength": float(1 / (1 + math.exp(-r.opp_theta))), "above_level_per100": r.above_level_per100,
               "above_level_se100": r.above_level_se100, "above_level_z": r.above_level_z,
               "traded_death_rate": r.traded_death_rate, "isolated_death_rate": r.isolated_death_rate} for r in st.itertuples(index=False)]
    changes = []
    if len(ch):
        fam = {r.key: {"z": float(r.z), "n": int(min(r.n_before, r.n_after)), "significant": bool(abs(r.z) >= Z_SIGNIFICANT),
                       "good": bool(r.improved) if abs(r.z) >= Z_SIGNIFICANT else None} for r in ch.itertuples(index=False)}
        bh_adjust(fam)
        for r in ch.itertuples(index=False):
            c = fam[r.key]
            harder = r.opp_theta_after - r.opp_theta_before > 0.2
            item = {"key": r.key, "label": r.label, "higher_is_better": bool(r.higher_is_better), "before": r.before, "after": r.after,
                    "n_before": int(r.n_before), "n_after": int(r.n_after), "z": float(r.z), "significant": c["significant"],
                    "improved": bool(r.improved), "harder_opponents": bool(harder)}
            if c["significant"]:
                fmt = (lambda x: f"{br(x, '+.1f')}") if r.key == "above_level" else pct
                item["text"] = (f"{'Melhorou' if r.improved else 'Piorou'}: {r.label.lower()} passou de {fmt(r.before)} para {fmt(r.after)}"
                                f"{', mesmo enfrentando adversários mais fortes' if harder and r.improved else ''} (já descontada a força dos adversários).")
            changes.append(item)
        meta = ch.iloc[0]
        periods = {"before": meta.period_before, "after": meta.period_after, "maps_before": int(meta.maps_before), "maps_after": int(meta.maps_after)}
    else:
        periods = None
    ps = t["player_stage"]
    players = []
    for pu in core:
        x = ps[(ps.puuid == pu) & (ps.team == slug)].sort_values("etapa_idx")
        if len(x):
            players.append({"puuid": pu, "name": t["player_name"].get(pu), "stages": [{"etapa": r.etapa, "rounds": int(r.rounds), "wpa_per_round": r.wpa_per_round}
                                                                                         for r in x.itertuples(index=False)]})
    return {"available": periods is not None, "periods": periods, "stages": stages,
            "changes": sorted(changes, key=lambda c: (not c["significant"], -abs(c["z"]))), "players": players}


# ----------------------------------------------------------------------------------------------- players
MIN_ROUNDS_ROLE = 60  # o mesmo de team.py: a partir daqui o jogador entra na comparação com a liga


def overall_profile(pf):
    """Uma linha por jogador, somando as passagens por times diferentes; as razões são refeitas com as fórmulas de team.py.
    A página mostra o jogador inteiro (impacto e rounds já somavam os times), então o resumo, os percentis e a regra dos 60
    rounds também usam o total: o Kayden jogou 59 + 58 rounds por dois times da FEI e aparecia como "amostra pequena" com 117."""
    cnt = ["rounds", "kills", "deaths", "assists", "damage", "hs", "bs", "ls", "fk", "fd", "clutch_att", "clutch_won", "kast_rounds", "wpa_total"]
    x = pf.assign(score=pf.acs * pf.rounds, atk_w=pf.wpa_pr_atk * pf.rounds, def_w=pf.wpa_pr_def * pf.rounds)
    o = x.groupby("puuid")[cnt + ["score", "atk_w", "def_w"]].sum(min_count=1)
    r = o.rounds
    o["kpr"], o["dpr"], o["apr"], o["adr"] = o.kills / r, o.deaths / r, o.assists / r, o.damage / r
    o["kd"] = o.kills / o.deaths.clip(lower=1)
    o["kast"] = o.kast_rounds / r
    o["hs_pct"] = o.hs / (o.hs + o.bs + o.ls).clip(lower=1)
    o["acs"] = o.score / r
    o["wpa_per_round"] = o.wpa_total / r
    o["wpa_pr_atk"], o["wpa_pr_def"] = o.atk_w / r, o.def_w / r   # média dos times, ponderada pelos rounds
    o["opening_rate"] = (o.fk + o.fd) / r
    o["clutch_rate"] = o.clutch_att / r
    o["role_eligible"] = r >= MIN_ROUNDS_ROLE
    return o.drop(columns=["score", "atk_w", "def_w"])


def export_players(t, names):
    pf, pm, cr, pr, ev, kl, dc, m, pairs = (t[k] for k in ("player_profile", "player_match", "wp_credits", "player_round", "wp_events", "kills", "death_context", "matches", "pairs"))
    # uma linha por jogador, com todos os times somados (overall_profile), que é o que a página mostra (p, abaixo). Antes, a
    # comparação tinha uma linha por jogador por time: quem jogou por dois times com 60+ rounds entrava duas vezes, e quem
    # passava de 60 só somando os times ficava de fora
    overall = overall_profile(pf)
    elig = overall[overall.role_eligible]
    pct_tables = {c: np.sort(elig[c].dropna().to_numpy()) for c in PERCENTILE_COLS}

    def percentile(c, v):
        arr = pct_tables[c]
        return None if v is None or pd.isna(v) or not len(arr) else float(np.searchsorted(arr, v, side="right") / len(arr) * 100)

    def rank(c, v):
        """Posição na liga (1 = maior valor) entre os mesmos jogadores do percentil; empates dividem a posição."""
        arr = pct_tables[c]
        return None if v is None or pd.isna(v) or not len(arr) else int(len(arr) - np.searchsorted(arr, v, side="right") + 1)

    kill_vals = cr[cr.kind == "kill"].wpa * 100
    death_vals = cr[cr.kind == "death"].wpa * 100
    league = {"kill_value": float(kill_vals.mean()), "death_cost": float(death_vals.mean()),
              "traded_death_rate": float(dc.traded.mean()), "isolated_death_rate": float(np.nanmean(dc.isolated)),
              "first_duel": 0.5, "clutch_win": float(pf.clutch_won.sum() / pf.clutch_att.sum())}

    # per-round WPA per player (zeros included) for the side comparison
    rw = cr.groupby(["match_id", "round_num", "puuid"]).wpa.sum().mul(100).rename("wpa")
    prw = pr[["match_id", "round_num", "puuid", "team", "side"]].join(rw, on=["match_id", "round_num", "puuid"]).fillna({"wpa": 0.0})

    # moments: events where the player acted (kills/plants/defuses) or died
    ev = ev.merge(kl[["match_id", "round_num", "kill_idx", "weapon_label", "victim_side"]].rename(columns={"weapon_label": "weapon"}),
                  on=["match_id", "round_num", "kill_idx"], how="left")
    ev["mine_before_actor"] = np.where(ev.actor_side == "Ataque", ev.p_atk_before, 1 - ev.p_atk_before)
    ev["mine_after_actor"] = np.where(ev.actor_side == "Ataque", ev.p_atk_after, 1 - ev.p_atk_after)
    ev["mine_before_victim"] = np.where(ev.victim_side == "Ataque", ev.p_atk_before, 1 - ev.p_atk_before)
    ev["mine_after_victim"] = np.where(ev.victim_side == "Ataque", ev.p_atk_after, 1 - ev.p_atk_after)
    ev["death_cost"] = np.where(ev.teamkill, -ev.delta_atk.abs(), -ev.wpa) * 100
    acts_by = {k: g for k, g in ev[~ev.teamkill & ev.actor.notna()].groupby("actor")}
    deaths_by = {k: g for k, g in ev[ev.event == "kill"].groupby("victim")}
    mmeta = m.set_index("match_id")
    pm_m = pm.merge(m[["match_id", "date", "map", "competition", "stage", "rounds_red", "rounds_blue", "team_red"]], on="match_id")
    pr_by = {k: g for k, g in prw.groupby("puuid")}
    pm_by = {k: g for k, g in pm_m.groupby("puuid")}
    cr_by = {k: g for k, g in cr.groupby("puuid")}
    dc_by = {k: g for k, g in dc.groupby("victim")}

    # duels: who killed whom (no team kills or self kills), with each side's agent in that match
    agent_of = pm.set_index(["match_id", "puuid"]).agent
    duel = kl[~kl.teamkill.astype(bool) & ~kl.self_kill.astype(bool) & kl.killer.notna()][["match_id", "killer", "victim"]].copy()
    duel["killer_agent"] = agent_of.reindex(pd.MultiIndex.from_frame(duel[["match_id", "killer"]])).to_numpy()
    duel["victim_agent"] = agent_of.reindex(pd.MultiIndex.from_frame(duel[["match_id", "victim"]])).to_numpy()
    won_by = {k: g for k, g in duel.groupby("killer")}
    lost_by = {k: g for k, g in duel.groupby("victim")}
    main_team = pf.sort_values("rounds").groupby("puuid").team.last()
    # when each death happens, and the agent role in that match: duelists die early by design, so the reference is the
    # league in the same role mix as the player
    role_of = pm.set_index(["match_id", "puuid"]).role
    dth_t = dc[["match_id", "victim", "t_round_ms"]].copy()
    dth_t["role"] = role_of.reindex(pd.MultiIndex.from_frame(dth_t[["match_id", "victim"]])).to_numpy()
    dth_t["agent"] = agent_of.reindex(pd.MultiIndex.from_frame(dth_t[["match_id", "victim"]])).to_numpy()
    dth_t["s"] = dth_t.t_round_ms / 1000
    role_bins = {r: np.histogram(g.s, bins=DEATH_BINS)[0] / len(g) for r, g in dth_t.groupby("role")}
    role_early = dth_t.groupby("role").s.apply(lambda x: float((x < EARLY_DEATH_S).mean())).to_dict()
    role_median = dth_t.groupby("role").s.median().to_dict()
    dth_t_by = {k: g for k, g in dth_t.groupby("victim")}

    by_agent_casts = pm.groupby("agent").agg(maps=("match_id", "count"), rounds=("rounds", "sum"), casts_c=("casts_c", "sum"),
                                             casts_q=("casts_q", "sum"), casts_e=("casts_e", "sum"))
    # ultimate: só os mapas em que a Riot conta (ver load)
    ult_ok = pm[pm.ult_ok].groupby("agent").agg(maps_x=("match_id", "count"), casts_x=("casts_x", "sum"))
    by_agent_casts = by_agent_casts.join(ult_ok).fillna({"maps_x": 0, "casts_x": 0})

    def abilities_of(g):
        """Per agent played on 2+ maps: uses of each ability per round and ultimates per map, vs. the league on the same agent."""
        out = []
        for ag, ga in g.groupby("agent"):
            if len(ga) < MIN_MAPS_ABILITIES or ag not in by_agent_casts.index:
                continue
            meta = t["agents_by_name"].get(ag, {}).get("abilities", {})
            lg = by_agent_casts.loc[ag]
            r_ = ga.rounds.sum()
            out.append({
                "agent": ag, "icon": t["agents_by_name"].get(ag, {}).get("icon"), "maps": len(ga), "rounds": int(r_),
                "slots": [{"key": k, "name": meta.get(slot, {}).get("name"), "icon": meta.get(slot, {}).get("icon"),
                           "per_round": ga[col].sum() / max(r_, 1), "league": lg[col] / max(lg.rounds, 1)} for k, (col, slot) in CAST_SLOTS.items()],
                "ult": {"name": meta.get("Ultimate", {}).get("name"), "icon": meta.get("Ultimate", {}).get("icon"),
                        "total": int(ga[ga.ult_ok].casts_x.sum()), "maps": int(ga.ult_ok.sum()),
                        "per_map": ga[ga.ult_ok].casts_x.sum() / ga.ult_ok.sum(), "league": lg.casts_x / max(lg.maps_x, 1)}
                       if ga.ult_ok.any() and lg.maps_x > 0 else None,
            })
        out.sort(key=lambda x: -x["maps"])
        return out

    def duels_of(puuid):
        w_, l_ = won_by.get(puuid), lost_by.get(puuid)
        kc = w_.victim.value_counts() if w_ is not None else pd.Series(dtype=int)
        dcnt = l_.killer.value_counts() if l_ is not None else pd.Series(dtype=int)
        opponents = []
        for o in set(kc.index) | set(dcnt.index):
            k_, d_ = int(kc.get(o, 0)), int(dcnt.get(o, 0))
            if k_ + d_ >= MIN_H2H:
                team = main_team.get(o)
                opponents.append({"puuid": o, "name": t["player_name"].get(o), "team": team,
                                  "team_name": names.get(team, {}).get("name", team), "kills": k_, "deaths": d_})
        # desempate fixo (nick, puuid): sem ele, quem empata muda de ordem (e de quem entra no corte de 8) a cada execução
        opponents.sort(key=lambda x: (-(x["kills"] + x["deaths"]), -x["kills"], (x["name"] or "").lower(), x["puuid"]))
        K, D = int(kc.sum()), int(dcnt.sum())
        rate = K / (K + D) if K + D else None
        ka = w_.victim_agent.value_counts() if w_ is not None else pd.Series(dtype=int)
        da = l_.killer_agent.value_counts() if l_ is not None else pd.Series(dtype=int)
        by_agent = {}
        for ag in set(ka.index) | set(da.index):
            k_, d_ = int(ka.get(ag, 0)), int(da.get(ag, 0))
            if rate is not None and k_ + d_ >= MIN_DUELS_AGENT:
                by_agent[ag] = {"agent": ag, "icon": t["agents_by_name"].get(ag, {}).get("icon"), "kills": k_, "deaths": d_,
                                **binom(k_, k_ + d_, rate, True)}  # vs. the player's own duel rate
        bh_adjust(by_agent)  # its own family on the page: the list of enemy agents
        agents_out = [{"agent": c["agent"], "icon": c["icon"], "kills": c["kills"], "deaths": c["deaths"], "win": c["value"],
                       "z": c["z"], "significant": c["significant"], "good": c["good"]}
                      for c in sorted(by_agent.values(), key=lambda c: (-(c["kills"] + c["deaths"]), c["agent"]))]
        return {"kills": K, "deaths": D, "win_rate": rate, "opponents": opponents[:8], "by_agent": agents_out}

    def death_timing_of(puuid):
        tt = dth_t_by.get(puuid)
        if tt is None or len(tt) < MIN_DEATHS_TIMING:
            return None
        n = len(tt)
        counts = np.histogram(tt.s, bins=DEATH_BINS)[0]
        mix = tt.role.value_counts()
        ref = sum(role_bins[r] * c for r, c in mix.items() if r in role_bins) / mix.sum()
        by_agent = []
        for ag, g in tt.groupby("agent"):
            if len(g) >= MIN_DEATHS_TIMING:
                r_ = g.role.iloc[0]
                by_agent.append({"agent": ag, "role": r_, "n": len(g), "median": float(g.s.median()), "early": float((g.s < EARLY_DEATH_S).mean()),
                                 "league_median": role_median.get(r_), "league_early": role_early.get(r_)})
        by_agent.sort(key=lambda x: -x["n"])
        return {"n": n, "early_s": EARLY_DEATH_S, "roles": {k: int(v) for k, v in mix.items()},
                "bins": [{"from": a, "to": b, "share": c / n, "league": float(rb)} for a, b, c, rb in zip(DEATH_BINS[:-1], DEATH_BINS[1:], counts, ref)],
                "median": float(tt.s.median()), "league_median": float(tt.role.map(role_median).mean()),
                "early": float((tt.s < EARLY_DEATH_S).mean()), "league_early": float(tt.role.map(role_early).mean()),
                "by_agent": by_agent}

    def moment(e, who):
        mt = mmeta.loc[e.match_id]
        before, after = (e.mine_before_actor, e.mine_after_actor) if who == "actor" else (e.mine_before_victim, e.mine_after_victim)
        return {"match_id": e.match_id, "round": e.round_num + 1, "t": e.t_round_ms, "event": e.event, "map": mt["map"],
                "weapon": e.weapon if isinstance(e.weapon, str) else None,
                # revive: quem voltou (vazio quando a Clove volta sozinha)
                "other": (None if e.event == "revive" and e.target == e.actor
                          else t["player_name"].get(e.target if e.event == "revive" else e.victim if who == "actor" else e.actor)),
                "wpa": e.wpa * 100 if who == "actor" else e.death_cost, "wp_before": before, "wp_after": after}

    index = []
    for puuid, stints in pf.groupby("puuid"):
        stints = stints.sort_values("rounds", ascending=False, kind="stable")
        p = stints.iloc[0].copy()                     # time principal (o de mais rounds) para slug, nome e agentes...
        for c, v in overall.loc[puuid].items():       # ...e as estatísticas do jogador inteiro, todos os times somados
            p[c] = v
        slug = p.team
        rounds = int(stints.rounds.sum())
        g_pm = pm_by[puuid]
        g_cr = cr_by.get(puuid, pd.DataFrame(columns=cr.columns))
        g_dc = dc_by.get(puuid, pd.DataFrame(columns=dc.columns))
        g_pr = pr_by[puuid]

        comps = {
            "kill_value": mean_test(g_cr[g_cr.kind == "kill"].wpa * 100, league["kill_value"], True, min_n=30),
            "death_cost": mean_test(g_cr[g_cr.kind == "death"].wpa * 100, league["death_cost"], True, min_n=30),
            "traded_death_rate": binom(g_dc.traded.sum(), len(g_dc), league["traded_death_rate"], True),
            "isolated_death_rate": binom(np.nansum(g_dc.isolated), g_dc.isolated.notna().sum(), league["isolated_death_rate"], False),
            "first_duel": binom(stints.fk.sum(), stints.fk.sum() + stints.fd.sum(), 0.5, True),
            "clutch_win": binom(stints.clutch_won.sum(), stints.clutch_att.sum(), league["clutch_win"], True),
        }
        # side split (Welch z on per-round WPA) is also a claim on the page -> same multiple-testing family
        a, d = g_pr[g_pr.side == "Ataque"].wpa, g_pr[g_pr.side == "Defesa"].wpa
        side_c = {"z": None, "n": 0, "significant": False}
        if len(a) >= 30 and len(d) >= 30:
            se = math.sqrt(a.var(ddof=1) / len(a) + d.var(ddof=1) / len(d))
            zs = (a.mean() - d.mean()) / se if se > 0 else 0.0
            side_c = {"z": float(zs), "n": int(min(len(a), len(d))), "significant": abs(zs) >= Z_SIGNIFICANT, "good": None}
        bh_adjust({**comps, "side": side_c})

        fmt = {k: (pp if k in ("kill_value", "death_cost") else pct) for k in comps}
        hib = {k: k != "isolated_death_rate" for k in comps}
        ins = {"strengths": [], "weaknesses": [], "attention": []}
        for k, c in comps.items():
            one = make_insights({k: c}, PLAYER_TEXT, fmt=fmt[k], higher_is_better=hib)
            for part in ins:
                ins[part] += one[part]
        for part in ins:
            ins[part].sort(key=lambda x: -abs(x["z"]))
        ins["attention"] = ins["attention"][:2]
        notes = []
        if side_c["significant"]:
            better, worse = ("ataque", "defesa") if side_c["z"] > 0 else ("defesa", "ataque")
            notes.append({"key": "side", "z": round(side_c["z"], 2),
                          "text": f"Rende mais na {better}: {pp(max(a.mean(), d.mean()))} por round contra {pp(min(a.mean(), d.mean()))} na {worse}."})
        if p.role_eligible:
            p_kd, p_wpa = percentile("kd", p.kd), percentile("wpa_per_round", p.wpa_per_round)
            if p_kd is not None and p_wpa is not None and abs(p_wpa - p_kd) >= 25:
                # "melhor que X% da liga", como na página (betterThan em web/src/lib/format.ts)
                better = lambda v: "é o melhor da liga" if v >= 100 else f"é melhor que {int(v)}% da liga"
                txt = (f"O impacto vale mais que o K/D: em impacto, {better(p_wpa)}; em K/D, só que {int(p_kd)}%. As jogadas acontecem nos momentos que decidem rounds."
                       if p_wpa > p_kd else
                       f"O K/D é melhor que o impacto: em K/D, {better(p_kd)}; em impacto, só que {int(p_wpa)}%. Parte das kills acontece com o round já decidido, ou as mortes custam caro.")
                notes.append({"key": "impact_vs_kd", "z": None, "text": txt})
        ins["notes"] = notes

        agents = []
        for ag, ga in g_pm.groupby("agent"):
            r_ = ga.rounds.sum()
            wpa_a = sum(t["wpa_pm"].get((mid, puuid), 0) for mid in ga.match_id)
            agents.append({"agent": ag, "icon": t["agents_by_name"].get(ag, {}).get("icon"), "role": ga.role.iloc[0], "maps": len(ga), "rounds": int(r_),
                           "kd": ga.kills.sum() / max(ga.deaths.sum(), 1), "acs": ga.score.sum() / max(r_, 1),
                           "wpa_per_round": wpa_a / max(r_, 1), "map_win_rate": ga.won.mean()})
        agents.sort(key=lambda x: -x["rounds"])
        maps = []
        for mp_name, gmp in g_pm.groupby("map"):
            r_ = gmp.rounds.sum()
            wpa_m = sum(t["wpa_pm"].get((mid, puuid), 0) for mid in gmp.match_id)
            maps.append({"map": mp_name, "maps": len(gmp), "rounds": int(r_), "kd": gmp.kills.sum() / max(gmp.deaths.sum(), 1),
                         "wpa_per_round": wpa_m / max(r_, 1), "map_win_rate": gmp.won.mean()})
        maps.sort(key=lambda x: -x["rounds"])
        matches = []
        for x in g_pm.sort_values("date").itertuples(index=False):
            red = x.team_color == "Red"
            matches.append({"id": x.match_id, "date": x.date.isoformat(), "map": x.map, "team": x.team, "opponent": x.opponent,
                            "opponent_name": names.get(x.opponent, {}).get("name", x.opponent), "won": bool(x.won),
                            "score_for": x.rounds_red if red else x.rounds_blue, "score_against": x.rounds_blue if red else x.rounds_red,
                            "agent": x.agent, "kills": x.kills, "deaths": x.deaths, "assists": x.assists, "acs": x.score / max(x.rounds, 1),
                            "wpa": t["wpa_pm"].get((x.match_id, puuid), 0.0)})

        acts = acts_by.get(puuid)
        best = [moment(e, "actor") for e in acts.sort_values("wpa", ascending=False).head(5).itertuples(index=False)] if acts is not None else []
        dth = deaths_by.get(puuid)
        worst = [moment(e, "victim") for e in dth.sort_values("death_cost").head(5).itertuples(index=False)] if dth is not None else []

        mates = pairs[(pairs.team == slug) & ((pairs.a == puuid) | (pairs.b == puuid))]
        covers_me = mates[mates.a == puuid].set_index("b")       # b traded me (a)
        i_cover = mates[mates.b == puuid].set_index("a")         # I (b) traded a
        partners = []
        for other in sorted(set(covers_me.index) | set(i_cover.index)):
            c1 = covers_me.loc[other] if other in covers_me.index else None
            c2 = i_cover.loc[other] if other in i_cover.index else None
            rt = float((c1 if c1 is not None else c2)["rounds_together"])
            if rt < 20:
                continue
            partners.append({"puuid": other, "name": t["player_name"].get(other), "rounds_together": rt,
                             "they_traded_you": float(c1["b_traded_a"]) if c1 is not None else 0.0,
                             "your_deaths_with_them_alive": float(c1["a_deaths_b_alive"]) if c1 is not None else 0.0,
                             "you_traded_them": float(c2["b_traded_a"]) if c2 is not None else 0.0,
                             "their_assists_on_your_kills": float(c1["b_assists_on_a"]) if c1 is not None else 0.0})
        partners.sort(key=lambda x: -(x["they_traded_you"] + x["you_traded_them"]))

        doc = {
            "puuid": puuid, "name": p["name"], "team": slug, "team_name": names.get(slug, {}).get("name", slug),
            # cada time por que jogou (o principal primeiro), com rounds, mapas e campeonatos: 24 jogadores jogaram por 2+ times
            "teams": [{"slug": s.team, "name": names.get(s.team, {}).get("name", s.team), "rounds": int(s.rounds), "maps": int(s.maps),
                       "competitions": sorted(g_pm[g_pm.team == s.team].competition.unique().tolist())} for s in stints.itertuples(index=False)],
            "sample": {"rounds": rounds, "maps": int(stints.maps.sum()), "eligible": bool(p.role_eligible)},
            "summary": {k: float(p[k]) if pd.notna(p[k]) else None for k in ("kd", "kpr", "dpr", "apr", "adr", "acs", "kast", "hs_pct")}
                       | {k: int(stints[k].sum()) for k in ("kills", "deaths", "assists", "fk", "fd", "clutch_att", "clutch_won", "plants", "defuses")},
            "impact": {"wpa_total": float(stints.wpa_total.sum()), "wpa_per_round": float(stints.wpa_total.sum() / rounds),
                       "wpa_pr_atk": p.wpa_pr_atk, "wpa_pr_def": p.wpa_pr_def,
                       "breakdown": {k: float(stints[f"wpa_{k}"].sum()) for k in ("kill", "assist", "death", "plant", "defuse", "revive") if f"wpa_{k}" in stints},
                       "per_kill": comps["kill_value"]["value"], "per_death": comps["death_cost"]["value"],
                       "league_per_kill": league["kill_value"], "league_per_death": league["death_cost"]},
            "percentiles": {c: percentile(c, p[c]) for c in PERCENTILE_COLS} if p.role_eligible else None,
            "ranks": {c: rank(c, p[c]) for c in PERCENTILE_COLS} if p.role_eligible else None,
            # só a função do agente: o "papel em jogo" pelo comportamento saiu da interface (22/10), a equipe achou ambíguo
            "role": {"agent_role": p.main_agent_role},
            "comparisons": comps, "insights": ins,
            "agents": agents, "maps": maps, "matches": matches, "best_plays": best, "costliest_deaths": worst, "partners": partners,
            "duels": duels_of(puuid), "death_timing": death_timing_of(puuid), "abilities": abilities_of(g_pm),
            "stages": [{"etapa": r.etapa, "team": r.team, "rounds": int(r.rounds), "wpa_per_round": r.wpa_per_round,
                        "kd": r.kills / max(r.deaths, 1)}
                       for r in t["player_stage"][t["player_stage"].puuid == puuid].sort_values("etapa_idx").itertuples(index=False)],
        }
        write(OUT / "players" / f"{puuid}.json", doc)
        index.append({"puuid": puuid, "name": p["name"], "team": slug, "rounds": rounds, "agent_role": p.main_agent_role, "kd": p.kd,
                      "wpa_per_round": doc["impact"]["wpa_per_round"], "eligible": bool(p.role_eligible)}
                     | ({"other_teams": [{"slug": t_["slug"], "name": t_["name"]} for t_ in doc["teams"][1:]]} if len(doc["teams"]) > 1 else {}))
    return index, league


def export_model(t):
    """model.json: how the win-probability model was validated + the evidence behind the metric choices (page 'Metodologia')."""
    rep = json.loads((P / "wp_report.json").read_text(encoding="utf-8"))
    dc, rd, st = t["death_context"], t["rounds"], t["wp_states"]
    bins = [0, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7000, 1e9]
    labels = ["0–5 m", "5–10 m", "10–15 m", "15–20 m", "20–25 m", "25–30 m", "30–40 m", "40–50 m", "50–70 m", "70 m+"]
    d = dc[dc.nearest_mate_dist.notna()]
    curve = d.groupby(pd.cut(d.nearest_mate_dist, bins, labels=labels), observed=True).traded.agg(["mean", "size"])
    s0 = st[st.kind == "start"].set_index(["match_id", "round_num"])[["p_atk", "y"]]
    bm = rd[~rd.anomalous].set_index(["match_id", "round_num"])[["atk_buy", "def_buy"]].join(s0)
    buys = bm.groupby(["atk_buy", "def_buy"]).agg(model=("p_atk", "mean"), real=("y", "mean"), n=("y", "size")).reset_index()
    doc = {
        "data": {"matches": int(t["matches"].shape[0]), "rounds": rep["n_rounds"], "states": rep["n_states"], "kills": int(t["kills"].shape[0])},
        "validation": "GroupKFold (5 dobras) por partida: cada partida é avaliada por um modelo que nunca a viu.",
        "features": ["jogadores vivos de cada lado", "valor do equipamento dos vivos de cada lado", "spike plantada", "tempo de round", "tempo desde o plant"],
        "models": {k: {m: rep[k][m] for m in ("log_loss", "brier", "auc") if m in rep[k]} | ({"ece": rep[k]["ece"]} if "ece" in rep[k] else {})
                   for k in ("baseline_alive_lookup", "logistic", "gbm")},
        "chosen": rep["chosen"],
        "calibration": rep[rep["chosen"]]["calibration"],          # [{p: previsto, y: real, n}]
        "trade_by_distance": [{"distance": str(k), "trade_rate": float(r["mean"]), "n": int(r["size"])} for k, r in curve.iterrows()],
        "buy_matchups": buys[buys.n >= 80].to_dict(orient="records"),  # previsão no início do round vs. realidade
        "definitions": {
            "trade_window_s": 5, "isolated_distance_m": 30, "throw_wp": 0.8, "comeback_wp": 0.2, "min_rounds_role": 60,
            "significance": "|z| ≥ 1,645 e amostra ≥ 15 (≈ 90% de confiança)",
        },
    }
    write(OUT / "model.json", doc)


def main():
    names = team_names()
    t = load()
    export_model(t)
    matches = export_matches(t, names)
    teams, league_t = export_teams(t, names)
    players, league_p = export_players(t, names)
    write(OUT / "index.json", {"teams": names, "team_list": teams, "players": players, "matches": matches})
    write(OUT / "league.json", {**league_t, "player": league_p})
    write(OUT / "economy.json", t["economy"])
    # regions where each team dies + heat grid (pipeline/zones.py)
    (OUT / "zones").mkdir(parents=True, exist_ok=True)
    for f in (P / "zones").glob("*.json"):
        (OUT / "zones" / f.name).write_text(f.read_text(encoding="utf-8"), encoding="utf-8")
    for d in ("matches", "teams", "players"):
        files = list((OUT / d).glob("*.json"))
        print(f"{d:8s} {len(files):4d} files  {sum(f.stat().st_size for f in files) / 1e6:5.1f} MB")


if __name__ == "__main__":
    main()
