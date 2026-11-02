// Serialização do estado (Fase 4, S1). Puro: quem guarda é a camada app (app/save.ts).
// Sem migrações: versão diferente ou JSON inválido = save descartado.

import type { GameState } from "./types";

/** Versão do formato; sobe a cada mudança incompatível do GameState. */
export const SAVE_VERSION = 10;

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

/** `null` se o JSON é inválido, a versão não bate ou faltam as peças básicas do estado. */
export function deserializeState(json: string): GameState | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const state = data as Partial<GameState>;
  if (state.version !== SAVE_VERSION) return null;
  const sound =
    typeof state.seed === "number" &&
    typeof state.rngState === "number" &&
    typeof state.clock?.hours === "number" &&
    typeof state.credits === "number" &&
    Array.isArray(state.members) &&
    Array.isArray(state.tasks) &&
    Array.isArray(state.orders) &&
    Array.isArray(state.ledger) &&
    Array.isArray(state.news) &&
    Array.isArray(state.testLog) &&
    Array.isArray(state.flightTests) &&
    typeof state.workshop === "object" &&
    state.workshop !== null &&
    typeof state.report === "object" &&
    state.report !== null;
  return sound ? (data as GameState) : null;
}
