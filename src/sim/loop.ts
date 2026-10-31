// Loop de preparação: o que acontece enquanto o relógio corre (design §4).
// O tick é quebrado em passos de até BALANCE.stepHours; um evento que pausa o relógio
// interrompe o tick no passo em que aconteceu e o resto do tempo real é descartado.

import { BALANCE } from "./content/balance";
import { OFFICIAL_CALENDAR } from "./content/calendar2026";
import { addMessage, completeTask } from "./tasks";
import { clamp, isOverloaded, memberHoursPerDay } from "./team";
import { clockToDate, dateToHours, gameHoursForRealSeconds } from "./time";
import type { GameState, PauseInfo, PauseReason, Task } from "./types";

const EPSILON = 1e-9;

export function tick(state: GameState, realSeconds: number): GameState {
  if (state.clock.speed === 0 || realSeconds <= 0) return state;
  let remaining = gameHoursForRealSeconds(realSeconds, state.clock.speed);
  let next = state;
  while (remaining > EPSILON && next.clock.speed !== 0) {
    const dt = Math.min(remaining, BALANCE.stepHours);
    next = step(next, dt);
    remaining -= dt;
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

  // 2. Trabalho: cada integrante alocado em tarefa ativa gera horas-pessoa.
  const byId = new Map(next.tasks.map((task) => [task.id, task]));
  const worked = new Map<string, Task>();
  for (const member of next.members) {
    const task = member.taskId ? (worked.get(member.taskId) ?? byId.get(member.taskId)) : undefined;
    if (!task || task.status !== "active") continue;
    const hours = (memberHoursPerDay(member, date) * dt) / 24;
    worked.set(task.id, {
      ...task,
      hoursDone: task.hoursDone + hours,
      contributions: { ...task.contributions, [member.id]: (task.contributions[member.id] ?? 0) + hours }
    });
  }
  if (worked.size > 0) next = { ...next, tasks: next.tasks.map((task) => worked.get(task.id) ?? task) };

  // 3. Motivação: cai para quem está parado e para quem está sobrecarregado (design §4.2).
  const statusById = new Map(next.tasks.map((task) => [task.id, task.status]));
  const days = dt / 24;
  const m = BALANCE.motivation;
  next = {
    ...next,
    members: next.members.map((member) => {
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

  // 6. Pausa automática: o relógio para e guarda o motivo do primeiro evento do passo.
  const first = pauses[0];
  if (!first) return next;
  const pause: PauseInfo = { reason: first.reason, at: t1, messageId: first.messageId };
  return { ...next, clock: { ...next.clock, speed: 0 }, pause };
}
