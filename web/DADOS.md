# Dados do site (`web/public/data/`)

Tudo é **pré-calculado** pelo pipeline Python (`pipeline/export.py`). O site só lê JSON estático, sem backend.
No código, carregue com `fetch("/data/index.json")` e `fetch(\`/data/matches/${id}.json\`)`.

## Conceitos usados em todo lugar
- **Probabilidade de vitória (wp):** chance de vencer o round, de 0 a 1, estimada pelo modelo a cada evento.
- **Impacto / WPA:** quanto um evento mudou a chance de vitória do time de quem agiu, em **pontos percentuais (pp)**.
  Ex.: first blood que leva o time de 52% para 77% = +25 pp. O impacto de um jogador é a soma dos seus eventos
  (kills e assistências positivas, mortes negativas).
- **z / significant:** cada comparação com a liga traz o tamanho da amostra (`n`) e um z-score. `significant: true` quer dizer
  que a diferença não é ruído (|z| ≥ 1,645 e n ≥ 15). **Só mostre "ponto forte/fraco" quando for significativo.**

## `index.json`
```jsonc
{
  "teams":     { "<slug>": { "name": "FEI Darkowls", "tag": "FEI DO", "institution": "..." | null } },
  "team_list": [ { "slug", "name", "tag", "maps", "map_wins", "rounds", "round_win", "competitions": [] } ],
  "players":   [ { "puuid", "name", "team": "<slug>", "rounds", "agent_role", "behavior_role", "kd", "wpa_per_round", "eligible" } ],
  "matches":   [ { "id", "date", "competition", "stage", "map", "red": "<slug>", "blue": "<slug>",
                   "score": { "Red": 13, "Blue": 7 }, "winner": "Red" } ]
}
```

## `teams/<slug>.json` (um time, ~20 KB)
```jsonc
{
  "slug", "name", "tag", "institution",
  "record": { "maps", "map_wins", "rounds", "round_win" },
  "metrics": [ { "key": "retake_win", "label": "Vitória em retake (defesa)", "higher_is_better": true,
                 "value": 0.31, "league": 0.29, "n": 120, "k": 37, "z": 0.4, "significant": false, "good": null } ],
  "wins_above_expected": { "wins", "expected", "diff", "per100", "z", "significant" },  // vs. o que a economia previa
  "insights": {
    "strengths":  [ { "key", "text", "z", "n" } ],          // pontos fortes (significativos)
    "weaknesses": [ { "key", "text", "tip", "z", "n" } ],   // pontos fracos (significativos) + dica prática
    "attention":  [ { "key", "text", "tip", "z", "n" } ]    // tendências ruins ainda não conclusivas (mostrar como "atenção")
  },
  "maps":   [ { "map", "maps", "map_wins", "rounds", "round_win", "atk_win", "def_win", "league_atk_win" } ],
  "buys":   [ { "buy": "Eco", "rounds", "win", "expected", "league_win", "z", "significant" } ],
  "roster": [ { "puuid", "name", "rounds", "maps", "agents": [], "agent_role", "behavior_role",
                "axes": { "Entrada", "Suporte", "Lurk", "Âncora", "Impacto" } | null,   // 0–100, percentil na liga
                "kd", "acs", "adr", "kast", "wpa_per_round", "fk", "fd", "traded_death_rate", "isolated_death_rate", "core" } ],
  "synergy": {                                              // grafo: nós = titulares (core), arestas = duplas
    "nodes": [ { "puuid", "name", "agent_role", "behavior_role", "rounds" } ],
    "edges": [ { "a", "b", "rounds_together",
                 "b_traded_a", "a_traded_b",                // quantas vezes um vingou a morte do outro
                 "a_deaths_b_alive", "b_deaths_a_alive",
                 "b_assists_on_a", "a_assists_on_b", "assists",
                 "trade_rate", "trade_z" } ],               // taxa de trade da dupla e z vs. liga
    "league_pair_trade_rate": 0.1
  },
  "decisive": {                                             // rounds para revisar no VOD (link para a partida)
    "throws":    [ { "match_id", "round", "map", "opponent", "opponent_name", "side", "wp" } ],  // chegou a wp e perdeu
    "comebacks": [ { ... } ]                                                                  // caiu a wp e venceu
  },
  "matches": [ { "id", "date", "competition", "stage", "map", "opponent", "opponent_name", "score_for", "score_against", "won" } ]
}
```

