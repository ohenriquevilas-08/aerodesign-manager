// Seletiva de fundação (design §5.2): sorteio de candidatos, pareceres e convites gratuitos.

import {
  CANDIDATE_AGILITY,
  CANDIDATE_COMMUNICATION,
  CANDIDATE_GRADUATIONS,
  CANDIDATE_HOURS_PER_DAY,
  CANDIDATE_NAMES,
  SELECTION_FORMATS,
  type SelectionFormat,
  type SelectionFormatDef
} from "./content/selection";
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

function opinionFor(state: GameState, focus: Discipline, knowledge: number, fabrication: number): string {
  const captainId = AERO_SIDE.includes(focus) ? "captain-aero" : "captain-struct";
  const captain = state.members.find((member) => member.id === captainId)?.name ?? "Capitão";
  const level =
    knowledge >= 30 ? "Chega sabendo; pode puxar a frente" : knowledge >= 15 ? "Tem base e aprende rápido" : "Vai precisar de tempo";
  const shop = fabrication >= 35 ? " Mão boa na oficina." : "";
  return `${captain}: "${level} em ${DISCIPLINE_LABELS[focus]}.${shop}"`;
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
    const free = CANDIDATE_NAMES.filter((name) => !taken.has(name));
    if (free.length === 0) break;
    const name = pick(free);
    taken.add(name);
    const focus = pick(DISCIPLINES);
    const knowledge = zeroKnowledge();
    knowledge[focus] = between(format.focusKnowledge);
    const fabrication = between(format.fabrication);
    const classes = drawClassSlots(rng);
    rng = classes.rngState;
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
      opinion: opinionFor(state, focus, knowledge[focus], fabrication),
      classSlots: classes.slots
    });
    nextId += 1;
  }
  return { ...state, rngState: rng, nextId, candidates: [...state.candidates, ...drawn] };
}

/** Convite gratuito (design §8.3): o candidato vira integrante sem tarefa. */
export function hireCandidate(state: GameState, candidateId: string): GameState | null {
  const candidate = state.candidates.find((item) => item.id === candidateId);
  if (!candidate) return null;
  const member: Member = {
    id: `member-${state.nextId}`,
    name: candidate.name,
    role: "member",
    knowledge: { ...candidate.knowledge },
    fabrication: candidate.fabrication,
    piloting: 0,
    agility: candidate.agility,
    communication: candidate.communication,
    motivation: candidate.motivation,
    hoursPerDay: candidate.hoursPerDay,
    graduation: candidate.graduation,
    taskId: null,
    workStreakHours: 0,
    classSlots: [...candidate.classSlots]
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
  if (!state.members.some((member) => member.role === "member")) missing.push("third");
  return missing;
}

/** Inscritos esperados antes da qualidade da equipe: base do formato + alcance de divulgação. */
export function expectedApplicants(format: SelectionFormatDef, outreach: number): number {
  return format.baseApplicants + format.applicantsPerReach * outreach;
}
