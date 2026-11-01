import { describe, expect, it } from "vitest";
import {
  applyCommand,
  BALANCE,
  DEDICATIONS,
  createGame,
  dateToHours,
  estimateOutcome,
  estimateRemainingDays,
  estimateTaskDays,
  leadDaysRange,
  memberHoursPerDay,
  motivationFactor,
  partState,
  SEASON_START,
  type Command,
  type GameState,
  type Member
} from "../../src/sim";

/** Integrante contratado para os testes: o presidente não trabalha (é o jogador). */
function withRookie(game: GameState): GameState {
  const founder = game.members.find((item) => item.id === "captain-aero")!;
  const rookie: Member = {
    ...founder,
    id: "rookie",
    name: "Novato",
    role: "member",
    knowledge: { ...founder.knowledge, aerodynamics: 0 },
    hoursPerDay: 2
  };
  return { ...game, members: [...game.members, rookie] };
}

const newGame = (overrides: Partial<GameState> = {}): GameState => ({
  ...withRookie(createGame({ seed: 42, teamName: "Teste" })),
  ...overrides
});

const run = (state: GameState, ...commands: Command[]): GameState => commands.reduce(applyCommand, state);

/** Joga N dias em 1×, retomando depois de cada pausa automática. */
function play(state: GameState, days: number): GameState {
  const target = state.clock.hours + days * 24;
  let next = state;
  for (let guard = 0; guard < 10_000 && next.clock.hours < target - 1e-9; guard += 1) {
    if (next.clock.speed === 0) next = applyCommand(next, { type: "set-speed", speed: 1 });
    const hoursLeft = target - next.clock.hours;
    next = applyCommand(next, { type: "tick", realSeconds: (hoursLeft * 10) / 24 });
  }
  return next;
}

/** Joga até a tarefa terminar; a pausa automática da conclusão para o relógio no passo exato. */
function playUntilDone(state: GameState, taskId: string, maxDays = 120): GameState {
  let next = state;
  for (let day = 0; day < maxDays * 2; day += 1) {
    if (next.tasks.find((task) => task.id === taskId)?.status === "done") return next;
    next = run(next, { type: "set-speed", speed: 1 }, { type: "tick", realSeconds: 10 });
  }
  throw new Error(`tarefa ${taskId} não terminou`);
}

const lastTask = (state: GameState) => state.tasks[state.tasks.length - 1]!;
const member = (state: GameState, id: string): Member => state.members.find((item) => item.id === id)!;

describe("horas da equipe", () => {
  it("multiplica disponibilidade, calendário acadêmico e motivação", () => {
    const captain = member(newGame(), "captain-aero");
    expect(motivationFactor(100)).toBe(1);
    expect(motivationFactor(0)).toBe(BALANCE.motivation.hoursFactorAtZero);
    expect(memberHoursPerDay(captain, SEASON_START)).toBeCloseTo(3 * 1 * 0.9);
    expect(memberHoursPerDay(captain, Date.UTC(2026, 6, 10))).toBeCloseTo(3 * 1.6 * 0.9);
  });

  it("o tick distribui horas só para quem está alocado em tarefa ativa", () => {
    let game = run(newGame(), { type: "start-action", actionId: "raffle" });
    const taskId = lastTask(game).id;
    game = run(game, { type: "assign-member", memberId: "captain-aero", taskId });
    game = play(game, 1);
    const task = game.tasks.find((item) => item.id === taskId)!;
    expect(task.hoursDone).toBeCloseTo(2.7);
    expect(task.contributions).toEqual({ "captain-aero": expect.closeTo(2.7) });
  });

  it("vários integrantes somam horas na mesma tarefa", () => {
    let game = run(newGame(), { type: "start-action", actionId: "raffle" });
    const taskId = lastTask(game).id;
    game = run(
      game,
      { type: "assign-member", memberId: "captain-aero", taskId },
      { type: "assign-member", memberId: "captain-struct", taskId }
    );
    game = play(game, 1);
    expect(game.tasks[0]!.hoursDone).toBeCloseTo(5.4);
  });
});

