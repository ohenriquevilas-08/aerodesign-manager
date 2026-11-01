import { describe, expect, it } from "vitest";
import { applyCommand, BALANCE, createGame, FORMATIONS, formationView, type GameState } from "../../src/sim";

const game = (): GameState => createGame({ seed: 9, teamName: "Formação" });

/** Acrescenta novatos sem área. */
function withRookies(state: GameState, count: number): GameState {
  const base = state.members.find((member) => member.id === "captain-aero")!;
  const rookies = Array.from({ length: count }, (_, index) => ({ ...base, id: `rookie-${index}`, name: `Novato ${index}`, role: "member" as const, area: null }));
  return { ...state, members: [...state.members, ...rookies] };
}

describe("set-area", () => {
  it("starts with the two captains in their areas and nobody else placed", () => {
    const view = formationView(game());
    expect(view.areas.find((a) => a.discipline === "aerodynamics")!.captainId).toBe("captain-aero");
    expect(view.areas.find((a) => a.discipline === "structures")!.captainId).toBe("captain-struct");
    expect(view.presidentId).toBe("president");
    expect(view.unassigned).toEqual([]);
  });

  it("places a rookie in an area and lists open slots", () => {
    let state = withRookies(game(), 2);
    expect(formationView(state).unassigned).toEqual(["rookie-0", "rookie-1"]);
    state = applyCommand(state, { type: "set-area", memberId: "rookie-0", area: "electrical" });
    const electrical = formationView(state).areas.find((a) => a.discipline === "electrical")!;
    expect(electrical.memberIds).toEqual(["rookie-0"]);
    expect(electrical.openSlots).toBe(FORMATIONS.regular.find((a) => a.discipline === "electrical")!.members - 1);
    expect(electrical.captainOpen).toBe(true);
    expect(formationView(state).unassigned).toEqual(["rookie-1"]);
  });

  it("refuses a full area", () => {
    const loads = FORMATIONS.regular.find((a) => a.discipline === "loads")!.members;
    let state = withRookies(game(), loads + 1);
    for (let i = 0; i < loads; i += 1) state = applyCommand(state, { type: "set-area", memberId: `rookie-${i}`, area: "loads" });
    const refused = applyCommand(state, { type: "set-area", memberId: `rookie-${loads}`, area: "loads" });
    expect(refused.warning?.text).toContain("cheia");
    expect(refused.members.find((m) => m.id === `rookie-${loads}`)!.area).toBeNull();
  });

  it("refuses two captains in the same area but allows a captain in an empty one", () => {
    let state = withRookies(game(), 2);
    const refused = applyCommand(state, { type: "set-area", memberId: "rookie-0", area: "aerodynamics", captain: true });
    expect(refused.warning?.text).toContain("capitão");
    state = applyCommand(state, { type: "set-area", memberId: "rookie-0", area: "stability", captain: true });
    expect(state.members.find((m) => m.id === "rookie-0")!.role).toBe("captain");
    expect(formationView(state).areas.find((a) => a.discipline === "stability")!.captainId).toBe("rookie-0");
  });

  it("refuses the president", () => {
    const refused = applyCommand(game(), { type: "set-area", memberId: "president", area: "aerodynamics" });
    expect(refused.warning?.text).toContain("presidente");
    expect(refused.members.find((m) => m.id === "president")!.area).toBeNull();
  });

  it("changing area costs motivation and keeps the tacit knowledge", () => {
    let state = withRookies(game(), 1);
    state = applyCommand(state, { type: "set-area", memberId: "rookie-0", area: "electrical" });
    const placed = state.members.find((m) => m.id === "rookie-0")!;
    expect(placed.motivation).toBe(game().members[1]!.motivation); // vir do "sem área" é grátis
    state = applyCommand(state, { type: "set-area", memberId: "rookie-0", area: "loads" });
    const moved = state.members.find((m) => m.id === "rookie-0")!;
    expect(moved.motivation).toBe(placed.motivation - BALANCE.formation.changeAreaMotivation);
    expect(moved.knowledge).toEqual(placed.knowledge);
  });

  it("area null takes the member out and demotes a captain", () => {
    const state = applyCommand(game(), { type: "set-area", memberId: "captain-aero", area: null });
    const member = state.members.find((m) => m.id === "captain-aero")!;
    expect(member.area).toBeNull();
    expect(member.role).toBe("member");
    expect(formationView(state).areas.find((a) => a.discipline === "aerodynamics")!.captainId).toBeNull();
  });
});

describe("formationView warnings", () => {
  it("warns what stops in an empty area and clears it when staffed", () => {
    const state = game();
    const electrical = formationView(state).areas.find((a) => a.discipline === "electrical")!;
    expect(electrical.warning).toContain("Elétrica sem ninguém");
    expect(formationView(state).areas.find((a) => a.discipline === "aerodynamics")!.warning).toBeNull();
    const staffed = applyCommand(withRookies(state, 1), { type: "set-area", memberId: "rookie-0", area: "electrical" });
    expect(formationView(staffed).areas.find((a) => a.discipline === "electrical")!.warning).toBeNull();
  });

  it("covers the six areas of the Regular class", () => {
    expect(formationView(game()).areas.map((a) => a.discipline)).toEqual([
      "aerodynamics",
      "structures",
      "electrical",
      "performance",
      "stability",
      "loads"
    ]);
  });
});
