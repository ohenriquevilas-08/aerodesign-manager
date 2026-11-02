// Rendimento das tarefas: o resultado depende de quem trabalhou e por quanto tempo.
// Qualidade da equipe = habilidade relevante da ação × motivação, ponderada pelas horas de cada um.
// Resultado = base × curva(qualidade) × (1 ± variação), e a variação estreita com a qualidade:
// equipe boa é consistente, equipe fraca é loteria. O sorteio usa rngState.

import { findAction, type ActionDef } from "./content/actions";
import { BALANCE } from "./content/balance";
import { findDedication, type Dedication } from "./content/dedication";
import { crewRates } from "./crew";
import { expectedApplicants, findSelectionFormat } from "./selection";
import { nextRandom } from "./rng";
import { DISCIPLINES } from "./state";
import { clamp, DISCIPLINE_LABELS, effectiveKnowledge, motivationFactor } from "./team";
import { clockToDate } from "./time";
import type { Discipline, GameState, Member } from "./types";

const isDiscipline = (value: string | null | undefined): value is Discipline =>
  value != null && (DISCIPLINES as readonly string[]).includes(value);

/** Disciplina usada pela habilidade "knowledge": a da ação ou a escolhida como alvo (document). */
function knowledgeDiscipline(action: ActionDef, targetId: string | null): Discipline | null {
  if (action.discipline) return action.discipline;
  return isDiscipline(targetId) ? targetId : null;
}

/** Valor 0–100 da habilidade que a ação usa, para um integrante. */
export function skillValue(member: Member, action: ActionDef, targetId: string | null, documented: Record<Discipline, number>): number {
  switch (action.skill) {
    case undefined:
      return 50;
    case "fabrication":
      return member.fabrication;
    case "agility":
      return member.agility;
    case "piloting":
      return member.piloting;
    case "communication":
      return member.communication;
    case "knowledge": {
      const discipline = knowledgeDiscipline(action, targetId);
      return discipline ? effectiveKnowledge(member, documented, discipline) : 0;
    }
  }
}

/** Qualidade 0–100 da equipe na tarefa, ponderada pelas horas (`weights`) de cada integrante. */
export function crewQuality(
  state: GameState,
  action: ActionDef,
  targetId: string | null,
  weights: Record<string, number>
): number {
  let total = 0;
  let weight = 0;
  for (const member of state.members) {
    const hours = weights[member.id] ?? 0;
    if (hours <= 0) continue;
    total += skillValue(member, action, targetId, state.documented) * motivationFactor(member.motivation) * hours;
    weight += hours;
  }
  return weight > 0 ? clamp(total / weight) : 0;
}

export interface OutcomeBand {
  /** Multiplicador esperado do resultado base. */
  expected: number;
  min: number;
  max: number;
}

/** Faixa de multiplicadores para uma qualidade (BALANCE.outcome). */
export function outcomeBand(quality: number): OutcomeBand {
  const o = BALANCE.outcome;
  const q = clamp(quality) / 100;
  const expected = o.curveAtZero + (o.curveAtFull - o.curveAtZero) * q;
  const spread = o.maxSpread * (1 - q);
  return { expected, min: expected * (1 - spread), max: expected * (1 + spread) };
}

/** Sorteia o multiplicador dentro da faixa (uniforme). */
export function rollMultiplier(rngState: number, quality: number): { multiplier: number; rngState: number } {
  const band = outcomeBand(quality);
  const roll = nextRandom(rngState);
  return { multiplier: band.min + (band.max - band.min) * roll.value, rngState: roll.state };
}

/** Chance de o patrocinador aceitar, pela qualidade da conversa. */
export function sponsorChance(quality: number): number {
  const s = BALANCE.sponsor;
  return s.chanceAtZero + (s.chanceAtFull - s.chanceAtZero) * (clamp(quality) / 100);
}

/** Pontos de acervo que "Documentar" converte com esse multiplicador. */
export function documentGain(best: number, current: number, multiplier: number): number {
  return Math.max(0, best - current) * Math.min(1, BALANCE.knowledge.documentTransfer * multiplier);
}

export const fabricatedQuality = (multiplier: number, equipment: readonly string[]): number =>
  Math.round(
    clamp(
      BALANCE.parts.fabricatedQualityBase * multiplier +
        equipment.reduce((sum, item) => sum + (BALANCE.parts.equipmentQualityBonus[item] ?? 0), 0)
    )
  );

