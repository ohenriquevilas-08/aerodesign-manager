// Calendário anual e ações agendadas (Fase 6, S3; docs/phases/fase-6.md).
// `startAt` é sempre em horas de jogo (use dateToHours para uma data); o dia vem de clockToDate.

import { estimateRemainingDays } from "./crew";
import { findAction } from "./content/actions";
import { findShop } from "./content/shops";
import { findVenue } from "./content/testVenues";
import { DISCIPLINES } from "./state";
import { OFFICIAL_CALENDAR, SEASON_START, type Deadline } from "./content/season2026";
import { findSelectionFormat } from "./selection";
import { actionProblem } from "./season";
import { addMessage, assignMember, startAction, warn } from "./tasks";
import { academicFactor, clockToDate, dateToHours } from "./time";
import type { GameState, OrderStatus, PauseReason, PlannedAction, TaskDedication } from "./types";

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

export interface ScheduleActionRequest {
  actionId: string;
  /** Horas de jogo; precisa estar no futuro. */
  startAt: number;
  targetId?: string;
  dedication?: TaskDedication;
  /** Quem entra ao começar; vazio = a tarefa nasce sem ninguém alocado. */
  memberIds?: string[];
}

function startAtProblem(state: GameState, startAt: number): string | null {
  if (!Number.isFinite(startAt)) return "Escolha uma data para a ação.";
  if (startAt < state.clock.hours) return "Essa data já passou.";
  return null;
}

/** Entra em `plannedActions` e vira tarefa sozinha no `startAt` (ver advancePlanned). */
export function scheduleAction(state: GameState, request: ScheduleActionRequest): GameState {
  const action = findAction(request.actionId);
  if (!action) return warn(state, "Ação desconhecida.");
  const problem = startAtProblem(state, request.startAt);
  if (problem) return warn(state, problem);
  const targetId = request.targetId ?? null;
  // Só os alvos que não mudam com o tempo; peça e tarefa são conferidos na hora de começar.
  if (action.target === "discipline" && !DISCIPLINES.includes(targetId as never)) return warn(state, "Escolha a disciplina antes de agendar.");
  if (action.target === "selection-format" && !findSelectionFormat(targetId)) return warn(state, "Escolha o formato da seletiva antes de agendar.");
  const memberIds = [...new Set(request.memberIds ?? [])];
  if (memberIds.some((id) => !state.members.some((member) => member.id === id))) return warn(state, "Integrante não encontrado.");
  const planned: PlannedAction = {
    id: `plan-${state.nextId}`,
    actionId: action.id,
    startAt: request.startAt,
    targetId,
    dedication: request.dedication ?? "normal",
    memberIds
  };
  return { ...state, plannedActions: [...state.plannedActions, planned], nextId: state.nextId + 1 };
}

export function rescheduleAction(state: GameState, plannedId: string, startAt: number): GameState {
  if (!state.plannedActions.some((item) => item.id === plannedId)) return warn(state, "Essa ação agendada não existe mais.");
  const problem = startAtProblem(state, startAt);
  if (problem) return warn(state, problem);
  return { ...state, plannedActions: state.plannedActions.map((item) => (item.id === plannedId ? { ...item, startAt } : item)) };
}

export function unscheduleAction(state: GameState, plannedId: string): GameState {
  if (!state.plannedActions.some((item) => item.id === plannedId)) return warn(state, "Essa ação agendada não existe mais.");
  return { ...state, plannedActions: state.plannedActions.filter((item) => item.id !== plannedId) };
}

// ---------------------------------------------------------------------------
// Execução no relógio
// ---------------------------------------------------------------------------

/**
 * Começa as ações agendadas que venceram até t1. Sem gente, caixa ou pré-condição nessa hora,
 * a ação não começa: sai da lista, avisa na caixa de entrada e pausa o relógio.
 */
export function advancePlanned(state: GameState, t1: number): { state: GameState; pauses: { reason: PauseReason; messageId: string }[] } {
  const due = state.plannedActions.filter((item) => item.startAt <= t1).sort((a, b) => a.startAt - b.startAt);
  if (due.length === 0) return { state, pauses: [] };
  const dueIds = new Set(due.map((item) => item.id));
  let next: GameState = { ...state, plannedActions: state.plannedActions.filter((item) => !dueIds.has(item.id)) };
  const pauses: { reason: PauseReason; messageId: string }[] = [];

  for (const plan of due) {
    const action = findAction(plan.actionId)!;
    const fail = (reason: string) => {
      const added = addMessage(next, { from: "Calendário", title: `Ação agendada não começou: ${action.label}`, body: reason });
      next = added.state;
      pauses.push({ reason: "scheduled", messageId: added.id });
    };

    const gate = actionProblem(next, action);
    if (gate) {
      fail(gate);
      continue;
    }
    const free = plan.memberIds.filter((id) => next.members.find((member) => member.id === id)?.taskId === null);
    if (action.cost.hours > 0 && plan.memberIds.length > 0 && free.length < action.crew.min) {
      const missing = plan.memberIds.filter((id) => !free.includes(id)).map((id) => next.members.find((member) => member.id === id)?.name ?? id);
      fail(`Faltou gente: ${missing.length > 0 ? `${missing.join(", ")} não está livre` : "equipe insuficiente"}. A tarefa pede pelo menos ${action.crew.min}.`);
      continue;
    }

    const started = startAction(next, plan.actionId, plan.targetId, plan.dedication);
    if (started.warning?.id !== next.warning?.id && started.warning) {
      fail(started.warning.text);
      continue;
    }
    next = started;
    const task = next.tasks[next.tasks.length - 1]!;
    if (task.status !== "done") {
      for (const id of free.slice(0, action.crew.max)) next = assignMember(next, id, task.id);
    }
    next = addMessage(next, { from: "Calendário", title: `Ação agendada começou: ${task.label}`, body: "A tarefa começou sozinha, como marcado no calendário." }).state;
  }
  return { state: next, pauses };
}

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