## `players/<puuid>.json` (um jogador, ~9 KB)
```jsonc
{
  "puuid", "name", "team": "<slug principal>", "team_name", "teams": [ { "slug", "name", "rounds" } ],
  "sample": { "rounds", "maps", "eligible" },              // eligible = ≥ 60 rounds (tem percentis e papel)
  "summary": { "kd", "kpr", "dpr", "apr", "adr", "acs", "kast", "hs_pct", "kills", "deaths", "assists",
               "fk", "fd", "clutch_att", "clutch_won", "plants", "defuses" },
  "impact": { "wpa_total", "wpa_per_round", "wpa_pr_atk", "wpa_pr_def",
              "breakdown": { "kill", "assist", "death", "plant", "defuse" },   // de onde vem o impacto (pp)
              "per_kill", "per_death", "league_per_kill", "league_per_death" },
  "percentiles": { "kd", "kpr", "adr", "acs", "kast", "hs_pct", "wpa_per_round", "opening_rate", "clutch_rate" } | null,
  "role": { "agent_role": "Duelista", "behavior_role": "Entrada", "axes": { ... } | null },
  "comparisons": { "<chave>": { "value", "league", "n", "z", "significant", "good" } },
  "insights": { "strengths", "weaknesses", "attention", "notes": [ { "key", "text" } ] },  // notes: impacto vs K/D, papel, lado
  "agents":  [ { "agent", "icon", "role", "maps", "rounds", "kd", "acs", "wpa_per_round", "map_win_rate" } ],
  "maps":    [ { "map", "maps", "rounds", "kd", "wpa_per_round", "map_win_rate" } ],
  "matches": [ { "id", "date", "map", "team", "opponent", "opponent_name", "won", "score_for", "score_against",
                 "agent", "kills", "deaths", "assists", "acs", "wpa" } ],
  "best_plays":       [ { "match_id", "round", "t", "event", "map", "weapon", "other", "wpa", "wp_before", "wp_after" } ],
  "costliest_deaths": [ { ... mesmo formato; wpa negativo; wp_* do ponto de vista do time do jogador } ],
  "partners": [ { "puuid", "name", "rounds_together", "they_traded_you", "your_deaths_with_them_alive",
                  "you_traded_them", "their_assists_on_your_kills" } ]
}
```

## `model.json` (para a página "Metodologia")
```jsonc
{
  "data": { "matches", "rounds", "states", "kills" },
  "validation": "texto: como o modelo foi validado",
  "features": [ "o que o modelo olha" ],
  "models": { "baseline_alive_lookup": { "log_loss", "brier", "auc" }, "logistic": { ..., "ece" }, "gbm": { ..., "ece" } },
  "chosen": "gbm",
  "calibration": [ { "p": 0.75, "y": 0.74, "n": 8759 } ],         // previsto vs. real em 10 faixas → gráfico de calibração
  "trade_by_distance": [ { "distance": "0–5 m", "trade_rate": 0.41, "n": 7181 } ],   // a curva "41% vs 6%"
  "buy_matchups": [ { "atk_buy": "Eco", "def_buy": "Semi-buy", "model": 0.11, "real": 0.12, "n": 261 } ],  // previsão por tipo de compra
  "definitions": { "trade_window_s", "isolated_distance_m", "throw_wp", "comeback_wp", "min_rounds_role", "significance" }
}
```
Glossário para leigos: **log loss / Brier** = erro das probabilidades (menor é melhor); **AUC** = capacidade de separar
quem vence de quem perde (1 = perfeito, 0,5 = moeda); **ECE / calibração** = quando o modelo diz 70%, acontece ~70% das vezes?

