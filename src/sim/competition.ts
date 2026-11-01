// Competição de voo (design §9). Frente: Simulação (Fase 3).
// Começa no marco "competition" do calendário: um dia de exposição e inspeção, depois dias de voo
// com janelas de manhã à tarde. Uma equipe decola a cada slot; a fila de cada bateria é sorteada;
// da 4ª bateria em diante só voa quem se classifica pela Tabela 10.1. O clima segue o relógio
// (manhã fria, tarde quente) e as rivais voam pelas mesmas fórmulas, com aviões gerados pelo arquétipo.

import {
  densityRatio,
  installedParts,
  maxPayloadKg,
  missingPartsText,
  PART_TYPE_LABELS,
  playerFlightModel,
  rotationDistanceM,
  setDesign,
  DEFAULT_DESIGN,
  estimatePerformance,
  requiredParts,
  type FlightModel
} from "./aircraft";
import { BALANCE } from "./content/balance";
import { OFFICIAL_CALENDAR } from "./content/calendar2026";
import { REGULAR_2026 } from "./content/regulation2026";
import { GENERIC_RIVAL, RIVAL_ARCHETYPES, type Range } from "./content/rivals";
import { partState, PART_STATE_LABELS } from "./parts";
import { deliverReport, expectedOralScore, REPORT_DEADLINE } from "./report";
import { recordLedger } from "./ledger";
import { addNews } from "./news";
import { nextRandom } from "./rng";
import { densityAltitude, predictedPayload, reliabilityBonus, scoreBattery } from "./scoring";
import { counterfeitParts } from "./shop";
import { DISCIPLINES } from "./state";
import { addMessage, warn } from "./tasks";
import { canWork, clamp } from "./team";
import { dateToHours } from "./time";
import type {
  BatteryResult,
  CompetitionState,
  CrashPhase,
  FieldWeather,
  FlightOutcome,
  FlightPlayback,
  GameState,
  Part,
  PauseReason,
  RivalTeam,
  Standing
} from "./types";
import { PLAYER_TEAM_ID } from "./types";

const C = BALANCE.competition;

const RIVAL_NEWS: Record<FlightOutcome, string> = {
  valid: "voo válido",
  "no-takeoff": "não decolou",
  "tape-break": "rompeu a fita do obstáculo",
  "landing-out": "pousou fora da pista",
  damage: "pouso duro",
  crash: "caiu"
};
const R = REGULAR_2026;

/** Revisar a carga exige pelo menos este número de equipes à frente na fila (R[10.1.5.3]). */
export const MIN_TEAMS_AHEAD_TO_REVISE = 3;

/** Meia-noite do dia do marco "competition" (horas de jogo). */
export const COMPETITION_START = dateToHours(OFFICIAL_CALENDAR.find((item) => item.id === "competition")!.date);

const SLOT_HOURS = C.slotMinutes / 60;
const lastWindowEnd = () => COMPETITION_START + 24 * C.flightDays + C.windowEndHour;
const firstWindowStart = () => COMPETITION_START + 24 + C.windowStartHour;

/** Está numa janela de voo (dias seguintes ao marco, de windowStartHour a windowEndHour)? */
export function inFlightWindow(hours: number): boolean {
  const day = Math.floor((hours - COMPETITION_START) / 24);
  const hourOfDay = hours - Math.floor(hours / 24) * 24;
  return day >= 1 && day <= C.flightDays && hourOfDay >= C.windowStartHour && hourOfDay < C.windowEndHour;
}

const competing = (state: GameState) => state.competition !== null && state.competition.phase !== "finished";

/**
 * Ritmo do relógio: nas janelas de voo da competição o tempo de jogo anda devagar
 * (BALANCE.competition.realSecondsPerGameHour), para a fila e a escolha de carga serem jogáveis.
 * Devolve o fator sobre o ritmo normal e o próximo instante em que o ritmo pode mudar.
 */
export function clockPace(state: GameState): { factor: number; nextChange: number } {
  if (!competing(state)) return { factor: 1, nextChange: Infinity };
  const hours = state.clock.hours;
  const normalHoursPerSecond = 24 / 10;
  const factor = inFlightWindow(hours) ? 1 / C.realSecondsPerGameHour / normalHoursPerSecond : 1;
  return { factor, nextChange: Math.floor(hours + 1e-9) + 1 };
}

// ---------------------------------------------------------------------------
// Sorteios puros a partir do seed (clima e rivais não guardam estado).
// ---------------------------------------------------------------------------

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** Número em [0, 1) determinado por seed e chaves. */
export function noise(seed: number, ...keys: number[]): number {
  let h = seed >>> 0;
  for (const key of keys) h = Math.imul(h ^ (key >>> 0), 2654435761) >>> 0;
  return nextRandom(nextRandom(h).state).value;
}

