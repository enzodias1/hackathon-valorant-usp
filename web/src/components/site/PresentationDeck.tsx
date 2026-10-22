// Apresentação do projeto: a primeira tela do site (raiz), em tela inteira e sem o menu. Telas na ordem do roteiro do vídeo,
// terminando no "Curtiu? Bora testar?", que leva ao site (/inicio). Os números vêm dos mesmos dados do site; os poucos fixos dizem
// de onde saíram. (O edital fala em "link da apresentação": é o link do site, que abre aqui.)
import Link from "next/link";
import { getIndex, getModel } from "@/lib/data";
import { num, pct } from "@/lib/format";
import { PRODUCT_NAME, TAGLINE } from "@/lib/site";
import Deck from "@/components/site/Deck";

// fixo, com a origem: o impacto médio do first blood (wp_events, README)
const FIRST_BLOOD_PTS = 17;

function Slide({ n, kicker, title, children, brand, art }: {
  n?: string; kicker?: string; title: React.ReactNode; children?: React.ReactNode; brand?: boolean;
  /** arte de agente à direita do título, mirando nele (capa) */
  art?: { src: string; alt: string };
}) {
  return (
    <section data-slide className={`relative isolate flex min-h-[100dvh] snap-start items-center overflow-hidden px-6 py-20 sm:px-12 ${brand ? "bg-brand" : "bg-bg"}`}>
      <div className="mx-auto w-full max-w-5xl">
        {/* com arte, o texto quebra na largura do título e a arte começa logo depois do nome (lg+) */}
        <div className={art ? "lg:w-min" : undefined}>
          {kicker && <p className={`label-caps text-xs ${brand ? "text-white/80" : "text-lime"} ${art ? "lg:whitespace-nowrap" : ""}`}>{n ? `// ${n} · ` : ""}{kicker}</p>}
          <div className="relative">
            <h2 className={`font-display mt-3 text-[clamp(2.4rem,5.5vw,4.4rem)] uppercase leading-[1.02] text-white ${art ? "lg:whitespace-nowrap" : ""}`}>{title}</h2>
            {art && (
              // a ponta da flecha fica em (20,6%, 33,2%) da imagem: o translate a põe um pouco acima do meio do título,
              // porque a flecha desce para a esquerda e a linha dela cruza o nome
              // eslint-disable-next-line @next/next/no-img-element
              <img src={art.src} alt={art.alt}
                   className="pointer-events-none absolute left-full top-1/2 -z-10 ml-4 hidden h-[min(82dvh,60vw)] w-auto max-w-none translate-y-[calc(-33.2%-1.25rem)] drop-shadow-[0_20px_40px_rgba(0,0,0,0.35)] lg:block" />
            )}
          </div>
          {children && <div className="mt-8">{children}</div>}
        </div>
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

function Feature({ title, items, href, cta, extra }: { title: string; items: string[]; href: string; cta: string; extra?: { href: string; cta: string } }) {
  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface p-5">
      <h3 className="font-display text-2xl uppercase tracking-wide text-ink">{title}</h3>
      <ul className="mt-3 flex-1 space-y-1.5 text-sm text-ink-2">
        {items.map((i) => <li key={i} className="flex gap-2"><span className="text-lime" aria-hidden>›</span>{i}</li>)}
      </ul>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {[{ href, cta }, ...(extra ? [extra] : [])].map((l) => (
          <Link key={l.href} href={l.href} className="label-caps w-fit text-[11px] text-ink underline decoration-lime underline-offset-4 hover:text-lime">{l.cta} →</Link>
        ))}
      </div>
    </div>
  );
}

function Shortcut({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="group rounded-xl bg-white/10 p-4 transition-colors hover:bg-white/20">
      <p className="font-display text-xl uppercase tracking-wide text-white">{title} <span className="text-lime transition-transform group-hover:translate-x-0.5" aria-hidden>→</span></p>
      <p className="mt-1 text-sm text-white/80">{text}</p>
    </Link>
  );
}

export default async function PresentationDeck() {
  const [index, model] = await Promise.all([getIndex(), getModel()]);
  const rounds = index.matches.reduce((s, m) => s + m.score.Red + m.score.Blue, 0);
  const cal = model.calibration.reduce((a, b) => (Math.abs(b.p - 0.75) < Math.abs(a.p - 0.75) ? b : a));
  const gbm = model.models.gbm;
  const braim = index.players.find((p) => p.name.startsWith("BRaim#"));

  return (
    // data-landing: o layout tira o espaço do menu lateral nesta página
    <main data-landing>
      {/* para quem já conhece: pular a apresentação */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/inicio" className="pointer-events-auto flex items-center gap-2" aria-label={`${PRODUCT_NAME}: ir para o site`}>
          <span className="font-display text-2xl uppercase leading-none tracking-wide text-white">Analista</span>
          <span className="rounded-[3px] bg-lime px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-bg">Univavá</span>
        </Link>
        <Link href="/inicio" className="label-caps pointer-events-auto rounded-full border border-white/40 bg-bg/40 px-4 py-2 text-[11px] text-white backdrop-blur hover:border-white">
          Ir para o site →
        </Link>
      </div>
      <Deck>
        <Slide brand kicker="Hackathon VALORANT · USP São Carlos / SEMCOMP 2026" title={PRODUCT_NAME}
               art={{ src: "/art/agents/sova_cover.webp", alt: "Sova, agente do VALORANT, mirando o arco" }}>
          <p className="max-w-2xl text-xl leading-relaxed text-white/90">{TAGLINE}: análise pós-partida que mostra quais jogadas decidiram cada
            round, como o time joga junto e o que cada jogador pode melhorar, com os dados oficiais do UNIVAVÁ e da Rush Series.</p>
          <p className="mt-10 text-sm text-white/80">Role ou use as setas para conhecer o projeto · F para tela cheia</p>
        </Slide>

        <Slide n="01" kicker="O problema" title={<>Times universitários não têm analista</>}>
          <div className="grid gap-6 md:grid-cols-2">
            <p className="text-lg leading-relaxed text-ink-2">
              K/D e ACS contam kills, mas não dizem <b className="text-ink">quais kills importaram</b> nem <b className="text-ink">o que fazer
              diferente</b>. Times profissionais têm alguém para rever cada round; os universitários, não.
            </p>
            <div className="rounded-xl border border-line bg-surface p-5">
              <p className="label-caps text-[11px] text-muted">Entrevistas</p>
              <p className="mt-2 text-ink">
                Ouvimos <b>21 jogadores e jogadoras</b> dos 4 times da UFG que disputaram o UNIVAVÁ: UFG Eagles, UFG Eagles Blue,
                UFG Eagles GC e Gambiarra UFG.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-ink-2">
                <li><b className="text-ink">12</b> pediram um replay 2D com as mortes e as melhores jogadas.</li>
                <li><b className="text-ink">7</b> querem entender o próprio desempenho e a evolução, além do placar.</li>
                <li><b className="text-ink">2</b> querem saber como usaram as habilidades.</li>
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
            Em cada kill, plant e desarme, a posição e a mira de todos os jogadores vivos.
          </p>
        </Slide>

        <Slide n="03" kicker="A ideia" title={<>Quanto cada jogada pesou no round</>}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface p-5">
              <p className="label-caps text-[11px] text-lime">1 · Chance de vitória</p>
              <p className="mt-2 text-ink-2">A cada kill, plant e desarme, um modelo calcula a chance de cada time vencer o round, considerando os players vivos, o equipamento, a spike e o tempo.</p>
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
                     items={["Replay 2D de cada round, com a chance de vitória em cada momento", "Resumo automático do que decidiu o round", "Em cada morte: aliado mais perto e quem podia trocar"]} />
            <Feature title="Time" href="/times/ufmt_turuna" cta="Ver o UFMT Turuna"
                     items={["Diagnóstico contra a liga, só com diferenças confirmadas", "Sinergia: quem cobre quem dentro do time", "Onde o time morre, com mapa de calor e regiões"]} />
            <Feature title="Jogador" href={braim ? `/jogadores/${braim.puuid}` : "/jogadores"} cta="Ver um jogador"
                     items={["Impacto por round, além do K/D", "Duelos: contra quem e contra quais agentes ganha e perde", "Quando morre no round e uso das habilidades"]} />
            <Feature title="Comparar e destaques" href="/comparar?a=ufmt_turuna&b=macklogic_red" cta="Comparar dois times"
                     extra={{ href: "/destaques", cta: "Ver os destaques" }}
                     items={["Time × time: favorito, mapas para escolher e vetar e o histórico do confronto", "Jogador × jogador: duelos diretos e estatísticas lado a lado", "Jogadas de maior impacto e maiores viradas, com link para o replay"]} />
          </div>
        </Slide>

        <Slide n="05" kicker="Valor e viabilidade" title={<>Para quem joga, treina e organiza</>}>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Jogador", "Saber o que melhorar além do K/D: duelos, quando morre, uso das habilidades e as jogadas que decidiram rounds."],
              ["Coach", "Os rounds para rever no VOD, as duplas que funcionam, onde o time morre e como o próximo adversário joga."],
              ["Organização", "Destaques automáticos com link para o replay: conteúdo já mapeado, que pode ser útil para redes sociais e transmissão."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-line bg-surface p-5">
                <p className="label-caps text-[11px] text-lime">{t}</p>
                <p className="mt-2 text-ink-2">{d}</p>
              </div>
            ))}
          </div>
        </Slide>

        <Slide brand kicker="Agora é com você" title={<>Curtiu? Bora testar?</>}>
          <p className="max-w-2xl text-xl leading-relaxed text-white/90">
            Todas as {num(index.matches.length)} partidas, {num(Object.keys(index.teams).length)} times e {num(index.players.length)} jogadores estão no site. Comece por onde quiser:
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Shortcut href="/partidas/11bcbdbd-ef01-409b-9e90-3d853e73b370#round-12@79" title="Um round no replay" text="Em um 4x2 com a spike plantada faltando 14 segundos para explodir, a UFMT tinha 99% de chance de vitória e perdeu." />
            <Shortcut href="/times" title="O seu time" text="Diagnóstico, sinergia, onde o time morre e os rounds para revisar." />
            <Shortcut href="/comparar/jogadores" title="Jogador × jogador" text="Quem vence o duelo direto e as estatísticas lado a lado." />
            <Shortcut href="/destaques" title="Destaques" text="As jogadas que mais mudaram rounds e as maiores viradas." />
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/inicio" className="label-caps bg-lime px-6 py-3.5 text-xs text-bg hover:opacity-90">Explorar o site →</Link>
          </div>
        </Slide>
      </Deck>
    </main>
  );
}
