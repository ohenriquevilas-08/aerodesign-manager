// Temporada desde novembro (Fase 6, S1 e S2): regulamento, fundação, trainees, agenda do
// presidente e o orientador. Funções puras: recebem o estado e devolvem um estado novo.

import { BALANCE } from "./content/balance";
import { actionInAgenda, findAgenda, FOUNDERS, frontOf, type AgendaDef } from "./content/founders";
import { findFormationArea, DEFAULT_CATEGORY } from "./content/formations";
import { SELECTION_END, TRAINEE_END, REGULATION_DATE } from "./content/season2026";
import { nextRandom } from "./rng";
import { addMessage, warn } from "./tasks";
import { clamp, DISCIPLINE_LABELS, learn, traineeProgress } from "./team";
import { dateToHours } from "./time";
import { DISCIPLINES } from "./state";
import type { ActionDef } from "./content/actions";
import type { Discipline, GameState, Member, PresidentAgenda, Task } from "./types";

const EPSILON = 1e-9;

/** Horas de jogo em que o regulamento sai (9/fev). */
export const REGULATION_HOURS = dateToHours(REGULATION_DATE);

/** O regulamento 2026 já saiu? Antes disso a Prancheta fica "Aguardando regulamento". */
export function regulationPublished(state: Pick<GameState, "clock">): boolean {
  return state.clock.hours >= REGULATION_HOURS - EPSILON;
}

/** Em dias de jogo, quanto falta para o regulamento; 0 se já saiu. */
export function daysToRegulation(state: Pick<GameState, "clock">): number {
  return Math.max(0, Math.ceil((REGULATION_HOURS - state.clock.hours) / 24 - EPSILON));
}