const lerp = ([min, max]: Range, u: number) => min + (max - min) * u;

/** Forma diária da temperatura: 0 na hora mais fria, 1 na mais quente. */
function dayShape(hourOfDay: number): number {
  const w = C.weather;
  const rise = w.hottestHour - w.coldestHour;
  const x = hourOfDay < w.coldestHour ? hourOfDay + 24 : hourOfDay;
  if (x <= w.hottestHour) return (1 - Math.cos((Math.PI * (x - w.coldestHour)) / rise)) / 2;
  return (1 + Math.cos((Math.PI * (x - w.hottestHour)) / (24 - rise))) / 2;
}

/** Clima na pista (manhã fria, tarde quente, vento variando), determinístico pelo seed. */
export function weatherAt(seed: number, hours: number): FieldWeather {
  const w = C.weather;
  const day = Math.floor(hours / 24);
  const shape = dayShape(hours - day * 24);
  const temperatureK = w.minTempK + (w.maxTempK - w.minTempK) * shape + w.dailyTempSpread * (2 * noise(seed, 1, day) - 1);
  const pressureHpa = w.pressureHpa + w.pressureSpread * (2 * noise(seed, 2, day) - 1);
  const k = Math.floor(hours);
  const n0 = 2 * noise(seed, 3, k) - 1;
  const n1 = 2 * noise(seed, 3, k + 1) - 1;
  const headwindMs = w.windMean + w.windSpread * (n0 + (n1 - n0) * (hours - k)) + w.afternoonWind * shape;
  return { temperatureK, pressureHpa, headwindMs };
}

/** Altitude densidade agora na pista (Apêndice 4); null fora da competição. */
export function currentDensityAltitude(state: GameState): number | null {
  const weather = state.competition?.weather;
  return weather ? densityAltitude(weather.temperatureK, weather.pressureHpa) : null;
}

// ---------------------------------------------------------------------------
// Rivais
// ---------------------------------------------------------------------------

export interface RivalProfile {
  model: FlightModel;
  predictedEmptyWeightKg: number;
  payloadLine: { a: number; b: number; cap: number | null };
  report: number;
  oral: number;
  pilot: number;
  aggressiveness: number;
  unloadSeconds: number;
}

/** Corrida-limite que as equipes usam para planejar: ainda sobra chão para subir até 0,9 m aos 55 m. */
const PLANNING_ROTATION_M = 45;

/** Carga que a equipe conhece do próprio avião: a menor entre sustentação e decolagem. */
function knownPayload(model: FlightModel, densityAltitudeM: number): number {
  const t = BALANCE.aircraft.takeoff;
  const sigma = densityRatio(densityAltitudeM);
  const takeoffMass = Math.sqrt((PLANNING_ROTATION_M * sigma * sigma * model.span * model.powerW * model.liftFactor) / (t.k * (t.gearFactor[model.gear] ?? 1)));
  return Math.max(0, Math.min(maxPayloadKg(model, densityAltitudeM), takeoffMass - model.emptyWeightKg));
}

/** Avião e notas de uma rival, gerados pelo arquétipo (RivalTeam.archetype) e pelo seed. */
export function rivalProfile(seed: number, team: RivalTeam): RivalProfile {
  const arch = (team.archetype && RIVAL_ARCHETYPES[team.archetype]) || GENERIC_RIVAL;
  const base = hashString(team.id);
  let i = 0;
  const u = () => noise(seed, base, 100 + i++);
  const span = lerp(arch.span, u());
  const emptyWeightKg = lerp(arch.emptyWeightKg, u());
  const ee = lerp(arch.ee, u());
  const lift = (BALANCE.aircraft.lift.surfaces[arch.surfaces] ?? 1) * 1;
  const model: FlightModel = {
    emptyWeightKg,
    liftCapacityKg: (emptyWeightKg * (1 + ee)) / densityRatio(1000),
    span,
    surfaces: arch.surfaces,
    powerW: Math.min(R.maxPower, lerp(arch.powerW, u())),
    peakPowerW: 0,
    liftFactor: lift,
    gear: "low",
    stability: lerp(arch.stability, u()),
    condition: 100
  };
  model.peakPowerW = model.powerW;
  const error = lerp(arch.predictionError, u());
  const miss = () => 1 + error * (2 * u() - 1);
  const cold = knownPayload(model, 700) * miss();
  const hot = knownPayload(model, 1300) * miss();
  const a = (hot - cold) / 600;
  return {
    model,
    predictedEmptyWeightKg: emptyWeightKg * miss(),
    payloadLine: { a, b: cold - a * 700, cap: null },
    report: lerp(arch.report, u()),
    oral: lerp(arch.oral, u()),
    pilot: lerp(arch.pilot, u()),
    aggressiveness: lerp(arch.aggressiveness, u()),
    unloadSeconds: lerp(arch.unloadSeconds, u())
  };
}

