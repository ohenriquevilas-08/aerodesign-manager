// Central do Elenco (Fase 6, U5): colunas por aba, nota geral e ordenação. Puro, testado em tests/ui/.

import { DISCIPLINES, isOverloaded, memberHoursPerDay, type Discipline, type GameState, type Member } from "../sim";
import { DISCIPLINE_SHORT, motivationLabel, ROLE_LABEL } from "./format";

export type RosterTab = "status" | "knowledge" | "availability" | "development";

export const ROSTER_TABS: readonly { id: RosterTab; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "knowledge", label: "Conhecimento" },
  { id: "availability", label: "Disponibilidade" },
  { id: "development", label: "Desenvolvimento" }
];

/** O que a tabela precisa saber do jogo além do aluno. */
export interface RosterContext {
  /** Data do dia (ms), para as horas por dia. */
  date: number;
  tasks: { id: string; label: string }[];
  /** Turnos escalados na oficina por aluno (workshop.schedule). */
  shifts: Record<string, number>;
}

export function shiftsPerMember(schedule: GameState["workshop"]["schedule"]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ids of Object.values(schedule)) for (const id of ids ?? []) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

/**
 * Nota geral (0–100): média do conhecimento na área (ou da melhor disciplina, sem área) com
 * fabricação, comunicação, pilotagem e agilidade. É só leitura de apresentação, não entra na simulação.
 */
export function memberOverall(member: Member): number {
  const knowledge = member.area ? member.knowledge[member.area] : Math.max(...DISCIPLINES.map((discipline) => member.knowledge[discipline]));
  return Math.round((knowledge + member.fabrication + member.communication + member.piloting + member.agility) / 5);
}

export type CellValue = number | string;

export interface RosterColumn {
  id: string;
  label: string;
  title?: string;
  /** Valor ordenável. */
  value: (member: Member, ctx: RosterContext) => CellValue;
  /** Texto exibido; padrão = o valor. */
  text?: (member: Member, ctx: RosterContext) => string;
  /** Barra 0–100 sob o número. */
  meter?: boolean;
  numeric?: boolean;
}

const taskLabel = (member: Member, ctx: RosterContext) => ctx.tasks.find((item) => item.id === member.taskId)?.label ?? "";
const oneDecimal = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const knowledgeColumn = (discipline: Discipline): RosterColumn => ({
  id: `k-${discipline}`,
  label: DISCIPLINE_SHORT[discipline],
  numeric: true,
  meter: true,
  value: (member) => Math.round(member.knowledge[discipline])
});

const skill = (id: "fabrication" | "communication" | "piloting" | "agility", label: string): RosterColumn => ({
  id,
  label,
  numeric: true,
  meter: true,
  value: (member) => Math.round(member[id])
});

export const ROSTER_COLUMNS: Record<RosterTab, RosterColumn[]> = {
  status: [
    { id: "overall", label: "Nota", numeric: true, meter: true, value: memberOverall },
    {
      id: "motivation",
      label: "Motivação",
      numeric: true,
      meter: true,
      value: (member) => Math.round(member.motivation),
      text: (member) => `${Math.round(member.motivation)} · ${motivationLabel(member.motivation)}`
    },
    { id: "task", label: "Tarefa atual", value: taskLabel, text: (member, ctx) => taskLabel(member, ctx) || "Sem tarefa" },
    { id: "shifts", label: "Turnos/sem", title: "Turnos escalados na oficina por semana", numeric: true, value: (member, ctx) => ctx.shifts[member.id] ?? 0 },
    { id: "overload", label: "Sobrecarga", value: (member) => (isOverloaded(member) ? 1 : 0), text: (member) => (isOverloaded(member) ? "Sobrecarregado" : "—") }
  ],
  knowledge: DISCIPLINES.map(knowledgeColumn),
  availability: [
    {
      id: "hours-today",
      label: "h/dia hoje",
      title: "Base × período acadêmico × motivação",
      numeric: true,
      value: (member, ctx) => Math.round(memberHoursPerDay(member, ctx.date) * 10) / 10,
      text: (member, ctx) => oneDecimal(memberHoursPerDay(member, ctx.date))
    },
    { id: "hours-base", label: "h/dia base", numeric: true, value: (member) => member.hoursPerDay, text: (member) => oneDecimal(member.hoursPerDay) },
    { id: "classes", label: "Aulas", title: "Turnos com aula no semestre", numeric: true, value: (member) => member.classSlots.length },
    { id: "graduation", label: "Formatura", value: (member) => member.graduation }
  ],
  development: [
    skill("fabrication", "Fabricação"),
    skill("communication", "Comunicação"),
    skill("piloting", "Pilotagem"),
    skill("agility", "Agilidade"),
    {
      id: "knowledge-total",
      label: "Conhecimento total",
      numeric: true,
      value: (member) => Math.round(DISCIPLINES.reduce((sum, discipline) => sum + member.knowledge[discipline], 0))
    },
    {
      id: "training",
      label: "Treino (h)",
      title: "Horas de treino na etapa trainee",
      numeric: true,
      value: (member) => Math.round(member.trainingHours ?? 0),
      text: (member) => (member.role === "trainee" ? String(Math.round(member.trainingHours ?? 0)) : "—")
    }
  ]
};

