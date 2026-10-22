# Tarefas da equipe

**Prazo final: sexta 23/10, 23h59.** Este arquivo é o quadro oficial da equipe: cada tarefa diz **o que fazer, por que importa e como entregar**.
Ele é atualizado a cada entrega. Na dúvida, chame o Enzo.

🌐 **Protótipo no ar: https://analista-univava.vercel.app**, atualizado sozinho a cada merge na `main`.

> ⚠️ **(19/10) O Next.js foi atualizado por segurança (15.5.4 → 15.5.28).** Depois de `git merge main` na sua branch,
> rode **`npm install`** dentro de `web/`, senão o site roda com a versão antiga.

**Novidade (21/10): replay 2D do round.** Na página de cada partida, o round agora toca como um replay: cada jogador com o agente e
a mira, a chance de vitória ao vivo, a sequência de eliminações com o impacto de cada uma e "Copiar link do momento". Abra o round 12
de [UFMT Turuna × MackLogic RED](https://analista-univava.vercel.app/partidas/11bcbdbd-ef01-409b-9e90-3d853e73b370#round-12@84.1)
para ver. Ele é o centro da demonstração do vídeo.

**Novidades (22/10):** o link do site agora **abre na apresentação** do
projeto (setas para passar, F para tela cheia) e termina no "Bora testar?", que leva ao site; o menu ficou em grupos, [comparar jogadores](https://analista-univava.vercel.app/comparar/jogadores) e busca
rápida no menu (Ctrl+K). Os nomes dos times da planilha da Camila já estão no site.

## Quadro

| Membro | Tarefa | Status | Entrega |
|---|---|---|---|
| Jodão | [Roteiro do vídeo pitch](#jodão--roteiro-do-vídeo-pitch) | 🟡 A fazer (entrevistas prontas) | Documento com o roteiro → Enzo |
| Camila | [Validação das análises com olhar de jogador](#camila--validação-das-análises-com-olhar-de-jogador) | 🟡 A fazer | Lista de observações → Enzo |
| — | [Gravações de tela para o vídeo](#gravações-de-tela-para-o-vídeo) | ⏳ Quando o front estiver fechado | Arquivos de vídeo → Jodão |

✅ **Concluídas: 9** (Azi ×5, Nukan ×2, Jodão ×1, Camila ×1). As descrições ficam recolhidas no [fim do arquivo](#-tarefas-concluídas).

Legenda: ⏳ aguardando · 🟡 a fazer / em andamento · 🔵 entregue, em revisão · ✅ concluída

---

## Como entregar

**Tarefas de código (Nukan, Azi):** pelo GitHub, sempre em uma *branch* própria.
```bash
git clone https://github.com/enzodias1/hackathon-valorant-usp.git
cd hackathon-valorant-usp/web
npm install
npm run dev                      # abre o site em http://localhost:3000
git checkout -b <nome-da-branch> # ex.: destaques
# ... trabalhe, faça commits ...
git push -u origin <nome-da-branch>
```
Depois abra um **Pull Request** para `main` no GitHub e avise o Enzo. Ele revisa e faz o merge. Não faça push direto na `main`.

**Tarefas sem código (Camila, Jodão):** mande o arquivo para o Enzo, que coloca no repositório.

---

## Jodão — Roteiro do vídeo pitch
> **Atualização (22/10, troque se já adaptou estas falas):** no roteiro-base, "a mais de 30 metros, 6%" virou **4%** (os 6% eram
> só da faixa de 30 a 40 m; acima de 30 m, só 4% das mortes são vingadas), e "o MackLogic economizou" virou "**fez eco**": os tipos de
> compra do site agora seguem os do jogo (eco, semi-buy, forçada e full buy).
>
> **Entrevistas prontas:** use o resumo em [`para_equipe/entrevistas_ufg.md`](para_equipe/entrevistas_ufg.md) nos trechos **[ENTREVISTA]**
> (ex.: 12 de 21 pediram um replay 2D com as mortes e as melhores jogadas, e o produto já tem). Os entrevistados são dos 4 times da UFG no UNIVAVÁ.
>
> **Atualização (21/10):** a demonstração agora gira em torno do **replay do round 12** (UFMT Turuna × MackLogic RED): a chance de vitória ao
> vivo cai de 99% enquanto a Jett (kim) faz o triplo, e a spike é desarmada 55 milissegundos antes da morte do Cypher (sick). Os números do roteiro
> foram conferidos no replay. **O roteiro-base já foi atualizado (21/10)** com o replay em tela cheia, as entrevistas e as seções novas do
> jogador (duelos, quando morre, habilidades); está em ~4:20, então adapte cortando, se precisar.
>
> **Atualização (20/10):** já existe um **roteiro-base pronto** em [`para_equipe/roteiro_pitch.md`](para_equipe/roteiro_pitch.md), com falas,
> telas, tempos e números conferidos. Sua tarefa agora é **adaptar**: encaixar as frases das entrevistas nos trechos **[ENTREVISTA]**,
> ajustar as falas ao seu jeito de falar, ler em voz alta cronometrando (até 5:00) e sugerir cortes ou trocas de exemplo.

**O que fazer:** fechar o roteiro do vídeo de **no máximo 5 minutos**, com o que se fala e o que aparece na tela em cada trecho, a partir
do roteiro-base e do que ouviu nas entrevistas.

**Por quê:** o vídeo é a **entrega principal** do hackathon, e o critério "Qualidade do protótipo e da apresentação" depende dele. Um roteiro com tempo marcado evita estourar os 5 minutos.

**Como entregar:** documento (Google Docs ou similar) com o roteiro para o Enzo revisar.

---

## Camila — Validação das análises com olhar de jogador
**O que fazer:** abrir no site **3 times que você conhece ou acha interessantes**, **3 jogadores** e **2 partidas** (assistindo ao replay de
alguns rounds), e anotar tudo que **não faz sentido para quem joga VALORANT**: um insight estranho, uma região do mapa de calor esquisita, um caminho no replay que nenhum jogador faria, um texto
confuso. Também vale anotar o que achou **mais útil**: isso orienta o que mostrar no vídeo.

**Por quê:** os números passam por 42 checagens automáticas, mas nenhuma checagem substitui alguém que entende o jogo. A banca tem
gente da Riot: se algo soar errado para um jogador, eles vão perceber.

**Como entregar:** uma lista curta (pode ser no WhatsApp) para o Enzo, com o link da página e o que pareceu estranho. Tempo: ~1h.

---

## Gravações de tela para o vídeo
> ⏳ **Quando o front estiver fechado** (combinamos o dia e o responsável no grupo).

**O que fazer:** com o roteiro do Jodão ([`para_equipe/roteiro_pitch.md`](para_equipe/roteiro_pitch.md)), gravar **um clipe por trecho
da demonstração** (partida + round 12 com o replay tocando, página do time, jogador, comparar, destaques, metodologia),
seguindo o que o roteiro pede na coluna "Tela". Use o link da Vercel, em 1080p, com zoom do navegador em 110–125%, movimentos de mouse
lentos e sem notificações na tela. Grave cada clipe com alguns segundos de folga no começo e no fim, para facilitar a edição.

**Por quê:** o vídeo é a entrega principal. Clipes limpos e separados deixam a edição muito mais rápida para quem montar o vídeo.

**Como entregar:** os arquivos de vídeo para o Jodão (pasta compartilhada no Drive), nomeados pela ordem do roteiro (`01_partida.mp4`…).

---

## ✅ Tarefas concluídas

<details>
<summary>✅ <b>Azi — Exportar em PDF</b> (PR #7, no ar: botão em partida, time, jogador e nos dois comparadores, com escolha das seções)</summary>

**O que fazer:** nas páginas de **partida**, **time**, **jogador** e **comparar**, um botão **"Exportar PDF"** que gera um relatório da
página. O "plus": ao clicar, abre uma janelinha com a lista das seções da página, todas marcadas, e a pessoa desmarca o que não quer
(com "Marcar todas" e "Desmarcar todas"). Só as marcadas entram no PDF.

Caminho sugerido, sem biblioteca nova: a impressão do próprio navegador (`window.print()`, "Salvar como PDF"), que mantém o texto
selecionável e os gráficos nítidos, porque são SVG.
1. **Marcar as seções:** quase todas as seções usam o componente `Section` de `web/src/components/analise/ui.tsx`. Coloque nele um
   `data-pdf-section={title}`; assim as páginas de time (10 seções), jogador (11) e partida já ficam prontas. No comparar
   (`web/src/components/analise/Comparator.tsx` e `HeadToHead.tsx`), os blocos são `<section>` soltos: marque cada um com
   `data-pdf-section="Nome do bloco"`.
2. **O botão:** um componente cliente (ex.: `web/src/components/site/ExportPdf.tsx`) colocado em `actions` da faixa roxa `PageBand`
   de cada página. Ao clicar, ele lê `document.querySelectorAll("[data-pdf-section]")` e monta a lista de checkboxes.
3. **Ao confirmar:** coloque `data-pdf-hide` nas seções desmarcadas, abra todos os `<details>` (as seções recolhíveis) guardando o
   estado anterior, troque o `document.title` por algo como `UFMT Turuna — Analista UNIVAVÁ — 22-10-2026` (vira o nome do arquivo)
   e chame `window.print()`. No evento `afterprint`, desfaça tudo.
4. **CSS de impressão** (`@media print` em `web/src/app/globals.css`): esconder menu lateral, botões, filtros e o "i" das explicações;
   `[data-pdf-hide] { display: none }`; `print-color-adjust: exact` para manter as cores do site; `break-inside: avoid` nas seções
   e cartões; página A4. Um cabeçalho que só aparece na impressão, com o nome do site, a data e o link da página, ajuda quem recebe.
5. **Cuidados:** os gráficos do Recharts às vezes não se redimensionam na impressão (teste a página do time); o replay da partida sai
   como uma foto do instante atual (tudo bem, ou deixe a seção desmarcada por padrão); confira no Edge e no Chrome.

**Por quê:** o coach e os jogadores vão querer mandar a análise no grupo do time ou levar para a reunião de revisão, e nem todo mundo
vai abrir o site. Para a AcadArena, que está na banca e organiza o UNIVAVÁ, um relatório por time pronto para enviar mostra que o
produto já serve no dia a dia (critérios "Viabilidade" e "Usabilidade").

**Como entregar:** PR da branch `exportar-pdf` (ver [Como entregar](#como-entregar)) com um PDF de exemplo de cada uma das 4 páginas
(um completo e um só com algumas seções) e `npm run build` passando. Antes de começar, `git pull origin main` e `npm install` dentro de
`web/`. Tempo estimado: 3 a 4 h. Se travar, avise o Enzo.

</details>

<details>
<summary>✅ <b>Camila — Nomes dos 68 times</b> (planilha entregue em 22/10: 68 siglas e instituições, 12 nomes corrigidos; no ar)</summary>

**O que fazer:** abrir `para_equipe/nomes_dos_times.xlsx` e preencher **só as colunas amarelas**:
- **NOME CORRETO**: só se o "nome sugerido" estiver errado (ex.: `FEI Darkowls` → `FEI Dark Owls`). Se estiver certo, deixe em branco.
- **SIGLA CURTA**: até 8 letras, para os gráficos (ex.: `FEI DO`).
- **INSTITUIÇÃO**: nome completo (ex.: `Centro Universitário FEI`).

As colunas "nicks mais frequentes" e "competições" ajudam a identificar cada time. Pode conferir nas redes sociais do UNIVAVÁ, das atléticas e das organizações. Isso é só para nomes, não para dados de partida, então está dentro das regras.

**Por quê:** os nomes aparecem em todas as telas e no vídeo. A AcadArena, que está na banca, organiza o UNIVAVÁ e conhece esses times, então um nome errado passa descuido. Precisa estar pronto antes das gravações.

**Como entregar:** mandar a planilha preenchida para o Enzo. Tempo estimado: 1h.

</details>

<details>
<summary>✅ <b>Nukan — Página "Destaques do campeonato"</b> (PR #6, no ar: as 10 jogadas de maior impacto e as 10 maiores viradas, com "Ver no replay")</summary>

**O que fazer:** criar a página `/destaques` (`web/src/app/destaques/page.tsx`, Server Component gerado no build) com dois rankings
tirados das 336 partidas, cada item com um botão **"Ver no replay"** que abre o replay 2D (o do mapa) no instante exato da jogada:
1. **Jogadas de maior impacto (10):** os eventos (kill, plant, desarme) com maior `wpa`, ignorando os que têm `after_round_end: true`.
   Em cada card: ícone do agente (`players[i].agent_icon`), nick, o que fez ("matou X com Vandal", "desarmou a spike"), a chance do time
   de quem agiu antes → depois (`wp_red_before`/`wp_red_after`; se o time for Blue, use `1 − valor`), o `+pp` e a partida (times, mapa, data).
2. **Maiores viradas (10):** rounds em que o vencedor chegou à menor chance de vitória e mesmo assim ganhou. Para cada round, ache a menor
   chance do vencedor ao longo dos eventos e guarde o instante dela, que é para onde o botão do replay leva.

O link do replay é `/partidas/<id>#round-<n>@<segundos>` (ex.: `#round-12@84.1`; `t` dos eventos está em milissegundos).

Por onde começar:
- **Dados no servidor:** `getIndex()` e `getMatch(id)` de `@/lib/data` (já leem `public/data` com cache). Tipos em `@/lib/types`
  (`Match`, `Round`, `RoundEvent`); formatação em `@/lib/format` (`pct`, `pp`, `nick`, `clock`, `date`, `competitionLabel`).
- **Visual:** no padrão das páginas novas, com a faixa roxa `PageBand` e os títulos numerados `SectionHead` (`@/components/analise/ui`). Se quiser
  um fundo nos cards, use o splash do mapa: `mapSplash(match.map.code)` de `@/lib/art`.
- **Menu:** inclua "Destaques" na lista `NAV` de `web/src/components/site/Sidebar.tsx`, depois de "Comparar".
- **Antes de entregar:** confira que cada link abre o replay no momento certo e que nenhum texto mostra `NaN`/`undefined`.

**Por quê:** a AcadArena, que está na banca, organiza o UNIVAVÁ. Destaques automáticos que abrem no replay viram conteúdo para redes
sociais e transmissão sem trabalho manual, o que mostra impacto além dos times. Também rendem um trecho forte do vídeo.

**Como entregar:** PR da branch `destaques` (ver [Como entregar](#como-entregar)), com prints da página e `npm run build` passando.
Antes de começar, `git pull origin main` e `npm install` dentro de `web/`. Quanto antes, mais tempo para ajustes; se travar, avise o Enzo.

</details>

<details>
<summary>✅ <b>Azi — Prévia do link das partidas</b> (PR #5, no ar: cartão com placar, vencedor, mapa e competição)</summary>

**O que fazer:** hoje, quem cola o link de uma partida (ou de um momento do replay) no Discord/WhatsApp vê o cartão genérico do site.
Crie `web/src/app/partidas/[id]/opengraph-image.tsx`, no mesmo esquema do `src/app/opengraph-image.tsx` que você fez:
- faixa roxa, os dois times com o placar (verde-limão no vencedor), mapa, competição e data;
- os dados vêm de `getMatch(id)` (`@/lib/data`);
- se der, o splash do mapa (`public/art/maps/<código>.webp`) esmaecido ao fundo; se o `ImageResponse` não aceitar WebP, deixe só o roxo.

Confira que a imagem é gerada no build para todas as partidas (o site é estático) e que o título da prévia continua o da partida.

**Por quê:** o botão "Copiar link do momento" do replay existe para compartilhar jogadas no grupo do time. Um cartão com placar e mapa
convida a clicar, e é a primeira coisa que a banca vê se colarmos o link de uma partida.

**Como entregar:** PR da branch `previa-partidas` (ver [Como entregar](#como-entregar)), com um print da prévia (dá para ver abrindo
`/partidas/<id>/opengraph-image` no navegador). Antes de começar, `git pull origin main` e `npm install` dentro de `web/`.

</details>

<details>
<summary>✅ <b>Jodão — Entrevistas com jogadores/coaches</b> (21 jogadores dos 4 times da UFG; resumo em <code>para_equipe/entrevistas_ufg.md</code>)</summary>

**O que fazer:** conversar com 3 a 5 jogadores ou coaches de times universitários e perguntar: *"depois de uma partida, o que você queria saber e não consegue?"*. Anotar também como eles analisam as partidas hoje (VOD, planilha, nada…).

**Por quê:** valida que o produto resolve um problema real e vira argumento no pitch ("conversamos com X jogadores"). Pesa nos critérios de Impacto e Usabilidade.

**Como entregar:** um resumo para o Enzo com (a) quem foi entrevistado (time/função), (b) as perguntas que eles querem responder, (c) frases marcantes, que servem para o vídeo.

**Resultado:** [`para_equipe/entrevistas_ufg.md`](para_equipe/entrevistas_ufg.md): desempenho individual e evolução (3 de 8), replay e
análise tática do mapa (2), habilidades e recursos (2), lobby e comportamento (1), com o que o produto já atende de cada pedido.

</details>

<details>
<summary>✅ <b>Nukan — Minimapa "replay" do round</b> (PR #3, no ar: base do replay da partida e do mapa de calor)</summary>

**O que fazer:** criar `web/src/components/Minimap.tsx`, um componente React que recebe uma partida e um número de round e desenha sobre a imagem do minimapa:
- cada **morte**: um ✕ na posição da vítima, na cor do time da vítima;
- a **posição de quem matou** (quando existir), ligada à vítima por uma linha fina;
- o **plant** (ícone da spike);
- um **controle de tempo** (slider de 0 até o fim do round) que mostra só os eventos até aquele instante;
- **tooltip** ao passar o mouse: "Nick (Agente) matou Nick (Agente) com Arma, aos 0:21".

Pedido extra: separar `toMinimap` (fórmula de coordenadas) e `MinimapBase` (imagem + SVG por cima), reaproveitados no mapa de calor e,
depois, no replay 2D do round, que foi construído sobre eles.

**Por quê:** é o diferencial visual da tela de partida. Mostra *onde* o time morre (isolado, sem trade) e transforma números em algo que o jogador entende na hora.

</details>

<details>
<summary>✅ <b>Azi — Estrutura do site + deploy</b> (PR #1, no ar)</summary>

**O que fazer:** layout e navegação (nome do produto, links, `lang="pt-BR"`), listas de partidas (com filtros), times e jogadores (com
busca), página inicial com atalhos e deploy na Vercel ligado ao repositório.

**Por quê:** é a base onde as telas de análise entraram, e o link público vai na entrega para a banca usar o protótipo.

</details>

<details>
<summary>✅ <b>Azi — Página "Como funciona" + revisão no celular</b> (PR #2, no ar; hoje é a "Metodologia", e o glossário foi para os botões "i")</summary>

**O que fazer:** página explicando o produto para jogador e para a banca técnica (a ideia em 3 passos, calibração do modelo, comparação
dos 3 modelos, previsão por tipo de compra, chance de trade por distância, glossário e limites) e revisão de todas as telas no celular.

**Por quê:** a banca tem gente técnica da Riot; mostrar *como* o modelo foi validado transforma "confia em mim" em evidência.

</details>

<details>
<summary>✅ <b>Azi — Polimento para compartilhar e apresentar</b> (PR #4, no ar)</summary>

**O que fazer:** prévia do link (Open Graph) com imagem do site, página 404 em português, atalhos para as novidades na página inicial e
ícone do site.

**Por quê:** o link vai ser compartilhado com a banca e com jogadores; um cartão de prévia bonito e uma 404 em português contam em
"Usabilidade" e "Qualidade do protótipo".

</details>
