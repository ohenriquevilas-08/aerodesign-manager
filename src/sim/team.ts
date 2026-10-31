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

/** O presidente é o jogador: coordena e não faz trabalho operacional simulado. */
export function canWork(member: Member): boolean {
  return member.role !== "president";
}

/** Horas por dia = disponibilidade × calendário acadêmico × motivação (design §8.1). Presidente: 0. */
export function memberHoursPerDay(member: Member, date: number): number {
  if (!canWork(member)) return 0;
  return member.hoursPerDay * academicFactor(date).factor * motivationFactor(member.motivation);
}

export function isOverloaded(member: Member): boolean {
  return member.workStreakHours > BALANCE.motivation.overloadAfterHours;
}

/** O documentado é o piso de qualquer integrante na disciplina (design §5.3). */
export function effectiveKnowledge(member: Member, documented: Record<Discipline, number>, discipline: Discipline): number {
  return Math.max(member.knowledge[discipline], documented[discipline]);
}

/** Ganho com retorno decrescente: quanto mais perto de 100, menos sobe por hora. */
export function learn(current: number, hours: number, perHour: number): number {
  return clamp(current + hours * perHour * (1 - clamp(current) / 100));
}
