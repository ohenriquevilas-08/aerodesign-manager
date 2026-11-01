import { describe, expect, it } from "vitest";
import {
  applyTest,
  densityRatio,
  drawHidden,
  installedParts,
  maxPayloadKg,
  missingParts,
  nominalEmptyWeightKg,
  playerFlightModel,
  relativeMargins,
  rotationDistanceM
} from "../../src/sim/aircraft";
import {
  applyCommand,
  createGame,
  dateToHours,
  DEFAULT_DESIGN,
  estimatePerformance,
  type AircraftDesign,
  type GameState,
  type Part,
  type PartType
} from "../../src/sim";

const PART_TYPES: PartType[] = ["wing", "fuselage", "tail", "landingGear", "powertrain", "electronics"];

const part = (type: PartType, patch: Partial<Part> = {}): Part => ({
  id: `p-${type}`,
  type,
  label: type,
  quality: 75,
  condition: 100,
  ...patch
});

function withDesign(design: AircraftDesign = DEFAULT_DESIGN, seed = 7): GameState {
  return applyCommand(createGame({ seed, teamName: "T" }), { type: "set-design", design });
}

const withParts = (state: GameState, parts: Part[] = PART_TYPES.map((type) => part(type))): GameState => ({ ...state, parts });

describe("modelo nominal do avião", () => {
  it("o projeto padrão fica na faixa de uma equipe da Regular", () => {
    expect(nominalEmptyWeightKg(DEFAULT_DESIGN)).toBeGreaterThan(2.8);
    expect(nominalEmptyWeightKg(DEFAULT_DESIGN)).toBeLessThan(3.8);
    const model = playerFlightModel(withParts(withDesign()))!;
    const payload = maxPayloadKg(model, 1000);
    expect(payload).toBeGreaterThan(9);
    expect(payload).toBeLessThan(14);
  });

  it("a carga cai com a altitude densidade, como a reta de previsão (11.6)", () => {
    const model = playerFlightModel(withParts(withDesign()))!;
    const cold = maxPayloadKg(model, 700);
    const hot = maxPayloadKg(model, 1300);
    expect(hot).toBeLessThan(cold);
    // Inclinação plausível: alguns gramas por metro de Hρ.
    const slope = (hot - cold) / 600;
    expect(slope).toBeLessThan(-0.001);
    expect(slope).toBeGreaterThan(-0.005);
    expect(densityRatio(0)).toBe(1);
  });

  it("envergadura dá carga e peso; potência encurta a corrida; vento de proa também", () => {
    const small = playerFlightModel(withParts(withDesign({ ...DEFAULT_DESIGN, span: 2 })))!;
    const big = playerFlightModel(withParts(withDesign({ ...DEFAULT_DESIGN, span: 3.6 })))!;
    expect(big.liftCapacityKg).toBeGreaterThan(small.liftCapacityKg);
    expect(nominalEmptyWeightKg({ ...DEFAULT_DESIGN, span: 3.6 })).toBeGreaterThan(nominalEmptyWeightKg(DEFAULT_DESIGN));
    const weak = playerFlightModel(withParts(withDesign({ ...DEFAULT_DESIGN, powerW: 350 })))!;
    const strong = playerFlightModel(withParts(withDesign({ ...DEFAULT_DESIGN, powerW: 600 })))!;
    expect(rotationDistanceM(strong, 14, 1000)).toBeLessThan(rotationDistanceM(weak, 14, 1000));
    expect(rotationDistanceM(strong, 14, 1000, 3)).toBeLessThan(rotationDistanceM(strong, 14, 1000, 0));
  });

  it("compósito pesa menos no nominal, balsa é a referência", () => {
    expect(nominalEmptyWeightKg({ ...DEFAULT_DESIGN, material: "composite" })).toBeLessThan(nominalEmptyWeightKg(DEFAULT_DESIGN));
  });
});

