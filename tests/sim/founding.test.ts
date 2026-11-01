// Fase 6, S2: orientador, fundadores, found-team, agenda do presidente e trainees.

import { describe, expect, it } from "vitest";
import {
  advisorView,
  applyCommand,
  BALANCE,
  createGame,
  dateToHours,
  FOUNDERS,
  formationView,
  presidentView,
  traineeProgress,
  TRAINEE_END,
  type Command,
  type GameState,
  type Member
} from "../../src/sim";
import { completeTask } from "../../src/sim/tasks";
import { awardReputation } from "../../src/sim/season";
import { drawCandidates } from "../../src/sim/selection";
import { foundedGame } from "./helpers";

const run = (state: GameState, ...commands: Command[]): GameState => commands.reduce(applyCommand, state);
const member = (state: GameState, id: string): Member => state.members.find((m) => m.id === id)!;
const at = (state: GameState, hours: number): GameState => ({ ...state, clock: { ...state.clock, hours } });
const utc = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day);

function play(state: GameState, days: number): GameState {
  const target = state.clock.hours + days * 24;
  let next = state;
  for (let guard = 0; guard < 10_000 && next.clock.hours < target - 1e-9; guard += 1) {
    if (next.clock.speed === 0) next = applyCommand(next, { type: "set-speed", speed: 1 });
    next = applyCommand(next, { type: "tick", realSeconds: ((target - next.clock.hours) * 10) / 24 });
  }
  return next;
}

const found = (state: GameState, patch: Partial<Extract<Command, { type: "found-team" }>> = {}): GameState =>
  applyCommand(state, {
    type: "found-team",
    presidentId: "founder-bia",
    captains: { aerodynamics: "founder-marina", structures: "founder-caio" },
    ...patch
  });

describe("estado inicial e fundadores", () => {
  const game = createGame({ seed: 3, teamName: "Aero" });

  it("tem quatro fundadores sem cargo, com cara, agenda, look e conhecimento baixo", () => {
    expect(game.members.map((m) => m.id)).toEqual(FOUNDERS.map((f) => f.id));
    for (const m of game.members) {
      expect(m.role).toBe("member");
      expect(m.area).toBeNull();
      expect(m.flair).toBeDefined();
      expect(m.agenda).toBeDefined();
      expect(m.look.shirt).toBeGreaterThan(0);
      expect(Math.max(...Object.values(m.knowledge))).toBeLessThanOrEqual(20);
    }
    expect(new Set(game.members.map((m) => m.flair)).size).toBe(4);
  });

  it("o orientador começa com reputação baixa e é lido por advisorView", () => {
    expect(game.advisor.reputation).toBe(BALANCE.advisor.startReputation);
    const view = advisorView(game);
    expect(view.title).toBe(`Prof. ${game.advisor.name}`);
    expect(view.reputation).toBe(BALANCE.advisor.startReputation);
    expect(advisorView(createGame({ seed: 3, teamName: "A", advisorName: "Lúcia Rocha" })).title).toBe("Prof. Lúcia Rocha");
    expect(advisorView(awardReputation(game, 5)).reputation).toBe(BALANCE.advisor.startReputation + 5);
    expect(awardReputation({ ...game, advisor: { ...game.advisor, reputation: 99 } }, 5).advisor.reputation).toBe(100);
  });

  it("o relógio fica pausado na abertura até a fundação", () => {
    expect(game.founding).toBe(true);
    expect(presidentView(game)).toBeNull();
    const refused = run(game, { type: "set-speed", speed: 1 });
    expect(refused.clock.speed).toBe(0);
    expect(refused.warning?.text).toContain("fundada");
    expect(run(game, { type: "tick", realSeconds: 30 }).clock.hours).toBe(0);
  });
});

