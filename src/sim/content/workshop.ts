// Grade da oficina (design §5.5): turnos e dias da semana, com rótulos PT-BR.

import type { ShiftId, SlotKey, Weekday } from "../types";

export interface ShiftDef {
  id: ShiftId;
  label: string;
  /** Hora de início e de fim (fim > 24 = madrugada que entra no dia seguinte). */
  start: number;
  end: number;
  /** "8h–12h". */
  hours: string;
}

export const SHIFTS: readonly ShiftDef[] = [
  { id: "morning", label: "Manhã", start: 8, end: 12, hours: "8h–12h" },
  { id: "afternoon", label: "Tarde", start: 13, end: 18, hours: "13h–18h" },
  { id: "evening", label: "Noite", start: 19, end: 22, hours: "19h–22h" },
  { id: "overnight", label: "Madrugada", start: 22, end: 27, hours: "22h–3h" }
];

export interface WeekdayDef {
  id: Weekday;
  label: string;
  short: string;
}

export const WEEKDAYS: readonly WeekdayDef[] = [
  { id: 0, label: "Domingo", short: "Dom" },
  { id: 1, label: "Segunda", short: "Seg" },
  { id: 2, label: "Terça", short: "Ter" },
  { id: 3, label: "Quarta", short: "Qua" },
  { id: 4, label: "Quinta", short: "Qui" },
  { id: 5, label: "Sexta", short: "Sex" },
  { id: 6, label: "Sábado", short: "Sáb" }
];

export function slotKey(day: Weekday, shift: ShiftId): SlotKey {
  return `${day}-${shift}`;
}

export function parseSlot(slot: string): { day: Weekday; shift: ShiftId } | null {
  const match = /^([0-6])-(morning|afternoon|evening|overnight)$/.exec(slot);
  return match ? { day: Number(match[1]) as Weekday, shift: match[2] as ShiftId } : null;
}

export function findShift(id: ShiftId): ShiftDef {
  return SHIFTS.find((shift) => shift.id === id)!;
}
