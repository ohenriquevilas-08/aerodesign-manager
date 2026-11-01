// Fase 7, S1 a S3 e S5: modo evento, dia da dinâmica da seletiva, dia de ensaio de voo e correções
// do playtest. A competição como evento (S4) fica em competition.test.ts.

import { describe, expect, it } from "vitest";
import {
  AGENDAS,
  applyCommand,
  BALANCE,
  createGame,
  dateToHours,
  DEFAULT_DESIGN,
  deserializeState,
  eventView,
  findAgenda,
  findVenue,
  presidentView,
  serializeState,
  taskEta,
  testHistory,
  type Command,
  type GameState,
  type Part,
  type PartType
} from "../../src/sim";
import { drawCandidates } from "../../src/sim/selection";
import { driveEvent, firstOption, foundedGame, playEvent, startedGame, TEST_START_HOURS } from "./helpers";

const run = (state: GameState, ...commands: Command[]): GameState => commands.reduce(applyCommand, state);
const CREW = ["founder-marina", "founder-caio"];

// ---------------------------------------------------------------------------
// Seletiva (S2)
// ---------------------------------------------------------------------------

/** Faz a seletiva (tarefa) até o fim: divulgação e inscrição, como na Fase 6. */
function runSelection(seed: number, outreach = 60): GameState {
  let game: GameState = { ...foundedGame({ seed, teamName: "T" }), outreach };
  game = run(game, { type: "start-action", actionId: "recruitment", targetId: "broad" });
  const taskId = game.tasks[0]!.id;
  game = run(game, ...CREW.map((memberId): Command => ({ type: "assign-member", memberId, taskId })));
  for (let i = 0; i < 80 && game.tasks[0]!.status !== "done"; i += 1) {
    game = run(game, { type: "set-speed", speed: 1 }, { type: "tick", realSeconds: 10 });
  }
  return game;
}

/** Roda o relógio até a chamada do dia da dinâmica. */
function untilSelectionCall(state: GameState): GameState {
  let game = state;
  for (let i = 0; i < 200 && !game.activeEvent; i += 1) game = run(game, { type: "set-speed", speed: 4 }, { type: "tick", realSeconds: 10 });
  return game;
}

const selectionWith = (min: number) => {
  for (let seed = 1; seed < 40; seed += 1) {
    const game = runSelection(seed);
    if (game.candidates.length >= min) return game;
  }
  throw new Error("sem seed com candidatos suficientes");
};

