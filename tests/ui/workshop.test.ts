import { describe, expect, it } from "vitest";
import { canWork, currentShift, dateToHours, suggestSchedule, type GameState, type Task } from "../../src/sim";
import { startedGame } from "../sim/helpers";

const game = () => startedGame({ seed: 1, teamName: "Teste" });

/** Relógio numa data UTC (o jogo usa UTC para o calendário). */
function at(state: GameState, iso: string): GameState {
  return { ...state, clock: { ...state.clock, hours: dateToHours(Date.parse(iso)) } };
}

describe("turno atual", () => {
  it("mapeia os horários dos turnos", () => {
    const state = game();
    expect(currentShift(at(state, "2026-03-03T09:00:00Z"))).toEqual({ day: 2, shift: "morning" });
    expect(currentShift(at(state, "2026-03-03T15:00:00Z"))).toEqual({ day: 2, shift: "afternoon" });
    expect(currentShift(at(state, "2026-03-03T20:00:00Z"))).toEqual({ day: 2, shift: "evening" });
    expect(currentShift(at(state, "2026-03-03T12:30:00Z"))).toBeNull();
  });

  it("madrugada depois da meia-noite é do dia anterior", () => {
    expect(currentShift(at(game(), "2026-03-04T01:00:00Z"))).toEqual({ day: 2, shift: "overnight" });
  });
});

describe("escala do capitão", () => {
  it("sem tarefa de oficina não escala ninguém", () => {
    const result = suggestSchedule(game());
    expect(result.schedule).toEqual({});
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it("escala quem está numa tarefa de fabricação, com alguém de chave", () => {
    const state = game();
    const workers = state.members.filter(canWork).map((member) => member.id);
    const task: Task = {
      id: "task-x",
      actionId: "build-wing",
      label: "Fabricar asa",
      hoursTotal: 60,
      hoursDone: 0,
      readyAt: null,
      expectedReadyAt: null,
      status: "active",
      assignees: workers,
      contributions: {},
      targetId: null,
      startedAt: 0,
      doneAt: null,
      dedication: "normal"
    };
    const result = suggestSchedule({ ...state, tasks: [task] });
    const slots = Object.values(result.schedule);
    expect(slots.length).toBeGreaterThan(0);
    for (const ids of slots) expect(ids!.length).toBeLessThanOrEqual(4);
  });
});
