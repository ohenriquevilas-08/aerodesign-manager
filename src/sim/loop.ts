// Loop de preparação: o que acontece enquanto o relógio corre (design §4).
// O tick é quebrado em passos de até BALANCE.stepHours; um evento que pausa o relógio
// interrompe o tick no passo em que aconteceu e o resto do tempo real é descartado.
// Nas janelas de voo da competição o relógio anda mais devagar (competition.ts, clockPace).

import { advanceCompetition, clockPace } from "./competition";
import { BALANCE } from "./content/balance";
import { OFFICIAL_CALENDAR } from "./content/calendar2026";
import { findAction } from "./content/actions";
import { crewRates } from "./crew";
import { reportEvents } from "./report";
import { advanceShops } from "./shop";
import { addMessage, completeTask } from "./tasks";
import { canWork, clamp, isOverloaded } from "./team";
import { clockToDate, dateToHours, gameHoursForRealSeconds } from "./time";
import type { GameState, Member, PauseInfo, PauseReason } from "./types";

const EPSILON = 1e-9;

export function tick(state: GameState, realSeconds: number): GameState {
  if (state.clock.speed === 0 || realSeconds <= 0) return state;
  let next = state;
  let realLeft = realSeconds;
  while (realLeft > EPSILON && next.clock.speed !== 0) {
    const pace = clockPace(next);
    const hoursPerSecond = gameHoursForRealSeconds(1, next.clock.speed) * pace.factor;
    let dt = Math.min(realLeft * hoursPerSecond, BALANCE.stepHours);
    // O ritmo pode mudar na virada da hora (início e fim das janelas de voo).
    if (pace.nextChange - next.clock.hours > EPSILON) dt = Math.min(dt, pace.nextChange - next.clock.hours);
    next = step(next, dt);
    realLeft -= dt / hoursPerSecond;
  }
  return next;
}

interface Pending {
  reason: PauseReason;
  messageId: string;
}

/** Avança dt horas de jogo: prazos, trabalho, motivação, conclusões e calendário. */
export function step(state: GameState, dt: number): GameState {
  const t0 = state.clock.hours;
  const t1 = t0 + dt;
  const date = clockToDate(t0);
  const pauses: Pending[] = [];
  let next: GameState = { ...state, clock: { ...state.clock, hours: t1 } };

  // 1. Esperas de prazo ⌛ que terminam neste passo.
  const ready: string[] = [];
  next = {
    ...next,
    tasks: next.tasks.map((task) => {
      if (task.status !== "waiting" || task.readyAt === null || task.readyAt > t1) return task;
      if (task.hoursTotal === 0) ready.push(task.id);
      return task.hoursTotal === 0 ? task : { ...task, status: "active" as const };
    })
  };

  // 2. Trabalho: a equipe alocada em tarefa ativa gera horas-pessoa conforme o crew da ação.
  const membersById = new Map(next.members.map((member) => [member.id, member]));
  next = {
    ...next,
    tasks: next.tasks.map((task) => {
      if (task.status !== "active" || task.assignees.length === 0) return task;
      const crew = findAction(task.actionId)!.crew;
      const team = task.assignees.map((id) => membersById.get(id)).filter((member): member is Member => !!member);
      const rates = crewRates(team, crew, date);
      if (rates.size === 0) return task;
      const contributions = { ...task.contributions };
      let hoursDone = task.hoursDone;
      rates.forEach((rate, memberId) => {
        const hours = (rate * dt) / 24;
        contributions[memberId] = (contributions[memberId] ?? 0) + hours;
        hoursDone += hours;
      });
      return { ...task, hoursDone, contributions };
    })
  };

  // 2b. Alcance de divulgação esfria com o tempo.
  if (next.outreach > 0) next = { ...next, outreach: next.outreach * Math.pow(1 - BALANCE.outreach.decayPerDay, dt / 24) };

  // 3. Motivação: cai para quem está parado e para quem está sobrecarregado (design §4.2).
  const statusById = new Map(next.tasks.map((task) => [task.id, task.status]));
  const days = dt / 24;
  const m = BALANCE.motivation;
  next = {
    ...next,
    members: next.members.map((member) => {
      if (!canWork(member)) return member;
      const working = member.taskId !== null && statusById.get(member.taskId) === "active";
      if (working) {
        const streak = member.workStreakHours + dt;
        const updated = { ...member, workStreakHours: streak };
        return isOverloaded(updated) ? { ...updated, motivation: clamp(member.motivation - m.overloadDecayPerDay * days) } : updated;
      }
      const rested = Math.max(0, member.workStreakHours - m.restRecoveryPerHour * dt);
      const motivation = member.taskId === null ? clamp(member.motivation - m.idleDecayPerDay * days) : member.motivation;
      return { ...member, workStreakHours: rested, motivation };
    })
  };

  // 4. Conclusões: compras que chegaram e tarefas com as horas completas.
  const finished = [
    ...ready,
    ...next.tasks.filter((task) => task.status === "active" && task.hoursTotal > 0 && task.hoursDone >= task.hoursTotal - EPSILON).map((task) => task.id)
  ];
  for (const taskId of finished) {
    const done = completeTask(next, taskId);
    next = done.state;
    pauses.push({ reason: "task-done", messageId: done.messageId });
  }

  // 4b. Pedidos das lojas: fiscalização e entregas pausam; promoções e reposição uma vez por dia.
  const shops = advanceShops(next, t0, t1);
  next = shops.state;
  pauses.push(...shops.pauses);

  // 5. Calendário oficial: aviso a BALANCE.calendar.warnDays e no dia do marco.
  for (const deadline of OFFICIAL_CALENDAR) {
    const at = dateToHours(deadline.date);
    const warnAt = at - BALANCE.calendar.warnDays * 24;
    if (deadline.kind !== "info" && t0 < warnAt && warnAt <= t1) {
      const added = addMessage(next, {
        from: "Comissão Técnica",
        title: `Faltam ${BALANCE.calendar.warnDays} dias: ${deadline.title}`,
        body: "O prazo está chegando. Confira o que ainda falta."
      });
      next = added.state;
      pauses.push({ reason: "deadline-soon", messageId: added.id });
    }
    if (t0 < at && at <= t1) {
      const added = addMessage(next, {
        from: "Comissão Técnica",
        title: deadline.kind === "deadline" ? `Prazo encerrado: ${deadline.title}` : `Hoje: ${deadline.title}`,
        body: deadline.kind === "deadline" ? "O prazo passou." : "Marco do calendário oficial."
      });
      next = added.state;
      pauses.push({ reason: "deadline-passed", messageId: added.id });
    }
  }

  // 5b. Relatório: envio automático no prazo e apresentação oral (os marcos acima já pausam).
  next = reportEvents(next, t0, t1);

  // 5c. Competição: começa no marco, fila e baterias nas janelas de voo; seu voo pausa.
  const competition = advanceCompetition(next, t0, t1);
  next = competition.state;
  pauses.push(...competition.pauses);

  // 6. Pausa automática: o relógio para e guarda o motivo do primeiro evento do passo.
  const first = pauses[0];
  if (!first) return next;
  const pause: PauseInfo = { reason: first.reason, at: t1, messageId: first.messageId };
  return { ...next, clock: { ...next.clock, speed: 0 }, pause };
}
