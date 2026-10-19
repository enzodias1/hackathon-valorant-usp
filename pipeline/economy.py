"""Economy advisor: "force or save?" when the team cannot afford a full buy.

Decision zone: non-pistol rounds of regulation where the team's credits + carried equipment < 20k (no full buy).
Decision (by how much of the available credits was spent): Economizar <= 35% · Meio-termo · Forçar >= 65%.
Outcome: rounds won in this round and the next 2 (same half; observations whose horizon is cut by the end of the
map are dropped). Effects vs. Economizar come from a linear model with controls (credits, carried equipment,
opponent credits/equipment, strength difference, side, score, round number) and a match-level bootstrap.
This is observational evidence ("in similar situations, teams that forced won X more rounds"), not proof of causality.

Writes data/processed/economy.json (league) and economy_team.parquet (each team's decisions).
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / "data" / "processed"
FULL_BUY = 20000
SAVE_MAX, FORCE_MIN = 0.35, 0.65
DECISIONS = ["Economizar", "Meio-termo", "Forçar"]
CONTEXTS = ["perdeu o pistol", "perdeu o round anterior"]
BOOT = 1000
CONTROLS = ["credits", "carried", "opp_credits", "opp_carried", "sdiff", "atk", "score_diff", "round_num"]


def build():
    pr = pd.read_parquet(P / "player_round.parquet")
    pm = pd.read_parquet(P / "player_match.parquet")
    rd = pd.read_parquet(P / "rounds.parquet")
    pr["credits"] = pr.spent + pr.bank
    pr["carried"] = (pr.loadout - pr.spent).clip(lower=0)
    g = pr.groupby(["match_id", "round_num", "team_color"]).agg(
        credits=("credits", "sum"), spent=("spent", "sum"), loadout=("loadout", "sum"), carried=("carried", "sum"), won=("won_round", "first")).reset_index()
    team = pm.groupby(["match_id", "team_color"]).team.first()
    g["team"] = team.reindex(pd.MultiIndex.from_frame(g[["match_id", "team_color"]])).to_numpy()
    anomalous = rd.set_index(["match_id", "round_num"]).anomalous
    g = g[~anomalous.reindex(pd.MultiIndex.from_frame(g[["match_id", "round_num"]])).to_numpy()]
    opp = g[["match_id", "round_num", "team_color", "credits", "carried", "team"]].copy()
    opp["team_color"] = opp.team_color.map({"Red": "Blue", "Blue": "Red"})
    g = g.merge(opp.rename(columns={"credits": "opp_credits", "carried": "opp_carried", "team": "opp_team"}), on=["match_id", "round_num", "team_color"])

    # leave-one-match-out strength (round win rate in the team's other maps, lightly shrunk to 50%)
    tot = g.groupby("team").won.agg(["sum", "size"])
    per = g.groupby(["team", "match_id"]).won.agg(["sum", "size"])
    def loo(tm, mid):
        n = tot.loc[tm, "size"] - per.loc[(tm, mid), "size"]
        return (tot.loc[tm, "sum"] - per.loc[(tm, mid), "sum"] + 5) / (n + 10) if n > 0 else 0.5
    st = {k: loo(*k) for k in g[["team", "match_id"]].drop_duplicates().itertuples(index=False, name=None)}
    g["sdiff"] = [st[(a, b)] - st[(c, b)] for a, c, b in zip(g.team, g.opp_team, g.match_id)]

    w = g.set_index(["match_id", "team_color", "round_num"]).won
    def horizon(m, c, n, k=3):
        if n + k - 1 > (11 if n < 12 else 23):
            return np.nan
        vals = [w.get((m, c, j), np.nan) for j in range(n, n + k)]
        return np.nan if any(pd.isna(v) for v in vals) else float(sum(vals))
    keys = list(zip(g.match_id, g.team_color, g.round_num))
    for k in (2, 3, 4):
        g[f"w{k}"] = [horizon(*key, k=k) for key in keys]
    g["prev_won"] = [w.get((m, c, n - 1), np.nan) for m, c, n in keys]
    g["next_loadout"] = g.groupby(["match_id", "team_color"]).loadout.shift(-1)
    side = rd.set_index(["match_id", "round_num"]).attacker_color
    g["atk"] = (side.reindex(pd.MultiIndex.from_frame(g[["match_id", "round_num"]])).to_numpy() == g.team_color).astype(float)
    g["my_score"] = g.groupby(["match_id", "team_color"]).won.cumsum() - g.won
    sc = g.set_index(["match_id", "team_color", "round_num"]).my_score
    g["score_diff"] = g.my_score - sc.reindex(pd.MultiIndex.from_arrays([g.match_id, g.team_color.map({"Red": "Blue", "Blue": "Red"}), g.round_num])).to_numpy()

    z = g[~g.round_num.isin([0, 12]) & (g.round_num < 24) & ((g.credits + g.carried) < FULL_BUY)].copy()
    frac = z.spent / z.credits.clip(lower=1)
    z["decision"] = np.select([frac <= SAVE_MAX, frac >= FORCE_MIN], ["Economizar", "Forçar"], "Meio-termo")
    z["context"] = np.select([z.round_num.isin([1, 13]) & (z.prev_won == 0), z.prev_won == 0], CONTEXTS, "outro")
    z["credit_band"] = pd.cut(z.credits, [0, 8000, 12000, 16000, FULL_BUY], labels=["< 8 mil", "8–12 mil", "12–16 mil", "16–20 mil"]).astype(str)
    return z


def effects(d, y="w3", controls=CONTROLS, boot=BOOT, seed=1):
    """Adjusted difference vs Economizar for each decision with >= 15 rows: estimate + 90% match-bootstrap CI."""
    d = d[d[y].notna()].reset_index(drop=True)
    cols = [c for c in ("Meio-termo", "Forçar") if (d.decision == c).sum() >= 15]
    if (d.decision == "Economizar").sum() < 15 or not cols:
        return {}, len(d)
    X = pd.get_dummies(d.decision).reindex(columns=cols, fill_value=0).astype(float)
    for c in controls:
        X[c] = d[c].to_numpy()
    X, Y = X.to_numpy(), d[y].to_numpy(float)
    est = LinearRegression().fit(X, Y).coef_[:len(cols)]
    groups = [np.flatnonzero(d.match_id.to_numpy() == mid) for mid in d.match_id.unique()]
    rng = np.random.default_rng(seed)
    B = np.array([LinearRegression().fit(X[i], Y[i]).coef_[:len(cols)]
                  for i in (np.concatenate([groups[j] for j in rng.integers(0, len(groups), len(groups))]) for _ in range(boot))])
    return {c: {"effect": float(est[k]), "ci90": [float(np.percentile(B[:, k], 5)), float(np.percentile(B[:, k], 95))],
                "significant": bool(np.percentile(B[:, k], 5) > 0 or np.percentile(B[:, k], 95) < 0)} for k, c in enumerate(cols)}, len(d)


def describe(d):
    out = {}
    for dec in DECISIONS:
        x = d[d.decision == dec]
        if len(x):
            out[dec] = {"n": int(len(x)), "win_now": float(x.won.mean()), "rounds_next3": float(x.w3.mean()) if x.w3.notna().any() else None,
                        "n_next3": int(x.w3.notna().sum()), "next_full_buy": float((x.next_loadout >= FULL_BUY).mean()),
                        "avg_credits": float(x.credits.mean()), "avg_spent": float(x.spent.mean())}
    return out


def main():
    z = build()
    league = {"definitions": {"full_buy_credits": FULL_BUY, "save_max_spent_share": SAVE_MAX, "force_min_spent_share": FORCE_MIN,
                              "horizon_rounds": 3, "controls": ["dinheiro do time", "armas carregadas", "dinheiro e armas do adversário",
                                                               "diferença de força dos times", "lado", "placar", "número do round"]},
              "contexts": {}}
    for ctx in CONTEXTS:
        d = z[z.context == ctx]
        eff, n = effects(d)
        # robustness: the same comparison under other specifications (shown on the page for transparency)
        specs = {
            "Horizonte de 2 rounds": dict(y="w2"),
            "Horizonte de 4 rounds": dict(y="w4"),
            "Só confrontos equilibrados": dict(sub=d.sdiff.abs() < 0.05),
            "Só o próprio round (chance de vencer)": dict(y="won"),
            "Sem controles de lado, placar e round": dict(controls=CONTROLS[:5]),
        }
        robust = {}
        for name, s in specs.items():
            e2, n2 = effects(d[s["sub"]] if "sub" in s else d, y=s.get("y", "w3"), controls=s.get("controls", CONTROLS), boot=500)
            robust[name] = {"n": n2, "effects": e2}
        bands = {band: describe(x) for band, x in d.groupby("credit_band")}
        league["contexts"][ctx] = {"n": int(len(d)), "n_horizon": n, "decisions": describe(d), "adjusted_vs_save": eff,
                                   "robustness": robust, "by_credits": bands}
        print(ctx, {k: (round(v["effect"], 2), [round(c, 2) for c in v["ci90"]]) for k, v in eff.items()})
    (P / "economy.json").write_text(json.dumps(league, ensure_ascii=False, indent=1), encoding="utf-8")

    # each team's own decisions in the decision zone
    tz = z[z.context.isin(CONTEXTS)]
    team = tz.groupby(["team", "context", "decision"]).agg(n=("won", "size"), wins=("won", "sum"), rounds_next3=("w3", "mean")).reset_index()
    team.to_parquet(P / "economy_team.parquet", index=False)
    print("teams with decisions:", team.team.nunique())


if __name__ == "__main__":
    main()
