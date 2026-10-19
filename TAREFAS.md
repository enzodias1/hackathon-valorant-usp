# Tarefas da equipe

Prazo final: **sexta 23/10, 23h59**. Fluxo no Git: cada tarefa em uma *branch* própria → *Pull Request* para `main` → Enzo revisa e faz o merge.

```bash
git clone https://github.com/enzodias1/hackathon-valorant-usp.git
cd hackathon-valorant-usp/web && npm install && npm run dev     # abre em http://localhost:3000
git checkout -b minha-tarefa
```

---

## 1. Revisar os nomes dos 68 times — *Direito*
**O que fazer:** abrir `para_equipe/nomes_dos_times.xlsx` e preencher **só as colunas amarelas**:
- **NOME CORRETO**: só se o "nome sugerido" estiver errado (ex.: `FEI Darkowls` → `FEI Dark Owls`).
- **SIGLA CURTA**: até 8 letras, para os gráficos (ex.: `FEI DO`).
- **INSTITUIÇÃO**: nome completo (ex.: `Centro Universitário FEI`).

Use as colunas "nicks mais frequentes" e "competições" para identificar cada time. Pode conferir nas redes sociais do UNIVAVÁ, das atléticas e das organizações (isso é só para nomes, não para dados de partida, então está dentro das regras).

**Por quê:** os nomes aparecem em todas as telas e no vídeo. A AcadArena, que está na banca, organiza o UNIVAVÁ e conhece esses times. Um nome errado passa descuido.

**Entrega:** a planilha preenchida (pode mandar o arquivo para o Enzo). Tempo estimado: 1h.

---

## 2. Componente de minimapa ("replay" do round) — *Ciência da Computação*
**O que fazer:** criar `web/src/components/Minimap.tsx`, um componente React que recebe uma partida e um número de round e desenha sobre a imagem do minimapa:
- cada **morte**: um ✕ na posição da vítima, na cor do time da vítima;
- a **posição de quem matou** (quando existir) ligada à vítima por uma linha fina;
- o **plant** (ícone da spike);
- um **controle de tempo** (slider de 0 até o fim do round) que mostra só os eventos até aquele instante;
- **tooltip** ao passar o mouse: "Nick (Agente) matou Nick (Agente) com Arma, aos 0:21".

Crie também uma página de teste em `web/src/app/dev/minimap/page.tsx` que carrega uma partida qualquer de `public/data/matches/`.
O formato dos dados e a **fórmula de coordenadas (já validada)** estão em [`web/DADOS.md`](web/DADOS.md).

**Por quê:** é o diferencial visual da tela de partida. Mostra *onde* o time morre (isolado, sem trade) e transforma números em algo que jogador entende na hora. Também é ótimo para o vídeo do pitch.

**Entrega:** PR da branch `minimapa`. Use React + SVG por cima de uma `<img>` (sem bibliotecas novas), com Tailwind para estilo.

---

## 3. Estrutura do app + deploy — *Engenharia de Software*
**O que fazer:**
1. **Layout e navegação** (`web/src/app/`): cabeçalho com nome do produto (provisório: "Analista UNIVAVÁ") e as rotas
   `/` (início), `/partidas` (lista), `/partidas/[id]`, `/times`, `/times/[slug]`, `/jogadores/[puuid]`. Podem ser telas provisórias.
2. **Tipos TypeScript** dos JSONs em `web/src/lib/types.ts` e funções de carga em `web/src/lib/data.ts`, a partir de [`web/DADOS.md`](web/DADOS.md).
3. **Lista de partidas** (`/partidas`): tabela com data, competição, mapa, times e placar, com filtros por competição, time e mapa.
4. **Tema escuro** com cores do lado Red/Blue e de Ataque/Defesa definidas uma vez só (variáveis CSS).
5. **Deploy na Vercel** ligado ao repositório, para termos um link público do protótipo (o Enzo autoriza na conta dele).

**Por quê:** é a base onde as telas de análise vão entrar. O link público entra na entrega e permite que a banca use o protótipo.

**Entrega:** PR da branch `estrutura` + link da Vercel.

---

## 4. Entrevistas com jogadores/coaches — *Gestão da Informação* (em andamento)
**Entrega:** um resumo com (a) quem foi entrevistado (time/função), (b) as perguntas que eles querem responder depois de uma partida, (c) frases marcantes (servem para o pitch).