/** Colunas fixas à esquerda em todas as abas. */
export const BASE_COLUMNS: RosterColumn[] = [
  { id: "name", label: "Nome", value: (member) => member.name },
  { id: "role", label: "Cargo", value: (member) => ROLE_LABEL[member.role] },
  {
    id: "area",
    label: "Área",
    value: (member) => (member.area ? DISCIPLINE_SHORT[member.area] : ""),
    text: (member) => (member.area ? DISCIPLINE_SHORT[member.area] : "Sem área")
  }
];

export interface SortState {
  columnId: string;
  descending: boolean;
}

export function findColumn(tab: RosterTab, columnId: string): RosterColumn | undefined {
  return [...BASE_COLUMNS, ...ROSTER_COLUMNS[tab]].find((column) => column.id === columnId);
}

/** Ordena sem mudar a lista original; empate cai no nome para a ordem ser estável. */
export function sortRoster(members: readonly Member[], column: RosterColumn, descending: boolean, ctx: RosterContext): Member[] {
  const sign = descending ? -1 : 1;
  return [...members].sort((a, b) => {
    const va = column.value(a, ctx);
    const vb = column.value(b, ctx);
    const diff = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
    return diff !== 0 ? sign * diff : a.name.localeCompare(b.name, "pt-BR");
  });
}

/** Clicar no cabeçalho: a mesma coluna inverte; outra coluna começa decrescente se numérica. */
export function nextSort(current: SortState, column: RosterColumn): SortState {
  if (current.columnId === column.id) return { columnId: column.id, descending: !current.descending };
  return { columnId: column.id, descending: column.numeric === true };
}

/** Seta para cima/baixo na lista já ordenada; pára nas pontas. */
export function stepSelection(ids: readonly string[], currentId: string | null, delta: 1 | -1): string | null {
  if (ids.length === 0) return null;
  const index = currentId ? ids.indexOf(currentId) : -1;
  if (index < 0) return ids[delta === 1 ? 0 : ids.length - 1]!;
  return ids[Math.min(ids.length - 1, Math.max(0, index + delta))]!;
}

/** Contagem por área e média geral, para o resumo do topo. */
export function rosterSummary(members: readonly Member[]): { average: number; perArea: { area: Discipline | null; count: number }[] } {
  const counts = new Map<Discipline | null, number>();
  for (const member of members) counts.set(member.area, (counts.get(member.area) ?? 0) + 1);
  const average = members.length === 0 ? 0 : Math.round(members.reduce((sum, member) => sum + memberOverall(member), 0) / members.length);
  const perArea: { area: Discipline | null; count: number }[] = [...DISCIPLINES.map((area) => ({ area: area as Discipline | null, count: counts.get(area) ?? 0 })), { area: null, count: counts.get(null) ?? 0 }];
  return { average, perArea };
}
