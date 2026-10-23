# Metadados (data/meta)

Dados estáticos do jogo e da base, sem nenhum dado de partida. As partidas vêm só dos JSONs fornecidos pela organização do hackathon,
que não fazem parte deste repositório; o uso de metadados estáticos públicos do jogo foi liberado pela organização.

| Arquivo | O que é | Origem |
|---|---|---|
| `agents.json` | agentes: nome, função, ícones, retratos e habilidades | cópia de [valorant-api.com](https://valorant-api.com) (19/10/2026) |
| `weapons.json` | armas, inclusive as de habilidade | idem |
| `gear.json` | escudos | idem |
| `maps.json` | mapas: codinome interno (`Jam` = Lotus, `Triad` = Haven...), minimapa, conversão de coordenadas e callouts | idem |
| `lookup.json` | os quatro acima indexados pelos IDs que aparecem nos JSONs das partidas, com os nomes em português | gerado por [`pipeline/meta.py`](../../pipeline/meta.py) |
| `team_names.csv` | nome, sigla e instituição de cada um dos 68 times; o `slug` vem do nome dos arquivos de partida, o único lugar onde o time aparece | conferido pela equipe |
| `replay_notes.json` | anotações da equipe no replay, para o que os dados não mostram (ex.: o teleporte da ultimate do Omen), com o motivo; o replay as mostra como "anotação da equipe" | equipe |

Os minimapas usados no replay e na grade do chão de cada mapa são baixados do endereço que está em `maps.json` na primeira execução
de [`pipeline/navgrid.py`](../../pipeline/navgrid.py).
