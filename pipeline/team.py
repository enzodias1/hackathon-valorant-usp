"""Collective analytics: death context, pair synergy, behavioral roles, team profiles.

Requires etl.py and winprob.py outputs. Writes data/processed/:
  death_context.parquet   per death: nearest alive teammate distance, isolated flag
  pairs.parquet           per (team, A, B): A's deaths with B alive, trades of A by B, B's assists on A's kills, distance
  player_profile.parquet  per (player, team): stats, WPA breakdown, behavior features, role axes and primary role
  team_profile.parquet    per team: collective metrics vs league
  team_map.parquet        per (team, map): maps / rounds / side win rates
  team_buy.parquet        per (team, own buy type): win rate vs model expectation
  league.json             league-wide baselines
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / "data" / "processed"
ISOLATED_DIST = 3000      # game units (~30 m): beyond this, a death is traded < 11% of the time (see notes in winprob/team analysis)
MIN_ROUNDS_ROLE = 60      # minimum rounds for a player to receive role percentiles
THROW_WP, COMEBACK_WP = 0.80, 0.20

ROLE_AXES = {
    # axis -> features (higher = more of that axis); the score is the mean percentile of its features within the league
    "Entry": ["opening_rate", "first_contact_share"],
    "Support": ["assist_ratio", "trades_per_round"],
    "Lurker": ["dist_to_team", "isolated_death_rate"],
    "Clutch": ["clutch_rate", "late_action_share"],
}


def load():
    t = {n: pd.read_parquet(P / f"{n}.parquet") for n in
         ("matches", "player_match", "rounds", "player_round", "kills", "positions", "wp_states", "wp_events", "wp_credits")}
    team_of = t["player_match"].set_index(["match_id", "puuid"])["team"]
    for n in ("player_round", "wp_credits"):
        t[n] = t[n].join(team_of, on=["match_id", "puuid"])
    return t


def death_context(t):
    kl, pos = t["kills"], t["positions"]
    k = kl[~kl.teamkill & ~kl.self_kill][["match_id", "round_num", "kill_idx", "victim", "victim_color", "victim_x", "victim_y", "traded", "trade_delay_ms", "t_round_ms"]]
    snap = pos[pos.event == "kill"].rename(columns={"event_idx": "kill_idx"})
    j = snap.merge(k, on=["match_id", "round_num", "kill_idx"])
    j = j[j.color == j.victim_color]
    j["d"] = np.hypot(j.x - j.victim_x, j.y - j.victim_y)
    near = j.groupby(["match_id", "round_num", "kill_idx"]).d.min().rename("nearest_mate_dist")
    dc = k.join(near, on=["match_id", "round_num", "kill_idx"])
    # 1.0 / 0.0, NaN when no teammate was alive (last player standing is not "isolated" by choice)
    dc["isolated"] = np.where(dc.nearest_mate_dist.isna(), np.nan, (dc.nearest_mate_dist > ISOLATED_DIST).astype(float))
    return dc, j  # j: (death, alive teammate) rows, reused for pair stats


def pair_stats(t, mates_at_death):
    pm = t["player_match"]
    team_of = pm.set_index(["match_id", "puuid"])["team"]
    # A died while B (teammate) alive
    m = mates_at_death.rename(columns={"victim": "a", "puuid": "b"})
    kl = t["kills"].set_index(["match_id", "round_num", "kill_idx"])["traded_by"]
    m = m.join(kl, on=["match_id", "round_num", "kill_idx"])
    m["b_traded"] = m.traded_by == m.b
    m["team"] = team_of.reindex(pd.MultiIndex.from_frame(m[["match_id", "a"]])).to_numpy()
    deaths = m.groupby(["team", "a", "b"]).agg(a_deaths_b_alive=("b_traded", "size"), b_traded_a=("b_traded", "sum"), dist_at_death=("d", "mean"))

    # B assisted A's kills
    kl = t["kills"][~t["kills"].teamkill & ~t["kills"].self_kill & (t["kills"].assistants != "")]
    ak = kl[["match_id", "killer", "assistants"]].assign(b=kl.assistants.str.split(",")).explode("b").rename(columns={"killer": "a"})
    ak["team"] = team_of.reindex(pd.MultiIndex.from_frame(ak[["match_id", "a"]])).to_numpy()
    assists = ak.groupby(["team", "a", "b"]).size().rename("b_assists_on_a")

    # rounds played together on the same team
    pr = t["player_round"][["match_id", "round_num", "puuid", "team"]]
    rt = pr.merge(pr, on=["match_id", "round_num", "team"], suffixes=("_a", "_b"))
    rt = rt[rt.puuid_a != rt.puuid_b].groupby(["team", "puuid_a", "puuid_b"]).size().rename("rounds_together")
    rt.index.names = ["team", "a", "b"]

    out = pd.concat([rt, deaths, assists], axis=1).fillna({"a_deaths_b_alive": 0, "b_traded_a": 0, "b_assists_on_a": 0})
    out = out[out.rounds_together.fillna(0) > 0].reset_index()
    out["trade_rate_b_for_a"] = out.b_traded_a / out.a_deaths_b_alive.where(out.a_deaths_b_alive > 0)
    return out


def player_profile(t, dc):
    pr, kl, cr, pm = t["player_round"], t["kills"], t["wp_credits"], t["player_match"]
    g = pr.groupby(["puuid", "team"])
    prof = pd.DataFrame({
        "rounds": g.size(), "kills": g.kills.sum(), "deaths": g.died.sum(), "assists": g.assists.sum(),
        "damage": g.damage.sum(), "hs": g.headshots.sum(), "bs": g.bodyshots.sum(), "ls": g.legshots.sum(),
        "fk": g.first_kill.sum(), "fd": g.first_death.sum(), "plants": g.planted.sum(), "defuses": g.defused.sum(),
        "clutch_att": (g.clutch_vs.apply(lambda s: (s > 0).sum())), "clutch_won": g.clutch_won.sum(),
        "kast_rounds": pr.assign(k=(pr.kills > 0) | (pr.assists > 0) | pr.survived | pr.traded).groupby(["puuid", "team"]).k.sum(),
        "won_rounds": g.won_round.sum(),
    })
    names = pm.sort_values("match_id").groupby("puuid").name.last()
    prof = prof.join(names, on="puuid")
    agents = pm.groupby(["puuid", "team"]).agent.agg(lambda s: s.value_counts().index.tolist()[:3]).rename("top_agents")
    roles = pm.groupby(["puuid", "team"]).role.agg(lambda s: s.value_counts(normalize=True).round(2).to_dict()).rename("agent_role_mix")
    main_role = pm.groupby(["puuid", "team"]).role.agg(lambda s: s.value_counts().index[0]).rename("main_agent_role")
    maps_played = pm.groupby(["puuid", "team"]).match_id.nunique().rename("maps")
    prof = prof.join([agents, roles, main_role, maps_played])

    r = prof.rounds
    prof["kpr"], prof["dpr"], prof["apr"] = prof.kills / r, prof.deaths / r, prof.assists / r
    prof["adr"] = prof.damage / r
    prof["kd"] = prof.kills / prof.deaths.clip(lower=1)
    prof["kast"] = prof.kast_rounds / r
    prof["hs_pct"] = prof.hs / (prof.hs + prof.bs + prof.ls).clip(lower=1)

    # WPA breakdown (percentage points of round win probability)
    w = cr.pivot_table(index=["puuid", "team"], columns="kind", values="wpa", aggfunc="sum", fill_value=0) * 100
    w.columns = [f"wpa_{c}" for c in w.columns]
    prof = prof.join(w).fillna({c: 0 for c in w.columns})
    prof["wpa_total"] = w.sum(axis=1).reindex(prof.index).fillna(0)
    prof["wpa_per_round"] = prof.wpa_total / r
    side = cr.merge(pr[["match_id", "round_num", "puuid", "side"]], on=["match_id", "round_num", "puuid"])
    ws = side.pivot_table(index=["puuid", "team"], columns="side", values="wpa", aggfunc="sum", fill_value=0) * 100
    rs = pr.pivot_table(index=["puuid", "team"], columns="side", values="round_num", aggfunc="size", fill_value=0)
    prof["wpa_pr_atk"] = (ws.get("Ataque") / rs.get("Ataque").replace(0, np.nan)).reindex(prof.index)
    prof["wpa_pr_def"] = (ws.get("Defesa") / rs.get("Defesa").replace(0, np.nan)).reindex(prof.index)

    # behavior features
    team_of = pm.set_index(["match_id", "puuid"])["team"]
    k = kl[~kl.teamkill & ~kl.self_kill].copy()
    k["killer_team"] = team_of.reindex(pd.MultiIndex.from_frame(k[["match_id", "killer"]])).to_numpy()
    k["victim_team"] = team_of.reindex(pd.MultiIndex.from_frame(k[["match_id", "victim"]])).to_numpy()
    prof["opening_rate"] = (prof.fk + prof.fd) / r
    # share of the team's first contacts (FK or FD) taken by this player, per round played
    team_rounds_fc = pr.assign(fc=pr.first_kill | pr.first_death).groupby(["match_id", "round_num", "team"]).fc.sum()
    prof["first_contact_share"] = (prof.fk + prof.fd) / r / (team_rounds_fc.mean() / 5)
    tr = k[k.is_trade].groupby(["killer", "killer_team"]).size()
    tr.index.names = ["puuid", "team"]
    prof["trades_per_round"] = tr.reindex(prof.index).fillna(0) / r
    prof["assist_ratio"] = prof.assists / (prof.kills + prof.assists).clip(lower=1)
    d = dc.copy()
    d["team"] = team_of.reindex(pd.MultiIndex.from_frame(d[["match_id", "victim"]])).to_numpy()
    dg = d.groupby(["victim", "team"])
    iso = dg.isolated.mean()
    iso.index.names = ["puuid", "team"]
    prof["isolated_death_rate"] = iso.reindex(prof.index)
    trd = dg.traded.mean()
    trd.index.names = ["puuid", "team"]
    prof["traded_death_rate"] = trd.reindex(prof.index)
    prof["clutch_rate"] = prof.clutch_att / r
    # share of the player's kills+deaths that happen in the last part of the round (>=60 s or post-plant)
    acts = pd.concat([
        k[["killer", "killer_team", "t_round_ms", "spike_planted_before"]].rename(columns={"killer": "puuid", "killer_team": "team"}),
        k[["victim", "victim_team", "t_round_ms", "spike_planted_before"]].rename(columns={"victim": "puuid", "victim_team": "team"}),
    ])
    acts["late"] = (acts.t_round_ms >= 60000) | acts.spike_planted_before
    late = acts.groupby(["puuid", "team"]).late.mean()
    prof["late_action_share"] = late.reindex(prof.index)
    prof["avg_kill_time_s"] = k.groupby(["killer", "killer_team"]).t_round_ms.mean().rename_axis(["puuid", "team"]).reindex(prof.index) / 1000

    # mean distance to the centroid of alive teammates, over kill snapshots where the player is alive
    pos = t["positions"][t["positions"].event == "kill"][["match_id", "round_num", "event_idx", "puuid", "color", "x", "y"]]
    grp = pos.groupby(["match_id", "round_num", "event_idx", "color"])
    sx, sy, n = grp.x.transform("sum"), grp.y.transform("sum"), grp.x.transform("size")
    pos = pos.assign(n=n, cx=(sx - pos.x) / (n - 1).replace(0, np.nan), cy=(sy - pos.y) / (n - 1).replace(0, np.nan))
    pos = pos[pos.n >= 2]
    pos["dist"] = np.hypot(pos.x - pos.cx, pos.y - pos.cy)
    pos["team"] = team_of.reindex(pd.MultiIndex.from_frame(pos[["match_id", "puuid"]])).to_numpy()
    prof["dist_to_team"] = pos.groupby(["puuid", "team"]).dist.mean().reindex(prof.index)

    # role axes: league percentiles among players with enough rounds
    elig = prof.rounds >= MIN_ROUNDS_ROLE
    prof["role_eligible"] = elig
    feats = sorted({f for fs in ROLE_AXES.values() for f in fs})
    pct = prof.loc[elig, feats].rank(pct=True)
    for axis, fs in ROLE_AXES.items():
        prof.loc[elig, f"axis_{axis}"] = pct[fs].mean(axis=1) * 100
    prof.loc[elig, "axis_Impacto"] = prof.loc[elig, "wpa_per_round"].rank(pct=True) * 100
    axes = [f"axis_{a}" for a in ROLE_AXES]
    prof.loc[elig, "behavior_role"] = prof.loc[elig, axes].idxmax(axis=1).str.replace("axis_", "", regex=False)
    return prof.reset_index()


def team_tables(t, dc):
    rd, st, m = t["rounds"][~t["rounds"].anomalous], t["wp_states"], t["matches"]
    # team-perspective rows: one per (round, team)
    rows = []
    start = st[st.kind == "start"].set_index(["match_id", "round_num"]).p_atk
    pmax = st.groupby(["match_id", "round_num"]).p_atk.max()
    pmin = st.groupby(["match_id", "round_num"]).p_atk.min()
    rd = rd.join(start.rename("p0"), on=["match_id", "round_num"]).join(pmax.rename("pmax"), on=["match_id", "round_num"]).join(pmin.rename("pmin"), on=["match_id", "round_num"])
    rd = rd.join(m.set_index("match_id")[["map"]], on="match_id")
    for side, team_col, opp_col, buy, obuy in (("Ataque", "attacker", "defender", "atk_buy", "def_buy"), ("Defesa", "defender", "attacker", "def_buy", "atk_buy")):
        x = pd.DataFrame({
            "match_id": rd.match_id, "round_num": rd.round_num, "map": rd["map"], "team": rd[team_col], "opponent": rd[opp_col], "side": side,
            "won": rd.winner_side == side, "buy": rd[buy], "opp_buy": rd[obuy],
            "p0": rd.p0 if side == "Ataque" else 1 - rd.p0,
            "wp_max": rd.pmax if side == "Ataque" else 1 - rd.pmin,
            "wp_min": rd.pmin if side == "Ataque" else 1 - rd.pmax,
            "planted": rd.planted, "first_blood": rd.first_blood_side == side, "first_death": rd.first_blood_side.notna() & (rd.first_blood_side != side),
        })
        rows.append(x)
    tr = pd.concat(rows, ignore_index=True).sort_values(["match_id", "round_num"])
    tr["throw"] = (tr.wp_max >= THROW_WP) & ~tr.won
    tr["comeback"] = (tr.wp_min <= COMEBACK_WP) & tr.won
    # previous-round context: pistol follow-ups (rounds 1 and 13)
    prev = tr.set_index(["match_id", "team", "round_num"]).won
    tr["prev_won"] = [prev.get((a, b, c - 1), np.nan) for a, b, c in zip(tr.match_id, tr.team, tr.round_num)]
    tr["after_pistol"] = tr.round_num.isin([1, 13])

    def summarize(g):
        n = len(g)
        ap = g[g.after_pistol]
        pl_atk = g[(g.side == "Ataque") & g.planted]
        pl_def = g[(g.side == "Defesa") & g.planted]
        return pd.Series({
            "rounds": n, "round_win": g.won.mean(),
            "atk_win": g[g.side == "Ataque"].won.mean(), "def_win": g[g.side == "Defesa"].won.mean(),
            "pistol_win": g[g.buy == "Pistol"].won.mean(),
            "bonus_conv": ap[ap.prev_won == True].won.mean(),      # won pistol -> won next round
            "anti_bonus": ap[ap.prev_won == False].won.mean(),     # lost pistol -> won next round anyway
            "expected_wins": g.p0.sum(), "wins": g.won.sum(),
            "fb_rate": g.first_blood.mean(), "win_after_fb": g[g.first_blood].won.mean(), "win_after_fd": g[g.first_death].won.mean(),
            "postplant_win": pl_atk.won.mean(), "retake_win": pl_def.won.mean(),
            "throws_per100": g.throw.sum() / n * 100, "comebacks_per100": g.comeback.sum() / n * 100,
            "throws": g.throw.sum(), "comebacks": g.comeback.sum(),
        })

    team = tr.groupby("team").apply(summarize, include_groups=False)
    team["wins_above_expected_per100"] = (team.wins - team.expected_wins) / team.rounds * 100
    # trade / isolation (team perspective = deaths of team members)
    team_of = t["player_match"].set_index(["match_id", "puuid"])["team"]
    d = dc.copy()
    d["team"] = team_of.reindex(pd.MultiIndex.from_frame(d[["match_id", "victim"]])).to_numpy()
    dg = d.groupby("team")
    team["traded_death_rate"] = dg.traded.mean()
    team["isolated_death_rate"] = dg.isolated.mean()
    team["avg_trade_delay_s"] = dg.trade_delay_ms.mean() / 1000
    mt = t["matches"]
    maps = pd.concat([mt[["match_id", "team_red", "winner"]].rename(columns={"team_red": "team"}), mt[["match_id", "team_blue", "winner"]].rename(columns={"team_blue": "team"})])
    team["maps"] = maps.groupby("team").size()
    team["map_wins"] = maps.assign(w=maps.team == maps.winner).groupby("team").w.sum()

    team_map = tr.groupby(["team", "map"]).apply(lambda g: pd.Series({
        "maps": g.match_id.nunique(), "rounds": len(g), "round_win": g.won.mean(),
        "atk_win": g[g.side == "Ataque"].won.mean(), "def_win": g[g.side == "Defesa"].won.mean()}), include_groups=False).reset_index()
    mw = maps.merge(mt[["match_id", "map"]], on="match_id").assign(w=lambda x: x.team == x.winner).groupby(["team", "map"]).w.sum().rename("map_wins")
    team_map = team_map.join(mw, on=["team", "map"])

    team_buy = tr.groupby(["team", "buy"]).agg(rounds=("won", "size"), win=("won", "mean"), expected=("p0", "mean")).reset_index()
    team_buy["diff"] = team_buy.win - team_buy.expected

    league = summarize(tr).to_dict()
    league.update({
        "traded_death_rate": float(d.traded.mean()), "isolated_death_rate": float(d.isolated.mean()),
        "avg_trade_delay_s": float(d.trade_delay_ms.mean() / 1000),
        "buy": tr.groupby("buy").agg(win=("won", "mean"), expected=("p0", "mean"), rounds=("won", "size")).round(4).to_dict(orient="index"),
        "isolated_dist_units": ISOLATED_DIST, "throw_wp": THROW_WP, "comeback_wp": COMEBACK_WP,
    })
    return team.reset_index(), team_map, team_buy, tr, league


def main():
    t = load()
    dc, mates = death_context(t)
    pairs = pair_stats(t, mates)
    prof = player_profile(t, dc)
    team, team_map, team_buy, team_rounds, league = team_tables(t, dc)
    dc.to_parquet(P / "death_context.parquet", index=False)
    pairs.to_parquet(P / "pairs.parquet", index=False)
    prof.to_parquet(P / "player_profile.parquet", index=False)
    team.to_parquet(P / "team_profile.parquet", index=False)
    team_map.to_parquet(P / "team_map.parquet", index=False)
    team_buy.to_parquet(P / "team_buy.parquet", index=False)
    team_rounds.to_parquet(P / "team_rounds.parquet", index=False)
    (P / "league.json").write_text(json.dumps(league, indent=1, default=float, ensure_ascii=False), encoding="utf-8")
    print("pairs", len(pairs), "| players", len(prof), "(role-eligible", int(prof.role_eligible.sum()), ") | teams", len(team))


if __name__ == "__main__":
    main()