describe("tarefas do catálogo", () => {
  it("recusa ação sem caixa com aviso e sem criar tarefa", () => {
    const game = run(newGame(), { type: "start-action", actionId: "buy-motor" });
    expect(game.tasks).toHaveLength(0);
    expect(game.credits).toBe(0);
    expect(game.warning?.text).toContain("Caixa insuficiente");
  });

  it("debita créditos na hora e espera o prazo antes de concluir uma compra", () => {
    let game = run(newGame({ credits: 500 }), { type: "start-action", actionId: "buy-motor" });
    expect(game.credits).toBe(80);
    const task = lastTask(game);
    expect(task.status).toBe("waiting");
    // Prometido 10 dias; o real é sorteado na faixa de BALANCE.lead e fica escondido.
    expect(task.expectedReadyAt).toBe(10 * 24);
    expect(task.readyAt!).toBeGreaterThanOrEqual(10 * 24 * BALANCE.lead.minFactor);
    expect(task.readyAt!).toBeLessThanOrEqual(10 * 24 * BALANCE.lead.maxFactor);
    expect(leadDaysRange("buy-motor")).toEqual({ min: 10 * BALANCE.lead.minFactor, promised: 10, max: 10 * BALANCE.lead.maxFactor });
    game = play(game, task.readyAt! / 24 - 0.1);
    expect(game.tasks[0]!.status).toBe("waiting");
    game = play(game, 0.2);
    expect(game.tasks[0]!.status).toBe("done");
    expect(game.parts).toHaveLength(1);
    expect(game.parts[0]).toMatchObject({ type: "powertrain", quality: BALANCE.parts.purchasedQuality, condition: 100 });
  });

  it("tarefa com prazo não consome horas antes de readyAt", () => {
    let game = run(newGame(), { type: "start-action", actionId: "sponsor-pitch" });
    const taskId = lastTask(game).id;
    game = run(game, { type: "assign-member", memberId: "rookie", taskId });
    const readyDays = lastTask(game).readyAt! / 24;
    game = play(game, readyDays - 0.5);
    expect(game.tasks[0]!.hoursDone).toBe(0);
    expect(game.tasks[0]!.status).toBe("waiting");
    game = play(game, 1);
    expect(game.tasks[0]!.status).toBe("active");
    expect(game.tasks[0]!.hoursDone).toBeGreaterThan(0);
  });

  it("ação sem horas e sem prazo conclui na hora (frete expresso encurta a espera)", () => {
    let game = run(newGame({ credits: 600 }), { type: "start-action", actionId: "buy-motor" });
    const motor = lastTask(game);
    game = run(game, { type: "start-action", actionId: "express-shipping", targetId: motor.id });
    expect(game.credits).toBe(600 - 420 - 90);
    expect(lastTask(game).status).toBe("done");
    const expedited = game.tasks.find((task) => task.id === motor.id)!;
    expect(expedited.readyAt).toBeCloseTo(motor.readyAt! * 0.3);
    expect(expedited.expectedReadyAt).toBeCloseTo(10 * 24 * 0.3);
    expect(game.clock.speed).toBe(0);
  });

  it("frete expresso exige uma tarefa que ainda está chegando", () => {
    const game = run(newGame({ credits: 600 }), { type: "start-action", actionId: "express-shipping" });
    expect(game.credits).toBe(600);
    expect(game.warning?.text).toContain("Frete expresso");
  });

  it("realoca, desaloca e cancela tarefas mantendo integrantes e tarefas em sincronia", () => {
    let game = run(newGame(), { type: "start-action", actionId: "raffle" }, { type: "start-action", actionId: "study-aero" });
    const [raffle, study] = game.tasks;
    game = run(game, { type: "assign-member", memberId: "rookie", taskId: raffle!.id });
    game = run(game, { type: "assign-member", memberId: "rookie", taskId: study!.id });
    expect(game.tasks[0]!.assignees).toEqual([]);
    expect(game.tasks[1]!.assignees).toEqual(["rookie"]);
    expect(member(game, "rookie").taskId).toBe(study!.id);

    game = run(game, { type: "unassign-member", memberId: "rookie" });
    expect(member(game, "rookie").taskId).toBeNull();
    expect(game.tasks[1]!.assignees).toEqual([]);

    game = run(game, { type: "assign-member", memberId: "captain-aero", taskId: study!.id }, { type: "cancel-task", taskId: study!.id });
    expect(game.tasks.map((task) => task.id)).toEqual([raffle!.id]);
    expect(member(game, "captain-aero").taskId).toBeNull();
  });

  it("não aloca gente em compra (tarefa sem horas)", () => {
    let game = run(newGame({ credits: 500 }), { type: "start-action", actionId: "buy-motor" });
    game = run(game, { type: "assign-member", memberId: "rookie", taskId: lastTask(game).id });
    expect(member(game, "rookie").taskId).toBeNull();
    expect(game.warning).not.toBeNull();
  });

  it("applyCommand não muta o estado anterior", () => {
    const before = run(newGame({ credits: 1000 }), { type: "start-action", actionId: "raffle" });
    const snapshot = structuredClone(before);
    let after = run(before, { type: "assign-member", memberId: "rookie", taskId: before.tasks[0]!.id });
    after = play(after, 30);
    expect(before).toEqual(snapshot);
    expect(after).not.toEqual(before);
  });
});