describe("S2: dia da dinâmica da seletiva", () => {
  it("a seletiva (tarefa) marca o dia da dinâmica para a manhã seguinte", () => {
    const done = selectionWith(1);
    expect(done.selectionDay).not.toBeNull();
    const completedDay = Math.floor(done.clock.hours / 24);
    expect(done.selectionDay!.at).toBe((completedDay + 1) * 24 + BALANCE.selectionDay.startHour);
    expect(done.selectionDay!.format).toBe("broad");
    expect(done.activeEvent).toBeNull();
    expect(done.inbox.at(-1)!.body).toContain("dinâmica");
  });

  it("na hora o relógio pausa e abre a chamada; não há como adiar", () => {
    const called = untilSelectionCall(selectionWith(2));
    expect(called.activeEvent).toMatchObject({ kind: "selection-day", entered: false, day: 1, totalDays: 1 });
    expect(called.selectionDay).toBeNull();
    expect(called.pause?.reason).toBe("selection-day");
    expect(called.clock.speed).toBe(0);
    expect(eventView(called)).toMatchObject({ stage: "call", canAdvance: false });
    expect(applyCommand(called, { type: "advance-event" }).warning?.text).toContain("chamada");
  });

  it("o dia tem os cinco blocos, as decisões e um resumo; o fechamento anota as fichas", () => {
    const base = untilSelectionCall(selectionWith(4));
    const ids = base.activeEvent!.context.kind === "selection-day" ? base.activeEvent!.context.candidateIds : [];
    expect(ids.length).toBeGreaterThanOrEqual(4);
    expect(base.activeEvent!.blocks.map((block) => block.kind)).toEqual(["reception", "presentation", "challenge", "interviews", "deliberation"]);

    const decisions: string[] = [];
    const played = driveEvent(base, {
      pick: (decision) => {
        decisions.push(decision.id);
        return firstOption(decision);
      }
    }).state;
    expect(decisions).toContain("watch-group");
    expect(decisions).toContain("deliberation");
    const summary = played.activeEvent!.summary!;
    expect(summary.title).toContain("dinâmica");
    expect(summary.lines.length).toBeGreaterThan(2);

    const closed = applyCommand(played, { type: "close-event" });
    expect(closed.activeEvent).toBeNull();
    expect(closed.pause?.reason).toBe("manual");
    for (const id of ids) {
      const candidate = closed.candidates.find((item) => item.id === id)!;
      expect(candidate.verdict).toBeDefined();
      expect(candidate.observations!.length).toBeGreaterThan(0);
    }
    expect(closed.candidates.some((candidate) => candidate.verdict === "strong")).toBe(true);
    // Convidar continua sendo hire-candidate.
    const hired = applyCommand(closed, { type: "hire-candidate", candidateId: ids[0]! });
    expect(hired.members).toHaveLength(closed.members.length + 1);
  });

  it("observar um grupo de perto revela mais sobre aqueles candidatos", () => {
    const base = untilSelectionCall(selectionWith(4));
    const context = base.activeEvent!.context;
    if (context.kind !== "selection-day") throw new Error();
    const [first, second] = context.groups;
    const watching = (groupId: string) =>
      driveEvent(base, { pick: (decision) => (decision.id === "watch-group" ? groupId : firstOption(decision)) }).state.activeEvent!.context;
    const watchFirst = watching(first!.id);
    const watchSecond = watching(second!.id);
    if (watchFirst.kind !== "selection-day" || watchSecond.kind !== "selection-day") throw new Error();
    const noteCount = (c: typeof watchFirst, ids: string[]) => ids.reduce((sum, id) => sum + (c.notes[id]?.length ?? 0), 0);
    expect(noteCount(watchFirst, first!.candidateIds)).toBeGreaterThan(noteCount(watchSecond, first!.candidateIds));
    expect(noteCount(watchSecond, second!.candidateIds)).toBeGreaterThan(noteCount(watchFirst, second!.candidateIds));
  });

  it("quem travou ganha uma segunda chance como decisão e a lista segue os capitães ou a sua leitura", () => {
    let seen = false;
    for (let seed = 1; seed < 40 && !seen; seed += 1) {
      const called = untilSelectionCall(runSelection(seed));
      if (!called.activeEvent) continue;
      const asked: string[] = [];
      const played = driveEvent(called, {
        pick: (decision) => {
          asked.push(decision.id);
          return decision.id === "second-chance" ? "yes" : decision.id === "deliberation" ? "mine" : firstOption(decision);
        }
      }).state;
      if (!asked.includes("second-chance")) continue;
      seen = true;
      const context = played.activeEvent!.context;
      if (context.kind !== "selection-day") throw new Error();
      expect(context.secondChance).toBe(true);
      expect(context.followed).toBe("mine");
      expect(context.notes[context.frozeId!]!.join(" ")).toMatch(/segunda chance|travou de novo/);
      expect(context.verdicts[context.yourPick[0]!]).toBe("strong");
    }
    expect(seen).toBe(true);
  });

  it("sem candidatos no dia (todos dispensados) nenhum evento abre", () => {
    const done = selectionWith(1);
    const emptied = applyCommand(done, { type: "dismiss-candidates" });
    let after = emptied;
    for (let i = 0; i < 200 && after.clock.hours <= done.selectionDay!.at + 1; i += 1) after = run(after, { type: "set-speed", speed: 4 }, { type: "tick", realSeconds: 10 });
    expect(after.clock.hours).toBeGreaterThan(done.selectionDay!.at);
    expect(after.activeEvent).toBeNull();
    expect(after.selectionDay).toBeNull();
  });

  it("é determinístico pelo rngState", () => {
    const called = untilSelectionCall(selectionWith(3));
    expect(playEvent(called).candidates).toEqual(playEvent(called).candidates);
  });
});

