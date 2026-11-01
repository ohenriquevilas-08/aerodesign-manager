import { describe, expect, it } from "vitest";
import { chapterScore, latePenalty, ORAL_DATE, REPORT_DEADLINE, REPORT_LATE_DEADLINE } from "../../src/sim/report";
import { step } from "../../src/sim/loop";
import {
  applyCommand,
  createGame,
  DEFAULT_DESIGN,
  DISCIPLINES,
  estimateReportScore,
  REGULAR_2026,
  REPORT_CHAPTERS,
  type GameState
} from "../../src/sim";

const game = () => createGame({ seed: 3, teamName: "T" });

function withChapters(state: GameState, hours: number, tests = 0, documented = 0, drawings = 0): GameState {
  const chapters = Object.fromEntries(DISCIPLINES.map((d) => [d, { hours, testsCited: tests }])) as GameState["report"]["chapters"];
  const doc = Object.fromEntries(DISCIPLINES.map((d) => [d, documented])) as GameState["documented"];
  return { ...state, documented: doc, report: { ...state.report, chapters, drawingsHours: drawings } };
}

/** Projeto gravado na prancheta (o envio exige). */
const designed = (state: GameState): GameState => applyCommand(state, { type: "set-design", design: DEFAULT_DESIGN });

const at = (state: GameState, hours: number): GameState => ({ ...state, clock: { ...state.clock, hours } });

describe("nota do relatório (11.1)", () => {
  it("sem nada escrito vale 0", () => {
    expect(estimateReportScore(game())).toEqual({ value: 0, margin: 0 });
  });

  it("horas, acervo e ensaios citados sobem a nota; nunca passa do máximo do capítulo", () => {
    const base = withChapters(game(), 30);
    const more = withChapters(game(), 80);
    const documented = withChapters(game(), 30, 0, 70);
    const tested = withChapters(game(), 30, 3);
    for (const d of DISCIPLINES) {
      expect(chapterScore(more, d)).toBeGreaterThan(chapterScore(base, d));
      expect(chapterScore(documented, d)).toBeGreaterThan(chapterScore(base, d));
      expect(chapterScore(tested, d)).toBeGreaterThan(chapterScore(base, d));
    }
    const maxed = withChapters(game(), 1e6, 1e6, 100, 1e6);
    for (const d of DISCIPLINES) expect(chapterScore(maxed, d)).toBeCloseTo(REPORT_CHAPTERS[d], 3);
    expect(estimateReportScore(maxed)!.value).toBeCloseTo(REGULAR_2026.reportMax, 2);
  });

  it("plantas só pontuam em Projeto conceitual e Estruturas", () => {
    const plans = withChapters(game(), 0, 0, 0, 40);
    expect(chapterScore(plans, "conceptual")).toBeGreaterThan(0);
    expect(chapterScore(plans, "structures")).toBeGreaterThan(0);
    expect(chapterScore(plans, "aerodynamics")).toBe(0);
  });

  it("acervo maior dá margem relativa menor", () => {
    const weak = estimateReportScore(withChapters(game(), 40))!;
    const strong = estimateReportScore(withChapters(game(), 40, 0, 90))!;
    expect(strong.margin / strong.value).toBeLessThan(weak.margin / weak.value);
  });

  it("escrever o capítulo pelo catálogo soma horas na disciplina escolhida", () => {
    let state = applyCommand(game(), { type: "start-action", actionId: "report-chapter" });
    expect(state.warning?.text).toContain("disciplina");
    state = applyCommand(state, { type: "start-action", actionId: "report-chapter", targetId: "performance" });
    const taskId = state.tasks[0]!.id;
    state = applyCommand(state, { type: "assign-member", memberId: "captain-aero", taskId });
    for (let i = 0; i < 400 && state.tasks[0]!.status !== "done"; i += 1) {
      state = applyCommand(applyCommand(state, { type: "set-speed", speed: 4 }), { type: "tick", realSeconds: 10 });
    }
    expect(state.report.chapters.performance.hours).toBeCloseTo(30, 3);
    expect(state.report.chapters.aerodynamics.hours).toBe(0);
  });
});

