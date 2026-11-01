// Fase 6, S3: ações agendadas e leituras do calendário.

import { describe, expect, it } from "vitest";
import {
  applyCommand,
  calendarMonth,
  dateToHours,
  deserializeState,
  REGULATION_HOURS,
  seasonOverview,
  serializeState,
  type Command,
  type GameState
} from "../../src/sim";
import { foundedGame } from "./helpers";

const run = (state: GameState, ...commands: Command[]): GameState => commands.reduce(applyCommand, state);
const hoursOf = (year: number, month: number, day: number, hour = 0) => dateToHours(Date.UTC(year, month - 1, day)) + hour;
const game = () => foundedGame({ seed: 21, teamName: "Calendário" });

function play(state: GameState, days: number): GameState {
  const target = state.clock.hours + days * 24;
  let next = state;
  for (let guard = 0; guard < 10_000 && next.clock.hours < target - 1e-9; guard += 1) {
    if (next.clock.speed === 0) next = applyCommand(next, { type: "set-speed", speed: 1 });
    next = applyCommand(next, { type: "tick", realSeconds: ((target - next.clock.hours) * 10) / 24 });
  }
  return next;
}

const schedule = (state: GameState, patch: Partial<Extract<Command, { type: "schedule-action" }>> = {}) =>
  applyCommand(state, { type: "schedule-action", actionId: "raffle", startAt: hoursOf(2025, 11, 12, 8), memberIds: ["founder-marina"], ...patch });

describe("schedule-action, reschedule-action e unschedule-action", () => {
  it("agenda uma ação com dedicação e gente, sem gastar nada ainda", () => {
    const state = schedule(game(), { dedication: "careful" });
    expect(state.warning).toBeNull();
    expect(state.plannedActions).toEqual([
      { id: expect.any(String), actionId: "raffle", startAt: hoursOf(2025, 11, 12, 8), targetId: null, dedication: "careful", memberIds: ["founder-marina"] }
    ]);
    expect(state.tasks).toHaveLength(0);
    expect(state.credits).toBe(0);
  });

  it("recusa ação desconhecida, data passada ou inválida, integrante inexistente e alvo que falta", () => {
    const base = play(game(), 3);
    const refused = (state: GameState) => {
      expect(state.plannedActions).toHaveLength(0);
      return state.warning?.text ?? "";
    };
    expect(refused(schedule(base, { actionId: "nada" }))).toContain("desconhecida");
    expect(refused(schedule(base, { startAt: base.clock.hours - 1 }))).toContain("passou");
    expect(refused(schedule(base, { startAt: Number.NaN }))).toContain("data");
    expect(refused(schedule(base, { memberIds: ["ninguem"], startAt: base.clock.hours + 5 }))).toContain("não encontrado");
    expect(refused(schedule(base, { actionId: "document", startAt: base.clock.hours + 5 }))).toContain("disciplina");
    expect(refused(schedule(base, { actionId: "recruitment", startAt: base.clock.hours + 5 }))).toContain("formato");
    expect(schedule(base, { actionId: "document", targetId: "aerodynamics", startAt: base.clock.hours + 5 }).plannedActions).toHaveLength(1);
  });

  it("reagenda e desagenda; recusa id desconhecido e data passada", () => {
    let state = schedule(game());
    const id = state.plannedActions[0]!.id;
    state = run(state, { type: "reschedule-action", plannedId: id, startAt: hoursOf(2025, 11, 14, 9) });
    expect(state.plannedActions[0]!.startAt).toBe(hoursOf(2025, 11, 14, 9));
    expect(run(state, { type: "reschedule-action", plannedId: "x", startAt: 100 }).warning?.text).toContain("não existe");
    expect(run(state, { type: "reschedule-action", plannedId: id, startAt: -5 }).warning?.text).toContain("passou");
    state = run(state, { type: "unschedule-action", plannedId: id });
    expect(state.plannedActions).toEqual([]);
    expect(run(state, { type: "unschedule-action", plannedId: id }).warning?.text).toContain("não existe");
  });

  it("sobrevive ao save", () => {
    const state = schedule(game());
    expect(deserializeState(serializeState(state))!.plannedActions).toEqual(state.plannedActions);
  });
});

