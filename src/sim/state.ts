// Criação do estado inicial do Ano 1 (design §5.2 e §8.3).

import { BALANCE } from "./content/balance";
import { FOUNDERS, type FounderDef } from "./content/founders";
import { TEAM_POOL } from "./content/teams";
import { createReport } from "./report";
import { drawLook, TEAM_SHIRT_COLOR } from "./looks";
import { nextRandom } from "./rng";
import { createShops } from "./shop";
import { createWorkshop, drawClassSlots } from "./workshop";
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

/** Aluno fundador (content/founders.ts): conhecimento inicial baixo no foco e uma "cara". Ninguém começa com cargo. */
function founderMember(def: FounderDef): Member {
  const knowledge = zeroKnowledge();
  knowledge[def.focus] = def.knowledge;
  return {
    id: def.id,
    name: def.name,
    role: "member",
    knowledge,
    fabrication: def.fabrication,
    piloting: def.piloting,
    agility: 40,
    communication: def.communication,
    motivation: 80,
    hoursPerDay: 3,
    graduation: "2027.2",
    taskId: null,
    workStreakHours: 0,
    classSlots: [],
    area: null,
    look: { skin: 0, hair: 0, hairColor: 0, shirt: TEAM_SHIRT_COLOR },
    agenda: def.agenda,
    flair: def.flair
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

/**
 * Estado inicial do Ano 1: seg, 10/nov/2025, relógio pausado no estado `founding`. Os fundadores
 * convidam o orientador; o comando found-team escolhe presidente e capitães e libera o relógio.
 */
export function createGame(options: { seed: number; teamName: string; advisorName?: string }): GameState {
  const { rivals, rngState: fieldRng } = drawField(options.seed);
  let rngState = fieldRng;
  const members = FOUNDERS.map((def) => {
    const member = founderMember(def);
    const looks = drawLook(rngState);
    const drawn = drawClassSlots(looks.rngState);
    rngState = drawn.rngState;
    return { ...member, classSlots: drawn.slots, look: looks.look };
  });
  return {
    version: 7,
    seed: options.seed,
    rngState,
    clock: { hours: 0, speed: 0 },
    teamName: options.teamName,
    credits: 0,
    members,
    documented: zeroKnowledge(),
    parts: [],
    stock: {},
    equipment: [],
    tasks: [],
    inbox: [
      {
        id: "welcome",
        at: 0,
        from: "Fundadores",
        title: "Convite para orientar a equipe",
        body: "Um grupo de alunos quer criar uma equipe de aerodesign e convida você para ser o professor orientador. Escolham juntos o presidente e os capitães.",
        read: false
      }
    ],
    rivals,
    outreach: 0,
    candidates: [],
    pause: { reason: "start", at: 0, messageId: null },
    warning: null,
    nextId: 1,
    aircraft: null,
    report: createReport(),
    orders: [],
    shops: createShops(),
    competition: null,
    workshop: createWorkshop(members),
    news: [],
    ledger: [],
    testLog: [],
    flightTests: [],
    advisor: { name: options.advisorName ?? "Helena Prado", reputation: BALANCE.advisor.startReputation },
    founding: true,
    regulationRead: false,
    plannedActions: [],
    agendaLog: []
  };
}
