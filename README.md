# Hackathon VALORANT — USP São Carlos / SEMCOMP 2026

**Entrega: sexta 23/10/2026, 23h59 (BRT).** Vídeo pitch de até 5 min + link da apresentação + protótipo.
Banca: Riot Games + AcadArena (organizadora do UNIVAVÁ). Critérios (1–5 cada): Inovação, Impacto, Qualidade da análise/uso dos dados,
Viabilidade, Usabilidade, Protótipo/apresentação. Análise **coletiva** é "especialmente bem-vinda" pelo edital.

📋 **Tarefas da equipe e como entregar: [TAREFAS.md](TAREFAS.md)**

## O produto
"O analista que times universitários não têm": um modelo de probabilidade de vitória do round mede o **impacto real** de cada jogada,
e a partir dele mostramos os momentos decisivos da partida, a sinergia do time (quem cobre quem) e o papel que cada jogador
realmente exerce, descoberto pelo comportamento.

## Regras do edital que afetam o código
- Dados de partida **somente** dos JSONs fornecidos pela organização. Nada de APIs da Riot, scraping ou dados externos de partidas.
- Metadados estáticos do jogo (nomes/ícones de agentes, armas, mapas) ficam em `data/meta/` (liberado pela equipe).
- Ferramenta pós-partida apenas: nada que dê vantagem em tempo real.

## Estrutura
```
pipeline/      Python: dos JSONs brutos até os dados do site
data/meta/     metadados do jogo (agentes, armas, mapas)
web/           site (Next.js 15 + React 19 + Tailwind + Recharts), só JSON estático, sem backend
para_equipe/   arquivos para a equipe preencher
```

## Pipeline (Python, venv em `.venv`)
Os JSONs brutos ficam fora do repositório, em `../Dados .Json`.
```
python -m venv .venv && .venv/Scripts/python -m pip install -r pipeline/requirements.txt
.venv/Scripts/python pipeline/meta.py                         # data/meta/lookup.json
.venv/Scripts/python pipeline/etl.py "../Dados .Json"         # data/processed/*.parquet (+ checagens)
.venv/Scripts/python pipeline/winprob.py                      # modelo de prob. de vitória + impacto (WPA)
.venv/Scripts/python pipeline/team.py                         # sinergia, papéis por comportamento, perfil dos times
.venv/Scripts/python pipeline/export.py                       # JSON do site em web/public/data (formato em web/DADOS.md)
.venv/Scripts/python pipeline/teams_sheet.py                  # planilha de nomes dos times (para_equipe/)
```

## Fatos da base
336 mapas (UNIVAVÁ Classificatórias 1–4 + Fase de Grupos + 3 edições da Rush Series), 68 times, 411 jogadores, 6.618 rounds, 46.753 kills.
- Mapas vêm com codinome interno (`Jam`=Lotus, `Triad`=Haven, `Bonsai`=Split, `Juliett`=Sunset, `Infinity`=Abyss, `Plummet`=Summit…).
- O nome dos times só existe no nome do arquivo. Times da mesma organização (ex.: `azure_bears_black` / `golden`) são elencos diferentes.
- Posições em unidades do jogo (~1 cm). Em cada kill há a posição de todos os vivos (exceto a vítima, que vem à parte).
- 2 rounds com erro na própria base (mortes por bug de mapa) são marcados como `anomalous` e ficam fora do modelo.

## Decisões de métrica (validadas com os dados)
- **Probabilidade de vitória do round:** gradient boosting com validação cruzada por partida (AUC 0,888; erro de calibração 1,3%).
  O impacto (WPA) de cada partida é calculado por um modelo que nunca viu aquela partida.
- **Trade:** morte vingada por um aliado em até 5 s.
- **Morte isolada:** aliado vivo mais próximo a mais de 3.000 unidades (~30 m). A chance de ser trocado cai de 41% (< 5 m) para 6% (> 30 m).
- **Papéis por comportamento** (percentis na liga, mín. 60 rounds): Entrada, Suporte, Lurk, Âncora.
  Validação: 72% dos duelistas → Entrada; 71% dos sentinelas → Lurk, sem o modelo ver o agente.
- **Round "jogado fora":** o time chegou a ≥ 80% de probabilidade e perdeu. **Virada:** ≤ 20% e venceu.
