// Escala da oficina no hangar (design §5.5). Funções puras (testadas em tests/scenes/):
// turno → iluminação e adereços; presentes → quem aparece e quem cochila de madrugada.
//
// STUB LOCAL: `currentShift` e `workshopNow` reproduzem o contrato que a Simulação está
// implementando. Quando `sim/index.ts` exportar os dois, apagar o bloco "stub" abaixo, importar
// de "../../sim" e manter o resto.

import { canWork, clockToDate, type GameState } from "../../sim";

export type Shift = "morning" | "afternoon" | "evening" | "overnight";

/** Dia da semana (0 = domingo), como Date.getUTCDay. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Formato de `currentShift`. */
export interface ShiftSlot {
  day: Weekday;
  shift: Shift;
}

/** Célula da grade da escala, ex.: "1-morning". */
export type SlotKey = `${Weekday}-${Shift}`;

export function slotKey(slot: ShiftSlot): SlotKey {
  return `${slot.day}-${slot.shift}`;
}

/** Turno de um SlotKey ("1-morning" → "morning"). */
export function shiftOfSlot(key: SlotKey | null): Shift | null {
  return key ? (key.slice(key.indexOf("-") + 1) as Shift) : null;
}

export interface WorkshopNow {
  slot: SlotKey | null;
  /** Integrantes na oficina agora. */
  present: string[];
  open: boolean;
  /** Motivo de a oficina estar parada (ex.: "Sem ninguém com chave"); null se não está. */
  blocked: string | null;
}

// ---------------------------------------------------------------- stub (trocar pela sim)

/** Turno da hora do dia (§5.5): manhã 8–12, tarde 13–18, noite 19–22, madrugada 22–3. */
export function shiftForHour(hour: number): Shift | null {
  if (hour >= 8 && hour < 12) return "morning";
  if (hour >= 13 && hour < 18) return "afternoon";
  if (hour >= 19 && hour < 22) return "evening";
  if (hour >= 22 || hour < 3) return "overnight";
  return null;
}

export function currentShift(state: GameState): ShiftSlot | null {
  const date = new Date(clockToDate(state.clock.hours));
  const shift = shiftForHour(date.getUTCHours() + date.getUTCMinutes() / 60);
  return shift ? { day: date.getUTCDay() as Weekday, shift } : null;
}

/** Sem escala ainda: em qualquer turno, quem trabalha está na oficina. */
export function workshopNow(state: GameState): WorkshopNow {
  const shift = currentShift(state);
  const present = shift ? state.members.filter(canWork).map((member) => member.id) : [];
  return { slot: shift ? slotKey(shift) : null, present, open: present.length > 0, blocked: null };
}

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
