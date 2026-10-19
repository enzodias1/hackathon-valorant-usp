"""Statistical comparisons against the league + natural-language insights (pt-BR).

Every comparison carries its sample size and a z-score; only significant differences become insight text,
so a team with 2 maps never gets "advice" built on noise.
"""
import math

import numpy as np

Z_SIGNIFICANT = 1.645   # ~90% two-sided; small samples are the norm here, so we pair it with a minimum n
MIN_N = 15

# key -> (label, higher_is_better)
TEAM_METRICS = {
    "round_win": ("Rounds vencidos", True),
    "atk_win": ("Rounds vencidos no ataque", True),
    "def_win": ("Rounds vencidos na defesa", True),
    "pistol_win": ("Pistols vencidos", True),
    "bonus_conv": ("Round bônus convertido (após vencer o pistol)", True),
    "anti_bonus": ("Round seguinte vencido após perder o pistol", True),
    "fb_rate": ("Primeiro duelo do round vencido", True),
    "win_after_fb": ("Vitória após first blood a favor", True),
    "win_after_fd": ("Vitória após first blood contra", True),
    "postplant_win": ("Vitória no pós-plant (ataque)", True),
    "retake_win": ("Vitória em retake (defesa)", True),
    "throw_rate": ("Rounds perdidos depois de chegar a 80%", False),
    "comeback_rate": ("Rounds virados a partir de 20%", True),
    "traded_death_rate": ("Mortes trocadas em até 5 s", True),
    "isolated_death_rate": ("Mortes isoladas (> 30 m do aliado)", False),
}

TEAM_TEXT = {
    "atk_win": {"good": "Ataque forte: vencem {v} dos rounds atacando (liga: {l}).",
                "bad": "O ataque é o ponto fraco: vencem {v} dos rounds atacando (liga: {l}).",
                "tip": "Compare o ataque por mapa na tabela de mapas e revise as execuções e o pós-plant onde ele rende menos."},
    "def_win": {"good": "Defesa sólida: vencem {v} dos rounds defendendo (liga: {l}).",
                "bad": "A defesa é o ponto fraco: vencem {v} dos rounds defendendo (liga: {l}).",
                "tip": "Revise o setup inicial e as rotações; veja quais mortes acontecem isoladas no minimapa."},
    "pistol_win": {"good": "Vencem {v} dos pistols (liga: {l}).",
                   "bad": "Vencem só {v} dos pistols (liga: {l}).",
                   "tip": "O pistol vale mais que 1 round: define a economia dos dois seguintes. Vale treinar um plano fixo para cada lado."},
    "bonus_conv": {"good": "Convertem o round bônus: vencem {v} do round seguinte ao pistol vencido (liga: {l}).",
                   "bad": "Depois de vencer o pistol, vencem só {v} do round seguinte (liga: {l}). O round bônus deveria ser quase garantido.",
                   "tip": "No round 2, jogue pela vantagem de armas: segure ângulos longos e evite duelos curtos contra pistolas."},
    "anti_bonus": {"good": "Mesmo perdendo o pistol, vencem {v} do round seguinte (liga: {l}): o force-buy de vocês funciona.",
                   "bad": "Após perder o pistol, vencem só {v} do round seguinte (liga: {l}).",
                   "tip": "Avaliem se vale mais um eco completo para garantir o full buy do round 3."},
    "fb_rate": {"good": "Ganham o primeiro duelo do round em {v} das vezes (liga: {l}).",
                "bad": "Perdem o primeiro duelo com frequência: vencem só {v} deles (liga: {l}).",
                "tip": "Na seção de jogadores, veja quem mais morre primeiro; no minimapa, onde essas mortes acontecem."},
    "win_after_fb": {"good": "Convertem a vantagem: vencem {v} dos rounds após o first blood (liga: {l}).",
                     "bad": "Com o first blood a favor, vencem só {v} dos rounds (liga: {l}): a vantagem numérica escapa.",
                     "tip": "Com 5 contra 4, jogue junto e pelo trade; evite que o próximo duelo aconteça isolado."},
    "win_after_fd": {"good": "Resiliência: mesmo perdendo o primeiro duelo, vencem {v} dos rounds (liga: {l}).",
                     "bad": "Após perder o primeiro duelo, vencem só {v} dos rounds (liga: {l}).",
                     "tip": "Com 4 contra 5, reagrupar e jogar por informação costuma render mais que buscar o duelo de volta."},
    "postplant_win": {"good": "Pós-plant forte: vencem {v} dos rounds com a spike plantada (liga: {l}).",
                      "bad": "Pós-plant fraco: vencem só {v} dos rounds com a spike plantada (liga: {l}).",
                      "tip": "Revise as posições pós-plant: ângulos cruzados e utilitária guardada para atrasar o desarme."},
    "retake_win": {"good": "Retake forte: vencem {v} dos rounds em que a spike foi plantada contra vocês (liga: {l}).",
                   "bad": "Retake fraco: vencem só {v} dos rounds em que a spike foi plantada contra vocês (liga: {l}).",
                   "tip": "Retakes funcionam melhor juntos: esperem o time e usem utilitária antes de entrar no bomb."},
    "throw_rate": {"good": "Fecham os rounds que estão ganhando: perdem só {v} depois de chegar a 80% de chance (liga: {l}).",
                   "bad": "Quando chegam a 80% de chance no round, perdem {v} das vezes (liga: {l}): {k} rounds jogados fora.",
                   "tip": "A lista de rounds jogados fora mostra cada caso: são os melhores rounds para revisar no VOD."},
    "comeback_rate": {"good": "Viram rounds difíceis: vencem {v} dos rounds em que chegaram a 20% de chance (liga: {l}).",
                      "bad": "Raramente viram rounds difíceis: {v} de viradas a partir de 20% (liga: {l}).",
                      "tip": "Em desvantagem, jogar pelo tempo e pela spike costuma render mais do que buscar duelos."},
    "traded_death_rate": {"good": "Time que troca: {v} das mortes são vingadas em até 5 s (liga: {l}).",
                          "bad": "Só {v} das mortes de vocês são trocadas em até 5 s (liga: {l}).",
                          "tip": "Joguem mais perto: a até 5 m de um aliado, a chance de a morte ser trocada é 41%; a mais de 30 m, cai para 6%."},
    "isolated_death_rate": {"good": "Jogam próximos: só {v} das mortes acontecem isoladas (liga: {l}).",
                            "bad": "{v} das mortes acontecem isoladas, a mais de 30 m do aliado mais próximo (liga: {l}).",
                            "tip": "Morte isolada quase nunca é trocada (6%). Veja no minimapa onde elas se repetem."},
}

