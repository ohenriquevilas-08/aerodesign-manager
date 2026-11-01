// Projeto da aeronave e desempenho real vs estimado (design §6). Frente: Simulação (Fase 3).
// O desempenho real sai do projeto (nominal) × desvios escondidos (material, filosofia) × peças
// instaladas. A equipe só vê estimativas com margem, que encolhem com conhecimento e ensaios.

import { BALANCE } from "./content/balance";
import { OFFICIAL_CALENDAR } from "./content/calendar2026";
import { nextRandom } from "./rng";
import { REGULAR_2026 } from "./content/regulation2026";
import { warn } from "./tasks";
import { clamp, effectiveKnowledge } from "./team";
import { dateToHours } from "./time";
import type {
  AircraftDesign,
  AircraftEvidence,
  AircraftHidden,
  Discipline,
  Estimate,
  GameState,
  Part,
  PartType,
  PerformanceEstimate
} from "./types";

const A = BALANCE.aircraft;

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

/** Rótulos das peças, para inbox e cartão do voo. */
export const PART_TYPE_LABELS: Record<PartType, string> = {
  wing: "Asa",
  fuselage: "Fuselagem",
  tail: "Empenagem",
  landingGear: "Trem de pouso",
  powertrain: "Grupo motopropulsor",
  electronics: "Eletrônica"
};

const NO_EVIDENCE: AircraftEvidence = { emptyWeight: 0, payload: 0, takeoff: 0 };

// ---------------------------------------------------------------------------
// Física simplificada (design §12: plausível, não exata).
// ---------------------------------------------------------------------------

/** Densidade relativa σ = ρ/ρ0 na altitude densidade (atmosfera padrão, a mesma do Apêndice 4). */
export function densityRatio(densityAltitudeM: number): number {
  return Math.pow(Math.max(0, 1 - 2.25577e-5 * densityAltitudeM), 4.2559);
}

/** O que a simulação de voo precisa saber de um avião (o seu ou de uma rival). */
export interface FlightModel {
  emptyWeightKg: number;
  /** Massa total que a asa sustenta ao nível do mar (σ = 1), kg. */
  liftCapacityKg: number;
  span: number;
  surfaces: 1 | 2 | 3;
  /** Potência efetiva na decolagem, W (peças e falsificação já aplicadas). */
  powerW: number;
  /** Potência de pico medida pelo wattímetro (PP, 7.2.0.1): a do projeto. */
  peakPowerW: number;
  /** Multiplicador de sustentação (N e filosofia), usado na corrida. */
  liftFactor: number;
  gear: AircraftDesign["gear"];
  /** 0–1: quanto o avião perdoa erro de pilotagem. */
  stability: number;
  /** Pior condição entre as peças instaladas (0–100). */
  condition: number;
}

/** Massa máxima de decolagem que a asa sustenta nessa altitude densidade. */
export function liftLimitKg(model: FlightModel, densityAltitudeM: number): number {
  return model.liftCapacityKg * densityRatio(densityAltitudeM);
}

/** Carga máxima que o avião leva nessa altitude densidade (sustentação − peso vazio). */
export function maxPayloadKg(model: FlightModel, densityAltitudeM: number): number {
  return Math.max(0, liftLimitKg(model, densityAltitudeM) - model.emptyWeightKg);
}

/**
 * Corrida até a roda sair do chão, m. Forma clássica da corrida de decolagem
 * (s ∝ W² / (ρ S CLmax T)), com tração e sustentação caindo com σ e vento de proa encurtando.
 */
export function rotationDistanceM(model: FlightModel, massKg: number, densityAltitudeM: number, headwindMs = 0): number {
  const t = A.takeoff;
  const sigma = densityRatio(densityAltitudeM);
  const still = (t.k * massKg * massKg * (t.gearFactor[model.gear] ?? 1)) / (sigma * sigma * model.span * model.powerW * model.liftFactor);
  const wind = Math.max(0.3, (t.liftoffSpeedMs - headwindMs) / t.liftoffSpeedMs);
  return still * wind * wind;
}

// ---------------------------------------------------------------------------
// Projeto: modelo nominal, desvios escondidos e peças.
// ---------------------------------------------------------------------------

