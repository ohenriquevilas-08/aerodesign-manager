// Fase 8, S1 a S3: tarefas sempre com gente, resultado aos poucos, sem limite rígido de pessoas.

import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  applyCommand,
  BALANCE,
  crewEfficiency,
  findAction,
  installedParts,
  positionShare,
  taskKeeps,
  type Command,
  type GameState
} from "../../src/sim";
import { foundedGame, startedGame } from "./helpers";

const run = (state: GameState, ...commands: Command[]): GameState => commands.reduce(applyCommand, state);
const lastTask = (state: GameState) => state.tasks[state.tasks.length - 1]!;
const member = (state: GameState, id: string) => state.members.find((item) => item.id === id)!;

/** Todos sem aula, escalados toda manhã e tarde: a oficina anda sem depender da grade sorteada. */
function game(overrides: Partial<GameState> = {}): GameState {
  const base = startedGame({ seed: 42, teamName: "T" });
  const crew = base.members.map((item) => item.id);
  const schedule: GameState["workshop"]["schedule"] = {};
  for (let day = 0; day <= 6; day += 1) for (const shift of ["morning", "afternoon"] as const) schedule[`${day as 0}-${shift}`] = crew;
  return {
    ...base,
    members: base.members.map((item) => ({ ...item, classSlots: [] })),
    workshop: { ...base.workshop, keyHolders: crew, schedule },
    ...overrides
  };
}

/** Avança em passos de 1 hora de jogo (sem pausas automáticas) até `done(state)`. */
function until(state: GameState, done: (s: GameState) => boolean, maxHours = 24 * 120): GameState {
  let next: GameState = { ...state, clock: { ...state.clock, speed: 1 }, pause: null };
  for (let i = 0; i < maxHours && !done(next); i += 1) {
    next = applyCommand(next, { type: "tick", realSeconds: 10 / 24 });
    if (next.clock.speed === 0) next = { ...next, clock: { ...next.clock, speed: 1 }, pause: null };
  }
  return next;
}

const fraction = (s: GameState, id: string) => {
  const task = s.tasks.find((item) => item.id === id)!;
  return task.hoursDone / task.hoursTotal;
};

describe("S1: tarefa nunca fica parada sem gente", () => {
  it("só começa com o mínimo de pessoas livres e ocupa quem entra", () => {
    const none = run(game(), { type: "start-action", actionId: "raffle" });
    expect(none.tasks).toHaveLength(0);
    expect(none.warning?.text).toContain("pelo menos 1");

    const started = run(game(), { type: "start-action", actionId: "outreach-freshers", memberIds: ["founder-marina", "founder-caio"] });
    expect(lastTask(started).assignees).toEqual(["founder-marina", "founder-caio"]);
    expect(member(started, "founder-marina").taskId).toBe(lastTask(started).id);

    const busy = run(started, { type: "start-action", actionId: "raffle", memberIds: ["founder-caio"] });
    expect(busy.tasks).toHaveLength(1);
    expect(busy.warning?.text).toContain("já está numa tarefa");
  });

  it("ação sem horas não pede nem ocupa ninguém (crew zerado)", () => {
    for (const action of ACTIONS.filter((item) => item.cost.hours === 0)) expect(action.crew).toEqual({ min: 0, ideal: 0, max: 0 });
    // Só a captação com espera (sponsor-pitch) tem horas e prazo; as horas exigem gente.
    expect(findAction("sponsor-pitch")!.crew.min).toBe(1);
  });

  it("close-task encerra, libera a equipe e avisa o que ficou", () => {
    let state = run(game(), { type: "start-action", actionId: "outreach-classroom", memberIds: ["founder-marina", "founder-caio"] });
    const id = lastTask(state).id;
    state = until(state, (s) => fraction(s, id) >= 0.5);
    const kept = taskKeeps(state, id);
    state = run(state, { type: "close-task", taskId: id });
    expect(state.tasks).toHaveLength(0);
    expect(member(state, "founder-marina").taskId).toBeNull();
    expect(member(state, "founder-caio").taskId).toBeNull();
    const message = state.inbox.at(-1)!;
    expect(message.title).toBe("Encerrada: Passar em sala de aula");
    expect(message.body).toContain(kept);
    expect(run(state, { type: "close-task", taskId: id }).warning?.text).toContain("não está mais aberta");
  });

  it("unassign-member recusa deixar a tarefa abaixo do mínimo; com folga, tira", () => {
    const started = run(game(), { type: "start-action", actionId: "outreach-freshers", memberIds: ["founder-marina", "founder-caio"] });
    const refused = run(started, { type: "unassign-member", memberId: "founder-caio" });
    expect(lastTask(refused).assignees).toHaveLength(2);
    expect(refused.warning?.text).toContain("encerre a tarefa");

    const wider = run(started, { type: "assign-member", memberId: "founder-bia", taskId: lastTask(started).id }, { type: "unassign-member", memberId: "founder-caio" });
    expect(lastTask(wider).assignees).toEqual(["founder-marina", "founder-bia"]);
    expect(member(wider, "founder-caio").taskId).toBeNull();
  });

  it("quem sai da equipe tira a tarefa de baixo do mínimo: ela encerra sozinha com o parcial", () => {
    let state = run({ ...foundedGame({ seed: 42, teamName: "T" }), outreach: 40 }, { type: "start-action", actionId: "selection-open", targetId: "broad", memberIds: ["founder-marina"] });
    const id = lastTask(state).id;
    // Como removeMember (trainee que desiste): sai da equipe e da tarefa.
    const gone = { ...state, members: state.members.filter((m) => m.id !== "founder-marina"), tasks: state.tasks.map((t) => ({ ...t, assignees: [] })) };
    const after = run({ ...gone, clock: { ...gone.clock, speed: 1 } }, { type: "tick", realSeconds: 1 });
    expect(after.tasks.find((t) => t.id === id)).toBeUndefined();
    expect(after.inbox.some((m) => m.title.startsWith("Encerrada:") && m.body.includes("sem gente suficiente"))).toBe(true);
  });
});

