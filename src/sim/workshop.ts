// Escala da oficina (design §5.5): quem está na oficina em cada turno, encaixado entre as aulas.
// Só tarefas de oficina (ActionDef.workshop) dependem dela: avançam com quem está alocado nelas,
// escalado e presente no turno corrente, com alguém de chave no turno. O resto do trabalho segue
// as horas/dia de sempre. A madrugada cobra sono (perde a manhã seguinte), motivação e qualidade.

import { findAction, type ActionDef } from "./content/actions";
import { BALANCE } from "./content/balance";
import { OFFICIAL_CALENDAR } from "./content/calendar2026";
import { findShift, parseSlot, SHIFTS, slotKey, WEEKDAYS } from "./content/workshop";
import { nextRandom } from "./rng";
import { warn } from "./tasks";
import { canWork, motivationFactor } from "./team";
import { academicFactor, clockToDate, dateToHours } from "./time";
import type { GameState, Member, ShiftId, SlotKey, Task, Weekday, WorkshopState } from "./types";

const W = BALANCE.workshop;

export type SlotStatus = "free" | "class" | "exam" | "locked";

/** Grade de aulas do semestre, sorteada por pessoa: só dias úteis, nunca madrugada. */
export function drawClassSlots(rngState: number): { slots: SlotKey[]; rngState: number } {
  let rng = rngState;
  const slots: SlotKey[] = [];
  for (let day = 1; day <= 5; day += 1) {
    for (const shift of ["morning", "afternoon", "evening"] as const) {
      const roll = nextRandom(rng);
      rng = roll.state;
      if (roll.value < (W.classChance[shift] ?? 0)) slots.push(slotKey(day as Weekday, shift));
    }
  }
  return { slots, rngState: rng };
}

/** Oficina do Ano 1: 4 lugares, chave com os capitães, sem acesso noturno, escala vazia. */
export function createWorkshop(members: readonly Member[]): WorkshopState {
  return {
    capacity: W.capacity,
    keyHolders: members.filter((member) => member.role === "captain").map((member) => member.id),
    nightAccess: "none",
    schedule: {}
  };
}

// ---------------------------------------------------------------------------
// Relógio → turno
// ---------------------------------------------------------------------------

const hourOfDay = (hours: number) => hours - Math.floor(hours / 24) * 24;
const weekdayAt = (hours: number) => new Date(clockToDate(hours)).getUTCDay() as Weekday;

/** Turno em andamento num instante; a madrugada (22h–3h) pertence ao dia em que começa. */
export function shiftAt(hours: number): { day: Weekday; shift: ShiftId } | null {
  const h = hourOfDay(hours);
  if (h < 3) return { day: weekdayAt(hours - 24), shift: "overnight" };
  for (const shift of SHIFTS) {
    if (h >= shift.start && h < Math.min(24, shift.end)) return { day: weekdayAt(hours), shift: shift.id };
  }
  return null;
}

/** Turno em andamento agora; null entre turnos (ex.: 12h–13h, 3h–8h). */
export function currentShift(state: GameState): { day: Weekday; shift: ShiftId } | null {
  return shiftAt(state.clock.hours);
}

// ---------------------------------------------------------------------------
// Disponibilidade
// ---------------------------------------------------------------------------

function statusAt(state: GameState, member: Member, slot: SlotKey, hours: number): SlotStatus {
  const parsed = parseSlot(slot);
  if (!parsed) return "locked";
  const period = academicFactor(clockToDate(hours)).label;
  const vacation = period === "Férias";
  if (!vacation && member.classSlots.includes(slot)) return "class";
  if (period === "Provas" && parsed.shift !== "overnight" && parsed.day >= 1 && parsed.day <= 5) return "exam";
  if (parsed.shift === "overnight" && state.workshop.nightAccess !== "granted") return "locked";
  return "free";
}

/**
 * Situação de um turno para um integrante agora: livre, aula, semana de provas ("exam") ou
 * madrugada sem autorização ("locked"). Nas férias de julho não há aula.
 */
