// Projeto da aeronave e desempenho real vs estimado (design §6). Frente: Simulação (Fases 3 e 5).
// O desempenho real sai do projeto (nominal) × desvios escondidos (material, filosofia, subsistemas,
// margem estática) × peças instaladas. A equipe só vê estimativas com margem, que encolhem com
// conhecimento e ensaios. Fase 5: peso vazio por orçamento de massa e estabilidade por margem estática.

import { BALANCE } from "./content/balance";
import { OFFICIAL_CALENDAR } from "./content/season2026";
import { nextRandom } from "./rng";
import { REGULAR_2026 } from "./content/regulation2026";
import { regulationPublished } from "./season";
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
  GearHeight,
  MassBudget,
  MassItemId,
  Part,
  PartType,
  PerformanceEstimate,
  RequirementStatus,
  StabilityEstimate,
  TestKind
} from "./types";

const A = BALANCE.aircraft;
const M = A.mass;

/**
 * Limites da prancheta (design §6.1). Envergadura acima de maxSpan e potência acima de maxPower
 * são permitidas e geram PD e PP. A hélice ainda é limitada pelo trem (maxPropDiameterIn).
 */
export const DESIGN_LIMITS = {
  span: { min: 1.5, max: 4.5 },
  powerW: { min: 300, max: 700 },
  chordM: { min: 0.25, max: 0.6 },
  tailVolume: { min: 0.3, max: 0.7 },
  cgPercentMac: { min: 10, max: 45 },
  propDiameterIn: { min: 10, max: 20 }
} as const;

export const DEFAULT_DESIGN: AircraftDesign = {
  span: 2.8,
  surfaces: 2,
  powerW: 550,
  philosophy: "light",
  material: "balsa",
  gear: "low",
  chordM: 0.4,
  wingPosition: "high",
  tailVolume: 0.45,
  cgPercentMac: 30,
  propDiameterIn: 14
};

/** Hélice máxima que o trem deixa girar sem bater no chão, pol. */
export function maxPropDiameterIn(gear: GearHeight): number {
  return A.maxPropIn[gear] ?? DESIGN_LIMITS.propDiameterIn.max;
}

/** Rótulos das peças, para inbox e cartão do voo. */
export const PART_TYPE_LABELS: Record<PartType, string> = {
  wing: "Asa",
  fuselage: "Fuselagem",
  tail: "Empenagem",
  landingGear: "Trem de pouso",
  powertrain: "Grupo motopropulsor",
  electronics: "Eletrônica"
};

/** Subsistemas do orçamento de massa, na ordem da tela. */
export const MASS_ITEMS: readonly MassItemId[] = ["wing", "fuselage", "tail", "landingGear", "powertrain", "battery", "electronics"];

export const MASS_ITEM_LABELS: Record<MassItemId, string> = {
  wing: "Asa",
  fuselage: "Fuselagem",
  tail: "Empenagem",
  landingGear: "Trem de pouso",
  powertrain: "Motor e hélice",
  battery: "Bateria",
  electronics: "Eletrônica"
};

/** Estrutura feita pela equipe: filosofia e material mexem nela; o resto é comprado pronto. */
const BUILT: ReadonlySet<MassItemId> = new Set(["wing", "fuselage", "tail", "landingGear"]);

const NO_EVIDENCE: AircraftEvidence = { emptyWeight: 0, payload: 0, takeoff: 0, stability: 0 };
const NEUTRAL_HIDDEN: AircraftHidden = { emptyWeightFactor: 1, payloadFactor: 1 };

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
  /** Área da asa, m²; ausente = span × refChordM (rivais). */
  wingAreaM2?: number;
  surfaces: 1 | 2 | 3;
  /** Potência efetiva na decolagem, W (peças e falsificação já aplicadas). */
  powerW: number;
  /** Potência de pico medida pelo wattímetro (PP, 7.2.0.1): a do projeto. */
  peakPowerW: number;
  /** Multiplicador de sustentação (N e filosofia), usado na corrida. */
  liftFactor: number;
  /** Hélice, efeito solo e margem estática excessiva na corrida; ausente = 1. */
  takeoffFactor?: number;
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
 * S entra como S / c_ref, para o avião de corda de referência ficar igual ao modelo da Fase 3.
 */
