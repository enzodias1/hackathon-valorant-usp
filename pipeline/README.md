# Pipeline

Python que transforma os JSONs das partidas, fornecidos pela organização do hackathon, nos dados do site (`web/public/data`).
Nenhum dado de partida vem de outra fonte; os metadados do jogo (agentes, armas, mapas) estão em [`data/meta/`](../data/meta/README.md).
Nos textos abaixo, "liga" quer dizer todas as partidas da base (os quatro campeonatos juntos).

## Como rodar

Python 3.11+. Os JSONs da organização ficam fora do repositório, numa pasta ao lado dele (`../Dados .Json`, com uma subpasta por
campeonato). Tudo o que é intermediário vai para `data/processed/`, que também fica fora do repositório.

```bash
python -m venv .venv
source .venv/bin/activate                     # Windows: .venv\Scripts\activate
pip install -r pipeline/requirements.txt

python pipeline/meta.py                       # data/meta/lookup.json
python pipeline/etl.py "../Dados .Json"       # data/processed/*.parquet (+ checagens da base e tipos de compra)
python pipeline/winprob.py                    # chance de vitória do round + impacto de cada jogada
python pipeline/team.py                       # contexto das mortes, sinergia, perfis de jogadores e times
python pipeline/evolution.py                  # força dos times e evolução no campeonato
python pipeline/economy.py                    # decisões de compra sem full buy
python pipeline/zones.py                      # onde cada time morre (regiões do mapa + grade de calor)
python pipeline/navgrid.py                    # chão caminhável de cada mapa + spawns (movimento do replay)
python pipeline/export.py                     # JSON do site em web/public/data (formato em web/DADOS.md)
python pipeline/checks.py                     # 42 checagens de consistência (sai com erro se alguma falhar)
```

No Windows, defina `PYTHONIOENCODING=utf-8` antes: alguns nicks têm caracteres que o console padrão não imprime.
`map_calibration.py` é opcional (~1 min): recalcula o fator da chance de vencer o mapa do comparador.

## Scripts

| Script | O que faz | Gera |
|---|---|---|
| `meta.py` | indexa os metadados do jogo pelos IDs que aparecem nas partidas, com os nomes em português | `data/meta/lookup.json` |
| `etl.py` | lê os JSONs e monta as tabelas: partidas, rounds, kills (vivos antes e depois, trades), posição de todos em cada evento, economia e tipo de compra, ressurreições, dano | `matches`, `rounds`, `kills`, `positions`, `player_round`... |
| `winprob.py` | chance de vitória do round em cada evento (gradient boosting, validação cruzada por partida) e o impacto creditado a cada jogada | `wp_states`, `wp_events`, `wp_credits`, `wp_report.json` |
| `team.py` | contexto de cada morte (aliado mais perto, trade), sinergia entre pares e perfil de jogadores e times contra a liga | `death_context`, `pairs`, `player_profile`, `team_profile`, `team_map`, `team_buy` |
| `evolution.py` | força dos times (Bradley-Terry descontando a economia), também por campeonato e por fase, e evolução ao longo do campeonato | `team_strength*`, `team_stage`, `team_changes`, `player_stage` |
| `economy.py` | rounds sem full buy depois de uma derrota: o que o time comprou e o que aconteceu depois | `economy.json`, `economy_team` |
| `zones.py` | mortes por região do mapa (callout oficial mais próximo) e grade de calor | `zones/<time>.json` |
| `navgrid.py` | grade do chão de cada mapa, tirada do minimapa oficial, e os spawns | `web/public/data/maps/` |
| `insights.py` | módulo: testes contra a liga e as frases de pontos fortes e fracos, com Benjamini-Hochberg | — |
| `export.py` | o JSON de cada partida, time e jogador, o índice e as referências da liga | `web/public/data/` |
| `checks.py` | propriedades que precisam valer se os números estiverem certos | — |
| `map_calibration.py` | opcional: calibra a chance de vencer o mapa do comparador | fator `MAP_CALIBRATION` |

