// Save em um slot de localStorage (Fase 4, S1). A serialização é pura (sim/save.ts).
// Salva sozinho a cada virada de dia de jogo e ao pausar. Sem migrações: versão diferente = descartado.

import { deserializeState, serializeState, type GameState } from "../sim";
import type { GameStore } from "./store";

export const SAVE_KEY = "aerodesign-manager:save";

type SaveStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const defaultStorage = (): SaveStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export interface LoadResult {
  /** O jogo salvo, ou null se não há save válido. */
  state: GameState | null;
  /** true quando havia um save, mas de versão antiga ou corrompido: foi apagado (a UI avisa). */
  discarded: boolean;
}

export function hasSave(storage: SaveStorage | null = defaultStorage()): boolean {
  try {
    return !!storage?.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function writeSave(state: GameState, storage: SaveStorage | null = defaultStorage()): boolean {
  try {
    storage?.setItem(SAVE_KEY, serializeState(state));
    return !!storage;
  } catch {
    return false;
  }
}

export function loadSave(storage: SaveStorage | null = defaultStorage()): LoadResult {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(SAVE_KEY) ?? null;
  } catch {
    return { state: null, discarded: false };
  }
  if (raw === null) return { state: null, discarded: false };
  const state = deserializeState(raw);
  if (state) return { state, discarded: false };
  clearSave(storage);
  return { state: null, discarded: true };
}

export function clearSave(storage: SaveStorage | null = defaultStorage()): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // Sem armazenamento: nada a apagar.
  }
}

/** Salva a cada virada de dia de jogo e quando o relógio pausa. Retorna a função que desliga. */
export function startAutosave(store: GameStore, storage: SaveStorage | null = defaultStorage()): () => void {
  const initial = store.getState();
  let day = Math.floor(initial.clock.hours / 24);
  let paused = initial.clock.speed === 0;
  return store.subscribe((next) => {
    const nextDay = Math.floor(next.clock.hours / 24);
    const nowPaused = next.clock.speed === 0;
    if (nextDay !== day || (nowPaused && !paused)) writeSave(next, storage);
    day = nextDay;
    paused = nowPaused;
  });
}
