"""Consistency checks over the whole pipeline: properties that MUST hold if the numbers are right.

Run after export.py:  .venv/Scripts/python pipeline/checks.py
Prints PASS/FAIL per check and exits with code 1 if anything fails.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / "data" / "processed"
WEB = ROOT / "web" / "public" / "data"
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))


def main():
    t = {n: pd.read_parquet(P / f"{n}.parquet") for n in
         ("matches", "player_match", "rounds", "player_round", "kills", "wp_states", "wp_events", "wp_credits", "team_rounds", "death_context",
          "player_profile", "team_strength")}
    m, pm, rd, pr, kl, st, ev, cr, tr, dc, pf, ts = (t[k] for k in ("matches", "player_match", "rounds", "player_round", "kills", "wp_states",
                                                                  "wp_events", "wp_credits", "team_rounds", "death_context", "player_profile", "team_strength"))
    color = pm.set_index(["match_id", "puuid"]).team_color

    # ---------------------------------------------------------------- dados / ETL
    check("5 jogadores por time em cada partida", (pm.groupby(["match_id", "team_color"]).size() == 5).all())
    pl = rd[rd.planted]
    pc = color.reindex(pd.MultiIndex.from_frame(pl[["match_id", "planter"]])).to_numpy()
    check("quem planta é sempre do ataque", (pc == pl.attacker_color.to_numpy()).all(), f"{(pc != pl.attacker_color.to_numpy()).sum()} exceções")
    df_ = rd[rd.defused]
    dfc = color.reindex(pd.MultiIndex.from_frame(df_[["match_id", "defuser"]])).to_numpy()
    check("quem desarma é sempre da defesa", (dfc == df_.defender_color.to_numpy()).all(), f"{(dfc != df_.defender_color.to_numpy()).sum()} exceções")
    reg = rd[rd.round_num < 24]
    first = reg[reg.round_num < 12].groupby("match_id").attacker_color.nunique()
    second = reg[reg.round_num >= 12].groupby("match_id").attacker_color.nunique()
    a1 = reg[reg.round_num == 0].set_index("match_id").attacker_color
    a2 = reg[reg.round_num == 12].set_index("match_id").attacker_color
    check("lados fixos em cada tempo e trocados no intervalo", (first == 1).all() and (second == 1).all() and (a1.reindex(a2.index) != a2).all())
    ot = rd[rd.round_num >= 24].sort_values(["match_id", "round_num"])
    alt = ot.groupby("match_id").attacker_color.apply(lambda s: (s.values[1:] != s.values[:-1]).all() if len(s) > 1 else True)
    check("na prorrogação os lados alternam a cada round", alt.all(), f"{(~alt).sum()} partidas com problema" if len(alt) else "sem prorrogação")
    sc = m.assign(total=m.rounds_red + m.rounds_blue, win=m[["rounds_red", "rounds_blue"]].max(axis=1), lose=m[["rounds_red", "rounds_blue"]].min(axis=1))
    okscore = ((sc.win == 13) & (sc.lose <= 11)) | ((sc.win >= 13) & (sc.win - sc.lose == 2))
    check("placares válidos (13 com até 11, ou prorrogação por 2)", okscore.all(), f"{(~okscore).sum()} placares fora do padrão: {sc[~okscore][['rounds_red','rounds_blue']].values.tolist()[:5]}")
    check("rounds da partida = soma do placar", (sc.total == sc.rounds_total).all())
    fb = pr.groupby(["match_id", "round_num"]).agg(fk=("first_kill", "sum"), fd=("first_death", "sum"))
    has_kill = kl[~kl.teamkill & ~kl.self_kill].groupby(["match_id", "round_num"]).size()
    check("um first kill e um first death por round com kills", ((fb.fk == 1) == (fb.fd == 1)).all() and (fb.fk.sum() == len(has_kill)),
          f"FK {int(fb.fk.sum())} · FD {int(fb.fd.sum())} · rounds com kill {len(has_kill)}")
    tk = kl[kl.traded]
    tcol = color.reindex(pd.MultiIndex.from_frame(tk[["match_id", "traded_by"]])).to_numpy()
    check("trade: quem vinga é do time da vítima, em até 5 s", (tcol == tk.victim_color.to_numpy()).all() and (tk.trade_delay_ms <= 5000).all())

    # ---------------------------------------------------------------- probabilidade de vitória / impacto
    check("probabilidades entre 0 e 1", st.p_atk.between(0, 1).all())
    # vivos que o modelo considera em cada evento = vivos registrados pela Riot naquele instante (ressurreições da Sage e da
    # Clove incluídas). Sobram só kills no mesmo milissegundo (o registro ainda lista a outra vítima) e agentes dentro de
    # uma ultimate (Omen, Yoru...), que somem do registro por um instante
    pos = pd.read_parquet(P / "positions.parquet")
    atk_c = rd.set_index(["match_id", "round_num"]).attacker_color
    pos["atk"] = pos.color.to_numpy() == atk_c.reindex(pd.MultiIndex.from_frame(pos[["match_id", "round_num"]])).to_numpy()
    cnt = pos.groupby(["match_id", "round_num", "event", "event_idx"]).atk.agg(n_atk="sum", n="size")
    cnt["n_def"] = cnt.n - cnt.n_atk
    ea = ev[~ev.post_end & ~ev.anomalous].assign(event_idx=lambda d: d.kill_idx.fillna(-1).astype(int))
    ea = ea.join(cnt, on=["match_id", "round_num", "event", "event_idx"], how="inner")
    ea = ea.join(st.set_index(["match_id", "round_num", "seq"])[["atk_alive", "def_alive"]], on=["match_id", "round_num", "pre_seq"])
    vs = kl.set_index(["match_id", "round_num", "kill_idx"]).victim_side.reindex(pd.MultiIndex.from_arrays([ea.match_id, ea.round_num, ea.event_idx])).to_numpy()
    ea["n_atk"] += vs == "Ataque"
    ea["n_def"] += vs == "Defesa"
    same = (ea.atk_alive == ea.n_atk) & (ea.def_alive == ea.n_def)
    fewer = (ea.atk_alive < ea.n_atk) | (ea.def_alive < ea.n_def)
    check("vivos do modelo = vivos registrados pela Riot em cada evento (com ressurreições)", same.mean() > 0.999 and fewer.mean() < 0.0005,
          f"{same.mean():.2%} de {len(ea)} eventos; modelo com menos vivos: {int(fewer.sum())}")
    # zero-sum: what the killer's side gains, the victim's side loses (team kills / suicides excluded on purpose:
    # the victim's side loses and nobody gains)
    tk_times = ev[(ev.event == "kill") & ev.teamkill].set_index(["match_id", "round_num", "t_round_ms"]).index
    ck = cr[cr.event == "kill"].groupby(["match_id", "round_num", "t_round_ms"]).wpa.sum()
    ck = ck[~ck.index.isin(tk_times)]
    check("impacto soma zero em cada kill (exceto team kill)", (ck.abs() < 1e-9).all(), f"{(ck.abs() >= 1e-9).sum()} kills com soma ≠ 0 de {len(ck)}")
    # the decisive kill gets full credit: after the last kill of an elimination round, the winner is at ~100%
    last = ev[(ev.event == "kill") & ~ev.post_end].sort_values("t_round_ms").groupby(["match_id", "round_num"]).tail(1).set_index(["match_id", "round_num"])
    elim = rd[(rd.result_code == "Elimination") & ~rd.anomalous].set_index(["match_id", "round_num"])
    gap = (last.y - last.p_atk_after).abs().reindex(elim.index).dropna()
    check("após a última kill de um round de eliminação, vencedor com ~100%", (gap < 0.011).mean() > 0.99,
          f"{(gap >= 0.011).sum()} rounds fora de {len(gap)} (máx. {gap.max():.3f})")
    # time drift (chance changing only because the clock runs) is not credited to anyone, by design: report its size
    start = st[st.kind == "start"].set_index(["match_id", "round_num"])
    live = ev[~ev.post_end].groupby(["match_id", "round_num"]).delta_atk.sum()
    drift = (start.y - start.p_atk - live.reindex(start.index).fillna(0)).abs()
    by_res = drift.groupby(rd.set_index(["match_id", "round_num"]).result_code.reindex(start.index)).mean()
    check("(info) variação só pelo tempo, não creditada", True, " · ".join(f"{k} {v:.3f}" for k, v in by_res.items()))
    et = ev.merge(rd[["match_id", "round_num", "result_code"]], on=["match_id", "round_num"])
    late = et[(et.result_code == "Timer") & (et.t_round_ms > 100_000)]
    check("rounds por tempo: nada depois dos 100 s conta como jogada", late.post_end.all(), f"{len(late)} eventos, {int((~late.post_end).sum())} contando")
    check("eventos após o fim do round valem zero", ev[ev.post_end].wpa.abs().max() < 1e-9 if ev.post_end.any() else True)

    # ---------------------------------------------------------------- jogadores
    w = pf.rounds
    adr, kast, hs = (pf.damage.sum() / w.sum()), (pf.kast_rounds.sum() / w.sum()), pf.hs.sum() / (pf.hs + pf.bs + pf.ls).sum()
    check("ADR, KAST e % de headshot da liga em faixas plausíveis", 110 < adr < 170 and 0.6 < kast < 0.8 and 0.12 < hs < 0.35,
          f"ADR {adr:.0f} · KAST {kast:.0%} · HS {hs:.0%}")
    check("K/D da liga ≈ 1", abs(pf.kills.sum() / pf.deaths.sum() - 1) < 0.05, f"{pf.kills.sum() / pf.deaths.sum():.3f}")
    cl = pr[pr.clutch_vs > 0].groupby("clutch_vs").clutch_won.agg(["mean", "size"])
    check("clutch: vitória cai com o número de inimigos", (np.diff(cl["mean"].to_numpy()) < 0).all(),
          " · ".join(f"1v{k} {r['mean']:.0%} (n={int(r['size'])})" for k, r in cl.iterrows()))
    e_ = pf[pf.role_eligible]
    check("papel e percentis para todo jogador elegível", e_.behavior_role.notna().all() and e_[[c for c in pf.columns if c.startswith("axis_")]].stack().between(0, 100).all())

    # ---------------------------------------------------------------- times / liga
    tr_ok = tr[tr.team.notna()]
    check("vitória de rounds da liga = 50%", abs(tr_ok.won.mean() - 0.5) < 1e-9)
    fbr = tr_ok[tr_ok.first_blood | tr_ok.first_death]
    check("first blood a favor na liga = 50%", abs(fbr.first_blood.mean() - 0.5) < 1e-9)
    a, b = tr_ok[tr_ok.first_blood].won.mean(), tr_ok[tr_ok.first_death].won.mean()
    check("vitória após FB + após FD = 100%", abs(a + b - 1) < 1e-9, f"{a:.3f} + {b:.3f}")
    pp_, rt = tr_ok[(tr_ok.side == "Ataque") & tr_ok.planted].won.mean(), tr_ok[(tr_ok.side == "Defesa") & tr_ok.planted].won.mean()
    check("pós-plant + retake = 100%", abs(pp_ + rt - 1) < 1e-9, f"{pp_:.3f} + {rt:.3f}")
    check("rounds jogados fora = viradas (cada throw é a virada do outro)", tr_ok.throw.sum() == tr_ok.comeback.sum(), f"{tr_ok.throw.sum()} = {tr_ok.comeback.sum()}")
    check("soma de 'rounds além da economia' na liga = 0", abs((tr_ok.won - tr_ok.p0).sum()) < 1e-6, f"{(tr_ok.won - tr_ok.p0).sum():.2e}")
    check("força dos times centrada em zero", abs(ts.theta.mean()) < 1e-9)
    rw = tr_ok.groupby("team").won.mean().reindex(ts.team)
    corr = np.corrcoef(ts.theta, rw)[0, 1]
    check("força correlaciona com a taxa de vitória de rounds", corr > 0.8, f"r = {corr:.2f}")

    # ---------------------------------------------------------------- site (JSON exportado)
    idx = json.loads((WEB / "index.json").read_text(encoding="utf-8"))
    match_ids = {x["id"] for x in idx["matches"]}
    players = {p["puuid"] for p in idx["players"]}
    teams = {t["slug"] for t in idx["team_list"]}
    check("arquivo para cada partida, time e jogador do índice",
          all((WEB / "matches" / f"{i}.json").exists() for i in match_ids) and all((WEB / "teams" / f"{s}.json").exists() for s in teams)
          and all((WEB / "players" / f"{p}.json").exists() for p in players) and all((WEB / "zones" / f"{s}.json").exists() for s in teams))
    broken, bad_text = [], []
    for s in teams:
        raw = (WEB / "teams" / f"{s}.json").read_text(encoding="utf-8")
        d = json.loads(raw)
        broken += [x["id"] for x in d["matches"] if x["id"] not in match_ids]
        broken += [r["puuid"] for r in d["roster"] if r["puuid"] not in players]
        broken += [x["opponent"] for x in d["matches"] if x["opponent"] not in teams]
        for part in d["insights"].values():
            for i in part:
                if any(w_ in i["text"] for w_ in ("nan", "None", "inf")):
                    bad_text.append(i["text"])
    for f in (WEB / "players").glob("*.json"):
        d = json.loads(f.read_text(encoding="utf-8"))
        broken += [x["id"] for x in d["matches"] if x["id"] not in match_ids]
        broken += [x["match_id"] for x in d["best_plays"] + d["costliest_deaths"] if x["match_id"] not in match_ids]
        for part in d["insights"].values():
            for i in part:
                if any(w_ in i["text"] for w_ in ("nan", "None", "inf")):
                    bad_text.append(i["text"])
    check("nenhum link quebrado entre páginas", not broken, f"{len(broken)} quebrados: {broken[:3]}")

    # duels on player pages: every duel is one player's kill and another player's death
    dk = dd = 0
    for f in (WEB / "players").glob("*.json"):
        du = json.loads(f.read_text(encoding="utf-8"))["duels"]
        dk += du["kills"]
        dd += du["deaths"]
    check("duelos: eliminações = mortes somando todos os jogadores", dk == dd, f"{dk} = {dd}")

    # minimap transforms must survive the export intact (rounding 7e-05 to 4 decimals once broke the minimap by 43%)
    lookup = json.loads((ROOT / "data" / "meta" / "lookup.json").read_text(encoding="utf-8"))["maps"]
    bad_tf = []
    for i in match_ids:
        mp = json.loads((WEB / "matches" / f"{i}.json").read_text(encoding="utf-8"))["map"]
        ref = lookup[mp["code"]]
        if any(abs(mp["transform"][k] / ref[k] - 1) > 1e-3 for k in ("xMultiplier", "yMultiplier")):  # relative error > 0.1%
            bad_tf.append(i)
    check("coordenadas do minimapa exportadas sem perda de precisão", not bad_tf, f"{len(bad_tf)} partidas com transform distorcido")

    # replay: everyone's position + view at each event. The view convention (radians, game axes) is checked by what it means:
    # whoever kills is looking at the victim. Positions must land on the minimap, and every kill must say what killed.
    raw_names = {"Ability1", "Ability2", "GrenadeAbility", "Ultimate", "Bomb", "Fall", "Melee", "Crush"}
    ang, n_ev, n_pos_ev, n_pos, inside, unlabeled = [], 0, 0, 0, 0, []
    for i in match_ids:
        d = json.loads((WEB / "matches" / f"{i}.json").read_text(encoding="utf-8"))
        tf = d["map"]["transform"]
        pidx = {p["puuid"]: k for k, p in enumerate(d["players"])}
        for r in d["rounds"]:
            for e in r["events"]:
                if e["type"] == "kill" and (e["weapon"] is None or e["weapon"] in raw_names):
                    unlabeled.append(e["weapon"])
                n_ev += 1
                n_pos_ev += bool(e.get("pos"))
                for _, x, y, _view in e.get("pos") or []:
                    u, v = y * tf["xMultiplier"] + tf["xScalarToAdd"], x * tf["yMultiplier"] + tf["yScalarToAdd"]
                    inside += 0 <= u <= 1 and 0 <= v <= 1
                    n_pos += 1
                if e["type"] == "kill" and e["actor"] != e["victim"] and e.get("victim_xy"):
                    me = next((p for p in e.get("pos") or [] if p[0] == pidx.get(e["actor"])), None)
                    if me:
                        dx, dy = e["victim_xy"][0] - me[1], e["victim_xy"][1] - me[2]
                        if math.hypot(dx, dy) >= 300:  # at point-blank range the direction is unstable
                            ang.append(abs((me[3] - math.atan2(dy, dx) + math.pi) % (2 * math.pi) - math.pi))
    ang = np.degrees(np.array(ang))
    check("replay: posição de todos em cada kill, plant e desarme", n_pos_ev / n_ev > 0.99, f"{n_pos_ev} de {n_ev} eventos")
    check("replay: quem mata está olhando para a vítima (cone de visão)", np.median(ang) < 5 and (ang < 20).mean() > 0.9,
          f"mediana {np.median(ang):.1f}° · {(ang < 20).mean():.0%} a menos de 20° (n = {len(ang)})")
    check("replay: posições dentro do minimapa", inside / n_pos > 0.99, f"{inside / n_pos:.2%} de {n_pos}")
    check("toda kill diz o que matou (arma, habilidade, spike, queda)", not unlabeled, f"{len(unlabeled)} sem rótulo: {sorted(set(map(str, unlabeled)))[:4]}")

    # walkable grid of each map (replay moves players along it): recorded positions must be on the floor or right next to it
    # (players hug walls and stand on boxes; the replay snaps those to the nearest floor cell)
    import base64
    from scipy.ndimage import distance_transform_edt
    on, tot, no_grid = 0, 0, []
    pos_map = pd.read_parquet(P / "positions.parquet", columns=["match_id", "x", "y"]).merge(m[["match_id", "map_code"]], on="match_id")
    for code, g in pos_map.groupby("map_code"):
        f = WEB / "maps" / f"{code}.json"
        if not f.exists():
            no_grid.append(code)
            continue
        nav = json.loads(f.read_text(encoding="utf-8"))
        n = nav["n"]
        walk = np.unpackbits(np.frombuffer(base64.b64decode(nav["walk"]), dtype=np.uint8))[: n * n].reshape(n, n).astype(bool)
        to_floor = distance_transform_edt(~walk)  # cells to the nearest floor cell
        tf = lookup[code]
        u = g.y.to_numpy() * tf["xMultiplier"] + tf["xScalarToAdd"]
        v = g.x.to_numpy() * tf["yMultiplier"] + tf["yScalarToAdd"]
        on += (to_floor[np.clip((v * n).astype(int), 0, n - 1), np.clip((u * n).astype(int), 0, n - 1)] <= 2).sum()
        tot += len(g)
    check("replay: posições registradas no chão da grade do mapa (ou a até ~1,4 m)", not no_grid and on / tot > 0.995,
          f"{on / tot:.2%} de {tot}" + (f" · sem grade: {no_grid}" if no_grid else ""))

    # metrics declared as "no between-team signal" must still look like noise, and must never become a claim
    from insights import NOISE_METRICS
    claims = []
    zs = {k: [] for k in NOISE_METRICS}
    for s in teams:
        d = json.loads((WEB / "teams" / f"{s}.json").read_text(encoding="utf-8"))
        claims += [i["key"] for part in d["insights"].values() for i in part if i["key"] in NOISE_METRICS]
        claims += [c["key"] for c in d["evolution"]["changes"] if c["key"] in NOISE_METRICS and c["significant"]]
        for mt in d["metrics"]:
            if mt["key"] in NOISE_METRICS and mt["n"] >= 100 and mt["z"] is not None:
                zs[mt["key"]].append(mt["z"])
    sds = {k: float(np.std(v)) for k, v in zs.items() if v}
    check("métricas sem sinal entre times continuam com dispersão de ruído (dp(z) < 1,2)", all(v < 1.2 for v in sds.values()),
          " · ".join(f"{k} {v:.2f}" for k, v in sds.items()))
    check("métricas sem sinal nunca viram afirmação", not claims, f"{len(claims)} afirmações")
    check("nenhum texto com 'nan'/'None'/'inf'", not bad_text, f"{bad_text[:2]}")

    width = max(len(n) for n, _, _ in results)
    for name, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'}  {name:{width}s}  {detail}")
    fails = [n for n, ok, _ in results if not ok]
    print(f"\n{len(results) - len(fails)}/{len(results)} checagens ok")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