PLAYER_TEXT = {
    "kill_value": {"good": "Suas kills pesam: cada uma vale em média {v} de chance de vitória do round (liga: {l}).",
                   "bad": "Suas kills pesam pouco: cada uma vale em média {v} de chance de vitória (liga: {l}). Parte delas acontece com o round já decidido.",
                   "tip": "Procure as kills que abrem ou fecham o round: o first blood vale em média +17 pp."},
    "death_cost": {"good": "Suas mortes custam pouco ao time: {v} por morte (liga: {l}).",
                   "bad": "Suas mortes custam caro: {v} de chance de vitória por morte (liga: {l}).",
                   "tip": "Mortes cedo e sem trade são as mais caras; jogue o início do round mais perto do time."},
    "traded_death_rate": {"good": "{v} das suas mortes são trocadas pelo time (liga: {l}): você morre em posições cobertas.",
                          "bad": "Só {v} das suas mortes são trocadas (liga: {l}).",
                          "tip": "A até 5 m de um aliado, a chance de trade é 41%; a mais de 30 m, 6%."},
    "isolated_death_rate": {"good": "Só {v} das suas mortes acontecem isoladas (liga: {l}).",
                            "bad": "{v} das suas mortes acontecem isoladas, a mais de 30 m do aliado mais próximo (liga: {l}).",
                            "tip": "Se for intencional (lurk), confira se essas mortes compram tempo ou informação para o time."},
    "first_duel": {"good": "Você vence {v} dos primeiros duelos que disputa (liga: {l}).",
                   "bad": "Você perde a maioria dos primeiros duelos: vence só {v} (liga: {l}).",
                   "tip": "Entradas funcionam melhor com utilitária de iniciador e um aliado pronto para o trade."},
    "clutch_win": {"good": "Clutch: você vence {v} das situações em que fica sozinho (liga: {l}).",
                   "bad": "Nas situações de clutch, você vence {v} (liga: {l}).",
                   "tip": "No clutch, isolar duelos de 1 contra 1 e jogar pelo tempo da spike aumenta as chances."},
}

ROLE_EXPECTED = {"Duelista": {"Entrada"}, "Iniciador": {"Suporte", "Âncora"}, "Controlador": {"Suporte", "Âncora"}, "Sentinela": {"Lurk", "Âncora"}}


def pct(x):
    return f"{x * 100:.0f}%"


def br(x, fmt="+.1f"):
    """Number with Brazilian decimal comma and a real minus sign: -3.4 -> '−3,4'."""
    return format(x, fmt).replace(".", ",").replace("-", "−")


def pp(x):
    return f"{br(x)} pp"


def binom(k, n, p, higher_is_better=True):
    """Compare a team/player rate k/n to the league rate p."""
    k, n = float(k), float(n)
    if n <= 0 or p is None or np.isnan(p):
        return {"value": None, "league": p, "n": int(n), "k": int(k), "z": None, "significant": False, "good": None}
    v = k / n
    se = math.sqrt(max(p * (1 - p), 1e-9) / n)
    z = (v - p) / se
    sig = n >= MIN_N and abs(z) >= Z_SIGNIFICANT
    return {"value": v, "league": p, "n": int(n), "k": int(k), "z": z, "significant": bool(sig), "good": bool((z > 0) == higher_is_better) if sig else None}