describe("efeitos de conclusão", () => {
  it("rifa credita no caixa e avisa na inbox", () => {
    let game = run(newGame(), { type: "start-action", actionId: "raffle" });
    const taskId = lastTask(game).id;
    const estimate = estimateOutcome(game, "raffle", ["captain-aero", "rookie"])!;
    game = run(game, { type: "assign-member", memberId: "captain-aero", taskId }, { type: "assign-member", memberId: "rookie", taskId });
    game = playUntilDone(game, taskId);
    expect(game.credits).toBeGreaterThanOrEqual(Math.floor(estimate.min));
    expect(game.credits).toBeLessThanOrEqual(Math.ceil(estimate.max));
    expect(game.inbox.some((message) => message.title === "Concluído: Organizar rifa")).toBe(true);
    expect(member(game, "captain-aero").taskId).toBeNull();
  });

  it("patrocínio é sorteado com rngState e reproduzível pelo seed", () => {
    const outcome = (seed: number) => {
      let game = run(withRookie(createGame({ seed, teamName: "T" })), { type: "start-action", actionId: "sponsor-pitch" });
      const taskId = lastTask(game).id;
      game = run(game, { type: "assign-member", memberId: "rookie", taskId });
      return playUntilDone(game, taskId).credits;
    };
    expect(outcome(42)).toBe(outcome(42));
    const results = [1, 2, 3, 4, 5, 6, 7, 8].map(outcome);
    expect(results).toContain(0);
    expect(results.some((credits) => credits > 0)).toBe(true);
  });

  it("estudo aumenta o conhecimento tácito de quem trabalhou, com retorno decrescente", () => {
    let game = run(newGame(), { type: "start-action", actionId: "study-aero" });
    const taskId = lastTask(game).id;
    game = run(game, { type: "assign-member", memberId: "captain-aero", taskId }, { type: "assign-member", memberId: "rookie", taskId });
    game = playUntilDone(game, taskId);
    const captain = member(game, "captain-aero");
    const rookie = member(game, "rookie");
    expect(captain.knowledge.aerodynamics).toBeGreaterThan(25);
    expect(rookie.knowledge.aerodynamics).toBeGreaterThan(0);
    expect(member(game, "captain-struct").knowledge.aerodynamics).toBe(0);
    // O novato parte de 0 e aprende mais por hora que o capitão (25).
    const perHour = (from: number, to: number, id: string) =>
      (to - from) / game.tasks[0]!.contributions[id]!;
    expect(perHour(0, rookie.knowledge.aerodynamics, "rookie")).toBeGreaterThan(
      perHour(25, captain.knowledge.aerodynamics, "captain-aero")
    );
  });

  it("documentar converte tácito em documentado na disciplina escolhida", () => {
    let game = run(newGame(), { type: "start-action", actionId: "document" });
    expect(game.warning?.text).toContain("disciplina");
    game = run(game, { type: "start-action", actionId: "document", targetId: "aerodynamics" });
    const task = lastTask(game);
    expect(task.label).toBe("Documentar conhecimento (Aerodinâmica)");
    const estimate = estimateOutcome(game, "document", ["captain-aero"], "aerodynamics")!;
    expect(estimate.text).toMatch(/^Acervo de Aerodinâmica \+/);
    game = run(game, { type: "assign-member", memberId: "captain-aero", taskId: task.id });
    game = playUntilDone(game, task.id);
    expect(game.documented.aerodynamics).toBeGreaterThanOrEqual(estimate.min - 1e-9);
    expect(game.documented.aerodynamics).toBeLessThanOrEqual(estimate.max + 1e-9);
    expect(game.documented.structures).toBe(0);
  });

  it("fabricar asa exige balsa no estoque e cria peça com qualidade da fabricação", () => {
    let game = run(newGame({ credits: 1000 }), { type: "start-action", actionId: "build-wing" });
    expect(game.warning?.text).toContain("balsa");
    expect(game.credits).toBe(1000);

    game = run(game, { type: "start-action", actionId: "buy-balsa" });
    game = playUntilDone(game, lastTask(game).id);
    expect(game.stock.balsa).toBe(1);

    game = run(game, { type: "start-action", actionId: "build-wing" });
    expect(game.stock.balsa).toBe(0);
    const taskId = lastTask(game).id;
    const estimate = estimateOutcome(game, "build-wing", ["captain-struct", "captain-aero"])!;
    game = run(
      game,
      { type: "assign-member", memberId: "captain-struct", taskId },
      { type: "assign-member", memberId: "captain-aero", taskId }
    );
    game = playUntilDone(game, taskId);
    const wing = game.parts.find((part) => part.type === "wing")!;
    expect(wing.condition).toBe(100);
    expect(partState(wing.condition)).toBe("new");
    expect(wing.quality).toBeGreaterThanOrEqual(estimate.min);
    expect(wing.quality).toBeLessThanOrEqual(estimate.max);
    expect(member(game, "captain-struct").fabrication).toBeGreaterThan(20);
    expect(member(game, "captain-struct").knowledge.structures).toBeGreaterThan(25);
  });

  it("reparo recupera parte da condição da peça alvo", () => {
    let game = newGame({
      credits: 100,
      parts: [{ id: "part-x", type: "wing", label: "Asa", quality: 50, condition: 40 }]
    });
    game = run(game, { type: "start-action", actionId: "repair-part", targetId: "part-x" });
    const taskId = lastTask(game).id;
    const estimate = estimateOutcome(game, "repair-part", ["captain-struct"], "part-x")!;
    game = run(game, { type: "assign-member", memberId: "captain-struct", taskId });
    game = playUntilDone(game, taskId);
    expect(game.parts[0]!.condition).toBeGreaterThanOrEqual(40 + Math.round(estimate.min));
    expect(game.parts[0]!.condition).toBeLessThanOrEqual(40 + Math.round(estimate.max));
  });
});

