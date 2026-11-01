import { describe, expect, it } from "vitest";
import {
  COMPETITION_START,
  eligibleTeams,
  inFlightWindow,
  resolveFlight,
  rivalProfile,
  weatherAt
} from "../../src/sim/competition";
import { playerFlightModel } from "../../src/sim/aircraft";
import { step } from "../../src/sim/loop";
import {
  applyCommand,
  BALANCE,
  currentDensityAltitude,
  densityAltitude,
  eventView,
  MIN_TEAMS_AHEAD_TO_REVISE,
  PLAYER_TEAM_ID,
  REGULAR_2026,
  standings,
  teamsAhead,
  type BatteryResult,
  type GameState
} from "../../src/sim";
import { driveEvent, firstOption, playEvent, startedGame } from "./helpers";

const devGame = (seed = 11): GameState => applyCommand(startedGame({ seed, teamName: "Equipe Teste" }), { type: "dev-start-competition" });

const finished = (s: GameState) => s.competition?.phase === "finished";
const mine = (s: GameState) => s.competition!.results.filter((r) => r.teamId === PLAYER_TEAM_ID);
/** Joga o evento (decisões na primeira opção) até a condição. */
const play = (state: GameState, stop: (s: GameState) => boolean) => driveEvent(state, { stop }).state;
/** Até o seu primeiro voo. */
const untilFlew = (state: GameState) => play(state, (s) => mine(s).length > 0);

describe("início da competição", () => {
  it("começa sozinha no marco do calendário: o relógio pausa e abre a chamada do evento", () => {
    const base = startedGame({ seed: 4, teamName: "T" });
    const state = step({ ...base, clock: { hours: COMPETITION_START - 0.5, speed: 1 } }, 1);
    expect(state.competition).not.toBeNull();
    expect(state.competition!.phase).toBe("inspection");
    expect(state.competition!.battery).toBe(1);
    expect(state.competition!.queue).toHaveLength(base.rivals.length + 1);
    expect(state.competition!.inspectionIssues[0]).toContain("Sem avião");
    expect(state.inbox.some((m) => m.title.includes("começou"))).toBe(true);
    expect(state.pause?.reason).toBe("competition");
    expect(state.activeEvent).toMatchObject({ kind: "competition", entered: false, day: 1, totalDays: 4 });
    expect(eventView(state)!.stage).toBe("call");
  });

  it("dev-start-competition deixa tudo pronto e abre o evento da competição, relógio parado", () => {
    const state = devGame();
    const c = state.competition!;
    expect(c.phase).toBe("inspection");
    expect(c.inspectionIssues).toEqual([]);
    expect(c.queue).toContain(PLAYER_TEAM_ID);
    expect(state.report.score).toBeGreaterThan(0);
    expect(state.report.oralScore).toBeGreaterThan(0);
    expect(state.report.payloadLine).not.toBeNull();
    expect(state.report.predictedEmptyWeightKg).toBeGreaterThan(0);
    expect(c.projectScores[PLAYER_TEAM_ID]).toBeCloseTo(state.report.score! + state.report.oralScore!);
    expect(state.clock.speed).toBe(0);
    expect(state.activeEvent).toMatchObject({ kind: "competition", entered: false });
    expect(inFlightWindow(COMPETITION_START + 24 + 8)).toBe(true);
    expect(applyCommand(state, { type: "dev-start-competition" }).warning?.text).toContain("já começou");
  });

  it("com o evento aberto o relógio não anda e o set-speed é recusado", () => {
    const state = devGame();
    expect(applyCommand({ ...state, clock: { ...state.clock, speed: 4 } }, { type: "tick", realSeconds: 30 }).clock.hours).toBe(state.clock.hours);
    const refused = applyCommand(state, { type: "set-speed", speed: 1 });
    expect(refused.clock.speed).toBe(0);
    expect(refused.warning?.text).toContain("evento");
  });
});

describe("clima", () => {
  it("manhã fria, tarde quente: o Hρ sobe ao longo do dia (Apêndice 4)", () => {
    const day = COMPETITION_START + 24;
    const hrho = (h: number) => {
      const w = weatherAt(11, day + h);
      return densityAltitude(w.temperatureK, w.pressureHpa);
    };
    expect(hrho(7)).toBeLessThan(hrho(11));
    expect(hrho(11)).toBeLessThan(hrho(15));
    expect(hrho(7)).toBeGreaterThan(400);
    expect(hrho(15)).toBeLessThan(1600);
    expect(weatherAt(11, day + 9)).toEqual(weatherAt(11, day + 9));
  });

  it("o clima do estado segue o evento e o Hρ fica disponível para a UI", () => {
    const state = play(devGame(), (s) => s.clock.hours >= COMPETITION_START + 24 + 9);
    expect(currentDensityAltitude(state)).toBeCloseTo(
      densityAltitude(state.competition!.weather.temperatureK, state.competition!.weather.pressureHpa)
    );
  });
});

