import { describe, expect, it } from "vitest";
import { REPORT_DEADLINE } from "../../src/sim/report";
import { applyCommand, createGame, DEFAULT_DESIGN, DISCIPLINES, reportChecklist, type GameState } from "../../src/sim";

const game = () => createGame({ seed: 3, teamName: "T" });
const designed = (state: GameState): GameState => applyCommand(state, { type: "set-design", design: DEFAULT_DESIGN });
const writing = (state: GameState, hours: number): GameState => ({
  ...state,
  report: { ...state.report, chapters: { ...state.report.chapters, aerodynamics: { hours, testsCited: 0 } } }
});

describe("submit-report on day one (playtest bug)", () => {
  it("refuses with no design, even with the default predictions", () => {
    const state = applyCommand(game(), { type: "submit-report" });
    expect(state.report.submittedAt).toBeNull();
    expect(state.warning?.text).toContain("projeto");
  });

  it("refuses a recorded design with nothing written", () => {
    const state = applyCommand(designed(game()), { type: "submit-report" });
    expect(state.report.submittedAt).toBeNull();
    expect(state.warning?.text).toContain("1 h");
  });

  it("accepts a recorded design with at least 1 h in a chapter", () => {
    const state = applyCommand(writing(designed(game()), 1), { type: "submit-report" });
    expect(state.report.submittedAt).not.toBeNull();
    expect(state.report.score).not.toBeNull();
  });

  it("the automatic delivery on 16/ago still happens without the manual rules", () => {
    const state = { ...game(), report: { ...game().report, predictedEmptyWeightKg: 3, payloadLine: { a: 0, b: 5, cap: null } } };
    const sent = applyCommand({ ...state, clock: { hours: REPORT_DEADLINE - 0.5, speed: 4 } }, { type: "tick", realSeconds: 1 });
    expect(sent.report.submittedAt).not.toBeNull();
  });
});

describe("reportChecklist", () => {
  it("starts with every chapter not started and both predictions missing", () => {
    const list = reportChecklist(game());
    expect(list.chapters).toHaveLength(DISCIPLINES.length);
    expect(list.chapters.every((c) => c.state === "not-started")).toBe(true);
    expect(list.chapters[0]!.missing[0]).toContain("não começou");
    expect(list.predictions).toEqual({ emptyWeight: "missing", payloadLine: "missing" });
    expect(list.blocker).toContain("projeto");
    expect(list.submitted).toBe(false);
  });

  it("moves a chapter through writing to ready and shows what is missing", () => {
    const writingList = reportChecklist(writing(game(), 5));
    const aero = writingList.chapters.find((c) => c.discipline === "aerodynamics")!;
    expect(aero.state).toBe("writing");
    expect(aero.missing.some((line) => line.includes("h de escrita"))).toBe(true);
    expect(aero.missing.some((line) => line.includes("ensaio"))).toBe(true);
    const ready = reportChecklist(writing(game(), 40)).chapters.find((c) => c.discipline === "aerodynamics")!;
    expect(ready.state).toBe("ready");
    expect(ready.missing.some((line) => line.includes("h de escrita"))).toBe(false);
    expect(ready.expectedScore).toBeGreaterThan(aero.expectedScore);
    expect(ready.maxScore).toBe(25);
  });

  it("tracks predictions and the countdown to 16/ago", () => {
    const state = applyCommand(game(), { type: "set-predictions", emptyWeightKg: 3.2 });
    const list = reportChecklist(state);
    expect(list.predictions).toEqual({ emptyWeight: "ready", payloadLine: "missing" });
    expect(list.deadline.at).toBe(REPORT_DEADLINE);
    expect(list.deadline.hoursLeft).toBe(REPORT_DEADLINE);
    expect(list.deadline.passed).toBe(false);
    expect(list.deadline.countdown).toMatch(/^\d+d \d\dh$/);
    expect(reportChecklist({ ...state, clock: { ...state.clock, hours: REPORT_DEADLINE + 5 } }).deadline.passed).toBe(true);
  });

  it("has no blocker once there is a design and writing, and marks sent after submit", () => {
    const state = writing(designed(game()), 3);
    expect(reportChecklist(state).blocker).toBeNull();
    const sent = applyCommand(state, { type: "submit-report" });
    const list = reportChecklist(sent);
    expect(list.submitted).toBe(true);
    expect(list.predictions.emptyWeight).toBe("sent");
    expect(list.blocker).toContain("já foi enviado");
  });
});
