// Competição de voo (design §9). Frente: Simulação (Fase 3).

import { densityAltitude } from "./scoring";
import { warn } from "./tasks";
import type { GameState, Standing } from "./types";

/** Revisar a carga exige pelo menos este número de equipes à frente na fila (R[10.1.5.3]). */
export const MIN_TEAMS_AHEAD_TO_REVISE = 3;

/** Altitude densidade agora na pista (Apêndice 4); null fora da competição. */
export function currentDensityAltitude(state: GameState): number | null {
  const weather = state.competition?.weather;
  return weather ? densityAltitude(weather.temperatureK, weather.pressureHpa) : null;
}

/**
 * Equipes à frente da sua na fila da bateria atual; null se você não está na fila.
 * STUB (contrato da Fase 3): a frente de Simulação implementa.
 */
export function teamsAhead(state: GameState): number | null {
  void state;
  return null;
}

/**
 * Placar: melhor bateria + BCF + projeto − penalidades (design §9.3), ordenado.
 * STUB (contrato da Fase 3): a frente de Simulação implementa.
 */
export function standings(state: GameState): Standing[] {
  void state;
  return [];
}

/**
 * Escolhe a carga da sua próxima decolagem. Recusa com menos de MIN_TEAMS_AHEAD_TO_REVISE
 * equipes à frente (a carga já escolhida fica valendo).
 * STUB (contrato da Fase 3): a frente de Simulação implementa.
 */
export function setBatteryPayload(state: GameState, payloadKg: number): GameState {
  void payloadKg;
  return warn(state, "Competição ainda não disponível nesta versão.");
}

/**
 * Só em dev: pula para o dia da competição com equipe, avião, relatório e previsões prontos.
 * STUB (contrato da Fase 3): a frente de Simulação implementa.
 */
export function devStartCompetition(state: GameState): GameState {
  return warn(state, "Atalho de competição ainda não disponível nesta versão.");
}