// ---------------------------------------------------------------------------
// Motor de eventos (S1)
// ---------------------------------------------------------------------------

describe("S1: motor de eventos", () => {
  const base = () => startedGame({ seed: 5, teamName: "T" });

  it("os comandos recusam sem evento aberto", () => {
    for (const type of ["enter-event", "advance-event", "close-event"] as const) {
      expect(applyCommand(base(), { type }).warning).not.toBeNull();
    }
    expect(applyCommand(base(), { type: "decide-event", optionId: "x" }).warning?.text).toContain("decisão");
  });

  it("enter-event é idempotente; advance recusa com decisão pendente; decide valida a opção", () => {
    const called = untilSelectionCall(selectionWith(4));
    const entered = applyCommand(called, { type: "enter-event" });
    expect(entered.activeEvent!.entered).toBe(true);
    expect(applyCommand(entered, { type: "enter-event" })).toBe(entered);
    const asked = driveEvent(called, { stop: (s) => !!s.activeEvent?.pendingDecision }).state;
    expect(eventView(asked)!.decision).not.toBeNull();
    expect(eventView(asked)!.canAdvance).toBe(false);
    expect(applyCommand(asked, { type: "advance-event" }).warning?.text).toContain("decisão");
    expect(applyCommand(asked, { type: "decide-event", optionId: "inexistente" }).warning?.text).toContain("opção");
    expect(applyCommand(asked, { type: "close-event" }).warning?.text).toContain("não acabou");
  });

  it("com o evento aberto o relógio não anda; ao fechar, a gestão volta", () => {
    const called = untilSelectionCall(selectionWith(3));
    const frozen = applyCommand({ ...called, clock: { ...called.clock, speed: 4 } }, { type: "tick", realSeconds: 60 });
    expect(frozen.clock.hours).toBe(called.clock.hours);
    expect(applyCommand(called, { type: "set-speed", speed: 1 }).warning?.text).toContain("evento");
    const closed = playEvent(called);
    expect(closed.activeEvent).toBeNull();
    const resumed = applyCommand(closed, { type: "set-speed", speed: 1 });
    expect(resumed.clock.speed).toBe(1);
    expect(applyCommand(resumed, { type: "tick", realSeconds: 5 }).clock.hours).toBeGreaterThan(closed.clock.hours);
  });

  it("eventView acompanha o dia: blocos feitos, atual e próximos; hora do dia para o céu", () => {
    const called = untilSelectionCall(selectionWith(3));
    const view = eventView(called)!;
    expect(view.blocks.map((block) => block.status)).toEqual(["current", "upcoming", "upcoming", "upcoming", "upcoming"]);
    expect(view.hourOfDay).toBe(9);
    const next = applyCommand(applyCommand(called, { type: "enter-event" }), { type: "advance-event" });
    expect(eventView(next)!.blocks.map((block) => block.status).slice(0, 2)).toEqual(["done", "current"]);
    expect(eventView(next)!.log.length).toBeGreaterThan(0);
    expect(eventView(base())).toBeNull();
  });

  it("o evento sobrevive ao save no meio do dia", () => {
    const called = untilSelectionCall(selectionWith(4));
    const mid = driveEvent(called, { stop: (s) => !!s.activeEvent?.pendingDecision }).state;
    const loaded = deserializeState(serializeState(mid))!;
    expect(loaded).toEqual(mid);
    const finish = (state: GameState) => playEvent(state);
    expect(finish(loaded).candidates).toEqual(finish(mid).candidates);
  });
});

// ---------------------------------------------------------------------------
// Ensaio de voo (S3)
// ---------------------------------------------------------------------------

const TODAY = Math.floor(TEST_START_HOURS / 24);
const F = BALANCE.flightTests;
const PART_TYPES: PartType[] = ["wing", "fuselage", "tail", "landingGear", "powertrain", "electronics"];
const parts = (): Part[] => PART_TYPES.map((type) => ({ id: `p-${type}`, type, label: type, quality: 75, condition: 100 }));

