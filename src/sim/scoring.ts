// Pontuação da Classe Regular 2026 (Regulamento 7.7, 7.2 e Apêndice 4).
// Funções puras; cada uma cita a equação do regulamento.

import { REGULAR_2026 } from "./content/regulation2026";

const R = REGULAR_2026;

/** EE = CP / PV (7.7.1). */
export function structuralEfficiency(payload: number, emptyWeight: number): number {
  return emptyWeight > 0 ? payload / emptyWeight : 0;
}

/** PEE = 50 × EE (7.2). */
export function structuralEfficiencyPoints(ee: number): number {
  return 50 * ee;
}

/** FPV = 1,10 − 15 × ((PVprev − PVreal) / PVprev)², mínimo 0,80 (7.3). */
export function emptyWeightFactor(predicted: number, actual: number): number {
  if (predicted <= 0) return 0.8;
  const error = (predicted - actual) / predicted;
  return Math.max(0.8, 1.1 - 15 * error * error);
}

/** FPR = min(1 ; 0,50 + 0,75 × NR / NRmax) (7.4). */
export function reportFactor(reportScore: number): number {
  return Math.min(1, 0.5 + (0.75 * reportScore) / R.reportMax);
}

/** 0,185N² − 0,775N + 1,81, com N limitado a 1..3 (7.5). */
export function surfacesFactor(surfaces: number): number {
  const n = Math.min(R.maxSurfaces, Math.max(1, Math.round(surfaces)));
  return 0.185 * n * n - 0.775 * n + 1.81;
}

/** 1,15^(−b), b = envergadura em metros (7.5). */
export function spanFactor(span: number): number {
  return Math.pow(1.15, -span);
}

/** PAC = 30 − 830 × |(CPprev − CPreal) / CPprev|^1,75, mínimo 0 (7.6). */
export function payloadAccuracyPoints(predicted: number, actual: number): number {
  if (predicted <= 0) return 0;
  const error = Math.abs((predicted - actual) / predicted);
  return Math.max(0, 30 - 830 * Math.pow(error, 1.75));
}

/** BPO = 2,0 × EE se parou dentro da pista (7.7). */
export function landingBonus(ee: number, stoppedInside: boolean): number {
  return stoppedInside ? 2 * ee : 0;
}

/**
 * BRC (7.8): 20 se t ≤ 20 s; senão max(0 ; 20 − 6,324 × √(t − 20)).
 * O PDF imprime "√t − 20"; √(t − 20) é a única leitura contínua em 20 s e zera em 30 s.
 */
export function unloadBonus(seconds: number): number {
  if (seconds <= 20) return 20;
  return Math.max(0, 20 - 6.324 * Math.sqrt(seconds - 20));
}

/** PD (NC[7.2.0.1]): 100 × excesso de envergadura; +20 se o excesso passar de 5 cm. */
export function spanPenalty(measuredSpan: number): number {
  const excess = Math.max(0, measuredSpan - R.maxSpan);
  return 100 * excess + (excess > 0.05 ? 20 : 0);
}

/** PP (NC[7.2.0.1]): 0,5 × excesso de potência em W. */
export function powerPenalty(peakPower: number): number {
  return 0.5 * Math.max(0, peakPower - R.maxPower);
}

/** BCF = 20 × [1 − (5 × (PB1 − PB2) / PB1)²], mínimo 0 (7.9). */
export function reliabilityBonus(best: number, secondBest: number): number {
  if (best <= 0) return 0;
  const gap = (5 * (best - secondBest)) / best;
  return Math.max(0, 20 * (1 - gap * gap));
}

/** Altitude densidade em metros (Apêndice 4, eq. 4.1). Temperatura em K, pressão em hPa. */
export function densityAltitude(temperatureK: number, pressureHpa: number): number {
  const T0 = 288.15;
  const P0 = 1013.25;
  return (T0 / 0.0065) * (1 - Math.pow(pressureHpa / P0 / (temperatureK / T0), 0.234959));
}

/** Reta de previsão de carga (11.6): carga = a × Hρ + b, com patamar opcional. */
export interface PayloadPrediction {
  a: number;
  b: number;
  cap: number | null;
}

export function predictedPayload(line: PayloadPrediction, densityAltitudeM: number): number {
  const value = line.a * densityAltitudeM + line.b;
  return line.cap === null ? value : Math.min(line.cap, value);
}

export interface BatteryInput {
  payload: number;
  emptyWeight: number;
  predictedEmptyWeight: number;
  predictedPayload: number;
  reportScore: number;
  surfaces: number;
  span: number;
  peakPower: number;
  stoppedInside: boolean;
  unloadSeconds: number;
}

export interface BatteryScore {
  ee: number;
  pee: number;
  fpv: number;
  fpr: number;
  pvoo: number;
  pac: number;
  bpo: number;
  brc: number;
  pd: number;
  pp: number;
  total: number;
  valid: boolean;
}

/**
 * Pontuação de uma bateria com voo concluído (7.7). Decolagem e pouso já
 * validados pela simulação de voo; aqui só entram os números.
 */
export function scoreBattery(input: BatteryInput): BatteryScore {
  const payload = Math.min(input.payload, Math.max(0, R.maxTakeoffWeight - input.emptyWeight));
  const ee = structuralEfficiency(payload, input.emptyWeight);
  const pee = structuralEfficiencyPoints(ee);
  const fpv = emptyWeightFactor(input.predictedEmptyWeight, input.emptyWeight);
  const fpr = reportFactor(input.reportScore);
  const pvoo = fpv * fpr * pee * surfacesFactor(input.surfaces) * spanFactor(input.span);
  const pac = payloadAccuracyPoints(input.predictedPayload, payload);
  const bpo = landingBonus(ee, input.stoppedInside);
  const brc = input.unloadSeconds <= R.maxUnloadSeconds ? unloadBonus(input.unloadSeconds) : 0;
  const pd = spanPenalty(input.span);
  const pp = powerPenalty(input.peakPower);
  const total = pvoo + pac + bpo + brc - pd - pp;
  const valid = payload >= R.minValidPayload && total > 0 && input.unloadSeconds <= R.maxUnloadSeconds;
  return { ee, pee, fpv, fpr, pvoo, pac, bpo, brc, pd, pp, total, valid };
}
