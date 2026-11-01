// Escala da oficina no hangar (design §5.5). Funções puras (testadas em tests/scenes/):
// turno → iluminação e adereços; presentes → quem aparece e quem cochila de madrugada.
// Quem está na oficina e o turno vêm da simulação (currentShift, workshopNow).

import { currentShift, workshopNow, type ShiftId, type SlotKey, type Weekday } from "../../sim";

export { currentShift, workshopNow };

export type Shift = ShiftId;
export type { SlotKey, Weekday };

/** Formato de `currentShift`. */
export interface ShiftSlot {
  day: Weekday;
  shift: Shift;
}

export function slotKey(slot: ShiftSlot): SlotKey {
  return `${slot.day}-${slot.shift}`;
}

/** Turno de um SlotKey ("1-morning" → "morning"). */
export function shiftOfSlot(key: SlotKey | null): Shift | null {
  return key ? (key.slice(key.indexOf("-") + 1) as Shift) : null;
}

export type WorkshopNow = ReturnType<typeof workshopNow>;

// ---------------------------------------------------------------- iluminação

export type LightMode = "day" | "evening" | "overnight" | "closed";

export interface WorkshopLighting {
  mode: LightMode;
  /** Escurecimento do ambiente sobre o piso e as paredes, 0–1. */
  dim: number;
  /** Janelas escuras (noite lá fora). */
  darkWindows: boolean;
  /** Luminárias acesas, com halo de luz quente. */
  lampsOn: boolean;
  /** Café, caixa de pizza e alguém cochilando no canto. */
  overnightProps: boolean;
}

/**
 * Manhã e tarde: luz do dia. Noite: luz acesa, janela escura. Madrugada: o mesmo, mais escuro
 * fora das luminárias, com café e pizza. Oficina fechada (ninguém) fica escura; se for noite
 * lá fora, as janelas também.
 */
export function lightingFor(shift: Shift | null, open: boolean, hour: number): WorkshopLighting {
  const nightOutside = hour >= 18.5 || hour < 6;
  if (!open) return { mode: "closed", dim: nightOutside ? 0.62 : 0.4, darkWindows: nightOutside, lampsOn: false, overnightProps: false };
  switch (shift) {
    case "evening":
      return { mode: "evening", dim: 0.22, darkWindows: true, lampsOn: true, overnightProps: false };
    case "overnight":
      return { mode: "overnight", dim: 0.34, darkWindows: true, lampsOn: true, overnightProps: true };
    default:
      return { mode: "day", dim: 0, darkWindows: false, lampsOn: false, overnightProps: false };
  }
}

// ---------------------------------------------------------------- quem aparece

/**
 * De madrugada, alguém cochila no canto: o primeiro presente que não está trabalhando numa
 * bancada (na área livre). Se todo mundo está numa bancada, ninguém cochila.
 */
export function overnightNapper(shift: Shift | null, workers: readonly { memberId: string; bench: string | null }[]): string | null {
  if (shift !== "overnight") return null;
  return workers.find((worker) => worker.bench === null)?.memberId ?? null;
}