export function nominalEmptyWeightKg(design: AircraftDesign): number {
  const w = A.weight;
  const wing = w.wingCoef * Math.pow(design.span, w.wingExponent) * (w.wingMaterial[design.material] ?? 1);
  const powertrain = w.powertrainBase + w.powertrainPerW * design.powerW;
  const total = w.fuselage + powertrain + wing + (w.tail[design.surfaces] ?? 0) + (w.gear[design.gear] ?? 0);
  return total * (w.philosophy[design.philosophy] ?? 1);
}

export function liftFactor(design: AircraftDesign): number {
  return (A.lift.surfaces[design.surfaces] ?? 1) * (A.lift.philosophy[design.philosophy] ?? 1);
}

export function nominalLiftCapacityKg(design: AircraftDesign): number {
  return A.lift.coef * Math.pow(design.span, A.lift.spanExponent) * liftFactor(design);
}

export function designStability(design: AircraftDesign): number {
  return clamp((A.stability.philosophy[design.philosophy] ?? 0.6) + (A.stability.surfaces[design.surfaces] ?? 0), 0, 1);
}

/**
 * Sorteia os desvios escondidos: o peso vazio pelo material (viés + variação), a sustentação
 * pela filosofia (apostar em carga é mais incerto) e o erro inicial da opinião da equipe.
 */
export function drawHidden(rngState: number, design: AircraftDesign = DEFAULT_DESIGN): { hidden: AircraftHidden; rngState: number } {
  const rolls: number[] = [];
  let state = rngState;
  for (let i = 0; i < 5; i += 1) {
    const roll = nextRandom(state);
    rolls.push(roll.value);
    state = roll.state;
  }
  const [w, p, b1, b2, b3] = rolls as [number, number, number, number, number];
  const material = A.material[design.material] ?? { bias: 0, spread: 0.08 };
  const spread = A.philosophySpread[design.philosophy] ?? 0.09;
  return {
    hidden: {
      emptyWeightFactor: 1 + material.bias + material.spread * (2 * w - 1),
      payloadFactor: 1 + spread * (2 * p - 1),
      bias: { emptyWeight: 2 * b1 - 1, payload: 2 * b2 - 1, takeoff: 2 * b3 - 1 }
    },
    rngState: state
  };
}

/** Peças que o projeto precisa para voar (asa voadora não tem empenagem). */
export function requiredParts(design: AircraftDesign): PartType[] {
  const parts: PartType[] = ["wing", "fuselage", "landingGear", "powertrain", "electronics"];
  return design.surfaces >= 2 ? [...parts.slice(0, 2), "tail", ...parts.slice(2)] : parts;
}

/**
 * Peça instalada de cada tipo: a de melhor condição que não está quebrada (empate: a mais nova).
 * null quando não há peça utilizável.
 */
export function installedParts(state: GameState): Record<PartType, Part | null> {
  const result: Record<PartType, Part | null> = {
    wing: null,
    fuselage: null,
    tail: null,
    landingGear: null,
    powertrain: null,
    electronics: null
  };
  for (const part of state.parts) {
    if (part.condition < 20) continue;
    const current = result[part.type];
    if (!current || part.condition >= current.condition) result[part.type] = part;
  }
  return result;
}

/** Rótulos das peças que faltam (ou estão quebradas) para o avião voar. Vazio = completo. */
export function missingParts(state: GameState): string[] {
  if (!state.aircraft) return ["Projeto da aeronave"];
  const installed = installedParts(state);
  return requiredParts(state.aircraft.design)
    .filter((type) => !installed[type])
    .map((type) => PART_TYPE_LABELS[type]);
}

