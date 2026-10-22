import type { Metadata } from "next";
import { getModel } from "@/lib/data";
import { num, pct, pp } from "@/lib/format";
import { PRODUCT_NAME, pageMeta } from "@/lib/site";
import type { ModelInfo } from "@/lib/types";
import { BUY_BASIS, BUY_TERMS } from "@/lib/glossary";
import { CalibrationChart, TradeDistanceChart } from "@/components/analise/MethodCharts";
import { PageBand, Section, StatTile, Td, Th } from "@/components/analise/ui";

export const metadata: Metadata = pageMeta(`Metodologia · ${PRODUCT_NAME}`, "Como o modelo de chance de vitória foi construído e validado: quando ele diz 75%, o time vence 74% das vezes.");

const MODELS: { key: keyof ModelInfo["models"]; name: string; text: string }[] = [
  { key: "baseline_alive_lookup", name: "Referência", text: "Só conta quantos jogadores estão vivos de cada lado e consulta a média histórica. Serve de régua." },
  { key: "logistic", name: "Regressão logística", text: "Soma ponderada dos fatores. Simples e transparente, mas trata cada fator separadamente." },
  // taxas reais da base (wp_states): o ataque vence 40% dos 1 contra 1 sem a spike e 64% com ela; no 1 contra 4, 0,6% e 2%
  { key: "gbm", name: "Gradient boosting", text: "Centenas de árvores de decisão pequenas que combinam os fatores: o peso da spike plantada depende de quantos estão vivos. Num 1 contra 1, ela leva o ataque de 40% para 64% de vitória; num 1 contra 4, quase não muda nada." },
];

const TOC = [
  ["ideia", "A ideia"],
  ["confiavel", "O modelo é confiável?"],
  ["economia", "Compras"],
  ["distancia", "Jogar perto"],
  ["replay", "Replay"],
  ["comparacoes", "Comparações justas"],
  ["termos", "Termos técnicos"],
  ["limites", "Limites"],
] as const;