## Campos novos (20/10)
- `teams/<slug>.json`:
  - `strength`: `{ theta, p_vs_avg, rank, of, reliable }`. Força do time (ranking de 1 a 68; `p_vs_avg` = chance de vencer um round contra um time médio).
  - `economy`: lista por situação ("perdeu o pistol", "perdeu o round anterior") com as decisões do time
    (`Economizar` / `Meio-termo` / `Forçar` → `n`, `win_now`, `rounds_next3`), `league_best` e `insight` (texto pronto ou `null`).
  - `evolution`: `{ available, periods, stages[], changes[], players[] }`. `stages` = desempenho acima do próprio nível por etapa
    (`above_level_per100` ± 1,645 × `above_level_se100`); `changes` = 1ª × 2ª metade (`significant` já com Benjamini-Hochberg; `text` quando confirmada).
- `players/<puuid>.json`: `stages` = impacto por etapa (`etapa`, `team`, `rounds`, `wpa_per_round`, `kd`).
- `index.json` → `team_list[]`: `strength_rank`, `strength`.
- `economy.json`: dados do conselheiro de economia (`definitions`, `contexts[situação]` → `decisions`, `adjusted_vs_save` com `ci90`,
  `robustness`, `by_credits`).
- Em todas as comparações, `significant` agora já inclui o controle de falsos positivos por página (Benjamini-Hochberg, q = 10%).

## `league.json`
Referências da liga inteira (taxas médias dos times, vitória por tipo de compra, ataque por mapa, médias de jogador).

## `matches/<id>.json` (uma partida, ~130 KB)
```jsonc
{
  "id", "competition", "stage", "date", "length_min",
  "map": { "code": "Ascent", "name": "Ascent", "minimap": "<url png 1024x1024>",
           "transform": { "xMultiplier", "yMultiplier", "xScalarToAdd", "yScalarToAdd" } },
  "teams": { "Red": { "slug", "name", "tag" }, "Blue": { ... } },
  "score": { "Red": 13, "Blue": 2 }, "winner": "Red",
  "players": [ { "puuid", "name": "Nick#TAG", "color": "Red", "agent": "Jett", "agent_icon": "<url>",
                 "minimap_icon": "<url>",   // ícone redondo do agente no minimapa do jogo (replay)
                 "role": "Duelista",
                 "kills", "deaths", "assists", "acs", "adr",
                 "wpa" } ],          // impacto total na partida, em pontos percentuais de prob. de vitória
  "rounds": [ {
      "n": 1, "half": "1º tempo", "attacker": "Red", "winner": "Red",
      "result": "Elimination | Defuse | Detonate | Timer",
      "score_before": { "Red": 0, "Blue": 0 },
      "buy":     { "Red": "Pistol | Eco | Semi-eco | Semi-buy | Full buy", "Blue": "..." },
      "loadout": { "Red": 3550, "Blue": 3600 },
      "wp_red_start": 0.48,          // P(Red vence o round) antes do primeiro tiro (só economia)
      "plant":  { "t": 43125, "site": "B", "by": "<puuid>", "xy": [x, y] } | null,
      "defuse": { "t": 80000, "by": "<puuid>" } | null,
      "anomalous": false,            // round com erro na base (ignorar nas análises)
      "gear": [ ["Vandal", "Armadura Pesada", 3900], null, ... ],   // por jogador, na ordem de `players`: arma, colete, valor do equipamento
      "events": [ {
          "t": 21227,                // ms desde o início do round (fim da fase de compra)
          "type": "kill | plant | defuse",
          "actor": "<puuid>",        // quem matou / plantou / desarmou
          "wp_red_before": 0.52, "wp_red_after": 0.77,   // P(Red vence o round) antes e depois do evento
          "wpa": 25.6,               // impacto do evento para o time de quem agiu (pontos percentuais)
          "after_round_end": false,  // true = aconteceu depois do desarme/explosão (não muda nada; mostre esmaecido)
          // só em kills:
          "victim": "<puuid>", "weapon": "Ghost", "first_blood": true, "traded": false, "is_trade": false,
          "teamkill": false, "victim_xy": [x, y], "killer_xy": [x, y] | null, "assistants": ["<puuid>"],
          // o que matou, legível: arma, habilidade do agente (nome em português), "Spike", "Queda" ou "Faca"
          "weapon_icon": "<url killfeed>" | null, "kill_kind": "weapon | ability | melee | spike | fall | other",
          // em todo evento: todos os vivos naquele instante (a vítima de uma kill vem em victim_xy)
          "pos": [ [i, x, y, view] ]   // i = índice em `players`; view = direção da mira em radianos, atan2(dy, dx) nos eixos do jogo
      } ]
  } ],
  "weapon_icons": { "Vandal": "<url killfeed>" }   // ícones das armas que aparecem em `gear`
}
```

