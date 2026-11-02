import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  SEASON_START,
  academicFactor,
  advanceClock,
  createGame,
  drawField,
  FIELD_SIZE,
  formatCountdown,
  formatDate,
  gameHoursForRealSeconds,
  upcomingDeadlines
} from "../../src/sim";

describe("relógio", () => {
  it("em 1×, 10 s reais equivalem a um dia de jogo", () => {
    expect(gameHoursForRealSeconds(10, 1)).toBe(24);
    expect(gameHoursForRealSeconds(10, 4)).toBe(96);
  });

  it("não anda pausado", () => {
    const clock = { hours: 5, speed: 0 as const };
    expect(advanceClock(clock, 30)).toBe(clock);
  });

  it("começa na segunda-feira 10 de novembro de 2025", () => {
    expect(formatDate(SEASON_START)).toBe("seg, 10 nov 2025");
  });

  it("mostra contagem regressiva até o próximo prazo", () => {
    // O convite dos fundadores é o marco do dia 0; o próximo é o processo seletivo.
    const [first] = upcomingDeadlines(0);
    expect(first?.id).toBe("selection");
    expect(formatCountdown(0, Date.UTC(2025, 10, 11, 4))).toBe("1d 04h");
  });

  it("aplica o calendário acadêmico genérico", () => {
    expect(academicFactor(Date.UTC(2026, 6, 10)).factor).toBe(1.6);
    expect(academicFactor(Date.UTC(2026, 3, 15)).label).toBe("Provas");
    expect(academicFactor(Date.UTC(2026, 4, 5)).factor).toBe(1);
  });
});

describe("estado inicial do Ano 1", () => {
  it("começa com caixa zero, quatro fundadores sem cargo e o orientador", () => {
    const game = createGame({ seed: 42, teamName: "Teste" });
    expect(game.version).toBe(10);
    expect(game.credits).toBe(0);
    expect(game.members).toHaveLength(4);
    expect(game.members.every((member) => member.role === "member" && member.area === null)).toBe(true);
    expect(game.members.every((member) => member.agenda && member.flair)).toBe(true);
    expect(game.founding).toBe(true);
    expect(game.clock).toEqual({ hours: 0, speed: 0 });
    expect(game.advisor.reputation).toBeGreaterThan(0);
    expect(game.plannedActions).toEqual([]);
  });

  it("sorteia um campo reproduzível, nacional e com as rivais de destaque", () => {
    const a = drawField(7);
    const b = drawField(7);
    expect(a.rivals).toEqual(b.rivals);
    expect(a.rivals).toHaveLength(FIELD_SIZE);
    expect(new Set(a.rivals.map((team) => team.id)).size).toBe(FIELD_SIZE);
    expect(a.rivals.filter((team) => team.archetype !== null)).toHaveLength(5);
    expect(drawField(8).rivals).not.toEqual(a.rivals);
  });
});

describe("catálogo de ações", () => {
  it("classifica custos em só horas, só créditos ou os dois", () => {
    const byId = Object.fromEntries(ACTIONS.map((action) => [action.id, action.category]));
    expect(byId["raffle"]).toBe("hours");
    expect(byId["buy-motor"]).toBeUndefined(); // compras saíram do catálogo: navegador (shop.ts)
    expect(byId["build-wing"]).toBe("both");
  });
});
