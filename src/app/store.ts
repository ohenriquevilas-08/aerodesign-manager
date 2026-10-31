// Store único do jogo: guarda o GameState, aplica comandos e faz o relógio correr.
// Preact e Phaser leem por subscribe/getState e escrevem só por dispatch.

import { applyCommand, createGame, type ClockSpeed, type Command, type GameState } from "../sim";

type Listener = (state: GameState) => void;

export interface GameStore {
  getState(): GameState;
  dispatch(command: Command): void;
  subscribe(listener: Listener): () => void;
  /** Pausa ou retoma na última velocidade usada. */
  togglePause(): void;
  setSpeed(speed: ClockSpeed): void;
}

export function createStore(initial: GameState): GameStore {
  let state = initial;
  let lastSpeed: ClockSpeed = 1;
  const listeners = new Set<Listener>();

  const dispatch = (command: Command) => {
    const next = applyCommand(state, command);
    if (next === state) return;
    state = next;
    listeners.forEach((listener) => listener(state));
  };

  return {
    getState: () => state,
    dispatch,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    togglePause() {
      dispatch({ type: "set-speed", speed: state.clock.speed === 0 ? lastSpeed : 0 });
    },
    setSpeed(speed) {
      if (speed !== 0) lastSpeed = speed;
      dispatch({ type: "set-speed", speed });
    }
  };
}

/** Faz o relógio andar com requestAnimationFrame. Retorna a função que para o loop. */
export function startClock(store: GameStore): () => void {
  let previous = performance.now();
  let frame = 0;
  const loop = (now: number) => {
    // Limita o passo para a aba voltar de segundo plano sem pular semanas.
    const realSeconds = Math.min(0.25, (now - previous) / 1000);
    previous = now;
    store.dispatch({ type: "tick", realSeconds });
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(frame);
}

export const store = createStore(createGame({ seed: 20260209, teamName: "Nova Equipe AeroDesign" }));