/** Pré-condições de ações da Fase 6; null se a ação pode começar agora. */
export function actionProblem(state: GameState, action: ActionDef): string | null {
  switch (action.id) {
    case "read-regulation":
      if (state.regulationRead) return "O regulamento já foi lido.";
      if (!regulationPublished(state)) return "O regulamento só sai em 9/fev. Até lá: estudo, seletiva, trainee, captação e compras.";
      if (state.tasks.some((task) => task.actionId === action.id && task.status !== "done")) return "A leitura do regulamento já está em andamento.";
      return null;
    case "recruitment":
      return state.clock.hours >= dateToHours(SELECTION_END) - EPSILON ? "O processo seletivo é em novembro; a próxima turma só no ano que vem." : null;
    case "trainee-training":
      return state.members.some((member) => member.role === "trainee") ? null : "Não há trainees na equipe.";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Fundação (abertura)
// ---------------------------------------------------------------------------

export interface FoundTeamRequest {
  presidentId: string;
  /** Capitão por disciplina (só as áreas da formação). Pode vir vazio: o organograma de fundação não é rígido. */
  captains: Partial<Record<Discipline, string>>;
  teamName?: string;
}

/** Fundação padrão (provisória em dev e no dev-start-competition): Bia preside, três capitães. */
export function defaultFounding(): FoundTeamRequest {
  return {
    presidentId: "founder-bia",
    captains: { aerodynamics: "founder-marina", structures: "founder-caio", electrical: "founder-rafa" }
  };
}

/**
 * Eleição de fundação: o orientador sugere quem preside e quem capitaneia o quê.
 * Só vale no estado `founding`. Recusa pelo aviso, sem mudar o resto.
 */
export function foundTeam(state: GameState, request: FoundTeamRequest): GameState {
  if (!state.founding) return warn(state, "A equipe já foi fundada.");
  const president = state.members.find((member) => member.id === request.presidentId);
  if (!president) return warn(state, "Escolha o presidente entre os fundadores.");
  const entries = Object.entries(request.captains) as [Discipline, string][];
  const used = new Set<string>([president.id]);
  for (const [discipline, memberId] of entries) {
    if (!findFormationArea(DEFAULT_CATEGORY, discipline)) return warn(state, `${DISCIPLINE_LABELS[discipline] ?? discipline} não é uma área com capitão.`);
    const captain = state.members.find((member) => member.id === memberId);
    if (!captain) return warn(state, "Capitão não encontrado entre os fundadores.");
    if (used.has(memberId)) return warn(state, `${captain.name} já tem outro cargo: cada fundador assume um só.`);
    used.add(memberId);
  }

  const captainArea = new Map(entries.map(([discipline, memberId]) => [memberId, discipline]));
  const members = state.members.map((member): Member => {
    if (member.id === president.id) return { ...member, role: "president" };
    const area = captainArea.get(member.id);
    return area ? { ...member, role: "captain", area } : member;
  });
  const name = request.teamName?.trim();
  const next: GameState = {
    ...state,
    members,
    teamName: name ? name : state.teamName,
    founding: false,
    workshop: { ...state.workshop, keyHolders: [...captainArea.keys()] }
  };
  const chosen = members.find((member) => member.id === president.id)!;
  return addMessage(next, {
    from: "Equipe",
    title: `${next.teamName} fundada`,
    body: `${chosen.name} preside a equipe, com a agenda ${findAgenda(chosen.agenda ?? "balanced").label.toLowerCase()}. A temporada começou: processo seletivo em novembro, trainees até janeiro e o regulamento em 9/fev.`
  }).state;
}

// ---------------------------------------------------------------------------
// Orientador e presidente
// ---------------------------------------------------------------------------

export interface AdvisorView {
  name: string;
  /** "Prof. <nome>", como aparece no cabeçalho. */
  title: string;
  /** 0–100. */
  reputation: number;
}

export function advisorView(state: Pick<GameState, "advisor">): AdvisorView {
  return { name: state.advisor.name, title: `Prof. ${state.advisor.name}`, reputation: Math.round(state.advisor.reputation) };
}

export function awardReputation(state: GameState, amount: number): GameState {
  if (amount <= 0) return state;
  return { ...state, advisor: { ...state.advisor, reputation: clamp(state.advisor.reputation + amount) } };
}

export type AgendaStatus = "none" | "on-track" | "ok" | "behind";

export interface PresidentView {
  id: string;
  name: string;
  agenda: PresidentAgenda;
  agendaLabel: string;
  description: string;
  /** Dias do registro (até BALANCE.agenda.logDays) em que houve tarefa da agenda. */
  alignedDays: number;
  loggedDays: number;
  /** Dias seguidos sem tarefa da agenda, até hoje. */
  idleStreak: number;
  status: AgendaStatus;
  motivation: number;
}

export const findPresident = (state: Pick<GameState, "members">): Member | undefined => state.members.find((member) => member.role === "president");

/** O presidente e como o mês está para a agenda dele; null antes da fundação. */
export function presidentView(state: GameState): PresidentView | null {
  const president = findPresident(state);
  if (!president) return null;
  const agenda: AgendaDef = findAgenda(president.agenda ?? "balanced");
  const log = state.agendaLog;
  const alignedDays = log.filter((entry) => entry.hit).length;
  let idleStreak = 0;
  for (let i = log.length - 1; i >= 0 && !log[i]!.hit; i -= 1) idleStreak += 1;
  const ratio = log.length === 0 ? 0 : alignedDays / log.length;
  const status: AgendaStatus = log.length === 0 ? "none" : ratio >= 0.5 ? "on-track" : ratio >= 0.25 ? "ok" : "behind";
  return {
    id: president.id,
    name: president.name,
    agenda: agenda.id,
    agendaLabel: agenda.label,
    description: agenda.description,
    alignedDays,
    loggedDays: log.length,
    idleStreak,
    status,
    motivation: Math.round(president.motivation)
  };
}

/** A tarefa da ação conta para a agenda do presidente? (balanced: qualquer das três frentes) */
export function alignedWithAgenda(state: GameState, actionId: string): boolean {
  const agenda = findPresident(state)?.agenda;
  return !!agenda && actionInAgenda(agenda, actionId);
}

/**
 * Registra o dia na agenda e cobra a motivação do presidente que ficou 3 dias sem tarefa dela.
 * `before` é o estado no início do passo: as tarefas ativas dele são o que se fez neste passo.
 * Nada é bloqueado: o controle continua direto (docs/phases/fase-6.md).
 */
export function trackAgenda(before: GameState, next: GameState, t0: number, t1: number): GameState {
  const president = findPresident(next);
  if (!president?.agenda) return next;
  const agenda = president.agenda;
  const working = before.tasks.filter((task) => task.status === "active" && task.assignees.length > 0);
  const fronts = new Set(working.map((task) => frontOf(task.actionId)).filter((front) => front !== null));
  const hit = agenda === "balanced" ? fronts.size >= 2 : working.some((task: Task) => actionInAgenda(agenda, task.actionId));

  const day = Math.floor(t0 / 24);
  const log = [...next.agendaLog];
  const last = log[log.length - 1];
  if (last && last.day === day) log[log.length - 1] = { day, hit: last.hit || hit };
  else log.push({ day, hit });
  const trimmed = log.slice(-BALANCE.agenda.logDays);
  let state: GameState = { ...next, agendaLog: trimmed };

  // Fim do dia: sequência sem agenda cobra motivação do presidente.
  if (Math.floor((t1 + EPSILON) / 24) > day) {
    let idle = 0;
    for (let i = trimmed.length - 1; i >= 0 && !trimmed[i]!.hit; i -= 1) idle += 1;
    if (idle >= BALANCE.agenda.idleDays) {
      state = {
        ...state,
        members: state.members.map((member) =>
          member.id === president.id ? { ...member, motivation: clamp(member.motivation - BALANCE.agenda.idlePenalty) } : member
        )
      };
    }
  }
  return state;
}

/** Concluir uma tarefa da agenda dá um bônus pequeno de motivação à equipe inteira. */
export function agendaBoost(state: GameState, actionId: string): GameState {
  if (!alignedWithAgenda(state, actionId)) return state;
  return {
    ...state,
    members: state.members.map((member) => ({ ...member, motivation: clamp(member.motivation + BALANCE.agenda.alignedBoost) }))
  };
}

// ---------------------------------------------------------------------------
// Trainees
// ---------------------------------------------------------------------------

/** Disciplina em que o trainee mais sabe (a primeira se tudo é zero). */
function focusOf(member: Member): Discipline {
  return DISCIPLINES.reduce((best, discipline) => (member.knowledge[discipline] > member.knowledge[best] ? discipline : best), DISCIPLINES[0]!);
}

/**
 * Treino concluído: cada trainee que trabalhou ganha horas de treino e conhecimento no foco.
 * Sem capitão na tarefa, só BALANCE.trainee.withoutCaptainShare das horas aproveitam.
 */
export function applyTraining(state: GameState, task: Task): { state: GameState; body: string } {
  const worked = (member: Member) => task.contributions[member.id] ?? 0;
  const captainPresent = state.members.some((member) => member.role === "captain" && worked(member) > 0);
  const share = captainPresent ? 1 : BALANCE.trainee.withoutCaptainShare;
  const trainees = state.members.filter((member) => member.role === "trainee" && worked(member) > 0);
  if (trainees.length === 0) return { state, body: "Nenhum trainee participou do treino." };
  const members = state.members.map((member) => {
    if (member.role !== "trainee" || worked(member) <= 0) return member;
    const hours = worked(member) * share;
    const focus = focusOf(member);
    return {
      ...member,
      trainingHours: (member.trainingHours ?? 0) + hours,
      knowledge: { ...member.knowledge, [focus]: learn(member.knowledge[focus], hours, BALANCE.trainee.knowledgePerHour) }
    };
  });
  const body = captainPresent
    ? `${trainees.length} ${trainees.length === 1 ? "trainee treinou" : "trainees treinaram"} com o capitão.`
    : "Treino sem capitão: os trainees aproveitaram só metade das horas.";
  return { state: { ...state, members }, body };
}

/** Tira o integrante da equipe: tarefa, escala e chave saem junto. */
export function removeMember(state: GameState, memberId: string): GameState {
  const schedule = Object.fromEntries(
    Object.entries(state.workshop.schedule).map(([slot, ids]) => [slot, (ids ?? []).filter((id) => id !== memberId)])
  );
  return {
    ...state,
    members: state.members.filter((member) => member.id !== memberId),
    tasks: state.tasks.map((task) => ({ ...task, assignees: task.assignees.filter((id) => id !== memberId) })),
    workshop: { ...state.workshop, keyHolders: state.workshop.keyHolders.filter((id) => id !== memberId), schedule }
  };
}

/**
 * Fim da etapa trainee (1/fev): cada trainee vira integrante ou desiste, com chance pela
 * motivação e pelo progresso do treino. Devolve o estado e se algo aconteceu neste passo.
 */
export function resolveTrainees(state: GameState, t0: number, t1: number): GameState {
  const at = dateToHours(TRAINEE_END);
  if (!(t0 < at && at <= t1)) return state;
  const trainees = state.members.filter((member) => member.role === "trainee");
  if (trainees.length === 0) return state;
  let next = state;
  let rng = state.rngState;
  const stayed: string[] = [];
  const left: string[] = [];
  const T = BALANCE.trainee;
  for (const trainee of trainees) {
    const roll = nextRandom(rng);
    rng = roll.state;
    const base = T.stayChanceAtZero + (T.stayChanceAtFull - T.stayChanceAtZero) * (clamp(trainee.motivation) / 100);
    const chance = base * (0.5 + 0.5 * traineeProgress(trainee));
    if (roll.value < chance) {
      stayed.push(trainee.name);
      next = { ...next, members: next.members.map((member) => (member.id === trainee.id ? { ...member, role: "member" as const } : member)) };
    } else {
      left.push(trainee.name);
      next = removeMember(next, trainee.id);
    }
  }
  next = { ...next, rngState: rng };
  const parts = [
    stayed.length > 0 ? `Viraram integrantes: ${stayed.join(", ")}.` : "Ninguém virou integrante.",
    left.length > 0 ? `Desistiram: ${left.join(", ")}.` : "Ninguém desistiu."
  ];
  return addMessage(next, { from: "Equipe", title: "Fim da etapa trainee", body: parts.join(" ") }).state;
}

/** Trainees de uma lista (a UI usa na faixa própria da Equipe). */
export const traineesOf = (state: Pick<GameState, "members">): Member[] => state.members.filter((member) => member.role === "trainee");

/** Fundadores originais (ids de content/founders.ts), na ordem da abertura. */
export const FOUNDER_IDS: readonly string[] = FOUNDERS.map((founder) => founder.id);
