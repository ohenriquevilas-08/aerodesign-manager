import { describe, expect, it } from "vitest";
import {
  applyCommand,
  BALANCE,
  DEDICATIONS,
  dateToHours,
  estimateOutcome,
  estimateRemainingDays,
  estimateTaskDays,
  leadDaysRange,
  clockToDate,
  memberHoursPerDay,
  motivationFactor,
  partState,
  SEASON_START,
  type Command,
  type GameState,
  type Member
} from "../../src/sim";
import { startedGame, TEST_START_HOURS } from "./helpers";

/** Integrante contratado para os testes: o presidente não trabalha (é o jogador). */
function withRookie(game: GameState): GameState {
  const founder = game.members.find((item) => item.id === "founder-marina")!;
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

/** Escala cheia: todos sem aula, todo dia de manhã e à tarde, para as tarefas de oficina andarem. */
function withFullSchedule(game: GameState): GameState {
  const crew = game.members.filter((item) => item.role !== "president").map((item) => item.id);
  const schedule: GameState["workshop"]["schedule"] = {};
  for (let day = 0; day <= 6; day += 1) {
    for (const shift of ["morning", "afternoon"] as const) schedule[`${day as 0}-${shift}`] = crew;
  }
  return { ...game, members: game.members.map((item) => ({ ...item, classSlots: [] })), workshop: { ...game.workshop, schedule } };
}

const newGame = (overrides: Partial<GameState> = {}): GameState => ({
  ...withFullSchedule(withRookie(startedGame({ seed: 42, teamName: "Teste" }))),
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
    const captain = member(newGame(), "founder-marina");
    expect(motivationFactor(100)).toBe(1);
    expect(motivationFactor(0)).toBe(BALANCE.motivation.hoursFactorAtZero);
    expect(memberHoursPerDay(captain, SEASON_START)).toBeCloseTo(3 * 1 * 0.9);
    expect(memberHoursPerDay(captain, Date.UTC(2026, 6, 10))).toBeCloseTo(3 * 1.6 * 0.9);
  });

  it("o tick distribui horas só para quem está alocado em tarefa ativa", () => {
    let game = run(newGame(), { type: "start-action", actionId: "raffle", memberIds: ["founder-marina"] });
    const taskId = lastTask(game).id;
    game = play(game, 1);
    const task = game.tasks.find((item) => item.id === taskId)!;
    expect(task.hoursDone).toBeCloseTo(2.7);
    expect(task.contributions).toEqual({ "founder-marina": expect.closeTo(2.7) });
  });

  it("vários integrantes somam horas na mesma tarefa", () => {
    let game = run(newGame(), { type: "start-action", actionId: "raffle", memberIds: ["founder-marina", "founder-caio"] });
    game = play(game, 1);
    expect(game.tasks[0]!.hoursDone).toBeCloseTo(5.4);
  });
});