// ---------------------------------------------------------------------------
// Voo
// ---------------------------------------------------------------------------

export interface FlightResolution {
  outcome: FlightOutcome;
  rotationDistanceM: number | null;
  obstacleClearanceM: number | null;
  stopDistanceM: number | null;
  unloadTimeS: number | null;
  crashPhase?: CrashPhase;
}

/** Risco relativo de incidente: piloto, estabilidade do avião e condição das peças (1 ≈ equipe mediana). */
export function flightRisk(pilot: number, stability: number, condition: number): number {
  return 3 * (1.2 - clamp(pilot) / 100) * (1.4 - clamp(stability, 0, 1)) * (1 + (100 - clamp(condition)) / 100);
}

/**
 * Resolve uma decolagem com a carga escolhida (design §9.4): corrida até 55 m (R[7.8.0.1]),
 * fita do obstáculo de 0,9 m, circuito, pouso e retirada. Física simplificada; sorteios com rngState.
 */
export function resolveFlight(
  model: FlightModel,
  payloadKg: number,
  weather: FieldWeather,
  pilot: number,
  unloadSeconds: number,
  rngState: number
): { flight: FlightResolution; rngState: number } {
  let rng = rngState;
  const roll = () => {
    const r = nextRandom(rng);
    rng = r.state;
    return r.value;
  };
  const signed = () => 2 * roll() - 1;
  const hrho = densityAltitude(weather.temperatureK, weather.pressureHpa);
  const mass = model.emptyWeightKg + payloadKg;
  const rotation = rotationDistanceM(model, mass, hrho, weather.headwindMs) * (1 + C.rotationNoise * signed());
  const none = { rotationDistanceM: null, obstacleClearanceM: null, stopDistanceM: null, unloadTimeS: null };
  if (rotation > R.obstacleDistance) return { flight: { outcome: "no-takeoff", ...none }, rngState: rng };

  const overload = mass / (model.liftCapacityKg * densityRatio(hrho));
  const gradient = C.climbBase + C.climbGain * (1 - rotation / R.obstacleDistance);
  const height = (R.obstacleDistance - rotation) * gradient * (overload > 1 ? Math.max(0, 2 - overload) : 1);
  const clearance = height - R.obstacleHeight + C.clearanceNoise * signed();
  const risk = flightRisk(pilot, model.stability, model.condition) * (overload > 0.95 ? 1.5 : 1);
  const stall = overload > 1 ? C.stallPerExcess * (overload - 1) : 0;
  const stop = Math.max(8, C.stopBase + C.stopPerKg * mass - C.stopPerHeadwind * weather.headwindMs + C.stopNoise * signed());
  const unload = Math.max(8, unloadSeconds + C.unloadNoise * signed());

  if (roll() < C.crashChance * risk + stall) {
    const phases: CrashPhase[] = ["climb", "circuit", "approach"];
    const crashPhase = overload > 1 ? "climb" : phases[Math.floor(roll() * phases.length)]!;
    return { flight: { outcome: "crash", rotationDistanceM: rotation, obstacleClearanceM: clearance, stopDistanceM: null, unloadTimeS: null, crashPhase }, rngState: rng };
  }
  const flown = { rotationDistanceM: rotation, obstacleClearanceM: clearance };
  if (clearance < 0) return { flight: { outcome: "tape-break", ...flown, stopDistanceM: stop, unloadTimeS: null }, rngState: rng };
  if (roll() < C.damageChance * risk) {
    return { flight: { outcome: "damage", ...flown, stopDistanceM: stop * 0.6, unloadTimeS: unload }, rngState: rng };
  }
  const tailwind = weather.headwindMs < 0 ? 1.5 : 1;
  if (stop > C.landingZoneM || roll() < C.landingOutChance * risk * tailwind) {
    const out = Math.max(stop, C.landingZoneM + 3 + 17 * roll());
    return { flight: { outcome: "landing-out", ...flown, stopDistanceM: out, unloadTimeS: unload }, rngState: rng };
  }
  return { flight: { outcome: "valid", ...flown, stopDistanceM: stop, unloadTimeS: unload }, rngState: rng };
}

const SCORED: ReadonlySet<FlightOutcome> = new Set(["valid", "landing-out", "damage"]);

// ---------------------------------------------------------------------------
// Inspeção, fila e baterias
// ---------------------------------------------------------------------------

/** Pendências da inspeção de segurança (design §9.2) e do cadastro da CT. */
export function inspectionIssues(state: GameState): string[] {
  if (!state.aircraft) return ["Sem avião: a equipe não tem projeto aprovado."];
  const issues: string[] = [];
  const missing = missingPartsText(state);
  if (missing) issues.push(`Avião incompleto. ${missing}`);
  if (state.aircraft.flightVideoAt == null) issues.push("Sem vídeo de voo válido (27/set): a CT não libera o voo.");
  const electronics = installedParts(state).electronics;
  if (electronics?.counterfeit) issues.push(`${electronics.label} sem certificação de fábrica (falsificados): troque antes de voar.`);
  return issues;
}

