// Energia por aluno (Fase 8, S4; design §4.2 e §5.5). Trabalhar gasta por hora trabalhada, a
// madrugada gasta mais, e descansar, dormir e o fim de semana recuperam. Quem virou a noite fica
// com pouca energia no dia seguinte: a consequência é contínua, não "perder o turno".

import { BALANCE } from "./content/balance";
import { findAction } from "./content/actions";
import { SHIFTS } from "./content/workshop";
import { overnightWeight } from "./workshop";
import { clamp, energyFactor, memberHoursPerDay } from "./team";
import { clockToDate } from "./time";
import type { GameState, Member } from "./types";

const E = BALANCE.energy;

const hourOfDay = (hours: number) => hours - Math.floor(hours / 24) * 24;
const isWeekend = (hours: number) => {
  const day = new Date(clockToDate(hours)).getUTCDay();
  return day === 0 || day === 6;
};
const sleeping = (hour: number) => hour >= E.sleepFromHour || hour < E.sleepToHour;

/** Recuperação por hora de relógio de quem não está trabalhando: dormindo > acordado; fim de semana soma. */
export function energyRecoveryPerHour(hours: number): number {
  const base = sleeping(hourOfDay(hours)) ? E.sleepPerHour : E.awakePerHour;
  return base * (isWeekend(hours) ? E.weekendFactor : 1);
}

/** Gasto por hora trabalhada: madrugada de oficina pesa mais (depois da 1h, ainda mais); disciplina detestada, também. */
export function energyDrainPerHour(hours: number, workshop: boolean, disliked: boolean): number {
  let factor = 1;
  if (workshop) {
    const weight = overnightWeight(hours);
    if (weight === 1) factor = E.overnightFactor;
    else if (weight >= 2) factor = E.lateOvernightFactor;
  }
  return E.workPerHour * factor * (disliked ? E.dislikedFactor : 1);
}

/** Horas trabalhadas por integrante no passo, com o que importa para o gasto. */
export interface WorkSample {
  hours: number;
  /** Gasto de energia já calculado (horas × gasto por hora), somando as tarefas do passo. */
  drain: number;
}

/**
 * Aplica o passo [t0, t0 + dt] à energia de todos: quem trabalhou gasta o que `worked` diz e só
 * recupera nas horas do passo em que não estava trabalhando; os demais recuperam por hora de relógio.
 */
export function stepEnergy(state: GameState, worked: ReadonlyMap<string, WorkSample>, t0: number, dt: number): GameState {
  const recoveryRate = energyRecoveryPerHour(t0 + dt / 2);
  return {
    ...state,
    members: state.members.map((member) => {
      const sample = worked.get(member.id);
      const rest = sample ? Math.max(0, dt - sample.hours) : dt;
      const energy = member.energy - (sample?.drain ?? 0) + recoveryRate * rest;
      const next = clamp(energy);
      return next === member.energy ? member : { ...member, energy: next };
    })
  };
}

// ---------------------------------------------------------------------------
// Leituras para a UI
// ---------------------------------------------------------------------------

export type EnergyTrend = "up" | "down" | "flat";

export interface EnergyOutlook {
  /** Energia atual, 0–100. */
  energy: number;
  /** Faixa: "ok", "tired" (rende menos) ou "exhausted" (parou). */
  level: "ok" | "tired" | "exhausted";
  /** Variação esperada por dia de jogo no ritmo atual (negativa = descendo). */
  perDay: number;
  trend: EnergyTrend;
  /** Horas de jogo até chegar ao limite de exaustão no ritmo atual; null se não está descendo (ou já parou). */
  hoursToLimit: number | null;
}

/** Horas por dia que a pessoa tende a trabalhar na tarefa em que está (0 sem tarefa ativa). */
function expectedWork(state: GameState, member: Member): { hoursPerDay: number; drainPerDay: number } {
  const task = member.taskId ? state.tasks.find((item) => item.id === member.taskId) : undefined;
  const action = task ? findAction(task.actionId) : undefined;
  if (!task || !action || task.status !== "active" || action.cost.hours === 0) return { hoursPerDay: 0, drainPerDay: 0 };
  if (action.workshop) {
    // Horas por semana nos turnos escalados, com o peso da madrugada.
    let hours = 0;
    let drain = 0;
    for (const [slot, ids] of Object.entries(state.workshop.schedule)) {
      if (!(ids ?? []).includes(member.id)) continue;
      const shift = SHIFTS.find((item) => slot.endsWith(`-${item.id}`));
      if (!shift) continue;
      const length = shift.end - shift.start;
      hours += length;
      drain += length * E.workPerHour * (shift.id === "overnight" ? (E.overnightFactor + E.lateOvernightFactor) / 2 : 1);
    }
    return { hoursPerDay: hours / 7, drainPerDay: drain / 7 };
  }
  const hoursPerDay = memberHoursPerDay(member, clockToDate(state.clock.hours));
  return { hoursPerDay, drainPerDay: hoursPerDay * E.workPerHour };
}

/**
 * Leitura `energyOutlook`: energia atual, tendência (sobe/desce) e quando chega ao limite no ritmo
 * atual. O ritmo vem da tarefa em que a pessoa está (horas por dia ou turnos escalados) e da
 * recuperação média do dia (dormir, fim de semana).
 */
export function energyOutlook(state: GameState, memberId: string): EnergyOutlook | null {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return null;
  const now = state.clock.hours;
  let recovery = 0;
  for (let h = 0; h < 24; h += 1) recovery += energyRecoveryPerHour(now + h);
  const work = expectedWork(state, member);
  // Enquanto trabalha a pessoa não recupera: tira a recuperação média das horas trabalhadas.
  const lost = (work.hoursPerDay * recovery) / 24;
  const perDay = recovery - lost - work.drainPerDay;
  const trend: EnergyTrend = perDay > E.trendEpsilonPerDay ? "up" : perDay < -E.trendEpsilonPerDay ? "down" : "flat";
  const level = member.energy < E.exhaustedBelow ? "exhausted" : member.energy < E.tiredBelow ? "tired" : "ok";
  const hoursToLimit = perDay < 0 && member.energy >= E.exhaustedBelow ? ((member.energy - E.exhaustedBelow) / -perDay) * 24 : null;
  return { energy: Math.round(member.energy), level, perDay, trend, hoursToLimit };
}

export { energyFactor };
