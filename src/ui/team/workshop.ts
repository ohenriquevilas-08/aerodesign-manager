// Escala da oficina (design §5.5): adaptador fino entre a tela e a simulação.
// Regras e leituras vivem em src/sim; aqui só o hook que re-renderiza e o despacho de comandos.

import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import {
  currentShift,
  slotKey,
  slotStatus,
  suggestSchedule,
  SHIFTS,
  WEEKDAYS,
  workshopNow,
  type Member,
  type ShiftId,
  type SlotKey,
  type SlotStatus,
  type Weekday,
  type WorkshopState
} from "../../sim";

export { currentShift, slotKey, slotStatus, suggestSchedule, SHIFTS, WEEKDAYS };
export type { ShiftId, SlotKey, SlotStatus, Weekday, WorkshopState };

export interface SuggestedSchedule {
  schedule: Partial<Record<SlotKey, string[]>>;
  notes: string[];
}

export type WorkshopNowView = ReturnType<typeof workshopNow>;

export type WorkshopCommand =
  | { type: "set-shift"; memberId: string; slot: SlotKey; on: boolean }
  | { type: "apply-suggested-schedule" }
  | { type: "grant-key"; memberId: string };

/** Grade de aulas do semestre da pessoa. */
export const classSlotsOf = (member: Member): SlotKey[] => member.classSlots;

export function workshopCommand(command: WorkshopCommand): void {
  store.dispatch(command);
}

/** Escala atual + turno em andamento, re-renderizando quando a escala, a hora ou as tarefas mudam. */
export function useWorkshop(): { workshop: WorkshopState; now: WorkshopNowView } {
  useGame((state) => state.workshop);
  // Turno muda no máximo a cada hora de jogo; tarefas mudam o "blocked".
  useGame((state) => Math.floor(state.clock.hours));
  useGame((state) => state.tasks);
  const state = store.getState();
  return { workshop: state.workshop, now: workshopNow(state) };
}