## Fatos da base
336 mapas (UNIVAVÁ Classificatórias 1–4 + Fase de Grupos + 3 edições da Rush Series), 68 times, 411 jogadores, 6.618 rounds, 46.753 kills.
- Mapas vêm com codinome interno (`Jam`=Lotus, `Triad`=Haven, `Bonsai`=Split, `Juliett`=Sunset, `Infinity`=Abyss, `Plummet`=Summit…).
- O nome dos times só existe no nome do arquivo. Times da mesma organização (ex.: `azure_bears_black` / `golden`) são elencos diferentes.
- Posições em unidades do jogo (~1 cm). Em cada kill há a posição de todos os vivos (exceto a vítima, que vem à parte).
- 2 rounds com erro na própria base (mortes por bug de mapa) são marcados como `anomalous` e ficam fora do modelo.
- **Ressurreições:** a ultimate da Sage (num aliado) e a da Clove (nela mesma) trazem um morto de volta. O uso não vem nos
  dados, mas a Riot lista todos os vivos em cada kill, plant e desarme (completo em 99,9% dos registros; as falhas são agentes dentro
  de uma ultimate, como o teleporte do Omen). Quem morreu e reaparece nessa lista foi revivido e volta a contar como vivo a partir
  dali: **95 ressurreições em 91 rounds**, todas de Sage (com uma Sage no time) ou Clove. Um registro a menos de 0,5 s da morte não
  conta: duas kills no mesmo instante listam a vítima uma da outra (a volta mais rápida da base, da Clove, leva 0,8 s). Antes, só o
  revivido que morria de novo era corrigido, e no instante da segunda morte; no round 6 de Azure Bears Golden × USP Stars, o modelo
  dava 100% ao Azure num 1 contra 1, com a Killjoy revivida contada como morta. Também não conta como clutch o 1 contra N em que
  alguém do time volta depois. Cada ressurreição é uma **jogada de quem reviveu** (a Sage do time, 49; ou a própria Clove, 46), com
  o ícone da ultimate no replay: vale a chance com o revivido de volta menos a chance sem ele, no registro em que ele reaparece
  (média de +19 pontos, máximo +43), e entra no impacto do jogador. O momento exato não vem nos dados, só o intervalo entre dois
  registros (mediana de 6,5 s).
- **Fim do round por tempo:** o tempo acaba 100 s depois da queda da barreira. Em 58 rounds que terminaram por tempo há 79 eventos
  depois disso (70 kills e 9 plants completados tarde demais, como um aos 100,04 s no round 20 de Wolf Gaming × Axis Anteaters): eles
  não mudam o resultado e contam como "depois do fim" (impacto zero), como os eventos depois de um desarme ou explosão. O relógio dos
  dados tem folga de até ~0,7 s (3 plants aos 100,4–100,6 s valeram), por isso a regra só vale para rounds que acabaram por tempo.
- Em cada kill, plant e desarme vêm a posição e a direção da mira de todos os vivos (base do replay 2D). O uso de utilitárias não vem
  nos dados, mas as kills por habilidade sim (2,6% das kills: ultimate, Q/E e granada), com o slot da habilidade.
- Armas de habilidade no catálogo de armas: a Tour de Force (ultimate do Chamber) vem **sem ID** a partir do patch 13.02; identificada
  por ser rara e ~100% com mira (`meta.py`). No mesmo patch, a Riot **deixa de contar a ultimate do Chamber**: a contagem cai de
  ~1,8 para ~0,4 por mapa e vem zerada em 64–79% dos mapas, mesmo com kills de Tour de Force (nos outros agentes, em 503 mapas
  com kill de ultimate, ela nunca vem zerada). Nesses mapas o placar mostra só o mínimo garantido ("≥1": rounds em que ele matou
  com a ultimate) e a seção de habilidades compara a ultimate do Chamber só com mapas anteriores ao 13.02.
- O relógio do round começa na queda da barreira (o round seguinte começa sempre 37 s depois da última kill: 7 s de fim de round + 30 s
  de compra). Kills nos primeiros segundos são duelos de abertura, comuns perto do spawn da defesa.

## Página do jogador: duelos e quando morre (pedidos das entrevistas)
Das entrevistas com 21 jogadores e jogadoras dos 4 times da UFG no UNIVAVÁ (12 pediram um replay 2D, 7 querem entender o próprio
desempenho, 2 o uso das habilidades), dois pedidos viraram seções:
- **Duelos:** placar contra cada adversário (3+ duelos) e duelos vencidos contra cada agente (10+), comparados com a média do próprio
  jogador. "Confirmado" só quando passa no teste, com Benjamini-Hochberg na lista de agentes da página (34 de 2.812 comparações).