describe("S2: resultado aos poucos", () => {
  it("todo o catálogo declara como entrega", () => {
    expect(ACTIONS.every((action) => ["continuous", "milestones", "at-end"].includes(action.yield))).toBe(true);
    expect(findAction("outreach-posters")!.yield).toBe("continuous");
    expect(findAction("selection-open")!.yield).toBe("continuous");
    expect(findAction("selection-interviews")!.yield).toBe("continuous");
    expect(findAction("build-wing")!.yield).toBe("milestones");
    expect(findAction("test-structural")!.yield).toBe("at-end");
    expect(findAction("raffle")!.yield).toBe("at-end");
  });

  it("contínuo: o relatório entra hora a hora e o parcial mais o restante dá o total, sem entregar duas vezes", () => {
    let state = run(game(), { type: "start-action", actionId: "report-chapter", targetId: "performance", memberIds: ["founder-marina"] });
    const id = lastTask(state).id;
    const total = lastTask(state).yieldTotal!;
    expect(total).toBe(lastTask(state).hoursTotal);
    const mid = until(state, (s) => fraction(s, id) >= 0.5);
    const partial = mid.report.chapters.performance.hours;
    expect(partial).toBeGreaterThan(0.45 * total);
    expect(partial).toBeLessThan(0.6 * total);
    expect(mid.tasks.find((t) => t.id === id)!.yielded).toBeCloseTo(partial);

    // Encerrar no meio fica com o parcial e não entrega mais nada depois.
    const closed = run(mid, { type: "close-task", taskId: id });
    expect(closed.report.chapters.performance.hours).toBeCloseTo(partial);
    expect(until(closed, (s) => s.clock.hours > closed.clock.hours + 48).report.chapters.performance.hours).toBeCloseTo(partial);

    // Seguir até o fim entrega exatamente o total: parcial + restante.
    const full = until(mid, (s) => s.tasks.find((t) => t.id === id)?.status === "done");
    expect(full.report.chapters.performance.hours).toBeCloseTo(total);
    const rest = full.report.chapters.performance.hours - partial;
    expect(partial + rest).toBeCloseTo(total);
    expect(full.tasks.find((t) => t.id === id)!.yielded).toBeCloseTo(total);
  });

  it("contínuo: o alcance da divulgação sobe com as horas", () => {
    let state = run(game(), { type: "start-action", actionId: "outreach-freshers", memberIds: ["founder-marina", "founder-caio"] });
    const id = lastTask(state).id;
    const total = lastTask(state).yieldTotal!;
    expect(total).toBeGreaterThan(0);
    state = until(state, (s) => fraction(s, id) >= 0.5);
    expect(state.outreach).toBeGreaterThan(0.3 * total);
    expect(state.outreach).toBeLessThan(total);
    const closed = run(state, { type: "close-task", taskId: id });
    expect(closed.outreach).toBeCloseTo(state.outreach);
  });

  it("a divulgação da seletiva soma alcance aos poucos; encerrar no meio abre as inscrições com o que veio", () => {
    const start = run({ ...foundedGame({ seed: 42, teamName: "T" }), outreach: 0 }, { type: "open-selection", format: "broad", memberIds: ["founder-marina", "founder-caio"] });
    const id = lastTask(start).id;
    const total = lastTask(start).yieldTotal!;
    expect(total).toBeGreaterThan(0);
    expect(start.selection!.stage).toBe("promotion");
    expect(start.selection!.applicants).toHaveLength(0);

    const half = until(start, (s) => fraction(s, id) >= 0.5);
    expect(half.outreach).toBeGreaterThan(0.3 * total);
    expect(half.selection!.stage).toBe("promotion");
    const closed = run(half, { type: "close-task", taskId: id });
    expect(closed.selection!.stage).toBe("open");
    expect(closed.selection!.openedAt).toBe(closed.clock.hours);
    expect(closed.tasks.find((t) => t.id === id)).toBeUndefined();
    // O alcance fica para as inscrições (divulgação durante elas ainda soma).
    expect(closed.outreach).toBeCloseTo(half.outreach);
  });

  it("marcos: peça encerrada no meio fica parcial (não voa) e uma nova tarefa termina o que falta", () => {
    const start = run(game({ credits: 1000, stock: { "balsa-light": 2 } }), {
      type: "start-action",
      actionId: "build-tail",
      memberIds: ["founder-caio", "founder-marina"]
    });
    const id = lastTask(start).id;
    const mid = until(start, (s) => fraction(s, id) >= 0.5);
    expect(taskKeeps(mid, id)).toContain("parcial");
    const closed = run(mid, { type: "close-task", taskId: id });
    const partial = closed.parts.find((p) => p.type === "tail")!;
    expect(partial.partial).toBeCloseTo(BALANCE.yield.fabricateStep);
    expect(installedParts({ ...closed, aircraft: null }).tail).toBeNull();

    // Terminar: só as horas que faltam, sem material nem caixa de novo.
    const stock = closed.stock["balsa-light"];
    const credits = closed.credits;
    const resumed = run(closed, { type: "start-action", actionId: "build-tail", targetId: partial.id, memberIds: ["founder-caio", "founder-marina"] });
    expect(lastTask(resumed).hoursTotal).toBeCloseTo(24 * (1 - BALANCE.yield.fabricateStep));
    expect(resumed.stock["balsa-light"]).toBe(stock);
    expect(resumed.credits).toBe(credits);
    const done = until(resumed, (s) => s.tasks.find((t) => t.id === lastTask(resumed).id)?.status === "done");
    const tails = done.parts.filter((p) => p.type === "tail");
    expect(tails).toHaveLength(1);
    expect(tails[0]!.partial).toBeUndefined();
    expect(tails[0]!.quality).toBeGreaterThan(0);
    expect(installedParts({ ...done, aircraft: null }).tail?.id).toBe(partial.id);
  });

  it("marcos: encerrar antes da primeira etapa perde o material; uma peça parcial só aceita o tipo certo", () => {
    const start = run(game({ credits: 1000, stock: { "balsa-light": 1 } }), { type: "start-action", actionId: "build-tail", memberIds: ["founder-caio", "founder-marina"] });
    const id = lastTask(start).id;
    const early = until(start, (s) => fraction(s, id) >= 0.1);
    const closed = run(early, { type: "close-task", taskId: id });
    expect(closed.parts).toHaveLength(0);
    expect(closed.stock["balsa-light"]).toBe(0);
    const wrong = run(closed, { type: "start-action", actionId: "build-tail", targetId: "part-x", memberIds: ["founder-caio"] });
    expect(wrong.tasks).toHaveLength(0);
    expect(wrong.warning?.text).toContain("parcial");
  });

  it("no fim: o que só rende ao concluir se perde ao encerrar, mas o aprendizado fica", () => {
    let state = run(game(), { type: "start-action", actionId: "raffle", memberIds: ["founder-marina"] });
    const id = lastTask(state).id;
    const before = member(state, "founder-marina").communication;
    state = until(state, (s) => fraction(s, id) >= 0.5);
    const closed = run(state, { type: "close-task", taskId: id });
    expect(closed.credits).toBe(0);
    expect(taskKeeps(state, id)).toContain("se perde");
    expect(member(closed, "founder-marina").communication).toBe(before);

    let study = run(game(), { type: "start-action", actionId: "study-aero", memberIds: ["founder-marina"] });
    const studyId = lastTask(study).id;
    const knowledge = member(study, "founder-marina").knowledge.aerodynamics;
    study = until(study, (s) => fraction(s, studyId) >= 0.5);
    study = run(study, { type: "close-task", taskId: studyId });
    expect(member(study, "founder-marina").knowledge.aerodynamics).toBeGreaterThan(knowledge);
  });
});

