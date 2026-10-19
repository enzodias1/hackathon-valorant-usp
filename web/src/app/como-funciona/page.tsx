import Link from "next/link";
import type { Metadata } from "next";
import { getEconomy, getModel } from "@/lib/data";
import { num, pct, pp } from "@/lib/format";
import { PRODUCT_NAME } from "@/lib/site";
import type { ModelInfo } from "@/lib/types";
import { CalibrationChart, TradeDistanceChart } from "@/components/analise/MethodCharts";
import { Section, StatTile, Td, Th } from "@/components/analise/ui";

export const metadata: Metadata = { title: `Como funciona · ${PRODUCT_NAME}` };

const MODELS: { key: keyof ModelInfo["models"]; name: string; text: string }[] = [
  { key: "baseline_alive_lookup", name: "Referência", text: "Só conta quantos jogadores estão vivos de cada lado e consulta a média histórica. Serve de régua." },
  { key: "logistic", name: "Regressão logística", text: "Soma ponderada dos fatores. Simples e transparente, mas trata cada fator separadamente." },
  { key: "gbm", name: "Gradient boosting", text: "Centenas de árvores de decisão pequenas que combinam os fatores: uma spike plantada vale mais quando sobram poucos defensores." },
];

const TOC = [
  ["ideia", "A ideia"],
  ["confiavel", "O modelo é confiável?"],
  ["economia", "Compras"],
  ["distancia", "Jogar perto"],
  ["comparacoes", "Comparações justas"],
  ["glossario", "Glossário"],
  ["limites", "Limites"],
] as const;