/** Avião real da equipe: projeto × desvios escondidos × peças instaladas. Nunca mostrar. */
export function playerFlightModel(state: GameState): FlightModel | null {
  const aircraft = state.aircraft;
  if (!aircraft) return null;
  const { design, hidden } = aircraft;
  const installed = Object.values(installedParts(state)).filter((part): part is Part => !!part);
  const ref = A.referenceQuality;
  const avgQuality = installed.length ? installed.reduce((sum, part) => sum + part.quality, 0) / installed.length : ref;
  const wing = installedParts(state).wing;
  const motor = installedParts(state).powertrain;
  const weightParts = 1 + (ref - avgQuality) * A.weightPerQualityPoint;
  const liftParts = 1 + ((wing?.quality ?? ref) - ref) * A.liftPerQualityPoint;
  const powerParts =
    (A.powerAtZeroQuality + (1 - A.powerAtZeroQuality) * Math.min(1.2, (motor?.quality ?? ref) / ref)) *
    (motor?.counterfeit ? A.counterfeitPower : 1);
  return {
    emptyWeightKg: nominalEmptyWeightKg(design) * hidden.emptyWeightFactor * weightParts,
    liftCapacityKg: nominalLiftCapacityKg(design) * hidden.payloadFactor * liftParts,
    span: design.span,
    surfaces: design.surfaces,
    powerW: design.powerW * powerParts,
    peakPowerW: design.powerW,
    liftFactor: liftFactor(design),
    gear: design.gear,
    stability: designStability(design),
    condition: installed.length ? Math.min(...installed.map((part) => part.condition)) : 100
  };
}

// ---------------------------------------------------------------------------
// Prancheta
// ---------------------------------------------------------------------------

const sameDesign = (a: AircraftDesign, b: AircraftDesign) =>
  a.span === b.span &&
  a.surfaces === b.surfaces &&
  a.powerW === b.powerW &&
  a.philosophy === b.philosophy &&
  a.material === b.material &&
  a.gear === b.gear;

const VIDEO_DEADLINE = dateToHours(OFFICIAL_CALENDAR.find((item) => item.id === "flight-video")!.date);

export function setDesign(state: GameState, design: AircraftDesign): GameState {
  const { span, powerW } = DESIGN_LIMITS;
  if (design.span < span.min || design.span > span.max) {
    return warn(state, `Envergadura fora da prancheta (${span.min} a ${span.max} m).`);
  }
  if (design.powerW < powerW.min || design.powerW > powerW.max) {
    return warn(state, `Potência fora da prancheta (${powerW.min} a ${powerW.max} W).`);
  }
  const current = state.aircraft;
  if (current) {
    if (sameDesign(current.design, design)) return state;
    // Mudar o projeto invalida parte dos ensaios; depois de 27/set conta como alteração tardia (Apêndice 6).
    const evidence = current.evidence ?? NO_EVIDENCE;
    const kept = A.redesignEvidenceKept;
    return {
      ...state,
      aircraft: {
        ...current,
        design,
        evidence: { emptyWeight: evidence.emptyWeight * kept, payload: evidence.payload * kept, takeoff: evidence.takeoff * kept },
        lateChanges: current.lateChanges + (state.clock.hours > VIDEO_DEADLINE ? 1 : 0)
      }
    };
  }
  const { hidden, rngState } = drawHidden(state.rngState, design);
  return { ...state, rngState, aircraft: { design, hidden, lateChanges: 0, evidence: { ...NO_EVIDENCE }, flightVideoAt: null } };
}

// ---------------------------------------------------------------------------
// Estimativas (design §6.2)
// ---------------------------------------------------------------------------

/** Melhor conhecimento efetivo da equipe na disciplina (o documentado é o piso). */
export function teamKnowledge(state: GameState, discipline: Discipline): number {
  return Math.max(state.documented[discipline], ...state.members.map((member) => effectiveKnowledge(member, state.documented, discipline)));
}

const knowledgeFactor = (knowledge: number) => 1 - A.knowledgeCut * (clamp(knowledge) / 100);
const testFactor = (evidence: number) => 1 / (1 + Math.max(0, evidence));

/** Margens relativas atuais (fração do valor real) de peso vazio, carga e corrida. */
export function relativeMargins(state: GameState): { emptyWeight: number; payload: number; takeoff: number } {
  const evidence = state.aircraft?.evidence ?? NO_EVIDENCE;
  const weighed = state.equipment.includes("scale") && missingParts(state).length === 0 ? A.scaleEvidence : 0;
  const aero = (teamKnowledge(state, "aerodynamics") + teamKnowledge(state, "performance")) / 2;
  return {
    emptyWeight: A.margin.emptyWeight * knowledgeFactor(teamKnowledge(state, "structures")) * testFactor(evidence.emptyWeight + weighed),
    payload: A.margin.payload * knowledgeFactor(aero) * testFactor(evidence.payload),
    takeoff: A.margin.takeoff * knowledgeFactor(teamKnowledge(state, "performance")) * testFactor(evidence.takeoff + 0.5 * evidence.payload)
  };
}

