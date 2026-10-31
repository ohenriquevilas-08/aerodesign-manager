// Criação do estado inicial do Ano 1 (design §5.2 e §8.3).

import { TEAM_POOL } from "./content/teams";
import { nextRandom } from "./rng";
import type { Discipline, GameState, Member, RivalTeam } from "./types";

export const DISCIPLINES: readonly Discipline[] = [
  "conceptual",
  "aerodynamics",
  "performance",
  "stability",
  "loads",
  "structures",
  "electrical"
];

export const FIELD_SIZE = 30;

export const zeroKnowledge = (): Record<Discipline, number> =>
  Object.fromEntries(DISCIPLINES.map((discipline) => [discipline, 0])) as Record<Discipline, number>;

function founder(id: string, name: string, role: Member["role"], focus: Discipline | null): Member {
  const knowledge = zeroKnowledge();
  if (focus) knowledge[focus] = 25;
  return {
    id,
    name,
    role,
    knowledge,
    fabrication: 20,
    piloting: 0,
    agility: 40,
    motivation: 80,
    hoursPerDay: role === "president" ? 2 : 3,
    graduation: "2027.2",
    taskId: null,
    workStreakHours: 0
  };
}

/** Sorteia o campo da Classe Regular: rivais de destaque + nacionais até FIELD_SIZE. */
export function drawField(seed: number): { rivals: RivalTeam[]; rngState: number } {
  const highlighted = TEAM_POOL.filter((team) => team.archetype !== null);
  const rest = TEAM_POOL.filter((team) => team.archetype === null && !team.foreign);
  let state = seed;
  const shuffled = [...rest];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const roll = nextRandom(state);
    state = roll.state;
    const j = Math.floor(roll.value * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const field = [...highlighted, ...shuffled.slice(0, FIELD_SIZE - highlighted.length)];
  const rivals = field.map(({ id, name, institution, acronym, city, state: uf, archetype }) => ({
    id,
    name,
    institution,
    acronym,
    city,
    state: uf,
    archetype
  }));
  return { rivals, rngState: state };
}

export function createGame(options: { seed: number; teamName: string }): GameState {
  const { rivals, rngState } = drawField(options.seed);
  return {
    version: 2,
    seed: options.seed,
    rngState,
    clock: { hours: 0, speed: 0 },
    teamName: options.teamName,
    credits: 0,
    members: [
      founder("president", "Você", "president", null),
      founder("captain-aero", "Capitão de Aerodinâmica", "captain", "aerodynamics"),
      founder("captain-struct", "Capitã de Estruturas", "captain", "structures")
    ],
    documented: zeroKnowledge(),
    parts: [],
    stock: {},
    equipment: [],
    tasks: [],
    inbox: [
      {
        id: "welcome",
        at: 0,
        from: "Comissão Técnica",
        title: "Regulamento 2026 publicado",
        body: "O Regulamento da Competição Aerodesign Brasil 2026 está disponível. Leia antes de definir o avião.",
        read: false
      }
    ],
    rivals,
    candidates: [],
    pause: { reason: "start", at: 0, messageId: null },
    warning: null,
    nextId: 1
  };
}