function hangar(seed: number, plan = [6, 8, 9]): GameState {
  const game = run(startedGame({ seed, teamName: "T" }), { type: "set-design", design: DEFAULT_DESIGN });
  const ready = { ...game, parts: parts(), credits: 1000 };
  return applyCommand(ready, {
    type: "schedule-flight-test",
    venueId: "farm",
    day: TODAY + 5,
    pilot: { hired: true },
    crew: ["founder-marina"],
    payloadPlanKg: plan
  });
}

function untilTestCall(state: GameState): GameState {
  let game = state;
  for (let i = 0; i < 400 && !game.activeEvent; i += 1) game = run(game, { type: "set-speed", speed: 4 }, { type: "tick", realSeconds: 5 });
  return game;
}

describe("S3: dia de ensaio de voo", () => {
  it("a chamada vem antes da primeira decolagem e não muda o agendamento", () => {
    const scheduled = hangar(7);
    const test = scheduled.flightTests[0]!;
    expect(test.at).toBe(test.day * 24 + F.startHour);
    const called = untilTestCall(scheduled);
    expect(called.pause?.reason).toBe("flight-test");
    expect(called.clock.hours).toBeCloseTo(test.at - F.callLeadHours, 6);
    expect(called.activeEvent).toMatchObject({ kind: "flight-test", entered: false, venueId: "farm", title: `Ensaio de voo: ${findVenue("farm")!.name}` });
    expect(called.flightTests[0]!.status).toBe("scheduled");
    expect(called.activeEvent!.blocks.map((block) => block.kind)).toEqual(["travel", "assembly", "takeoff", "takeoff", "takeoff", "teardown"]);
  });

  it("nada entra no histórico antes do fechamento; ao fechar, testLog, evidência e conhecimento entram", () => {
    const called = untilTestCall(hangar(7, [5, 7]));
    const midway = driveEvent(called, { stop: (s) => (s.activeEvent?.log.length ?? 0) >= 3 && !s.activeEvent?.pendingDecision }).state;
    expect(midway.testLog).toHaveLength(0);
    expect(midway.flightTests[0]!.status).toBe("scheduled");
    const played = driveEvent(called).state;
    expect(played.activeEvent!.summary).not.toBeNull();
    expect(played.flightTests[0]!.status).toBe("scheduled");
    const closed = applyCommand(played, { type: "close-event" });
    const done = closed.flightTests[0]!;
    expect(done.status).toBe("done");
    expect(done.summary).toBeTruthy();
    expect(done.takeoffs.length).toBeGreaterThan(0);
    expect(closed.testLog.filter((record) => record.flightTestId === done.id)).toHaveLength(done.takeoffs.length);
    expect(testHistory(closed).entries.length).toBeGreaterThan(0);
    expect(closed.aircraft!.evidence!.payload).toBeGreaterThan(0);
    expect(closed.report.chapters.performance.testsCited).toBe(1);
    expect(closed.members.find((m) => m.id === "founder-marina")!.knowledge.performance).toBeGreaterThan(called.members.find((m) => m.id === "founder-marina")!.knowledge.performance);
  });

  it("cada decolagem é um bloco com FlightPlayback do local; o último replay chega pela eventView", () => {
    const called = untilTestCall(hangar(7, [5]));
    const played = driveEvent(called, { stop: (s) => (s.activeEvent?.context.kind === "flight-test" && s.activeEvent.context.takeoffs.length > 0) || !!s.activeEvent?.summary }).state;
    const playback = eventView(played)!.lastPlayback;
    expect(playback).not.toBeNull();
    expect(playback!.venueId).toBe("farm");
    expect(playback!.battery).toBe(1);
  });

  /** Procura uma seed em que a decisão aparece e devolve o estado parado nela. */
  function findDecision(prefix: string, plan?: number[]): { state: GameState; seed: number } {
    for (let seed = 1; seed < 120; seed += 1) {
      const called = untilTestCall(hangar(seed, plan));
      const state = driveEvent(called, { stop: (s) => !!s.activeEvent?.pendingDecision?.id.startsWith(prefix) || !!s.activeEvent?.summary }).state;
      if (state.activeEvent?.pendingDecision?.id.startsWith(prefix)) return { state, seed };
    }
    throw new Error(`sem seed com a decisão ${prefix}`);
  }

  it("rajada de vento antes da decolagem: voar, esperar 30 min ou tirar 1 kg", () => {
    const { state } = findDecision("gust");
    const decision = state.activeEvent!.pendingDecision!;
    expect(decision.options.map((o) => o.id)).toEqual(["fly", "wait", "reduce"]);
    expect(decision.prompt).toContain("m/s de través");
    const context = (s: GameState) => (s.activeEvent!.context.kind === "flight-test" ? s.activeEvent!.context : null)!;

    const flew = applyCommand(state, { type: "decide-event", optionId: "fly" });
    expect(context(flew).pilotPenalty).toBe(F.gustPilotPenalty);

    const waited = applyCommand(state, { type: "decide-event", optionId: "wait" });
    expect(context(waited).delayHours).toBe(0.5);
    expect(waited.members[0]!.motivation).toBeLessThan(state.members[0]!.motivation);

    const reduced = applyCommand(state, { type: "decide-event", optionId: "reduce" });
    expect(context(reduced).payloadCutKg).toBe(1);
    const after = driveEvent(reduced, { stop: (s) => context(s).takeoffs.length > 0 }).state;
    const planned = after.flightTests[0]!.payloadPlanKg[0]!;
    expect(context(after).takeoffs[0]!.payloadKg).toBe(planned - 1);
  });

  it("peça com folga na checagem: trocar gasta caixa e horas; voar assim aumenta o risco", () => {
    const { state } = findDecision("loose-part");
    const id = state.activeEvent!.pendingDecision!.id.split(":")[1]!;
    const before = state.parts.find((p) => p.id === id)!.condition;
    const fixed = applyCommand(state, { type: "decide-event", optionId: "fix" });
    expect(fixed.credits).toBe(state.credits - F.looseFixCredits);
    expect(fixed.parts.find((p) => p.id === id)!.condition).toBeGreaterThan(before - 0.001);
    expect(fixed.members[0]!.motivation).toBeLessThan(state.members[0]!.motivation);
    const asIs = applyCommand(state, { type: "decide-event", optionId: "fly" });
    expect(asIs.credits).toBe(state.credits);
    expect(asIs.activeEvent!.context.kind === "flight-test" && asIs.activeEvent!.context.loosePart).toBe(true);
  });

  it("depois de um dano: encerrar o dia tira as decolagens que faltam", () => {
    const { state } = findDecision("after-damage", [8, 8, 8, 8]);
    const stopped = applyCommand(state, { type: "decide-event", optionId: "stop" });
    expect(stopped.activeEvent!.blocks.at(-1)!.kind).toBe("teardown");
    expect(stopped.activeEvent!.blocks.filter((b) => b.kind === "takeoff").length).toBeLessThan(4);
    const finished = playEvent(stopped);
    expect(finished.flightTests[0]!.takeoffs.length).toBeLessThan(4);
    const kept = playEvent(applyCommand(state, { type: "decide-event", optionId: "go" }));
    expect(kept.flightTests[0]!.takeoffs.length).toBeGreaterThanOrEqual(finished.flightTests[0]!.takeoffs.length);
  });

  it("é determinístico pelo rngState e usa o motor de voo da competição", () => {
    const called = untilTestCall(hangar(11));
    expect(playEvent(called).flightTests).toEqual(playEvent(called).flightTests);
    for (const takeoff of playEvent(called).flightTests[0]!.takeoffs) expect(["valid", "no-takeoff", "tape-break", "landing-out", "damage", "crash"]).toContain(takeoff.outcome);
  });
});

