// Explicação padrão de "chance de vitória" e "pontos de chance", no botão "i" dos lugares onde esses termos aparecem
// pela primeira vez (replay, momentum, jogadas que mais mudaram rounds). O texto acompanha o que o modelo usa de fato.
import Link from "next/link";
import InfoTip from "./InfoTip";
import { TermList } from "./ui";

export const CHANCE_EXPLAINED = (
  <>
    <b className="text-ink">Chance de vitória</b> é a probabilidade, calculada pelo nosso modelo, de cada time vencer o round naquele
    instante. Ele olha quantos estão vivos de cada lado, o equipamento deles, se a spike foi plantada e o tempo.{" "}
    <b className="text-ink">Pontos de chance</b> são quanto uma jogada mudou essa probabilidade: se ela vai de 45% para 76%, a jogada vale
    +31 pontos. O modelo foi testado em partidas que nunca viu: quando diz 75%, o time vence 74% das vezes.{" "}
    <Link href="/metodologia#confiavel" className="text-ink underline decoration-lime underline-offset-4 hover:text-lime">Ver a metodologia</Link>
  </>
);

export default function ChanceInfo({ align, lead }: {
  align?: "left" | "right";
  /** definições do que o lugar mostra (ex.: o que é uma virada), antes da explicação da chance */
  lead?: [string, string][];
}) {
  const text = lead ? <><TermList terms={lead} className="mb-2" />{CHANCE_EXPLAINED}</> : CHANCE_EXPLAINED;
  return <InfoTip text={text} label="O que é chance de vitória e pontos de chance" align={align} />;
}
