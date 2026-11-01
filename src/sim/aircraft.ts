// Projeto da aeronave e desempenho real vs estimado (design §6). Frente: Simulação (Fase 3).

import { nextRandom } from "./rng";
import { warn } from "./tasks";
import type { AircraftDesign, AircraftHidden, GameState, PerformanceEstimate } from "./types";

/** Limites da prancheta (design §6.1). Envergadura acima de maxSpan é permitida e gera PD. */
export const DESIGN_LIMITS = {
  span: { min: 1.5, max: 4.5 },
  powerW: { min: 300, max: 700 }
} as const;

export const DEFAULT_DESIGN: AircraftDesign = {
  span: 2.8,
  surfaces: 2,
  powerW: 550,
  philosophy: "light",
  material: "balsa",
  gear: "low"
};

/**
 * PROVISÓRIO (contrato da Fase 3): desvio uniforme de ±10%. A frente de Simulação troca
 * por um modelo ligado a conhecimento, material e qualidade das peças.
 */
export function drawHidden(rngState: number): { hidden: AircraftHidden; rngState: number } {
  const a = nextRandom(rngState);
  const b = nextRandom(a.state);
  return {
    hidden: { emptyWeightFactor: 0.9 + a.value * 0.2, payloadFactor: 0.9 + b.value * 0.2 },
    rngState: b.state
  };
}

export function setDesign(state: GameState, design: AircraftDesign): GameState {
  const { span, powerW } = DESIGN_LIMITS;
  if (design.span < span.min || design.span > span.max) {
    return warn(state, `Envergadura fora da prancheta (${span.min} a ${span.max} m).`);
  }
  if (design.powerW < powerW.min || design.powerW > powerW.max) {
    return warn(state, `Potência fora da prancheta (${powerW.min} a ${powerW.max} W).`);
  }
  if (state.aircraft) return { ...state, aircraft: { ...state.aircraft, design } };
  const { hidden, rngState } = drawHidden(state.rngState);
  return { ...state, rngState, aircraft: { design, hidden, lateChanges: 0 } };
}

/**
 * O que a equipe acha do avião numa altitude densidade (design §6.2): valor ± margem.
 * null enquanto não há projeto.
 * STUB (contrato da Fase 3): a frente de Simulação implementa.
 */
export function estimatePerformance(state: GameState, densityAltitudeM: number): PerformanceEstimate | null {
  void densityAltitudeM;
  if (!state.aircraft) return null;
  return null;
}