- **Quando morre no round:** distribuição das mortes ao longo do round, mediana e parcela nos primeiros 20 s, contra a liga **na mesma
  função** (duelistas morrem mais cedo: 25% das mortes nos primeiros 20 s, contra ~16% de iniciadores e controladores). Descritivo: na liga,
  o time vence ~31% dos rounds em que o jogador morre, seja antes ou depois dos 20 s, então não afirmamos que morrer cedo é pior.

## Leitura automática e comparações
- **"O que decidiu o round":** até 3 frases geradas dos eventos e da chance de vitória: virada (o vencedor chegou a ≤ 20%) ou vitória
  contra a economia, multi-kill, clutch, desarme no limite e a jogada de maior impacto. Sem texto escrito à mão.
- **Quem podia trocar:** em cada morte, os aliados de quem morreu que tinham linha de visão até quem matou (até 45 m; paredes do mapa
  bloqueiam; altura e smokes não entram, porque não vêm nos dados).
- **Habilidades:** usos por round (C, Q, E) e ultimates por mapa, por agente, contra a média da liga no mesmo agente. A Riot informa só o
  total por partida, não o momento de cada uso.
- **Histórico do confronto** no comparador: placar, a jogada que mais pesou em cada mapa (com o resumo e o link para o replay) e o impacto
  de cada jogador nesses mapas.

## Replay 2D (movimento estimado)
As posições existem só nos instantes de kill, plant e desarme; o primeiro registro do round sai, em mediana, aos 15,7 s (metade dos
rounds entre 8,5 s e 26,9 s). Entre os registros, cada jogador anda pelo **chão do mapa** (grade de ~0,7 m tirada do minimapa oficial,
em que as linhas brancas finas são paredes; 99,97% das posições registradas ficam no chão ou a até 1,4 m dele) pelo caminho mais curto
(A*), no ritmo de corrida. Duas regras deixam o trajeto mais parecido com o de um jogador:
- **Evita a visão dos inimigos:** em cada registro calculamos o que cada inimigo vivo enxerga (raios que param nas paredes, até 45 m);
  passar por essas áreas custa 4× na busca de caminho, e a rota que desvia é usada se der tempo de percorrê-la correndo (até 3× a mais
  curta). Desvia em 3,9% dos trechos, +10 m em média.
- **Anda no momento mais seguro:** se a rota fica mais exposta no registro de chegada (os inimigos estão vindo), o jogador sai logo e
  espera no destino (15% dos trechos); senão, segura a posição e anda a tempo de chegar (o time segura ângulo e rotaciona perto da
  hora). No começo do round, sai do spawn assim que a barreira cai. O spawn é aproximado: na fase de compra os jogadores andam
  dentro da área da barreira, que é grande (do ponto oficial, só 3–7% das posições dos primeiros segundos seriam alcançáveis a tempo);
  quando não daria tempo, o jogador começa adiantado no caminho.
No começo do round, sai do spawn do seu lado. Se o caminho exigir mais de 7,5 m/s (correndo não passa de ~6,75 m/s), o trecho é um
**salto** (habilidade de movimento ou teleporte): o jogador some e reaparece, com o trajeto tracejado (↯). Isso ocorre em 0,9% dos
trechos e se concentra em Iso (6,6%: arena da ultimate), Neon, Yoru, Waylay, Chamber, Jett e Omen; em agentes sem mobilidade fica em ~0,3%.
Um teleporte num intervalo longo (ex.: ultimate do Omen) não aparece pela velocidade. Para esses casos há **anotações da equipe**
([`data/meta/replay_notes.json`](../data/meta/replay_notes.json), com o motivo), mostradas no replay como "anotação da equipe", separadas do que vem dos dados.

