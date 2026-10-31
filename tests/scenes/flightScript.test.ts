import { describe, expect, it } from "vitest";
import { MOCK_PLAYBACKS } from "../../src/scenes/flight/mockPlaybacks";
import { FLIGHT_RULES, type FlightOutcome } from "../../src/scenes/flight/playback";
import { buildFlightScript } from "../../src/scenes/flight/script";

const outcomes = Object.keys(MOCK_PLAYBACKS) as FlightOutcome[];

function eventTypes(outcome: FlightOutcome) {
  return buildFlightScript(MOCK_PLAYBACKS[outcome]).events.map((event) => event.type);
}

describe("flight script", () => {
  it.each(outcomes)("%s: tempo e poses válidos do começo ao fim", (outcome) => {
    const script = buildFlightScript(MOCK_PLAYBACKS[outcome]);
    expect(script.duration).toBeGreaterThan(3);
    for (let t = 0; t <= script.duration; t += 0.05) {
      const pose = script.sample(t);
      expect(Number.isFinite(pose.x)).toBe(true);
      expect(pose.h).toBeGreaterThanOrEqual(-1e-9);
    }
    const times = script.events.map((event) => event.t);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("roda sai do chão na distância de rotação recebida", () => {
    const script = buildFlightScript(MOCK_PLAYBACKS.valid);
    const rotate = script.events.find((event) => event.type === "rotate")!;
    expect(rotate.x).toBeCloseTo(41.5, 5);
    expect(rotate.h).toBe(0);
  });

  it("passa aos 55 m com a folga recebida sobre o obstáculo", () => {
    const script = buildFlightScript(MOCK_PLAYBACKS.valid);
    const clear = script.events.find((event) => event.type === "obstacle-clear")!;
    expect(clear.x).toBeCloseTo(FLIGHT_RULES.obstacleDistanceM, 5);
    expect(clear.h).toBeCloseTo(FLIGHT_RULES.obstacleHeightM + 1.1, 5);
  });

  it("rompe a fita abaixo de 0,9 m", () => {
    const script = buildFlightScript(MOCK_PLAYBACKS["tape-break"]);
    const tape = script.events.find((event) => event.type === "tape-break")!;
    expect(tape.h).toBeLessThan(FLIGHT_RULES.obstacleHeightM);
    expect(eventTypes("tape-break")).not.toContain("obstacle-clear");
  });

  it("não decolou: para antes do obstáculo e nunca sai do chão", () => {
    const script = buildFlightScript(MOCK_PLAYBACKS["no-takeoff"]);
    for (let t = 0; t <= script.duration; t += 0.05) {
      const pose = script.sample(t);
      expect(pose.h).toBe(0);
      expect(pose.x).toBeLessThan(FLIGHT_RULES.obstacleDistanceM);
    }
    expect(eventTypes("no-takeoff")).toContain("abort");
  });

  it("para na distância recebida a partir do toque", () => {
    for (const outcome of ["valid", "damage", "landing-out"] as const) {
      const script = buildFlightScript(MOCK_PLAYBACKS[outcome]);
      const touchdown = script.events.find((event) => event.type === "touchdown")!;
      const stop = script.events.find((event) => event.type === "stop")!;
      expect(stop.x - touchdown.x).toBeCloseTo(MOCK_PLAYBACKS[outcome].stopDistanceM!, 5);
    }
  });

  it("fim da pista fica depois da parada quando parou dentro e antes quando saiu", () => {
    const inside = buildFlightScript(MOCK_PLAYBACKS.valid);
    const insideStop = inside.events.find((event) => event.type === "stop")!;
    expect(inside.runwayEndM).toBeGreaterThan(insideStop.x);

    const out = buildFlightScript(MOCK_PLAYBACKS["landing-out"]);
    const outStop = out.events.find((event) => event.type === "stop")!;
    expect(out.runwayEndM).toBeLessThan(outStop.x);
    const exit = out.events.find((event) => event.type === "runway-exit")!;
    expect(out.sample(exit.t).x).toBeCloseTo(out.runwayEndM, 3);
  });

  it("retirada dura o tempo recebido e só existe quando há tempo", () => {
    const script = buildFlightScript(MOCK_PLAYBACKS.valid);
    const start = script.events.find((event) => event.type === "unload-start")!;
    const end = script.events.find((event) => event.type === "unload-end")!;
    expect(end.t - start.t).toBeCloseTo(17.6, 5);
    expect(eventTypes("crash")).not.toContain("unload-start");
    expect(eventTypes("tape-break")).not.toContain("unload-start");
  });

  it("queda termina no chão e sem pouso", () => {
    for (const crashPhase of ["climb", "circuit", "approach"] as const) {
      const script = buildFlightScript({ ...MOCK_PLAYBACKS.crash, crashPhase });
      const types = script.events.map((event) => event.type);
      expect(types).toContain("crash-impact");
      expect(types).not.toContain("touchdown");
      expect(script.sample(script.duration).h).toBe(0);
    }
  });
});