export function rotationDistanceM(model: FlightModel, massKg: number, densityAltitudeM: number, headwindMs = 0): number {
  const t = A.takeoff;
  const sigma = densityRatio(densityAltitudeM);
  const area = (model.wingAreaM2 ?? model.span * A.refChordM) / A.refChordM;
  const thrust = model.powerW * (model.takeoffFactor ?? 1);
  const still = (t.k * massKg * massKg * (t.gearFactor[model.gear] ?? 1)) / (sigma * sigma * area * thrust * model.liftFactor);
  const wind = Math.max(0.3, (t.liftoffSpeedMs - headwindMs) / t.liftoffSpeedMs);
  return still * wind * wind;
}

// ---------------------------------------------------------------------------
// Geometria e orçamento de massa (design §6.4).
// ---------------------------------------------------------------------------

export const wingAreaM2 = (design: AircraftDesign) => design.span * design.chordM;
export const aspectRatio = (design: AircraftDesign) => design.span / design.chordM;
/** Braço da cauda horizontal, m (0 na asa voadora). */
export const tailArmM = (design: AircraftDesign) => (design.surfaces === 1 ? 0 : A.tailArmChords * design.chordM);

/** Massa nominal de cada subsistema, kg (sem desvios nem peças). */
export function nominalMassItems(design: AircraftDesign): Record<MassItemId, number> {
  const S = wingAreaM2(design);
  const b = design.span;
  const structure = M.philosophy[design.philosophy] ?? 1;
  const wing =
    ((M.wingSkin[design.material] ?? 1) * S + (M.wingSpar[design.material] ?? 0.09) * b * b * (A.refChordM / design.chordM)) *
    (design.surfaces === 1 ? M.flyingWingFactor : 1);
  // Sh = VH × S × c / lh, com lh = tailArmChords × c.
  const tailArea = design.surfaces === 1 ? 0 : (design.tailVolume * S) / A.tailArmChords;
  const tailMat = M.tailMaterial[design.material] ?? 1;
  let tail = design.surfaces === 1 ? 0 : (M.tailAreal * tailArea + M.tailFixed) * tailMat;
  if (design.surfaces === 3) tail += (M.tailAreal * M.canardAreaShare * S + M.canardFixed) * tailMat;
  const prop = design.propDiameterIn / A.takeoff.refPropIn;
  return {
    wing: wing * structure,
    fuselage: (M.fuselageBase + M.fuselagePerTailArmM * tailArmM(design)) * structure,
    tail: tail * structure,
    landingGear: (M.gear[design.gear] ?? 0.25) * structure,
    powertrain: M.powertrainBase + M.powertrainPerW * design.powerW + M.propKgAtRef * prop * prop,
    battery: M.batteryBase + M.batteryPerW * design.powerW,
    electronics: M.electronics + (design.surfaces === 3 ? M.electronicsCanard : 0)
  };
}

export function nominalEmptyWeightKg(design: AircraftDesign): number {
  const items = nominalMassItems(design);
  return MASS_ITEMS.reduce((sum, id) => sum + items[id], 0);
}

// ---------------------------------------------------------------------------
// Estabilidade longitudinal (design §6.5).
// ---------------------------------------------------------------------------

/** Ponto neutro nominal, % CMA a partir do bordo de ataque. */
export function neutralPointPercentMac(design: AircraftDesign): number {
  const n = A.neutralPoint;
  if (design.surfaces === 1) return n.flyingWing;
  const ar = aspectRatio(design);
  const wingSlope = ar / (ar + 2);
  const tailSlope = n.tailAspectRatio / (n.tailAspectRatio + 2);
  const downwash = 4 / (ar + 2);
  const tail = 100 * n.tailEfficiency * design.tailVolume * (tailSlope / wingSlope) * (1 - downwash);
  return n.wingAc + tail + n.fuselageShift + (design.surfaces === 3 ? n.canardShift : 0);
}

/** Margem estática nominal, % CMA: ponto neutro − CG. */
export function nominalStaticMargin(design: AircraftDesign): number {
  return neutralPointPercentMac(design) - design.cgPercentMac;
}

/** Faixa da margem estática (staticMarginBands): ok, risco ou falha. */
export function staticMarginStatus(margin: number): RequirementStatus {
  const { ok, risk } = A.staticMarginBands;
  if (margin >= ok[0] && margin <= ok[1]) return "ok";
  return margin >= risk[0] && margin <= risk[1] ? "risk" : "fail";
}

