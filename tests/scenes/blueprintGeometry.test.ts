import { describe, expect, it } from "vitest";
import { blueprintGeometry } from "../../src/scenes/blueprint/geometry";
import { marginBand } from "../../src/scenes/blueprint/margin";
import type { AircraftDesign as BlueprintDesign } from "../../src/sim";
import { DEFAULT_DESIGN, DESIGN_LIMITS } from "../../src/sim";

const make = (patch: Partial<BlueprintDesign>): BlueprintDesign => ({ ...DEFAULT_DESIGN, ...patch });
const roles = (design: BlueprintDesign) => blueprintGeometry(design).surfaces.map((s) => s.role);

describe("geometria do blueprint", () => {
  it("é determinística", () => {
    expect(blueprintGeometry(DEFAULT_DESIGN)).toEqual(blueprintGeometry({ ...DEFAULT_DESIGN }));
  });

  it("a envergadura escala a asa e a cota", () => {
    const small = blueprintGeometry(make({ span: DESIGN_LIMITS.span.min }));
    const big = blueprintGeometry(make({ span: DESIGN_LIMITS.span.max }));
    expect(small.wingspan).toBe(DESIGN_LIMITS.span.min);
    expect(big.surfaces[0]!.span).toBe(DESIGN_LIMITS.span.max);
    expect(big.aspectRatio).toBeGreaterThan(small.aspectRatio);
  });

  it("N escolhe as superfícies: voadora, convencional, canard", () => {
    expect(roles(make({ surfaces: 1 }))).toEqual(["wing"]);
    expect(roles(make({ surfaces: 2 }))).toEqual(["wing", "tail"]);
    expect(roles(make({ surfaces: 3 }))).toEqual(["wing", "canard", "tail"]);
    expect(blueprintGeometry(make({ surfaces: 1 })).surfaces[0]!.sweep).toBeGreaterThan(0);
    expect(blueprintGeometry(make({ surfaces: 2 })).surfaces[0]!.sweep).toBe(0);
    const three = blueprintGeometry(make({ surfaces: 3 })).surfaces;
    expect(three[1]!.x).toBeLessThan(three[0]!.x);
  });

  it("a potência escala motor e hélice", () => {
    const low = blueprintGeometry(make({ powerW: DESIGN_LIMITS.powerW.min }));
    const high = blueprintGeometry(make({ powerW: DESIGN_LIMITS.powerW.max }));
    expect(high.motor.diameter).toBeGreaterThan(low.motor.diameter);
    expect(high.motor.length).toBeGreaterThan(low.motor.length);
  });

  it("trem alto sobe o avião e dá folga à hélice; baixo com potência alta aperta", () => {
    const low = blueprintGeometry(make({ gear: "low", propDiameterIn: 20 }));
    const high = blueprintGeometry(make({ gear: "high", propDiameterIn: 20 }));
    expect(high.gear.height).toBeGreaterThan(low.gear.height);
    expect(high.propClearance).toBeGreaterThan(low.propClearance);
    expect(low.propClearance).toBeLessThan(0);
    expect(high.propClearance).toBeGreaterThan(0);
  });

  it("o material muda a hachura", () => {
    expect(blueprintGeometry(make({ material: "balsa" })).hatch).toBe("ribs");
    expect(blueprintGeometry(make({ material: "composite" })).hatch).toBe("weave");
    expect(blueprintGeometry(make({ material: "mixed" })).hatch).toBe("mixed");
    expect(blueprintGeometry(make({ material: "balsa" })).ribs).toBeGreaterThan(blueprintGeometry(make({ material: "composite" })).ribs);
  });

  it("a filosofia muda a longarina", () => {
    const payload = blueprintGeometry(make({ philosophy: "payload" }));
    const light = blueprintGeometry(make({ philosophy: "light" }));
    const stable = blueprintGeometry(make({ philosophy: "stable" }));
    expect(payload.sparWidth).toBeGreaterThan(stable.sparWidth);
    expect(stable.sparWidth).toBeGreaterThan(light.sparWidth);
  });
});

describe("geometria do blueprint (Fase 5)", () => {
  it("a corda vem de chordM e define o alongamento", () => {
    const narrow = blueprintGeometry(make({ chordM: 0.2 }));
    const wide = blueprintGeometry(make({ chordM: 0.4 }));
    expect(wide.surfaces[0]!.chord).toBeCloseTo(0.4);
    expect(narrow.aspectRatio).toBeGreaterThan(wide.aspectRatio);
  });

  it("asa alta fica acima da baixa na vista frontal", () => {
    const high = blueprintGeometry(make({ wingPosition: "high" }));
    const low = blueprintGeometry(make({ wingPosition: "low" }));
    expect(high.front.wingRootZ).toBeGreaterThan(low.front.wingRootZ);
    expect(high.front.wingTipZ).toBeGreaterThan(high.front.wingRootZ);
  });

  it("a cauda escala com tailVolume", () => {
    const tail = (tailVolume: number) => blueprintGeometry(make({ tailVolume })).surfaces.find((s) => s.role === "tail")!;
    expect(tail(0.7).span).toBeGreaterThan(tail(0.3).span);
  });

  it("o CG anda com cgPercentMac e o ponto neutro fica margem à frente ou atrás dele", () => {
    const forward = blueprintGeometry(make({ cgPercentMac: 15 }));
    const aft = blueprintGeometry(make({ cgPercentMac: 35 }));
    expect(aft.cg.x).toBeGreaterThan(forward.cg.x);
    expect(aft.marginPercentMac).toBeLessThan(forward.marginPercentMac);
    const g = blueprintGeometry(make({}), { neutralPointPercentMac: 40, marginPercentMac: 10 });
    expect(g.neutral.x - g.cg.x).toBeCloseTo(0.1 * g.mac.length);
    const unstable = blueprintGeometry(make({}), { neutralPointPercentMac: 20, marginPercentMac: -5 });
    expect(unstable.neutral.x).toBeLessThan(unstable.cg.x);
  });

  it("o diâmetro da hélice vem de propDiameterIn e a folga acompanha", () => {
    const small = blueprintGeometry(make({ propDiameterIn: 10, gear: "low" }));
    const big = blueprintGeometry(make({ propDiameterIn: 20, gear: "low" }));
    expect(big.front.propDiameter).toBeCloseTo(0.508);
    expect(small.propClearance).toBeGreaterThan(big.propClearance);
  });

  it("a faixa da margem: negativa instável, baixa ou alta em risco", () => {
    expect(marginBand(-1)).toBe("unstable");
    expect(marginBand(2)).toBe("risk");
    expect(marginBand(10)).toBe("ok");
    expect(marginBand(30)).toBe("risk");
  });
});