export function slotStatus(state: GameState, memberId: string, slot: SlotKey): SlotStatus {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return "locked";
  return statusAt(state, member, slot, state.clock.hours);
}

const previousDay = (day: Weekday) => ((day + 6) % 7) as Weekday;
const nextDay = (day: Weekday) => ((day + 1) % 7) as Weekday;

/** Manhã depois da madrugada (ou a madrugada antes da manhã): a mesma pessoa não aguenta as duas. */
function sleepConflict(schedule: WorkshopState["schedule"], memberId: string, slot: SlotKey): boolean {
  const parsed = parseSlot(slot);
  if (!parsed) return false;
  if (parsed.shift === "morning") return (schedule[slotKey(previousDay(parsed.day), "overnight")] ?? []).includes(memberId);
  if (parsed.shift === "overnight") return (schedule[slotKey(nextDay(parsed.day), "morning")] ?? []).includes(memberId);
  return false;
}

/** Quem fez a madrugada de ontem está dormindo de manhã (design §5.5). */
function sleeping(state: GameState, memberId: string, day: Weekday, shift: ShiftId): boolean {
  if (shift !== "morning" || state.workshop.nightAccess !== "granted") return false;
  return (state.workshop.schedule[slotKey(previousDay(day), "overnight")] ?? []).includes(memberId);
}

/** Quem está de fato na oficina num instante: escalado, sem aula/prova, acordado. */
export function presentAt(state: GameState, hours: number): { slot: SlotKey | null; present: string[] } {
  const now = shiftAt(hours);
  if (!now) return { slot: null, present: [] };
  const slot = slotKey(now.day, now.shift);
  const present = (state.workshop.schedule[slot] ?? []).filter((id) => {
    const member = state.members.find((item) => item.id === id);
    return !!member && canWork(member) && statusAt(state, member, slot, hours) === "free" && !sleeping(state, id, now.day, now.shift);
  });
  return { slot, present };
}

const needed = (action: ActionDef) => Math.max(action.crew.min, action.needsPair ? 2 : 1);

/** Por que uma tarefa de oficina não anda agora; null se anda. */
function taskBlock(state: GameState, task: Task, slot: SlotKey | null, present: readonly string[]): string | null {
  const action = findAction(task.actionId)!;
  if (!slot) return "Fora de turno: oficina fechada.";
  if (present.length === 0) return "Ninguém escalado neste turno.";
  if (!present.some((id) => state.workshop.keyHolders.includes(id))) return "Sem ninguém com chave.";
  const here = task.assignees.filter((id) => present.includes(id));
  const min = needed(action);
  if (here.length >= min) return null;
  if (here.length === 0) return `${task.label}: ninguém da tarefa está neste turno.`;
  return action.needsPair && min === 2 ? `${task.label} precisa de 2 pessoas no turno.` : `${task.label} precisa de ${min} pessoas no turno.`;
}

/** Oficina agora: turno, quem está, se abre e o motivo de bloqueio (PT-BR) para o hangar. */
export function workshopNow(state: GameState): { slot: SlotKey | null; present: string[]; open: boolean; blocked: string | null } {
  const { slot, present } = presentAt(state, state.clock.hours);
  const open = present.some((id) => state.workshop.keyHolders.includes(id));
  if (!slot) return { slot, present, open: false, blocked: "Fora de turno: oficina fechada." };
  if (present.length === 0) return { slot, present, open: false, blocked: "Ninguém escalado neste turno." };
  if (!open) return { slot, present, open, blocked: "Sem ninguém com chave." };
  for (const task of state.tasks) {
    if (task.status !== "active" || task.assignees.length === 0 || !findAction(task.actionId)?.workshop) continue;
    const block = taskBlock(state, task, slot, present);
    if (block && !block.includes("ninguém da tarefa")) return { slot, present, open, blocked: block };
  }
  return { slot, present, open, blocked: null };
}

