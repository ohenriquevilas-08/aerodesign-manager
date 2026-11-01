// Escala da oficina (design §5.5): adaptador entre a tela e a simulação.
//
// STUB LOCAL: o contrato (tipos, comandos e leituras abaixo) é o combinado com a frente de
// Simulação, mas ainda não existe em src/sim. Até lá, este arquivo guarda a escala em memória
// e imita as regras principais. Quando a sim chegar:
//   1. apagar os tipos e helpers daqui e reexportar de "../../sim";
//   2. readWorkshop → state.workshop; classSlotsOf → member.classSlots;
//   3. workshopCommand → store.dispatch (set-shift, apply-suggested-schedule, grant-key) e
//      start-action "night-access-request";
//   4. slotStatus, suggestSchedule, currentShift e workshopNow → as da sim.
// Nada fora deste arquivo precisa mudar.

import { useEffect, useState } from "preact/hooks";
import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import { academicFactor, clockToDate, findAction, type GameState, type Member } from "../../sim";

// ---------------------------------------------------------------------------------------------
// Contrato

export type ShiftId = "morning" | "afternoon" | "evening" | "overnight";
/** 0 = domingo. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type SlotKey = `${Weekday}-${ShiftId}`;
export type NightAccess = "none" | "requested" | "granted";
export type SlotStatus = "free" | "class" | "exam" | "locked";

export interface WorkshopState {
  capacity: number;
  keyHolders: string[];
  nightAccess: NightAccess;
  schedule: Partial<Record<SlotKey, string[]>>;
}

export interface SuggestedSchedule {
  schedule: Partial<Record<SlotKey, string[]>>;
  notes: string[];
}

export interface WorkshopNowView {
  slot: SlotKey | null;
  present: string[];
  open: boolean;
  /** Por que a oficina está parada agora; null se aberta ou fora de turno sem tarefa. */
  blocked: string | null;
}

export type WorkshopCommand =
  | { type: "set-shift"; memberId: string; slot: SlotKey; on: boolean }
  | { type: "apply-suggested-schedule" }
  | { type: "grant-key"; memberId: string }
  | { type: "night-access-request" };

export const SHIFTS: readonly { id: ShiftId; label: string; hours: string; from: number; to: number }[] = [
  { id: "morning", label: "Manhã", hours: "8h–12h", from: 8, to: 12 },
  { id: "afternoon", label: "Tarde", hours: "13h–18h", from: 13, to: 18 },
  { id: "evening", label: "Noite", hours: "19h–22h", from: 19, to: 22 },
  { id: "overnight", label: "Madrugada", hours: "22h–3h", from: 22, to: 27 }
];

export const WEEKDAYS: readonly { id: Weekday; label: string; short: string }[] = [
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

// ---------------------------------------------------------------------------------------------
// Stub: estado em memória

const local = {
  workshop: null as WorkshopState | null,
  listeners: new Set<() => void>()
};

function initialWorkshop(state: GameState): WorkshopState {
  return {
    capacity: 4,
    keyHolders: state.members.filter((member) => member.role === "captain").map((member) => member.id),
    nightAccess: "none",
    schedule: {}
  };
}

export function readWorkshop(state: GameState): WorkshopState {
  local.workshop ??= initialWorkshop(state);
  return local.workshop;
}

/** Grade de aulas da pessoa. Stub: sorteio fixo pelo id (seg–sex, manhã/tarde/noite). */
export function classSlotsOf(member: Member): SlotKey[] {
  let seed = 0;
  for (const char of member.id) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  const slots: SlotKey[] = [];
  for (let day = 1 as Weekday; day <= 5; day = (day + 1) as Weekday) {
    for (const shift of ["morning", "afternoon", "evening"] as const) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const chance = shift === "evening" ? 0.15 : 0.55;
      if ((seed % 1000) / 1000 < chance) slots.push(slotKey(day, shift));
    }
  }
  return slots;
}

function isExamPeriod(state: GameState): boolean {
  return academicFactor(clockToDate(state.clock.hours)).label === "Provas";
}

function isVacation(state: GameState): boolean {
  return academicFactor(clockToDate(state.clock.hours)).label === "Férias";
}

export function slotStatus(state: GameState, memberId: string, slot: SlotKey): SlotStatus {
  const shift = slot.split("-")[1] as ShiftId;
  if (shift === "overnight") return readWorkshop(state).nightAccess === "granted" ? "free" : "locked";
  if (isVacation(state)) return "free";
  if (isExamPeriod(state)) return "exam";
  const member = state.members.find((item) => item.id === memberId);
  return member && classSlotsOf(member).includes(slot) ? "class" : "free";
}

/** Turno em andamento agora; null entre turnos. A madrugada de 0h–3h é do dia anterior. */
export function currentShift(state: GameState): SlotKey | null {
  const date = new Date(clockToDate(state.clock.hours));
  const hour = date.getUTCHours();
  let day = date.getUTCDay() as Weekday;
  if (hour < 3) day = ((day + 6) % 7) as Weekday;
  const shifted = hour < 3 ? hour + 24 : hour;
  const shift = SHIFTS.find((item) => shifted >= item.from && shifted < item.to);
  return shift ? slotKey(day, shift.id) : null;
}

/** Tarefas de oficina: só elas dependem da escala (§5.5). */
function isWorkshopAction(actionId: string): boolean {
  const action = findAction(actionId);
  return action?.skill === "fabrication" || actionId.startsWith("build-") || actionId === "repair-part";
}