export default async function HowItWorksPage() {
  const [model, economy] = await Promise.all([getModel(), getEconomy()]);
  const d = model.definitions;
  const chosen = model.models.gbm;
  // a faixa de calibração perto de 75%, para a frase-chave
  const c75 = model.calibration.reduce((a, b) => (Math.abs(b.p - 0.75) < Math.abs(a.p - 0.75) ? b : a));
  const near = model.trade_by_distance[0];
  const far = model.trade_by_distance.find((t) => t.distance.startsWith(`${d.isolated_distance_m}`)) ?? model.trade_by_distance.at(-1)!;
  const forcePistol = economy.contexts["perdeu o pistol"]?.adjusted_vs_save["Forçar"];
  const forceRound = economy.contexts["perdeu o round anterior"]?.adjusted_vs_save["Forçar"];
  const buyErr = model.buy_matchups.reduce((s, b) => s + Math.abs(b.model - b.real) * b.n, 0) / model.buy_matchups.reduce((s, b) => s + b.n, 0);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="max-w-3xl space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-accent">Método</p>
        <h1 className="text-3xl font-bold text-ink">Como funciona</h1>
        <p className="text-ink-2">
          Tudo no site sai de um único modelo: a cada kill, plant ou desarme, ele estima a chance de cada time vencer o round.
          Aqui mostramos como ele foi construído, como verificamos que ele acerta e o que fazemos para não tirar conclusões de ruído.
        </p>
        <nav aria-label="Seções da página" className="flex flex-wrap gap-2 pt-1">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink">{label}</a>
          ))}
        </nav>
      </header>

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
            ["Diagnóstico", <>Somando os impactos e comparando com a média da liga, saem o diagnóstico do time, a sinergia (quem cobre quem) e o papel real de cada jogador.</>],
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
              mas os dois erram menos de 2 pontos, e só o boosting capta combinações como “spike plantada com 1 defensor vivo”.
            </p>
          </div>
        </div>
      </Section>

      <Section id="economia" title="O modelo entende economia"
               subtitle={`Chance de o ataque vencer o round, prevista antes do primeiro tiro, quando a única informação é o que cada time comprou. Em média, a previsão erra por ${num(buyErr * 100, 1)} pontos percentuais nos confrontos de compra mais comuns.`}>
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
          <Method title="Forçar ou economizar?">
            Quando o time tem menos de {num(economy.definitions.full_buy_credits)} créditos somando dinheiro e armas (sem full buy), comparamos os rounds vencidos no round e nos {economy.definitions.horizon_rounds - 1} seguintes
            para cada decisão, descontando {economy.definitions.controls.join(", ")}.
            {forcePistol && <> Depois de perder o pistol, forçar rendeu <b className="text-ink">{forcePistol.effect >= 0 ? "+" : "−"}{num(Math.abs(forcePistol.effect), 2)} round</b> (intervalo de 90%: {num(forcePistol.ci90[0], 2)} a {num(forcePistol.ci90[1], 2)}).</>}
            {forceRound && <> Depois de perder um round sem full buy: <b className="text-ink">{forceRound.effect >= 0 ? "+" : "−"}{num(Math.abs(forceRound.effect), 2)}</b>.</>}
            {" "}É evidência observacional, e a apresentamos assim. <Link href="/economia" className="text-accent hover:underline">Ver o conselheiro</Link>.
          </Method>
          <Method title="Papel real, pelo comportamento">
            Entrada, Suporte, Lurk e Âncora saem do que o jogador faz (primeiros duelos, trades, distância do time, fim de round), em percentis
            na liga, a partir de {d.min_rounds_role} rounds. O modelo não vê o agente, e mesmo assim 72% dos duelistas caem em Entrada e 71% dos sentinelas em Lurk.
          </Method>
        </div>
      </Section>

      <Section id="glossario" title="Glossário">
        <dl className="grid gap-x-8 gap-y-4 text-sm md:grid-cols-2">
          {[
            ["Impacto (pp)", "Quanto uma jogada mudou a chance de o time vencer o round, em pontos percentuais. +20 pp = de 50% para 70%. O impacto por round é a média por round jogado."],
            ["Trade", `Vingar a morte de um aliado em até ${d.trade_window_s} segundos.`],
            ["Morte isolada", `Morrer com o aliado vivo mais próximo a mais de ${d.isolated_distance_m} m (≈ ${num(d.isolated_distance_m * 100)} unidades do jogo).`],
            ["Papel em jogo", `Entrada (abre o round), Suporte (assistências e trades), Lurk (joga longe do time) ou Âncora (segura o fim do round). Calculado a partir de ${d.min_rounds_role} rounds.`],
            ["Round jogado fora", `O time chegou a ${pct(d.throw_wp)} ou mais de chance e perdeu.`],
            ["Virada", `O time esteve com ${pct(d.comeback_wp)} ou menos de chance e venceu.`],
            ["Significância", "Só mostramos ponto forte ou fraco quando a diferença para a liga é grande demais para ser sorte, já descontados os falsos positivos. Amostras pequenas são sinalizadas."],
            ["AUC · Brier · log loss · calibração", "AUC: o quanto o modelo separa quem vence de quem perde (1 = perfeito, 0,5 = moeda). Brier e log loss: erro das probabilidades (menor é melhor). Calibração: quando diz 70%, acontece ~70%?"],
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
          <li>Só usamos o que está nos dados oficiais das partidas: posições, kills, compras, spike. Não há uso detalhado de utilitárias nem comunicação do time, então o site aponta <i>onde</i> olhar no VOD, sem substituí-lo.</li>
          <li>Amostras pequenas (poucos mapas ou menos de {d.min_rounds_role} rounds) são sinalizadas, e nelas a maioria das comparações fica como “não conclusiva”.</li>
          <li>Os números valem para o cenário universitário destes campeonatos ({num(model.data.matches)} mapas); o cenário profissional pode se comportar de outro jeito.</li>
          <li>As análises de economia e evolução são observacionais: mostram associações controladas, não experimentos.</li>
          <li>
            Rounds “jogados fora” (chegar a {pct(d.throw_wp)} e perder) acontecem em proporção parecida em quase todos os times: a diferença entre eles
            é do tamanho do que o acaso produziria. Por isso esses rounds aparecem como material para revisar no VOD, não como defeito do time.
          </li>
          <li>É uma ferramenta pós-partida: nada aqui é usado durante o jogo.</li>
        </ul>
      </Section>
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
