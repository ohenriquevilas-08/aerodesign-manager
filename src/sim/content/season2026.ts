// Temporada 2025–26: pré-temporada (nov–fev), calendário oficial 2026 (Regulamento, Apêndice 8)
// e calendário acadêmico genérico (design §4). Datas em UTC, sem horário de verão, para a
// simulação ser determinística.

import { BALANCE } from "./balance";

/** Seg, 10/nov/2025: a temporada real começa quando a competição anterior acaba (design §4.3). */
export const SEASON_START = Date.UTC(2025, 10, 10);

const ymd = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day);
const d = (month: number, day: number) => ymd(2026, month, day);

/** 9/fev: Regulamento 2026 publicado. Libera a leitura do regulamento e a Prancheta. */
export const REGULATION_DATE = d(2, 9);
/** Etapa trainee: de 1/dez até 1/fev (exclusivo); no fim cada trainee vira integrante ou desiste. */
export const TRAINEE_START = ymd(2025, 12, 1);
export const TRAINEE_END = d(2, 1);

export type DeadlineKind = "info" | "deadline" | "event";

export interface Deadline {
  id: string;
  date: number;
  title: string;
  kind: DeadlineKind;
  /** Marco de pré-temporada: avisa na caixa de entrada, mas não pausa o relógio. */
  quiet?: boolean;
}

export const OFFICIAL_CALENDAR: readonly Deadline[] = [
  { id: "founders", date: ymd(2025, 11, 10), title: "Convite dos fundadores", kind: "event", quiet: true },
  { id: "selection", date: ymd(2025, 11, 17), title: "Janela do processo seletivo de novembro", kind: "info", quiet: true },
  { id: "trainee-start", date: TRAINEE_START, title: "Começa a etapa trainee", kind: "info", quiet: true },
  { id: "summer-break", date: ymd(2025, 12, 15), title: "Férias de verão", kind: "info", quiet: true },
  { id: "trainee-end", date: TRAINEE_END, title: "Fim da etapa trainee", kind: "info", quiet: true },
  { id: "regulation", date: REGULATION_DATE, title: "Regulamento 2026 publicado", kind: "event" },
  { id: "rev01", date: d(3, 1), title: "Revisão 01 do regulamento", kind: "info" },
  { id: "selection-march", date: d(3, 2), title: "Janela do processo seletivo de março (calouros)", kind: "info", quiet: true },
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

/** Calendário acadêmico genérico, nov/2025 a nov/2026. Fora destes períodos, aulas normais (fator 1). */
export const ACADEMIC_PERIODS: readonly AcademicPeriod[] = [
  { from: ymd(2025, 11, 17), to: ymd(2025, 11, 28), label: "Provas", factor: 0.4 },
  { from: ymd(2025, 12, 8), to: ymd(2025, 12, 12), label: "Provas", factor: 0.4 },
  // Muitos viajam: horas por integrante baixam (BALANCE.season, PROPOSTA).
  { from: ymd(2025, 12, 15), to: d(2, 13), label: "Férias de verão", factor: BALANCE.season.summerFactor },
  { from: d(2, 14), to: d(2, 18), label: "Carnaval", factor: 0.7 },
  { from: d(4, 13), to: d(4, 24), label: "Provas", factor: 0.4 },
  { from: d(6, 15), to: d(6, 26), label: "Provas", factor: 0.4 },
  { from: d(7, 4), to: d(8, 2), label: "Férias", factor: 1.6 },
  { from: d(9, 14), to: d(9, 25), label: "Provas", factor: 0.4 },
  { from: d(11, 9), to: d(11, 20), label: "Provas", factor: 0.4 }
];