## Decisões de métrica (validadas com os dados)
- **Probabilidade de vitória do round:** gradient boosting com validação cruzada por partida (AUC 0,885; erro de calibração 1,2%).
  O impacto (WPA) de cada partida é calculado por um modelo que nunca viu aquela partida.
  O equipamento de um lado sem ninguém vivo fica ausente, não zero: com zero, o modelo lia "equipamento 0" como "time
  inteiro morto" (as duas coisas sempre vinham juntas) e um jogador vivo que não comprou nada (eco, só a pistola grátis) parecia um
  time morto. No único 1 contra 1 pós-plant da base com um atacante assim (round 14 de UFMG Fênix B × CAAP Malditos), o atacante
  aparecia com 0,25% de chance; agora, 18%.
  O instante em que um desarme termina fica fora do treino: dali a defesa sempre vence (o desarme em andamento não vem nos
  dados), e esses estados ensinavam que "ataque todo morto com pouco tempo de spike" favorece a defesa, o contrário do instante em
  que o último atacante morre (com até 3,5 s de spike, o ataque vence 100%; o modelo dava 67%). A chance nesse instante continua
  calculada por um modelo que não viu a partida. Para "ataque todo morto com a spike plantada" (só ~1.300 estados), a chance é a
  taxa real da faixa de **folga para desarmar**, medida quando o último atacante morre: tempo de spike restante − corrida do
  defensor mais perto até a spike (linha reta a 5,5 m/s) − 7 s de desarme. Com 1 s ou mais de sobra, o ataque vence ~0%; com 3 s
  ou mais faltando, 97%. A folga não muda até o desarme (o relógio corre enquanto o defensor vai e desarma), então a chance não
  despenca antes de cada desarme: no round 6 de Azure Bears Golden × USP Stars, a Dioguera mata o último atacante com 13,8 s de
  spike a 11 m dela (folga de 4,8 s; desarmou com 4,7 s restantes), e a defesa fica com 96% até o fim, em vez de cair para 14%.
- **Trade:** morte vingada por um aliado em até 5 s.
- **Morte isolada:** aliado vivo mais próximo a mais de 3.000 unidades (~30 m). A chance de ser trocado cai de 41% (< 5 m) para 4% (> 30 m; 6% só na faixa de 30–40 m).
- **Papéis por comportamento (Entry, Support, Lurker, Clutch): fora da interface.** Saíam de percentis de
  comportamento (72% dos duelistas caíam em Entry e 71% dos sentinelas em Lurker, sem o modelo ver o agente), mas a equipe achou o
  rótulo ambíguo ao lado da função do agente. `team.py` ainda calcula os eixos; o site mostra só a função do agente, e os percentis
  aparecem como "melhor que X% geral".
- **Round "jogado fora":** o time chegou a ≥ 80% de probabilidade e perdeu. **Virada:** ≤ 20% e venceu.
- **Controle de falsos positivos:** toda afirmação de "ponto forte/fraco" ou "mudou" passa por Benjamini-Hochberg (q = 10%) dentro
  da página (time ou jogador). Sem isso, com 15 métricas por time, ~1–2 insights por time seriam ruído.
- **Força dos times:** Bradley-Terry nos rounds, descontando a economia (regularizado: times com poucos mapas ficam perto da média).
  Nas abas por campeonato de `/times`, a força é recalculada só com as partidas de cada campeonato (e de cada fase do Univavá).
  **Posições ajustadas pela equipe**, onde a força e o resultado discordam (`RANK_ORDER` em `export.py`): no Inclusivo,
  Azure Bears White > USP Stars GC > PUC-Campinas Canaries (o Azure venceu a USP; a PUC-Campinas não venceu mapa), e no geral a
  USP Stars GC troca de posição com a PUC-Campinas Canaries. A força (%) continua a do modelo; passando o mouse na posição, a lista explica o ajuste.
- **Chance de vencer o mapa (comparador):** a conta "primeiro a 13" com rounds independentes exagera a confiança, porque os
  rounds não são independentes (economia, lado, momento). `map_calibration.py` prevê cada mapa da base com a força calculada sem ele:
  quando a conta dava 90–100%, o favorito venceu 90%; com logit × 0,742, 88% vira 81% e o erro (Brier) cai de 0,1665 para 0,1644.
  Usa todos os mapas de cada time (não o mapa do jogo: há poucos jogos por mapa); o rendimento por mapa fica na seção "Mapas".
- **Evolução:** primeira × segunda metade dos mapas de cada time, com o esperado de cada evento ajustado pela força do adversário
  e pela economia (senão todo time "piora" na Fase de Grupos, onde os adversários são mais fortes). Só times com ≥ 8 mapas.
