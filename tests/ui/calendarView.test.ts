import { describe, expect, it } from "vitest";
import { createGame, dateToHours, applyCommand, SEASON_START } from "../../src/sim";
import { academicTone, dropStartAt, schedulableActions, upcomingDays } from "../../src/ui/calendarView";

const fresh = () => createGame({ seed: 7, teamName: "Teste" });

describe("calendarView", () => {
  it("upcomingDays devolve 14 dias seguidos a partir de hoje, atravessando o mês", () => {
    const days = upcomingDays(fresh(), 14);
    expect(days).toHaveLength(14);
    expect(days[0]!.today).toBe(true);
    expect(days[0]!.date).toBe(SEASON_START);
    expect(days[13]!.date).toBe(SEASON_START + 13 * 86_400_000);
    expect(days.map((day) => day.day).slice(0, 3)).toEqual([10, 11, 12]);
  });

  it("dropStartAt mantém a hora do dia ao mover para outro dia", () => {
    const original = dateToHours(SEASON_START) + 9;
    const target = SEASON_START + 5 * 86_400_000;
    expect(dropStartAt(target, original)).toBe(dateToHours(target) + 9);
  });

  it("uma ação agendada aparece no dia certo de upcomingDays", () => {
    const state = applyCommand(fresh(), { type: "schedule-action", actionId: "raffle", startAt: dateToHours(SEASON_START) + 24 * 3 + 8 });
    const days = upcomingDays(state, 14);
    expect(days[3]!.planned).toHaveLength(1);
  });

  it("schedulableActions deixa de fora ações que dependem de peça ou tarefa em espera", () => {
    expect(schedulableActions().every((action) => action.target !== "part" && action.target !== "waiting-task")).toBe(true);
  });

  it("academicTone separa período fraco e forte", () => {
    expect([academicTone(0.4), academicTone(1), academicTone(1.6)]).toEqual(["low", "normal", "high"]);
  });
});
