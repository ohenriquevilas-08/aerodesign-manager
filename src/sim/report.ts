// Relatório, plantas e previsões do Portal da CT (design §6.2 e §9.1). Frente: Simulação (Fase 3).
// A nota de cada capítulo vem do acervo documentado, das horas de escrita e dos ensaios citados;
// a CT sorteia a NR em torno da nota esperada no envio.

import { BALANCE } from "./content/balance";
import { OFFICIAL_CALENDAR } from "./content/calendar2026";
import { REGULAR_2026, REPORT_CHAPTERS } from "./content/regulation2026";
import { nextRandom } from "./rng";
import { DISCIPLINES } from "./state";
import { addMessage, warn } from "./tasks";
import { canWork, clamp, DISCIPLINE_LABELS } from "./team";
import { dateToHours } from "./time";
import type { Discipline, Estimate, GameState, PayloadLine, ReportChapter, ReportState } from "./types";

const R = BALANCE.report;

const deadlineHours = (id: string) => dateToHours(OFFICIAL_CALENDAR.find((item) => item.id === id)!.date);
/** 16/ago: relatório, plantas e previsões. */
export const REPORT_DEADLINE = deadlineHours("report");
/** 23/ago: último dia, com penalidade. */
export const REPORT_LATE_DEADLINE = deadlineHours("report-late");
/** 17/out: apresentação oral (11.1). */
export const ORAL_DATE = deadlineHours("oral");

/** Plantas valem 10 pontos em Projeto conceitual e 10 em Estruturas (11.1); o resto do máximo é texto. */
export const DRAWING_POINTS: Partial<Record<Discipline, number>> = { conceptual: 10, structures: 10 };

export function createReport(): ReportState {
  const chapters = Object.fromEntries(
    DISCIPLINES.map((discipline) => [discipline, { hours: 0, testsCited: 0 }])
  ) as Record<Discipline, ReportChapter>;
  return {
    chapters,
    drawingsHours: 0,
    predictedEmptyWeightKg: null,
    payloadLine: null,
    submittedAt: null,
    score: null,
    oralScore: null,
    oralPracticeHours: 0
  };
}

/** Rascunho das previsões (FPV e PAC, 7.7 e 11.6). Recusa depois do envio. */
export function setPredictions(
  state: GameState,
  predictions: { emptyWeightKg?: number; payloadLine?: PayloadLine }
): GameState {
  if (state.report.submittedAt !== null) return warn(state, "O relatório já foi enviado: as previsões estão congeladas.");
  const { emptyWeightKg, payloadLine } = predictions;
  if (emptyWeightKg !== undefined && !(emptyWeightKg > 0)) return warn(state, "Peso vazio previsto precisa ser positivo.");
  return {
    ...state,
    report: {
      ...state.report,
      predictedEmptyWeightKg: emptyWeightKg ?? state.report.predictedEmptyWeightKg,
      payloadLine: payloadLine ?? state.report.payloadLine
    }
  };
}

const saturate = (value: number, scale: number) => 1 - Math.exp(-Math.max(0, value) / scale);

/**
 * Nota esperada de um capítulo (máximos de REPORT_CHAPTERS, 11.1), plantas incluídas.
 * Sem horas de escrita o texto vale 0; as plantas contam à parte.
 */
export function chapterScore(state: GameState, discipline: Discipline): number {
  const chapter = state.report.chapters[discipline];
  const documented = clamp(state.documented[discipline]) / 100;
  const drawings = DRAWING_POINTS[discipline] ?? 0;
  const textMax = REPORT_CHAPTERS[discipline] - drawings;
  const content = R.contentBase + R.contentKnowledge * documented + R.contentTests * saturate(chapter.testsCited, R.testsScale);
  const text = textMax * saturate(chapter.hours, R.chapterHours) * content;
  const plans = drawings * saturate(state.report.drawingsHours, R.drawingsHours) * (0.5 + 0.5 * documented);
  return text + plans;
}

/** Média do acervo documentado (0–1): quanto mais a equipe sabe, menos a nota da CT surpreende. */
const documentedShare = (state: GameState) =>
  DISCIPLINES.reduce((sum, discipline) => sum + clamp(state.documented[discipline]), 0) / (100 * DISCIPLINES.length);

/** Variação relativa (±) da NR em torno da esperada. */
export function reportSpread(state: GameState): number {
  return R.maxSpread - (R.maxSpread - R.minSpread) * documentedShare(state);
}

/** Fração da NR perdida ao enviar em `hours` (0 até 16/ago; por dia começado depois). */
export function latePenalty(hours: number): number {
  if (hours <= REPORT_DEADLINE) return 0;
  const days = Math.min(Math.ceil((hours - REPORT_DEADLINE) / 24 - 1e-9), (REPORT_LATE_DEADLINE - REPORT_DEADLINE) / 24);
  return Math.min(1, days * R.latePenaltyPerDay);
}

/**
 * Nota esperada do relatório (NR, 0–185) com a margem de erro da equipe. Inclui a penalidade
 * de atraso se enviar agora. Depois do envio: a nota da CT, margem 0.
 */
export function estimateReportScore(state: GameState): Estimate | null {
  if (state.report.score !== null) return { value: state.report.score, margin: 0 };
  const expected = DISCIPLINES.reduce((sum, discipline) => sum + chapterScore(state, discipline), 0) * (1 - latePenalty(state.clock.hours));
  return { value: expected, margin: expected * reportSpread(state) };
}

