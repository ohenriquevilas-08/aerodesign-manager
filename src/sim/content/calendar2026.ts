// Calendário oficial 2026 (Regulamento, Apêndice 8) e calendário acadêmico genérico (design §4).
// Datas em UTC, sem horário de verão, para a simulação ser determinística.

export const SEASON_START = Date.UTC(2026, 1, 9); // 9/fev: Regulamento Rev00 publicado

export type DeadlineKind = "info" | "deadline" | "event";

export interface Deadline {
  id: string;
  date: number;
  title: string;
  kind: DeadlineKind;
}

const d = (month: number, day: number) => Date.UTC(2026, month - 1, day);

export const OFFICIAL_CALENDAR: readonly Deadline[] = [
  { id: "rev01", date: d(3, 1), title: "Revisão 01 do regulamento", kind: "info" },
  { id: "report", date: d(8, 16), title: "Relatório, plantas e previsões", kind: "deadline" },
  { id: "report-late", date: d(8, 23), title: "Relatório com penalidade", kind: "deadline" },
  { id: "oral-schedule", date: d(9, 13), title: "Cronograma da apresentação oral", kind: "info" },
  { id: "flight-video", date: d(9, 27), title: "Vídeo de voo, alterações e piloto", kind: "deadline" },
  { id: "approved-list", date: d(10, 4), title: "Lista de aviões aprovados", kind: "info" },
  { id: "oral", date: d(10, 17), title: "Apresentação oral (online)", kind: "event" },
  // O regulamento deixa a competição "a definir"; o jogo fixa a semana seguinte à apresentação.
  { id: "competition", date: d(10, 22), title: "Competição de voo", kind: "event" }
];

export interface AcademicPeriod {
  from: number;
  to: number;
  label: string;
  /** Multiplicador das horas disponíveis. */
  factor: number;
}

/** Calendário acadêmico genérico. Fora destes períodos, aulas normais (fator 1). */
export const ACADEMIC_PERIODS: readonly AcademicPeriod[] = [
  { from: d(2, 14), to: d(2, 18), label: "Carnaval", factor: 0.7 },
  { from: d(4, 13), to: d(4, 24), label: "Provas", factor: 0.4 },
  { from: d(6, 15), to: d(6, 26), label: "Provas", factor: 0.4 },
  { from: d(7, 4), to: d(8, 2), label: "Férias", factor: 1.6 },
  { from: d(9, 14), to: d(9, 25), label: "Provas", factor: 0.4 },
  { from: d(11, 9), to: d(11, 20), label: "Provas", factor: 0.4 }
];