describe("estados visíveis das peças", () => {
  it("segue as faixas do design §7.2", () => {
    expect([100, 80, 79, 50, 49, 20, 19, 0].map(partState)).toEqual([
      "new",
      "new",
      "worn",
      "worn",
      "damaged",
      "damaged",
      "broken",
      "broken"
    ]);
  });
});

describe("eventos e pausa automática", () => {
  it("pausa quando uma tarefa termina, com o motivo e a mensagem", () => {
    let game = run(newGame({ credits: 500 }), { type: "start-action", actionId: "buy-scale" }, { type: "set-speed", speed: 4 });
    const readyAt = lastTask(game).readyAt!;
    game = run(game, { type: "tick", realSeconds: 60 });
    expect(game.clock.speed).toBe(0);
    expect(game.clock.hours).toBeGreaterThanOrEqual(readyAt);
    expect(game.clock.hours).toBeLessThan(readyAt + BALANCE.stepHours + 1e-9);
    expect(game.pause?.reason).toBe("task-done");
    const message = game.inbox.find((item) => item.id === game.pause?.messageId);
    expect(message?.title).toBe("Concluído: Comprar balança de precisão");
    expect(game.equipment).toEqual(["scale"]);
  });

  it("avisa a 7 dias de um prazo oficial e quando ele passa", () => {
    const warnAt = dateToHours(Date.UTC(2026, 7, 9));
    let game = newGame({ clock: { hours: warnAt - 2, speed: 1 } });
    game = run(game, { type: "tick", realSeconds: 5 });
    expect(game.pause?.reason).toBe("deadline-soon");
    expect(game.inbox.at(-1)?.title).toBe("Faltam 7 dias: Relatório, plantas e previsões");

    game = play(game, 7.5);
    const passed = game.inbox.find((message) => message.title === "Prazo encerrado: Relatório, plantas e previsões");
    expect(passed).toBeDefined();
  });

  it("marco informativo não gera aviso de 7 dias, só o do dia", () => {
    const game = play(newGame(), 21);
    const titles = game.inbox.map((message) => message.title);
    expect(titles).toContain("Hoje: Revisão 01 do regulamento");
    expect(titles.some((title) => title.includes("Faltam") && title.includes("Revisão"))).toBe(false);
  });

  it("pausa manual registra o motivo e retomar limpa", () => {
    let game = run(newGame(), { type: "set-speed", speed: 2 });
    expect(game.pause).toBeNull();
    game = run(game, { type: "set-speed", speed: 0 });
    expect(game.pause).toMatchObject({ reason: "manual", messageId: null });
  });
});