describe("a ação agendada começa sozinha", () => {
  it("vira tarefa no startAt, com a gente alocada, sem pausar o relógio", () => {
    const state = schedule(game(), { dedication: "careful" });
    const before = play(state, 1.5);
    expect(before.tasks).toHaveLength(0);
    expect(before.plannedActions).toHaveLength(1);
    const after = play(before, 1);
    expect(after.clock.speed).toBe(1);
    expect(after.plannedActions).toEqual([]);
    expect(after.tasks).toHaveLength(1);
    expect(after.tasks[0]).toMatchObject({ actionId: "raffle", dedication: "careful", assignees: ["founder-marina"] });
    expect(after.tasks[0]!.startedAt).toBeGreaterThanOrEqual(hoursOf(2025, 11, 12, 8) - 1);
    expect(after.members.find((m) => m.id === "founder-marina")!.taskId).toBe(after.tasks[0]!.id);
    expect(after.inbox.map((m) => m.title)).toContain("Ação agendada começou: Organizar rifa");
  });

  it("sem memberIds, a tarefa nasce sem ninguém alocado", () => {
    const state = play(schedule(game(), { memberIds: [] }), 3);
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0]!.assignees).toEqual([]);
  });

  it("sem gente livre: não começa, avisa, pausa com o motivo 'scheduled' e sai da lista", () => {
    let state = run(game(), { type: "start-action", actionId: "study-aero" });
    state = run(state, { type: "assign-member", memberId: "founder-marina", taskId: state.tasks[0]!.id }, { type: "set-speed", speed: 4 });
    state = schedule(state, { startAt: state.clock.hours + 2 });
    state = run(state, { type: "tick", realSeconds: 2 });
    expect(state.clock.speed).toBe(0);
    expect(state.pause?.reason).toBe("scheduled");
    expect(state.plannedActions).toEqual([]);
    expect(state.tasks.filter((t) => t.actionId === "raffle")).toHaveLength(0);
    const message = state.inbox.find((m) => m.id === state.pause?.messageId)!;
    expect(message.title).toBe("Ação agendada não começou: Organizar rifa");
    expect(message.body).toContain("Faltou gente");
    expect(message.body).toContain("Marina Alves");
  });

  it("sem caixa ou material: não começa e avisa com o motivo do catálogo", () => {
    const state = play(schedule(game(), { actionId: "build-wing", memberIds: ["founder-caio"] }), 3);
    expect(state.tasks).toHaveLength(0);
    const body = state.inbox.find((m) => m.title.startsWith("Ação agendada não começou"))!.body;
    expect(body).toMatch(/balsa|Caixa/);
  });

  it("pré-condição: read-regulation agendada antes de 9/fev falha; depois dela começa", () => {
    const early = play(schedule(game(), { actionId: "read-regulation", startAt: hoursOf(2025, 11, 12) }), 3);
    expect(early.inbox.find((m) => m.title.startsWith("Ação agendada não começou"))!.body).toContain("9/fev");

    let state: GameState = { ...game(), clock: { hours: REGULATION_HOURS - 2, speed: 0 } };
    state = schedule(state, { actionId: "read-regulation", startAt: REGULATION_HOURS + 3, memberIds: ["founder-marina"] });
    state = play(state, 1);
    expect(state.tasks.map((t) => t.actionId)).toEqual(["read-regulation"]);
    expect(state.tasks[0]!.assignees).toEqual(["founder-marina"]);
  });

  it("várias vencidas no mesmo passo começam na ordem de startAt e nunca ocupam a mesma pessoa duas vezes", () => {
    let state = game();
    state = schedule(state, { actionId: "outreach-social", startAt: hoursOf(2025, 11, 12, 8), memberIds: ["founder-rafa"] });
    state = schedule(state, { actionId: "outreach-posters", startAt: hoursOf(2025, 11, 12, 6), memberIds: ["founder-rafa"] });
    state = play(state, 2.5);
    expect(state.tasks.map((t) => t.actionId)).toEqual(["outreach-posters"]);
    const busy = state.tasks.filter((t) => t.assignees.includes("founder-rafa") && t.status !== "done");
    expect(busy.length).toBeLessThanOrEqual(1);
  });
});