/** Faixa de inscritos: alcance × qualidade de quem conduz × incerteza própria (BALANCE.outreach). */
export function applicantBand(expected: number, quality: number): { min: number; expected: number; max: number } {
  const band = outcomeBand(quality);
  const spread = BALANCE.outreach.applicantSpread;
  return {
    min: Math.max(0, Math.floor(expected * band.min * (1 - spread))),
    expected: expected * band.expected,
    max: Math.ceil(expected * band.max * (1 + spread))
  };
}

/** Sorteia o número de inscritos com o multiplicador já sorteado e mais um sorteio de incerteza. */
export function rollApplicants(rngState: number, expected: number, multiplier: number): { count: number; rngState: number } {
  const spread = BALANCE.outreach.applicantSpread;
  const roll = nextRandom(rngState);
  return { count: Math.max(0, Math.round(expected * multiplier * (1 - spread + 2 * spread * roll.value))), rngState: roll.state };
}

export interface OutcomeEstimate {
  /** Qualidade 0–100 da equipe escolhida. */
  quality: number;
  /** Faixa do resultado, na unidade do efeito (créditos, qualidade, condição, pontos de acervo). */
  min: number;
  expected: number;
  max: number;
  /** Só no patrocínio: chance de dar certo (0–1); min/expected/max valem se der certo. */
  chance?: number;
  /** Resumo pronto para o cartão, em PT-BR. */
  text: string;
}

const range = (min: number, max: number) => (Math.round(min) === Math.round(max) ? `${Math.round(min)}` : `${Math.round(min)}–${Math.round(max)}`);

/**
 * Resultado esperado se a ação começar agora com esses integrantes (pesos = rendimento de hoje).
 * null: a ação não tem resultado variável, a equipe não faz a tarefa andar, ou falta o alvo.
 */
export function estimateOutcome(
  state: GameState,
  actionId: string,
  memberIds: readonly string[],
  targetId: string | null = null,
  dedication: Dedication = "normal"
): OutcomeEstimate | null {
  const action = findAction(actionId);
  if (!action?.effect) return null;
  const team = memberIds.map((id) => state.members.find((member) => member.id === id)).filter((m): m is Member => !!m);
  const weights: Record<string, number> = {};
  crewRates(team, action.crew, clockToDate(state.clock.hours)).forEach((rate, id) => (weights[id] = rate));
  if (Object.keys(weights).length === 0) return null;

  const quality = clamp(crewQuality(state, action, targetId, weights) + findDedication(dedication).qualityBonus);
  const band = outcomeBand(quality);
  const scale = (base: number) => ({ min: base * band.min, expected: base * band.expected, max: base * band.max });
  const effect = action.effect;

  switch (effect.kind) {
    case "credits": {
      const values = scale(effect.amount);
      return { quality, ...values, text: `◆ ${range(values.min, values.max)}` };
    }
    case "sponsor": {
      const values = scale(BALANCE.sponsor.amount);
      const chance = sponsorChance(quality);
      return { quality, ...values, chance, text: `${Math.round(chance * 100)}% de chance de ◆ ${range(values.min, values.max)}` };
    }
    case "fabricate": {
      const min = fabricatedQuality(band.min, state.equipment);
      const max = fabricatedQuality(band.max, state.equipment);
      return { quality, min, expected: fabricatedQuality(band.expected, state.equipment), max, text: `Qualidade ${range(min, max)}` };
    }
    case "outreach": {
      const values = scale(effect.amount);
      return { quality, ...values, text: `Alcance +${range(values.min, values.max)}` };
    }
    case "selection-open": {
      if (!findSelectionFormat(targetId)) return null;
      // O que a divulgação desta tarefa soma ao alcance entra na conta (Fase 9, S1).
      const values = applicantBand(expectedApplicants(state, targetId, effect.amount * band.expected), quality);
      return { quality, ...values, text: `Inscritos estimados ${range(values.min, values.max)}` };
    }
    case "repair": {
      const values = scale(effect.amount);
      return { quality, ...values, text: `+${range(values.min, values.max)} de condição` };
    }
    case "document": {
      if (!isDiscipline(targetId)) return null;
      const best = Math.max(0, ...team.map((member) => member.knowledge[targetId]));
      const current = state.documented[targetId];
      const min = documentGain(best, current, band.min);
      const max = documentGain(best, current, band.max);
      return {
        quality,
        min,
        expected: documentGain(best, current, band.expected),
        max,
        text: `Acervo de ${DISCIPLINE_LABELS[targetId]} +${range(min, max)}`
      };
    }
    default:
      return null;
  }
}