const teamName = (state: GameState, id: string) =>
  id === PLAYER_TEAM_ID ? state.teamName : (state.rivals.find((team) => team.id === id)?.name ?? id);

/** Melhor EE em voo válido de uma equipe até agora. */
function bestValidEE(results: readonly BatteryResult[], teamId: string): number {
  return Math.max(0, ...results.filter((r) => r.teamId === teamId && r.points?.valid).map((r) => r.points!.ee));
}

/** Quem voa a bateria (Tabela 10.1): 1–3 abertas; depois EE mínima ou top 10, com mínimo de equipes. */
export function eligibleTeams(state: GameState, competition: CompetitionState, battery: number): string[] {
  const all = [PLAYER_TEAM_ID, ...state.rivals.map((team) => team.id)];
  const suspended = competition.suspended ?? {};
  const open = all.filter((id) => suspended[id] !== battery);
  const cutoff = R.batteryCutoffs[Math.min(battery, R.batteryCutoffs.length) - 1]!;
  if (cutoff.minEE === null) return open;
  const table = standings({ ...state, competition });
  const top = new Set(table.slice(0, cutoff.topPositions ?? 0).map((row) => row.teamId));
  const chosen = new Set(open.filter((id) => top.has(id) || bestValidEE(competition.results, id) >= cutoff.minEE!));
  for (const row of table) {
    if (chosen.size >= (cutoff.minTeams ?? 0)) break;
    if (open.includes(row.teamId)) chosen.add(row.teamId);
  }
  return open.filter((id) => chosen.has(id));
}