describe("desvios escondidos", () => {
  const spread = (design: AircraftDesign, key: "emptyWeightFactor" | "payloadFactor") => {
    const values = Array.from({ length: 200 }, (_, seed) => drawHidden(seed * 7919 + 1, design).hidden[key]);
    return Math.max(...values) - Math.min(...values);
  };

  it("compósito varia mais no peso que balsa; apostar em carga varia mais na sustentação", () => {
    expect(spread({ ...DEFAULT_DESIGN, material: "composite" }, "emptyWeightFactor")).toBeGreaterThan(spread(DEFAULT_DESIGN, "emptyWeightFactor"));
    expect(spread({ ...DEFAULT_DESIGN, philosophy: "payload" }, "payloadFactor")).toBeGreaterThan(spread({ ...DEFAULT_DESIGN, philosophy: "stable" }, "payloadFactor"));
  });

  it("peças ruins pesam mais e sustentam menos; motor falsificado perde potência", () => {
    const base = withDesign();
    const good = playerFlightModel(withParts(base))!;
    const bad = playerFlightModel(withParts(base, PART_TYPES.map((type) => part(type, { quality: 35 }))))!;
    expect(bad.emptyWeightKg).toBeGreaterThan(good.emptyWeightKg);
    expect(bad.liftCapacityKg).toBeLessThan(good.liftCapacityKg);
    const fake = playerFlightModel(
      withParts(base, PART_TYPES.map((type) => part(type, type === "powertrain" ? { counterfeit: true } : {})))
    )!;
    expect(fake.powerW).toBeLessThan(good.powerW * 0.85);
    expect(fake.peakPowerW).toBe(good.peakPowerW);
  });

  it("a peça instalada é a de melhor condição que não está quebrada", () => {
    const state = withParts(withDesign(), [
      part("wing", { id: "a", condition: 60 }),
      part("wing", { id: "b", condition: 90 }),
      part("fuselage", { id: "c", condition: 10 })
    ]);
    expect(installedParts(state).wing?.id).toBe("b");
    expect(installedParts(state).fuselage).toBeNull();
    expect(missingParts(state)).toContain("Fuselagem");
    expect(missingParts(withParts(withDesign({ ...DEFAULT_DESIGN, surfaces: 1 }), PART_TYPES.filter((t) => t !== "tail").map((t) => part(t))))).toEqual([]);
  });
});

describe("estimatePerformance", () => {
  it("null sem projeto", () => {
    expect(estimatePerformance(createGame({ seed: 1, teamName: "T" }), 1000)).toBeNull();
  });

  it("o valor real fica dentro da faixa estimada", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const state = withParts(withDesign(DEFAULT_DESIGN, seed));
      const model = playerFlightModel(state)!;
      const estimate = estimatePerformance(state, 900)!;
      const inside = (e: { value: number; margin: number }, real: number) =>
        expect(Math.abs(e.value - real)).toBeLessThanOrEqual(e.margin + 1e-9);
      inside(estimate.emptyWeightKg, model.emptyWeightKg);
      inside(estimate.maxPayloadKg, maxPayloadKg(model, 900));
    }
  });

  it("com margem zero, a estimativa é o real", () => {
    const base = withParts(withDesign());
    const state: GameState = { ...base, aircraft: { ...base.aircraft!, evidence: { emptyWeight: 1e12, payload: 1e12, takeoff: 1e12 } } };
    const model = playerFlightModel(state)!;
    const estimate = estimatePerformance(state, 1000)!;
    expect(estimate.emptyWeightKg.value).toBeCloseTo(model.emptyWeightKg, 6);
    expect(estimate.maxPayloadKg.value).toBeCloseTo(maxPayloadKg(model, 1000), 6);
    expect(estimate.maxPayloadKg.margin).toBeCloseTo(0, 6);
  });

  it("conhecimento estreita a margem; ensaios estreitam mais; balança com avião completo quase zera o peso", () => {
    const base = withParts(withDesign());
    const before = relativeMargins(base);
    const studied = relativeMargins({ ...base, documented: { ...base.documented, structures: 80, aerodynamics: 80, performance: 80 } });
    expect(studied.emptyWeight).toBeLessThan(before.emptyWeight);
    expect(studied.payload).toBeLessThan(before.payload);
    const tested = relativeMargins({ ...base, aircraft: { ...base.aircraft!, evidence: { emptyWeight: 0, payload: 3, takeoff: 0 } } });
    expect(tested.payload).toBeLessThan(studied.payload);
    expect(relativeMargins({ ...base, equipment: ["scale"] }).emptyWeight).toBeLessThan(before.emptyWeight / 5);
  });
});