describe("motivação", () => {
  it("cai devagar para quem fica sem tarefa", () => {
    const game = play(newGame(), 10);
    expect(member(game, "rookie").motivation).toBeCloseTo(80 - 10 * BALANCE.motivation.idleDecayPerDay);
  });

  it("não cai para quem trabalha dentro do limite e cai para quem está sobrecarregado", () => {
    let game = newGame();
    game = run(game, { type: "start-action", actionId: "report-chapter", targetId: "aerodynamics" });
    const taskId = lastTask(game).id;
    game = run(game, { type: "assign-member", memberId: "captain-aero", taskId });
    game = play(game, 7);
    expect(member(game, "captain-aero").motivation).toBe(80);

    // Começa já perto do limite de sobrecarga.
    game = {
      ...game,
      members: game.members.map((item) =>
        item.id === "captain-aero" ? { ...item, workStreakHours: BALANCE.motivation.overloadAfterHours } : item
      )
    };
    game = play(game, 2);
    expect(member(game, "captain-aero").motivation).toBeLessThan(80);
  });

  it("sobe ao concluir a tarefa", () => {
    let game = run(newGame(), { type: "start-action", actionId: "unload-drill" });
    const taskId = lastTask(game).id;
    game = run(game, { type: "assign-member", memberId: "captain-aero", taskId });
    game = playUntilDone(game, taskId);
    expect(member(game, "captain-aero").motivation).toBe(80 + BALANCE.motivation.completionBoost);
    expect(member(game, "captain-aero").agility).toBeGreaterThan(40);
  });
});

describe("equipe por tarefa (crew)", () => {
  it("recusa alocar acima do máximo da ação", () => {
    let game = run(newGame(), { type: "start-action", actionId: "report-chapter", targetId: "aerodynamics" });
    const taskId = lastTask(game).id;
    game = run(game, { type: "assign-member", memberId: "captain-aero", taskId }, { type: "assign-member", memberId: "rookie", taskId });
    expect(game.tasks[0]!.assignees).toEqual(["captain-aero"]);
    expect(member(game, "rookie").taskId).toBeNull();
    expect(game.warning?.text).toContain("uma pessoa");
  });

  it("abaixo do mínimo a tarefa não avança", () => {
    let game = run(newGame(), { type: "start-action", actionId: "outreach-freshers" });
    const taskId = lastTask(game).id;
    game = run(game, { type: "assign-member", memberId: "captain-aero", taskId });
    game = play(game, 2);
    expect(game.tasks[0]!.hoursDone).toBe(0);
    expect(estimateRemainingDays(game, taskId)).toBeNull();
  });

  it("acima do ideal cada pessoa extra rende menos (a de menor rendimento)", () => {
    let game = run(newGame(), { type: "start-action", actionId: "study-aero" });
    const taskId = lastTask(game).id;
    game = run(
      game,
      { type: "assign-member", memberId: "rookie", taskId },
      { type: "assign-member", memberId: "captain-aero", taskId },
      { type: "assign-member", memberId: "captain-struct", taskId }
    );
    game = play(game, 1);
    const extra = 2 * 0.9 * BALANCE.crew.extraEfficiency;
    expect(game.tasks[0]!.hoursDone).toBeCloseTo(2.7 + 2.7 + extra);
    expect(game.tasks[0]!.contributions["rookie"]).toBeCloseTo(extra);
  });

  it("estima a duração antes de iniciar e bate com a simulação", () => {
    const game = newGame();
    const estimate = estimateTaskDays(game, "raffle", ["captain-aero"])!;
    expect(estimateTaskDays(game, "raffle", ["captain-aero", "captain-struct"])!).toBeLessThan(estimate);
    expect(estimateTaskDays(game, "raffle", [])).toBeNull();
    expect(estimateTaskDays(game, "test-flight", ["captain-aero"])).toBeNull();
    expect(estimateTaskDays(game, "buy-motor", [])).toBe(10);

    let started = run(game, { type: "start-action", actionId: "raffle" });
    const taskId = lastTask(started).id;
    started = run(started, { type: "assign-member", memberId: "captain-aero", taskId });
    expect(estimateRemainingDays(started, taskId)).toBeCloseTo(estimate);
    const done = playUntilDone(started, taskId);
    expect(done.tasks[0]!.doneAt! / 24).toBeCloseTo(estimate, 1);
  });

  it("estima o restante de uma compra pelo prazo", () => {
    const game = run(newGame({ credits: 500 }), { type: "start-action", actionId: "buy-motor" });
    expect(estimateRemainingDays(play(game, 4), lastTask(game).id)).toBeCloseTo(6);
  });
});