/** Estabilidade 0–1 a partir da margem estática (o real usa a margem real). */
export function stabilityFromMargin(design: AircraftDesign, margin: number): number {
  const s = A.stability;
  let base: number;
  if (margin < 0) base = Math.max(s.floor, s.unstableBase + s.unstablePerPoint * margin);
  else if (margin < s.lowUntil) base = s.lowBase + s.lowPerPoint * margin;
  else {
    const top = Math.min(margin, A.takeoff.overStableFrom);
    base = s.lowBase + s.lowPerPoint * s.lowUntil + s.highPerPoint * (top - s.lowUntil);
  }
  return clamp(base + (s.philosophy[design.philosophy] ?? 0) + (s.wing[design.wingPosition] ?? 0) + (s.surfaces[design.surfaces] ?? 0), 0, 1);
}

export function designStability(design: AircraftDesign): number {
  return stabilityFromMargin(design, nominalStaticMargin(design));
}

/** Margem baixa = cauda carrega menos para baixo = mais carga (e mais risco, via estabilidade). */
export function trimFactor(margin: number): number {
  const l = A.lift;
  return clamp(1 + l.trimPerMarginPoint * (l.trimRefMargin - margin), l.trimRange[0], l.trimRange[1]);
}

/** Multiplicador da tração na corrida: hélice, efeito solo e margem excessiva. */
export function takeoffFactor(design: AircraftDesign, margin: number): number {
  const t = A.takeoff;
  const prop = Math.pow(design.propDiameterIn / t.refPropIn, t.propExponent);
  const ground = design.wingPosition === "low" ? t.lowWingGroundEffect : 1;
  const stiff = 1 + t.overStablePerPoint * Math.max(0, margin - t.overStableFrom);
  return (prop * ground) / stiff;
}

export function liftFactor(design: AircraftDesign): number {
  return (A.lift.surfaces[design.surfaces] ?? 1) * (A.lift.philosophy[design.philosophy] ?? 1);
}

/** Massa sustentada ao nível do mar, kg: coef × S × AR/(AR+2) × N × filosofia × trimagem. */
export function nominalLiftCapacityKg(design: AircraftDesign, margin = nominalStaticMargin(design)): number {
  const ar = aspectRatio(design);
  return A.lift.coef * wingAreaM2(design) * (ar / (ar + 2)) * liftFactor(design) * trimFactor(margin);
}

// ---------------------------------------------------------------------------
// Projeto: desvios escondidos e peças.
// ---------------------------------------------------------------------------

/**
 * Sorteia os desvios escondidos: o peso vazio pelo material (viés + variação), a sustentação
 * pela filosofia (apostar em carga é mais incerto), o erro inicial da opinião da equipe e,
 * na Fase 5, cada subsistema do orçamento de massa e onde o CG cai de fato.
 */