// ---------------------------------------------------------------------------
// Correções do playtest (S5)
// ---------------------------------------------------------------------------

describe("S5: gênero, prioridade do presidente e prazo da tarefa", () => {
  const share = (samples: boolean[]) => samples.filter(Boolean).length / samples.length;

  it("fundadores seguem BALANCE.people.femaleShare numa amostra grande", () => {
    const flags: boolean[] = [];
    for (let seed = 1; seed <= 400; seed += 1) flags.push(...createGame({ seed, teamName: "T" }).members.map((m) => !!m.look.female));
    expect(BALANCE.people.femaleShare).toBe(0.2);
    expect(share(flags)).toBeGreaterThan(0.16);
    expect(share(flags)).toBeLessThan(0.24);
  });

  it("candidatos e trainees seguem a mesma proporção, e o gênero concorda com o nome", () => {
    const flags: boolean[] = [];
    for (let seed = 1; seed <= 120; seed += 1) {
      const game = drawCandidates({ ...foundedGame({ seed, teamName: "T" }), candidates: [] }, "broad", 12);
      flags.push(...game.candidates.map((c) => !!c.look.female));
    }
    expect(share(flags)).toBeGreaterThan(0.16);
    expect(share(flags)).toBeLessThan(0.25);
    const game = createGame({ seed: 77, teamName: "T" });
    const again = createGame({ seed: 77, teamName: "T" });
    expect(game.members.map((m) => [m.name, m.look.female])).toEqual(again.members.map((m) => [m.name, m.look.female]));
  });

  it("os rótulos do presidente são prioridades com o efeito, no conteúdo", () => {
    const flight = findAgenda("flight");
    expect(flight.priority).toBe("Prioridade: fazer o avião voar");
    expect(flight.effect).toBe("tarefas de fabricação e ensaio animam a equipe");
    expect(flight.text).toBe(`${flight.priority} · ${flight.effect}`);
    for (const agenda of AGENDAS) {
      expect(agenda.priority.startsWith("Prioridade: ")).toBe(true);
      expect(agenda.text).toContain(" · ");
    }
    expect(new Set(AGENDAS.map((a) => a.text)).size).toBe(4);
    const game = startedGame({ seed: 3, teamName: "T" });
    expect(presidentView(game)!.priorityText).toBe(findAgenda(game.members.find((m) => m.role === "president")!.agenda!).text);
  });

  it("taskEta devolve prazo, percentual e horas de trabalho que faltam", () => {
    let game = startedGame({ seed: 4, teamName: "T" });
    game = run(game, { type: "start-action", actionId: "study-aero" });
    const task = game.tasks[0]!;
    expect(taskEta(game, "ghost")).toBeNull();
    const idle = taskEta(game, task.id)!;
    expect(idle).toMatchObject({ finishesAt: null, daysLeft: null, percent: 0, workHoursLeft: task.hoursTotal });
    game = run(game, { type: "assign-member", memberId: "founder-marina", taskId: task.id });
    const started = taskEta(game, task.id)!;
    expect(started.finishesAt).toBeGreaterThan(game.clock.hours);
    expect(started.daysLeft).toBeGreaterThanOrEqual(1);
    expect(started.percent).toBe(0);
    for (let i = 0; i < 4; i += 1) game = run(game, { type: "set-speed", speed: 1 }, { type: "tick", realSeconds: 5 });
    const later = taskEta(game, task.id)!;
    if (game.tasks[0]!.status === "active") {
      expect(later.percent).toBeGreaterThan(0);
      expect(later.workHoursLeft).toBeLessThan(task.hoursTotal);
      expect(Math.abs(later.finishesAt! - started.finishesAt!)).toBeLessThan(24);
    }
    const done = { ...game, tasks: game.tasks.map((t) => ({ ...t, status: "done" as const, doneAt: game.clock.hours })) };
    expect(taskEta(done, task.id)).toMatchObject({ daysLeft: 0, percent: 100, workHoursLeft: 0 });
  });

  it("uma compra com prazo prometido mostra o tempo corrido, travado em 99%", () => {
    const base = startedGame({ seed: 4, teamName: "T" });
    const started = run({ ...base, credits: 500 }, { type: "start-action", actionId: "buy-motor" });
    const task = started.tasks.find((t) => t.hoursTotal === 0 && t.status === "waiting");
    if (!task) return;
    expect(taskEta(started, task.id)!.percent).toBe(0);
    const late = { ...started, clock: { ...started.clock, hours: task.expectedReadyAt! + 100 } };
    expect(taskEta(late, task.id)!.percent).toBe(99);
    expect(dateToHours(0)).toBeDefined();
  });
});