describe("presidente", () => {
  it("coordena e não é alocado em tarefas", () => {
    let game = run(newGame(), { type: "start-action", actionId: "raffle" });
    game = run(game, { type: "assign-member", memberId: "president", taskId: lastTask(game).id });
    expect(member(game, "president").taskId).toBeNull();
    expect(game.tasks[0]!.assignees).toEqual([]);
    expect(game.warning?.text).toBe("O presidente coordena; escolha alguém da equipe.");
  });

  it("não gera horas, não desmotiva parado e não acumula sequência", () => {
    const game = newGame();
    expect(memberHoursPerDay(member(game, "president"), SEASON_START)).toBe(0);
    const later = play(game, 10);
    expect(member(later, "president").motivation).toBe(80);
    expect(member(later, "president").workStreakHours).toBe(0);
  });
});

describe("rendimento pela qualidade da equipe", () => {
  const withSkill = (game: GameState, id: string, patch: Partial<Member>): GameState => ({
    ...game,
    members: game.members.map((item) => (item.id === id ? { ...item, ...patch } : item))
  });

  it("equipe melhor rende mais e varia menos", () => {
    const weak = withSkill(newGame(), "captain-aero", { communication: 10 });
    const strong = withSkill(newGame(), "captain-aero", { communication: 90 });
    const low = estimateOutcome(weak, "raffle", ["captain-aero"])!;
    const high = estimateOutcome(strong, "raffle", ["captain-aero"])!;
    expect(high.expected).toBeGreaterThan(low.expected);
    expect((high.max - high.min) / high.expected).toBeLessThan((low.max - low.min) / low.expected);
    expect(low.text).toMatch(/^◆ \d+–\d+$/);
  });

  it("a qualidade é a habilidade ponderada pelas horas e pela motivação", () => {
    const game = withSkill(newGame(), "captain-aero", { communication: 60 });
    const estimate = estimateOutcome(game, "raffle", ["captain-aero"])!;
    expect(estimate.quality).toBeCloseTo(60 * motivationFactor(80));
    // Novato (2 h/dia, comunicação 30) pesa menos que o capitão (3 h/dia, 60).
    const mixed = estimateOutcome(game, "raffle", ["captain-aero", "rookie"])!;
    expect(mixed.quality).toBeCloseTo(((60 * 3 + 30 * 2) / 5) * motivationFactor(80));
  });

  it("patrocínio mostra chance e valor; o resultado real é sorteado com rngState", () => {
    const estimate = estimateOutcome(newGame(), "sponsor-pitch", ["captain-aero"])!;
    expect(estimate.chance).toBeGreaterThan(BALANCE.sponsor.chanceAtZero);
    expect(estimate.text).toMatch(/% de chance de ◆/);
  });

  it("sem equipe válida ou sem resultado variável não há estimativa", () => {
    const game = newGame();
    expect(estimateOutcome(game, "raffle", [])).toBeNull();
    expect(estimateOutcome(game, "buy-motor", [])).toBeNull();
    expect(estimateOutcome(game, "document", ["captain-aero"])).toBeNull();
  });

  it("o mesmo seed dá o mesmo resultado; seeds diferentes variam", () => {
    const raffle = (seed: number) => {
      let game = run(withRookie(createGame({ seed, teamName: "T" })), { type: "start-action", actionId: "raffle" });
      const taskId = lastTask(game).id;
      game = run(game, { type: "assign-member", memberId: "captain-aero", taskId });
      return playUntilDone(game, taskId).credits;
    };
    expect(raffle(11)).toBe(raffle(11));
    expect(new Set([11, 12, 13, 14, 15].map(raffle)).size).toBeGreaterThan(1);
  });
});