export function drawHidden(rngState: number, design: AircraftDesign = DEFAULT_DESIGN): { hidden: AircraftHidden; rngState: number } {
  const rolls: number[] = [];
  let state = rngState;
  for (let i = 0; i < 6 + MASS_ITEMS.length; i += 1) {
    const roll = nextRandom(state);
    rolls.push(roll.value);
    state = roll.state;
  }
  const [w, p, b1, b2, b3, sm, ...items] = rolls as [number, number, number, number, number, number, ...number[]];
  const material = A.material[design.material] ?? { bias: 0, spread: 0.08 };
  const spread = A.philosophySpread[design.philosophy] ?? 0.09;
  const massFactors: Partial<Record<MassItemId, number>> = {};
  MASS_ITEMS.forEach((id, index) => {
    massFactors[id] = 1 + (BUILT.has(id) ? M.builtSpread : M.boughtSpread) * (2 * items[index]! - 1);
  });
  return {
    hidden: {
      emptyWeightFactor: 1 + material.bias + material.spread * (2 * w - 1),
      payloadFactor: 1 + spread * (2 * p - 1),
      bias: { emptyWeight: 2 * b1 - 1, payload: 2 * b2 - 1, takeoff: 2 * b3 - 1, stability: 2 * sm - 1 },
      massFactors,
      staticMarginOffset: A.staticMarginSpread * (2 * nextRandom(state).value - 1)
    },
    rngState: nextRandom(state).state
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
    // Peça parcial (Fase 8, S2) ainda não voa; peça quebrada também não.
    if (part.condition < 20 || part.partial !== undefined) continue;
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

/** Artigo de cada peça, para frases como "Falta o trem de pouso". */
const PART_ARTICLES: Record<PartType, string> = {
  wing: "a",
  fuselage: "a",
  tail: "a",
  landingGear: "o",
  powertrain: "o",
  electronics: "a"
};

/**
 * Frase do que falta para o avião voar, para warnings e inspeção: "Falta o trem de pouso." ou
 * "Faltam a asa e o trem de pouso."; null se está completo. Peça quebrada conta como faltando.
 */
export function missingPartsText(state: GameState): string | null {
  if (!state.aircraft) return "Falta o projeto da aeronave na prancheta.";
  const installed = installedParts(state);
  const missing = requiredParts(state.aircraft.design).filter((type) => !installed[type]);
  if (missing.length === 0) return null;
  const names = missing.map((type) => `${PART_ARTICLES[type]} ${PART_TYPE_LABELS[type].toLowerCase()}`);
  const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} e ${names.at(-1)!}`;
  const broken = missing.some((type) => state.parts.some((part) => part.type === type && part.partial === undefined));
  return `${names.length === 1 ? "Falta" : "Faltam"} ${list}${broken ? " (peça quebrada não conta)" : ""}.`;
}

/** Multiplicadores das peças instaladas sobre o modelo nominal (qualidade e falsificação). */
function partFactors(state: GameState): { weight: number; lift: number; power: number; condition: number } {
  const installedByType = installedParts(state);
  const installed = Object.values(installedByType).filter((part): part is Part => !!part);
  const ref = A.referenceQuality;
  const avgQuality = installed.length ? installed.reduce((sum, part) => sum + part.quality, 0) / installed.length : ref;
  const motor = installedByType.powertrain;
  return {
    weight: 1 + (ref - avgQuality) * A.weightPerQualityPoint,
    lift: 1 + ((installedByType.wing?.quality ?? ref) - ref) * A.liftPerQualityPoint,
    power:
      (A.powerAtZeroQuality + (1 - A.powerAtZeroQuality) * Math.min(1.2, (motor?.quality ?? ref) / ref)) *
      (motor?.counterfeit ? A.counterfeitPower : 1),
    condition: installed.length ? Math.min(...installed.map((part) => part.condition)) : 100
  };
}

const hiddenOf = (state: GameState): AircraftHidden => state.aircraft?.hidden ?? NEUTRAL_HIDDEN;

/** Massa real de cada subsistema para um projeto, com os desvios do avião da equipe e as peças. Nunca mostrar. */
function realMassItems(state: GameState, design: AircraftDesign): Record<MassItemId, number> {
  const hidden = hiddenOf(state);
  const parts = partFactors(state).weight;
  const nominal = nominalMassItems(design);
  const out = { ...nominal };
  for (const id of MASS_ITEMS) {
    const material = BUILT.has(id) ? hidden.emptyWeightFactor : 1;
    out[id] = nominal[id] * (hidden.massFactors?.[id] ?? 1) * material * parts;
  }
  return out;
}

/** Margem estática real, % CMA. Nunca mostrar. */
function realStaticMargin(state: GameState, design: AircraftDesign): number {
  return nominalStaticMargin(design) + (hiddenOf(state).staticMarginOffset ?? 0);
}

/**
 * Avião real de um projeto qualquer (gravado ou rascunho) com os desvios escondidos do avião
 * da equipe e as peças do hangar. Sem avião ainda, usa o nominal. Nunca mostrar.
 */
export function designFlightModel(state: GameState, design: AircraftDesign): FlightModel {
  const hidden = hiddenOf(state);
  const parts = partFactors(state);
  const items = realMassItems(state, design);
  const margin = realStaticMargin(state, design);
  return {
    emptyWeightKg: MASS_ITEMS.reduce((sum, id) => sum + items[id], 0),
    liftCapacityKg: nominalLiftCapacityKg(design, margin) * hidden.payloadFactor * parts.lift,
    span: design.span,
    wingAreaM2: wingAreaM2(design),
    surfaces: design.surfaces,
    powerW: design.powerW * parts.power,
    peakPowerW: design.powerW,
    liftFactor: liftFactor(design),
    takeoffFactor: takeoffFactor(design, margin),
    gear: design.gear,
    stability: stabilityFromMargin(design, margin),
    condition: parts.condition
  };
}

/** Avião real da equipe: projeto × desvios escondidos × peças instaladas. Nunca mostrar. */
export function playerFlightModel(state: GameState): FlightModel | null {
  return state.aircraft ? designFlightModel(state, state.aircraft.design) : null;
}

// ---------------------------------------------------------------------------
// Prancheta
// ---------------------------------------------------------------------------

const DESIGN_KEYS: readonly (keyof AircraftDesign)[] = [
  "span",
  "surfaces",
  "powerW",
  "philosophy",
  "material",
  "gear",
  "chordM",
  "wingPosition",
  "tailVolume",
  "cgPercentMac",
  "propDiameterIn"
];

export const sameDesign = (a: AircraftDesign, b: AircraftDesign) => DESIGN_KEYS.every((key) => a[key] === b[key]);

const VIDEO_DEADLINE = dateToHours(OFFICIAL_CALENDAR.find((item) => item.id === "flight-video")!.date);

const RANGE_LABELS: Record<keyof typeof DESIGN_LIMITS, [string, string]> = {
  span: ["Envergadura", "m"],
  powerW: ["Potência", "W"],
  chordM: ["Corda", "m"],
  tailVolume: ["Volume de cauda", ""],
  cgPercentMac: ["Posição do CG", "% CMA"],
  propDiameterIn: ["Hélice", "pol."]
};

/** Primeiro problema do projeto na prancheta (fora dos limites, hélice grande para o trem); null se ok. */
export function designProblem(design: AircraftDesign): string | null {
  for (const key of Object.keys(DESIGN_LIMITS) as (keyof typeof DESIGN_LIMITS)[]) {
    const { min, max } = DESIGN_LIMITS[key];
    const value = design[key];
    if (!(typeof value === "number" && value >= min && value <= max)) {
      const [label, unit] = RANGE_LABELS[key];
      return `${label} fora da prancheta (${min} a ${max}${unit ? ` ${unit}` : ""}).`;
    }
  }
  const prop = maxPropDiameterIn(design.gear);
  if (design.propDiameterIn > prop) {
    return `Hélice de ${design.propDiameterIn}" bate no chão com o trem ${design.gear === "low" ? "baixo" : "alto"} (máximo ${prop}").`;
  }
  return null;
}

export function setDesign(state: GameState, design: AircraftDesign): GameState {
  if (!regulationPublished(state)) return warn(state, "Aguardando regulamento (9/fev): a Prancheta abre quando ele for publicado.");
  const problem = designProblem(design);
  if (problem) return warn(state, problem);
  const current = state.aircraft;
  if (current) {
    if (sameDesign(current.design, design)) return state;
    // Mudar o projeto invalida parte dos ensaios; depois de 27/set conta como alteração tardia (Apêndice 6).
    return {
      ...state,
      aircraft: {
        ...current,
        design,
        evidence: keptEvidence(current.evidence ?? NO_EVIDENCE),
        lateChanges: current.lateChanges + (state.clock.hours > VIDEO_DEADLINE ? 1 : 0)
      }
    };
  }
  const { hidden, rngState } = drawHidden(state.rngState, design);
  return { ...state, rngState, aircraft: { design, hidden, lateChanges: 0, evidence: { ...NO_EVIDENCE }, flightVideoAt: null } };
}

function keptEvidence(evidence: AircraftEvidence): AircraftEvidence {
  const kept = A.redesignEvidenceKept;
  return {
    emptyWeight: evidence.emptyWeight * kept,
    payload: evidence.payload * kept,
    takeoff: evidence.takeoff * kept,
    stability: (evidence.stability ?? 0) * kept
  };
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

/**
 * Margens relativas atuais (fração do valor real) de peso vazio, carga e corrida, e a margem
 * da margem estática em % CMA. Para um rascunho diferente do gravado, os ensaios valem só em parte.
 */
export function relativeMargins(
  state: GameState,
  design: AircraftDesign | null = state.aircraft?.design ?? null
): { emptyWeight: number; payload: number; takeoff: number; staticMargin: number } {
  const saved = state.aircraft;
  const raw = saved?.evidence ?? NO_EVIDENCE;
  const evidence = saved && design && !sameDesign(saved.design, design) ? keptEvidence(raw) : raw;
  const weighed = state.equipment.includes("scale") && missingParts(state).length === 0 ? A.scaleEvidence : 0;
  const aero = (teamKnowledge(state, "aerodynamics") + teamKnowledge(state, "performance")) / 2;
  return {
    emptyWeight: A.margin.emptyWeight * knowledgeFactor(teamKnowledge(state, "structures")) * testFactor(evidence.emptyWeight + weighed),
    payload: A.margin.payload * knowledgeFactor(aero) * testFactor(evidence.payload),
    takeoff: A.margin.takeoff * knowledgeFactor(teamKnowledge(state, "performance")) * testFactor(evidence.takeoff + 0.5 * evidence.payload),
    staticMargin: A.staticMarginMargin * knowledgeFactor(teamKnowledge(state, "stability")) * testFactor(evidence.stability ?? 0)
  };
}

const biased = (real: number, margin: number, bias: number): Estimate => ({
  value: Math.max(0, real + bias * margin * A.biasShare),
  margin
});

const biasOf = (state: GameState) => ({ emptyWeight: 0, payload: 0, takeoff: 0, stability: 0, ...(state.aircraft?.hidden.bias ?? {}) });

/**
 * O que a equipe acha de um projeto (gravado ou rascunho) numa altitude densidade: valor ± margem.
 * Usa os desvios do avião da equipe; sem avião, o nominal.
 */
export function estimateDesign(state: GameState, design: AircraftDesign, densityAltitudeM: number): PerformanceEstimate {
  const model = designFlightModel(state, design);
  const bias = biasOf(state);
  const rel = relativeMargins(state, design);

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

/**
 * O que a equipe acha do avião gravado numa altitude densidade (design §6.2): valor ± margem.
 * O real fica dentro da faixa; com margem zero, a estimativa é o real. null sem projeto.
 */
export function estimatePerformance(state: GameState, densityAltitudeM: number): PerformanceEstimate | null {
  return state.aircraft ? estimateDesign(state, state.aircraft.design, densityAltitudeM) : null;
}

/**
 * Orçamento de massa por subsistema (design §6.4). Com `state`, é a estimativa da equipe (mesma
 * margem relativa e mesmo viés do peso vazio): a soma dá o peso vazio de estimatePerformance.
 * Sem `state`, o nominal do projeto com a margem de partida (sem conhecimento nem ensaios).
 */
export function massBudget(design: AircraftDesign, state?: GameState): MassBudget {
  const real = state ? realMassItems(state, design) : nominalMassItems(design);
  const rel = state ? relativeMargins(state, design).emptyWeight : A.margin.emptyWeight;
  const bias = state ? biasOf(state).emptyWeight : 0;
  const items = MASS_ITEMS.map((id) => {
    const margin = real[id] * rel;
    return { id, label: MASS_ITEM_LABELS[id], kg: { value: real[id] + bias * margin * A.biasShare, margin } };
  });
  const total = items.reduce((sum, item) => ({ value: sum.value + item.kg.value, margin: sum.margin + item.kg.margin }), { value: 0, margin: 0 });
  return { items, total };
}

/**
 * Ponto neutro e margem estática estimados (design §6.5), % CMA. O CG é a escolha da prancheta;
 * a incerteza está em onde fica o ponto neutro (e em onde o CG cai de fato). Com `state`, a
 * estimativa da equipe; sem, o nominal com a margem de partida.
 */
export function stabilityEstimate(design: AircraftDesign, state?: GameState): StabilityEstimate {
  const margin = state ? relativeMargins(state, design).staticMargin : A.staticMarginMargin;
  const real = state ? realStaticMargin(state, design) : nominalStaticMargin(design);
  const value = real + (state ? biasOf(state).stability : 0) * margin * A.biasShare;
  const status = statusInRange(value, margin);
  return {
    neutralPointPercentMac: { value: value + design.cgPercentMac, margin },
    staticMarginPercentMac: { value, margin },
    cgPercentMac: design.cgPercentMac,
    status
  };
}

/** ok se a faixa toda cabe em `ok`; falha se o valor central sai de `risk`; senão risco. */
function statusInRange(value: number, margin: number): RequirementStatus {
  const central = staticMarginStatus(value);
  if (central !== "ok") return central;
  return staticMarginStatus(value - margin) === "ok" && staticMarginStatus(value + margin) === "ok" ? "ok" : "risk";
}

// ---------------------------------------------------------------------------
// Ensaios de bancada (design §7.3). O voo virou evento agendado (flightTests.ts).
// ---------------------------------------------------------------------------

/** O que o ensaio precisa ter no hangar; null se pode começar. */
export function testProblem(state: GameState, kind: TestKind): string | null {
  if (!state.aircraft) return "Defina o projeto na prancheta antes de ensaiar.";
  const installed = installedParts(state);
  if (kind === "structural") return installed.wing ? null : "O ensaio estrutural precisa de uma asa inteira.";
  if (kind === "thrust") return installed.powertrain ? null : "O ensaio de bancada precisa do grupo motopropulsor.";
  const missing = missingPartsText(state);
  return missing === null ? null : `Avião incompleto para voar. ${missing}`;
}

/** Disciplinas cujo capítulo pode citar o ensaio (11.1: Estruturas e ensaios estruturais etc.). */
export const TEST_CITES: Record<TestKind, Discipline[]> = {
  structural: ["structures", "loads"],
  thrust: ["electrical", "performance"],
  flight: ["performance", "aerodynamics", "stability"],
  video: []
};

export function damageParts(state: GameState, ids: Set<string>, amount: (part: Part) => number): GameState {
  return { ...state, parts: state.parts.map((part) => (ids.has(part.id) ? { ...part, condition: clamp(part.condition - amount(part)) } : part)) };
}

/** Soma um ensaio citado nos capítulos que o ensaio alimenta. */
export function citeTest(state: GameState, kind: TestKind): GameState {
  const chapters = { ...state.report.chapters };
  for (const discipline of TEST_CITES[kind]) {
    chapters[discipline] = { ...chapters[discipline], testsCited: chapters[discipline].testsCited + 1 };
  }
  return { ...state, report: { ...state.report, chapters } };
}

/**
 * Efeito de um ensaio de bancada concluído: soma evidência (× rendimento), sorteia de novo o erro
 * da opinião da equipe, cita o ensaio nos capítulos e desgasta ou danifica a peça usada.
 * `quality` é a qualidade de quem conduziu (0–100). Devolve o texto da inbox.
 */
export function applyTest(
  state: GameState,
  kind: "structural" | "thrust",
  quality: number,
  multiplier: number
): { state: GameState; body: string; incident: boolean | null } {
  const aircraft = state.aircraft;
  const problem = testProblem(state, kind);
  if (!aircraft || problem) return { state, body: `O ensaio não aconteceu: ${problem ?? "sem avião"}`, incident: null };
  const T = BALANCE.tests;
  const installed = installedParts(state);
  let rngState = state.rngState;
  const roll = () => {
    const r = nextRandom(rngState);
    rngState = r.state;
    return r.value;
  };
  const evidence = { ...NO_EVIDENCE, ...(aircraft.evidence ?? {}) };
  const bias = { ...biasOf(state) };
  let next: GameState = state;
  let body: string;

  // Incidente: chance base cai com a qualidade de quem conduz e sobe com peça gasta (design §7.2).
  const used = kind === "structural" ? installed.wing! : installed.powertrain!;
  const base = kind === "structural" ? T.structural.breakChance : 0;
  const chance = base * (1 - clamp(quality) / 100) * (1 + (100 - used.condition) / 100);
  const incident = base > 0 && roll() < chance;

  if (kind === "structural") {
    evidence.emptyWeight += T.structural.evidence * multiplier;
    bias.emptyWeight = 2 * roll() - 1;
    next = damageParts(next, new Set([used.id]), () => (incident ? T.structural.breakDamage : T.structural.wear));
    body = incident
      ? `A asa cedeu antes da carga de projeto. ${used.label} danificada, mas o ensaio mostrou onde reforçar.`
      : "Asa carregada até a carga de projeto sem falha. Peso e limite estrutural mais claros.";
  } else {
    const stand = state.equipment.includes("thrust-stand");
    evidence.takeoff += (stand ? T.thrust.standEvidence : T.thrust.evidence) * multiplier;
    bias.takeoff = 2 * roll() - 1;
    next = damageParts(next, new Set([used.id]), () => T.thrust.wear);
    const model = playerFlightModel(state)!;
    body = stand
      ? `Bancada de tração: o grupo motopropulsor entrega ~${Math.round(model.powerW / 10) * 10} W.`
      : "Ensaio de motor e hélice sem bancada dedicada: dá uma ideia da tração, sem precisão.";
  }

  next = citeTest({ ...next, rngState }, kind);
  next = { ...next, aircraft: { ...next.aircraft!, evidence, hidden: { ...next.aircraft!.hidden, bias } } };
  return { state: next, body, incident };
}