export default async function MethodologyPage() {
  const model = await getModel();
  const d = model.definitions;
  const chosen = model.models.gbm;
  // a faixa de calibração perto de 75%, para a frase-chave
  const c75 = model.calibration.reduce((a, b) => (Math.abs(b.p - 0.75) < Math.abs(a.p - 0.75) ? b : a));
  const near = model.trade_by_distance[0];
  const far = model.trade_by_distance.find((t) => t.distance.startsWith(`${d.isolated_distance_m}`)) ?? model.trade_by_distance.at(-1)!;
  const buyErr = model.buy_matchups.reduce((s, b) => s + Math.abs(b.model - b.real) * b.n, 0) / model.buy_matchups.reduce((s, b) => s + b.n, 0);

  return (
    <main>
      <PageBand kicker="Para quem quer os detalhes" title="Metodologia"
                actions={
                  <nav aria-label="Seções da página" className="flex flex-wrap gap-2">
                    {TOC.map(([id, label]) => (
                      <a key={id} href={`#${id}`} className="label-caps border border-white/50 px-2.5 py-1.5 text-[10px] text-white transition-colors hover:border-white hover:bg-white hover:text-brand">{label}</a>
                    ))}
                  </nav>
                }>
        Tudo no site sai de um único modelo: a cada kill, plant ou desarme, ele estima a chance de cada time vencer o round.
        Aqui mostramos como ele foi construído, como verificamos que ele acerta e o que fazemos para não tirar conclusões de ruído.
      </PageBand>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Partidas (mapas)" value={num(model.data.matches)} />
          <StatTile label="Rounds" value={num(model.data.rounds)} />
          <StatTile label="Kills" value={num(model.data.kills)} />
          <StatTile label="Situações avaliadas" value={num(model.data.states)} sub="antes e depois de cada kill, plant ou desarme" />
        </div>

        <Section id="ideia" title="A ideia em 3 passos">
          <ol className="grid gap-3 md:grid-cols-3">
            {[
              ["Chance de vitória", <>A cada kill, plant ou desarme, o modelo estima a chance de cada time vencer o round, olhando {model.features.join(", ")}.</>],
              ["Impacto da jogada", <>A variação dessa chance é o <b className="text-ink">impacto</b>. Se uma kill leva o time de 52% para 77%, ela vale {pp(25, 0)}. Uma kill num round já decidido vale quase nada.</>],
              ["Diagnóstico", <>Somando os impactos e comparando com a média da liga, saem o diagnóstico do time e de cada jogador e a sinergia (quem cobre quem).</>],
            ].map(([title, text], i) => (
              <li key={i} className="rounded-lg bg-surface-2 p-4">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-sm font-bold text-bg" aria-hidden>{i + 1}</span>
                <h3 className="mt-3 font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-sm text-ink-2">{text}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="confiavel" title="O modelo é confiável?"
                 subtitle={`Testamos o modelo só em partidas que ele nunca viu: as ${num(model.data.matches)} partidas são divididas em 5 grupos, e cada grupo é avaliado por um modelo treinado nos outros 4 (validação cruzada por partida). O impacto de cada jogada no site também é calculado assim, sem que o modelo tenha “decorado” aquela partida.`}>
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-ink">
                Quando o modelo diz <b>{pct(c75.p)}</b>, o time vence <b>{pct(c75.y)}</b> das vezes.
              </p>
              <CalibrationChart data={model.calibration} />
              <p className="mt-2 text-xs text-muted">
                Cada ponto agrupa momentos com chances previstas parecidas. A linha tracejada é o acerto perfeito: quanto mais perto dela, mais as
                probabilidades são confiáveis (erro médio de calibração: {pct(chosen.ece, 1)}).
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-ink-2">Três modelos comparados (menor erro é melhor; AUC maior é melhor)</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr><Th>Modelo</Th><Th right>AUC</Th><Th right>Brier</Th><Th right>Log loss</Th></tr></thead>
                  <tbody>
                    {MODELS.map((m) => {
                      const s = model.models[m.key];
                      const isChosen = m.key === model.chosen;
                      return (
                        <tr key={m.key} className={isChosen ? "bg-surface-2" : ""}>
                          <Td>
                            <div className="font-medium text-ink">{m.name}{isChosen && <span className="ml-2 text-xs font-normal text-accent">escolhido</span>}</div>
                            <div className="mt-0.5 text-xs text-ink-2">{m.text}</div>
                          </Td>
                          <Td right>{num(s.auc, 3)}</Td>
                          <Td right>{num(s.brier, 3)}</Td>
                          <Td right>{num(s.log_loss, 3)}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-ink-2">
                <b className="text-ink">Por que o gradient boosting?</b> Ele teve o menor erro nas probabilidades (Brier e log loss) e separou melhor
                quem vence de quem perde (AUC). A regressão logística ficou um pouco mais bem calibrada ({pct(model.models.logistic.ece, 1)} contra {pct(chosen.ece, 1)}),
                mas os dois erram menos de 2 pontos, e só o boosting capta combinações como “spike plantada num 1 contra 1”.
              </p>
            </div>
          </div>
        </Section>

        <Section id="economia" title="O modelo entende economia"
                 subtitle={`Chance de o ataque vencer o round, prevista antes do primeiro tiro, quando a única informação é o que cada time comprou. Em média, a previsão erra por ${num(buyErr * 100, 1)} pontos percentuais nos confrontos de compra mais comuns.`}>
          <p className="text-sm text-ink-2">{BUY_BASIS}</p>
          <dl className="mb-5 mt-3 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {BUY_TERMS.map(([term, def]) => (
              <div key={term} className="border-l-2 border-brand-2/60 pl-3">
                <dt className="font-medium text-ink">{term}</dt>
                <dd className="text-ink-2">{def.charAt(0).toUpperCase() + def.slice(1)}</dd>
              </div>
            ))}
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><Th>Ataque × defesa</Th><Th right>Previsto</Th><Th right>Real</Th><Th right>Rounds</Th></tr></thead>
              <tbody>
                {[...model.buy_matchups].sort((a, b) => b.model - a.model).map((b) => (
                  <tr key={`${b.atk_buy}-${b.def_buy}`}>
                    <Td className="text-ink">{b.atk_buy} <span className="text-muted">×</span> {b.def_buy}</Td>
                    <Td right>{pct(b.model)}</Td>
                    <Td right>{pct(b.real)}</Td>
                    <Td right className="text-ink-2">{num(b.n)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="distancia" title="Por que jogar perto importa"
                 subtitle={`Trade = vingar a morte de um aliado em até ${d.trade_window_s} segundos. Com um aliado a menos de 5 m, ${pct(near.trade_rate)} das mortes são trocadas; a ${far.distance}, só ${pct(far.trade_rate)}.`}>
          <TradeDistanceChart data={model.trade_by_distance} />
          <p className="mt-2 text-sm text-ink-2">
            Por isso chamamos de <b className="text-ink">morte isolada</b> quando o aliado vivo mais próximo está a mais de {d.isolated_distance_m} m:
            quase nunca alguém consegue trocar. E a taxa de <b className="text-ink">mortes trocadas</b> é, depois da própria taxa de vitória, a métrica
            que mais separa os times da liga: é onde o jogo coletivo aparece nos números.
          </p>
        </Section>

        <Section id="replay" title="O replay: o que é registrado e o que é estimado"
                 subtitle="Os dados registram a posição e a direção da mira de todos os jogadores vivos em cada kill, plant e desarme. Entre esses instantes, o movimento é estimado, e o replay sempre avisa qual dos dois está na tela.">
          <div className="grid gap-3 md:grid-cols-2">
            <Method title="Registrado nos dados">
              Posição e mira de todos os vivos em cada evento (cerca de 8 registros por round; o primeiro sai, na mediana, aos 15,7 s), a vítima de cada kill, a arma ou a habilidade que matou, o plant, o desarme e o que cada um comprou.
              <b className="text-ink"> A direção da mira foi validada:</b> em 99% das 45.440 kills, quem mata está olhando para a vítima (diferença mediana de 0,3°).
            </Method>
            <Method title="Estimado entre os registros">
              Cada jogador anda pelo <b className="text-ink">chão do mapa</b> (grade de ~0,7 m tirada do minimapa oficial; as linhas brancas são paredes;
              99,97% das posições registradas ficam no chão ou a até 1,4 m dele), pelo caminho mais curto que <b className="text-ink">evita a visão dos
              inimigos</b> quando dá tempo, no ritmo de corrida, e se move no momento mais seguro. No começo do round, sai do spawn.
            </Method>
            <Method title="Saltos e ressurreições">
              Se o caminho exige mais de 7,5 m/s (correndo não passa de ~6,75 m/s), o trecho vira um salto (↯): o jogador some e reaparece.
              Isso acontece em 0,9% dos trechos e se concentra em quem tem mobilidade (Iso 6,6%, Neon 5,3%, Yoru 2,6%) contra ~0,3% nos demais.
              Casos que os dados não revelam, como uma ultimate dentro de um intervalo longo, entram como <b className="text-ink">anotação da equipe</b>, sempre identificada.
              <b className="text-ink"> Ressurreições</b> (ultimate da Sage num aliado, ou da Clove nela mesma) aparecem nos dados: quem morreu volta à
              lista de vivos. São 95 em 91 rounds. Cada uma vira uma jogada de quem reviveu (a Sage do time, ou a própria Clove):
              vale a diferença na chance de vitória com e sem o jogador de volta (em média, +19 pontos). O momento exato não vem nos dados,
              só o intervalo entre dois registros, e o replay mostra esse intervalo.
            </Method>
            <Method title="O que os dados não têm">
              O momento de uso de cada habilidade (smokes, flashes, drones): os dados informam só o total por partida, que mostramos por agente.
              Por isso a análise de &ldquo;quem podia trocar&rdquo; considera só as paredes do mapa, sem smokes nem diferença de altura, e o replay
              mostra onde olhar no VOD, sem substituí-lo.
            </Method>
          </div>
        </Section>

        <Section id="comparacoes" title="Comparações justas"
                 subtitle="Um número sozinho não diz nada. Estas são as regras que usamos antes de chamar algo de ponto forte, fraco ou de recomendação.">
          <div className="grid gap-3 md:grid-cols-2">
            <Method title="Só o que não é ruído">
              Cada métrica é comparada com a média da liga, levando em conta o tamanho da amostra ({d.significance}). Como cada página testa
              muitas métricas ao mesmo tempo, algumas pareceriam diferentes só por sorte. Aplicamos o controle de falsos positivos de
              <b className="text-ink"> Benjamini-Hochberg</b> (no máximo 10% de alarmes falsos entre as afirmações de cada página). Sem ele, cerca de 1 ou 2
              “pontos fortes” por time seriam ruído.
            </Method>
            <Method title="Força dos times">
              Um ranking de força (modelo de <b className="text-ink">Bradley-Terry</b>) estima a chance de cada time vencer um round contra um time médio,
              descontando a economia. Times com poucos mapas ficam perto da média até que haja dados suficientes. A evolução no campeonato
              também desconta a força dos adversários: sem isso, todo time “pioraria” na Fase de Grupos.
            </Method>
          </div>
        </Section>

        <Section id="termos" title="Termos técnicos">
          <dl className="grid gap-x-8 gap-y-4 text-sm md:grid-cols-2">
            {[
              ["AUC", "O quanto o modelo separa quem vence de quem perde: 1 = perfeito, 0,5 = cara ou coroa."],
              ["Brier · log loss", "Erro das probabilidades previstas em relação ao que aconteceu. Menor é melhor; o log loss pune mais os erros confiantes."],
              ["Calibração", "Quando o modelo diz 70%, o time vence perto de 70% das vezes? O erro de calibração é a distância média entre o previsto e o real."],
              ["Validação cruzada por partida", "Cada partida é avaliada por um modelo treinado sem ela, para que o modelo não “decore” as partidas que analisa."],
              ["Impacto (WPA)", "Variação da chance de vitória no instante de cada kill, plant ou desarme, em pontos percentuais: são os “pontos de chance” do site (de 45% para 76%, +31 pontos). Eventos depois do fim do round valem zero."],
              ["Significância", "Ponto forte ou fraco só quando a diferença para a liga passa no teste estatístico, já com o controle de falsos positivos. Amostras pequenas são sinalizadas."],
            ].map(([term, def]) => (
              <div key={term}>
                <dt className="font-medium text-ink">{term}</dt>
                <dd className="mt-0.5 text-ink-2">{def}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="limites" title="Limites honestos">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
            <li>Só usamos o que está nos dados oficiais das partidas: posições, kills, compras, spike. Não há uso detalhado de utilitárias nem comunicação do time.</li>
            <li>Amostras pequenas (poucos mapas ou menos de {d.min_rounds_role} rounds) são sinalizadas, e nelas a maioria das comparações fica como “não conclusiva”.</li>
            <li>A análise de evolução é observacional: mostra associações controladas, não experimentos.</li>
            <li>
              Rounds “jogados fora” (chegar a {pct(d.throw_wp)} e perder) acontecem em proporção parecida em quase todos os times: a diferença entre eles
              é do tamanho do que o acaso produziria. Por isso esses rounds aparecem como material para revisar no VOD, não como defeito do time.
            </li>
            <li>É uma ferramenta pós-partida: nada aqui é usado durante o jogo.</li>
          </ul>
        </Section>
      </div>
    </main>
  );
}

function Method({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-surface-2 p-4">
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-ink-2">{children}</p>
    </div>
  );
}
