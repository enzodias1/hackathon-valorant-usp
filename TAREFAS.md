# Tarefas da equipe

**Prazo final: sexta 23/10, 23h59.** Este arquivo é o quadro oficial da equipe: cada tarefa diz **o que fazer, por que importa e como entregar**.
Ele é atualizado a cada entrega. Na dúvida, chame o Enzo.

🌐 **Protótipo no ar: https://analista-univava.vercel.app**, atualizado sozinho a cada merge na `main`.

> ⚠️ **(19/10) O Next.js foi atualizado por segurança (15.5.4 → 15.5.28).** Depois de `git merge main` na sua branch,
> rode **`npm install`** dentro de `web/`, senão o site roda com a versão antiga.

## Quadro

| Membro | Tarefa | Status | Entrega |
|---|---|---|---|
| Camila | [Nomes dos 68 times](#camila--nomes-dos-68-times) | 🟡 Em andamento | Planilha preenchida → Enzo |
| Nukan | [Minimapa "replay" do round](#nukan--minimapa-replay-do-round) | 🟡 Em andamento | Pull Request `minimapa` |
| Azi | [Estrutura do site + deploy](#azi--estrutura-do-site--deploy) | ✅ Concluída (PR #1, no ar) | — |
| Azi | [Página "Como funciona" + revisão no celular](#azi--página-como-funciona--revisão-no-celular) | ✅ Concluída (PR #2, no ar) | — |
| Azi | [Polimento para compartilhar e apresentar](#azi--polimento-para-compartilhar-e-apresentar) | 🟡 A fazer | Pull Request `polimento` |
| Jodão | [Entrevistas com jogadores/coaches](#jodão--entrevistas-com-jogadorescoaches) | 🟡 Em andamento | Resumo → Enzo |

Legenda: ⏳ aguardando · 🟡 a fazer / em andamento · 🔵 entregue, em revisão · ✅ concluída

---

## Como entregar

**Tarefas de código (Nukan, Azi):** pelo GitHub, sempre em uma *branch* própria.
```bash
git clone https://github.com/enzodias1/hackathon-valorant-usp.git
cd hackathon-valorant-usp/web
npm install
npm run dev                      # abre o site em http://localhost:3000
git checkout -b <nome-da-branch> # ex.: minimapa
# ... trabalhe, faça commits ...
git push -u origin <nome-da-branch>
```
Depois abra um **Pull Request** para `main` no GitHub e avise o Enzo. Ele revisa e faz o merge. Não faça push direto na `main`.

**Tarefas sem código (Camila, Jodão):** mande o arquivo para o Enzo, que coloca no repositório.

---

## Camila — Nomes dos 68 times
**O que fazer:** abrir `para_equipe/nomes_dos_times.xlsx` e preencher **só as colunas amarelas**:
- **NOME CORRETO**: só se o "nome sugerido" estiver errado (ex.: `FEI Darkowls` → `FEI Dark Owls`). Se estiver certo, deixe em branco.
- **SIGLA CURTA**: até 8 letras, para os gráficos (ex.: `FEI DO`).
- **INSTITUIÇÃO**: nome completo (ex.: `Centro Universitário FEI`).

As colunas "nicks mais frequentes" e "competições" ajudam a identificar cada time. Pode conferir nas redes sociais do UNIVAVÁ, das atléticas e das organizações. Isso é só para nomes, não para dados de partida, então está dentro das regras.

**Por quê:** os nomes aparecem em todas as telas e no vídeo. A AcadArena, que está na banca, organiza o UNIVAVÁ e conhece esses times, então um nome errado passa descuido.

**Como entregar:** mandar a planilha preenchida para o Enzo. Tempo estimado: 1h.

---

## Nukan — Minimapa "replay" do round
**O que fazer:** criar `web/src/components/Minimap.tsx`, um componente React que recebe uma partida e um número de round e desenha sobre a imagem do minimapa:
- cada **morte**: um ✕ na posição da vítima, na cor do time da vítima;
- a **posição de quem matou** (quando existir), ligada à vítima por uma linha fina;
- o **plant** (ícone da spike);
- um **controle de tempo** (slider de 0 até o fim do round) que mostra só os eventos até aquele instante;
- **tooltip** ao passar o mouse: "Nick (Agente) matou Nick (Agente) com Arma, aos 0:21".

Crie também uma página de teste em `web/src/app/dev/minimap/page.tsx` que carrega uma partida qualquer de `web/public/data/matches/`.

> **Atualização (19/10):** já existem na `main` os tipos e a carga de dados. Rode `git merge main` na sua branch e use:
> - assinatura do componente: `export default function Minimap({ match, round }: { match: Match; round: Round })`, com `"use client"` no topo
>   (tipos `Match` e `Round` de `@/lib/types`);
> - na página de teste (Server Component): `const match = await getMatch("<id>")` de `@/lib/data`, e passe `match` e `match.rounds[0]` por props;
> - cores dos times: `var(--team-red)` / `var(--team-blue)`; tempo formatado com `clock()` de `@/lib/format`;
> - eventos com `after_round_end: true` aconteceram depois do desarme/explosão: desenhe esmaecidos.
>
> O Enzo vai encaixar o componente na tela de partida. Se a assinatura for diferente, avise.

> **Pedido extra (20/10), se der tempo:** o minimapa também vai ser usado num **mapa de calor das mortes** na página do time.
> Para não duplicar código, separe duas peças reaproveitáveis no mesmo arquivo (ou em `web/src/lib/minimap.ts`):
> - `toMinimap(xy: [number, number], t: MapTransform): { u: number; v: number }`, a fórmula de coordenadas (0–1);
> - `MinimapBase({ src, children })`, a imagem do minimapa com um `<svg viewBox="0 0 1 1">` por cima, onde os desenhos entram.
> O Enzo usa as duas para desenhar a grade de calor (formato em `web/DADOS.md`, seção `zones/<slug>.json`).
O formato dos dados e a **fórmula de coordenadas (já validada)** estão em [`web/DADOS.md`](web/DADOS.md).
Use React + SVG por cima de uma `<img>`, sem bibliotecas novas, e Tailwind para o estilo.

**Por quê:** é o diferencial visual da tela de partida. Mostra *onde* o time morre (isolado, sem trade) e transforma números em algo que o jogador entende na hora. Também rende ótimas imagens para o vídeo.

**Como entregar:** Pull Request da branch `minimapa` (ver [Como entregar](#como-entregar)).

---

## Azi — Estrutura do site + deploy
> ⚠️ **Escopo ajustado (19/10):** o Enzo já subiu na `main` os **tipos** (`web/src/lib/types.ts`), a **carga de dados**
> (`web/src/lib/data.ts`), a **formatação** (`web/src/lib/format.ts`) e as **cores do tema** (`web/src/app/globals.css`), porque as telas
> de análise dependem disso. Ele também vai construir as telas de detalhe (`/partidas/[id]`, `/times/[slug]`, `/jogadores/[puuid]`).
> **Antes de continuar, rode `git pull origin main` (ou `git merge main` na sua branch)** e use esses arquivos em vez de criar outros.
> Se você já tinha feito tipos ou tema, pode descartar a sua versão.

**O que fazer:**
1. **Layout e navegação** (`web/src/app/layout.tsx` + um componente de cabeçalho): nome do produto (provisório: "Analista UNIVAVÁ"),
   links para Início, Partidas, Times e Jogadores, `lang="pt-BR"` e título da página. Use as classes do tema (`bg-surface`, `text-ink`,
   `text-muted`, `border-line`… lista no topo do `globals.css`); evite cores soltas.
2. **Lista de partidas** (`/partidas`): tabela com data, competição, mapa, times e placar, com filtros por competição, time e mapa.
   Cada linha leva para `/partidas/<id>`. Dados: `getIndex()` de `@/lib/data` (lado do servidor) — os nomes dos times estão em `index.teams[slug].name`.
3. **Lista de times** (`/times`) e **de jogadores** (`/jogadores`, com busca por nick): tabelas simples que levam para `/times/<slug>` e `/jogadores/<puuid>`.
4. **Página inicial** (`/`): explica o produto em 2–3 frases e mostra atalhos (ex.: os 5 times com mais mapas).
5. **Deploy na Vercel** ligado ao repositório, para termos um link público do protótipo (o Enzo autoriza na conta dele).

**Não crie** as páginas `/partidas/[id]`, `/times/[slug]` e `/jogadores/[puuid]`, que estão com o Enzo, para não dar conflito.

**Por quê:** é a base onde as telas de análise vão entrar. O link público vai na entrega e permite que a banca use o protótipo.

**Como entregar:** Pull Request da branch `estrutura` + link da Vercel (ver [Como entregar](#como-entregar)).

---

## Azi — Página "Como funciona" + revisão no celular
**O que fazer:**
1. **Página `/como-funciona`** (e o link "Como funciona" no cabeçalho), explicando o produto para jogador e para a banca técnica.
   Os números estão em `web/public/data/model.json` (formato e glossário em [`web/DADOS.md`](web/DADOS.md#modeljson-para-a-página-como-funciona)),
   e as definições, em "Decisões de métrica" no [`README.md`](README.md). Sugestão de seções:
   - **A ideia em 3 passos:** (1) a cada kill/plant/desarme o modelo estima a chance de vitória do round; (2) a variação dessa chance é o
     **impacto** da jogada; (3) somando os impactos e comparando com a liga, saem o diagnóstico, a sinergia e os papéis.
   - **O modelo é confiável?** Gráfico de **calibração** (previsto × real, com a diagonal de referência) + tabela dos 3 modelos
     (baseline, logística, gradient boosting) explicando em linguagem simples por que escolhemos o gradient boosting.
     Frase-chave: *"quando o modelo diz 75%, o time vence 74% das vezes"*.
   - **Previsão por tipo de compra:** tabela `buy_matchups` (modelo × realidade): mostra que o modelo "entende" economia.
   - **Por que jogar perto importa:** gráfico de barras `trade_by_distance` (a curva que cai de 41% para 6%).
   - **Glossário:** impacto (pp), trade, morte isolada, papel em jogo, round jogado fora / virada, significância ("só mostramos
     ponto forte/fraco quando a diferença não é ruído").
   - **Limites honestos:** só olhamos o que está nos dados (sem utilitárias detalhadas, sem comunicação); amostras pequenas são sinalizadas.
   Use Recharts (já instalado) e os tokens de cor; para os gráficos, siga o padrão das telas de análise (`src/components/analise/`).
2. **Revisão no celular:** abra **todas** as páginas no seu celular pelo link da Vercel (início, listas, um time, um jogador, uma partida)
   e corrija o que quebrar: textos cortados, tabelas sem rolagem, gráficos espremidos. Pode mexer nos arquivos das telas de análise para
   isso (só layout/CSS; se precisar mudar lógica, avise o Enzo). Mande prints do antes/depois no PR.

**Por quê:** a banca tem gente técnica da Riot. Mostrar *como* o modelo foi validado transforma "confia em mim" em evidência, o que pesa em
"Qualidade da análise", e a página também serve de base para o trecho de método do vídeo. O celular é como jogador e coach vão abrir
o link na prática, e o Enzo não consegue testar isso daqui.

**Como entregar:** Pull Request da branch `como-funciona` (ver [Como entregar](#como-entregar)). Antes, rode `git pull origin main` e `npm install`.

> **Atualização (20/10):** o Enzo adicionou o link **"Economia"** no cabeçalho (`Header.tsx`), para a nova página `/economia`.
> Ao incluir "Como funciona", rode `git merge main` antes, para não dar conflito. Vale explicar também, na sua página, dois métodos
> novos: o **controle de falsos positivos** (Benjamini-Hochberg: só mostramos ponto forte/fraco quando não é ruído) e o
> **conselheiro de economia** (resumo e números no `README.md`, em "Decisões de métrica").

---

## Azi — Polimento para compartilhar e apresentar
**O que fazer:**
1. **Prévia do link (Open Graph):** quando alguém colar o link do site no Discord ou no WhatsApp, deve aparecer um cartão com
   título, descrição e imagem. Use `metadata` do Next.js no `layout.tsx` (`openGraph`, `twitter`, `metadataBase` =
   `https://analista-univava.vercel.app`) e crie a imagem com `src/app/opengraph-image.tsx` (`ImageResponse` do `next/og`):
   fundo escuro do tema, nome do produto e a frase "O analista que os times universitários não têm".
   Páginas de time, jogador e partida podem ter títulos próprios na prévia (elas já têm `generateMetadata`).
2. **Página 404 em português** (`src/app/not-found.tsx`): hoje aparece "This page could not be found" em inglês.
   Texto curto + links para Início, Times e Partidas.
3. **Página inicial:** incluir as novidades nos cartões de atalho (**Economia**: "Forçar ou economizar?", **Comparar**: "Meu time ×
   adversário", **Como funciona**). Hoje ela só mostra Partidas, Times e Jogadores.
4. **Ícone do site (favicon):** trocar o ícone padrão do Next.js por um simples, coerente com o "A" do cabeçalho.

**Por quê:** o link vai ser compartilhado com a banca e com jogadores. Um cartão de prévia bonito e uma página inicial que mostra
tudo o que o produto faz contam em "Usabilidade" e em "Qualidade do protótipo". Uma 404 em inglês destoa do resto.

**Como entregar:** Pull Request da branch `polimento` (rode `git pull origin main` antes). Lembrete: a prévia da Vercel nos PRs aparece
como "Blocked" (limite do plano gratuito com repositório privado). É esperado; o Enzo testa localmente antes do merge.

---

## Jodão — Entrevistas com jogadores/coaches
**O que fazer:** conversar com 3 a 5 jogadores ou coaches de times universitários e perguntar: *"depois de uma partida, o que você queria saber e não consegue?"*. Anotar também como eles analisam as partidas hoje (VOD, planilha, nada…).

**Por quê:** valida que o produto resolve um problema real e vira argumento no pitch ("conversamos com X jogadores"). Pesa nos critérios de Impacto e Usabilidade.

**Como entregar:** um resumo para o Enzo com (a) quem foi entrevistado (time/função), (b) as perguntas que eles querem responder, (c) frases marcantes, que servem para o vídeo.

---

# Próximas tarefas (começar quando terminar a atual)

| Membro | Tarefa | Status | Entrega |
|---|---|---|---|
| Jodão | [Roteiro do vídeo pitch](#jodão--roteiro-do-vídeo-pitch) | ⏳ Depois das entrevistas | Documento com o roteiro → Enzo |
| Camila | [Apresentação (slides)](#camila--apresentação-slides) | ⏳ Depois da planilha | Link da apresentação → Enzo |

## Jodão — Roteiro do vídeo pitch
**O que fazer:** escrever o roteiro do vídeo de **no máximo 5 minutos**, com o que se fala e o que aparece na tela em cada trecho.
Sugestão de estrutura (ajuste com o que ouviu nas entrevistas):

| Tempo | Trecho | O que mostrar |
|---|---|---|
| 0:00–0:30 | **Problema:** times universitários não têm analista, e as estatísticas comuns (K/D, ACS) não dizem o que fazer. "O K/D mente." | Frase de um entrevistado |
| 0:30–1:15 | **Como usamos os dados:** 336 partidas do UNIVAVÁ e da Rush Series; um modelo calcula a chance de vitória do round a cada kill, validado em partidas que ele nunca viu (acerta como um meteorologista: quando diz 75%, acontece 74% das vezes) | Gráfico de momentum de uma partida |
| 1:15–3:45 | **Demonstração:** (1) tela de um time: diagnóstico + grafo de sinergia; (2) partida UFMT Turuna × Macklogic Red, **round 12**: 4 contra 2 com 99% de chance, triplo da Jett e desarme 0,1 s antes de morrer; (3) tela de um jogador: impacto vs. K/D e "o papel que você realmente joga" | O site rodando |
| 3:45–4:30 | **Valor para jogadores e times:** o que o coach ganha (rounds para revisar no VOD, duplas que se cobrem, decisões de economia) + resultado das entrevistas | Frases e números |
| 4:30–5:00 | **Viabilidade e próximos passos:** roda com qualquer partida no formato oficial, custo zero de servidor (site estático), próximos recursos | Tela inicial + nome da equipe |

**Por quê:** o vídeo é a **entrega principal** do hackathon, e o critério "Qualidade do protótipo e da apresentação" depende dele. Um roteiro com tempo marcado evita estourar os 5 minutos.

**Como entregar:** documento (Google Docs ou similar) com o roteiro para o Enzo revisar. O site já pode ser explorado rodando `npm run dev` na pasta `web`, ou pelo link da Vercel quando o Azi publicar.

## Camila — Apresentação (slides)
**O que fazer:** montar a apresentação que acompanha o vídeo (o edital pede o link dela na entrega), com 6 a 8 slides na mesma ordem do roteiro: problema → dados e método → demonstração (prints do site) → valor → viabilidade → equipe.
Use poucos textos e números grandes (ex.: "336 partidas", "41% vs. 6%: chance de a morte ser trocada perto e longe de um aliado").
Atenção aos direitos de imagem: logos e artes do VALORANT só se forem de uso permitido pela Riot (você já conferiu a política); prefira prints do nosso próprio site.

**Por quê:** a apresentação é entregue junto com o vídeo, e a banca pode consultá-la depois. Ela também serve de base visual para gravar o vídeo.

**Como entregar:** link da apresentação (Google Slides, Canva…) para o Enzo, com permissão de visualização.