describe("found-team", () => {
  it("define presidente, capitães nas áreas, chaves e nome; libera o relógio", () => {
    const state = found(createGame({ seed: 3, teamName: "Aero" }), {
      captains: { aerodynamics: "founder-marina", structures: "founder-caio", electrical: "founder-rafa" },
      teamName: "  Falcões do Cerrado "
    });
    expect(state.founding).toBe(false);
    expect(state.teamName).toBe("Falcões do Cerrado");
    expect(member(state, "founder-bia").role).toBe("president");
    expect(member(state, "founder-marina")).toMatchObject({ role: "captain", area: "aerodynamics" });
    expect(member(state, "founder-rafa")).toMatchObject({ role: "captain", area: "electrical" });
    expect(state.workshop.keyHolders.sort()).toEqual(["founder-caio", "founder-marina", "founder-rafa"]);
    expect(formationView(state).areas.find((a) => a.discipline === "structures")!.captainId).toBe("founder-caio");
    expect(state.inbox.at(-1)!.title).toContain("fundada");
    expect(run(state, { type: "set-speed", speed: 1 }).clock.speed).toBe(1);
  });

  it("mantém o nome padrão sem teamName e só vale uma vez", () => {
    const state = found(createGame({ seed: 3, teamName: "Aero" }));
    expect(state.teamName).toBe("Aero");
    const again = found(state, { presidentId: "founder-rafa" });
    expect(again.warning?.text).toContain("já foi fundada");
    expect(member(again, "founder-bia").role).toBe("president");
    expect(member(again, "founder-rafa").role).toBe("member");
  });

  it("recusa presidente ou capitão inexistente, cargo duplo, área sem capitão e capitania incompleta", () => {
    const base = createGame({ seed: 3, teamName: "Aero" });
    const refused = (patch: Partial<Extract<Command, { type: "found-team" }>>) => {
      const result = found(base, patch);
      expect(result.founding).toBe(true);
      expect(result.members.every((m) => m.role === "member")).toBe(true);
      return result.warning?.text ?? "";
    };
    expect(refused({ presidentId: "ninguem" })).toContain("presidente");
    expect(refused({ captains: { aerodynamics: "ninguem", structures: "founder-caio" } })).toContain("não encontrado");
    expect(refused({ captains: { aerodynamics: "founder-bia", structures: "founder-caio" } })).toContain("outro cargo");
    expect(refused({ captains: { aerodynamics: "founder-marina", structures: "founder-marina" } })).toContain("outro cargo");
    expect(refused({ captains: { aerodynamics: "founder-marina", structures: "founder-caio", conceptual: "founder-rafa" } })).toContain("não é uma área");
  });

  it("aceita capitães vazios ou parciais: só o presidente é obrigatório", () => {
    const base = createGame({ seed: 3, teamName: "Aero" });
    const empty = found(base, { captains: {} });
    expect(empty.founding).toBe(false);
    expect(empty.members.filter((m) => m.role === "captain")).toHaveLength(0);
    expect(empty.workshop.keyHolders).toEqual([]);
    const partial = found(base, { captains: { electrical: "founder-rafa" } });
    expect(partial.members.filter((m) => m.role === "captain").map((m) => m.id)).toEqual(["founder-rafa"]);
  });
});

