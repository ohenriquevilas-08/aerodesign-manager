import { describe, expect, it } from "vitest";
import { blueprintGeometry } from "../../src/scenes/blueprint/geometry";
import { DEFAULT_DESIGN, DESIGN_LIMITS, type AircraftDesign } from "../../src/sim";

const make = (patch: Partial<AircraftDesign>): AircraftDesign => ({ ...DEFAULT_DESIGN, ...patch });
const roles = (design: AircraftDesign) => blueprintGeometry(design).surfaces.map((s) => s.role);

describe("geometria do blueprint", () => {
  it("é determinística", () => {
    expect(blueprintGeometry(DEFAULT_DESIGN)).toEqual(blueprintGeometry({ ...DEFAULT_DESIGN }));
  });

  it("a envergadura escala a asa e a cota", () => {
    const small = blueprintGeometry(make({ span: DESIGN_LIMITS.span.min }));
    const big = blueprintGeometry(make({ span: DESIGN_LIMITS.span.max }));
    expect(small.wingspan).toBe(DESIGN_LIMITS.span.min);
    expect(big.surfaces[0]!.span).toBe(DESIGN_LIMITS.span.max);
    expect(big.surfaces[0]!.chord).toBeGreaterThan(small.surfaces[0]!.chord);
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
    expect(high.prop.diameter).toBeGreaterThan(low.prop.diameter);
  });

  it("trem alto sobe o avião e dá folga à hélice; baixo com potência alta aperta", () => {
    const low = blueprintGeometry(make({ gear: "low", powerW: 700 }));
    const high = blueprintGeometry(make({ gear: "high", powerW: 700 }));
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

  it("a filosofia muda longarina e corda", () => {
    const payload = blueprintGeometry(make({ philosophy: "payload" }));
    const light = blueprintGeometry(make({ philosophy: "light" }));
    const stable = blueprintGeometry(make({ philosophy: "stable" }));
    expect(payload.sparWidth).toBeGreaterThan(stable.sparWidth);
    expect(stable.sparWidth).toBeGreaterThan(light.sparWidth);
    expect(payload.surfaces[0]!.chord).toBeGreaterThan(stable.surfaces[0]!.chord);
    expect(stable.surfaces[0]!.chord).toBeGreaterThan(light.surfaces[0]!.chord);
  });
});
