import { describe, expect, it } from "vitest";
import {
  designFlightModel,
  drawHidden,
  nominalEmptyWeightKg,
  nominalStaticMargin,
  relativeMargins,
  rotationDistanceM
} from "../../src/sim/aircraft";
import {
  applyCommand,
  BALANCE,
  compareDesigns,
  createGame,
  DEFAULT_DESIGN,
  designProblem,
  DESIGN_LIMITS,
  estimatePerformance,
  MASS_ITEMS,
  massBudget,
  missionRequirements,
  spanFactor,
  stabilityEstimate,
  staticMarginStatus,
  surfacesFactor,
  type AircraftDesign,
  type GameState,
  type Part,
  type PartType
} from "../../src/sim";

const PART_TYPES: PartType[] = ["wing", "fuselage", "tail", "landingGear", "powertrain", "electronics"];
const parts = (): Part[] => PART_TYPES.map((type) => ({ id: `p-${type}`, type, label: type, quality: 75, condition: 100 }));
const make = (patch: Partial<AircraftDesign>): AircraftDesign => ({ ...DEFAULT_DESIGN, ...patch });

function hangar(design: AircraftDesign = DEFAULT_DESIGN, seed = 7): GameState {
  return { ...applyCommand(createGame({ seed, teamName: "T" }), { type: "set-design", design }), parts: parts() };
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("prancheta com engenharia de sistemas (S1)", () => {
  it("o projeto padrão é seguro e cabe nos limites; hélice grande demais para o trem baixo é recusada", () => {
    expect(designProblem(DEFAULT_DESIGN)).toBeNull();
    for (const key of Object.keys(DESIGN_LIMITS) as (keyof typeof DESIGN_LIMITS)[]) {
      expect(DEFAULT_DESIGN[key]).toBeGreaterThanOrEqual(DESIGN_LIMITS[key].min);
      expect(DEFAULT_DESIGN[key]).toBeLessThanOrEqual(DESIGN_LIMITS[key].max);
    }
    const game = createGame({ seed: 1, teamName: "T" });
    const big = applyCommand(game, { type: "set-design", design: make({ propDiameterIn: 18 }) });
    expect(big.aircraft).toBeNull();
    expect(big.warning?.text).toContain("bate no chão");
    expect(applyCommand(game, { type: "set-design", design: make({ propDiameterIn: 18, gear: "high" }) }).aircraft).not.toBeNull();
    expect(applyCommand(game, { type: "set-design", design: make({ cgPercentMac: 60 }) }).warning?.text).toContain("CG");
  });

  it("orçamento de massa: sete subsistemas que somam o peso vazio", () => {
    const nominal = massBudget(DEFAULT_DESIGN);
    expect(nominal.items.map((item) => item.id)).toEqual([...MASS_ITEMS]);
    expect(nominal.total.value).toBeCloseTo(nominalEmptyWeightKg(DEFAULT_DESIGN), 9);
    expect(nominal.total.value).toBeGreaterThan(2.8);
    expect(nominal.total.value).toBeLessThan(4);
    // Com a equipe: a soma é o peso vazio de estimatePerformance, valor e margem.
    const state = hangar();
    const team = massBudget(DEFAULT_DESIGN, state);
    const perf = estimatePerformance(state, 1000)!;
    expect(team.total.value).toBeCloseTo(perf.emptyWeightKg.value, 9);
    expect(team.total.margin).toBeCloseTo(perf.emptyWeightKg.margin, 9);
    expect(sum(team.items.map((item) => item.kg.value))).toBeCloseTo(team.total.value, 9);
  });

  it("material, filosofia, N e cauda mexem nos subsistemas certos", () => {
    const kg = (design: AircraftDesign) => Object.fromEntries(massBudget(design).items.map((item) => [item.id, item.kg.value]));
    const base = kg(DEFAULT_DESIGN);
    expect(kg(make({ material: "composite" })).wing).toBeLessThan(base.wing!);
    expect(kg(make({ material: "composite" })).battery).toBe(base.battery);
    expect(kg(make({ surfaces: 1 })).tail).toBe(0);
    expect(kg(make({ surfaces: 3 })).tail).toBeGreaterThan(base.tail!);
    expect(kg(make({ tailVolume: 0.65 })).tail).toBeGreaterThan(base.tail!);
    expect(kg(make({ powerW: 600 })).battery).toBeGreaterThan(base.battery!);
    expect(kg(make({ propDiameterIn: 12 })).powertrain).toBeLessThan(base.powertrain!);
    // Asa fina (corda menor) com a mesma envergadura: longarina mais pesada por m² de asa.
    const narrow = kg(make({ chordM: 0.3 }));
    expect(narrow.wing! / (2.8 * 0.3)).toBeGreaterThan(base.wing! / (2.8 * 0.4));
    expect(kg(make({ philosophy: "payload" })).fuselage).toBeGreaterThan(base.fuselage!);
  });

  it("margem estática: CG atrás e cauda menor reduzem; faixas ok, risco e falha", () => {
    const margin = (design: AircraftDesign) => stabilityEstimate(design).staticMarginPercentMac.value;
    const base = margin(DEFAULT_DESIGN);
    expect(base).toBeGreaterThan(5);
    expect(base).toBeLessThan(20);
    expect(margin(make({ cgPercentMac: 38 }))).toBeLessThan(base);
    expect(margin(make({ tailVolume: 0.35 }))).toBeLessThan(base);
    expect(margin(make({ tailVolume: 0.65 }))).toBeGreaterThan(base);
    expect(stabilityEstimate(DEFAULT_DESIGN).neutralPointPercentMac.value - DEFAULT_DESIGN.cgPercentMac).toBeCloseTo(base, 9);
    expect(staticMarginStatus(12)).toBe("ok");
    expect(staticMarginStatus(3)).toBe("risk");
    expect(staticMarginStatus(25)).toBe("risk");
    expect(staticMarginStatus(-2)).toBe("fail");
    expect(staticMarginStatus(35)).toBe("fail");
    expect(stabilityEstimate(make({ cgPercentMac: 45 })).status).toBe("fail");
    // Asa voadora com o CG do convencional fica no limite: precisa trazer o CG para a frente.
    expect(stabilityEstimate(make({ surfaces: 1 })).status).not.toBe("ok");
    expect(stabilityEstimate(make({ surfaces: 1, cgPercentMac: 22 })).status).toBe("ok");
  });

  it("margem baixa = mais carga e menos estabilidade; instável é risco alto", () => {
    const state = hangar();
    const stable = designFlightModel(state, make({ cgPercentMac: 26 }));
    const loose = designFlightModel(state, make({ cgPercentMac: 36 }));
    expect(loose.liftCapacityKg).toBeGreaterThan(stable.liftCapacityKg);
    expect(loose.stability).toBeLessThan(stable.stability);
    const unstable = designFlightModel(state, make({ cgPercentMac: 45 }));
    expect(unstable.stability).toBeLessThan(0.25);
  });

  it("hélice maior e asa baixa encurtam a corrida; margem excessiva alonga", () => {
    const state = hangar();
    const run = (design: AircraftDesign) => {
      const model = designFlightModel(state, design);
      return rotationDistanceM(model, model.emptyWeightKg + 10, 1000);
    };
    const base = run(DEFAULT_DESIGN);
    expect(run(make({ propDiameterIn: 15 }))).toBeLessThan(base);
    expect(run(make({ wingPosition: "low" }))).toBeLessThan(base);
    expect(run(make({ cgPercentMac: 10, tailVolume: 0.7 }))).toBeGreaterThan(run(make({ cgPercentMac: 25, tailVolume: 0.7 })));
  });

  it("o desvio escondido sorteia cada subsistema e a margem real", () => {
    const { hidden } = drawHidden(12345, DEFAULT_DESIGN);
    expect(Object.keys(hidden.massFactors!).sort()).toEqual([...MASS_ITEMS].sort());
    for (const id of MASS_ITEMS) {
      expect(Math.abs(hidden.massFactors![id]! - 1)).toBeLessThanOrEqual(BALANCE.aircraft.mass.builtSpread);
    }
    expect(Math.abs(hidden.staticMarginOffset!)).toBeLessThanOrEqual(BALANCE.aircraft.staticMarginSpread);
    expect(drawHidden(12345, DEFAULT_DESIGN)).toEqual(drawHidden(12345, DEFAULT_DESIGN));
    // A equipe enxerga a margem real dentro da faixa.
    const state = hangar();
    const real = nominalStaticMargin(DEFAULT_DESIGN) + state.aircraft!.hidden.staticMarginOffset!;
    const seen = stabilityEstimate(DEFAULT_DESIGN, state).staticMarginPercentMac;
    expect(Math.abs(seen.value - real)).toBeLessThanOrEqual(seen.margin);
  });

  it("rascunho diferente do gravado conta só parte dos ensaios", () => {
    const base = hangar();
    const tested = { ...base, aircraft: { ...base.aircraft!, evidence: { emptyWeight: 3, payload: 3, takeoff: 3, stability: 3 } } };
    const saved = relativeMargins(tested);
    const draft = relativeMargins(tested, make({ span: 3.2 }));
    expect(draft.payload).toBeGreaterThan(saved.payload);
    expect(draft.staticMargin).toBeGreaterThan(saved.staticMargin);
  });
});

describe("requisitos da missão e comparação (S1)", () => {
  const ids = ["takeoff-run", "obstacle-clearance", "static-margin", "span", "power", "empty-weight"];

  /** 80 % da carga máxima que a equipe estima: folga para qualquer sorteio escondido. */
  const safeTarget = (state: GameState) => 0.8 * estimatePerformance(state, 1000)!.maxPayloadKg.value;

  it("projeto padrão com folga de carga a Hρ 1000 m atende os requisitos", () => {
    const state = hangar();
    const list = missionRequirements(state, DEFAULT_DESIGN, 1000, safeTarget(state));
    expect(list.map((item) => item.id)).toEqual(ids);
    for (const item of list) expect(item.status).not.toBe("fail");
    const run = list.find((item) => item.id === "takeoff-run")!;
    expect(run.limit.max).toBe(55);
    expect(run.value.value).toBeGreaterThan(15);
    expect(run.value.value).toBeLessThan(55);
  });

  it("envergadura e potência acima do limite falham; carga demais falha a corrida", () => {
    const state = hangar();
    const status = (design: AircraftDesign, payload: number, id: string) =>
      missionRequirements(state, design, 1000, payload).find((item) => item.id === id)!.status;
    expect(status(make({ span: 4.2 }), 10, "span")).toBe("fail");
    expect(status(make({ powerW: 650 }), 10, "power")).toBe("fail");
    expect(status(DEFAULT_DESIGN, 19, "takeoff-run")).toBe("fail");
    expect(status(DEFAULT_DESIGN, 19, "empty-weight")).toBe("fail");
    expect(status(make({ cgPercentMac: 45, tailVolume: 0.3 }), 10, "static-margin")).toBe("fail");
  });

  it("sem carga-alvo usa a carga máxima estimada; funciona antes do primeiro set-design", () => {
    const game = createGame({ seed: 3, teamName: "T" });
    const list = missionRequirements(game, DEFAULT_DESIGN, 1000);
    expect(list.find((item) => item.id === "takeoff-run")!.label).toMatch(/Corrida com \d+,\d kg/);
  });

  it("compara gravado × rascunho: requisitos, massa, multiplicador e nota", () => {
    const state = hangar();
    const draft = make({ span: 3.4 });
    const target = safeTarget(state);
    const result = compareDesigns(state, DEFAULT_DESIGN, draft, 1000, target);
    expect(result.targetPayloadKg).toBe(target);
    expect(result.a.multiplier).toBeCloseTo(surfacesFactor(2) * spanFactor(2.8), 9);
    expect(result.b.multiplier).toBeLessThan(result.a.multiplier);
    expect(result.b.mass.total.value).toBeGreaterThan(result.a.mass.total.value);
    expect(result.a.mass).toEqual(massBudget(DEFAULT_DESIGN, state));
    expect(result.b.maxPayloadKg.value).toBeGreaterThan(result.a.maxPayloadKg.value);
    expect(result.a.flightScore.value).toBeGreaterThan(0);
    // Mais leve com a mesma carga e menor envergadura pontua mais.
    expect(result.a.flightScore.value).toBeGreaterThan(result.b.flightScore.value);
    // Carga que não decola: nota zero.
    expect(compareDesigns(state, DEFAULT_DESIGN, draft, 1000, 19.5).a.flightScore.value).toBe(0);
  });
});