export function workshopNow(state: GameState): WorkshopNowView {
  const workshop = readWorkshop(state);
  const slot = currentShift(state);
  const present = slot ? workshop.schedule[slot] ?? [] : [];
  const open = present.some((id) => workshop.keyHolders.includes(id));
  const workshopTasks = state.tasks.filter((task) => task.status === "active" && isWorkshopAction(task.actionId));
  let blocked: string | null = null;
  if (workshopTasks.length > 0) {
    if (!slot) blocked = "Fora de turno: oficina fechada.";
    else if (present.length === 0) blocked = "Ninguém escalado neste turno.";
    else if (!open) blocked = "Ninguém com chave no turno: oficina trancada.";
    else if (present.length < 2) blocked = "Uma pessoa só: ninguém lamina ou usa máquina sozinho.";
  }
  return { slot, present, open, blocked };
}

export function suggestSchedule(state: GameState): SuggestedSchedule {
  const workshop = readWorkshop(state);
  const schedule: Partial<Record<SlotKey, string[]>> = {};
  const notes: string[] = [];
  const crews = state.tasks
    .filter((task) => task.status !== "done" && isWorkshopAction(task.actionId) && task.assignees.length > 0)
    .map((task) => ({ label: task.label, ids: task.assignees }));
  if (crews.length === 0) {
    notes.push("Nenhuma tarefa de oficina com gente alocada: não há o que escalar.");
    return { schedule, notes };
  }
  const keyFree = (slot: SlotKey) =>
    workshop.keyHolders.filter((id) => slotStatus(state, id, slot) === "free");
  for (const crew of crews) {
    let placed = 0;
    for (const day of WEEKDAYS) {
      for (const shift of SHIFTS) {
        if (placed >= 3) break;
        const slot = slotKey(day.id, shift.id);
        if (shift.id === "overnight") continue;
        const free = crew.ids.filter((id) => slotStatus(state, id, slot) === "free");
        if (free.length < Math.min(2, crew.ids.length)) continue;
        const key = free.some((id) => workshop.keyHolders.includes(id)) ? [] : keyFree(slot).slice(0, 1);
        const people = [...new Set([...(schedule[slot] ?? []), ...free, ...key])].slice(0, workshop.capacity);
        if (key.length === 0 && !people.some((id) => workshop.keyHolders.includes(id))) continue;
        schedule[slot] = people;
        placed += 1;
      }
    }
    if (placed === 0) {
      if (workshop.nightAccess === "granted") {
        const slot = slotKey(2, "overnight");
        schedule[slot] = [...new Set([...crew.ids, ...workshop.keyHolders])].slice(0, workshop.capacity);
        notes.push(
          `${crew.label}: a equipe só coincide de madrugada. Escalei terça; quem for perde a manhã seguinte e cansa.`
        );
      } else {
        notes.push(`${crew.label}: a equipe não coincide em nenhum turno livre. Só de madrugada, que precisa de autorização.`);
      }
    } else {
      notes.push(`${crew.label}: ${placed} ${placed === 1 ? "turno" : "turnos"} na semana com quem está na tarefa.`);
    }
  }
  if (Object.keys(schedule).length > 0) {
    notes.push("Ajuste à vontade: arraste gente para outros turnos depois de aceitar.");
  }
  return { schedule, notes };
}

export function workshopCommand(command: WorkshopCommand): void {
  const state = store.getState();
  const workshop = readWorkshop(state);
  let next = workshop;
  switch (command.type) {
    case "set-shift": {
      const current = workshop.schedule[command.slot] ?? [];
      if (command.on) {
        if (current.includes(command.memberId) || current.length >= workshop.capacity) return;
        if (slotStatus(state, command.memberId, command.slot) !== "free") return;
        next = { ...workshop, schedule: { ...workshop.schedule, [command.slot]: [...current, command.memberId] } };
      } else {
        next = { ...workshop, schedule: { ...workshop.schedule, [command.slot]: current.filter((id) => id !== command.memberId) } };
      }
      break;
    }
    case "apply-suggested-schedule":
      next = { ...workshop, schedule: suggestSchedule(state).schedule };
      break;
    case "grant-key":
      if (workshop.keyHolders.includes(command.memberId)) return;
      next = { ...workshop, keyHolders: [...workshop.keyHolders, command.memberId] };
      break;
    case "night-access-request":
      // Na sim é a ação night-access-request (horas + ⌛ de resposta).
      if (findAction("night-access-request")) {
        store.dispatch({ type: "start-action", actionId: "night-access-request" });
        return;
      }
      next = { ...workshop, nightAccess: "requested" };
      break;
  }
  local.workshop = next;
  local.listeners.forEach((listener) => listener());
}

/** Só o stub: em dev, simula a resposta do departamento. */
export function devGrantNightAccess(): void {
  local.workshop = { ...readWorkshop(store.getState()), nightAccess: "granted" };
  local.listeners.forEach((listener) => listener());
}

/** Escala atual + turno em andamento, re-renderizando quando a escala ou o turno mudam. */
export function useWorkshop(): { workshop: WorkshopState; now: WorkshopNowView } {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((value) => value + 1);
    local.listeners.add(listener);
    return () => {
      local.listeners.delete(listener);
    };
  }, []);
  // Turno muda no máximo a cada hora de jogo; tarefas mudam o "blocked".
  useGame((state) => Math.floor(state.clock.hours));
  useGame((state) => state.tasks);
  const state = store.getState();
  return { workshop: readWorkshop(state), now: workshopNow(state) };
}
