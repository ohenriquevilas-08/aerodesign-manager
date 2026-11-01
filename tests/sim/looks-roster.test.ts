import { describe, expect, it } from "vitest";
import { drawCandidates, hireCandidate } from "../../src/sim/selection";
import { createGame, drawLook, formationView, LOOK_OPTIONS, rosterMembers, type MemberLook } from "../../src/sim";

function validLook(look: MemberLook) {
  expect(LOOK_OPTIONS.skin).toContain(look.skin);
  expect(LOOK_OPTIONS.hair).toContain(look.hair);
  expect(LOOK_OPTIONS.hairColor).toContain(look.hairColor);
  expect(LOOK_OPTIONS.shirt).toContain(look.shirt);
  if (look.accessory !== undefined) expect(LOOK_OPTIONS.accessory).toContain(look.accessory);
}

describe("aparência dos integrantes (S3)", () => {
  it("todo integrante inicial tem look sorteado pelo seed, determinístico", () => {
    const game = createGame({ seed: 42, teamName: "T" });
    for (const member of game.members) validLook(member.look);
    expect(createGame({ seed: 42, teamName: "T" }).members.map((m) => m.look)).toEqual(game.members.map((m) => m.look));
  });

  it("o sorteio varia e às vezes traz acessório", () => {
    let rng = 1;
    const looks: MemberLook[] = [];
    for (let i = 0; i < 60; i += 1) {
      const drawn = drawLook(rng);
      rng = drawn.rngState;
      looks.push(drawn.look);
    }
    expect(new Set(looks.map((look) => look.skin)).size).toBeGreaterThan(1);
    expect(new Set(looks.map((look) => look.hair)).size).toBeGreaterThan(2);
    expect(looks.some((look) => look.accessory)).toBe(true);
    expect(looks.some((look) => !look.accessory)).toBe(true);
  });

  it("candidato da seletiva tem look e o leva ao ser convidado", () => {
    const state = drawCandidates(createGame({ seed: 5, teamName: "T" }), "broad", 3);
    expect(state.candidates.length).toBeGreaterThan(0);
    for (const candidate of state.candidates) validLook(candidate.look);
    const candidate = state.candidates[0]!;
    const hired = hireCandidate(state, candidate.id)!;
    expect(hired.members.at(-1)!.look).toEqual(candidate.look);
  });
});

describe("presidente fora das listas (S4)", () => {
  it("rosterMembers tira o presidente; a formação também", () => {
    const game = createGame({ seed: 1, teamName: "T" });
    const roster = rosterMembers(game);
    expect(roster.map((m) => m.id)).toEqual(["captain-aero", "captain-struct"]);
    expect(roster.some((m) => m.role === "president")).toBe(false);
    const view = formationView({ ...game, members: game.members.map((m) => ({ ...m, area: null })) });
    expect(view.unassigned).not.toContain("president");
  });
});
