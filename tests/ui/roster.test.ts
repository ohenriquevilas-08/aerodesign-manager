import { describe, expect, it } from "vitest";
import { createGame, rosterMembers } from "../../src/sim";
import { BASE_COLUMNS, memberOverall, nextSort, ROSTER_COLUMNS, rosterSummary, shiftsPerMember, sortRoster, stepSelection, type RosterContext } from "../../src/ui/roster";

const game = createGame({ seed: 3, teamName: "T" });
const members = rosterMembers(game);
const ctx: RosterContext = { date: 0, tasks: [], shifts: {} };

describe("roster", () => {
  it("a nota geral é a média arredondada de conhecimento e habilidades", () => {
    const base = members[0]!;
    const flat = { conceptual: 50, aerodynamics: 0, performance: 0, stability: 0, loads: 0, structures: 0, electrical: 0 };
    const member = { ...base, area: null, fabrication: 50, communication: 50, piloting: 50, agility: 50, knowledge: flat };
    expect(memberOverall(member)).toBe(50);
    expect(memberOverall({ ...member, area: "aerodynamics" })).toBe(40);
  });

  it("ordena por coluna numérica nos dois sentidos, sem mexer na lista original", () => {
    const column = ROSTER_COLUMNS.development.find((item) => item.id === "fabrication")!;
    const before = members.map((m) => m.id);
    const asc = sortRoster(members, column, false, ctx).map((m) => Math.round(m.fabrication));
    const desc = sortRoster(members, column, true, ctx).map((m) => Math.round(m.fabrication));
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    expect(desc).toEqual([...asc].reverse());
    expect(members.map((m) => m.id)).toEqual(before);
  });

  it("ordena por nome em ordem alfabética", () => {
    const names = sortRoster(members, BASE_COLUMNS[0]!, false, ctx).map((m) => m.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  it("nextSort: mesma coluna inverte; coluna numérica nova começa decrescente", () => {
    const num = ROSTER_COLUMNS.status[0]!;
    expect(nextSort({ columnId: "name", descending: false }, num)).toEqual({ columnId: num.id, descending: true });
    expect(nextSort({ columnId: num.id, descending: true }, num)).toEqual({ columnId: num.id, descending: false });
    expect(nextSort({ columnId: num.id, descending: true }, BASE_COLUMNS[0]!)).toEqual({ columnId: "name", descending: false });
  });

  it("stepSelection anda pela lista e pára nas pontas", () => {
    const ids = ["a", "b", "c"];
    expect(stepSelection(ids, "a", 1)).toBe("b");
    expect(stepSelection(ids, "c", 1)).toBe("c");
    expect(stepSelection(ids, "a", -1)).toBe("a");
    expect(stepSelection(ids, null, 1)).toBe("a");
    expect(stepSelection([], null, 1)).toBeNull();
  });

  it("shiftsPerMember conta os turnos de cada um e rosterSummary soma a equipe", () => {
    expect(shiftsPerMember({ "1-morning": ["x", "y"], "2-evening": ["x"] })).toEqual({ x: 2, y: 1 });
    const summary = rosterSummary(members);
    expect(summary.perArea.reduce((sum, item) => sum + item.count, 0)).toBe(members.length);
  });
});
