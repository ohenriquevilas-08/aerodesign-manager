// Alunos não determinados (Fase 8, S5; design §5.1): o que a pessoa diz gostar pode estar errado,
// o que ela gosta e detesta de verdade fica escondido, e a facilidade em cada disciplina só aparece
// depois de horas de trabalho nela. Tudo sorteado pelo rngState; nada aqui lê o relógio.

import { BALANCE } from "./content/balance";
import { nextRandom } from "./rng";
import { DISCIPLINES, zeroKnowledge } from "./state";
import { DISCIPLINE_LABELS } from "./team";
import type { Aptitude, Candidate, Discipline, GameState, Member } from "./types";

export interface Preferences {
  statedLikes: Discipline[];
  likes: Discipline[];
  dislikes: Discipline[];
  aptitude: Record<Discipline, Aptitude>;
}

/**
 * Sorteia o que a pessoa diz gostar, o que gosta e detesta de verdade e a facilidade em cada
 * disciplina. De cada gosto declarado, BALANCE.people.statedTruthShare bate com o real. Com
 * `stated` (fundadores) o declarado é dado; sem ele, sai 0 a 2 itens do sorteio.
 */
export function drawPreferences(rngState: number, stated?: readonly Discipline[]): { prefs: Preferences; rngState: number } {
  let rng = rngState;
  const roll = () => {
    const r = nextRandom(rng);
    rng = r.state;
    return r.value;
  };
  const pickFrom = (pool: readonly Discipline[]): Discipline | null => (pool.length === 0 ? null : pool[Math.floor(roll() * pool.length)]!);
  const without = (pool: readonly Discipline[], taken: readonly Discipline[]) => pool.filter((item) => !taken.includes(item));
  const truth = BALANCE.people.statedTruthShare;

  // Gostos reais: 1 ou 2 disciplinas.
  const likes: Discipline[] = [];
  const statedLikes: Discipline[] = [];
  if (stated) {
    // O declarado é dado; cada item é verdadeiro com chance `truth`.
    for (const discipline of stated) {
      statedLikes.push(discipline);
      if (roll() < truth) likes.push(discipline);
    }
    if (likes.length === 0 || roll() < 0.4) {
      const extra = pickFrom(without(DISCIPLINES, [...likes, ...stated]));
      if (extra) likes.push(extra);
    }
  } else {
    const count = roll() < 0.5 ? 1 : 2;
    while (likes.length < count) likes.push(pickFrom(without(DISCIPLINES, likes))!);
    // Quantos itens declara: nenhum (10%), um (50%) ou dois (40%).
    const declared = roll();
    const declareCount = declared < 0.1 ? 0 : declared < 0.6 ? 1 : 2;
    for (let i = 0; i < declareCount; i += 1) {
      const trueOnes = without(likes, statedLikes);
      const pick = roll() < truth ? pickFrom(trueOnes) : null;
      const wrong = pickFrom(without(DISCIPLINES, [...likes, ...statedLikes]));
      const chosen = pick ?? wrong ?? pickFrom(without(DISCIPLINES, statedLikes));
      if (chosen) statedLikes.push(chosen);
    }
  }
  // Detesta uma disciplina que não gosta.
  const dislike = pickFrom(without(DISCIPLINES, likes));
  const dislikes = dislike ? [dislike] : [];

  const aptitudeFor = (): Aptitude => {
    const r = roll();
    if (r < BALANCE.aptitude.chanceSlow) return "slow";
    if (r > 1 - BALANCE.aptitude.chanceFast) return "fast";
    return "normal";
  };
  const aptitude = Object.fromEntries(DISCIPLINES.map((discipline) => [discipline, aptitudeFor()])) as Record<Discipline, Aptitude>;
  return { prefs: { statedLikes, likes, dislikes, aptitude }, rngState: rng };
}

/** Conhecimento inicial baixo e parecido em todas as disciplinas (base ± pequena variação). */
export function drawBaseKnowledge(rngState: number): { knowledge: Record<Discipline, number>; rngState: number } {
  let rng = rngState;
  const knowledge = zeroKnowledge();
  const { baseKnowledge, knowledgeSpread } = BALANCE.people;
  for (const discipline of DISCIPLINES) {
    const r = nextRandom(rng);
    rng = r.state;
    knowledge[discipline] = Math.round(baseKnowledge + (r.value * 2 - 1) * knowledgeSpread);
  }
  return { knowledge, rngState: rng };
}

/** Multiplicador do ganho de conhecimento da pessoa nessa disciplina (facilidade escondida). */
export function aptitudeFactor(member: Pick<Member, "aptitude">, discipline: Discipline): number {
  return BALANCE.aptitude.factor[member.aptitude[discipline]] ?? 1;
}

export const APTITUDE_LABELS: Record<Aptitude, string> = { slow: "Aprende devagar", normal: "Aprende no ritmo normal", fast: "Aprende rápido" };

/** A facilidade da pessoa nessa disciplina já apareceu? Antes disso a UI mostra "?". */
export const isAptitudeRevealed = (member: Pick<Member, "revealedAptitude">, discipline: Discipline): boolean =>
  member.revealedAptitude.includes(discipline);

/** Texto da revelação, ex.: "Enzo pegou rápido Cargas e aeroelasticidade". */
export function revealText(name: string, discipline: Discipline, aptitude: Aptitude): string {
  const first = name.split(" ")[0]!;
  const subject = DISCIPLINE_LABELS[discipline];
  if (aptitude === "fast") return `${first} pegou rápido ${subject}.`;
  if (aptitude === "slow") return `${first} está tendo mais dificuldade em ${subject}; vai precisar de mais horas.`;
  return `${first} está indo no ritmo esperado em ${subject}.`;
}

/**
 * Revela a facilidade de uma pessoa numa disciplina (horas de trabalho suficientes, ou, na Fase 9,
 * o ramo da árvore do orientador que adianta isso). Devolve o estado e o texto, ou null se já era conhecida.
 */
export function revealAptitude(state: GameState, memberId: string, discipline: Discipline): { state: GameState; text: string } | null {
  const member = state.members.find((item) => item.id === memberId);
  if (!member || isAptitudeRevealed(member, discipline)) return null;
  const members = state.members.map((item) =>
    item.id === memberId ? { ...item, revealedAptitude: [...item.revealedAptitude, discipline] } : item
  );
  return { state: { ...state, members }, text: revealText(member.name, discipline, member.aptitude[discipline]) };
}

/** Passa preferências e facilidade do candidato para o integrante contratado. */
export const preferencesOf = (candidate: Candidate): Preferences => ({
  statedLikes: [...candidate.statedLikes],
  likes: [...candidate.likes],
  dislikes: [...candidate.dislikes],
  aptitude: { ...candidate.aptitude }
});