describe("baterias no evento", () => {
  it("a carga é uma decisão do bloco quando a bateria abre, e o seu voo vira BatteryResult com playback", () => {
    const asked = play(devGame(), (s) => s.activeEvent?.pendingDecision?.id === "payload");
    const decision = asked.activeEvent!.pendingDecision!;
    expect(decision.options.map((o) => o.id.split(":")[0])).toEqual(["line", "bold", "safe"]);
    expect(applyCommand(asked, { type: "advance-event" }).warning?.text).toContain("decisão");
    const kg = Number(decision.options[0]!.id.split(":")[1]);
    const decided = applyCommand(asked, { type: "decide-event", optionId: decision.options[0]!.id });
    expect(decided.competition!.plannedPayloadKg).toBe(kg);
    expect(decided.competition!.payloadDeclaredFor).toBe(1);

    const state = untilFlew(decided);
    const result = mine(state)[0]!;
    expect(result.battery).toBe(1);
    expect(result.payloadKg).toBe(kg);
    expect(result.playback).not.toBeNull();
    expect(result.playback!.teamName).toBe("Equipe Teste");
    expect(result.densityAltitudeM).toBeCloseTo(result.playback!.densityAltitudeM);
    expect(eventView(state)!.lastPlayback).toEqual(result.playback);
    expect(state.activeEvent!.log.some((entry) => entry.text.includes("Seu voo"))).toBe(true);
  });

  it("revisar a carga continua possível com 3 ou mais equipes à frente (R[10.1.5.3])", () => {
    let state = devGame();
    const ahead = teamsAhead(state)!;
    expect(ahead).toBe(state.competition!.queue.indexOf(PLAYER_TEAM_ID));
    if (ahead >= MIN_TEAMS_AHEAD_TO_REVISE) {
      state = applyCommand(state, { type: "set-battery-payload", payloadKg: 9.5 });
      expect(state.competition!.plannedPayloadKg).toBe(9.5);
    }
    state = play(state, (s) => (teamsAhead(s) ?? 99) < MIN_TEAMS_AHEAD_TO_REVISE && s.competition!.phase === "flights");
    if (teamsAhead(state) !== null) {
      const before = state.competition!.plannedPayloadKg;
      const refused = applyCommand(state, { type: "set-battery-payload", payloadKg: 7 });
      expect(refused.competition!.plannedPayloadKg).toBe(before);
      expect(refused.warning?.text).toContain("3 equipes");
    }
    expect(applyCommand(state, { type: "set-battery-payload", payloadKg: 25 }).warning?.text).toContain("Carga");
    expect(applyCommand(startedGame({ seed: 1, teamName: "T" }), { type: "set-battery-payload", payloadKg: 8 }).warning).not.toBeNull();
  });

  it("uma competição inteira, do começo ao fechamento, com semente fixa", () => {
    const start = devGame(11);
    const view0 = eventView(start)!;
    expect(view0.stage).toBe("call");
    expect(view0.blocks.map((b) => b.kind)).toEqual(["arrival", "exhibition", "inspection", "briefing"]);

    let state = applyCommand(start, { type: "enter-event" });
    expect(eventView(state)!.stage).toBe("running");
    const days: number[] = [state.activeEvent!.day];
    while (!state.activeEvent!.summary) {
      const event = state.activeEvent!;
      const next = event.pendingDecision
        ? applyCommand(state, { type: "decide-event", optionId: firstOption(event.pendingDecision) })
        : applyCommand(state, { type: "advance-event" });
      expect(next).not.toBe(state);
      state = next;
      if (state.activeEvent!.day !== days.at(-1)) days.push(state.activeEvent!.day);
    }
    expect(days).toEqual([1, 2, 3, 4].slice(0, days.length));
    expect(days.length).toBeGreaterThanOrEqual(3);
    expect(finished(state)).toBe(true);
    const summary = state.activeEvent!.summary!;
    expect(summary.title).toContain("Competição");
    expect(summary.points).toBeCloseTo(standings(state).find((r) => r.teamId === PLAYER_TEAM_ID)!.total);
    expect(eventView(state)!.stage).toBe("summary");
    expect(applyCommand(state, { type: "advance-event" }).warning?.text).toContain("feche");

    const closed = applyCommand(state, { type: "close-event" });
    expect(closed.activeEvent).toBeNull();
    expect(closed.pause?.reason).toBe("manual");
    expect(closed.clock.speed).toBe(0);
    expect(closed.clock.hours).toBeGreaterThan(COMPETITION_START + 24);
    expect(closed.advisor.reputation).toBeGreaterThan(state.advisor.reputation);
    expect(closed.inbox.at(-1)?.title).toBe(summary.title);
    expect(applyCommand(closed, { type: "close-event" }).warning).not.toBeNull();

    const c = closed.competition!;
    expect(c.battery).toBeGreaterThanOrEqual(3);
    const byBattery = (b: number) => new Set(c.results.filter((r) => r.battery === b).map((r) => r.teamId)).size;
    expect(byBattery(4)).toBeLessThanOrEqual(byBattery(1));
    const table = standings(closed);
    expect(table).toHaveLength(closed.rivals.length + 1);
    table.forEach((row, index) => {
      expect(row.position).toBe(index + 1);
      if (index > 0) expect(row.total).toBeLessThanOrEqual(table[index - 1]!.total);
      expect(row.total).toBeCloseTo(row.bestBattery + row.bcf + row.project - row.penalties);
    });
    expect(table[0]!.bestBattery).toBeGreaterThan(100);
    expect(teamsAhead(closed)).toBeNull();
    // Depois do fechamento o relógio volta à gestão normalmente.
    expect(applyCommand(closed, { type: "set-speed", speed: 1 }).clock.speed).toBe(1);
  });

  it("o mesmo seed dá a mesma competição", () => {
    const a = playEvent(devGame(21));
    const b = playEvent(devGame(21));
    expect(standings(a)).toEqual(standings(b));
    expect(a.competition!.results).toEqual(b.competition!.results);
  });

  it("playbacks coerentes com o contrato da cena e pontuação só em voo que pousou", () => {
    const results: BatteryResult[] = [];
    for (const seed of [11, 12]) results.push(...playEvent(devGame(seed)).competition!.results);
    const outcomes = new Set(results.map((r) => r.outcome));
    expect(outcomes.has("valid")).toBe(true);
    expect(outcomes.size).toBeGreaterThanOrEqual(3);
    for (const r of results) {
      const scored = r.outcome === "valid" || r.outcome === "landing-out" || r.outcome === "damage";
      expect(r.points !== null).toBe(scored);
      if (r.outcome === "landing-out") expect(r.points!.bpo).toBe(0);
      const p = r.playback;
      if (!p) continue;
      expect(p.outcome).toBe(r.outcome);
      if (p.outcome === "no-takeoff") {
        expect([p.rotationDistanceM, p.obstacleClearanceM, p.stopDistanceM, p.unloadTimeS]).toEqual([null, null, null, null]);
      } else {
        expect(p.rotationDistanceM!).toBeLessThanOrEqual(REGULAR_2026.obstacleDistance);
      }
      if (p.outcome === "tape-break") expect(p.obstacleClearanceM!).toBeLessThan(0);
      if (p.outcome === "crash") {
        expect(p.stopDistanceM).toBeNull();
        expect(p.unloadTimeS).toBeNull();
        expect(p.crashPhase).toBeDefined();
      }
      if (p.outcome === "valid") expect(p.stopDistanceM!).toBeLessThanOrEqual(BALANCE.competition.landingZoneM);
      if (p.outcome === "landing-out") expect(p.stopDistanceM!).toBeGreaterThan(BALANCE.competition.landingZoneM);
    }
    // Só a sua equipe e as rivais de destaque guardam replay.
    expect(results.some((r) => r.playback === null)).toBe(true);
  });
});

