# Hackathon VALORANT — USP São Carlos / SEMCOMP 2026

**Entrega: sexta 23/10/2026, 23h59 (BRT).** Vídeo pitch de até 5 min + link da apresentação + protótipo.
Banca: Riot Games + AcadArena (organizadora do UNIVAVÁ). Critérios (1–5 cada): Inovação, Impacto, Qualidade da análise/uso dos dados,
Viabilidade, Usabilidade, Protótipo/apresentação. Análise **coletiva** é "especialmente bem-vinda" pelo edital.

🌐 **Protótipo no ar: https://analista-univava.vercel.app** (publicado automaticamente a cada push na `main`)

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
.venv/Scripts/python pipeline/evolution.py                    # força dos times (Bradley-Terry) e evolução no campeonato
.venv/Scripts/python pipeline/economy.py                      # decisões de compra sem full buy (descritivo nos times)
.venv/Scripts/python pipeline/zones.py                        # onde cada time morre (regiões do mapa + grade de calor)
.venv/Scripts/python pipeline/navgrid.py                      # chão caminhável de cada mapa + spawns (movimento do replay)
.venv/Scripts/python pipeline/export.py                       # JSON do site em web/public/data (formato em web/DADOS.md)
.venv/Scripts/python pipeline/checks.py                       # 40 checagens de consistência (falha se algum número não fechar)
.venv/Scripts/python pipeline/teams_sheet.py                  # planilha de nomes dos times (para_equipe/)
```

## Fatos da base
336 mapas (UNIVAVÁ Classificatórias 1–4 + Fase de Grupos + 3 edições da Rush Series), 68 times, 411 jogadores, 6.618 rounds, 46.753 kills.
- Mapas vêm com codinome interno (`Jam`=Lotus, `Triad`=Haven, `Bonsai`=Split, `Juliett`=Sunset, `Infinity`=Abyss, `Plummet`=Summit…).
- O nome dos times só existe no nome do arquivo. Times da mesma organização (ex.: `azure_bears_black` / `golden`) são elencos diferentes.
- Posições em unidades do jogo (~1 cm). Em cada kill há a posição de todos os vivos (exceto a vítima, que vem à parte).
- 2 rounds com erro na própria base (mortes por bug de mapa) são marcados como `anomalous` e ficam fora do modelo.
- **Ressurreições (21/10):** a ultimate da Sage (num aliado) e a da Clove (nela mesma) trazem um morto de volta. O uso não vem nos
  dados, mas a Riot lista todos os vivos em cada kill, plant e desarme (completo em 99,9% dos registros; as falhas são agentes dentro
  de uma ultimate, como o teleporte do Omen). Quem morreu e reaparece nessa lista foi revivido e volta a contar como vivo a partir
  dali: **95 ressurreições em 91 rounds**, todas de Sage (com uma Sage no time) ou Clove. Um registro a menos de 0,5 s da morte não
  conta: duas kills no mesmo instante listam a vítima uma da outra (a volta mais rápida da base, da Clove, leva 0,8 s). Antes, só o
  revivido que morria de novo era corrigido, e no instante da segunda morte; no round 6 de Azure Bears Golden × USP Stars, o modelo
  dava 100% ao Azure num 1 contra 1, com a Killjoy revivida contada como morta. Também não conta como clutch o 1 contra N em que
  alguém do time volta depois.
- **Fim do round por tempo:** o tempo acaba 100 s depois da queda da barreira. Em 58 rounds que terminaram por tempo há 79 eventos
  depois disso (70 kills e 9 plants completados tarde demais, como um aos 100,04 s no round 20 de Wolf Gaming × Axis Anteaters): eles
  não mudam o resultado e contam como "depois do fim" (impacto zero), como os eventos depois de um desarme ou explosão. O relógio dos
  dados tem folga de até ~0,7 s (3 plants aos 100,4–100,6 s valeram), por isso a regra só vale para rounds que acabaram por tempo.
- Em cada kill, plant e desarme vêm a posição e a direção da mira de todos os vivos (base do replay 2D). O uso de utilitárias não vem
  nos dados, mas as kills por habilidade sim (2,6% das kills: ultimate, Q/E e granada), com o slot da habilidade.
- Armas de habilidade no catálogo de armas: a Tour de Force (ultimate do Chamber) vem **sem ID** a partir do patch 13.02; identificada
  por ser rara e ~100% com mira (`meta.py`).
- O relógio do round começa na queda da barreira (o round seguinte começa sempre 37 s depois da última kill: 7 s de fim de round + 30 s
  de compra). Kills nos primeiros segundos são duelos de abertura, comuns perto do spawn da defesa.

## Página do jogador: duelos e quando morre (pedidos das entrevistas)
Das entrevistas com 8 jogadores do UFG Eagles ([`para_equipe/entrevistas_ufg.md`](para_equipe/entrevistas_ufg.md)), dois pedidos viraram seções:
- **Duelos:** placar contra cada adversário (3+ duelos) e duelos vencidos contra cada agente (10+), comparados com a média do próprio
  jogador. "Confirmado" só quando passa no teste, com Benjamini-Hochberg na lista de agentes da página (34 de 2.812 comparações).
- **Quando morre no round:** distribuição das mortes ao longo do round, mediana e parcela nos primeiros 20 s, contra a liga **na mesma
  função** (duelistas morrem mais cedo: 25% das mortes nos primeiros 20 s, contra ~16% de iniciadores e controladores). Descritivo: na liga,
  o time vence ~31% dos rounds em que o jogador morre, seja antes ou depois dos 20 s, então não afirmamos que morrer cedo é pior.

## Leitura automática e comparações (21/10)
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
(`data/meta/replay_notes.json`, com o motivo), mostradas no replay como "anotação da equipe", separadas do que vem dos dados.

## Decisões de métrica (validadas com os dados)
- **Probabilidade de vitória do round:** gradient boosting com validação cruzada por partida (AUC 0,888; erro de calibração 1,3%).
  O impacto (WPA) de cada partida é calculado por um modelo que nunca viu aquela partida.
  O equipamento de um lado sem ninguém vivo fica ausente, não zero (21/10): com zero, o modelo lia "equipamento 0" como "time
  inteiro morto" (as duas coisas sempre vinham juntas) e um jogador vivo que não comprou nada (eco, só a pistola grátis) parecia um
  time morto. No único 1 contra 1 pós-plant da base com um atacante assim (round 14 de UFMG Fênix B × CAAP Malditos), o atacante
  aparecia com 0,25% de chance; agora, 18%.
- **Trade:** morte vingada por um aliado em até 5 s.
- **Morte isolada:** aliado vivo mais próximo a mais de 3.000 unidades (~30 m). A chance de ser trocado cai de 41% (< 5 m) para 6% (> 30 m).
- **Papéis por comportamento** (percentis na liga, mín. 60 rounds): Entry, Support, Lurker, Clutch.
  Validação: 72% dos duelistas → Entry; 71% dos sentinelas → Lurker, sem o modelo ver o agente.
- **Round "jogado fora":** o time chegou a ≥ 80% de probabilidade e perdeu. **Virada:** ≤ 20% e venceu.
- **Controle de falsos positivos:** toda afirmação de "ponto forte/fraco" ou "mudou" passa por Benjamini-Hochberg (q = 10%) dentro
  da página (time ou jogador). Sem isso, com 15 métricas por time, ~1–2 insights por time seriam ruído.
- **Força dos times:** Bradley-Terry nos rounds, descontando a economia (regularizado: times com poucos mapas ficam perto da média).
- **Evolução:** primeira × segunda metade dos mapas de cada time, com o esperado de cada evento ajustado pela força do adversário
  e pela economia (senão todo time "piora" na Fase de Grupos, onde os adversários são mais fortes). Só times com ≥ 8 mapas.
- **Economia (forçar ou economizar?):** rounds sem dinheiro para full buy (dinheiro + armas carregadas < 20 mil). Decisão pelo % do
  dinheiro gasto (≤ 35% economizar, ≥ 65% forçar). Resultado: rounds vencidos neste e nos 2 seguintes, com controles (dinheiro, armas,
  adversário, força, lado, placar, round) e bootstrap por partida. Depois de perder o pistol, forçar: +0,74 round [+0,47; +1,00];
  depois de perder um round sem full buy: +0,63 [+0,45; +0,81]. Robusto a horizonte de 2/4 rounds e a confrontos equilibrados.
  É evidência observacional. **Removido da interface (20/10):** poucos casos de force (42 com horizonte completo), sinal de seleção
  (quem força vence até o round 4 bem mais) e custo real ao perder o force (round 3: 47% × 58%). O site mostra só o descritivo
  (o que o time fez e o que aconteceu depois), sem recomendação.
- **Variação só pelo tempo:** entre um evento e outro, a chance de vitória muda só porque o relógio corre (ex.: defesa segurando até o
  tempo acabar). Essa parte não é creditada a ninguém; o impacto de cada jogada é a mudança no instante do evento.
- **Métricas sem sinal entre times** (hoje: rounds jogados fora): a dispersão entre os times é a do acaso (dp(z) = 0,92), então elas
  aparecem nas tabelas, mas nunca viram ponto forte/fraco nem "mudou". `checks.py` recalcula isso a cada execução.

## Checagens de consistência (`pipeline/checks.py`)
Propriedades que precisam valer se os números estiverem certos, por exemplo: quem planta é sempre do ataque; vitória após first blood +
após first death = 100%; o impacto de cada kill soma zero entre os times; depois da última kill de um round de eliminação o vencedor está
com ~100%; ADR, KAST e K/D da liga em faixas plausíveis; coordenadas do minimapa exportadas sem perda de precisão; nenhum link quebrado entre as páginas;
no replay, quem mata está olhando para a vítima (valida a direção da mira), as posições caem no chão da grade do mapa e toda kill diz o
que matou; somando todos os jogadores, os duelos vencidos são iguais aos perdidos; os vivos que o modelo considera em cada evento
batem com os vivos registrados pela Riot (99,95%, com as ressurreições); em rounds que acabaram por tempo, nada depois dos 100 s conta
como jogada. Hoje: **40/40 ok**.
