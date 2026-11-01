// Comandos: a única forma de UI e cenas pedirem mudanças no estado.
// applyCommand é puro (estado novo, sem mutar o anterior).

import { setDesign } from "./aircraft";
import { setArea } from "./formation";
import { devStartCompetition, setBatteryPayload } from "./competition";
import { tick } from "./loop";
import { setPredictions, submitReport } from "./report";
import { payCustoms, placeOrder, type OrderRequest } from "./shop";
import { hireCandidate } from "./selection";
import { applySuggestedSchedule, grantKey, setShift } from "./workshop";
import { assignMember, cancelTask, startAction, unassignMember, warn } from "./tasks";
import type { AircraftDesign, ClockSpeed, Discipline, GameState, PayloadLine, SlotKey, TaskDedication } from "./types";

export type Command =
  | { type: "tick"; realSeconds: number }
  | { type: "set-speed"; speed: ClockSpeed }
  | { type: "read-message"; id: string }
  /**
   * targetId: disciplina (document), formato da seletiva (recruitment), id de peça (repair-part)
   * ou id de tarefa esperando (express-shipping).
   */
  /** dedication: "rush" | "normal" | "careful" (padrão "normal"); ver DEDICATIONS. */
  | { type: "start-action"; actionId: string; targetId?: string; dedication?: TaskDedication }
  | { type: "assign-member"; memberId: string; taskId: string }
  | { type: "unassign-member"; memberId: string }
  | { type: "cancel-task"; taskId: string }
  | { type: "hire-candidate"; candidateId: string }
  | { type: "dismiss-candidates" }
  // Fase 3 (docs/phases/fase-3.md)
  | { type: "set-design"; design: AircraftDesign }
  | { type: "set-predictions"; emptyWeightKg?: number; payloadLine?: PayloadLine }
  | { type: "submit-report" }
  | ({ type: "place-order" } & OrderRequest)
  | { type: "pay-customs"; orderId: string }
  | { type: "set-battery-payload"; payloadKg: number }
  // Escala da oficina (design §5.5);
  | { type: "set-shift"; memberId: string; slot: SlotKey; on: boolean }
  | { type: "apply-suggested-schedule" }
  | { type: "grant-key"; memberId: string }
  // Fase 4 (docs/phases/fase-4.md)
  /** area null = sem área; captain true ocupa a vaga de capitão da área. */
  | { type: "set-area"; memberId: string; area: Discipline | null; captain?: boolean }
  /** Só em dev: pula para o dia da competição com tudo pronto. */
  | { type: "dev-start-competition" };

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
      return startAction(state, command.actionId, command.targetId ?? null, command.dedication ?? "normal");
    case "assign-member":
      return assignMember(state, command.memberId, command.taskId);
    case "unassign-member":
      return unassignMember(state, command.memberId);
    case "cancel-task":
      return cancelTask(state, command.taskId);
    case "hire-candidate":
      return hireCandidate(state, command.candidateId) ?? warn(state, "Esse candidato não está mais disponível.");
    case "dismiss-candidates":
      return state.candidates.length === 0 ? state : { ...state, candidates: [] };
    case "set-design":
      return setDesign(state, command.design);
    case "set-predictions":
      return setPredictions(state, command);
    case "submit-report":
      return submitReport(state);
    case "place-order":
      return placeOrder(state, command);
    case "pay-customs":
      return payCustoms(state, command.orderId);
    case "set-battery-payload":
      return setBatteryPayload(state, command.payloadKg);
    case "set-shift":
      return setShift(state, command.memberId, command.slot, command.on);
    case "apply-suggested-schedule":
      return applySuggestedSchedule(state);
    case "set-area":
      return setArea(state, command.memberId, command.area, command.captain ?? false);
    case "grant-key":
      return grantKey(state, command.memberId);
    case "dev-start-competition":
      return devStartCompetition(state);
  }
}