describe("presidente e agenda", () => {
  it("presidentView mostra nome, agenda e o mês", () => {
    const state = foundedGame({ seed: 4, teamName: "T" });
    const view = presidentView(state)!;
    expect(view).toMatchObject({ id: "founder-bia", name: state.members.find((m) => m.id === "founder-bia")!.name, agenda: "funding", agendaLabel: "Levantar caixa e gente", status: "none", loggedDays: 0 });
  });

  it("tarefa da agenda concluída dá bônus de motivação à equipe; fora da agenda, não", () => {
    let state = foundedGame({ seed: 4, teamName: "T" });
    state = run(state, { type: "start-action", actionId: "raffle" }, { type: "start-action", actionId: "study-aero" });
    const [raffle, study] = state.tasks;
    const caio = member(state, "founder-caio").motivation;
    const withRaffle = completeTask({ ...state, tasks: state.tasks.map((t) => ({ ...t, hoursDone: t.hoursTotal })) }, raffle!.id).state;
    expect(member(withRaffle, "founder-caio").motivation).toBe(caio + BALANCE.agenda.alignedBoost);
    const withStudy = completeTask(state, study!.id).state;
    expect(member(withStudy, "founder-caio").motivation).toBe(caio);
  });

  it("3 dias seguidos sem tarefa da agenda tiram motivação do presidente; com tarefa, não", () => {
    const idle = play(foundedGame({ seed: 4, teamName: "T" }), 6);
    const view = presidentView(idle)!;
    expect(view.idleStreak).toBeGreaterThanOrEqual(5);
    expect(view.status).toBe("behind");
    // Os dois ficam parados; a diferença é a multa da agenda (a partir do 3º dia).
    expect(member(idle, "founder-rafa").motivation - member(idle, "founder-bia").motivation).toBeGreaterThanOrEqual(2 * BALANCE.agenda.idlePenalty);

    let busy = foundedGame({ seed: 4, teamName: "T" });
    busy = run(busy, { type: "start-action", actionId: "raffle", dedication: "careful" });
    busy = run(busy, { type: "assign-member", memberId: "founder-bia", taskId: busy.tasks[0]!.id });
    busy = play(busy, 4);
    expect(presidentView(busy)!.alignedDays).toBeGreaterThanOrEqual(3);
    expect(presidentView(busy)!.status).toBe("on-track");
    expect(member(busy, "founder-bia").motivation).toBe(80);
  });

  it("agenda equilibrada conta dias com tarefas de pelo menos duas frentes", () => {
    let state = foundedGame({ seed: 4, teamName: "T" });
    state = { ...state, members: state.members.map((m) => (m.id === "founder-bia" ? { ...m, agenda: "balanced" as const } : m)) };
    state = run(state, { type: "start-action", actionId: "study-aero" }, { type: "start-action", actionId: "raffle" });
    state = run(
      state,
      { type: "assign-member", memberId: "founder-marina", taskId: state.tasks[0]!.id },
      { type: "assign-member", memberId: "founder-caio", taskId: state.tasks[1]!.id }
    );
    expect(presidentView(play(state, 2))!.alignedDays).toBeGreaterThanOrEqual(1);
    const single = run(state, { type: "unassign-member", memberId: "founder-caio" });
    expect(presidentView(play(single, 2))!.alignedDays).toBe(0);
  });
});