describe("inspeção e reparo como decisões", () => {
  const toDecision = (state: GameState) => play(state, (s) => !!s.activeEvent?.pendingDecision);

  it("vídeo faltando: liberação condicional custa pontos; ficar no chão não voa", () => {
    const base = devGame(11);
    const asked = toDecision({ ...base, aircraft: { ...base.aircraft!, flightVideoAt: null } });
    expect(asked.activeEvent!.pendingDecision!.id).toBe("inspect:no-video");
    const waived = applyCommand(asked, { type: "decide-event", optionId: "waive" });
    expect(waived.competition!.waivedIssues).toEqual(["no-video"]);
    expect(waived.competition!.penalties[PLAYER_TEAM_ID]).toBe(BALANCE.competition.event.noVideoPenalty);
    expect(mine(untilFlew(waived)).length).toBeGreaterThan(0);

    const grounded = applyCommand(asked, { type: "decide-event", optionId: "skip" });
    expect(grounded.competition!.penalties[PLAYER_TEAM_ID]).toBe(0);
    expect(mine(playEvent(grounded))).toHaveLength(0);
  });

  it("eletrônica falsificada: comprar a certificada gasta caixa e livra a pendência", () => {
    const base = devGame(11);
    const asked = toDecision({ ...base, parts: base.parts.map((p) => (p.type === "electronics" ? { ...p, counterfeit: true } : p)) });
    expect(asked.activeEvent!.pendingDecision!.id).toBe("inspect:counterfeit");
    const fixed = applyCommand(asked, { type: "decide-event", optionId: "fix" });
    const cost = BALANCE.competition.event.certifiedElectronics.credits;
    expect(fixed.credits).toBe(asked.credits - cost);
    expect(fixed.ledger.at(-1)!.credits).toBe(-cost);
    expect(fixed.parts.some((p) => p.counterfeit)).toBe(false);
    expect(fixed.members[0]!.motivation).toBeLessThan(asked.members[0]!.motivation);
    const poor = applyCommand({ ...asked, credits: 5 }, { type: "decide-event", optionId: "fix" });
    expect(poor.warning?.text).toContain("Caixa");
    expect(poor.activeEvent!.pendingDecision).not.toBeNull();
  });

  it("depois de um voo com dano a equipe decide o reparo", () => {
    let found: GameState | null = null;
    for (let seed = 1; seed < 60 && !found; seed += 1) {
      const state = play(devGame(seed), (s) => s.activeEvent?.pendingDecision?.id === "repair");
      if (state.activeEvent?.pendingDecision?.id === "repair") found = state;
    }
    expect(found).not.toBeNull();
    const damaged = found!.parts.filter((p) => p.condition < 80);
    expect(damaged.length).toBeGreaterThan(0);
    const fixed = applyCommand({ ...found!, credits: 500 }, { type: "decide-event", optionId: "full" });
    for (const part of damaged) expect(fixed.parts.find((p) => p.id === part.id)!.condition).toBeGreaterThanOrEqual(BALANCE.competition.event.repairFull.to);
    expect(fixed.credits).toBe(500 - BALANCE.competition.event.repairFull.credits);
  });
});

