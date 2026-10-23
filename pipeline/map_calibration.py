"""Calibração da chance de vencer o MAPA no comparador de times (web/src/components/analise/Comparator.tsx).

O comparador converte a chance por round (força dos times, Bradley-Terry de evolution.py) em chance por mapa supondo rounds
independentes (primeiro a 13, prorrogação por 2 de vantagem). Na prática os rounds não são independentes (economia, momento,
lado), e o azarão vence mapas mais do que essa conta diz. Aqui, cada mapa é previsto com a força recalculada SEM ele, e o
fator a de  logit(calibrada) = a · logit(conta)  é ajustado por máxima verossimilhança nessas previsões.

Não faz parte da execução normal (336 ajustes, ~1 min). Rodar quando os dados mudarem e copiar o fator para
MAP_CALIBRATION no Comparator.tsx.
"""
from math import comb
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import minimize_scalar

from evolution import fit_strength

P = Path(__file__).resolve().parents[1] / "data" / "processed"


def map_p(p):
    q = 1 - p
    return sum(comb(12 + b, b) * p**13 * q**b for b in range(12)) + comb(24, 12) * p**12 * q**12 * (p * p) / (p * p + q * q)


def main():
    tr = pd.read_parquet(P / "team_rounds.parquet")
    m = pd.read_parquet(P / "matches.parquet").set_index("match_id")
    rows = []
    for mid in tr.match_id.unique():
        th, _ = fit_strength(tr[tr.match_id != mid])
        r = m.loc[mid]
        if r.team_red not in th.index or r.team_blue not in th.index:
            continue
        pm = map_p(1 / (1 + np.exp(-(th[r.team_red] - th[r.team_blue]))))
        red_won = float(r.winner == r.team_red)
        rows.append({"p": max(pm, 1 - pm), "won": red_won if pm >= 0.5 else 1 - red_won})
    d = pd.DataFrame(rows)
    x, y = np.log(d.p / (1 - d.p)).to_numpy(), d.won.to_numpy()
    nll = lambda a: -np.mean(y * np.log(1 / (1 + np.exp(-a * x))) + (1 - y) * np.log(1 / (1 + np.exp(a * x))))
    a = minimize_scalar(nll, bounds=(0.3, 2.0), method="bounded").x
    cal = 1 / (1 + np.exp(-a * x))
    b = pd.cut(d.p, [0.5, 0.6, 0.7, 0.8, 0.9, 1.0])
    print(d.assign(cal=cal).groupby(b, observed=True).agg(mapas=("won", "size"), conta=("p", "mean"), calibrada=("cal", "mean"), real=("won", "mean")).round(3))
    print(f"mapas: {len(d)} | fator a = {a:.3f} | Brier conta {((d.p - y) ** 2).mean():.4f} -> calibrada {((cal - y) ** 2).mean():.4f}")


if __name__ == "__main__":
    main()
