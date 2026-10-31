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

  it("começa na segunda-feira em que o regulamento foi publicado", () => {
    expect(formatDate(SEASON_START)).toBe("seg, 9 fev 2026");
  });

  it("mostra contagem regressiva até o próximo prazo", () => {
    const [first] = upcomingDeadlines(0);
    expect(first?.id).toBe("rev01");
    expect(formatCountdown(0, Date.UTC(2026, 1, 10, 4))).toBe("1d 04h");
  });

  it("aplica o calendário acadêmico genérico", () => {
    expect(academicFactor(Date.UTC(2026, 6, 10)).factor).toBe(1.6);
    expect(academicFactor(Date.UTC(2026, 3, 15)).label).toBe("Provas");
    expect(academicFactor(Date.UTC(2026, 4, 5)).factor).toBe(1);
  });
});

describe("estado inicial do Ano 1", () => {
  it("começa com caixa zero e os três fundadores", () => {
    const game = createGame({ seed: 42, teamName: "Teste" });
    expect(game.credits).toBe(0);
    expect(game.members.map((member) => member.role)).toEqual(["president", "captain", "captain"]);
    expect(game.clock).toEqual({ hours: 0, speed: 0 });
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
    expect(byId["buy-motor"]).toBe("credits");
    expect(byId["build-wing"]).toBe("both");
  });
});
