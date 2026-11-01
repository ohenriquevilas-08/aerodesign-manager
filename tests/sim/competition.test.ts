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
  createGame,
  currentDensityAltitude,
  densityAltitude,
  MIN_TEAMS_AHEAD_TO_REVISE,
  PLAYER_TEAM_ID,
  REGULAR_2026,
  standings,
  teamsAhead,
  type BatteryResult,
  type GameState
} from "../../src/sim";

const devGame = (seed = 11): GameState => applyCommand(createGame({ seed, teamName: "Equipe Teste" }), { type: "dev-start-competition" });

/** Joga em 4× até a condição, retomando pausas (como quem assiste o replay e segue). */
function playUntil(state: GameState, done: (s: GameState) => boolean, maxTicks = 20_000): GameState {
  let next = state;
  for (let i = 0; i < maxTicks && !done(next); i += 1) {
    if (next.clock.speed === 0) next = applyCommand(next, { type: "set-speed", speed: 4 });
    next = applyCommand(next, { type: "tick", realSeconds: 2 });
  }
  return next;
}

const finished = (s: GameState) => s.competition?.phase === "finished";
const mine = (s: GameState) => s.competition!.results.filter((r) => r.teamId === PLAYER_TEAM_ID);

describe("início da competição", () => {
  it("começa sozinha no marco do calendário, com inspeção e fila da bateria 1", () => {
    const base = createGame({ seed: 4, teamName: "T" });
    const state = step({ ...base, clock: { hours: COMPETITION_START - 0.5, speed: 1 } }, 1);
    expect(state.competition).not.toBeNull();
    expect(state.competition!.phase).toBe("inspection");
    expect(state.competition!.battery).toBe(1);
    expect(state.competition!.queue).toHaveLength(base.rivals.length + 1);
    expect(state.competition!.inspectionIssues[0]).toContain("Sem avião");
    expect(state.inbox.some((m) => m.title.includes("começou"))).toBe(true);
    expect(state.pause).not.toBeNull();
  });

  it("dev-start-competition deixa tudo pronto e o relógio parado antes da primeira decolagem", () => {
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
    expect(inFlightWindow(state.clock.hours)).toBe(false);
    expect(inFlightWindow(state.clock.hours + 0.5)).toBe(true);
    expect(applyCommand(state, { type: "dev-start-competition" }).warning?.text).toContain("já começou");
  });
});

describe("clima e relógio", () => {
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

  it("o clima do estado segue o relógio e o Hρ fica disponível para a UI", () => {
    let state = devGame();
    state = playUntil(state, (s) => s.clock.hours >= COMPETITION_START + 24 + 9);
    expect(currentDensityAltitude(state)).toBeCloseTo(
      densityAltitude(state.competition!.weather.temperatureK, state.competition!.weather.pressureHpa)
    );
  });

  it("nas janelas de voo o relógio anda devagar", () => {
    const state = applyCommand(devGame(), { type: "set-speed", speed: 1 });
    const before = state.clock.hours;
    const after = applyCommand(state, { type: "tick", realSeconds: 5 });
    // 5 s reais em 1×: fora da janela seriam 12 h; na janela, ~0,25 h.
    expect(after.clock.hours - before).toBeLessThan(0.5);
  });
});

describe("baterias", () => {
  it("seu voo pausa o relógio e vira BatteryResult com playback", () => {
    const state = playUntil(devGame(), (s) => mine(s).length > 0);
    expect(state.pause?.reason).toBe("flight");
    const result = mine(state)[0]!;
    expect(result.battery).toBe(1);
    expect(result.playback).not.toBeNull();
    expect(result.playback!.teamName).toBe("Equipe Teste");
    expect(result.playback!.payloadKg).toBe(result.payloadKg);
    expect(result.densityAltitudeM).toBeCloseTo(result.playback!.densityAltitudeM);
    expect(state.inbox.find((m) => m.id === state.pause?.messageId)?.title).toContain("seu voo");
  });

  it("sem carga escolhida, voa com a reta de previsão", () => {
    const state = playUntil(devGame(), (s) => mine(s).length > 0);
    const result = mine(state)[0]!;
    const line = state.report.payloadLine!;
    expect(result.payloadKg).toBeCloseTo(line.a * result.densityAltitudeM + line.b, 6);
  });

  it("revisar a carga só com 3 ou mais equipes à frente (R[10.1.5.3])", () => {
    let state = devGame();
    const ahead = teamsAhead(state)!;
    expect(ahead).toBe(state.competition!.queue.indexOf(PLAYER_TEAM_ID));
    if (ahead >= MIN_TEAMS_AHEAD_TO_REVISE) {
      state = applyCommand(state, { type: "set-battery-payload", payloadKg: 9.5 });
      expect(state.competition!.plannedPayloadKg).toBe(9.5);
    }
    state = playUntil(state, (s) => (teamsAhead(s) ?? 99) < MIN_TEAMS_AHEAD_TO_REVISE);
    if (teamsAhead(state) !== null) {
      const refused = applyCommand(state, { type: "set-battery-payload", payloadKg: 7 });
      expect(refused.competition!.plannedPayloadKg).toBe(state.competition!.plannedPayloadKg);
      expect(refused.warning?.text).toContain("3 equipes");
    }
    expect(applyCommand(state, { type: "set-battery-payload", payloadKg: 25 }).warning?.text).toContain("Carga");
    expect(applyCommand(createGame({ seed: 1, teamName: "T" }), { type: "set-battery-payload", payloadKg: 8 }).warning).not.toBeNull();
  });

  it("joga até o fim: classificação pela Tabela 10.1, placar ordenado e resultado final", () => {
    const state = playUntil(devGame(), finished);
    expect(finished(state)).toBe(true);
    const c = state.competition!;
    expect(c.battery).toBeGreaterThanOrEqual(4);
    // Bateria 4 em diante: no mínimo minTeams classificadas (ou todas, se o campo for menor).
    const byBattery = (b: number) => new Set(c.results.filter((r) => r.battery === b).map((r) => r.teamId)).size;
    expect(byBattery(4)).toBeLessThanOrEqual(byBattery(1));

    const table = standings(state);
    expect(table).toHaveLength(state.rivals.length + 1);
    table.forEach((row, index) => {
      expect(row.position).toBe(index + 1);
      if (index > 0) expect(row.total).toBeLessThanOrEqual(table[index - 1]!.total);
      expect(row.total).toBeCloseTo(row.bestBattery + row.bcf + row.project - row.penalties);
    });
    expect(table[0]!.bestBattery).toBeGreaterThan(100);
    expect(state.inbox.at(-1)?.title).toBe("Resultado final");
    expect(teamsAhead(state)).toBeNull();
  });

  it("playbacks coerentes com o contrato da cena e pontuação só em voo que pousou", () => {
    const results: BatteryResult[] = [];
    for (const seed of [11, 12]) results.push(...playUntil(devGame(seed), finished).competition!.results);
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

  it("o mesmo seed dá a mesma competição", () => {
    const a = playUntil(devGame(21), finished);
    const b = playUntil(devGame(21), finished);
    expect(standings(a)).toEqual(standings(b));
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
    const state = createGame({ seed: 9, teamName: "T" });
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
