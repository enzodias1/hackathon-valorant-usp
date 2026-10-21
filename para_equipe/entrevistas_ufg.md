# Entrevistas com jogadores (Jodão, 21/10)

Para validar a solução, o Jodão entrevistou **8 jogadores de VALORANT da UFG Eagles**. Cada um respondeu a uma pergunta aberta, sem
opções pré-definidas, para que as respostas viessem do que eles sentem falta de verdade e não do que fosse sugerido:

> *"Após uma partida de VALORANT, quais informações, métricas ou visualizações você sente falta e hoje não consegue acessar no jogo?"*

As respostas foram agrupadas por tema principal; quando uma resposta tocava em mais de um tema, valeu o que ela destacava primeiro.
Como a amostra é pequena (8 jogadores, todos do mesmo time), o resultado é **evidência qualitativa** das dores dos jogadores, não estatística.

## Divisão por categoria

| Categoria | Respostas |
|---|---|
| Desempenho individual e evolução | 3 de 8 (37,5%) |
| Replay e análise tática do mapa | 2 de 8 (25%) |
| Habilidades e recursos | 2 de 8 (25%) |
| Lobby e comportamento | 1 de 8 (12,5%) |

## O que cada categoria representa

**Desempenho individual e evolução.** Jogadores que querem entender o próprio jogo com mais profundidade do que o pós-partida atual
mostra. Pediram o histórico de duelos (quantas vezes eliminei cada jogador e quantas vezes fui eliminado por ele), a média de desempenho
por agente comparada ao elo ou ao desempenho global e estatísticas temporais personalizadas. Um exemplo dado: *"nos últimos 7 dias, com a
Jett, você morre muito aos X minutos de partida, e nessas partidas perde Z% a mais"*. É a categoria mais frequente.

**Replay e análise tática do mapa.** Jogadores que querem ver a partida de forma espacial e resumida. Pediram replay disponível logo após
a partida, com versão resumida em mapa 2D mostrando agentes, mortes e abates, além de mapa de calor de abates e resumo das melhores e
piores jogadas de cada time.

**Habilidades e recursos.** Jogadores que querem entender o uso de utilitárias e a gestão de recursos do time. Pediram o momento exato
em que cada habilidade foi usada (quando a Sova soltou o drone, quando a Skye lançou o lobo), que um deles chamou de *"métrica super
importante"*, e métricas de controle de recursos.

**Lobby e comportamento.** Um jogador pediu um resumo de KDA e agentes de cada player no lobby e a opção de marcar "evitar" quando alguém
joga de forma prejudicial (troll), para que fosse sinalizado à Riot e monitorado. É a categoria menos frequente e a única que trata da
convivência no lobby, não da análise da partida.

## O que isso mostra

- A necessidade mais forte é de **análise personalizada do próprio desempenho**, não só de dados gerais da partida.
- **Replay, mapa e momentos decisivos** aparecem como a segunda grande demanda, o que reforça a proposta do analista pós-partida.
- Há interesse claro no **uso de habilidades** nos espaços do jogo e em intervalos de tempo.

## Como o produto responde (equipe técnica)

| Pedido | O que o site já faz | O que falta |
|---|---|---|
| Replay 2D com agentes, mortes e abates | Replay do round com cada jogador, a mira, a chance de vitória ao vivo e a sequência de eliminações | — |
| Mapa de calor de abates | Mapa de calor das mortes na página do time ("Onde o time morre") | — |
| Melhores e piores jogadas de cada time | "Jogadas que mais mudaram rounds" na partida; "Rounds para revisar no VOD" no time; "Jogadas para revisar" no jogador | — |
| Desempenho por agente comparado | Impacto, K/D e percentis na liga; agentes e mapas de cada jogador | Comparar com a média do mesmo agente |
| Histórico de duelos | **Feito (21/10):** "Duelos" na página do jogador: placar contra cada adversário e duelos vencidos contra cada agente | — |
| "Morre muito aos X minutos" | **Feito (21/10):** "Quando morre no round", comparado à liga na mesma função e separado por agente | — |
| Momento de uso de cada habilidade | Kills por habilidade aparecem com o nome e o ícone | **Não está nos dados da Riot fornecidos** (o campo de uso vem vazio nos 66.180 registros); só o total por partida |
| Lobby e "evitar" jogador | — | Fora do escopo (pós-partida analítico; denúncia é função do jogo) |

**Detalhe para o pitch:** o UFG Eagles está na base do campeonato. É o 11º mais forte dos 68 times, com defesa sólida (vence 77% dos
rounds defendendo; liga: 48%) e o ataque como ponto fraco (35%; liga: 52%), e o darnubra tem o maior impacto por round da liga entre os 298 jogadores com pelo menos 60 rounds (ele tem 71). Os
entrevistados podem ver a página do próprio time.