export interface CalendarTask {
  taskId: string;
  label: string;
  startedAt: number;
  /** Fim previsto em horas de jogo (espera prometida ou ritmo atual); null se a tarefa está parada. */
  endsAt: number | null;
  status: "waiting" | "active";
}

export interface CalendarPlanned {
  plannedId: string;
  actionId: string;
  label: string;
  startAt: number;
  memberIds: string[];
}

export interface CalendarFlightTest {
  testId: string;
  venueId: string;
  title: string;
  at: number;
  filmed: boolean;
}

export interface CalendarOrder {
  orderId: string;
  label: string;
  /** Prazo prometido (o real fica escondido). */
  expectedAt: number;
  status: OrderStatus;
}

export interface CalendarDay {
  /** Meia-noite UTC do dia (ms). */
  date: number;
  /** Dia do mês, 1–31. */
  day: number;
  /** 0 = domingo. */
  weekday: number;
  today: boolean;
  past: boolean;
  /** Período acadêmico do dia: rótulo e fator de horas. */
  academic: { label: string; factor: number };
  milestones: Deadline[];
  planned: CalendarPlanned[];
  flightTests: CalendarFlightTest[];
  tasks: CalendarTask[];
  orders: CalendarOrder[];
}

export interface CalendarMonth {
  year: number;
  /** 1–12. */
  month: number;
  /** Dia da semana do dia 1 (0 = domingo), para a grade. */
  firstWeekday: number;
  days: CalendarDay[];
}

/** Um mês do calendário: por dia, marcos, período acadêmico, ações agendadas, ensaios, tarefas e pedidos. */
export function calendarMonth(state: GameState, year: number, month: number): CalendarMonth {
  const first = Date.UTC(year, month - 1, 1);
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const nowMs = clockToDate(state.clock.hours);
  const todayStart = Math.floor(nowMs / DAY_MS) * DAY_MS;

  const tasks: CalendarTask[] = state.tasks
    .filter((task) => task.status !== "done")
    .map((task) => {
      const days = estimateRemainingDays(state, task.id);
      const promised = task.status === "waiting" ? task.expectedReadyAt : null;
      const endsAt = days === null ? null : state.clock.hours + days * 24;
      return { taskId: task.id, label: task.label, startedAt: task.startedAt, endsAt: endsAt ?? promised, status: task.status as "waiting" | "active" };
    });
  const orders: CalendarOrder[] = state.orders
    .filter((order) => order.status !== "delivered")
    .map((order) => ({ orderId: order.id, label: `Pedido: ${findShop(order.shopId)?.name ?? order.shopId}`, expectedAt: order.expectedAt, status: order.status }));
  const flightTests: CalendarFlightTest[] = state.flightTests
    .filter((test) => test.status === "scheduled")
    .map((test) => ({
      testId: test.id,
      venueId: test.venueId,
      title: `Ensaio de voo: ${findVenue(test.venueId)?.name ?? test.venueId}${test.filmed ? " (filmado)" : ""}`,
      at: test.at,
      filmed: test.filmed
    }));

  const days: CalendarDay[] = [];
  for (let i = 0; i < count; i += 1) {
    const date = first + i * DAY_MS;
    const from = dateToHours(date);
    const to = from + 24;
    const inDay = (at: number) => at >= from && at < to;
    days.push({
      date,
      day: i + 1,
      weekday: new Date(date).getUTCDay(),
      today: date === todayStart,
      past: date < todayStart,
      academic: { label: academicFactor(date).label, factor: academicFactor(date).factor },
      milestones: OFFICIAL_CALENDAR.filter((item) => item.date === date),
      planned: state.plannedActions
        .filter((item) => inDay(item.startAt))
        .map((item) => ({ plannedId: item.id, actionId: item.actionId, label: findAction(item.actionId)?.label ?? item.actionId, startAt: item.startAt, memberIds: item.memberIds })),
      flightTests: flightTests.filter((test) => inDay(test.at)),
      // Tarefa aparece do dia em que começou até o fim previsto (ou até hoje, se está parada).
      tasks: tasks.filter((task) => {
        const end = task.endsAt ?? state.clock.hours;
        return task.startedAt < to && end >= from;
      }),
      orders: orders.filter((order) => inDay(order.expectedAt))
    });
  }
  return { year, month, firstWeekday: new Date(first).getUTCDay(), days };
}

export interface SeasonMonth {
  year: number;
  /** 1–12. */
  month: number;
  /** "nov 2025". */
  label: string;
  /** Marcos oficiais do mês, em ordem de data. */
  milestones: Deadline[];
  current: boolean;
  past: boolean;
}

const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Quantos meses tem a temporada (nov a nov). */
export const SEASON_MONTHS = 13;

/** Os 13 meses da temporada com os marcos principais, para a faixa do topo do calendário. */
export function seasonOverview(state: GameState): SeasonMonth[] {
  const start = new Date(SEASON_START);
  const now = new Date(clockToDate(state.clock.hours));
  const nowIndex = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + now.getUTCMonth() - start.getUTCMonth();
  return Array.from({ length: SEASON_MONTHS }, (_, index) => {
    const when = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const year = when.getUTCFullYear();
    const month = when.getUTCMonth() + 1;
    return {
      year,
      month,
      label: `${MONTH_LABELS[month - 1]} ${year}`,
      milestones: OFFICIAL_CALENDAR.filter((item) => {
        const date = new Date(item.date);
        return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month;
      }),
      current: index === nowIndex,
      past: index < nowIndex
    };
  });
}
