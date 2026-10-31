import { describe, expect, it } from "vitest";
import { ACTIONS } from "../../src/sim";
import { costParts, formatNumber, motivationLabel } from "../../src/ui/format";

describe("costParts (design §8)", () => {
  it("mantém a ordem horas, créditos, prazo, risco", () => {
    const parts = costParts({ hours: 12, credits: 30, leadDays: 3, risk: "medium" });
    expect(parts.map((part) => part.kind)).toEqual(["hours", "credits", "lead", "risk"]);
    expect(parts.map((part) => `${part.icon} ${part.text}`)).toEqual(["⏱ 12 h", "◆ 30", "⌛ 3 d", "⚠ médio"]);
  });

  it("omite o que for zero", () => {
    expect(costParts({ hours: 0, credits: 420, leadDays: 10, risk: "none" }).map((part) => part.kind)).toEqual([
      "credits",
      "lead"
    ]);
    expect(costParts({ hours: 0, credits: 0, leadDays: 0, risk: "none" })).toEqual([]);
  });

  it("toda ação do catálogo tem ao menos uma moeda", () => {
    for (const action of ACTIONS) expect(costParts(action.cost).length).toBeGreaterThan(0);
  });
});

describe("formatação pt-BR", () => {
  it("usa vírgula decimal e ponto de milhar", () => {
    expect(formatNumber(1234.5, 2)).toBe("1.234,50");
    expect(formatNumber(0.756, 2)).toBe("0,76");
  });

  it("descreve a motivação em faixas", () => {
    expect(motivationLabel(80)).toBe("Alta");
    expect(motivationLabel(60)).toBe("Média");
    expect(motivationLabel(10)).toBe("Muito baixa");
  });
});