const biased = (real: number, margin: number, bias: number): Estimate => ({
  value: Math.max(0, real + bias * margin * A.biasShare),
  margin
});

/**
 * O que a equipe acha do avião numa altitude densidade (design §6.2): valor ± margem.
 * O real fica dentro da faixa; com margem zero, a estimativa é o real. null sem projeto.
 */
export function estimatePerformance(state: GameState, densityAltitudeM: number): PerformanceEstimate | null {
  const model = playerFlightModel(state);
  if (!model || !state.aircraft) return null;
  const bias = state.aircraft.hidden.bias ?? { emptyWeight: 0, payload: 0, takeoff: 0 };
  const rel = relativeMargins(state);

  const realPayload = maxPayloadKg(model, densityAltitudeM);
  const emptyWeightKg = biased(model.emptyWeightKg, model.emptyWeightKg * rel.emptyWeight, bias.emptyWeight);
  const maxPayload = biased(realPayload, realPayload * rel.payload, bias.payload);
  const realTakeoff = rotationDistanceM(model, model.emptyWeightKg + realPayload, densityAltitudeM);
  const takeoffDistanceM = biased(realTakeoff, realTakeoff * rel.takeoff, bias.takeoff);
  // EE (7.7.1) com a carga que conta: o peso máximo de decolagem limita (R[7.6.0.1]).
  const scored = Math.min(maxPayload.value, Math.max(0, REGULAR_2026.maxTakeoffWeight - emptyWeightKg.value));
  const ee = emptyWeightKg.value > 0 ? scored / emptyWeightKg.value : 0;
  return {
    densityAltitudeM,
    emptyWeightKg,
    maxPayloadKg: maxPayload,
    structuralEfficiency: { value: ee, margin: ee * (rel.payload + rel.emptyWeight) },
    takeoffDistanceM
  };
}

// ---------------------------------------------------------------------------
// Ensaios (design §7.3)
// ---------------------------------------------------------------------------

export type TestKind = "structural" | "thrust" | "flight" | "video";

/** O que o ensaio precisa ter no hangar; null se pode começar. */
export function testProblem(state: GameState, kind: TestKind): string | null {
  if (!state.aircraft) return "Defina o projeto na prancheta antes de ensaiar.";
  const installed = installedParts(state);
  if (kind === "structural") return installed.wing ? null : "O ensaio estrutural precisa de uma asa inteira.";
  if (kind === "thrust") return installed.powertrain ? null : "O ensaio de bancada precisa do grupo motopropulsor.";
  const missing = missingParts(state);
  return missing.length === 0 ? null : `Avião incompleto para voar: falta ${missing.join(", ").toLowerCase()}.`;
}

/** Disciplinas cujo capítulo pode citar o ensaio (11.1: Estruturas e ensaios estruturais etc.). */
export const TEST_CITES: Record<TestKind, Discipline[]> = {
  structural: ["structures", "loads"],
  thrust: ["electrical", "performance"],
  flight: ["performance", "aerodynamics", "stability"],
  video: []
};

function damageParts(state: GameState, ids: Set<string>, amount: (part: Part) => number): GameState {
  return { ...state, parts: state.parts.map((part) => (ids.has(part.id) ? { ...part, condition: clamp(part.condition - amount(part)) } : part)) };
}

/**
 * Efeito de um ensaio concluído: soma evidência (× rendimento), sorteia de novo o erro da
 * opinião da equipe, cita o ensaio nos capítulos e desgasta ou danifica as peças usadas.
 * `quality` é a qualidade de quem conduziu (0–100). Devolve o texto da inbox.
 */