def mean_test(values, league_mean, higher_is_better=True, min_n=MIN_N):
    """Compare the mean of per-event values to the league mean (z on the sample's standard error)."""
    values = np.asarray(values, dtype=float)
    n = len(values)
    if n < 2:
        return {"value": float(values.mean()) if n else None, "league": league_mean, "n": n, "z": None, "significant": False, "good": None}
    m, se = values.mean(), values.std(ddof=1) / math.sqrt(n)
    z = (m - league_mean) / se if se > 0 else 0.0
    sig = n >= min_n and abs(z) >= Z_SIGNIFICANT
    return {"value": float(m), "league": float(league_mean), "n": n, "z": float(z), "significant": bool(sig), "good": bool((z > 0) == higher_is_better) if sig else None}


FDR_Q = 0.10  # Benjamini-Hochberg: at most ~10% of the claims shown on a page are expected to be false positives


def bh_adjust(comparisons, q=FDR_Q):
    """Multiple-testing control per page (team / player): a comparison stays 'significant' only if it survives
    Benjamini-Hochberg among all comparisons of that page. Keeps z; adds two-sided p and the BH threshold used."""
    from scipy.stats import norm
    keys = [k for k, c in comparisons.items() if c.get("z") is not None and c.get("n", 0) >= MIN_N]
    p = {k: float(2 * norm.sf(abs(comparisons[k]["z"]))) for k in keys}
    order = sorted(keys, key=lambda k: p[k])
    m, cutoff = len(order), 0
    for i, k in enumerate(order, start=1):
        if p[k] <= q * i / m:
            cutoff = i
    passed = set(order[:cutoff])
    # BH never accepts p > q, so whatever passes was already significant individually (|z| >= 1.645) and keeps its direction
    for k, c in comparisons.items():
        c["p"] = p.get(k)
        c["significant"] = bool(c.get("significant")) and k in passed
        if not c["significant"]:
            c["good"] = None
    return comparisons


TREND_Z = 1.0  # "attention" items: unfavorable direction, not significant yet (~84% one-sided)


def make_insights(comparisons, texts, fmt=pct, limit=4, higher_is_better=None):
    """comparisons: {key: result of binom/mean_test} -> strengths / weaknesses (significant) sorted by |z|,
    plus 'attention': unfavorable trends that are not significant yet, so strong teams still get something to work on."""
    strengths, weaknesses, attention = [], [], []
    for key, c in comparisons.items():
        if key not in texts or c.get("z") is None or c.get("value") is None:
            continue
        t = texts[key]
        item = {"key": key, "z": round(c["z"], 2), "n": c["n"]}
        fill = {"v": fmt(c["value"]), "l": fmt(c["league"]), "k": c.get("k", "")}
        if c.get("significant"):
            if c["good"]:
                strengths.append({**item, "text": t["good"].format(**fill)})
            else:
                weaknesses.append({**item, "text": t["bad"].format(**fill), "tip": t["tip"]})
        elif higher_is_better is not None and c["n"] >= 15:
            z_dir = c["z"] if higher_is_better.get(key, True) else -c["z"]
            big_enough = abs(c["value"] - c["league"]) >= 0.10 * abs(c["league"])  # ignore trivial gaps (e.g. 17% vs 16%)
            if z_dir <= -TREND_Z and big_enough:
                attention.append({**item, "text": t["bad"].format(**fill), "tip": t["tip"]})
    strengths.sort(key=lambda x: -abs(x["z"]))
    weaknesses.sort(key=lambda x: -abs(x["z"]))
    attention.sort(key=lambda x: -abs(x["z"]))
    return {"strengths": strengths[:limit], "weaknesses": weaknesses[:limit], "attention": attention[:2]}


def team_counts(tr, dc):
    """(successes, trials) for each team metric, from team-perspective rounds and the team's deaths."""
    atk, dfn = tr[tr.side == "Ataque"], tr[tr.side == "Defesa"]
    ap = tr[tr.after_pistol]
    duel = tr[tr.first_blood | tr.first_death]
    return {
        "round_win": (tr.won.sum(), len(tr)),
        "atk_win": (atk.won.sum(), len(atk)),
        "def_win": (dfn.won.sum(), len(dfn)),
        "pistol_win": (tr[tr.buy == "Pistol"].won.sum(), (tr.buy == "Pistol").sum()),
        "bonus_conv": (ap[ap.prev_won == True].won.sum(), (ap.prev_won == True).sum()),
        "anti_bonus": (ap[ap.prev_won == False].won.sum(), (ap.prev_won == False).sum()),
        "fb_rate": (duel.first_blood.sum(), len(duel)),
        "win_after_fb": (tr[tr.first_blood].won.sum(), tr.first_blood.sum()),
        "win_after_fd": (tr[tr.first_death].won.sum(), tr.first_death.sum()),
        "postplant_win": (atk[atk.planted].won.sum(), atk.planted.sum()),
        "retake_win": (dfn[dfn.planted].won.sum(), dfn.planted.sum()),
        "throw_rate": (tr.throw.sum(), (tr.wp_max >= 0.8).sum()),
        "comeback_rate": (tr.comeback.sum(), (tr.wp_min <= 0.2).sum()),
        "traded_death_rate": (dc.traded.sum(), len(dc)),
        "isolated_death_rate": (np.nansum(dc.isolated), dc.isolated.notna().sum()),
    }
