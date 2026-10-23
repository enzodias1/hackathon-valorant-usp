# Site (web/)

Next.js 15 (App Router), React 19, Tailwind CSS 4 e Recharts. Todas as páginas (~1.170) são geradas no build a partir dos JSONs em
`public/data`, produzidos pelo [pipeline](../pipeline/README.md) (formato em [DADOS.md](DADOS.md)). Não há backend nem banco de dados.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de produção (páginas estáticas)
npm run lint
```

## Páginas

| Rota | O que mostra |
|---|---|
| `/` | a apresentação do projeto, em tela inteira (setas para passar, F para tela cheia) |
| `/inicio` | página inicial do site, com os atalhos |
| `/partidas`, `/partidas/[id]` | lista com filtros; a partida com o replay 2D de cada round, as jogadas que mais mudaram rounds e o placar |
| `/times`, `/times/[slug]` | ranking por campeonato (e por fase do UNIVAVÁ); diagnóstico do time, onde morre, economia, mapas, evolução e sinergia |
| `/jogadores`, `/jogadores/[puuid]` | ranking por campeonato; impacto, duelos, quando morre, habilidades, agentes e mapas do jogador |
| `/comparar`, `/comparar/jogadores` | dois times lado a lado (histórico do confronto, chance de vencer o mapa) e dois jogadores (duelos ou parceria) |
| `/destaques` | as jogadas de maior impacto e as maiores viradas, com link para o instante no replay |
| `/as-brabas` | a Rush Series Inclusivo: o top 10 de impacto e os times |
| `/metodologia` | como o modelo foi validado e as decisões por trás de cada métrica |

Os filtros das listas ficam na URL (ex.: `/times?campeonato=Univavá&fase=Classificatória 1`), e o replay abre num instante pelo
endereço (`/partidas/<id>#round-12@79`), então dá para compartilhar o link já no ponto certo.

## Código

```
src/app/                  rotas, prévias de link (opengraph-image) e o layout com menu e rodapé
src/components/analise/   blocos das telas de análise: replay do round, comparadores, gráficos, sinergia, regiões do mapa
src/components/listas/    tabelas com abas por campeonato e filtros (partidas, times, jogadores)
src/components/destaques/ cartões da página de destaques
src/components/site/      menu, apresentação, busca rápida, exportar PDF
src/lib/                  tipos dos dados, leitura dos JSONs, formatação, glossário (textos dos botões "i"),
                          movimento estimado do replay (replay.ts, navgrid.ts) e o resumo de cada round (roundStory.ts)
public/data/              dados gerados pelo pipeline (não editar à mão)
public/art/               artes oficiais dos agentes e dos mapas (política "Legal Jibber Jabber" da Riot)
scripts/og-maps.mjs       gera os fundos das prévias de link das partidas a partir das artes dos mapas
```

## Deploy

Na Vercel, com **Root Directory `web`** (o resto é detectado: Next.js, `npm run build`). A cada push na `main` o site é publicado de
novo, e cada Pull Request ganha um link de prévia.
