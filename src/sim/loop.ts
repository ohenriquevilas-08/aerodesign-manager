// Loop de preparação: o que acontece enquanto o relógio corre (design §4).
// O tick é quebrado em passos de até BALANCE.stepHours; um evento que pausa o relógio
// interrompe o tick no passo em que aconteceu e o resto do tempo real é descartado.
// Eventos (Fase 7) abrem por aqui e param o relógio: ver events.ts.

import { advancePlanned } from "./calendar";
import { COMPETITION_START, startCompetition } from "./competition";
import { BALANCE } from "./content/balance";
import { OFFICIAL_CALENDAR } from "./content/season2026";
import { findAction, type ActionDef } from "./content/actions";
import { dueFlightTests } from "./flightTests";
import { buildCompetitionEvent } from "./eventCompetition";
import { buildFlightTestEvent } from "./eventFlightTest";
import { buildSelectionDay } from "./eventSelection";
import { openEvent } from "./events";
import { crewRates } from "./crew";
import { overnightWeight, shiftEffects, workshopTaskRates } from "./workshop";
import { reportEvents } from "./report";
import { advanceShops } from "./shop";
import { addNews } from "./news";
import { awardReputation, resolveTrainees, trackAgenda } from "./season";
import { addMessage, closeUnderstaffed, completeTask, deliverProgress } from "./tasks";
import { canWork, clamp, isExhausted, learn } from "./team";
import { aptitudeFactor, revealText } from "./aptitude";
import { energyDrainPerHour, stepEnergy } from "./energy";
import { clockToDate, dateToHours, gameHoursForRealSeconds } from "./time";
import { DISCIPLINES } from "./state";
import type { Aptitude, Discipline, GameState, Member, PauseInfo, PauseReason } from "./types";

const EPSILON = 1e-9;

export function tick(state: GameState, realSeconds: number): GameState {
  // Evento aberto (Fase 7): o relógio da gestão fica parado até close-event.
  if (state.activeEvent || state.clock.speed === 0 || realSeconds <= 0) return state;
  let next = state;
  let realLeft = realSeconds;
  while (realLeft > EPSILON && next.clock.speed !== 0) {
    const hoursPerSecond = gameHoursForRealSeconds(1, next.clock.speed);
    let dt = Math.min(realLeft * hoursPerSecond, BALANCE.stepHours);
    // Os turnos da oficina começam e acabam em horas cheias: o passo não atravessa a virada.
    const toHour = Math.floor(next.clock.hours + EPSILON) + 1 - next.clock.hours;
    if (toHour > EPSILON) dt = Math.min(dt, toHour);
    next = step(next, dt);
    realLeft -= dt / hoursPerSecond;
  }
  return next;
}

/** O que uma pessoa trabalhou no passo: horas, gasto de energia, gosto e o que aprende. */
interface MemberWork {
  hours: number;
  drain: number;
  motivation: number;
  byDiscipline: Map<Discipline, number>;
  fabrication: number;
  agility: number;
  piloting: number;
}

