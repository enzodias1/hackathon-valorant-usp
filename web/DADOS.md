# Dados do site (`web/public/data/`)

Tudo é **pré-calculado** pelo pipeline Python (`pipeline/export.py`). O site só lê JSON estático, sem backend.
No código, carregue com `fetch("/data/index.json")` e `fetch(\`/data/matches/${id}.json\`)`.

## `index.json`
```jsonc
{
  "teams":   { "<slug>": { "name": "FEI Darkowls", "tag": "FEI DO" } },   // nome de exibição + sigla curta
  "matches": [ { "id", "date", "competition", "stage", "map", "red": "<slug>", "blue": "<slug>",
                 "score": { "Red": 13, "Blue": 7 }, "winner": "Red" } ]
}
```

## `matches/<id>.json` (uma partida, ~80 KB)
```jsonc
{
  "id", "competition", "stage", "date", "length_min",
  "map": { "code": "Ascent", "name": "Ascent", "minimap": "<url png 1024x1024>",
           "transform": { "xMultiplier", "yMultiplier", "xScalarToAdd", "yScalarToAdd" } },
  "teams": { "Red": { "slug", "name", "tag" }, "Blue": { ... } },
  "score": { "Red": 13, "Blue": 2 }, "winner": "Red",
  "players": [ { "puuid", "name": "Nick#TAG", "color": "Red", "agent": "Jett", "agent_icon": "<url>", "role": "Duelista",
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
      "events": [ {
          "t": 21227,                // ms desde o início do round (fim da fase de compra)
          "type": "kill | plant | defuse",
          "actor": "<puuid>",        // quem matou / plantou / desarmou
          "wp_red_before": 0.52, "wp_red_after": 0.77,   // P(Red vence o round) antes e depois do evento
          "wpa": 25.6,               // impacto do evento para o time de quem agiu (pontos percentuais)
          // só em kills:
          "victim": "<puuid>", "weapon": "Ghost", "first_blood": true, "traded": false, "is_trade": false,
          "teamkill": false, "victim_xy": [x, y], "killer_xy": [x, y] | null, "assistants": ["<puuid>"]
      } ]
  } ]
}
```

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
