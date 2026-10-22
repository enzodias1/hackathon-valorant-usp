# Roteiro-base do vídeo pitch (até 5:00)

**Para o Jodão adaptar.** Os trechos marcados com **[ENTREVISTA]** são para entrar o que você ouviu nas conversas (resumo em
[`entrevistas_ufg.md`](entrevistas_ufg.md)): uma frase real de jogador vale mais que qualquer número. Todos os números abaixo foram
conferidos nos dados (21/10); se mudar algum, confira com o Enzo.

- **Ritmo:** ~140 palavras por minuto. As falas abaixo somam ~610 palavras ≈ 4:20, sobrando só ~40 s para as falas das entrevistas e
  pausas. Está apertado: se passar de 5:00, os primeiros cortes são a frase dos 41% × 6% (time) e a do eco do Macklogic (comparar).
- **Tela:** gravar o site rodando (https://analista-univava.vercel.app) com zoom do navegador em 110–125% para ler bem no vídeo. No replay,
  use o botão **⛶ Tela cheia** (ou a tecla **F**): mostra o título do round, o resumo, o mapa grande e a sequência de eliminações.
- **O que a banca vai pontuar** (lembrar ao gravar): Inovação · Impacto · Qualidade da análise · Viabilidade · Usabilidade · Apresentação.

---

## 0:00–0:25 · Gancho
**Tela:** replay do round 12 de UFMT Turuna × Macklogic Red (Fase de Grupos) em tela cheia, tocando de 1:19 até o desarme, com o quadro
"O que decidiu o round" no topo e a chance de vitória caindo de 99%.
Link direto: https://analista-univava.vercel.app/partidas/11bcbdbd-ef01-409b-9e90-3d853e73b370#round-12@79

> "Round 12. O UFMT está em 4 contra 2, com a spike plantada: 99% de chance de vencer. Em um segundo e meio, a Jett adversária faz
> três kills, e o Cypher desarma a spike 55 milésimos de segundo antes de morrer. O placar mostra só um round perdido. Nós mostramos
> **o round que decidiu o jogo**, e por quê."

## 0:25–0:55 · O problema
**Tela:** página inicial do site.

> "Times profissionais têm analistas. Times universitários, não. E as estatísticas que todo mundo usa, como K/D e ACS, contam
> kills, mas não dizem **quais kills importaram** nem **o que fazer diferente**."
>
> "Conversamos com 8 jogadores do UFG Eagles. O mais pedido foi entender o próprio desempenho, além do placar; e dois pediram
> exatamente um replay 2D com os agentes, as mortes e as melhores jogadas de cada time."
>
> **[ENTREVISTA]** *uma frase marcante de um dos entrevistados (ex.: o pedido do "momento exato em que cada habilidade foi usada").*

## 0:55–1:40 · Como usamos os dados
**Tela:** página "Metodologia": números da base e gráfico de calibração.

> "Usamos os dados oficiais de **336 mapas** do UNIVAVÁ e da Rush Series: 68 times, 411 jogadores, mais de 46 mil kills, com a posição
> e a mira de todo mundo em cada uma."
>
> "Treinamos um modelo que calcula, a cada kill, plant e desarme, a **chance de cada time vencer o round**. Testamos só em partidas
> que ele nunca viu, e ele é calibrado: **quando diz 75%, o time vence 74% das vezes**."
>
> "A variação dessa chance é o **impacto** de cada jogada. Um first blood vale, em média, 17 pontos de chance de vitória. Uma kill
> num round já decidido, quase nada."

## 1:40–3:50 · Demonstração (o coração do vídeo)

**1:40 · Partida: o replay**: momentum da partida → round 12 → replay tocando (pode ser em tela cheia).
> "Cada round vira um replay: cada jogador com o agente e a mira, a chance de vitória ao vivo e um resumo do que decidiu o round,
> escrito sozinho a partir dos dados. Em cada morte, o site mostra se havia um aliado perto e se alguém tinha visão de quem matou:
> a pergunta que o coach faz no VOD, respondida na hora."

**2:10 · Time**: UFMT Turuna: diagnóstico → sinergia → "Onde o time morre".
> "Na página do time, o diagnóstico compara com a liga: o UFMT vence 61% dos rounds atacando, contra 52% da liga, e é resiliente quando
> perde o primeiro duelo. O grafo mostra **quem cobre quem**: quais duplas vingam a morte uma da outra."
>
> "E isso importa: morrer a menos de 5 metros de um aliado dá **41%** de chance de a morte ser trocada; a mais de 30 metros, **6%**."

**2:45 · Jogador**: BRaim (Unicamp Tritons Black): perfil → "Duelos" → "Quando morre no round" → "Habilidades".
> "O K/D engana. Este jogador está no percentil 32 em K/D, mas no **percentil 59 em impacto**: as jogadas dele acontecem quando o
> round está em jogo. E o papel é descoberto pelo comportamento: joga de iniciador, mas age como **clutch**."
>
> "E o que os jogadores pediram nas entrevistas está aqui: contra quem ele mais perde duelos, em que momento do round costuma morrer
> e se usa as habilidades mais ou menos que a média do agente."

**3:25 · Comparar**: UFMT Turuna × Macklogic Red.
> "Para o próximo jogo, o comparador mostra quem é favorito, quais mapas escolher e vetar, e o histórico do confronto: em cada mapa,
> a jogada que mais pesou, com o replay a um clique. O Macklogic economizou nas 8 vezes que perdeu o pistol: dá para esperar eco no round 2."

## 3:50–4:25 · Por que confiar
**Tela:** "Metodologia" → "O replay: o que é registrado e o que é estimado" e "Comparações justas".

> "Um número sozinho engana, então tomamos cuidados. Cada comparação desconta o tamanho da amostra e passa por um **controle
> de falsos positivos**. O replay sempre diz o que foi registrado pela Riot e o que é estimado, e validamos até a mira: em 99% das
> kills, quem mata está olhando para a vítima. E **41 checagens automáticas** garantem que os números fecham."

## 4:25–5:00 · Valor e viabilidade + fechamento
**Tela:** página do time → página inicial com o link visível.

> "Para o jogador: saber o que melhorar, além do K/D. Para o coach: os rounds para rever, as duplas que funcionam e como o adversário
> joga. E o site é estático, sem servidor: roda com qualquer campeonato no formato oficial, a custo zero."
>
> **[ENTREVISTA]** *se possível, a reação de um jogador do UFG Eagles ao ver a página do próprio time.*
>
> "**[nome do produto]**: o analista que os times universitários não têm."

---

## Checklist de gravação
- [ ] Testar todas as telas antes de gravar (link da Vercel, não o local).
- [ ] Gravar a tela em 1080p; áudio com fone/microfone, ambiente sem eco.
- [ ] No replay, usar a tela cheia (F) e a velocidade 1× nos momentos-chave; espaço toca/pausa, ← → pulam de jogada.
- [ ] Cortar tempos mortos de carregamento na edição.
- [ ] Legendas nos números-chave (99% → derrota; 75% → 74%; 41% × 6%).
- [ ] Conferir o tempo final: **até 5:00**.
- [ ] Publicar no YouTube como **não listado** e testar o link em aba anônima.
- [ ] Nome da equipe e dos integrantes na tela final (o formulário também pede).

## Números de reserva (se precisar trocar algum exemplo)
- Modelo: AUC 0,885; erro de calibração 1,2%; validado com 5 grupos de partidas.
- Uma vantagem de 55% por round vira ~70% de chance de vencer o mapa.
- Papéis pelo comportamento: 72% dos duelistas caem em "Entry" e 71% dos sentinelas em "Lurker", sem o modelo ver o agente.
- "K/D engana" com mais contraste que o BRaim (59 × 32): **Elden** (Macklogic White), percentil 14 em K/D e **71 em impacto**
  (Support, iniciador); **MacMolho** (UFMG Fênix B), 37 em K/D e **82 em impacto** (Clutch, controlador).
- Replay: a mira de quem mata aponta para a vítima em 99% das 45.440 kills; 99,97% das posições ficam no chão do mapa.
- UFG Eagles (time dos entrevistados): 13º mais forte de 68; vence 77% dos rounds defendendo (liga: 48%); o darnubra tem o maior
  impacto por round entre os jogadores com 60+ rounds.
- Evolução: o Azure Bears Black melhorou o jogo de trade e a conversão do first blood mesmo enfrentando adversários mais fortes.
- Rounds "jogados fora" acontecem em proporção parecida em todos os times: é mais azar que padrão (por isso não acusamos ninguém disso).
