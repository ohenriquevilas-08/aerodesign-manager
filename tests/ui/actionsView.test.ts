import { describe, expect, it } from "vitest";
import { createGame, findAction } from "../../src/sim";
import { actionGroups, deliveredText, groupSummary, normalize } from "../../src/ui/actionsView";

const game = createGame({ seed: 3, teamName: "T" });

describe("actionsView", () => {
  it("em novembro fabricação, ensaios e relatório ficam para 'mais adiante'", () => {
    const groups = actionGroups(game);
    for (const id of ["fabrication", "tests", "report"] as const) {
      const group = groups.find((item) => item.id === id)!;
      expect(group.available).toHaveLength(0);
      expect(group.later[0]!.reason).toContain("regulamento");
    }
    expect(groups.find((item) => item.id === "outreach")!.available.length).toBe(4);
  });

  it("busca ignora acento e caixa", () => {
    expect(normalize("Fabricação")).toBe("fabricacao");
    const found = actionGroups(game, "SELETIVO").flatMap((group) => group.available.map((action) => action.id));
    expect(found).toEqual(["recruitment"]);
  });

  it("resume o grupo e diz o que já entregou", () => {
    expect(groupSummary(actionGroups(game).find((item) => item.id === "funding")!)).toBe("2 para fazer agora");
    expect(deliveredText({ yielded: 3, yieldTotal: 6 }, findAction("recruitment"))).toBe("3 candidatos até agora");
    expect(deliveredText({ yielded: 0, yieldTotal: null }, findAction("raffle"))).toBeNull();
  });
});
