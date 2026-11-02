// Regras da equipe: horas disponíveis, motivação e conhecimento (design §4.2, §5.1 e §5.3).

import { BALANCE } from "./content/balance";
import { academicFactor } from "./time";
import type { Discipline, Member } from "./types";

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  conceptual: "Projeto conceitual",
  aerodynamics: "Aerodinâmica",
  performance: "Desempenho",
  stability: "Estabilidade e controle",
  loads: "Cargas e aeroelasticidade",
  structures: "Estruturas",
  electrical: "Projeto elétrico"
};

export const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));

/** Motivação 0–100 vira multiplicador de horas e qualidade: de hoursFactorAtZero até 1. */
export function motivationFactor(motivation: number): number {
  const floor = BALANCE.motivation.hoursFactorAtZero;
  return floor + (1 - floor) * (clamp(motivation) / 100);
}

/**
 * Todo aluno trabalha, inclusive o presidente (Fase 6: o jogador é o orientador, não um integrante).
 * Mantida como ponto único caso algum papel volte a ficar de fora do trabalho.
 */
export function canWork(_member: Member): boolean {
  return true;
}

/** Progresso do treino na etapa trainee, 0–1 (BALANCE.trainee.hoursRequired). */
export function traineeProgress(member: Member): number {
  return Math.min(1, (member.trainingHours ?? 0) / BALANCE.trainee.hoursRequired);
}

/** Todos os alunos da equipe, presidente e trainees incluídos (Fase 6; antes o presidente ficava de fora). */
export function rosterMembers(state: { members: readonly Member[] }): Member[] {
  return state.members.filter(canWork);
}

/**
 * Fase 8, S4: energia 0–100 vira multiplicador de rendimento: 1 a partir de tiredBelow, cai até
 * factorAtExhausted em exhaustedBelow e vale 0 abaixo disso (a pessoa para sozinha).
 */
export function energyFactor(energy: number): number {
  const e = BALANCE.energy;
  if (energy >= e.tiredBelow) return 1;
  if (energy < e.exhaustedBelow) return 0;
  return e.factorAtExhausted + (1 - e.factorAtExhausted) * ((energy - e.exhaustedBelow) / (e.tiredBelow - e.exhaustedBelow));
}

/** Multiplicador de qualidade pela energia: como o de rendimento, mas nunca zera. */
export const energyQualityFactor = (energy: number): number => Math.max(BALANCE.energy.factorAtExhausted, energyFactor(energy));

/** Parou de exaustão (abaixo de exhaustedBelow). */
export const isExhausted = (member: Pick<Member, "energy">): boolean => member.energy < BALANCE.energy.exhaustedBelow;

/** Horas por dia = disponibilidade × calendário acadêmico × motivação × energia (design §8.1). */
export function memberHoursPerDay(member: Member, date: number): number {
  return member.hoursPerDay * academicFactor(date).factor * motivationFactor(member.motivation) * energyFactor(member.energy);
}

/** Cansado: energia abaixo de BALANCE.energy.tiredBelow (rende menos). Substitui a antiga sobrecarga escondida. */
export function isOverloaded(member: Pick<Member, "energy">): boolean {
  return member.energy < BALANCE.energy.tiredBelow;
}

/** O documentado é o piso de qualquer integrante na disciplina (design §5.3). */
export function effectiveKnowledge(member: Member, documented: Record<Discipline, number>, discipline: Discipline): number {
  return Math.max(member.knowledge[discipline], documented[discipline]);
}

/** Ganho com retorno decrescente: quanto mais perto de 100, menos sobe por hora. */
export function learn(current: number, hours: number, perHour: number): number {
  return clamp(current + hours * perHour * (1 - clamp(current) / 100));
}
