# Roteiro-base do vídeo pitch (até 5:00)

**Para o Jodão adaptar.** Os trechos marcados com **[ENTREVISTA]** são para entrar o que você ouviu nas conversas: uma frase real de
jogador/coach vale mais que qualquer número. Todos os números abaixo foram conferidos nos dados; se mudar algum, confira com o Enzo.

- **Ritmo:** ~140 palavras por minuto. As falas abaixo somam ~530 palavras ≈ 3:50, sobrando ~1 min para as falas das entrevistas e pausas.
- **Tela:** gravar o site rodando (https://analista-univava.vercel.app) com zoom do navegador em 110–125% para ler bem no vídeo.
- **O que a banca vai pontuar** (lembrar ao gravar): Inovação · Impacto · Qualidade da análise · Viabilidade · Usabilidade · Apresentação.

---

## 0:00–0:25 · Gancho
**Tela:** gráfico de momentum da partida UFMT Turuna × Macklogic Red (Fase de Grupos), parado no round 12.

> "Round 12. O UFMT está em 4 contra 2, com a spike plantada: 99% de chance de vencer. Em um segundo e meio, a Jett adversária faz
> três kills, e o Cypher desarma a spike um décimo de segundo antes de morrer. O placar mostra só um round perdido. Nós mostramos
> **o round que decidiu o jogo**, e por quê."

## 0:25–0:55 · O problema
**Tela:** página inicial do site.

> "Times profissionais têm analistas. Times universitários, não. E as estatísticas que todo mundo usa, como K/D e ACS, contam
> kills, mas não dizem **quais kills importaram** nem **o que fazer diferente**."
>
> **[ENTREVISTA]** *uma frase de jogador/coach sobre como analisam partidas hoje (ex.: "a gente só olha o placar e o K/D").*

## 0:55–1:40 · Como usamos os dados
**Tela:** página "Metodologia": números da base e gráfico de calibração.

> "Usamos os dados oficiais de **336 mapas** do UNIVAVÁ e da Rush Series: 68 times, 411 jogadores, mais de 46 mil kills, com a posição
> de todo mundo em cada uma."
>
> "Treinamos um modelo que calcula, a cada kill, plant e desarme, a **chance de cada time vencer o round**. Testamos só em partidas
> que ele nunca viu, e ele é calibrado: **quando diz 75%, o time vence 74% das vezes**."
>
> "A variação dessa chance é o **impacto** de cada jogada. Um first blood vale, em média, 17 pontos de chance de vitória. Uma kill
> num round já decidido, quase nada."

## 1:40–3:50 · Demonstração (o coração do vídeo)

**1:40 · Partida**: momentum + round 12 aberto (lista de eventos).
> "Cada partida vira essa linha: quem estava ganhando, momento a momento. Clicando no round, vemos cada jogada e quanto ela mudou
> o jogo, e os rounds que valem rever no VOD aparecem sozinhos."

**2:05 · Time**: UFMT Turuna: diagnóstico → sinergia → "Onde vocês morrem".
> "Na página do time, o diagnóstico compara com a liga: o UFMT tem um ataque acima da média e é resiliente quando perde o primeiro
> duelo. O grafo mostra **quem cobre quem**: quais duplas vingam a morte uma da outra."
>
> "E isso importa: morrer a menos de 5 metros de um aliado dá **41%** de chance de a morte ser trocada; a mais de 30 metros, **6%**."

**2:40 · Jogador**: perfil de um jogador com impacto maior que o K/D (ex.: BRaim, Unicamp Tritons Black).
> "O K/D engana. Este jogador está no percentil 32 em K/D, mas no **percentil 62 em impacto**: as jogadas acontecem quando o
> round está em jogo. E o papel é descoberto pelo comportamento: joga de iniciador, mas age como **clutch**, decidindo o fim dos rounds."

**3:05 · Onde o time morre**: seção "Onde o time morre" do UFMT (tabela de regiões + mapa de calor).
> "Cada morte vira um ponto no mapa. Dá para ver onde o time morre mais que a média da liga e quantas dessas mortes ficaram
> sem trade: é o mapa do que revisar no VOD."

**3:25 · Comparar**: UFMT × Macklogic Red.
> "E para o próximo jogo: o comparador mostra quem é favorito, quais mapas escolher e vetar, e como o adversário costuma jogar.
> O Macklogic economizou nas 8 vezes que perdeu o pistol: dá para esperar eco no round 2."

## 3:50–4:25 · Por que confiar
**Tela:** "Metodologia" → "Comparações justas" e "Limites honestos".

> "Um número sozinho engana, então tomamos três cuidados. Cada comparação desconta o tamanho da amostra e passa por um **controle
> de falsos positivos**: com ele, cortamos quase metade das afirmações que seriam ruído. A evolução no campeonato desconta a força
> dos adversários. E 31 checagens automáticas garantem que os números fecham."

## 4:25–5:00 · Valor e viabilidade + fechamento
**Tela:** página do time → página inicial com o link visível.

> "Para o jogador: saber o que melhorar, além do K/D. Para o coach: os rounds para rever, as duplas que funcionam, as decisões de
> padrões de economia do time e do adversário. E o site é estático, sem servidor: roda com qualquer campeonato no formato oficial, a custo zero."
>
> **[ENTREVISTA]** *se possível, a reação de um entrevistado ao ver o site.*
>
> "**[nome do produto]**: o analista que os times universitários não têm."

---

## Checklist de gravação
- [ ] Testar todas as telas antes de gravar (link da Vercel, não o local).
- [ ] Gravar a tela em 1080p; áudio com fone/microfone, ambiente sem eco.
- [ ] Cortar tempos mortos de carregamento na edição.
- [ ] Legendas nos números-chave (75% → 74%; 41% × 6%; 55% por round → 70% no mapa).
- [ ] Conferir o tempo final: **até 5:00**.
- [ ] Publicar no YouTube como **não listado** e testar o link em aba anônima.
- [ ] Nome da equipe e dos integrantes na tela final (o formulário também pede).

## Números de reserva (se precisar trocar algum exemplo)
- Modelo: AUC 0,887; erro de calibração 1,4%; validado com 5 grupos de partidas.
- Uma vantagem de 55% por round vira ~70% de chance de vencer o mapa.
- Papéis pelo comportamento: 72% dos duelistas caem em "Entry" e 71% dos sentinelas em "Lurker", sem o modelo ver o agente.
- Evolução: o Azure Bears Black melhorou o jogo de trade e a conversão do first blood mesmo enfrentando adversários mais fortes.
- Rounds "jogados fora" acontecem em proporção parecida em todos os times: é mais azar que padrão (por isso não acusamos ninguém disso).