describe("ensaios", () => {
  it("são recusados sem as peças necessárias", () => {
    const state = applyCommand(withDesign(), { type: "start-action", actionId: "test-structural" });
    expect(state.tasks).toHaveLength(0);
    expect(state.warning?.text).toContain("asa");
    const flight = applyCommand({ ...withDesign(), credits: 100 }, { type: "start-action", actionId: "test-flight" });
    expect(flight.warning?.text).toBe(
      "Avião incompleto para voar. Faltam a asa, a fuselagem, a empenagem, o trem de pouso, o grupo motopropulsor e a eletrônica."
    );
    const noGear = withParts(withDesign(), PART_TYPES.filter((t) => t !== "landingGear").map((t) => part(t)));
    const one = applyCommand({ ...noGear, credits: 100 }, { type: "start-action", actionId: "flight-video" });
    expect(one.warning?.text).toBe("Avião incompleto para voar. Falta o trem de pouso.");
  });

  it("ensaio estrutural soma evidência, cita nos capítulos e desgasta a asa", () => {
    const state = withParts(withDesign());
    const done = applyTest(state, "structural", 100, 1).state;
    expect(done.aircraft!.evidence!.emptyWeight).toBe(1);
    expect(done.report.chapters.structures.testsCited).toBe(1);
    expect(done.report.chapters.loads.testsCited).toBe(1);
    expect(done.parts.find((p) => p.type === "wing")!.condition).toBeLessThan(100);
    expect(relativeMargins(done).emptyWeight).toBeLessThan(relativeMargins(state).emptyWeight);
  });

  it("voo filmado sem incidente vale como vídeo até 27/set e não depois", () => {
    const state = withParts(withDesign());
    expect(applyTest(state, "video", 100, 1).state.aircraft!.flightVideoAt).toBe(0);
    const late = { ...state, clock: { ...state.clock, hours: dateToHours(Date.UTC(2026, 8, 28)) } };
    expect(applyTest(late, "video", 100, 1).state.aircraft!.flightVideoAt).toBeNull();
  });

  it("voo de ensaio com equipe fraca às vezes danifica uma peça (sorteio com rngState)", () => {
    const outcomes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((seed) => {
      const state = withParts(withDesign(DEFAULT_DESIGN, seed));
      return Math.min(...applyTest(state, "flight", 0, 1).state.parts.map((p) => p.condition));
    });
    expect(outcomes.some((c) => c < 80)).toBe(true);
    expect(outcomes.some((c) => c >= 90)).toBe(true);
  });

  it("o ensaio pelo catálogo conclui pela tarefa e ensina pilotagem a quem voou", () => {
    let state: GameState = { ...withParts(withDesign()), credits: 100 };
    state = applyCommand(state, { type: "start-action", actionId: "test-flight" });
    const taskId = state.tasks[0]!.id;
    for (const id of ["captain-aero", "captain-struct"]) state = applyCommand(state, { type: "assign-member", memberId: id, taskId });
    for (let i = 0; i < 200 && state.tasks[0]!.status !== "done"; i += 1) {
      state = applyCommand(applyCommand(state, { type: "set-speed", speed: 4 }), { type: "tick", realSeconds: 10 });
    }
    expect(state.tasks[0]!.status).toBe("done");
    expect(state.aircraft!.evidence!.payload).toBeGreaterThan(0);
    expect(state.members.find((m) => m.id === "captain-aero")!.piloting).toBeGreaterThan(0);
  });
});

describe("prancheta", () => {
  it("mudar o projeto mantém os desvios, perde metade dos ensaios e conta alteração tardia depois de 27/set", () => {
    const base = withDesign();
    const tested: GameState = { ...base, aircraft: { ...base.aircraft!, evidence: { emptyWeight: 2, payload: 2, takeoff: 2 } } };
    const early = applyCommand(tested, { type: "set-design", design: { ...DEFAULT_DESIGN, span: 3 } });
    expect(early.aircraft!.evidence!.payload).toBe(1);
    expect(early.aircraft!.lateChanges).toBe(0);
    expect(early.aircraft!.hidden).toEqual(base.aircraft!.hidden);
    const late = { ...tested, clock: { ...tested.clock, hours: dateToHours(Date.UTC(2026, 9, 1)) } };
    expect(applyCommand(late, { type: "set-design", design: { ...DEFAULT_DESIGN, span: 3 } }).aircraft!.lateChanges).toBe(1);
    expect(applyCommand(late, { type: "set-design", design: DEFAULT_DESIGN })).toBe(late);
  });
});