export function applyTest(state: GameState, kind: TestKind, quality: number, multiplier: number): { state: GameState; body: string } {
  const aircraft = state.aircraft;
  const problem = testProblem(state, kind);
  if (!aircraft || problem) return { state, body: `O ensaio não aconteceu: ${problem ?? "sem avião"}` };
  const T = BALANCE.tests;
  const installed = installedParts(state);
  let rngState = state.rngState;
  const roll = () => {
    const r = nextRandom(rngState);
    rngState = r.state;
    return r.value;
  };
  const evidence = { ...(aircraft.evidence ?? NO_EVIDENCE) };
  const bias = { ...(aircraft.hidden.bias ?? { emptyWeight: 0, payload: 0, takeoff: 0 }) };
  let next: GameState = state;
  let body = "";

  const flying = kind === "flight" || kind === "video";
  const used = flying
    ? Object.values(installed).filter((part): part is Part => !!part)
    : [kind === "structural" ? installed.wing! : installed.powertrain!];

  // Incidente: chance base cai com a qualidade de quem conduz e sobe com peça gasta (design §7.2).
  const base = kind === "structural" ? T.structural.breakChance : flying ? T[kind].incidentChance : 0;
  const worst = Math.min(...used.map((part) => part.condition));
  const chance = base * (1 - clamp(quality) / 100) * (1 + (100 - worst) / 100);
  const incident = base > 0 && roll() < chance;

  if (kind === "structural") {
    evidence.emptyWeight += T.structural.evidence * multiplier;
    bias.emptyWeight = 2 * roll() - 1;
    const wing = installed.wing!;
    next = damageParts(next, new Set([wing.id]), () => (incident ? T.structural.breakDamage : T.structural.wear));
    body = incident
      ? `A asa cedeu antes da carga de projeto. ${wing.label} danificada, mas o ensaio mostrou onde reforçar.`
      : "Asa carregada até a carga de projeto sem falha. Peso e limite estrutural mais claros.";
  } else if (kind === "thrust") {
    const stand = state.equipment.includes("thrust-stand");
    evidence.takeoff += (stand ? T.thrust.standEvidence : T.thrust.evidence) * multiplier;
    bias.takeoff = 2 * roll() - 1;
    const motor = installed.powertrain!;
    next = damageParts(next, new Set([motor.id]), () => T.thrust.wear);
    const model = playerFlightModel(state)!;
    body = stand
      ? `Bancada de tração: o grupo motopropulsor entrega ~${Math.round(model.powerW / 10) * 10} W.`
      : "Ensaio de motor e hélice sem bancada dedicada: dá uma ideia da tração, sem precisão.";
  } else {
    const t = T[kind];
    evidence.payload += t.payloadEvidence * multiplier;
    if (kind === "flight") evidence.takeoff += T.flight.takeoffEvidence * multiplier;
    bias.payload = 2 * roll() - 1;
    bias.takeoff = 2 * roll() - 1;
    let hit: Part | null = null;
    if (incident) {
      hit = used[Math.floor(roll() * used.length)]!;
      const [min, max] = t.damage;
      const damage = min + (max - min) * roll();
      next = damageParts(next, new Set([hit.id]), () => damage);
    }
    next = damageParts(next, new Set(used.filter((part) => part !== hit).map((part) => part.id)), () => t.wear);
    if (kind === "video") {
      const inTime = state.clock.hours <= VIDEO_DEADLINE;
      const valid = !incident && inTime;
      body = incident
        ? `Pouso duro no voo filmado: ${hit!.label} danificada. O vídeo não vale; repare e filme de novo.`
        : inTime
          ? "Voo filmado válido. O vídeo foi enviado à Comissão Técnica."
          : "O voo foi bom, mas o prazo do vídeo (27/set) já passou: a CT não aceita.";
      if (valid) next = { ...next, aircraft: { ...next.aircraft!, flightVideoAt: state.clock.hours } };
    } else {
      body = incident
        ? `Incidente no voo de ensaio: ${hit!.label} danificada. Os dados até ali ainda servem.`
        : "Voo com carga incremental concluído. A reta de previsão de carga ficou mais confiável.";
    }
  }

  const chapters = { ...next.report.chapters };
  for (const discipline of TEST_CITES[kind]) {
    chapters[discipline] = { ...chapters[discipline], testsCited: chapters[discipline].testsCited + 1 };
  }
  next = {
    ...next,
    rngState,
    report: { ...next.report, chapters },
    aircraft: { ...next.aircraft!, evidence, hidden: { ...next.aircraft!.hidden, bias } }
  };
  return { state: next, body };
}