describe("tarefas do catálogo", () => {
  it("recusa ação sem caixa com aviso e sem criar tarefa", () => {
    const game = run(newGame({ parts: [{ id: "part-x", type: "wing", label: "Asa", quality: 50, condition: 40 }] }), {
      type: "start-action",
      actionId: "repair-part",
      targetId: "part-x",
      memberIds: ["founder-caio"]
    });
    expect(game.tasks).toHaveLength(0);
    expect(game.credits).toBe(0);
    expect(game.warning?.text).toContain("Caixa insuficiente");
  });

  it("tarefa com prazo não consome horas antes de readyAt", () => {
    let game = run(newGame(), { type: "start-action", actionId: "sponsor-pitch", memberIds: ["rookie"] });
    const readyDays = (lastTask(game).readyAt! - game.clock.hours) / 24;
    game = play(game, readyDays - 0.5);
    expect(game.tasks[0]!.hoursDone).toBe(0);
    expect(game.tasks[0]!.status).toBe("waiting");
    game = play(game, 1);
    expect(game.tasks[0]!.status).toBe("active");
    expect(game.tasks[0]!.hoursDone).toBeGreaterThan(0);
    expect(leadDaysRange("sponsor-pitch")).toEqual({ min: 14 * BALANCE.lead.minFactor, promised: 14, max: 14 * BALANCE.lead.maxFactor });
  });

  it("realoca, desaloca e encerra tarefas mantendo integrantes e tarefas em sincronia", () => {
    let game = run(
      newGame(),
      { type: "start-action", actionId: "raffle", memberIds: ["rookie", "founder-caio"] },
      { type: "start-action", actionId: "study-aero", memberIds: ["founder-bia"] }
    );
    const [raffle, study] = game.tasks;
    // Com 2 na rifa (mínimo 1), o novato pode sair da rifa e ir para o estudo.
    game = run(game, { type: "assign-member", memberId: "rookie", taskId: study!.id });
    expect(game.tasks[0]!.assignees).toEqual(["founder-caio"]);
    expect(game.tasks[1]!.assignees).toEqual(["founder-bia", "rookie"]);
    expect(member(game, "rookie").taskId).toBe(study!.id);

    // Tirar alguém que deixaria a tarefa abaixo do mínimo é recusado: o caminho é encerrar.
    const refused = run(game, { type: "unassign-member", memberId: "founder-caio" });
    expect(refused.tasks[0]!.assignees).toEqual(["founder-caio"]);
    expect(refused.warning?.text).toContain("encerre a tarefa");
    const moved = run(game, { type: "assign-member", memberId: "founder-caio", taskId: study!.id });
    expect(moved.warning?.text).toContain("abaixo do mínimo");

    game = run(game, { type: "unassign-member", memberId: "rookie" });
    expect(member(game, "rookie").taskId).toBeNull();
    expect(game.tasks[1]!.assignees).toEqual(["founder-bia"]);

    game = run(game, { type: "close-task", taskId: study!.id });
    expect(game.tasks.map((task) => task.id)).toEqual([raffle!.id]);
    expect(member(game, "founder-bia").taskId).toBeNull();
  });

  it("applyCommand não muta o estado anterior", () => {
    const before = run(newGame({ credits: 1000 }), { type: "start-action", actionId: "raffle", memberIds: ["founder-bia"] });
    const snapshot = structuredClone(before);
    const after = play(before, 30);
    expect(before).toEqual(snapshot);
    expect(after).not.toEqual(before);
  });
});

