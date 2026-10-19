"""Team strength (Bradley-Terry on rounds, net of economy) and evolution across the championship.

Strength: logit P(team A wins the round) = theta_A - theta_B + beta * logit(p_econ), where p_econ is the
win-probability model's estimate at round start (economy only). Ridge-regularized, so teams with few maps
are pulled toward the league average instead of getting extreme ratings.

Evolution (per team): for each stage of the championship, rounds won above/below what was expected given the
opponent's strength and the economy -> "playing above your own level"; plus first-half vs second-half
comparisons of the collective metrics (two-proportion z-tests) -> "what changed".

Writes data/processed/: team_strength.parquet, team_stage.parquet, team_changes.parquet, player_stage.parquet
"""
import math
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.special import expit, logit
from sklearn.linear_model import LogisticRegression

from insights import TEAM_METRICS, Z_SIGNIFICANT

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / "data" / "processed"
MIN_MAPS_EVOLUTION = 8
STAGE_ORDER = ["Rush Series Esquenta", "Rush Series Esquenta 2", "Univavá · Classificatória 1", "Univavá · Classificatória 2",
               "Rush Series Inclusivo", "Univavá · Classificatória 3", "Univavá · Classificatória 4", "Univavá · Fase de Grupos"]
CHANGE_KEYS = ["atk_win", "def_win", "fb_rate", "win_after_fb", "postplant_win", "retake_win", "throw_rate", "traded_death_rate", "isolated_death_rate"]


def stage_of(m):
    return m.competition + m.stage.fillna("").map(lambda s: f" · {s}" if s else "")


def fit_strength(tr):
    """One row per round (attacker perspective). Returns theta per team and beta (economy weight)."""
    atk = tr[tr.side == "Ataque"].copy()
    teams = sorted(set(tr.team) | set(tr.opponent))
    idx = {t: i for i, t in enumerate(teams)}
    X = np.zeros((len(atk), len(teams) + 1))
    rows = np.arange(len(atk))
    X[rows, atk.team.map(idx).to_numpy()] = 1.0
    X[rows, atk.opponent.map(idx).to_numpy()] = -1.0
    X[:, -1] = logit(atk.p0.clip(0.01, 0.99).to_numpy())
    m = LogisticRegression(fit_intercept=False, C=0.5, max_iter=5000).fit(X, atk.won.astype(int).to_numpy())
    theta = pd.Series(m.coef_[0][:-1], index=teams)
    return theta - theta.mean(), float(m.coef_[0][-1])


def expected_p(df, theta, beta):
    """P(team wins the round) from strengths + economy, for team-perspective rows."""
    return expit(df.team.map(theta).to_numpy() - df.opponent.map(theta).to_numpy() + beta * logit(df.p0.clip(0.01, 0.99).to_numpy()))


def two_prop(k1, n1, k2, n2):
    if n1 == 0 or n2 == 0:
        return None
    p = (k1 + k2) / (n1 + n2)
    se = math.sqrt(max(p * (1 - p), 1e-9) * (1 / n1 + 1 / n2))
    return (k2 / n2 - k1 / n1) / se


