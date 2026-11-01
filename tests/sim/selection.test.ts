import { describe, expect, it } from "vitest";
import {
  applyCommand,
  estimateOutcome,
  missingCast,
  SELECTION_FORMATS,
  type Command,
  type GameState
} from "../../src/sim";
import { foundedGame as startedGame } from "./helpers";

const run = (state: GameState, ...commands: Command[]): GameState => commands.reduce(applyCommand, state);

const CREW = ["founder-marina", "founder-caio"];

/** Faz uma seletiva completa no formato dado, com os dois capitães e um alcance de divulgação inicial. */
function runSelection(seed: number, format: string, outreach = 20): GameState {
  let game: GameState = { ...startedGame({ seed, teamName: "T" }), outreach };
  game = run(game, { type: "start-action", actionId: "recruitment", targetId: format });
  const taskId = game.tasks[0]!.id;
  game = run(game, ...CREW.map((memberId): Command => ({ type: "assign-member", memberId, taskId })));
  for (let i = 0; i < 60 && game.tasks[0]!.status !== "done"; i += 1) {
    game = run(game, { type: "set-speed", speed: 1 }, { type: "tick", realSeconds: 10 });
  }
  return game;
}

describe("seletiva de fundação", () => {
  it("exige escolher o formato", () => {
    const game = run(startedGame({ seed: 1, teamName: "T" }), { type: "start-action", actionId: "recruitment" });
    expect(game.tasks).toHaveLength(0);
    expect(game.warning?.text).toContain("formato");
  });

  it("candidatos saem dentro das faixas do formato, com parecer e nomes únicos", () => {
    for (const format of SELECTION_FORMATS) {
      const game = runSelection(3, format.id, 30);
      expect(game.tasks[0]!.label).toBe(`Processo seletivo (${format.label})`);
      for (const candidate of game.candidates) {
        const focus = candidate.knowledge[candidate.focus];
        expect(focus).toBeGreaterThanOrEqual(format.focusKnowledge[0]);
        expect(focus).toBeLessThanOrEqual(format.focusKnowledge[1]);
        expect(candidate.motivation).toBeGreaterThanOrEqual(format.motivation[0]);
        expect(candidate.motivation).toBeLessThanOrEqual(format.motivation[1]);
        expect(candidate.opinion).toMatch(/^[\p{L} ]+: "/u);
      }
      expect(new Set(game.candidates.map((candidate) => candidate.name)).size).toBe(game.candidates.length);
    }
  });

  it("o número de inscritos é sorteado dentro da estimativa e consome o alcance", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const base: GameState = { ...startedGame({ seed, teamName: "T" }), outreach: 20 };
      const estimate = estimateOutcome(base, "recruitment", CREW, "broad")!;
      expect(estimate.text).toMatch(/^Inscritos estimados \d+(–\d+)?$/);
      const game = runSelection(seed, "broad", 20);
      expect(game.candidates.length).toBeGreaterThanOrEqual(estimate.min);
      expect(game.candidates.length).toBeLessThanOrEqual(estimate.max);
      expect(game.outreach).toBe(0);
    }
  });

  it("sem divulgação a seletiva ampla rende pouca gente; com divulgação, mais", () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const total = (outreach: number) =>
      seeds.reduce((sum, seed) => sum + runSelection(seed, "broad", outreach).candidates.length, 0);
    const cold = estimateOutcome(startedGame({ seed: 1, teamName: "T" }), "recruitment", CREW, "broad")!;
    expect(cold.max).toBeLessThanOrEqual(2);
    expect(total(30)).toBeGreaterThan(total(0) * 3);
  });

  it("é reproduzível pelo seed", () => {
    expect(runSelection(5, "broad").candidates).toEqual(runSelection(5, "broad").candidates);
  });

  it("convite é gratuito e completa o elenco mínimo", () => {
    let game = runSelection(9, "technical", 40);
    // Rafa, o quarto fundador, já é o terceiro nome do elenco mínimo.
    expect(missingCast(game)).toEqual([]);
    const credits = game.credits;
    const count = game.candidates.length;
    expect(count).toBeGreaterThan(0);
    const candidate = game.candidates[0]!;
    game = run(game, { type: "hire-candidate", candidateId: candidate.id });
    const hired = game.members.at(-1)!;
    expect(hired).toMatchObject({ name: candidate.name, role: "trainee", trainingHours: 0, taskId: null, fabrication: candidate.fabrication });
    expect(game.credits).toBe(credits);
    expect(game.candidates).toHaveLength(count - 1);
    expect(missingCast(game)).toEqual([]);

    game = run(game, { type: "hire-candidate", candidateId: candidate.id });
    expect(game.warning?.text).toContain("candidato");

    game = run(game, { type: "dismiss-candidates" });
    expect(game.candidates).toEqual([]);
  });
});