describe("S3: sem limite rígido de pessoas, com retorno decrescente", () => {
  it("max null em organização; max físico na oficina", () => {
    for (const id of ["selection-open", "outreach-posters", "outreach-freshers", "study-aero", "report-chapter", "document", "raffle", "sponsor-pitch"]) {
      expect(findAction(id)!.crew.max).toBeNull();
    }
    for (const id of ["build-wing", "build-fuselage", "build-tail", "build-gear", "test-structural"]) {
      expect(findAction(id)!.crew.max).toEqual(expect.any(Number));
    }
  });

  it("positionShare: 100% até o ideal e depois cai pela tabela", () => {
    const crew = { min: 1, ideal: 2, max: null };
    expect([0, 1].map((i) => positionShare(i, crew))).toEqual([1, 1]);
    const table = BALANCE.crew.extraEfficiency;
    expect([2, 3, 4].map((i) => positionShare(i, crew))).toEqual([table[0], table[1], table[2]]);
    expect(positionShare(40, crew)).toBe(table.at(-1));
    expect(table[0]).toBeLessThan(1);
    expect(table.every((value, i) => i === 0 || value < table[i - 1]!)).toBe(true);
  });

  it("crewEfficiency soma as fatias; mais gente rende mais, cada vez menos", () => {
    const action = findAction("study-aero")!;
    const values = [0, 1, 2, 3, 4, 5, 6].map((n) => crewEfficiency(action, n));
    expect(values.slice(0, 3)).toEqual([0, 1, 2]);
    for (let i = 1; i < values.length; i += 1) expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    const gains = values.slice(1).map((value, i) => value - values[i]!);
    for (let i = 2; i < gains.length; i += 1) expect(gains[i]!).toBeLessThan(gains[i - 1]!);
    expect(values[3]! - values[2]!).toBeCloseTo(BALANCE.crew.extraEfficiency[0]!);
    // Com max físico, passar dele não rende.
    const gear = findAction("build-gear")!;
    expect(crewEfficiency(gear, 5)).toBe(crewEfficiency(gear, gear.crew.max!));
  });

  it("na simulação, a 3ª pessoa rende a fatia da tabela e 8 pessoas cabem numa tarefa de organização", () => {
    const eight = ["founder-marina", "founder-caio", "founder-bia", "founder-rafa"];
    let state = game();
    state = { ...state, members: [...state.members, ...[1, 2, 3, 4].map((i) => ({ ...member(state, "founder-rafa"), id: `extra-${i}`, name: `Extra ${i}` }))] };
    const ids = [...eight, "extra-1", "extra-2", "extra-3", "extra-4"];
    const started = run(state, { type: "start-action", actionId: "outreach-posters", memberIds: ids });
    expect(lastTask(started).assignees).toHaveLength(8);
    const worked = run({ ...started, clock: { ...started.clock, speed: 1 } }, { type: "tick", realSeconds: 10 });
    const contributions = Object.values(lastTask(worked).contributions);
    expect(contributions).toHaveLength(8);
    expect(Math.min(...contributions)).toBeLessThan(Math.max(...contributions));
  });
});
