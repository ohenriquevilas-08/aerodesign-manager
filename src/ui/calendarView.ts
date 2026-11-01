// Leituras e regras puras da tela Calendário (Fase 6, U1), sem Preact: testadas em tests/ui/.

import { ACTIONS, calendarMonth, clockToDate, dateToHours, type ActionDef, type CalendarDay, type GameState } from "../sim";

const DAY_MS = 86_400_000;

/** Ações que dá para agendar: o alvo (peça ou tarefa em espera) só existe na hora, então ficam de fora. */
export function schedulableActions(): ActionDef[] {
  return ACTIONS.filter((action) => action.target !== "part" && action.target !== "waiting-task");
}

/** Um dia tem algo a mostrar? (marcos, ações agendadas, ensaios, tarefas ou pedidos) */
export function dayHasItems(day: CalendarDay): boolean {
  return day.milestones.length + day.planned.length + day.flightTests.length + day.tasks.length + day.orders.length > 0;
}

/** Os próximos `count` dias a partir de hoje (hoje incluso), atravessando a virada de mês. */
export function upcomingDays(state: GameState, count = 14): CalendarDay[] {
  const today = Math.floor(clockToDate(state.clock.hours) / DAY_MS) * DAY_MS;
  const last = today + (count - 1) * DAY_MS;
  const first = new Date(today);
  const end = new Date(last);
  const months: { year: number; month: number }[] = [{ year: first.getUTCFullYear(), month: first.getUTCMonth() + 1 }];
  if (end.getUTCMonth() !== first.getUTCMonth()) months.push({ year: end.getUTCFullYear(), month: end.getUTCMonth() + 1 });
  return months.flatMap(({ year, month }) => calendarMonth(state, year, month).days).filter((day) => day.date >= today && day.date <= last);
}

/** Hora de jogo ao soltar uma ação agendada em outro dia: o dia novo, na mesma hora do dia de antes. */
export function dropStartAt(dayDate: number, previousStartAt: number): number {
  const hourOfDay = ((previousStartAt % 24) + 24) % 24;
  return dateToHours(dayDate) + hourOfDay;
}

/** Cor de fundo do dia pelo fator de horas do período acadêmico. */
export function academicTone(factor: number): "low" | "high" | "normal" {
  return factor < 0.95 ? "low" : factor > 1.05 ? "high" : "normal";
}
