// Engenharia de sistemas da Prancheta (Fase 5, S1; design §6.4–6.6): requisitos da missão e
// comparação de projetos. Só lê o estado; as estimativas saem de aircraft.ts (valor ± margem).

import {
  designFlightModel,
  estimateDesign,
  massBudget,
  relativeMargins,
  rotationDistanceM,
  stabilityEstimate
} from "./aircraft";
import { BALANCE } from "./content/balance";
import { nominalTakeoff, playerUnloadSeconds } from "./competition";
import { REGULAR_2026 } from "./content/regulation2026";
import { estimateReportScore } from "./report";
import { predictedPayload, scoreBattery, spanFactor, surfacesFactor } from "./scoring";
import type {
  AircraftDesign,
  DesignComparison,
  DesignSnapshot,
  Estimate,
  GameState,
  MissionRequirement,
  RequirementStatus
} from "./types";

const R = REGULAR_2026;
const A = BALANCE.aircraft;

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
const fmt = (value: number, digits = 1) => value.toFixed(digits).replace(".", ",");

/** ok: passa no pior caso da margem; risco: passa no valor central; falha: não passa. */
function statusMax(value: Estimate, max: number): RequirementStatus {
  if (value.value + value.margin <= max) return "ok";
  return value.value <= max ? "risk" : "fail";
}

function statusMin(value: Estimate, min: number): RequirementStatus {
  if (value.value - value.margin >= min) return "ok";
  return value.value >= min ? "risk" : "fail";
}

/**
 * Carga-alvo padrão: a da reta de previsão (se já existe), senão a carga máxima estimada
 * do projeto nessa Hρ. A UI troca pela escolha do jogador.
 */
export function defaultTargetPayload(state: GameState, design: AircraftDesign, densityAltitudeM: number): number {
  const line = state.report.payloadLine;
  if (line) return round(Math.max(0, predictedPayload(line, densityAltitudeM)), 1);
  return round(estimateDesign(state, design, densityAltitudeM).maxPayloadKg.value, 1);
}

/**
 * Requisitos da missão para um projeto (gravado ou rascunho) numa Hρ e com uma carga-alvo:
 * corrida ≤ 55 m, folga sobre a fita, margem estática na faixa, envergadura e potência dentro do
 * limite sem penalidade (R[7.2.0.1]) e peso vazio dentro do orçamento (o que sobra da sustentação
 * e dos 20 kg de decolagem, R[7.6.0.1], depois da carga-alvo).
 */