describe("trainees", () => {
  function withCandidates(state: GameState): GameState {
    return drawCandidates({ ...state, outreach: 40 }, "broad", 3);
  }

  it("quem entra pela seletiva chega como trainee antes de 1/fev e como integrante depois", () => {
    const november = withCandidates(foundedGame({ seed: 6, teamName: "T" }));
    const hired = run(november, { type: "hire-candidate", candidateId: november.candidates[0]!.id }).members.at(-1)!;
    expect(hired.role).toBe("trainee");
    expect(hired.trainingHours).toBe(0);
    expect(traineeProgress(hired)).toBe(0);

    const late = at(november, dateToHours(TRAINEE_END));
    expect(run(late, { type: "hire-candidate", candidateId: late.candidates[0]!.id }).members.at(-1)!.role).toBe("member");
  });

  it("a tarefa de treino exige trainee e dá horas de treino e conhecimento", () => {
    const base = foundedGame({ seed: 6, teamName: "T" });
    const refused = run(base, { type: "start-action", actionId: "trainee-training" });
    expect(refused.tasks).toHaveLength(0);
    expect(refused.warning?.text).toContain("trainees");

    let state = withCandidates(base);
    state = run(state, { type: "hire-candidate", candidateId: state.candidates[0]!.id });
    const trainee = state.members.at(-1)!;
    state = run(state, { type: "start-action", actionId: "trainee-training" });
    const taskId = state.tasks[0]!.id;
    state = run(
      state,
      { type: "assign-member", memberId: trainee.id, taskId },
      { type: "assign-member", memberId: "founder-marina", taskId }
    );
    for (let i = 0; i < 20 && state.tasks[0]!.status !== "done"; i += 1) state = play(state, 1);
    const trained = member(state, trainee.id);
    expect(state.tasks[0]!.status).toBe("done");
    expect(trained.trainingHours).toBeGreaterThan(0);
    expect(traineeProgress(trained)).toBeGreaterThan(0);
    expect(Math.max(...Object.values(trained.knowledge))).toBeGreaterThan(Math.max(...Object.values(trainee.knowledge)));
    expect(trained.role).toBe("trainee");
  });

  it("sem capitão no treino, o trainee aproveita só metade das horas", () => {
    const hoursWith = (captain: boolean): number => {
      let state = withCandidates(foundedGame({ seed: 6, teamName: "T" }));
      state = run(state, { type: "hire-candidate", candidateId: state.candidates[0]!.id });
      const trainee = state.members.at(-1)!;
      state = run(state, { type: "start-action", actionId: "trainee-training" });
      const taskId = state.tasks[0]!.id;
      state = run(state, { type: "assign-member", memberId: trainee.id, taskId }, { type: "assign-member", memberId: captain ? "founder-marina" : "founder-rafa", taskId });
      for (let i = 0; i < 20 && state.tasks[0]!.status !== "done"; i += 1) state = play(state, 1);
      return member(state, trainee.id).trainingHours!;
    };
    expect(hoursWith(false)).toBeCloseTo(hoursWith(true) * BALANCE.trainee.withoutCaptainShare, 1);
  });

  function cohort(count: number, motivation: number, trainingHours: number): GameState {
    const base = foundedGame({ seed: 12, teamName: "T" });
    const trainees: Member[] = Array.from({ length: count }, (_, i) => ({
      ...member(base, "founder-rafa"),
      id: `trainee-${i}`,
      name: `Trainee ${i}`,
      role: "trainee",
      motivation,
      trainingHours,
      taskId: null
    }));
    return at({ ...base, members: [...base.members, ...trainees] }, dateToHours(TRAINEE_END) - 1);
  }

  it("no fim da etapa (1/fev) cada trainee vira integrante ou desiste, pela motivação e pelo treino", () => {
    const stayers = (state: GameState) => state.members.filter((m) => m.id.startsWith("trainee-") && m.role === "member").length;
    const run1 = (state: GameState) => run(state, { type: "set-speed", speed: 1 }, { type: "tick", realSeconds: 1 });

    const keen = run1(cohort(40, 100, BALANCE.trainee.hoursRequired));
    expect(keen.members.some((m) => m.role === "trainee")).toBe(false);
    expect(stayers(keen)).toBeGreaterThan(30);
    expect(keen.inbox.at(-1)!.title).toBe("Fim da etapa trainee");

    const tired = run1(cohort(40, 0, 0));
    expect(tired.members.some((m) => m.role === "trainee")).toBe(false);
    expect(stayers(tired)).toBeLessThan(20);
    // Quem desiste sai da equipe inteira.
    expect(tired.members.length).toBe(4 + stayers(tired));
  });
});

describe("nomes de pessoa", () => {
  it("fundadores, candidatos e trainees têm nome e sobrenome sorteados, sem repetir e sem rótulo de cargo", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const game = createGame({ seed, teamName: "T" });
      const state = drawCandidates({ ...game, outreach: 200 }, "broad", 25);
      const names = [...state.members, ...state.candidates].map((p) => p.name);
      expect(new Set(names).size).toBe(names.length);
      for (const name of names) expect(name).toMatch(/^\p{Lu}\p{L}+ \p{Lu}\p{L}+$/u);
      expect(names.some((n) => /Capit|President|Trainee/.test(n))).toBe(false);
    }
    // Reproduzível pelo seed e diferente entre seeds.
    expect(createGame({ seed: 1, teamName: "T" }).members.map((m) => m.name)).toEqual(createGame({ seed: 1, teamName: "T" }).members.map((m) => m.name));
    expect(createGame({ seed: 1, teamName: "T" }).members.map((m) => m.name)).not.toEqual(createGame({ seed: 2, teamName: "T" }).members.map((m) => m.name));
  });

  it("o orientador tem nome padrão editável na criação", () => {
    expect(createGame({ seed: 1, teamName: "T" }).advisor.name).toBe("Helena Prado");
    expect(createGame({ seed: 1, teamName: "T", advisorName: "Otávio Lins" }).advisor.name).toBe("Otávio Lins");
  });
});