- **Tipos de compra, como no jogo:** `etl.classify_buys`, pelo que cada jogador comprou e pelo dinheiro que o time
  guardou (antes era só o valor total do equipamento, com um "Semi-eco" que não existe no jogo e meias compras e forçados misturados).
  Pistol: rounds 1 e 13. **Full buy:** 20 mil ou mais de equipamento, ou 4+ jogadores com kit completo (3.900: Vandal/Phantom +
  escudo cheio). **Meia compra:** compra parcial (2+ jogadores com 2 mil ou mais) no round depois de ganhar o pistol, ou guardando o full buy
  seguinte (4+ jogadores com dinheiro guardado + bônus da próxima derrota, 1.900/2.400/2.900 pela sequência, ≥ 3.900).
  **Forçado:** abaixo do full buy, gastando (compra parcial ou 65%+ do dinheiro) sem garantir o full buy seguinte. **Eco:** o resto.
  Rounds (os dois times): full buy 7.695, meia compra 1.729, pistol 1.344, eco 1.305, forçado 1.163. O modelo de chance de vitória usa o
  valor do equipamento em números, não a categoria: a mudança só reagrupa os rounds (tabelas de compra, rótulos do replay).
- **Economia (forçar ou economizar?):** rounds sem full buy depois de perder um round, pelo tipo de compra (eco, meia compra ou forçado).
  Resultado: rounds vencidos neste e nos 2 seguintes, com controles (dinheiro, armas, adversário, força, lado, placar, round) e
  bootstrap por partida, contra o eco. Depois de perder o pistol (592 ecos, 64 forçados), forçar: +0,75 round [+0,48; +1,02];
  depois de perder um round sem full buy: forçado +0,32 [+0,18; +0,42], meia compra +0,12 [0,00; +0,21]. O forçado é robusto a
  horizonte de 2/4 rounds e a confrontos equilibrados; a meia compra, não.
  É evidência observacional. **Fora da interface:** poucos casos de force (42 com horizonte completo depois do pistol), sinal de seleção
  (quem força vence até o round 4 bem mais) e custo real ao perder o force (round 3: 47% × 58%). O site mostra só o descritivo
  (o que o time fez e o que aconteceu depois), sem recomendação.
- **Início do desarme:** os dados só trazem o fim do desarme (`defuseRoundTime`), então o modelo credita o desarme de uma
  vez (nos destaques, um 0,2% → 100%). O replay e os cartões de desarme dos destaques mostram o início estimado: 7 s antes do fim,
  com os vivos e o tempo de spike nesse instante. É estimativa: um desarme interrompido na metade (3,5 s) e retomado começa antes.
- **Variação só pelo tempo:** entre um evento e outro, a chance de vitória muda só porque o relógio corre (ex.: defesa segurando até o
  tempo acabar). Essa parte não é creditada a ninguém; o impacto de cada jogada é a mudança no instante do evento.
- **Métricas sem sinal entre times** (hoje: rounds jogados fora): a dispersão entre os times é a do acaso (dp(z) = 0,92), então elas
  aparecem nas tabelas, mas nunca viram ponto forte/fraco nem "mudou". `checks.py` recalcula isso a cada execução.

## Checagens de consistência (`checks.py`)
Propriedades que precisam valer se os números estiverem certos, por exemplo: quem planta é sempre do ataque; vitória após first blood +
após first death = 100%; o impacto de cada kill soma zero entre os times; depois da última kill de um round de eliminação o vencedor está
com ~100%; ADR, KAST e K/D da liga em faixas plausíveis; coordenadas do minimapa exportadas sem perda de precisão; nenhum link quebrado entre as páginas;
no replay, quem mata está olhando para a vítima (valida a direção da mira), as posições caem no chão da grade do mapa e toda kill diz o
que matou; somando todos os jogadores, os duelos vencidos são iguais aos perdidos; os vivos que o modelo considera em cada evento
batem com os vivos registrados pela Riot (99,95%, com as ressurreições); em rounds que acabaram por tempo, nada depois dos 100 s conta
como jogada; toda ressurreição tem quem reviveu. Hoje: **42/42 ok**.