**Replay:** as posições existem só nos instantes de kill, plant e desarme (é o que a Riot registra). Entre eles o site estima o
movimento pelo chão do mapa (`maps/<code>.json`) e avisa isso na tela. A direção da mira foi validada pelo significado: em 99% das kills, quem mata está olhando para a
vítima (mediana de 0,3°; `checks.py`). Para desenhar o cone no minimapa, lembre que os eixos são trocados:
`ângulo na tela = atan2(cos(view) * yMultiplier, sin(view) * xMultiplier)`. O uso de utilitárias não vem nos dados; kills por habilidade, sim.

## `maps/<code>.json` (chão caminhável do mapa, ~4 KB)
```jsonc
{ "n": 160,                      // grade n × n no espaço do minimapa (uv 0–1)
  "walk": "<base64>",            // bits (numpy packbits, bit mais alto primeiro), linha a linha (v) e depois coluna (u); 1 = chão
  "spawn": { "atk": [u, v], "def": [u, v] } }   // callout "Surgimento"; sem callout (Lotus, Summit): mediana dos primeiros 4 s
```
Gerado por `pipeline/navgrid.py` a partir do minimapa oficial; usado pelo replay (`web/src/lib/navgrid.ts`, busca A*).

## Coordenadas → minimapa (fórmula validada)
As posições `[x, y]` estão em unidades do jogo (~1 cm). Para desenhar sobre a imagem do minimapa
(`map.minimap`, 1024×1024), **note que os eixos são trocados**:

```ts
const u = y * transform.xMultiplier + transform.xScalarToAdd;   // 0..1 → horizontal (left)
const v = x * transform.yMultiplier + transform.yScalarToAdd;   // 0..1 → vertical (top)
// em pixels: left = u * larguraDaImagem ; top = v * alturaDaImagem
```
Validado plotando todas as mortes de Ascent: caem exatamente nas áreas jogáveis e concentradas nos bombs.

## Cores
`Red` / `Blue` são os lados internos da partida (não são os lados de ataque/defesa, que trocam no round 13).
Para ataque/defesa use `round.attacker`.

## `zones/<slug>.json` (onde o time morre)
```jsonc
{
  "team": "<slug>", "grid_size": 32,
  "maps": [ {
    "code": "Ascent", "map": "Ascent", "minimap": "<url>", "transform": { ... }, "deaths": 677,
    "sides": { "Ataque": {
      "deaths": 311, "rounds": 100,
      "zones": [ { "zone": "B · Ponto", "deaths": 61, "share": 0.20, "league_share": 0.15,
                   "untraded_rate": 0.61, "league_untraded_rate": 0.72, "isolated_rate": 0.12,
                   "significant": false, "worse_than_league": false, "z": -1.9 } ],
      "grid": [ [col, row, mortes, mortes_sem_trade] ]   // grade 32×32 em coordenadas do minimapa (col = u·32, row = v·32)
    }, "Defesa": { ... } }
  } ]
}
```
Cada morte é atribuída à região nomeada (callout oficial) mais próxima. Para desenhar a grade sobre o minimapa:
a célula `[col, row]` ocupa `left = col/32`, `top = row/32` da imagem (mesma orientação da fórmula de coordenadas acima).