describe("envio no Portal da CT", () => {
  it("congela previsões e sorteia a NR dentro da faixa estimada", () => {
    const ready = designed(withChapters(game(), 40, 1, 40, 20));
    const estimate = estimateReportScore(ready)!;
    const sent = applyCommand(ready, { type: "submit-report" });
    expect(sent.report.submittedAt).toBe(0);
    expect(sent.report.score!).toBeGreaterThanOrEqual(estimate.value - estimate.margin - 1e-9);
    expect(sent.report.score!).toBeLessThanOrEqual(estimate.value + estimate.margin + 1e-9);
    expect(estimateReportScore(sent)).toEqual({ value: sent.report.score, margin: 0 });
    expect(applyCommand(sent, { type: "set-predictions", emptyWeightKg: 3 }).warning?.text).toContain("congeladas");
    expect(applyCommand(sent, { type: "submit-report" }).warning?.text).toContain("já foi enviado");
  });

  it("penaliza por dia de atraso entre 16 e 23/ago e recusa depois", () => {
    expect(latePenalty(REPORT_DEADLINE)).toBe(0);
    expect(latePenalty(REPORT_DEADLINE + 1)).toBeCloseTo(0.05);
    expect(latePenalty(REPORT_DEADLINE + 49)).toBeCloseTo(0.15);
    const ready = withChapters(game(), 40);
    expect(estimateReportScore(at(ready, REPORT_DEADLINE + 30))!.value).toBeCloseTo(estimateReportScore(ready)!.value * 0.9);
    expect(applyCommand(at(ready, REPORT_LATE_DEADLINE + 1), { type: "submit-report" }).warning?.text).toContain("23/ago");
  });

  it("envia sozinho em 16/ago se as previsões estão prontas", () => {
    let state = at(withChapters(game(), 40), REPORT_DEADLINE - 0.5);
    state = { ...state, report: { ...state.report, predictedEmptyWeightKg: 3.3, payloadLine: { a: -0.003, b: 14, cap: null } } };
    state = step(state, 1);
    expect(state.report.submittedAt).not.toBeNull();
    expect(state.inbox.some((m) => m.title === "Relatório recebido")).toBe(true);
  });

  it("sem previsões, avisa em 16/ago e força o envio com penalidade em 23/ago", () => {
    let state = step(at(withChapters(game(), 40), REPORT_DEADLINE - 0.5), 1);
    expect(state.report.submittedAt).toBeNull();
    expect(state.inbox.at(-1)?.title).toBe("Relatório não enviado");
    state = step(at(state, REPORT_LATE_DEADLINE - 0.5), 1);
    expect(state.report.submittedAt).not.toBeNull();
    expect(state.inbox.some((m) => m.body.includes("atraso"))).toBe(true);
  });
});

describe("apresentação oral (17/out)", () => {
  it("dá nota de 0 a 40 a quem enviou o relatório; ensaiar ajuda", () => {
    const sent = applyCommand(designed(withChapters(game(), 40, 0, 50)), { type: "submit-report" });
    const oral = step(at(sent, ORAL_DATE - 0.5), 1).report.oralScore!;
    expect(oral).toBeGreaterThan(0);
    expect(oral).toBeLessThanOrEqual(REGULAR_2026.oralMax);
    const practiced = { ...sent, report: { ...sent.report, oralPracticeHours: 30 } };
    const scores = (s: GameState) => step(at(s, ORAL_DATE - 0.5), 1).report.oralScore!;
    expect(scores(practiced)).toBeGreaterThan(scores(sent));
  });

  it("sem relatório enviado, a oral vale 0", () => {
    expect(step(at(game(), ORAL_DATE - 0.5), 1).report.oralScore).toBe(0);
  });
});
