// Relatório, plantas e previsões do Portal da CT (design §6.2 e §9.1). Frente: Simulação (Fase 3).

import { DISCIPLINES } from "./state";
import { warn } from "./tasks";
import type { Discipline, Estimate, GameState, PayloadLine, ReportChapter, ReportState } from "./types";

export function createReport(): ReportState {
  const chapters = Object.fromEntries(
    DISCIPLINES.map((discipline) => [discipline, { hours: 0, testsCited: 0 }])
  ) as Record<Discipline, ReportChapter>;
  return {
    chapters,
    drawingsHours: 0,
    predictedEmptyWeightKg: null,
    payloadLine: null,
    submittedAt: null,
    score: null,
    oralScore: null
  };
}

/** Rascunho das previsões (FPV e PAC, 7.7 e 11.6). Recusa depois do envio. */
export function setPredictions(
  state: GameState,
  predictions: { emptyWeightKg?: number; payloadLine?: PayloadLine }
): GameState {
  if (state.report.submittedAt !== null) return warn(state, "O relatório já foi enviado: as previsões estão congeladas.");
  const { emptyWeightKg, payloadLine } = predictions;
  if (emptyWeightKg !== undefined && !(emptyWeightKg > 0)) return warn(state, "Peso vazio previsto precisa ser positivo.");
  return {
    ...state,
    report: {
      ...state.report,
      predictedEmptyWeightKg: emptyWeightKg ?? state.report.predictedEmptyWeightKg,
      payloadLine: payloadLine ?? state.report.payloadLine
    }
  };
}

/**
 * Envio no Portal da CT: congela previsões e sorteia NR. Também acontece sozinho no prazo de 16/ago.
 * STUB (contrato da Fase 3): a frente de Simulação implementa.
 */
export function submitReport(state: GameState): GameState {
  return warn(state, "Envio do relatório ainda não disponível nesta versão.");
}

/**
 * Nota esperada do relatório (NR, 0–185) com a margem de erro da equipe.
 * STUB (contrato da Fase 3): a frente de Simulação implementa.
 */
export function estimateReportScore(state: GameState): Estimate | null {
  void state;
  return null;
}
