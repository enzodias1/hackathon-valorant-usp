# Tarefas da equipe

**Prazo final: sexta 23/10, 23h59.** Este arquivo é o quadro oficial da equipe: cada tarefa diz **o que fazer, por que importa e como entregar**.
Ele é atualizado a cada entrega. Na dúvida, chame o Enzo.

## Quadro

| Membro | Tarefa | Status | Entrega |
|---|---|---|---|
| Camila | [Nomes dos 68 times](#camila--nomes-dos-68-times) | 🟡 Em andamento | Planilha preenchida → Enzo |
| Nukan | [Minimapa "replay" do round](#nukan--minimapa-replay-do-round) | 🟡 Em andamento | Pull Request `minimapa` |
| Azi | [Estrutura do site + deploy](#azi--estrutura-do-site--deploy) | 🟡 Em andamento (**escopo ajustado, ver cartão**) | Pull Request `estrutura` + link da Vercel |
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

## Jodão — Entrevistas com jogadores/coaches
**O que fazer:** conversar com 3 a 5 jogadores ou coaches de times universitários e perguntar: *"depois de uma partida, o que você queria saber e não consegue?"*. Anotar também como eles analisam as partidas hoje (VOD, planilha, nada…).

**Por quê:** valida que o produto resolve um problema real e vira argumento no pitch ("conversamos com X jogadores"). Pesa nos critérios de Impacto e Usabilidade.

**Como entregar:** um resumo para o Enzo com (a) quem foi entrevistado (time/função), (b) as perguntas que eles querem responder, (c) frases marcantes, que servem para o vídeo.
