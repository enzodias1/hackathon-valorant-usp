"""Round win-probability model + Win Probability Added (WPA) per event.

For every round we rebuild the state timeline (round start, each kill, the plant) and
estimate P(attackers win the round | state). The model is evaluated with GroupKFold by
match (no match appears in both train and test), and WPA is computed from out-of-fold
predictions so a match never grades itself.

State features
  atk_alive, def_alive          players alive per side
  atk_lo, def_lo                summed loadout value of the players still alive
  planted, t, t_since_plant     spike status and clock (seconds)

Outputs (data/processed/)
  wp_states.parquet   every state with its out-of-fold P(atk win)
  wp_events.parquet   every kill / plant / defuse with P before/after and credited WPA
  wp_report.json      evaluation metrics
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / "data" / "processed"
ASSIST_SHARE = 0.25  # share of a kill's WPA split among assistants (killer keeps the rest)
ROUND_TIMER_MS = 100_000  # round clock starts at the barrier drop
FEATS = ["atk_alive", "def_alive", "atk_lo", "def_lo", "planted", "t", "t_since_plant"]


def build_timelines():
    rd = pd.read_parquet(P / "rounds.parquet")
    kl = pd.read_parquet(P / "kills.parquet").sort_values(["match_id", "round_num", "kill_idx"])
    pr = pd.read_parquet(P / "player_round.parquet")
    rv = pd.read_parquet(P / "revives.parquet")

    lo = pr.set_index(["match_id", "round_num", "puuid"])["loadout"].to_dict()
    side = pr.set_index(["match_id", "round_num", "puuid"])["side"].to_dict()
    kills_by_round = {k: g for k, g in kl.groupby(["match_id", "round_num"])}
    players_by_round = {k: g["puuid"].tolist() for k, g in pr.groupby(["match_id", "round_num"])}
    revives_by_round = {k: list(g.itertuples(index=False)) for k, g in rv.groupby(["match_id", "round_num"])}

    states, events = [], []
    for r in rd.itertuples(index=False):
        key = (r.match_id, r.round_num)
        y = int(r.winner_side == "Ataque")
        alive = {pu: True for pu in players_by_round[key]}
        planted, plant_t = False, None

        def snap(t):
            s = {"atk_alive": 0, "def_alive": 0, "atk_lo": 0, "def_lo": 0}
            for pu, al in alive.items():
                if al:
                    sd = "atk" if side[key + (pu,)] == "Ataque" else "def"
                    s[f"{sd}_alive"] += 1
                    s[f"{sd}_lo"] += lo[key + (pu,)]
            s.update(planted=int(planted), t=t / 1000, t_since_plant=(t - plant_t) / 1000 if planted else 0.0)
            # nobody alive on a side: its equipment is missing, not 0. With 0 the model reads "equipment 0" as "everyone dead"
            # (they always came together) and an alive player who bought nothing (eco, free pistol) looked like a dead team
            for sd in ("atk", "def"):
                if s[f"{sd}_alive"] == 0:
                    s[f"{sd}_lo"] = np.nan
            return s

        timeline = []
        g = kills_by_round.get(key)
        if g is not None:
            for k in g.itertuples(index=False):
                timeline.append(("kill", k.t_round_ms, k))
        if r.planted:
            timeline.append(("plant", r.plant_time_ms, None))
        if r.defused:
            timeline.append(("defuse", r.defuse_time_ms, None))
        # revives (Sage/Clove ultimates) are events of their own, credited to whoever revived: alive again from the record
        # where the player shows up again (see etl.py); the exact moment is somewhere since the previous record
        for rv_row in revives_by_round.get(key, []):
            timeline.append(("revive", rv_row.t_round_ms, rv_row))
        # a revive before the record that shows it; plant before a kill at the same ms; defuse last
        order = {"revive": -1, "plant": 0, "kill": 1, "defuse": 2}
        timeline.sort(key=lambda e: (e[1], order[e[0]], getattr(e[2], "kill_idx", 0) if e[2] is not None else 0))

        # the round is decided at the defuse, at the detonation (spike timer 45 s) or when the round timer runs out (100 s after
        # the barrier drops); events after that change nothing (e.g. a plant completed at 100.04 s in a round lost on time)
        end_t = (r.defuse_time_ms if r.defused else r.plant_time_ms + 45000 if r.planted and r.result_code == "Detonate"
                 else ROUND_TIMER_MS if r.result_code == "Timer" else None)

        base = {"match_id": r.match_id, "round_num": r.round_num, "y": y, "anomalous": r.anomalous}
        states.append({**base, "seq": 0, "kind": "start", "post_end": False, **snap(0)})
        seq = 1
        for kind, t, k in timeline:
            post_end = end_t is not None and t > end_t
            before = snap(t)
            if kind == "kill":
                alive[k.victim] = False
            elif kind == "revive":
                alive[k.puuid] = True
            elif kind == "plant":
                planted, plant_t = True, t
            after = snap(t) if kind != "defuse" else None
            states.append({**base, "seq": seq, "kind": f"pre_{kind}", "post_end": post_end, **before})
            if after is not None:
                states.append({**base, "seq": seq + 1, "kind": f"post_{kind}", "post_end": post_end, **after})
            events.append({
                **base, "pre_seq": seq, "post_seq": seq + 1 if after is not None else None, "event": kind, "t_round_ms": t, "post_end": post_end,
                "actor": (k.killer if kind == "kill" else r.planter if kind == "plant" else k.by if kind == "revive" else r.defuser),
                "victim": k.victim if kind == "kill" else None,
                "target": k.puuid if kind == "revive" else None,
                "kill_idx": k.kill_idx if kind == "kill" else None,
                "assistants": k.assistants if kind == "kill" else "",
                "teamkill": bool(k.teamkill or k.self_kill) if kind == "kill" else False,
                "actor_side": (k.killer_side if kind == "kill" else "Ataque" if kind == "plant" else "Defesa" if kind == "defuse"
                               else side[key + (k.puuid,)]),
            })
            seq += 2
    return pd.DataFrame(states), pd.DataFrame(events)


def terminal_rules(df):
    """Terminal states are (almost) decided: all defenders dead -> attackers win; all attackers dead without the
    spike -> defenders win. Empirically 99.9% hold (the rest are revives between two records), but a few
    out-of-distribution states get odd predictions, so we floor/cap them. Applied after evaluation metrics."""
    df.loc[df.def_alive == 0, "p_atk"] = df.loc[df.def_alive == 0, "p_atk"].clip(lower=0.99)
    m = (df.atk_alive == 0) & (df.planted == 0)
    df.loc[m, "p_atk"] = df.loc[m, "p_atk"].clip(upper=0.01)


SPIKE_BANDS = [-1, 3.5, 5, 7, 8, 10, 15, 46]  # seconds of spike left


def spike_rule(fit, apply, pred):
    """Attackers all dead with the spike planted: the defense only has to defuse in time. Too few of these states (~1,300,
    150 with under 10 s left) for the model to learn the 7 s defuse limit (it gave the attack 67% with under 3.5 s left,
    where it wins 100%), so they take the empirical rate of their band of spike time left, from `fit` (smoothed)."""
    def band(d):
        return pd.cut((45 - d.t_since_plant).clip(-0.5, 45.5), SPIKE_BANDS)
    sel = lambda d: (d.atk_alive == 0) & (d.planted == 1)
    f = fit[sel(fit)]
    rates = f.groupby(band(f), observed=False).y.agg(["sum", "size"])
    rates = (rates["sum"] + 0.5) / (rates["size"] + 1)
    m = sel(apply).to_numpy()
    if m.any():
        pred[m] = band(apply[m]).map(rates).astype(float).to_numpy()
    return pred


def evaluate_and_predict(states):
    # train only on live states: anomalous rounds and states after the round was decided are excluded. The instant a defuse
    # completes is excluded too: the defense always wins from there (the defuse in progress is not in the data), so those
    # states taught the model that "attackers dead, little spike time" favors the defense, the opposite of when the last
    # attacker dies. They still get out-of-fold predictions (the "before" of each defuse).
    live = ~states.anomalous & ~states.post_end
    train = states[live & (states.kind != "pre_defuse")].reset_index(drop=True)
    extra = states[live & (states.kind == "pre_defuse")].reset_index(drop=True)
    X, y, groups = train[FEATS].to_numpy(float), train["y"].to_numpy(), train["match_id"].to_numpy()
    Xe = extra[FEATS].to_numpy(float)
    extra_pred = {}
    models = {
        "logistic": lambda: make_pipeline(SimpleImputer(strategy="constant", fill_value=0), StandardScaler(), LogisticRegression(max_iter=2000)),
        "gbm": lambda: HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, max_leaf_nodes=31, l2_regularization=1.0,
                                                      monotonic_cst=[1, -1, 1, -1, 1, 0, 0], random_state=0),
    }
    gkf = GroupKFold(n_splits=5)
    report, oof = {}, {}
    for name, mk in models.items():
        pred = np.zeros(len(train))
        epred = np.zeros(len(extra))
        for tr, te in gkf.split(X, y, groups):
            m = mk().fit(X[tr], y[tr])
            pred[te] = spike_rule(train.iloc[tr], train.iloc[te], m.predict_proba(X[te])[:, 1])
            em = extra.match_id.isin(set(groups[te])).to_numpy()
            if em.any():
                epred[em] = spike_rule(train.iloc[tr], extra[em], m.predict_proba(Xe[em])[:, 1])
        oof[name] = pred
        extra_pred[name] = epred
        bins = pd.cut(pred, np.linspace(0, 1, 11), include_lowest=True)
        cal = pd.DataFrame({"p": pred, "y": y, "bin": bins}).groupby("bin", observed=True).agg(p=("p", "mean"), y=("y", "mean"), n=("y", "size"))
        report[name] = {
            "log_loss": round(log_loss(y, pred), 4), "brier": round(brier_score_loss(y, pred), 4), "auc": round(roc_auc_score(y, pred), 4),
            "ece": round(float((cal.n * (cal.p - cal.y).abs()).sum() / cal.n.sum()), 4),
            "calibration": cal.round(3).reset_index(drop=True).to_dict(orient="records"),
        }
    # baseline: empirical win rate by (atk_alive, def_alive, planted) — what a lookup table would give
    key = train["atk_alive"].astype(str) + "v" + train["def_alive"].astype(str) + "p" + train["planted"].astype(str)
    base = np.zeros(len(train))
    for tr, te in gkf.split(X, y, groups):
        rates = pd.Series(y[tr]).groupby(key.iloc[tr].to_numpy()).mean()
        base[te] = key.iloc[te].map(rates).fillna(y[tr].mean()).clip(0.01, 0.99).to_numpy()
    report["baseline_alive_lookup"] = {"log_loss": round(log_loss(y, base), 4), "brier": round(brier_score_loss(y, base), 4), "auc": round(roc_auc_score(y, base), 4)}
    best = min(models, key=lambda n: report[n]["log_loss"])
    report["chosen"] = best
    report["n_states"], report["n_rounds"], report["n_matches"] = int(len(train)), int(train.groupby(["match_id", "round_num"]).ngroups), int(train.match_id.nunique())
    train["p_atk"] = oof[best]
    terminal_rules(train)
    extra["p_atk"] = extra_pred[best]
    terminal_rules(extra)

    # anomalous rounds still get predictions (from a model fit on everything else) so the UI can show them, flagged;
    # after the round is decided the probability is simply the outcome (so post-round kills carry zero WPA)
    rest = states[states.anomalous | states.post_end].copy()
    if len(rest):
        rest["p_atk"] = spike_rule(train, rest, models[best]().fit(X, y).predict_proba(rest[FEATS].to_numpy(float))[:, 1])
        terminal_rules(rest)
        rest.loc[rest.post_end, "p_atk"] = rest.loc[rest.post_end, "y"].astype(float)
    return pd.concat([train, extra, rest], ignore_index=True), report


def credit_events(states, events):
    p = states.set_index(["match_id", "round_num", "seq"])["p_atk"]
    ev = events.copy()
    ev["p_atk_before"] = [p[(m, r, s)] for m, r, s in zip(ev.match_id, ev.round_num, ev.pre_seq)]
    ev["p_atk_after"] = [p[(m, r, int(s))] if pd.notna(s) else float(y) for m, r, s, y in zip(ev.match_id, ev.round_num, ev.post_seq, ev.y)]
    # WPA from the actor's side perspective
    d_atk = ev["p_atk_after"] - ev["p_atk_before"]
    ev["wpa"] = np.where(ev["actor_side"] == "Ataque", d_atk, -d_atk)
    ev.loc[ev.teamkill, "wpa"] = 0.0  # team/self kills: no positive credit to the "killer"
    ev["delta_atk"] = d_atk
    return ev


def player_credits(ev):
    """Explode events into per-player credit rows: killer, assistants, victim (negative), planter, defuser."""
    rows = []
    for e in ev.itertuples(index=False):
        base = {"match_id": e.match_id, "round_num": e.round_num, "event": e.event, "t_round_ms": e.t_round_ms}
        if e.event == "kill":
            assists = [a for a in (e.assistants or "").split(",") if a]
            if not e.teamkill:
                share = ASSIST_SHARE if assists else 0.0
                rows.append({**base, "puuid": e.actor, "kind": "kill", "wpa": e.wpa * (1 - share)})
                for a in assists:
                    rows.append({**base, "puuid": a, "kind": "assist", "wpa": e.wpa * share / len(assists)})
            # the victim's side lost exactly what the killer's side gained (teamkills: full swing against the victim's side)
            victim_loss = -abs(e.delta_atk) if e.teamkill else -e.wpa
            rows.append({**base, "puuid": e.victim, "kind": "death", "wpa": victim_loss})
        elif e.actor:
            rows.append({**base, "puuid": e.actor, "kind": e.event, "wpa": e.wpa})
    return pd.DataFrame(rows)


def main():
    states, events = build_timelines()
    states, report = evaluate_and_predict(states)
    ev = credit_events(states, events)
    credits = player_credits(ev)
    states.to_parquet(P / "wp_states.parquet", index=False)
    ev.to_parquet(P / "wp_events.parquet", index=False)
    credits.to_parquet(P / "wp_credits.parquet", index=False)
    (P / "wp_report.json").write_text(json.dumps(report, indent=1, default=str), encoding="utf-8")
    for k in ("logistic", "gbm", "baseline_alive_lookup"):
        print(k, {m: report[k][m] for m in ("log_loss", "brier", "auc")}, "ece", report[k].get("ece"))
    print("chosen:", report["chosen"], "| states", report["n_states"], "rounds", report["n_rounds"])
    print("calibration (chosen):")
    print(pd.DataFrame(report[report["chosen"]]["calibration"]).to_string())


if __name__ == "__main__":
    main()