/** Horas-pessoa por hora de cada integrante numa tarefa de oficina, num instante (vazio = não anda). */
function workshopRatesAt(state: GameState, action: ActionDef, memberIds: readonly string[], hours: number): Map<string, number> {
  const rates = new Map<string, number>();
  const { slot, present } = presentAt(state, hours);
  if (!slot || !present.some((id) => state.workshop.keyHolders.includes(id))) return rates;
  const here = memberIds
    .map((id) => state.members.find((member) => member.id === id))
    .filter((member): member is Member => !!member && present.includes(member.id));
  if (here.length < needed(action)) return rates;
  here
    .map((member, index) => ({ member, index, rate: motivationFactor(member.motivation) }))
    .sort((a, b) => b.rate - a.rate || a.index - b.index)
    .forEach(({ member, rate }, position) => rates.set(member.id, position < action.crew.ideal ? rate : rate * BALANCE.crew.extraEfficiency));
  return rates;
}

/** Rendimento de uma tarefa de oficina no instante `hours` (por hora de jogo). */
export function workshopTaskRates(state: GameState, task: Task, hours: number): Map<string, number> {
  return workshopRatesAt(state, findAction(task.actionId)!, task.assignees, hours);
}

/** Peso de uma hora de madrugada para a perda de qualidade: dobra depois da 1h. */
export function overnightWeight(hours: number): number {
  const now = shiftAt(hours);
  if (now?.shift !== "overnight") return 0;
  const h = hourOfDay(hours);
  return h >= W.lateNightHour && h < 3 ? 2 : 1;
}