describe("calendarMonth", () => {
  it("devolve nov/2025 com a grade, o dia de hoje, marcos e período acadêmico", () => {
    const month = calendarMonth(game(), 2025, 11);
    expect(month).toMatchObject({ year: 2025, month: 11, firstWeekday: 6 });
    expect(month.days).toHaveLength(30);
    expect(month.days[9]).toMatchObject({ day: 10, weekday: 1, today: true, past: false });
    expect(month.days[9]!.milestones.map((m) => m.id)).toEqual(["founders"]);
    expect(month.days[8]).toMatchObject({ today: false, past: true });
    expect(month.days[16]!.milestones.map((m) => m.id)).toEqual(["selection"]);
    expect(month.days[16]!.academic).toEqual({ label: "Provas", factor: 0.4 });
    expect(month.days[10]!.academic.label).toBe("Aulas");
  });

  it("junta ações agendadas, tarefas em andamento, pedidos e ensaios no dia certo", () => {
    let state = schedule(game());
    state = run(state, { type: "start-action", actionId: "study-aero" });
    state = run(state, { type: "assign-member", memberId: "founder-caio", taskId: state.tasks[0]!.id });
    const month = calendarMonth(state, 2025, 11);
    expect(month.days[11]!.planned).toEqual([
      { plannedId: state.plannedActions[0]!.id, actionId: "raffle", label: "Organizar rifa", startAt: hoursOf(2025, 11, 12, 8), memberIds: ["founder-marina"] }
    ]);
    expect(month.days[10]!.planned).toEqual([]);
    // O estudo começou hoje (10/nov) e se estende até o fim previsto.
    const task = month.days[9]!.tasks[0]!;
    expect(task).toMatchObject({ label: "Estudo de aerodinâmica", startedAt: 0, status: "active" });
    expect(task.endsAt).toBeGreaterThan(24);
    const endDay = Math.floor(task.endsAt! / 24);
    expect(month.days[9 + endDay]!.tasks.map((t) => t.taskId)).toContain(task.taskId);
    expect(month.days[9 + endDay + 1]!.tasks.map((t) => t.taskId)).not.toContain(task.taskId);

    const busy = calendarMonth(
      {
        ...state,
        orders: [
          {
            id: "o1", shopId: "mercadosolto", lines: [], shipping: "standard", placedAt: 0, expectedAt: hoursOf(2025, 11, 20, 5),
            arrivesAt: hoursOf(2025, 11, 22), status: "in-transit", customsDue: null, deliveredAt: null
          }
        ],
        flightTests: [
          {
            id: "ft1", venueId: "farm", day: Math.floor(hoursOf(2025, 11, 25) / 24), at: hoursOf(2025, 11, 25, 8), pilot: { hired: true },
            crew: [], payloadPlanKg: [6], filmed: true, status: "scheduled", paidCredits: 0, scheduledAt: 0, takeoffs: [],
            densityAltitudeM: null, transportDamage: [], summary: null
          }
        ]
      },
      2025,
      11
    );
    expect(busy.days[19]!.orders).toMatchObject([{ orderId: "o1", expectedAt: hoursOf(2025, 11, 20, 5), status: "in-transit" }]);
    expect(busy.days[24]!.flightTests).toMatchObject([{ testId: "ft1", venueId: "farm", filmed: true }]);
    expect(busy.days[24]!.flightTests[0]!.title).toContain("(filmado)");
  });

  it("acompanha o relógio e marca o regulamento em 9/fev", () => {
    const state = play(game(), 5);
    const month = calendarMonth(state, 2025, 11);
    expect(month.days.filter((d) => d.today)).toHaveLength(1);
    expect(month.days[14]!.today).toBe(true);
    expect(month.days.slice(0, 14).every((d) => d.past)).toBe(true);
    const february = calendarMonth(state, 2026, 2);
    expect(february.days[8]!.milestones.map((m) => m.id)).toEqual(["regulation"]);
    expect(february.days[8]!.academic.label).toBe("Férias de verão");
  });
});

describe("seasonOverview", () => {
  it("tem os 13 meses de nov/2025 a nov/2026 com os marcos de cada um", () => {
    const overview = seasonOverview(game());
    expect(overview).toHaveLength(13);
    expect(overview[0]).toMatchObject({ year: 2025, month: 11, label: "nov 2025", current: true, past: false });
    expect(overview[12]).toMatchObject({ year: 2026, month: 11, label: "nov 2026", current: false });
    const ids = (label: string) => overview.find((m) => m.label === label)!.milestones.map((m) => m.id);
    expect(ids("nov 2025")).toEqual(["founders", "selection"]);
    expect(ids("dez 2025")).toEqual(["trainee-start", "summer-break"]);
    expect(ids("fev 2026")).toEqual(["trainee-end", "regulation"]);
    expect(ids("mar 2026")).toEqual(["rev01"]);
    expect(ids("out 2026")).toEqual(["approved-list", "oral", "competition"]);
  });

  it("marca o mês atual e os passados conforme o relógio", () => {
    const state: GameState = { ...game(), clock: { hours: hoursOf(2026, 2, 20), speed: 0 } };
    const marks = seasonOverview(state).map((m) => (m.current ? "current" : m.past ? "past" : "future"));
    expect(marks).toEqual(["past", "past", "past", "current", ...Array(9).fill("future")]);
  });
});