describe("efeitos de conclusão", () => {
  it("rifa credita no caixa e avisa na inbox", () => {
    const estimate = estimateOutcome(newGame(), "raffle", ["founder-marina", "rookie"])!;
    let game = run(newGame(), { type: "start-action", actionId: "raffle", memberIds: ["founder-marina", "rookie"] });
    const taskId = lastTask(game).id;
    game = playUntilDone(game, taskId);
    expect(game.credits).toBeGreaterThanOrEqual(Math.floor(estimate.min));
    expect(game.credits).toBeLessThanOrEqual(Math.ceil(estimate.max));
    expect(game.inbox.some((message) => message.title === "Concluído: Organizar rifa")).toBe(true);
    expect(member(game, "founder-marina").taskId).toBeNull();
  });

  it("patrocínio é sorteado com rngState e reproduzível pelo seed", () => {
    const outcome = (seed: number) => {
      const game = run(withRookie(startedGame({ seed, teamName: "T" })), { type: "start-action", actionId: "sponsor-pitch", memberIds: ["rookie"] });
      return playUntilDone(game, lastTask(game).id).credits;
    };
    expect(outcome(42)).toBe(outcome(42));
    const results = [1, 2, 3, 4, 5, 6, 7, 8].map(outcome);
    expect(results).toContain(0);
    expect(results.some((credits) => credits > 0)).toBe(true);
  });

  it("estudo aumenta o conhecimento tácito de quem trabalhou, com retorno decrescente", () => {
    const start = newGame();
    const captainBefore = member(start, "founder-marina").knowledge.aerodynamics;
    const caioBefore = member(start, "founder-caio").knowledge.aerodynamics;
    let game = run(start, { type: "start-action", actionId: "study-aero", memberIds: ["founder-marina", "rookie"] });
    const taskId = lastTask(game).id;
    game = playUntilDone(game, taskId);
    const captain = member(game, "founder-marina");
    const rookie = member(game, "rookie");
    expect(captain.knowledge.aerodynamics).toBeGreaterThan(captainBefore);
    expect(rookie.knowledge.aerodynamics).toBeGreaterThan(0);
    expect(member(game, "founder-caio").knowledge.aerodynamics).toBe(caioBefore);
    // O novato parte de 0 e aprende mais por hora que a capitã (mesma facilidade: copiou o perfil dela).
    const perHour = (from: number, to: number, id: string) =>
      (to - from) / game.tasks[0]!.contributions[id]!;
    expect(perHour(0, rookie.knowledge.aerodynamics, "rookie")).toBeGreaterThan(
      perHour(captainBefore, captain.knowledge.aerodynamics, "founder-marina")
    );
  });

  it("documentar converte tácito em documentado na disciplina escolhida", () => {
    let game = run(newGame(), { type: "start-action", actionId: "document", memberIds: ["founder-marina"] });
    expect(game.warning?.text).toContain("disciplina");
    game = run(game, { type: "start-action", actionId: "document", targetId: "aerodynamics", memberIds: ["founder-marina"] });
    const task = lastTask(game);
    expect(task.label).toBe("Documentar conhecimento (Aerodinâmica)");
    const estimate = estimateOutcome(game, "document", ["founder-marina"], "aerodynamics")!;
    expect(estimate.text).toMatch(/^Acervo de Aerodinâmica \+/);
    game = playUntilDone(game, task.id);
    expect(game.documented.aerodynamics).toBeGreaterThanOrEqual(estimate.min - 1e-9);
    expect(game.documented.aerodynamics).toBeLessThanOrEqual(estimate.max + 1e-9);
    expect(game.documented.structures).toBe(0);
  });

  it("fabricar asa exige balsa no estoque e cria peça com qualidade da fabricação", () => {
    let game = run(newGame({ credits: 1000 }), { type: "start-action", actionId: "build-wing", memberIds: ["founder-caio", "founder-marina"] });
    expect(game.warning?.text).toContain("balsa");
    expect(game.credits).toBe(1000);

    game = { ...game, stock: { balsa: 1 } };

    const estimate = estimateOutcome(game, "build-wing", ["founder-caio", "founder-marina"])!;
    const knowledgeBefore = member(game, "founder-caio").knowledge.structures;
    game = run(game, { type: "start-action", actionId: "build-wing", memberIds: ["founder-caio", "founder-marina"] });
    expect(game.stock.balsa).toBe(0);
    const taskId = lastTask(game).id;
    game = playUntilDone(game, taskId);
    const wing = game.parts.find((part) => part.type === "wing")!;
    expect(wing.condition).toBe(100);
    expect(partState(wing.condition)).toBe("new");
    expect(wing.quality).toBeGreaterThanOrEqual(estimate.min);
    expect(wing.quality).toBeLessThanOrEqual(estimate.max);
    expect(member(game, "founder-caio").fabrication).toBeGreaterThan(20);
    expect(member(game, "founder-caio").knowledge.structures).toBeGreaterThan(knowledgeBefore);
  });

  it("reparo recupera parte da condição da peça alvo", () => {
    let game = newGame({
      credits: 100,
      parts: [{ id: "part-x", type: "wing", label: "Asa", quality: 50, condition: 40 }]
    });
    const estimate = estimateOutcome(game, "repair-part", ["founder-caio", "founder-marina"], "part-x")!;
    game = run(game, { type: "start-action", actionId: "repair-part", targetId: "part-x", memberIds: ["founder-caio", "founder-marina"] });
    const taskId = lastTask(game).id;
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
    let game = run(newGame(), { type: "start-action", actionId: "outreach-social", memberIds: ["founder-marina"] }, { type: "set-speed", speed: 4 });
    game = run(game, { type: "tick", realSeconds: 60 });
    expect(game.clock.speed).toBe(0);
    expect(game.clock.hours - TEST_START_HOURS).toBeLessThan(24);
    expect(game.pause?.reason).toBe("task-done");
    const message = game.inbox.find((item) => item.id === game.pause?.messageId);
    expect(message?.title).toBe("Concluído: Post nas redes");
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

  it("não cai para quem trabalha com energia e cai para quem parou de exaustão", () => {
    let game = newGame();
    game = run(game, { type: "start-action", actionId: "report-chapter", targetId: "aerodynamics", memberIds: ["founder-marina"] });
    game = play(game, 7);
    expect(member(game, "founder-marina").motivation).toBeGreaterThanOrEqual(80);

    // Exausta (energia abaixo do limite), ela para sozinha e a motivação cai.
    game = {
      ...game,
      members: game.members.map((item) => (item.id === "founder-marina" ? { ...item, energy: BALANCE.energy.exhaustedBelow - 5 } : item))
    };
    const before = member(game, "founder-marina").motivation;
    game = play(game, 1);
    expect(member(game, "founder-marina").motivation).toBeLessThan(before);
  });

  it("sobe ao concluir a tarefa", () => {
    let game = run(newGame(), { type: "start-action", actionId: "unload-drill", memberIds: ["founder-marina"] });
    const taskId = lastTask(game).id;
    game = playUntilDone(game, taskId);
    expect(member(game, "founder-marina").motivation).toBe(80 + BALANCE.motivation.completionBoost);
    expect(member(game, "founder-marina").agility).toBeGreaterThan(40);
  });
});

describe("equipe por tarefa (crew)", () => {
  it("recusa alocar acima do máximo físico da ação", () => {
    // Trem de pouso: 1 a 2 pessoas na bancada.
    const stocked = newGame({ credits: 1000, stock: { "carbon-fiber": 1 } });
    let game = run(stocked, { type: "start-action", actionId: "build-gear", memberIds: ["founder-marina", "rookie"] });
    const taskId = lastTask(game).id;
    game = run(game, { type: "assign-member", memberId: "founder-caio", taskId });
    expect(game.tasks[0]!.assignees).toEqual(["founder-marina", "rookie"]);
    expect(member(game, "founder-caio").taskId).toBeNull();
    expect(game.warning?.text).toContain("no máximo 2");
  });

  it("tarefa de organização não tem limite rígido de pessoas", () => {
    const everyone = ["founder-marina", "founder-caio", "founder-bia", "founder-rafa", "rookie"];
    const game = run(newGame(), { type: "start-action", actionId: "outreach-posters", memberIds: everyone });
    expect(lastTask(game).assignees).toHaveLength(5);
  });

  it("não começa abaixo do mínimo nem com gente ocupada: nenhuma tarefa nasce parada", () => {
    const base = newGame();
    const none = run(base, { type: "start-action", actionId: "outreach-freshers", memberIds: ["founder-marina"] });
    expect(none.tasks).toHaveLength(0);
    expect(none.warning?.text).toContain("pelo menos 2");
    const empty = run(base, { type: "start-action", actionId: "raffle" });
    expect(empty.tasks).toHaveLength(0);
    expect(empty.warning?.text).toContain("pelo menos 1");
    const busy = run(base, { type: "start-action", actionId: "raffle", memberIds: ["founder-marina"] });
    const twice = run(busy, { type: "start-action", actionId: "study-aero", memberIds: ["founder-marina"] });
    expect(twice.tasks).toHaveLength(1);
    expect(twice.warning?.text).toContain("já está numa tarefa");
  });

  it("acima do ideal cada pessoa extra rende menos (a de menor rendimento)", () => {
    let game = run(newGame(), { type: "start-action", actionId: "study-aero", memberIds: ["rookie", "founder-marina", "founder-caio"] });
    game = play(game, 1);
    const extra = 2 * 0.9 * BALANCE.crew.extraEfficiency[0]!;
    expect(game.tasks[0]!.hoursDone).toBeCloseTo(2.7 + 2.7 + extra);
    expect(game.tasks[0]!.contributions["rookie"]).toBeCloseTo(extra);
  });

  it("estima a duração antes de iniciar e bate com a simulação", () => {
    const game = newGame();
    const estimate = estimateTaskDays(game, "raffle", ["founder-marina"])!;
    expect(estimateTaskDays(game, "raffle", ["founder-marina", "founder-caio"])!).toBeLessThan(estimate);
    expect(estimateTaskDays(game, "raffle", [])).toBeNull();
    expect(estimateTaskDays(game, "test-flight", ["founder-marina"])).toBeNull();

    const started = run(game, { type: "start-action", actionId: "raffle", memberIds: ["founder-marina"] });
    const taskId = lastTask(started).id;
    expect(estimateRemainingDays(started, taskId)).toBeCloseTo(estimate);
    const done = playUntilDone(started, taskId);
    expect((done.tasks[0]!.doneAt! - done.tasks[0]!.startedAt) / 24).toBeCloseTo(estimate, 1);
  });

});

describe("presidente (aluno)", () => {
  it("trabalha como qualquer aluno: é alocado e gera horas", () => {
    const game = run(newGame(), { type: "start-action", actionId: "raffle", memberIds: ["founder-bia"] });
    expect(member(game, "founder-bia").taskId).toBe(lastTask(game).id);
    expect(game.tasks[0]!.assignees).toEqual(["founder-bia"]);
    expect(memberHoursPerDay(member(game, "founder-bia"), clockToDate(game.clock.hours))).toBeGreaterThan(0);
  });

  it("parado, desmotiva como qualquer aluno", () => {
    const later = play(newGame(), 10);
    expect(member(later, "founder-bia").motivation).toBeLessThan(80);
  });
});

describe("rendimento pela qualidade da equipe", () => {
  const withSkill = (game: GameState, id: string, patch: Partial<Member>): GameState => ({
    ...game,
    members: game.members.map((item) => (item.id === id ? { ...item, ...patch } : item))
  });

  it("equipe melhor rende mais e varia menos", () => {
    const weak = withSkill(newGame(), "founder-marina", { communication: 10 });
    const strong = withSkill(newGame(), "founder-marina", { communication: 90 });
    const low = estimateOutcome(weak, "raffle", ["founder-marina"])!;
    const high = estimateOutcome(strong, "raffle", ["founder-marina"])!;
    expect(high.expected).toBeGreaterThan(low.expected);
    expect((high.max - high.min) / high.expected).toBeLessThan((low.max - low.min) / low.expected);
    expect(low.text).toMatch(/^◆ \d+–\d+$/);
  });

  it("a qualidade é a habilidade ponderada pelas horas e pela motivação", () => {
    const game = withSkill(newGame(), "founder-marina", { communication: 60 });
    const estimate = estimateOutcome(game, "raffle", ["founder-marina"])!;
    expect(estimate.quality).toBeCloseTo(60 * motivationFactor(80));
    // Novato (2 h/dia, comunicação de Marina antes do ajuste) pesa menos que a capitã (3 h/dia, 60).
    const mixed = estimateOutcome(game, "raffle", ["founder-marina", "rookie"])!;
    expect(mixed.quality).toBeCloseTo(((60 * 3 + member(game, "rookie").communication * 2) / 5) * motivationFactor(80));
  });

  it("patrocínio mostra chance e valor; o resultado real é sorteado com rngState", () => {
    const estimate = estimateOutcome(newGame(), "sponsor-pitch", ["founder-marina"])!;
    expect(estimate.chance).toBeGreaterThan(BALANCE.sponsor.chanceAtZero);
    expect(estimate.text).toMatch(/% de chance de ◆/);
  });

  it("sem equipe válida ou sem resultado variável não há estimativa", () => {
    const game = newGame();
    expect(estimateOutcome(game, "raffle", [])).toBeNull();
    expect(estimateOutcome(game, "study-aero", ["founder-marina"])).toBeNull();
    expect(estimateOutcome(game, "document", ["founder-marina"])).toBeNull();
  });

  it("o mesmo seed dá o mesmo resultado; seeds diferentes variam", () => {
    const raffle = (seed: number) => {
      const game = run(withRookie(startedGame({ seed, teamName: "T" })), { type: "start-action", actionId: "raffle", memberIds: ["founder-marina"] });
      return playUntilDone(game, lastTask(game).id).credits;
    };
    expect(raffle(11)).toBe(raffle(11));
    expect(new Set([11, 12, 13, 14, 15].map(raffle)).size).toBeGreaterThan(1);
  });
});

describe("divulgação", () => {
  it("soma alcance pela comunicação de quem divulga, e o alcance esfria com os dias", () => {
    const estimate = estimateOutcome(newGame(), "outreach-posters", ["founder-marina"])!;
    expect(estimate.text).toMatch(/^Alcance \+/);
    let game = run(newGame(), { type: "start-action", actionId: "outreach-posters", memberIds: ["founder-marina"] });
    const taskId = lastTask(game).id;
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
    let game = run(newGame(), { type: "start-action", actionId: "raffle", dedication: "rush", memberIds: ["founder-marina"] });
    expect(lastTask(game)).toMatchObject({ dedication: "rush", hoursTotal: 16 * 0.6 });
    game = run(game, { type: "start-action", actionId: "raffle", memberIds: ["founder-caio"] });
    expect(lastTask(game)).toMatchObject({ dedication: "normal", hoursTotal: 16 });
    game = run(game, { type: "start-action", actionId: "raffle", dedication: "careful", memberIds: ["founder-bia"] });
    expect(lastTask(game).hoursTotal).toBeCloseTo(16 * 1.6);
  });

  it("estimativas comparam as opções: caprichado demora mais e rende melhor", () => {
    const game = newGame();
    const team = ["founder-marina", "founder-caio"];
    const days = DEDICATIONS.map((item) => estimateTaskDays(game, "build-wing", team, item.id)!);
    expect(days[0]!).toBeLessThan(days[1]!);
    expect(days[1]!).toBeLessThan(days[2]!);
    const quality = DEDICATIONS.map((item) => estimateOutcome(game, "build-wing", team, null, item.id)!.quality);
    const normal = estimateOutcome(game, "build-wing", team)!.quality;
    expect(quality).toEqual([normal - 15, normal, normal + 15].map((value) => expect.closeTo(value)));
  });

  it("a qualidade da conclusão usa a dedicação da tarefa", () => {
    const finish = (dedication: "rush" | "careful") => {
      const game = run(newGame(), { type: "start-action", actionId: "raffle", dedication, memberIds: ["founder-marina"] });
      const estimate = estimateOutcome(newGame(), "raffle", ["founder-marina"], null, dedication)!;
      return { credits: playUntilDone(game, lastTask(game).id).credits, estimate };
    };
    for (const dedication of ["rush", "careful"] as const) {
      const { credits, estimate } = finish(dedication);
      expect(credits).toBeGreaterThanOrEqual(Math.floor(estimate.min));
      expect(credits).toBeLessThanOrEqual(Math.ceil(estimate.max));
    }
  });
});
