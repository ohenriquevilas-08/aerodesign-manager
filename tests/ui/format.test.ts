import { describe, expect, it } from "vitest";
import { ACTIONS } from "../../src/sim";
import { costParts, crewText, formatDays, formatNumber, isCounterfeit, motivationLabel, pauseReasonLabel } from "../../src/ui/format";

describe("costParts (design §8)", () => {
  it("mantém a ordem horas, créditos, prazo, risco", () => {
    const parts = costParts({ hours: 12, credits: 30, leadDays: 3, risk: "medium" });
    expect(parts.map((part) => part.kind)).toEqual(["hours", "credits", "lead", "risk"]);
    expect(parts.map((part) => `${part.icon} ${part.text}`)).toEqual(["⏱ 12 h", "◆ 30", "⌛ 3 d", "⚠ risco médio"]);
  });

  it("omite o que for zero", () => {
    expect(costParts({ hours: 0, credits: 420, leadDays: 10, risk: "none" }).map((part) => part.kind)).toEqual([
      "credits",
      "lead"
    ]);
    expect(costParts({ hours: 0, credits: 0, leadDays: 0, risk: "none" })).toEqual([]);
  });

  it("mostra o prazo ⌛ em faixa quando a entrega varia", () => {
    const cost = { hours: 0, credits: 420, leadDays: 10, risk: "none" as const };
    expect(costParts(cost, { min: 8, promised: 10, max: 14 })[1]?.text).toBe("8–14 d");
    expect(costParts(cost, null)[1]?.text).toBe("10 d");
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

describe("tarefas", () => {
  it("formata a duração estimada", () => {
    expect(formatDays(null)).toBe("parada");
    expect(formatDays(0.4)).toBe("< 1 d");
    expect(formatDays(3.46)).toBe("~3,5 d");
    expect(formatDays(12.6)).toBe("~13 d");
  });

  it("descreve quantas pessoas cabem", () => {
    expect(crewText({ min: 0, ideal: 0, max: 0 })).toBe("sem equipe");
    expect(crewText({ min: 1, ideal: 1, max: 1 })).toBe("1 pessoa");
    expect(crewText({ min: 1, ideal: 2, max: 3 })).toBe("1–3 pessoas · ideal 2");
    expect(crewText({ min: 1, ideal: 2, max: 2 })).toBe("1–2 pessoas");
  });
});

describe("motivo da pausa", () => {
  it("cobre os motivos novos da Fase 3 e cai em 'Pausado' se não conhecer", () => {
    expect(pauseReasonLabel("order")).toBe("Pedido");
    expect(pauseReasonLabel("flight")).toBe("Seu voo");
    expect(pauseReasonLabel("competition")).toBe("Competição");
    expect(pauseReasonLabel("algo-novo")).toBe("Pausado");
  });
});

describe("peça falsificada", () => {
  const part = { id: "p", type: "electronics" as const, label: "Servos", quality: 50, condition: 90 };
  it("só marca quando counterfeit é true", () => {
    expect(isCounterfeit(part)).toBe(false);
    expect(isCounterfeit({ ...part, counterfeit: true } as typeof part)).toBe(true);
  });
});
