// Tempo corrido (design §4). O relógio guarda horas de jogo desde SEASON_START;
// a camada de app converte tempo real em horas de jogo com REAL_SECONDS_PER_DAY.

import { ACADEMIC_PERIODS, OFFICIAL_CALENDAR, SEASON_START, type Deadline } from "./content/season2026";
import type { Clock, ClockSpeed } from "./types";

const HOUR_MS = 3_600_000;

/** Em 1×, um dia de jogo dura 10 s reais (a calibrar no protótipo). */
export const REAL_SECONDS_PER_DAY = 10;

export const SPEEDS: readonly ClockSpeed[] = [0, 1, 2, 4];

export function gameHoursForRealSeconds(realSeconds: number, speed: ClockSpeed): number {
  return (realSeconds * speed * 24) / REAL_SECONDS_PER_DAY;
}

export function advanceClock(clock: Clock, realSeconds: number): Clock {
  if (clock.speed === 0 || realSeconds <= 0) return clock;
  return { ...clock, hours: clock.hours + gameHoursForRealSeconds(realSeconds, clock.speed) };
}

export function clockToDate(hours: number): number {
  return SEASON_START + hours * HOUR_MS;
}

export function dateToHours(date: number): number {
  return (date - SEASON_START) / HOUR_MS;
}

export function academicFactor(date: number): { factor: number; label: string } {
  const period = ACADEMIC_PERIODS.find((p) => date >= p.from && date < p.to + 24 * HOUR_MS);
  return period ? { factor: period.factor, label: period.label } : { factor: 1, label: "Aulas" };
}

export function upcomingDeadlines(hours: number, limit = 3): Deadline[] {
  const now = clockToDate(hours);
  return OFFICIAL_CALENDAR.filter((item) => item.date > now).slice(0, limit);
}

/** "12d 04h" até a data; "0d 00h" se já passou. */
export function formatCountdown(hours: number, target: number): string {
  const remaining = Math.max(0, dateToHours(target) - hours);
  const days = Math.floor(remaining / 24);
  const rest = Math.floor(remaining % 24);
  return `${days}d ${String(rest).padStart(2, "0")}h`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function formatDate(date: number): string {
  const value = new Date(date);
  return `${WEEKDAYS[value.getUTCDay()]}, ${value.getUTCDate()} ${MONTHS[value.getUTCMonth()]} ${value.getUTCFullYear()}`;
}

export function formatTime(date: number): string {
  const value = new Date(date);
  return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
}