def main():
    tr = pd.read_parquet(P / "team_rounds.parquet")
    dc = pd.read_parquet(P / "death_context.parquet")
    m = pd.read_parquet(P / "matches.parquet")
    pm = pd.read_parquet(P / "player_match.parquet")
    pr = pd.read_parquet(P / "player_round.parquet")
    cr = pd.read_parquet(P / "wp_credits.parquet")

    m["etapa"] = stage_of(m)
    m["etapa_idx"] = m.etapa.map({s: i for i, s in enumerate(STAGE_ORDER)})
    tr = tr.merge(m[["match_id", "date", "etapa", "etapa_idx"]], on="match_id")
    team_of = pm.set_index(["match_id", "puuid"])["team"]
    dc["team"] = team_of.reindex(pd.MultiIndex.from_frame(dc[["match_id", "victim"]])).to_numpy()
    dc = dc.merge(m[["match_id", "date", "etapa", "etapa_idx"]], on="match_id")

    # ---- strength
    theta, beta = fit_strength(tr)
    tr["p_exp"] = expected_p(tr, theta, beta)
    rounds_n = tr.groupby("team").size()
    strength = pd.DataFrame({"team": theta.index, "theta": theta.values})
    strength["rounds"] = strength.team.map(rounds_n).fillna(0).astype(int)
    # rating as "P(win a round vs an average team, even economy)"
    strength["p_vs_avg"] = expit(strength.theta)
    strength["rank"] = strength.theta.rank(ascending=False, method="min").astype(int)
    print(f"strength: beta (economy) = {beta:.2f}; theta range {theta.min():+.2f} .. {theta.max():+.2f}")

    # sanity: strength + economy should predict rounds out-of-sample-ish better than economy alone (in-sample check)
    from sklearn.metrics import log_loss
    print("log loss economy only:", round(log_loss(tr.won, tr.p0.clip(0.01, 0.99)), 4), "| economy + strength:", round(log_loss(tr.won, tr.p_exp), 4))

    # ---- per team per stage: performance above own level (vs strength + economy)
    rows = []
    for (team, etapa), g in tr.groupby(["team", "etapa"]):
        W, E, V = g.won.sum(), g.p_exp.sum(), (g.p_exp * (1 - g.p_exp)).sum()
        d = dc[(dc.team == team) & (dc.etapa == etapa)]
        rows.append({"team": team, "etapa": etapa, "etapa_idx": int(g.etapa_idx.iloc[0]), "date": g.date.min(),
                     "maps": g.match_id.nunique(), "rounds": len(g), "round_win": g.won.mean(),
                     "opp_theta": g.opponent.map(theta).mean(),
                     "above_level_per100": (W - E) / len(g) * 100, "above_level_z": (W - E) / math.sqrt(V) if V > 0 else 0.0,
                     "above_level_se100": 100 * math.sqrt(V) / len(g),
                     "traded_death_rate": d.traded.mean() if len(d) else np.nan, "isolated_death_rate": d.isolated.mean() if len(d) else np.nan})
    stage = pd.DataFrame(rows).sort_values(["team", "etapa_idx"])

    # ---- first half vs second half of each team's maps (chronological), ADJUSTED for opponent strength + economy.
    # For each metric, a league-wide logistic model (team level + opponent strength [+ economy]) gives the expected
    # probability of every event; the change is (observed - expected) in the late half minus the early half.
    opp_of = tr.drop_duplicates(["match_id", "team"]).set_index(["match_id", "team"]).opponent
    dc["opponent"] = opp_of.reindex(pd.MultiIndex.from_frame(dc[["match_id", "team"]])).to_numpy()
    dc = dc[dc.opponent.notna()]
    tr["opp_theta"], dc["opp_theta"] = tr.opponent.map(theta), dc.opponent.map(theta)
    tr["lp0"] = logit(tr.p0.clip(0.01, 0.99))
    atk, dfn = tr.side == "Ataque", tr.side == "Defesa"
    specs = {  # key -> (frame, row mask, outcome, covariates)
        "atk_win": (tr, atk, "won", ["opp_theta", "lp0"]),
        "def_win": (tr, dfn, "won", ["opp_theta", "lp0"]),
        "fb_rate": (tr, tr.first_blood | tr.first_death, "first_blood", ["opp_theta"]),
        "win_after_fb": (tr, tr.first_blood, "won", ["opp_theta", "lp0"]),
        "postplant_win": (tr, atk & tr.planted, "won", ["opp_theta", "lp0"]),
        "retake_win": (tr, dfn & tr.planted, "won", ["opp_theta", "lp0"]),
        "throw_rate": (tr, tr.wp_max >= 0.8, "throw", ["opp_theta"]),
        "traded_death_rate": (dc, pd.Series(True, index=dc.index), "traded", ["opp_theta"]),
        "isolated_death_rate": (dc, dc.isolated.notna(), "isolated", ["opp_theta"]),
    }
    expected = {}
    for k, (frame, mask, y, covs) in specs.items():
        d = frame[mask].copy()
        X = pd.concat([pd.get_dummies(d.team, dtype=float), d[covs]], axis=1)
        mdl = LogisticRegression(C=1.0, max_iter=5000).fit(X.to_numpy(), d[y].astype(int).to_numpy())
        d["p_hat"] = mdl.predict_proba(X.to_numpy())[:, 1]
        d["y"] = d[y].astype(float)
        expected[k] = d[["match_id", "team", "y", "p_hat"]]

    changes = []
    for team, g in tr.groupby("team"):
        order = g.drop_duplicates("match_id").sort_values("date").match_id.tolist()
        if len(order) < MIN_MAPS_EVOLUTION:
            continue
        half = len(order) // 2
        early, late = set(order[:half]), set(order[half:])
        e, l = g[g.match_id.isin(early)], g[g.match_id.isin(late)]
        meta = {"team": team, "maps_before": len(early), "maps_after": len(late),
                "period_before": f"{e.date.min():%d/%m}–{e.date.max():%d/%m}", "period_after": f"{l.date.min():%d/%m}–{l.date.max():%d/%m}",
                "opp_theta_before": float(e.opp_theta.mean()), "opp_theta_after": float(l.opp_theta.mean())}
        for k in CHANGE_KEYS:
            d = expected[k][expected[k].team == team]
            a, b = d[d.match_id.isin(early)], d[d.match_id.isin(late)]
            if len(a) < 10 or len(b) < 10:
                continue
            ra, rb = (a.y - a.p_hat).mean(), (b.y - b.p_hat).mean()
            var = (a.p_hat * (1 - a.p_hat)).sum() / len(a) ** 2 + (b.p_hat * (1 - b.p_hat)).sum() / len(b) ** 2
            changes.append({**meta, "key": k, "label": TEAM_METRICS[k][0], "higher_is_better": TEAM_METRICS[k][1],
                            "before": a.y.mean(), "after": b.y.mean(), "n_before": len(a), "n_after": len(b),
                            "adj_change": rb - ra, "z": (rb - ra) / math.sqrt(var) if var > 0 else 0.0})
        lvl_e = (e.won.sum() - e.p_exp.sum()) / len(e) * 100
        lvl_l = (l.won.sum() - l.p_exp.sum()) / len(l) * 100
        var = (e.p_exp * (1 - e.p_exp)).sum() / len(e) ** 2 + (l.p_exp * (1 - l.p_exp)).sum() / len(l) ** 2
        z_lvl = ((lvl_l - lvl_e) / 100) / math.sqrt(var) if var > 0 else 0.0
        changes.append({**meta, "key": "above_level", "label": "Rounds acima do próprio nível (a cada 100)", "higher_is_better": True,
                        "before": lvl_e, "after": lvl_l, "n_before": len(e), "n_after": len(l), "adj_change": (lvl_l - lvl_e) / 100, "z": z_lvl})
    ch = pd.DataFrame(changes)
    ch["significant"] = ch.z.abs() >= Z_SIGNIFICANT
    ch["improved"] = np.where(ch.higher_is_better, ch.z > 0, ch.z < 0)

    # ---- players: impact per round by stage
    pr = pr.merge(m[["match_id", "etapa", "etapa_idx"]], on="match_id")
    rw = cr.groupby(["match_id", "round_num", "puuid"]).wpa.sum().mul(100).rename("wpa")
    pr = pr.join(rw, on=["match_id", "round_num", "puuid"]).fillna({"wpa": 0.0})
    pr["team"] = team_of.reindex(pd.MultiIndex.from_frame(pr[["match_id", "puuid"]])).to_numpy()
    ps = pr.groupby(["puuid", "team", "etapa", "etapa_idx"]).agg(rounds=("wpa", "size"), wpa_per_round=("wpa", "mean"),
                                                               kills=("kills", "sum"), deaths=("died", "sum")).reset_index()

    strength.to_parquet(P / "team_strength.parquet", index=False)
    stage.to_parquet(P / "team_stage.parquet", index=False)
    ch.to_parquet(P / "team_changes.parquet", index=False)
    ps.to_parquet(P / "player_stage.parquet", index=False)
    sig = ch[ch.significant]
    print(f"teams with evolution: {ch.team.nunique()} | significant changes: {len(sig)} "
          f"({int(sig.improved.sum())} improvements, {int((~sig.improved).sum())} regressions)")


if __name__ == "__main__":
    main()