/** Envia no Portal da CT: congela previsões e sorteia NR (dentro da faixa de estimateReportScore). Sem validar prazo. */
export function deliverReport(state: GameState): GameState {
  const estimate = estimateReportScore(state)!;
  const roll = nextRandom(state.rngState);
  const score = clamp(estimate.value + estimate.margin * (2 * roll.value - 1), 0, REGULAR_2026.reportMax);
  const late = latePenalty(state.clock.hours);
  const missing = [
    state.report.predictedEmptyWeightKg === null ? "peso vazio previsto" : null,
    state.report.payloadLine === null ? "reta de previsão de carga" : null
  ].filter(Boolean);
  const next: GameState = {
    ...state,
    rngState: roll.state,
    report: { ...state.report, submittedAt: state.clock.hours, score }
  };
  const lines = [
    `Relatório recebido. NR: ${score.toFixed(1)} de ${REGULAR_2026.reportMax}.`,
    late > 0 ? `Enviado com atraso: −${Math.round(late * 100)}% na nota.` : null,
    missing.length ? `Sem ${missing.join(" e ")}: essas previsões valem o mínimo na competição.` : null
  ].filter(Boolean);
  return addMessage(next, { from: "Comissão Técnica", title: "Relatório recebido", body: lines.join(" ") }).state;
}

/**
 * Envio no Portal da CT: congela previsões e sorteia NR. Também acontece sozinho no prazo de 16/ago
 * (com previsões completas) e em 23/ago (prazo final). Recusa depois de enviado ou de 23/ago.
 */
export function submitReport(state: GameState): GameState {
  if (state.report.submittedAt !== null) return warn(state, "O relatório já foi enviado.");
  if (state.clock.hours > REPORT_LATE_DEADLINE) return warn(state, "O prazo do relatório (23/ago) já passou.");
  return deliverReport(state);
}

/** Horas de uma tarefa concluída que entram no relatório ou na apresentação. */
export function addReportHours(
  state: GameState,
  kind: "report-chapter" | "drawings" | "oral-practice",
  hours: number,
  discipline: Discipline | null
): { state: GameState; body: string } {
  const report = state.report;
  if (kind === "oral-practice") {
    if (report.oralScore !== null) return { state, body: "A apresentação oral já aconteceu." };
    return {
      state: { ...state, report: { ...report, oralPracticeHours: (report.oralPracticeHours ?? 0) + hours } },
      body: "Apresentação ensaiada. Quem apresenta está mais seguro."
    };
  }
  if (report.submittedAt !== null) return { state, body: "O relatório já tinha sido enviado; o trabalho não entra na nota." };
  if (kind === "drawings") {
    return { state: { ...state, report: { ...report, drawingsHours: report.drawingsHours + hours } }, body: "Plantas atualizadas." };
  }
  if (!discipline) return { state, body: "Capítulo sem disciplina." };
  const chapter = report.chapters[discipline];
  return {
    state: {
      ...state,
      report: { ...report, chapters: { ...report.chapters, [discipline]: { ...chapter, hours: chapter.hours + hours } } }
    },
    body: `Capítulo de ${DISCIPLINE_LABELS[discipline]}: ${Math.round(chapter.hours + hours)} h de escrita no total.`
  };
}

/** Nota esperada da apresentação oral (0–40, 11.1) agora. */
export function expectedOralScore(state: GameState): number {
  const communication = Math.max(0, ...state.members.filter(canWork).map((member) => member.communication));
  const practice = saturate(state.report.oralPracticeHours ?? 0, R.oralPracticeHours);
  const share = R.oralBase + R.oralCommunication * (communication / 100) + R.oralKnowledge * documentedShare(state) + R.oralPractice * practice;
  return REGULAR_2026.oralMax * Math.min(1, share);
}

/** Marcos do relatório no relógio: envio automático (16/ago e 23/ago) e apresentação oral (17/out). */
export function reportEvents(state: GameState, t0: number, t1: number): GameState {
  const crossed = (at: number) => t0 < at && at <= t1;
  let next = state;
  const report = next.report;
  if (crossed(REPORT_DEADLINE) && report.submittedAt === null) {
    if (report.predictedEmptyWeightKg !== null && report.payloadLine !== null) {
      next = deliverReport(next);
    } else {
      next = addMessage(next, {
        from: "Comissão Técnica",
        title: "Relatório não enviado",
        body: "Faltam previsões no Portal da CT. Ainda dá para enviar até 23/ago, com penalidade por dia."
      }).state;
    }
  }
  if (crossed(REPORT_LATE_DEADLINE) && next.report.submittedAt === null) next = deliverReport(next);
  if (crossed(ORAL_DATE) && next.report.oralScore === null) {
    if (next.report.submittedAt === null) {
      next = { ...next, report: { ...next.report, oralScore: 0 } };
    } else {
      const roll = nextRandom(next.rngState);
      const expected = expectedOralScore(next);
      const oral = clamp(expected * (1 + R.oralSpread * (2 * roll.value - 1)), 0, REGULAR_2026.oralMax);
      next = { ...next, rngState: roll.state, report: { ...next.report, oralScore: oral } };
      next = addMessage(next, {
        from: "Comissão Técnica",
        title: "Apresentação oral avaliada",
        body: `Nota da apresentação oral: ${oral.toFixed(1)} de ${REGULAR_2026.oralMax}.`
      }).state;
    }
  }
  return next;
}