export function missionRequirements(
  state: GameState,
  design: AircraftDesign,
  densityAltitudeM: number,
  targetPayloadKg = defaultTargetPayload(state, design, densityAltitudeM)
): MissionRequirement[] {
  const model = designFlightModel(state, design);
  const perf = estimateDesign(state, design, densityAltitudeM);
  const rel = relativeMargins(state, design);
  const bias = state.aircraft?.hidden.bias?.takeoff ?? 0;

  // Corrida com a carga-alvo: real com a mesma margem relativa e o mesmo viés da estimativa de decolagem.
  const realRun = rotationDistanceM(model, model.emptyWeightKg + targetPayloadKg, densityAltitudeM);
  const runMargin = realRun * rel.takeoff;
  const run: Estimate = { value: Math.max(0, realRun + bias * runMargin * A.biasShare), margin: runMargin };

  // Folga sobre a fita a partir da corrida estimada; a margem vem das pontas da faixa da corrida.
  const clearanceAt = (rotation: number) =>
    nominalTakeoff(model, targetPayloadKg, densityAltitudeM, 0, rotation).obstacleClearanceM ?? -R.obstacleHeight;
  const low = clearanceAt(Math.max(0, run.value - run.margin));
  const high = clearanceAt(run.value + run.margin);
  const clearance: Estimate = { value: clearanceAt(run.value), margin: Math.abs(low - high) / 2 };

  const stability = stabilityEstimate(design, state);
  const [okMin, okMax] = A.staticMarginBands.ok;

  // Orçamento de peso vazio: o que a sustentação estimada e o peso máximo deixam depois da carga-alvo.
  const lift = perf.emptyWeightKg.value + perf.maxPayloadKg.value;
  const budget = Math.min(lift, R.maxTakeoffWeight) - targetPayloadKg;

  return [
    {
      id: "takeoff-run",
      label: `Corrida com ${fmt(targetPayloadKg)} kg`,
      target: `≤ ${R.obstacleDistance} m`,
      limit: { max: R.obstacleDistance },
      value: run,
      unit: "m",
      status: statusMax(run, R.obstacleDistance)
    },
    {
      id: "obstacle-clearance",
      label: "Folga sobre a fita aos 55 m",
      target: "≥ 0 m",
      limit: { min: 0 },
      value: clearance,
      unit: "m",
      status: statusMin(clearance, 0)
    },
    {
      id: "static-margin",
      label: "Margem estática",
      target: `${okMin}–${okMax} % CMA`,
      limit: { min: okMin, max: okMax },
      value: stability.staticMarginPercentMac,
      unit: "% CMA",
      status: stability.status
    },
    {
      id: "span",
      label: "Envergadura sem penalidade",
      target: `≤ ${fmt(R.maxSpan)} m`,
      limit: { max: R.maxSpan },
      value: { value: design.span, margin: 0 },
      unit: "m",
      status: design.span <= R.maxSpan ? "ok" : "fail"
    },
    {
      id: "power",
      label: "Potência de pico sem penalidade",
      target: `≤ ${R.maxPower} W`,
      limit: { max: R.maxPower },
      value: { value: design.powerW, margin: 0 },
      unit: "W",
      status: design.powerW <= R.maxPower ? "ok" : "fail"
    },
    {
      id: "empty-weight",
      label: "Peso vazio no orçamento",
      target: `≤ ${fmt(Math.max(0, budget), 2)} kg`,
      limit: { max: budget },
      value: perf.emptyWeightKg,
      unit: "kg",
      status: statusMax(perf.emptyWeightKg, budget)
    }
  ];
}

/** Retrato de um projeto para o trade-off: requisitos, massa, estabilidade, multiplicador e nota. */
function snapshot(state: GameState, design: AircraftDesign, densityAltitudeM: number, targetPayloadKg: number): DesignSnapshot {
  const perf = estimateDesign(state, design, densityAltitudeM);
  const requirements = missionRequirements(state, design, densityAltitudeM, targetPayloadKg);
  const flies = requirements.every((item) => item.id !== "takeoff-run" || item.status !== "fail") && targetPayloadKg <= perf.maxPayloadKg.value;
  const report = estimateReportScore(state)?.value ?? 0;
  // Nota de uma bateria com a carga-alvo, previsões certeiras e retirada da equipe atual (7.7).
  const score = (emptyWeight: number) =>
    flies
      ? scoreBattery({
          payload: targetPayloadKg,
          emptyWeight,
          predictedEmptyWeight: emptyWeight,
          predictedPayload: targetPayloadKg,
          reportScore: report,
          surfaces: design.surfaces,
          span: design.span,
          peakPower: design.powerW,
          stoppedInside: true,
          unloadSeconds: playerUnloadSeconds(state)
        }).total
      : 0;
  const empty = perf.emptyWeightKg;
  const best = score(Math.max(0.1, empty.value - empty.margin));
  const worst = score(empty.value + empty.margin);
  return {
    design,
    requirements,
    mass: massBudget(design, state),
    stability: stabilityEstimate(design, state),
    multiplier: surfacesFactor(design.surfaces) * spanFactor(design.span),
    maxPayloadKg: perf.maxPayloadKg,
    flightScore: { value: score(empty.value), margin: Math.abs(best - worst) / 2 }
  };
}

/**
 * Compara dois projetos (ex.: gravado × rascunho) na mesma Hρ e carga-alvo. Carga-alvo padrão:
 * a de `defaultTargetPayload` para o projeto `a`.
 */
export function compareDesigns(
  state: GameState,
  a: AircraftDesign,
  b: AircraftDesign,
  densityAltitudeM: number,
  targetPayloadKg = defaultTargetPayload(state, a, densityAltitudeM)
): DesignComparison {
  return {
    densityAltitudeM,
    targetPayloadKg,
    a: snapshot(state, a, densityAltitudeM, targetPayloadKg),
    b: snapshot(state, b, densityAltitudeM, targetPayloadKg)
  };
}
