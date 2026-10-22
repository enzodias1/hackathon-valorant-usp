// Apresentação do projeto (o "link da apresentação" que o edital pede, além do vídeo e do protótipo): 8 telas na ordem do
// roteiro do vídeo. Os números vêm dos mesmos dados do site; os poucos fixos dizem de onde saíram.
import Link from "next/link";
import type { Metadata } from "next";
import { getIndex, getModel } from "@/lib/data";
import { num, pct } from "@/lib/format";
import { PRODUCT_NAME, SITE_URL, TAGLINE, TEAM, pageMeta } from "@/lib/site";
import Deck from "@/components/site/Deck";

export const metadata: Metadata = pageMeta(`Apresentação · ${PRODUCT_NAME}`,
  "O problema, os dados, o método e o que o protótipo entrega para jogadores, coaches e organizadores do VALORANT universitário.");

// fixos, com a origem: pipeline/checks.py (checagens) e o impacto médio do first blood (wp_events, README)
const CHECKS = 42;
const FIRST_BLOOD_PTS = 17;

function Slide({ n, kicker, title, children, brand }: {
  n?: string; kicker?: string; title: React.ReactNode; children?: React.ReactNode; brand?: boolean;
}) {
  return (
    <section data-slide className={`relative flex min-h-[100dvh] snap-start items-center overflow-hidden px-6 py-20 sm:px-12 ${brand ? "bg-brand" : "bg-bg"}`}>
      <div className="mx-auto w-full max-w-5xl">
        {kicker && <p className={`label-caps text-xs ${brand ? "text-white/80" : "text-lime"}`}>{n ? `// ${n} · ` : ""}{kicker}</p>}
        <h2 className="font-display mt-3 text-[clamp(2.4rem,5.5vw,4.4rem)] uppercase leading-[1.02] text-white">{title}</h2>
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}

function Big({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="font-display text-[clamp(2rem,4vw,3.2rem)] leading-none text-lime">{value}</p>
      <p className="mt-2 text-sm text-ink-2">{label}</p>
    </div>
  );
}

function Feature({ title, items, href, cta }: { title: string; items: string[]; href: string; cta: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface p-5">
      <h3 className="font-display text-2xl uppercase tracking-wide text-ink">{title}</h3>
      <ul className="mt-3 flex-1 space-y-1.5 text-sm text-ink-2">
        {items.map((i) => <li key={i} className="flex gap-2"><span className="text-lime" aria-hidden>›</span>{i}</li>)}
      </ul>
      <Link href={href} className="label-caps mt-4 w-fit text-[11px] text-ink underline decoration-lime underline-offset-4 hover:text-lime">{cta} →</Link>
    </div>
  );
}

export default async function PresentationPage() {
  const [index, model] = await Promise.all([getIndex(), getModel()]);
  const rounds = index.matches.reduce((s, m) => s + m.score.Red + m.score.Blue, 0);
  const cal = model.calibration.reduce((a, b) => (Math.abs(b.p - 0.75) < Math.abs(a.p - 0.75) ? b : a));
  const gbm = model.models.gbm;
  const near = model.trade_by_distance[0];
  const far = model.trade_by_distance.filter((d) => parseInt(d.distance, 10) >= 30);
  const farRate = far.reduce((s, d) => s + d.trade_rate * d.n, 0) / Math.max(far.reduce((s, d) => s + d.n, 0), 1);
  const braim = index.players.find((p) => p.name.startsWith("BRaim#"));

  return (
    <main>
      <Deck>
        <Slide brand kicker="Hackathon VALORANT · USP São Carlos / SEMCOMP 2026" title={PRODUCT_NAME}>
          <p className="max-w-2xl text-xl leading-relaxed text-white/90">{TAGLINE}: análise pós-partida que mostra quais jogadas decidiram cada
            round, como o time joga junto e o que cada jogador pode melhorar, com os dados oficiais do UNIVAVÁ e da Rush Series.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="label-caps bg-lime px-5 py-3 text-xs text-bg hover:opacity-90">Abrir o protótipo</Link>
            <a href={SITE_URL} className="label-caps border border-white/40 px-5 py-3 text-xs text-white hover:border-white">{SITE_URL.replace("https://", "")}</a>
          </div>
          <p className="mt-10 text-xs text-white/70">Use as setas ou role para passar · F para tela cheia</p>
        </Slide>

        <Slide n="01" kicker="O problema" title={<>Times universitários não têm analista</>}>
          <div className="grid gap-6 md:grid-cols-2">
            <p className="text-lg leading-relaxed text-ink-2">
              K/D e ACS contam kills, mas não dizem <b className="text-ink">quais kills importaram</b> nem <b className="text-ink">o que fazer
              diferente</b>. Times profissionais têm alguém para rever cada round; os universitários, não.
            </p>
            <div className="rounded-xl border border-line bg-surface p-5">
              <p className="label-caps text-[11px] text-muted">Entrevistas</p>
              <p className="mt-2 text-ink">Conversamos com <b>8 jogadores do UFG Eagles</b>, um dos times da base.</p>
              <ul className="mt-3 space-y-1.5 text-sm text-ink-2">
                <li><b className="text-ink">3 de 8</b> querem entender o próprio desempenho e a evolução, além do placar.</li>
                <li><b className="text-ink">2 de 8</b> pediram um replay 2D com as mortes e as melhores jogadas.</li>
                <li><b className="text-ink">2 de 8</b> querem saber como usam as habilidades.</li>
              </ul>
            </div>
          </div>
        </Slide>

        <Slide n="02" kicker="Os dados" title={<>Só a base oficial do campeonato</>}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Big value={num(index.matches.length)} label="mapas" />
            <Big value={num(Object.keys(index.teams).length)} label="times" />
            <Big value={num(index.players.length)} label="jogadores" />
            <Big value={num(rounds)} label="rounds" />
            <Big value={num(model.data.kills)} label="kills" />
          </div>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-2">
            Em cada kill, plant e desarme, a posição e a mira de todos os jogadores vivos. Tudo vem dos JSONs da organização:
            nenhuma API, scraping ou dado externo de partida.
          </p>
        </Slide>

        <Slide n="03" kicker="A ideia" title={<>Cada jogada vale o quanto mudou a chance de vencer</>}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface p-5">
              <p className="label-caps text-[11px] text-lime">1 · Chance de vitória</p>
              <p className="mt-2 text-ink-2">A cada kill, plant e desarme, um modelo calcula a chance de cada time vencer o round: vivos, equipamento, spike e tempo.</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-5">
              <p className="label-caps text-[11px] text-lime">2 · Impacto</p>
              <p className="mt-2 text-ink-2">A variação dessa chance é o impacto da jogada. Um first blood vale, em média, <b className="text-ink">+{FIRST_BLOOD_PTS} pontos</b>; uma kill num round decidido, quase nada.</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-5">
              <p className="label-caps text-[11px] text-lime">3 · Testado</p>
              <p className="mt-2 text-ink-2">Avaliado só em partidas que nunca viu: quando diz <b className="text-ink">{pct(cal.p)}</b>, o time vence <b className="text-ink">{pct(cal.y)}</b> das vezes (AUC {num(gbm.auc, 3)}).</p>
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-2">
            Somando o impacto, saem as jogadas que decidiram cada mapa, o diagnóstico do time contra a liga e o que cada jogador decide de verdade.
          </p>
        </Slide>

        <Slide n="04" kicker="O protótipo" title={<>O que o site entrega</>}>
          <div className="grid gap-4 md:grid-cols-2">
            <Feature title="Partida" href="/partidas/11bcbdbd-ef01-409b-9e90-3d853e73b370#round-12@79" cta="Ver o round 12 de UFMT Turuna × MackLogic RED"
                     items={["Replay 2D de cada round, com a chance de vitória ao vivo", "Resumo automático do que decidiu o round", "Em cada morte: aliado mais perto e quem podia trocar"]} />
            <Feature title="Time" href="/times/ufmt_turuna" cta="Ver o UFMT Turuna"
                     items={["Diagnóstico contra a liga, só com diferenças confirmadas", "Sinergia: quem cobre quem dentro do time", "Onde o time morre, com mapa de calor e regiões"]} />
            <Feature title="Jogador" href={braim ? `/jogadores/${braim.puuid}` : "/jogadores"} cta="Ver um jogador"
                     items={["Impacto por round, além do K/D", "Duelos: contra quem e contra quais agentes ganha e perde", "Quando morre no round e uso das habilidades"]} />
            <Feature title="Comparar e destaques" href="/comparar?a=ufmt_turuna&b=macklogic_red" cta="Comparar dois times"
                     items={["Favorito, mapas para escolher e vetar e o histórico do confronto", "Jogadas de maior impacto e maiores viradas do campeonato", "Tudo com link para o replay no instante exato"]} />
          </div>
        </Slide>

        <Slide n="05" kicker="Por que confiar" title={<>Números que se sustentam</>}>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              [`${CHECKS} checagens automáticas`, "A cada atualização dos dados, o pipeline confere propriedades que precisam valer: impacto que soma zero, placares, vivos de cada time, links."],
              ["Sem falso positivo", "Ponto forte ou fraco só aparece quando a diferença para a liga passa no teste estatístico, com controle de falsos positivos."],
              ["Registrado × estimado", "O replay separa o que a Riot registrou do que é estimado. A mira foi validada: em 99% das kills, quem mata está olhando para a vítima."],
              ["Modelo honesto", "O impacto de cada partida vem de um modelo que nunca viu aquela partida. Casos raros da base (ressurreições, ultimate do Chamber) foram tratados e documentados."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-line bg-surface p-5">
                <p className="font-display text-2xl uppercase tracking-wide text-ink">{t}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-ink-2">
            Exemplo de achado: morrer a menos de 5 m de um aliado dá {pct(near.trade_rate)} de chance de a morte ser trocada; a mais de 30 m, {pct(farRate)}.{" "}
            <Link href="/metodologia" className="text-ink underline decoration-lime underline-offset-4 hover:text-lime">Metodologia completa</Link>
          </p>
        </Slide>

        <Slide n="06" kicker="Valor e viabilidade" title={<>Para quem joga, treina e organiza</>}>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Jogador", "Saber o que melhorar além do K/D: duelos, quando morre, uso das habilidades e as jogadas que decidiram rounds."],
              ["Coach", "Os rounds para rever no VOD, as duplas que funcionam, onde o time morre e como o próximo adversário joga."],
              ["Organização", "Destaques automáticos com link para o replay: conteúdo pronto para redes sociais e transmissão."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-line bg-surface p-5">
                <p className="label-caps text-[11px] text-lime">{t}</p>
                <p className="mt-2 text-ink-2">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-2">
            Site estático, sem servidor: <b className="text-ink">custo zero</b>, abre em qualquer navegador e roda com qualquer campeonato no formato
            oficial da Riot. Atualizar é rodar o pipeline com os arquivos novos. Próximos passos: relatório em PDF por time e atualização a cada rodada.
          </p>
        </Slide>

        <Slide brand n="07" kicker="Equipe" title={<>Obrigado!</>}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((m) => (
              <li key={m.name} className="rounded-xl bg-white/10 p-4">
                <p className="font-display text-2xl uppercase tracking-wide text-white">{m.name}</p>
                <p className="mt-1 text-sm text-white/80">{m.role}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="label-caps bg-lime px-5 py-3 text-xs text-bg hover:opacity-90">Abrir o protótipo</Link>
            <Link href="/como-funciona" className="label-caps border border-white/40 px-5 py-3 text-xs text-white hover:border-white">Como usar</Link>
            <Link href="/metodologia" className="label-caps border border-white/40 px-5 py-3 text-xs text-white hover:border-white">Metodologia</Link>
          </div>
        </Slide>
      </Deck>
    </main>
  );
}
