// Comandos: a única forma de UI e cenas pedirem mudanças no estado.
// applyCommand é puro (estado novo, sem mutar o anterior).

import { advanceClock } from "./time";
import type { ClockSpeed, GameState } from "./types";

export type Command =
  | { type: "tick"; realSeconds: number }
  | { type: "set-speed"; speed: ClockSpeed }
  | { type: "read-message"; id: string };

export function applyCommand(state: GameState, command: Command): GameState {
  switch (command.type) {
    case "tick": {
      const clock = advanceClock(state.clock, command.realSeconds);
      return clock === state.clock ? state : { ...state, clock };
    }
    case "set-speed":
      return state.clock.speed === command.speed ? state : { ...state, clock: { ...state.clock, speed: command.speed } };
    case "read-message":
      return {
        ...state,
        inbox: state.inbox.map((message) => (message.id === command.id ? { ...message, read: true } : message))
      };
  }
}
