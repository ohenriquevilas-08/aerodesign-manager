import { describe, expect, it } from "vitest";
import { drawLook, formationView, LOOK_OPTIONS, rosterMembers, TEAM_SHIRT_COLOR, type MemberLook } from "../../src/sim";
import { startedGame, withApplicants } from "./helpers";
import { approveApplicants } from "../../src/sim/selection";

function validLook(look: MemberLook) {
  const index = (value: number, count: number) => {
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(count);
  };
  index(look.skin, LOOK_OPTIONS.skins);
  index(look.hair, LOOK_OPTIONS.hairs);
  index(look.hairColor, LOOK_OPTIONS.hairColors);
  expect(look.shirt).toBe(TEAM_SHIRT_COLOR);
  if (look.accessory !== undefined) expect(LOOK_OPTIONS.accessories).toContain(look.accessory);
}

describe("aparência dos integrantes (S3)", () => {
  it("todo integrante inicial tem look sorteado pelo seed, determinístico", () => {
    const game = startedGame({ seed: 42, teamName: "T" });
    for (const member of game.members) validLook(member.look);
    expect(startedGame({ seed: 42, teamName: "T" }).members.map((m) => m.look)).toEqual(game.members.map((m) => m.look));
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

  it("inscrito da seletiva tem look e o leva ao ser aprovado", () => {
    const state = withApplicants(startedGame({ seed: 5, teamName: "T" }), 3);
    const applicants = state.selection!.applicants;
    expect(applicants.length).toBe(3);
    for (const applicant of applicants) validLook(applicant.profile.look);
    const hired = approveApplicants(state, [applicants[0]!.id]);
    expect(hired.members.at(-1)!.look).toEqual(applicants[0]!.profile.look);
  });
});

describe("presidente é um aluno (Fase 6)", () => {
  it("rosterMembers inclui o presidente; a formação o lista como qualquer aluno", () => {
    const game = startedGame({ seed: 1, teamName: "T" });
    const roster = rosterMembers(game);
    expect(roster.map((m) => m.id).sort()).toEqual(["founder-bia", "founder-caio", "founder-marina", "founder-rafa"]);
    expect(roster.some((m) => m.role === "president")).toBe(true);
    const view = formationView({ ...game, members: game.members.map((m) => ({ ...m, area: null })) });
    expect(view.presidentId).toBe("founder-bia");
    expect(view.unassigned).toContain("founder-bia");
  });
});