describe("voo e rivais", () => {
  const weather = { temperatureK: 295, pressureHpa: 945, headwindMs: 0 };

  it("carga demais não decola antes dos 55 m", () => {
    const model = playerFlightModel(devGame())!;
    const { flight } = resolveFlight(model, 19, weather, 80, 20, 1);
    expect(flight.outcome).toBe("no-takeoff");
    expect(flight.rotationDistanceM).toBeNull();
  });

  it("carga moderada com bom piloto quase sempre é voo válido", () => {
    const model = playerFlightModel(devGame())!;
    const outcomes = Array.from({ length: 40 }, (_, i) => resolveFlight(model, 8, weather, 90, 18, i * 31 + 7).flight.outcome);
    expect(outcomes.filter((o) => o === "valid").length).toBeGreaterThan(30);
  });

  it("rivais de destaque seguem o arquétipo e são determinísticas pelo seed", () => {
    const state = startedGame({ seed: 9, teamName: "T" });
    const team = (archetype: string) => state.rivals.find((r) => r.archetype === archetype)!;
    const strong = rivalProfile(9, team("tradicional"));
    const rookie = rivalProfile(9, team("novata"));
    expect(strong.report).toBeGreaterThan(rookie.report);
    expect(strong.pilot).toBeGreaterThan(rookie.pilot);
    expect(rivalProfile(9, team("tradicional"))).toEqual(strong);
    expect(strong.payloadLine.a).toBeLessThan(0);
  });

  it("da 4ª bateria em diante entra quem tem EE mínima ou está no top 10, com mínimo de equipes", () => {
    const state = devGame();
    const c = state.competition!;
    const result = (teamId: string, ee: number, total: number): BatteryResult => ({
      battery: 1,
      teamId,
      payloadKg: 10,
      densityAltitudeM: 900,
      outcome: "valid",
      points: { ee, pee: 50 * ee, fpv: 1, fpr: 1, pvoo: 0, pac: 0, bpo: 0, brc: 0, pd: 0, pp: 0, total, valid: true },
      playback: null,
      at: 0
    });
    const ids = state.rivals.map((r) => r.id);
    const results = ids.map((id, i) => result(id, i < 5 ? 3 : 1.5, 100 + i));
    const eligible = eligibleTeams(state, { ...c, results }, 4);
    expect(eligible.length).toBe(REGULAR_2026.batteryCutoffs[3]!.minTeams);
    for (const id of ids.slice(0, 5)) expect(eligible).toContain(id);
    expect(eligibleTeams(state, { ...c, results, suspended: { [ids[0]!]: 2 } }, 2)).not.toContain(ids[0]);
  });
});