function shuffle(ids: string[], rngState: number): { ids: string[]; rngState: number } {
  const list = [...ids];
  let rng = rngState;
  for (let i = list.length - 1; i > 0; i -= 1) {
    const roll = nextRandom(rng);
    rng = roll.state;
    const j = Math.floor(roll.value * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return { ids: list, rngState: rng };
}

interface Pending {
  reason: PauseReason;
  messageId: string;
}

function startCompetition(state: GameState): { state: GameState; pending: Pending } {
  const projectScores: Record<string, number> = { [PLAYER_TEAM_ID]: (state.report.score ?? 0) + (state.report.oralScore ?? 0) };
  const penalties: Record<string, number> = { [PLAYER_TEAM_ID]: (state.aircraft?.lateChanges ?? 0) * C.lateChangePenalty };
  for (const team of state.rivals) {
    const profile = rivalProfile(state.seed, team);
    projectScores[team.id] = profile.report + profile.oral;
    penalties[team.id] = 0;
  }
  const base: CompetitionState = {
    phase: "inspection",
    battery: 1,
    queue: [],
    queueIndex: 0,
    plannedPayloadKg: null,
    weather: weatherAt(state.seed, state.clock.hours),
    results: [],
    projectScores,
    penalties,
    inspectionIssues: inspectionIssues(state),
    suspended: {}
  };
  const order = shuffle(eligibleTeams(state, base, 1), state.rngState);
  const competition = { ...base, queue: order.ids };
  let next: GameState = { ...state, rngState: order.rngState, competition };
  const issues = competition.inspectionIssues;
  const added = addMessage(next, {
    from: "Comissão Técnica",
    title: "Competição Aerodesign Brasil: começou",
    body: [
      `Hoje é dia de exposição e inspeção de segurança. Os voos começam amanhã às ${String(C.windowStartHour).padStart(2, "0")}h; ${competition.queue.length} equipes na fila da bateria 1.`,
      issues.length ? `Pendências da sua equipe: ${issues.join(" ")}` : "Seu avião passou na inspeção."
    ].join(" ")
  });
  next = added.state;
  return { state: next, pending: { reason: "competition", messageId: added.id } };
}

function finishCompetition(state: GameState): { state: GameState; pending: Pending } {
  const competition = { ...state.competition!, phase: "finished" as const };
  let next: GameState = { ...state, competition };
  const table = standings(next);
  const mine = table.find((row) => row.teamId === PLAYER_TEAM_ID)!;
  const fakes = counterfeitParts(next);
  const lines = [
    `Fim da competição. ${table[0]!.teamName} venceu com ${table[0]!.total.toFixed(1)} pontos.`,
    `Sua equipe ficou em ${mine.position}º de ${table.length}, com ${mine.total.toFixed(1)} pontos.`,
    fakes.length ? `Relatório final da CT: peças fora da especificação no hangar (${fakes.map((part) => part.label).join(", ")}).` : null
  ].filter(Boolean);
  const added = addMessage(next, { from: "Comissão Técnica", title: "Resultado final", body: lines.join(" ") });
  next = added.state;
  return { state: next, pending: { reason: "competition", messageId: added.id } };
}

/** Passa para a próxima bateria (ou encerra). */
function nextBattery(state: GameState): { state: GameState; pending: Pending | null } {
  const competition = state.competition!;
  const battery = competition.battery + 1;
  if (battery > C.maxBatteries) return finishCompetition(state);
  const eligible = eligibleTeams(state, competition, battery);
  if (eligible.length === 0) return finishCompetition(state);
  const order = shuffle(eligible, state.rngState);
  let next: GameState = { ...state, rngState: order.rngState, competition: { ...competition, battery, queue: order.ids, queueIndex: 0 } };
  const inQueue = order.ids.includes(PLAYER_TEAM_ID);
  next = addMessage(next, {
    from: "Comissão Técnica",
    title: `Bateria ${battery}`,
    body: inQueue
      ? `${order.ids.length} equipes na fila. Você é a ${order.ids.indexOf(PLAYER_TEAM_ID) + 1}ª a decolar.`
      : `${order.ids.length} equipes classificadas (Tabela 10.1). Sua equipe não voa esta bateria.`
  }).state;
  return { state: next, pending: null };
}

/** Peças de nome masculino: o estado concorda ("Trem de pouso quebrado"). */
const MASCULINE: ReadonlySet<string> = new Set(["landingGear", "powertrain"]);

/** Estado depois do dano, para o cartão final ("Asa quebrada", "Trem de pouso danificado"). */
const damageLabel = (part: Part) => {
  const state = PART_STATE_LABELS[partState(part.condition)].toLowerCase();
  return `${PART_TYPE_LABELS[part.type]} ${MASCULINE.has(part.type) ? state.replace(/a$/, "o") : state}`;
};

function damagePlayerParts(state: GameState, crash: boolean): { state: GameState; labels: string[] } {
  const installed = Object.values(installedParts(state)).filter((part): part is Part => !!part);
  if (installed.length === 0) return { state, labels: [] };
  let rng = state.rngState;
  const roll = () => {
    const r = nextRandom(rng);
    rng = r.state;
    return r.value;
  };
  const count = crash ? 2 + Math.floor(roll() * 2) : 1 + Math.floor(roll() * 2);
  const pool = [...installed];
  const hit = new Map<string, number>();
  for (let i = 0; i < count && pool.length; i += 1) {
    // Pouso duro pega primeiro o trem de pouso.
    const gear = !crash && i === 0 ? pool.findIndex((part) => part.type === "landingGear") : -1;
    const index = gear >= 0 ? gear : Math.floor(roll() * pool.length);
    const part = pool.splice(index, 1)[0]!;
    hit.set(part.id, crash ? 40 + 40 * roll() : 20 + 20 * roll());
  }
  const parts = state.parts.map((part) => (hit.has(part.id) ? { ...part, condition: clamp(Math.round(part.condition - hit.get(part.id)!)) } : part));
  const labels = parts.filter((part) => hit.has(part.id)).map(damageLabel);
  return { state: { ...state, parts, rngState: rng }, labels };
}

/** Retirada de carga com as duas pessoas mais ágeis (R[7.7.7.1]: até 2 pessoas). */
function playerUnloadSeconds(state: GameState): number {
  const agility = state.members
    .filter(canWork)
    .map((member) => member.agility)
    .sort((a, b) => b - a)
    .slice(0, 2);
  const mean = agility.length ? agility.reduce((sum, value) => sum + value, 0) / agility.length : 0;
  return C.unloadBase - C.unloadGain * (mean / 100);
}

function playerPilot(state: GameState): number {
  return Math.max(BALANCE.tests.ctPilot, ...state.members.filter(canWork).map((member) => member.piloting));
}

/** Carga que a equipe vai embarcar: a escolhida ou, sem escolha, a da reta de previsão. */
function playerPayload(state: GameState, hrho: number): number {
  const planned = state.competition?.plannedPayloadKg;
  if (planned != null) return planned;
  const line = state.report.payloadLine;
  return line ? clamp(predictedPayload(line, hrho), 0, R.maxTakeoffWeight) : R.minValidPayload;
}

function record(state: GameState, result: BatteryResult): GameState {
  const competition = state.competition!;
  return { ...state, competition: { ...competition, results: [...competition.results, result] } };
}

function flyPlayer(state: GameState, at: number, weather: FieldWeather): { state: GameState; pending: Pending } {
  const competition = state.competition!;
  const issues = inspectionIssues(state);
  if (issues.length) {
    const added = addMessage(state, {
      from: "Comissão Técnica",
      title: `Bateria ${competition.battery}: sua equipe não decolou`,
      body: `A vez passou com pendências: ${issues.join(" ")}`
    });
    return { state: added.state, pending: { reason: "competition", messageId: added.id } };
  }
  const model = playerFlightModel(state)!;
  const aircraft = state.aircraft!;
  const hrho = densityAltitude(weather.temperatureK, weather.pressureHpa);
  const payloadKg = playerPayload(state, hrho);
  const resolved = resolveFlight(model, payloadKg, weather, playerPilot(state), playerUnloadSeconds(state), state.rngState);
  const flight = resolved.flight;
  let next: GameState = { ...state, rngState: resolved.rngState };

  let damagedParts: string[] = [];
  if (flight.outcome === "crash" || flight.outcome === "damage") {
    const damaged = damagePlayerParts(next, flight.outcome === "crash");
    next = damaged.state;
    damagedParts = damaged.labels;
  }
  const line = state.report.payloadLine;
  const points = SCORED.has(flight.outcome)
    ? scoreBattery({
        payload: payloadKg,
        emptyWeight: model.emptyWeightKg,
        predictedEmptyWeight: state.report.predictedEmptyWeightKg ?? 0,
        predictedPayload: line ? predictedPayload(line, hrho) : 0,
        reportScore: state.report.score ?? 0,
        surfaces: aircraft.design.surfaces,
        span: aircraft.design.span,
        peakPower: model.peakPowerW,
        stoppedInside: flight.outcome !== "landing-out",
        unloadSeconds: flight.unloadTimeS ?? R.maxUnloadSeconds + 1
      })
    : null;
  const playback: FlightPlayback = {
    battery: competition.battery,
    teamName: state.teamName,
    payloadKg,
    densityAltitudeM: hrho,
    headwindMs: weather.headwindMs,
    ...flight,
    ...(damagedParts.length ? { damagedParts } : {})
  };
  next = record(next, { battery: competition.battery, teamId: PLAYER_TEAM_ID, payloadKg, densityAltitudeM: hrho, outcome: flight.outcome, points, playback, at });

  const notes: string[] = [];
  // Trem alto que aborta passa por baixo da fita e a rompe: fica fora da próxima bateria (design §3.1).
  if (flight.outcome === "no-takeoff" && aircraft.design.gear === "high") {
    const comp = next.competition!;
    next = { ...next, competition: { ...comp, suspended: { ...(comp.suspended ?? {}), [PLAYER_TEAM_ID]: comp.battery + 1 } } };
    notes.push("O trem alto rompeu a fita na decolagem abortada: a equipe perde a próxima bateria.");
  }
  if (damagedParts.length) notes.push(`Danos: ${damagedParts.join(", ")}. Dá para reparar entre baterias.`);
  const summary = points
    ? `${points.valid ? "Voo válido" : "Voo inválido"}: ${points.total.toFixed(1)} pontos (EE ${points.ee.toFixed(2)}).`
    : "Sem pontuação nesta bateria.";
  const added = addMessage(next, {
    from: "Comissão Técnica",
    title: `Bateria ${competition.battery}: seu voo com ${payloadKg.toFixed(2)} kg`,
    body: [summary, ...notes].join(" ")
  });
  return { state: added.state, pending: { reason: "flight", messageId: added.id } };
}

function flyRival(state: GameState, teamId: string, at: number, weather: FieldWeather): GameState {
  const competition = state.competition!;
  const team = state.rivals.find((item) => item.id === teamId)!;
  const profile = rivalProfile(state.seed, team);
  const previousIncidents = competition.results.filter((r) => r.teamId === teamId && (r.outcome === "damage" || r.outcome === "crash")).length;
  const model = { ...profile.model, condition: Math.max(30, 100 - 25 * previousIncidents) };
  const hrho = densityAltitude(weather.temperatureK, weather.pressureHpa);
  const predicted = predictedPayload(profile.payloadLine, hrho);
  const payloadKg = clamp(predicted * profile.aggressiveness, R.minValidPayload, R.maxTakeoffWeight);
  const resolved = resolveFlight(model, payloadKg, weather, profile.pilot, profile.unloadSeconds, state.rngState);
  const flight = resolved.flight;
  const points = SCORED.has(flight.outcome)
    ? scoreBattery({
        payload: payloadKg,
        emptyWeight: model.emptyWeightKg,
        predictedEmptyWeight: profile.predictedEmptyWeightKg,
        predictedPayload: predicted,
        reportScore: profile.report,
        surfaces: model.surfaces,
        span: model.span,
        peakPower: model.peakPowerW,
        stoppedInside: flight.outcome !== "landing-out",
        unloadSeconds: flight.unloadTimeS ?? R.maxUnloadSeconds + 1
      })
    : null;
  const playback: FlightPlayback | null = team.archetype
    ? { battery: competition.battery, teamName: team.name, payloadKg, densityAltitudeM: hrho, headwindMs: weather.headwindMs, ...flight }
    : null;
  let next: GameState = { ...state, rngState: resolved.rngState };
  next = record(next, { battery: competition.battery, teamId, payloadKg, densityAltitudeM: hrho, outcome: flight.outcome, points, playback, at });
  if (team.archetype) {
    next = addNews(next, {
      kind: "rival",
      title: `${team.name}: ${RIVAL_NEWS[flight.outcome]} na bateria ${competition.battery}`,
      body: `${team.name} (${team.institution}) decolou com ${payloadKg.toFixed(1)} kg.${points ? ` Pontuou ${points.total.toFixed(1)}.` : ""}`
    });
  }
  if (flight.outcome === "crash") {
    // Quem cai passa a bateria seguinte no hangarete, consertando.
    const comp = next.competition!;
    next = { ...next, competition: { ...comp, suspended: { ...(comp.suspended ?? {}), [teamId]: comp.battery + 1 } } };
  }
  return next;
}

/** Uma decolagem na fila; ao fim da fila, abre a próxima bateria. */
function flySlot(state: GameState, at: number): { state: GameState; pending: Pending | null } {
  let next = state;
  let competition = next.competition!;
  if (competition.queueIndex >= competition.queue.length) {
    const opened = nextBattery(next);
    next = opened.state;
    if (next.competition!.phase === "finished") return opened;
    competition = next.competition!;
  }
  const teamId = competition.queue[competition.queueIndex]!;
  const weather = weatherAt(next.seed, at);
  next = { ...next, competition: { ...competition, queueIndex: competition.queueIndex + 1, weather } };
  let pending: Pending | null = null;
  if (teamId === PLAYER_TEAM_ID) {
    const flown = flyPlayer(next, at, weather);
    next = flown.state;
    pending = flown.pending;
  } else {
    next = flyRival(next, teamId, at, weather);
  }
  if (next.competition!.queueIndex >= next.competition!.queue.length) {
    const opened = nextBattery(next);
    next = opened.state;
    pending = pending ?? opened.pending;
  }
  return { state: next, pending };
}

/** A competição no relógio: começa no marco, atualiza clima e inspeção, faz as decolagens dos slots. */
export function advanceCompetition(state: GameState, t0: number, t1: number): { state: GameState; pauses: Pending[] } {
  const pauses: Pending[] = [];
  let next = state;
  if (!next.competition && t0 < COMPETITION_START && COMPETITION_START <= t1) {
    const started = startCompetition(next);
    next = started.state;
    pauses.push(started.pending);
  }
  if (!competing(next)) return { state: next, pauses };

  next = {
    ...next,
    competition: { ...next.competition!, weather: weatherAt(next.seed, t1), inspectionIssues: inspectionIssues(next) }
  };
  for (let k = Math.floor(t0 / SLOT_HOURS + 1e-9) + 1; k * SLOT_HOURS <= t1 + 1e-9; k += 1) {
    const at = k * SLOT_HOURS;
    if (!inFlightWindow(at) || at <= t0) continue;
    if (next.competition!.phase === "inspection") next = { ...next, competition: { ...next.competition!, phase: "flights" } };
    const flown = flySlot(next, at);
    next = flown.state;
    if (flown.pending) pauses.push(flown.pending);
    if (next.competition!.phase === "finished") return { state: next, pauses };
    // Seu voo para o relógio para o replay: o resto do passo fica para depois.
    if (flown.pending?.reason === "flight") return { state: next, pauses };
  }
  if (t0 < lastWindowEnd() && lastWindowEnd() <= t1) {
    const finished = finishCompetition(next);
    next = finished.state;
    pauses.push(finished.pending);
  }
  return { state: next, pauses };
}

// ---------------------------------------------------------------------------
// Leituras e comandos
// ---------------------------------------------------------------------------

/** Equipes à frente da sua na fila da bateria atual; null se você não está na fila (ou já voou nela). */
export function teamsAhead(state: GameState): number | null {
  const competition = state.competition;
  if (!competition || competition.phase === "finished") return null;
  const index = competition.queue.indexOf(PLAYER_TEAM_ID);
  if (index < competition.queueIndex) return null;
  return index - competition.queueIndex;
}

/** Placar: melhor bateria + BCF + projeto − penalidades (design §9.3, 7.9), ordenado. */
export function standings(state: GameState): Standing[] {
  const competition = state.competition;
  if (!competition) return [];
  const ids = [PLAYER_TEAM_ID, ...state.rivals.map((team) => team.id)];
  const rows = ids.map((teamId) => {
    const totals = competition.results
      .filter((result) => result.teamId === teamId && result.points?.valid)
      .map((result) => result.points!.total)
      .sort((a, b) => b - a);
    const bestBattery = totals[0] ?? 0;
    const bcf = totals.length >= 2 ? reliabilityBonus(totals[0]!, totals[1]!) : 0;
    const project = competition.projectScores[teamId] ?? 0;
    const penalties = competition.penalties[teamId] ?? 0;
    return { teamId, teamName: teamName(state, teamId), bestBattery, bcf, project, penalties, total: bestBattery + bcf + project - penalties, position: 0 };
  });
  rows.sort((a, b) => b.total - a.total || a.teamName.localeCompare(b.teamName));
  return rows.map((row, index) => ({ ...row, position: index + 1 }));
}

/**
 * Escolhe a carga da sua próxima decolagem. Recusa com menos de MIN_TEAMS_AHEAD_TO_REVISE
 * equipes à frente (a carga já escolhida fica valendo).
 */
export function setBatteryPayload(state: GameState, payloadKg: number): GameState {
  const competition = state.competition;
  if (!competition || competition.phase === "finished") return warn(state, "Não há competição em andamento.");
  if (!(payloadKg > 0) || payloadKg > R.maxTakeoffWeight) return warn(state, `Carga precisa ficar entre 0 e ${R.maxTakeoffWeight} kg.`);
  const ahead = teamsAhead(state);
  if (ahead !== null && ahead < MIN_TEAMS_AHEAD_TO_REVISE) {
    return warn(state, `Só dá para revisar a carga com pelo menos ${MIN_TEAMS_AHEAD_TO_REVISE} equipes à frente (R[10.1.5.3]).`);
  }
  return { ...state, competition: { ...competition, plannedPayloadKg: payloadKg } };
}

/**
 * Só em dev: pula para a véspera dos voos com equipe, avião, relatório e previsões prontos.
 * O relógio fica pausado pouco antes da primeira decolagem.
 */
export function devStartCompetition(state: GameState): GameState {
  if (state.competition) return warn(state, "A competição já começou.");
  let next = state.aircraft ? state : setDesign(state, DEFAULT_DESIGN);
  const aircraft = next.aircraft!;
  // Equipe treinada: acervo razoável, pilotagem e agilidade.
  const documented = Object.fromEntries(DISCIPLINES.map((d) => [d, Math.max(next.documented[d], 50)])) as GameState["documented"];
  const members = next.members.map((member) => (canWork(member) ? { ...member, piloting: Math.max(member.piloting, 65), agility: Math.max(member.agility, 60) } : member));
  const parts: Part[] = requiredParts(aircraft.design).map((type, index) => ({
    id: `part-dev-${index}`,
    type,
    label: PART_TYPE_LABELS[type],
    quality: 75,
    condition: 100
  }));
  const chapters = Object.fromEntries(DISCIPLINES.map((d) => [d, { hours: 40, testsCited: 2 }])) as GameState["report"]["chapters"];
  const devGrant = Math.max(0, 1000 - next.credits);
  next = {
    ...next,
    credits: Math.max(next.credits, 1000),
    members,
    documented,
    parts,
    equipment: next.equipment.includes("scale") ? next.equipment : [...next.equipment, "scale"],
    tasks: next.tasks.filter((task) => task.status === "done"),
    orders: next.orders.filter((order) => order.status === "delivered"),
    aircraft: { ...aircraft, evidence: { emptyWeight: 2, payload: 2, takeoff: 2 }, flightVideoAt: COMPETITION_START - 30 * 24 },
    report: { ...next.report, chapters, drawingsHours: 30, oralPracticeHours: 10 },
    clock: { ...next.clock, hours: COMPETITION_START - 1 }
  };
  next = recordLedger(next, { credits: devGrant, kind: "dev", label: "Caixa de desenvolvimento" });
  // Previsões a partir das estimativas da equipe, como no Portal da CT (11.6).
  const cold = estimatePerformance(next, 700)!;
  const hot = estimatePerformance(next, 1300)!;
  const a = (hot.maxPayloadKg.value - cold.maxPayloadKg.value) / 600;
  next = {
    ...next,
    report: {
      ...next.report,
      predictedEmptyWeightKg: Math.round(cold.emptyWeightKg.value * 100) / 100,
      payloadLine: { a, b: cold.maxPayloadKg.value - a * 700, cap: null },
      submittedAt: null,
      score: null,
      oralScore: null
    }
  };
  // Envio no prazo (16/ago), sem penalidade.
  next = deliverReport({ ...next, clock: { ...next.clock, hours: REPORT_DEADLINE - 1 } });
  next = { ...next, clock: { ...next.clock, hours: COMPETITION_START - 1 } };
  next = { ...next, report: { ...next.report, oralScore: expectedOralScore(next) } };
  const started = startCompetition({ ...next, clock: { ...next.clock, hours: COMPETITION_START } });
  next = started.state;
  return {
    ...next,
    clock: { hours: firstWindowStart() - 0.25, speed: 0 },
    pause: { reason: "competition", at: firstWindowStart() - 0.25, messageId: started.pending.messageId }
  };
}
