// Comandos: a única forma de UI e cenas pedirem mudanças no estado.
// applyCommand é puro (estado novo, sem mutar o anterior).

import { tick } from "./loop";
import { assignMember, cancelTask, startAction, unassignMember } from "./tasks";
import type { ClockSpeed, GameState } from "./types";

export type Command =
  | { type: "tick"; realSeconds: number }
  | { type: "set-speed"; speed: ClockSpeed }
  | { type: "read-message"; id: string }
  /** targetId: disciplina (document), id de peça (repair-part) ou id de tarefa esperando (express-shipping). */
  | { type: "start-action"; actionId: string; targetId?: string }
  | { type: "assign-member"; memberId: string; taskId: string }
  | { type: "unassign-member"; memberId: string }
  | { type: "cancel-task"; taskId: string };

export function applyCommand(state: GameState, command: Command): GameState {
  switch (command.type) {
    case "tick":
      return tick(state, command.realSeconds);
    case "set-speed":
      if (state.clock.speed === command.speed) return state;
      return {
        ...state,
        clock: { ...state.clock, speed: command.speed },
        pause: command.speed === 0 ? { reason: "manual", at: state.clock.hours, messageId: null } : null
      };
    case "read-message":
      return {
        ...state,
        inbox: state.inbox.map((message) => (message.id === command.id ? { ...message, read: true } : message))
      };
    case "start-action":
      return startAction(state, command.actionId, command.targetId ?? null);
    case "assign-member":
      return assignMember(state, command.memberId, command.taskId);
    case "unassign-member":
      return unassignMember(state, command.memberId);
    case "cancel-task":
      return cancelTask(state, command.taskId);
  }
}