/** Disciplina que a ação trabalha (a da ação ou o alvo escolhido), para gosto e aversão. */
function actionSubject(action: ActionDef, targetId: string | null): Discipline | null {
  if (action.discipline) return action.discipline;
  return targetId !== null && (DISCIPLINES as readonly string[]).includes(targetId) ? (targetId as Discipline) : null;
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
  const m = BALANCE.motivation;
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
  // O que cada pessoa trabalhou (horas, disciplina, habilidade) vira aprendizado, motivação e gasto de energia abaixo.
  const membersById = new Map(next.members.map((member) => [member.id, member]));
  const work = new Map<string, MemberWork>();
  next = {
    ...next,
    tasks: next.tasks.map((task) => {
      if (task.status !== "active" || task.assignees.length === 0) return task;
      const action = findAction(task.actionId)!;
      const team = task.assignees.map((id) => membersById.get(id)).filter((member): member is Member => !!member);
      // Tarefa de oficina rende por hora de turno; as demais, por horas livres do dia.
      const rates = action.workshop ? workshopTaskRates(state, task, t0) : crewRates(team, action.crew, date);
      if (rates.size === 0) return task;
      const perStep = action.workshop ? dt : dt / 24;
      const contributions = { ...task.contributions };
      let hoursDone = task.hoursDone;
      const subject = actionSubject(action, task.targetId);
      rates.forEach((rate, memberId) => {
        const hours = rate * perStep;
        contributions[memberId] = (contributions[memberId] ?? 0) + hours;
        hoursDone += hours;
        const member = membersById.get(memberId);
        if (!member || hours <= 0) return;
        const entry = work.get(memberId) ?? { hours: 0, drain: 0, motivation: 0, byDiscipline: new Map<Discipline, number>(), fabrication: 0, agility: 0, piloting: 0 };
        entry.hours += hours;
        const disliked = subject !== null && member.dislikes.includes(subject);
        entry.drain += hours * energyDrainPerHour(t0, !!action.workshop, disliked);
        if (subject !== null) entry.motivation += hours * (member.likes.includes(subject) ? m.likedPerHour : disliked ? -m.dislikedPerHour : 0);
        if (action.discipline) entry.byDiscipline.set(action.discipline, (entry.byDiscipline.get(action.discipline) ?? 0) + hours);
        if (action.effect?.kind === "fabricate") entry.fabrication += hours;
        if (action.effect?.kind === "agility") entry.agility += hours;
        if (action.skill === "piloting") entry.piloting += hours;
        work.set(memberId, entry);
      });
      const done = { ...task, hoursDone, contributions };
      const weight = action.workshop ? overnightWeight(t0) : 0;
      return weight === 0 ? done : { ...done, overnightHours: (task.overnightHours ?? 0) + (hoursDone - task.hoursDone) * weight };
    })
  };

  // 2a. Conhecimento, habilidades e gosto: hora a hora (a facilidade escondida multiplica; horas revelam).
  const reveals: { name: string; discipline: Discipline; aptitude: Aptitude }[] = [];
  next = {
    ...next,
    members: next.members.map((member) => {
      const entry = work.get(member.id);
      if (!entry) return member;
      let updated: Member = member;
      if (entry.motivation !== 0) updated = { ...updated, motivation: clamp(updated.motivation + entry.motivation) };
      entry.byDiscipline.forEach((hours, discipline) => {
        const studied = updated.studyHours[discipline] + hours;
        const revealed = !updated.revealedAptitude.includes(discipline) && studied >= BALANCE.aptitude.revealAfterHours;
        if (revealed) reveals.push({ name: updated.name, discipline, aptitude: updated.aptitude[discipline] });
        updated = {
          ...updated,
          knowledge: { ...updated.knowledge, [discipline]: learn(updated.knowledge[discipline], hours, BALANCE.knowledge.perHour * aptitudeFactor(updated, discipline)) },
          studyHours: { ...updated.studyHours, [discipline]: studied },
          revealedAptitude: revealed ? [...updated.revealedAptitude, discipline] : updated.revealedAptitude
        };
      });
      if (entry.fabrication > 0) updated = { ...updated, fabrication: learn(updated.fabrication, entry.fabrication, BALANCE.knowledge.fabricationPerHour) };
      if (entry.agility > 0) updated = { ...updated, agility: learn(updated.agility, entry.agility, BALANCE.knowledge.agilityPerHour) };
      if (entry.piloting > 0) updated = { ...updated, piloting: learn(updated.piloting, entry.piloting, BALANCE.tests.pilotingPerHour) };
      return updated;
    })
  };
  for (const reveal of reveals) {
    next = addMessage(next, { from: "Equipe", title: "Dá para ver como a pessoa aprende", body: revealText(reveal.name, reveal.discipline, reveal.aptitude) }).state;
  }

  // 2b. Entregas parciais (alcance, inscritos, horas de relatório) conforme as horas andaram.
  for (const task of next.tasks) if (task.status === "active" && task.yieldTotal !== null) next = deliverProgress(next, task.id);

  // 2c. Turno corrente: madrugada mexe na motivação; veterano ensina novato.
  next = shiftEffects(next, t0, dt);

  // 2d. Alcance de divulgação esfria com o tempo.
  if (next.outreach > 0) next = { ...next, outreach: next.outreach * Math.pow(1 - BALANCE.outreach.decayPerDay, dt / 24) };

  // 3. Motivação: cai para quem está parado e para quem parou de exaustão (design §4.2).
  const days = dt / 24;
  next = {
    ...next,
    members: next.members.map((member) => {
      if (!canWork(member)) return member;
      if (member.taskId === null) return { ...member, motivation: clamp(member.motivation - m.idleDecayPerDay * days) };
      if (isExhausted(member) && !work.has(member.id)) return { ...member, motivation: clamp(member.motivation - m.exhaustedDecayPerDay * days) };
      return member;
    })
  };

  // 3b. Energia (Fase 8, S4): quem trabalhou gasta; os demais descansam.
  next = stepEnergy(next, work, t0, dt);

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
      next = addNews(added.state, {
        kind: "deadline",
        title: `Faltam ${BALANCE.calendar.warnDays} dias: ${deadline.title}`,
        body: "A Comissão Técnica lembra as equipes do marco que se aproxima."
      });
      pauses.push({ reason: "deadline-soon", messageId: added.id });
    }
    if (t0 < at && at <= t1) {
      const added = addMessage(next, {
        from: "Comissão Técnica",
        title: deadline.kind === "deadline" ? `Prazo encerrado: ${deadline.title}` : `Hoje: ${deadline.title}`,
        body: deadline.kind === "deadline" ? "O prazo passou." : "Marco do calendário oficial."
      });
      next = added.state;
      // Marcos de pré-temporada avisam na caixa de entrada, mas não pausam o relógio.
      if (!deadline.quiet) pauses.push({ reason: "deadline-passed", messageId: added.id });
    }
  }

  // 5a. Fim da etapa trainee (1/fev): cada trainee vira integrante ou desiste.
  next = resolveTrainees(next, t0, t1);
  // Quem saiu deixa tarefas abaixo do mínimo: encerram sozinhas com o parcial (Fase 8, S1).
  next = closeUnderstaffed(next);

  // 5b. Relatório: envio automático no prazo e apresentação oral (os marcos acima já pausam).
  next = reportEvents(next, t0, t1);

  // 5b2. Eventos (Fase 7): a chamada do ensaio de voo, do dia da dinâmica da seletiva e da
  // competição pausa o relógio e abre o modo evento (enter-event aceita).
  if (!next.activeEvent) {
    const test = dueFlightTests(next, t0, t1)[0];
    if (test) {
      const opened = openEvent(next, buildFlightTestEvent(next, test), "A equipe se reúne para a viagem até o campo de ensaio. Entre no evento para acompanhar o dia.");
      next = opened.state;
      pauses.unshift(opened.pause);
    }
  }
  if (!next.activeEvent && next.selectionDay && t0 < next.selectionDay.at && next.selectionDay.at <= t1) {
    const event = buildSelectionDay(next);
    next = { ...next, selectionDay: null };
    if (event) {
      const opened = openEvent(next, event, "Os inscritos da seletiva chegam para o dia da dinâmica. Entre no evento para conhecê-los.");
      next = opened.state;
      pauses.unshift(opened.pause);
    }
  }
  if (!next.competition && t0 < COMPETITION_START && COMPETITION_START <= t1) {
    const started = startCompetition(next);
    const opened = openEvent(started.state, buildCompetitionEvent(started.state), "Começa a Competição Aerodesign Brasil: chegada, inspeção técnica e três dias de voo.");
    next = opened.state;
    pauses.unshift(opened.pause);
  }

  // 5d. Ações agendadas no calendário começam sozinhas; as que não dão certo pausam e avisam.
  const planned = advancePlanned(next, t1);
  next = planned.state;
  pauses.push(...planned.pauses);

  // 5e. Agenda do presidente e reputação do orientador (Fase 6, S2).
  next = trackAgenda(state, next, t0, t1);
  if (!state.report.submittedAt && next.report.submittedAt) next = awardReputation(next, BALANCE.advisor.reportSubmitted);

  // 6. Pausa automática: o relógio para e guarda o motivo do primeiro evento do passo.
  const first = pauses[0];
  if (!first) return next;
  const pause: PauseInfo = { reason: first.reason, at: t1, messageId: first.messageId };
  return { ...next, clock: { ...next.clock, speed: 0 }, pause };
}
