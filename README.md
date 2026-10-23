<div align="center">

<a href="https://espreitador-gg.vercel.app"><img src="https://espreitador-gg.vercel.app/opengraph-image" alt="Espreitador: o analista que os times universitários não têm" width="760"></a>

# Espreitador

**O analista que os times universitários não têm.**

Análise pós-partida do VALORANT universitário: o impacto real de cada jogada, os momentos que decidiram cada round,
o replay 2D de cada round e a sinergia dos times.

### [espreitador-gg.vercel.app](https://espreitador-gg.vercel.app)

</div>

Projeto do **Hackathon VALORANT da SEMCOMP (USP São Carlos)**, de 19 a 23 de outubro de 2026, feito com a base oficial de partidas
do UNIVAVÁ e da Rush Series. O link abre na apresentação do projeto (setas para passar, F para tela cheia); "Ir para o site" leva
direto ao produto.

## O problema

K/D e ACS contam kills, mas não dizem **quais kills importaram** nem **o que fazer diferente**. Times profissionais têm alguém para
rever cada round; os universitários, não.

Ouvimos 21 jogadores e jogadoras dos 4 times da UFG que disputaram o UNIVAVÁ: 12 pediram um replay 2D com as mortes e as melhores
jogadas, 7 querem entender o próprio desempenho e a evolução além do placar, e 2 querem saber como usaram as habilidades.

## O que o Espreitador faz

- **Impacto real de cada jogada.** A cada kill, plant e desarme, um modelo calcula a chance de cada time vencer o round. A variação
  dessa chance é o impacto da jogada: um first blood vale muito; uma kill num round já decidido, quase nada.
- **Replay 2D de cada round**, com o agente e a mira de cada jogador, a chance de vitória ao vivo, a sequência de eliminações e um
  resumo do que decidiu o round, escrito a partir dos eventos. Dá para copiar o link de um instante e mandar no grupo do time.
- **Times:** força (chance de vencer um round contra um time médio), pontos fortes e fracos contra toda a competição, onde o time
  morre no mapa, economia, mapas, evolução ao longo do campeonato e quem cobre quem (sinergia).
- **Jogadores:** impacto por round, duelos contra cada adversário e cada agente, quando morre no round, uso das habilidades, agentes
  e mapas, comparados com toda a competição.
- **Comparar times** (o histórico do confronto e a chance de vencer um mapa) e **comparar jogadores** (duelos diretos ou a parceria
  no mesmo time).
- **Rankings por campeonato** (geral, cada Rush Series e o UNIVAVÁ por fase), **Destaques** (as jogadas de maior impacto e as maiores
  viradas, com link para o replay) e **As brabas** (a Rush Series Inclusivo).
- Relatório em PDF da partida, do time, do jogador e das comparações, busca rápida (Ctrl+K) e filtros que ficam no link.

## Como funciona

```
JSONs das partidas ──► pipeline/ (Python) ──► web/public/data (JSON estático) ──► web/ (Next.js, site estático)
```

1. **ETL:** os JSONs viram tabelas de rounds, kills, economia (tipos de compra como no jogo) e a posição e a mira de todos os
   jogadores vivos em cada kill, plant e desarme.
2. **Chance de vitória do round:** gradient boosting com jogadores vivos, equipamento, spike e relógio. Cada partida é avaliada por
   um modelo que nunca a viu (validação cruzada por partida): AUC 0,885 e erro de calibração de 1,2%.
3. **Análises:** força dos times (Bradley-Terry descontando a economia), trades e mortes isoladas, sinergia entre pares, regiões do
   mapa e o chão caminhável de cada mapa, que guia o movimento do replay.
4. **Sem conclusão tirada do ruído:** um ponto forte ou fraco só aparece se passar no teste estatístico, com correção de
   Benjamini-Hochberg para as várias comparações de cada página.
5. **Checagens:** 42 propriedades que precisam valer se os números estiverem certos (o impacto de cada kill soma zero entre os times,
   quem planta é sempre do ataque, quem mata está olhando para a vítima no replay...). O pipeline falha se alguma não fechar.

Cada decisão está explicada em [`pipeline/README.md`](pipeline/README.md) e na página
[Metodologia](https://espreitador-gg.vercel.app/metodologia) do site.

## Dados

- **Partidas:** somente os JSONs fornecidos pela organização do hackathon. São 336 mapas (UNIVAVÁ: Classificatórias 1 a 4 e Fase de
  Grupos; Rush Series: Esquenta, Esquenta 2 e Inclusivo), 68 times, 411 jogadores, 6.618 rounds e 46.753 kills. Os arquivos
  originais não fazem parte deste repositório.
- **Metadados estáticos do jogo** (agentes, armas, escudos e mapas): [valorant-api.com](https://valorant-api.com), com o uso liberado
  pela organização. Ver [`data/meta/`](data/meta/README.md).
- **Só pós-partida:** nada se conecta ao jogo nem dá vantagem durante uma partida.

## Estrutura

| Pasta | O que tem |
|---|---|
| [`pipeline/`](pipeline/README.md) | Python: dos JSONs das partidas até os dados do site (modelo, análises e checagens) |
| [`data/meta/`](data/meta/README.md) | metadados do jogo, nomes dos times e anotações do replay |
| [`web/`](web/README.md) | o site: Next.js 15, React 19 e Tailwind, só páginas estáticas, sem backend |

## Rodando localmente

O site já vem com os dados processados (`web/public/data`):

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

Para refazer os dados a partir dos JSONs das partidas, veja [`pipeline/README.md`](pipeline/README.md).

## Equipe

[Enzo](https://www.linkedin.com/in/enzo-dias-3125ba341/) ·
[Azi](https://www.linkedin.com/in/ana-bomfim/) ·
[Brunno](https://www.linkedin.com/in/brunnobernardes/) ·
[João Pedro](https://www.linkedin.com/in/jo%C3%A3o-pedro-matos-939919250/) ·
[Camila](https://www.linkedin.com/in/camila-vuicik-dos-santos-b38a2826b/)

## Aviso legal

Espreitador foi criado sob a política "Legal Jibber Jabber" da Riot Games, usando recursos de propriedade da Riot Games. A Riot Games
não endossa nem patrocina este projeto. Dados das partidas fornecidos pela organização do hackathon.