describe("divulgação", () => {
  it("soma alcance pela comunicação de quem divulga, e o alcance esfria com os dias", () => {
    let game = run(newGame(), { type: "start-action", actionId: "outreach-posters" });
    const taskId = lastTask(game).id;
    const estimate = estimateOutcome(game, "outreach-posters", ["captain-aero"])!;
    expect(estimate.text).toMatch(/^Alcance \+/);
    game = run(game, { type: "assign-member", memberId: "captain-aero", taskId });
    game = playUntilDone(game, taskId);
    expect(game.outreach).toBeGreaterThanOrEqual(estimate.min - 0.1);
    expect(game.outreach).toBeLessThanOrEqual(estimate.max);
    const reach = game.outreach;
    game = play(game, 10);
    expect(game.outreach).toBeCloseTo(reach * Math.pow(1 - BALANCE.outreach.decayPerDay, 10), 1);
  });
});

describe("dedicação", () => {
  it("rápido gasta menos horas e caprichado mais; a tarefa guarda a escolha", () => {
    let game = run(newGame(), { type: "start-action", actionId: "raffle", dedication: "rush" });
    expect(lastTask(game)).toMatchObject({ dedication: "rush", hoursTotal: 16 * 0.6 });
    game = run(game, { type: "start-action", actionId: "raffle" });
    expect(lastTask(game)).toMatchObject({ dedication: "normal", hoursTotal: 16 });
    game = run(game, { type: "start-action", actionId: "raffle", dedication: "careful" });
    expect(lastTask(game).hoursTotal).toBeCloseTo(16 * 1.6);
  });

  it("compras ignoram a dedicação", () => {
    const game = run(newGame({ credits: 500 }), { type: "start-action", actionId: "buy-motor", dedication: "careful" });
    expect(lastTask(game)).toMatchObject({ dedication: "normal", hoursTotal: 0 });
  });

  it("estimativas comparam as opções: caprichado demora mais e rende melhor", () => {
    const game = newGame();
    const team = ["captain-aero", "captain-struct"];
    const days = DEDICATIONS.map((item) => estimateTaskDays(game, "build-wing", team, item.id)!);
    expect(days[0]!).toBeLessThan(days[1]!);
    expect(days[1]!).toBeLessThan(days[2]!);
    const quality = DEDICATIONS.map((item) => estimateOutcome(game, "build-wing", team, null, item.id)!.quality);
    const normal = estimateOutcome(game, "build-wing", team)!.quality;
    expect(quality).toEqual([normal - 15, normal, normal + 15].map((value) => expect.closeTo(value)));
  });

  it("a qualidade da conclusão usa a dedicação da tarefa", () => {
    const finish = (dedication: "rush" | "careful") => {
      let game = run(newGame(), { type: "start-action", actionId: "raffle", dedication });
      const taskId = lastTask(game).id;
      const estimate = estimateOutcome(game, "raffle", ["captain-aero"], null, dedication)!;
      game = run(game, { type: "assign-member", memberId: "captain-aero", taskId });
      return { credits: playUntilDone(game, taskId).credits, estimate };
    };
    for (const dedication of ["rush", "careful"] as const) {
      const { credits, estimate } = finish(dedication);
      expect(credits).toBeGreaterThanOrEqual(Math.floor(estimate.min));
      expect(credits).toBeLessThanOrEqual(Math.ceil(estimate.max));
    }
  });
});
