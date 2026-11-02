// Seletiva de fundação (design §5.2): sorteio de candidatos, pareceres e convites gratuitos.

import {
  CANDIDATE_AGILITY,
  CANDIDATE_COMMUNICATION,
  CANDIDATE_GRADUATIONS,
  CANDIDATE_HOURS_PER_DAY,
  SELECTION_FORMATS,
  type SelectionFormat,
  type SelectionFormatDef
} from "./content/selection";
import { TRAINEE_END } from "./content/season2026";
import { BALANCE } from "./content/balance";
import { drawBaseKnowledge, drawPreferences, preferencesOf } from "./aptitude";
import { drawLook } from "./looks";
import { drawPerson } from "./naming";
import { dateToHours } from "./time";
import { nextRandom } from "./rng";
import { DISCIPLINES, zeroKnowledge } from "./state";
import { drawClassSlots } from "./workshop";
import { DISCIPLINE_LABELS } from "./team";
import type { Candidate, Discipline, GameState, Member } from "./types";

export function findSelectionFormat(id: string | null): SelectionFormatDef | undefined {
  return SELECTION_FORMATS.find((format) => format.id === id);
}

/** Disciplinas que cada capitão fundador avalia. */
const AERO_SIDE: readonly Discipline[] = ["conceptual", "aerodynamics", "performance", "stability"];

/** Parecer do capitão (Fase 8, S5): o que a pessoa diz curtir, não uma medida do que ela faz bem. */
function opinionFor(state: GameState, focus: Discipline, stated: readonly Discipline[], fabrication: number): string {
  const captains = state.members.filter((member) => member.role === "captain");
  const side = AERO_SIDE.includes(focus);
  const captain =
    (captains.find((member) => member.area !== null && AERO_SIDE.includes(member.area) === side) ?? captains[0])?.name ?? "A equipe";
  const intent =
    stated.length === 0
      ? "Ainda não soube dizer do que gosta"
      : `Diz que curte ${stated.map((discipline) => DISCIPLINE_LABELS[discipline]).join(" e ")}`;
  const shop = fabrication >= 24 ? " Parece ter mão boa na oficina." : "";
  return `${captain}: "${intent}. Só trabalhando para saber.${shop}"`;
}

/** Sorteia `count` candidatos do formato com rngState; nomes não repetem integrantes nem candidatos. */
export function drawCandidates(state: GameState, formatId: SelectionFormat, count: number): GameState {
  const format = findSelectionFormat(formatId)!;
  let rng = state.rngState;
  const roll = () => {
    const result = nextRandom(rng);
    rng = result.state;
    return result.value;
  };
  const between = ([min, max]: readonly [number, number]) => Math.round(min + roll() * (max - min));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(roll() * items.length)]!;

  const taken = new Set([...state.members.map((member) => member.name), ...state.candidates.map((item) => item.name)]);
  let nextId = state.nextId;
  const drawn: Candidate[] = [];
  for (let i = 0; i < count; i += 1) {
    const drawnName = drawPerson(rng, taken);
    rng = drawnName.rngState;
    const name = drawnName.name;
    taken.add(name);
    // Conhecimento baixo e parecido em tudo; um bônus pequeno na disciplina que ele diz gostar.
    const base = drawBaseKnowledge(rng);
    rng = base.rngState;
    const drawnPrefs = drawPreferences(rng);
    rng = drawnPrefs.rngState;
    const prefs = drawnPrefs.prefs;
    const focus = prefs.statedLikes[0] ?? pick(DISCIPLINES);
    const knowledge = base.knowledge;
    knowledge[focus] += between(format.focusKnowledge);
    const fabrication = between(format.fabrication);
    const classes = drawClassSlots(rng);
    rng = classes.rngState;
    const looks = drawLook(rng, drawnName.female);
    rng = looks.rngState;
    drawn.push({
      id: `cand-${nextId}`,
      name,
      format: format.id,
      focus,
      knowledge,
      fabrication,
      agility: between(CANDIDATE_AGILITY),
      communication: between(CANDIDATE_COMMUNICATION),
      motivation: between(format.motivation),
      hoursPerDay: between(CANDIDATE_HOURS_PER_DAY),
      graduation: pick(CANDIDATE_GRADUATIONS),
      ...prefs,
      opinion: opinionFor(state, focus, prefs.statedLikes, fabrication),
      classSlots: classes.slots,
      look: looks.look
    });
    nextId += 1;
  }
  return { ...state, rngState: rng, nextId, candidates: [...state.candidates, ...drawn] };
}

/** Convite gratuito (design §8.3): o candidato vira integrante sem tarefa. */
export function hireCandidate(state: GameState, candidateId: string): GameState | null {
  const candidate = state.candidates.find((item) => item.id === candidateId);
  if (!candidate) return null;
  const now = state.clock.hours;
  const member: Member = {
    id: `member-${state.nextId}`,
    name: candidate.name,
    // Quem entra na seletiva chega como trainee e passa pela etapa (design §5.2).
    role: now < dateToHours(TRAINEE_END) ? "trainee" : "member",
    knowledge: { ...candidate.knowledge },
    fabrication: candidate.fabrication,
    piloting: 0,
    agility: candidate.agility,
    communication: candidate.communication,
    motivation: candidate.motivation,
    hoursPerDay: candidate.hoursPerDay,
    graduation: candidate.graduation,
    taskId: null,
    energy: BALANCE.energy.start,
    ...preferencesOf(candidate),
    revealedAptitude: [],
    studyHours: zeroKnowledge(),
    classSlots: [...candidate.classSlots],
    area: null,
    look: { ...candidate.look },
    ...(now < dateToHours(TRAINEE_END) ? { trainingHours: 0 } : {})
  };
  return {
    ...state,
    members: [...state.members, member],
    candidates: state.candidates.filter((item) => item.id !== candidateId),
    nextId: state.nextId + 1
  };
}

/**
 * Elenco mínimo para o projeto (design §5.2): Aerodinâmica, Estruturas e uma terceira pessoa
 * além do presidente e dos capitães. Devolve o que falta (vazio = completo).
 */
export function missingCast(state: GameState): ("aerodynamics" | "structures" | "third")[] {
  const missing: ("aerodynamics" | "structures" | "third")[] = [];
  if (!state.members.some((member) => member.knowledge.aerodynamics > 0)) missing.push("aerodynamics");
  if (!state.members.some((member) => member.knowledge.structures > 0)) missing.push("structures");
  if (!state.members.some((member) => member.role === "member" || member.role === "trainee")) missing.push("third");
  return missing;
}

/** Inscritos esperados antes da qualidade da equipe: base do formato + alcance de divulgação. */
export function expectedApplicants(format: SelectionFormatDef, outreach: number): number {
  return format.baseApplicants + format.applicantsPerReach * outreach;
}