/** Dias (a partir de fromHours) para fazer `work` horas-pessoa nos turnos escalados; null se não anda. */
export function workshopDays(state: GameState, action: ActionDef, memberIds: readonly string[], work: number, fromHours: number): number | null {
  if (work <= 0) return 0;
  if (memberIds.length === 0) return null;
  let remaining = work;
  const firstDay = Math.floor(fromHours / 24) - 1;
  for (let day = firstDay; day < firstDay + 400; day += 1) {
    for (const shift of SHIFTS) {
      const start = Math.max(day * 24 + shift.start, fromHours);
      const end = day * 24 + shift.end;
      if (end <= start) continue;
      let perHour = 0;
      workshopRatesAt(state, action, memberIds, start).forEach((rate) => (perHour += rate));
      if (perHour <= 0) continue;
      if (perHour * (end - start) >= remaining) return (start + remaining / perHour - fromHours) / 24;
      remaining -= perHour * (end - start);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Madrugada: motivação e mentoria no turno
// ---------------------------------------------------------------------------

/** Há prazo oficial (relatório, vídeo) nos próximos dias? Virada antes de prazo une a equipe. */
export function deadlineWeek(hours: number): boolean {
  return OFFICIAL_CALENDAR.some((item) => {
    const at = dateToHours(item.date);
    return item.kind === "deadline" && at >= hours && at - hours <= W.deadlineWindowDays * 24;
  });
}

/** Madrugadas seguidas na escala terminando no dia `day` (1 = só esta). */
function overnightStreak(state: GameState, memberId: string, day: Weekday): number {
  let streak = 0;
  let d = day;
  while (streak < 7 && (state.workshop.schedule[slotKey(d, "overnight")] ?? []).includes(memberId)) {
    streak += 1;
    d = previousDay(d);
  }
  return Math.max(1, streak);
}

/**
 * Efeitos do turno corrente sobre quem está na oficina por dt horas: madrugada mexe na motivação
 * (cai, mais com madrugadas seguidas; sobe na semana de prazo) e veterano ensina novato.
 */
export function shiftEffects(state: GameState, hours: number, dt: number): GameState {
  const now = shiftAt(hours);
  if (!now) return state;
  const { present } = presentAt(state, hours);
  if (present.length === 0) return state;
  const here = state.members.filter((member) => present.includes(member.id));
  const boost = deadlineWeek(hours);
  return {
    ...state,
    members: state.members.map((member) => {
      if (!present.includes(member.id)) return member;
      let updated = member;
      if (now.shift === "overnight") {
        const delta = boost
          ? W.deadlineBoostPerHour * dt
          : -W.overnightMotivationPerHour * dt * (1 + W.overnightStreakExtra * (overnightStreak(state, member.id, now.day) - 1));
        updated = { ...updated, motivation: Math.min(100, Math.max(0, updated.motivation + delta)) };
      }
      // Turno junto ensina (design §5.3): o melhor veterano de cada disciplina puxa o novato.
      const knowledge = { ...updated.knowledge };
      let learned = false;
      for (const discipline of Object.keys(knowledge) as (keyof typeof knowledge)[]) {
        const mentor = Math.max(0, ...here.filter((other) => other.id !== member.id).map((other) => other.knowledge[discipline]));
        if (mentor >= W.veteranMin && mentor - knowledge[discipline] >= W.minGap) {
          knowledge[discipline] = Math.min(mentor, knowledge[discipline] + W.mentorPerHour * dt);
          learned = true;
        }
      }
      return learned ? { ...updated, knowledge } : updated;
    })
  };
}

// ---------------------------------------------------------------------------
// Escala sugerida pelo capitão
// ---------------------------------------------------------------------------

const memberName = (state: GameState, id: string) => state.members.find((member) => member.id === id)?.name ?? id;
const DAY_SHIFTS: readonly ShiftId[] = ["morning", "afternoon", "evening"];

/**
 * Escala automática do capitão: junta quem está alocado em cada tarefa de oficina nos turnos de
 * dia em que coincide, com alguém de chave. Só sugere madrugada quando a equipe não coincide em
 * nenhum turno de dia, e avisa o custo.
 */
export function suggestSchedule(state: GameState): { schedule: Partial<Record<SlotKey, string[]>>; notes: string[] } {
  const schedule: Partial<Record<SlotKey, string[]>> = {};
  const notes: string[] = [];
  const shifts = new Map<string, number>();
  const tasks = state.tasks.filter((task) => task.status !== "done" && task.assignees.length > 0 && findAction(task.actionId)?.workshop);
  if (tasks.length === 0) return { schedule, notes: ["Nenhuma tarefa de oficina com gente alocada: nada a escalar."] };

  // Turno de dia livre de aula para a pessoa (a sugestão é a grade do semestre, sem provas).
  const freeBySchedule = (id: string, slot: SlotKey) => {
    const member = state.members.find((item) => item.id === id);
    if (!member || !canWork(member) || sleepConflict(schedule, id, slot)) return false;
    if (parseSlot(slot)!.shift === "overnight") return state.workshop.nightAccess === "granted";
    return !member.classSlots.includes(slot);
  };
  const room = (slot: SlotKey) => state.workshop.capacity - (schedule[slot]?.length ?? 0);
  const add = (slot: SlotKey, id: string) => {
    if ((schedule[slot] ?? []).includes(id)) return;
    schedule[slot] = [...(schedule[slot] ?? []), id];
    shifts.set(id, (shifts.get(id) ?? 0) + 1);
  };
  const tired = (id: string) => (shifts.get(id) ?? 0) >= W.maxShiftsPerWeek;

  /** Tenta pôr a equipe da tarefa no turno; precisa caber o mínimo e alguém de chave. */
  const place = (task: Task, slot: SlotKey): boolean => {
    const action = findAction(task.actionId)!;
    const crew = task.assignees.filter((id) => freeBySchedule(id, slot) && !tired(id) && !(schedule[slot] ?? []).includes(id));
    const already = task.assignees.filter((id) => (schedule[slot] ?? []).includes(id));
    const keyInSlot = (schedule[slot] ?? []).some((id) => state.workshop.keyHolders.includes(id));
    const keyCrew = crew.filter((id) => state.workshop.keyHolders.includes(id));
    const keyOutside = state.workshop.keyHolders.find(
      (id) => !task.assignees.includes(id) && freeBySchedule(id, slot) && !tired(id) && !(schedule[slot] ?? []).includes(id)
    );
    const needsKey = !keyInSlot && keyCrew.length === 0;
    if (needsKey && !keyOutside) return false;
    const seats = room(slot) - (needsKey ? 1 : 0);
    const going = [...keyCrew, ...crew.filter((id) => !keyCrew.includes(id))].slice(0, Math.max(0, seats));
    if (going.length + already.length < needed(action)) return false;
    going.forEach((id) => add(slot, id));
    if (needsKey) add(slot, keyOutside!);
    return true;
  };

  for (const task of tasks) {
    let placed = 0;
    // Dias primeiro, dos turnos em que mais gente da tarefa coincide para os que menos.
    const daySlots = WEEKDAYS.flatMap((day) => DAY_SHIFTS.map((shift) => slotKey(day.id, shift))).sort(
      (a, b) =>
        task.assignees.filter((id) => freeBySchedule(id, b)).length - task.assignees.filter((id) => freeBySchedule(id, a)).length
    );
    for (const slot of daySlots) if (place(task, slot)) placed += 1;
    const names = task.assignees.map((id) => memberName(state, id)).join(", ");
    if (placed > 0) continue;
    if (state.workshop.nightAccess !== "granted") {
      notes.push(`${task.label}: ${names} não coincidem em nenhum turno de dia. Peça autorização de acesso noturno.`);
      continue;
    }
    for (const day of WEEKDAYS) {
      if (place(task, slotKey(day.id, "overnight"))) placed += 1;
      if (placed >= 2) break;
    }
    notes.push(
      placed > 0
        ? `${task.label}: ${names} só coincidem de madrugada. Custa sono: perdem a manhã seguinte, a motivação cai e o trabalho sai com mais erro.`
        : `${task.label}: não coube na oficina nem de madrugada. Libere lugares ou dê a chave a mais gente.`
    );
  }
  return { schedule, notes };
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

export function setShift(state: GameState, memberId: string, slot: SlotKey, on: boolean): GameState {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return warn(state, "Integrante não encontrado.");
  if (!canWork(member)) return warn(state, "O presidente coordena; ele não entra na escala.");
  const parsed = parseSlot(slot);
  if (!parsed) return warn(state, "Turno inválido.");
  const current = state.workshop.schedule[slot] ?? [];
  if (!on) {
    if (!current.includes(memberId)) return state;
    const rest = current.filter((id) => id !== memberId);
    const schedule = { ...state.workshop.schedule };
    if (rest.length) schedule[slot] = rest;
    else delete schedule[slot];
    return { ...state, workshop: { ...state.workshop, schedule } };
  }
  if (current.includes(memberId)) return state;
  const status = slotStatus(state, memberId, slot);
  if (status === "class") return warn(state, `${member.name} tem aula nesse turno.`);
  if (status === "locked") return warn(state, "A madrugada exige autorização de acesso noturno do departamento.");
  if (sleepConflict(state.workshop.schedule, memberId, slot)) {
    return warn(state, `${member.name} vai estar dormindo depois da madrugada.`);
  }
  if (current.length >= state.workshop.capacity) return warn(state, `A oficina está lotada nesse turno (${state.workshop.capacity} lugares).`);
  return { ...state, workshop: { ...state.workshop, schedule: { ...state.workshop.schedule, [slot]: [...current, memberId] } } };
}

export function applySuggestedSchedule(state: GameState): GameState {
  return { ...state, workshop: { ...state.workshop, schedule: suggestSchedule(state).schedule } };
}

export function grantKey(state: GameState, memberId: string): GameState {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return warn(state, "Integrante não encontrado.");
  if (!canWork(member)) return warn(state, "O presidente não fica na oficina; dê a chave a alguém da equipe.");
  if (state.workshop.keyHolders.includes(memberId)) return state;
  return { ...state, workshop: { ...state.workshop, keyHolders: [...state.workshop.keyHolders, memberId] } };
}

export { findShift, SHIFTS, slotKey, WEEKDAYS };
