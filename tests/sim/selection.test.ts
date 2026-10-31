import { describe, expect, it } from "vitest";
import { applyCommand, createGame, missingCast, SELECTION_FORMATS, type Command, type GameState } from "../../src/sim";

const run = (state: GameState, ...commands: Command[]): GameState => commands.reduce(applyCommand, state);

/** Faz uma seletiva completa no formato dado, com os três fundadores alocados. */
function runSelection(seed: number, format: string): GameState {
  let game = run(createGame({ seed, teamName: "T" }), { type: "start-action", actionId: "recruitment", targetId: format });
  const taskId = game.tasks[0]!.id;
  game = run(
    game,
    { type: "assign-member", memberId: "president", taskId },
    { type: "assign-member", memberId: "captain-aero", taskId },
    { type: "assign-member", memberId: "captain-struct", taskId }
  );
  for (let i = 0; i < 60 && game.tasks[0]!.status !== "done"; i += 1) {
    game = run(game, { type: "set-speed", speed: 1 }, { type: "tick", realSeconds: 10 });
  }
  return game;
}

describe("seletiva de fundação", () => {
  it("exige escolher o formato", () => {
    const game = run(createGame({ seed: 1, teamName: "T" }), { type: "start-action", actionId: "recruitment" });
    expect(game.tasks).toHaveLength(0);
    expect(game.warning?.text).toContain("formato");
  });

  it("sorteia a quantidade de candidatos do formato, dentro das faixas, com parecer", () => {
    for (const format of SELECTION_FORMATS) {
      const game = runSelection(3, format.id);
      expect(game.tasks[0]!.label).toBe(`Processo seletivo (${format.label})`);
      expect(game.candidates).toHaveLength(format.candidates);
      for (const candidate of game.candidates) {
        const focus = candidate.knowledge[candidate.focus];
        expect(focus).toBeGreaterThanOrEqual(format.focusKnowledge[0]);
        expect(focus).toBeLessThanOrEqual(format.focusKnowledge[1]);
        expect(candidate.motivation).toBeGreaterThanOrEqual(format.motivation[0]);
        expect(candidate.motivation).toBeLessThanOrEqual(format.motivation[1]);
        expect(candidate.opinion).toMatch(/^Capit/);
      }
      expect(new Set(game.candidates.map((candidate) => candidate.name)).size).toBe(game.candidates.length);
    }
  });

  it("é reproduzível pelo seed e muda com outro seed", () => {
    expect(runSelection(5, "broad").candidates).toEqual(runSelection(5, "broad").candidates);
    expect(runSelection(6, "broad").candidates).not.toEqual(runSelection(5, "broad").candidates);
  });

  it("convite é gratuito e completa o elenco mínimo", () => {
    let game = runSelection(9, "technical");
    expect(missingCast(game)).toEqual(["third"]);
    const credits = game.credits;
    const candidate = game.candidates[0]!;
    game = run(game, { type: "hire-candidate", candidateId: candidate.id });
    const hired = game.members.at(-1)!;
    expect(hired).toMatchObject({ name: candidate.name, role: "member", taskId: null, fabrication: candidate.fabrication });
    expect(game.credits).toBe(credits);
    expect(game.candidates).toHaveLength(2);
    expect(missingCast(game)).toEqual([]);

    game = run(game, { type: "hire-candidate", candidateId: candidate.id });
    expect(game.warning?.text).toContain("candidato");

    game = run(game, { type: "dismiss-candidates" });
    expect(game.candidates).toEqual([]);
  });
});
