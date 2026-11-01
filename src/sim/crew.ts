// Trabalho em grupo: quantas pessoas cabem numa tarefa e quanto cada uma rende,
// e a estimativa de duração que a UI mostra antes e durante a tarefa.

import { findAction, type ActionDef, type Crew } from "./content/actions";
import { BALANCE } from "./content/balance";
import { findDedication, type Dedication } from "./content/dedication";
import { memberHoursPerDay } from "./team";
import { clockToDate } from "./time";
import { workshopDays } from "./workshop";
import type { GameState, Member } from "./types";

/** Limite de busca da estimativa: além disso a tarefa é tratada como "não termina". */
const MAX_ESTIMATE_DAYS = 400;

/**
 * Horas-pessoa por dia que cada integrante rende na tarefa. Abaixo de crew.min ninguém rende;
 * acima de crew.ideal os que rendem menos entram com BALANCE.crew.extraEfficiency.
 */
export function crewRates(members: readonly Member[], crew: Crew, date: number): Map<string, number> {
  const rates = new Map<string, number>();
  if (members.length < crew.min || members.length === 0) return rates;
  const ranked = members
    .map((member, index) => ({ member, index, rate: memberHoursPerDay(member, date) }))
    .sort((a, b) => b.rate - a.rate || a.index - b.index);
  ranked.forEach(({ member, rate }, position) => {
    rates.set(member.id, position < crew.ideal ? rate : rate * BALANCE.crew.extraEfficiency);
  });
  return rates;
}

/** Dias para completar `hours` horas-pessoa com esses integrantes a partir de `fromHours`; null se não avança. */
function workDays(state: GameState, action: ActionDef, memberIds: readonly string[], hours: number, fromHours: number): number | null {
  if (hours <= 0) return 0;
  // Oficina: só contam os turnos escalados; escala vazia = não anda.
  if (action.workshop) return workshopDays(state, action, memberIds, hours, fromHours);
  const crew = action.crew;
  const members = memberIds.map((id) => state.members.find((member) => member.id === id)).filter((m): m is Member => !!m);
  let remaining = hours;
  for (let day = 0; day < MAX_ESTIMATE_DAYS; day += 1) {
    const date = clockToDate(fromHours + day * 24);
    let perDay = 0;
    crewRates(members, crew, date).forEach((rate) => (perDay += rate));
    if (perDay <= 0 && day === 0 && members.length < crew.min) return null;
    if (perDay >= remaining) return day + remaining / perDay;
    remaining -= perDay;
  }
  return null;
}

/**
 * Estimativa em dias (prazo ⌛ + trabalho) para iniciar a ação agora com esses integrantes.
 * null: a equipe escolhida não faz a tarefa andar (vazia, abaixo do mínimo ou sem horas).
 */
export function estimateTaskDays(
  state: GameState,
  actionId: string,
  memberIds: readonly string[],
  dedication: Dedication = "normal"
): number | null {
  const action = findAction(actionId);
  if (!action) return null;
  const lead = action.cost.leadDays;
  const hours = action.cost.hours * findDedication(dedication).hoursFactor;
  const work = workDays(state, action, memberIds, hours, state.clock.hours + lead * 24);
  return work === null ? null : lead + work;
}

/** Dias que faltam para uma tarefa aberta com quem está nela agora; null se parada. */
export function estimateRemainingDays(state: GameState, taskId: string): number | null {
  const task = state.tasks.find((item) => item.id === taskId);
  const action = task ? findAction(task.actionId) : undefined;
  if (!task || !action || task.status === "done") return task?.status === "done" ? 0 : null;
  const now = state.clock.hours;
  // A UI só conhece o prazo prometido; o real (readyAt) fica escondido.
  const promised = task.expectedReadyAt ?? task.readyAt;
  const waitHours = task.status === "waiting" && promised !== null ? Math.max(0, promised - now) : 0;
  const work = workDays(state, action, task.assignees, task.hoursTotal - task.hoursDone, now + waitHours);
  return work === null ? null : waitHours / 24 + work;
}

/** Faixa do prazo ⌛ real de uma ação (prometido × BALANCE.lead), em dias; null se não há espera. */
export function leadDaysRange(actionId: string): { min: number; promised: number; max: number } | null {
  const action = findAction(actionId);
  if (!action || action.cost.leadDays <= 0) return null;
  const days = action.cost.leadDays;
  return { min: days * BALANCE.lead.minFactor, promised: days, max: days * BALANCE.lead.maxFactor };
}

/** Fase 7, S5: prazo, percentual e horas de trabalho de uma tarefa para a UI. */
export interface TaskEta {
  /** Momento previsto da conclusão (horas de jogo); null se a tarefa está parada (sem gente ou sem escala). */
  finishesAt: number | null;
  /** Dias inteiros que faltam (arredondado para cima; 0 = hoje); null se parada. */
  daysLeft: number | null;
  /** 0–100: horas feitas sobre o total; sem horas (compras), o tempo corrido do prazo prometido (trava em 99). */
  percent: number;
  /** Horas-pessoa de trabalho que faltam (o detalhe; o prazo é o que a UI destaca). */
  workHoursLeft: number;
}

/** Leitura `taskEta`: usa só o que a equipe sabe (o prazo prometido, nunca o `readyAt` real). */
export function taskEta(state: GameState, taskId: string): TaskEta | null {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return null;
  if (task.status === "done") return { finishesAt: task.doneAt ?? state.clock.hours, daysLeft: 0, percent: 100, workHoursLeft: 0 };
  const now = state.clock.hours;
  const days = estimateRemainingDays(state, taskId);
  let percent = 0;
  if (task.hoursTotal > 0) percent = (task.hoursDone / task.hoursTotal) * 100;
  else if (task.expectedReadyAt !== null && task.expectedReadyAt > task.startedAt) {
    percent = Math.min(99, ((now - task.startedAt) / (task.expectedReadyAt - task.startedAt)) * 100);
  }
  return {
    finishesAt: days === null ? null : now + days * 24,
    daysLeft: days === null ? null : Math.ceil(days - 1e-9),
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    workHoursLeft: Math.max(0, task.hoursTotal - task.hoursDone)
  };
}
