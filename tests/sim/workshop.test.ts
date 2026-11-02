import { describe, expect, it } from "vitest";
import { applyCommand, estimateTaskDays, slotStatus, suggestSchedule, workshopNow, type GameState } from "../../src/sim";
import { startedGame } from "./helpers";

const at = (state: GameState, hours: number): GameState => ({ ...state, clock: { ...state.clock, hours } });
// 2026-01-05 é segunda; hours 0 do relógio fica antes da temporada: usamos só o dia da semana derivado.
const base = () => startedGame({ seed: 7, teamName: "Teste" });
/** Sem aulas, para isolar a escala. */
const game = (): GameState => {
  const state = base();
  return { ...state, members: state.members.map((member) => ({ ...member, classSlots: [] })) };
};

describe("workshop schedule", () => {
  it("starts with captains holding keys and an empty schedule", () => {
    const state = base();
    expect(state.version).toBe(11);
    expect(state.workshop.capacity).toBe(4);
    expect(state.workshop.keyHolders).toEqual(["founder-marina", "founder-caio"]);
    expect(state.workshop.schedule).toEqual({});
    expect(state.members.every((member) => member.classSlots.every((slot) => !slot.startsWith("0-") && !slot.startsWith("6-") && !slot.endsWith("overnight")))).toBe(true);
  });

  it("overnight is always available and respects capacity", () => {
    let state = game();
    expect(slotStatus(state, "founder-marina", "1-overnight")).toBe("free");
    expect("nightAccess" in state.workshop).toBe(false);
    state = applyCommand(state, { type: "set-shift", memberId: "founder-marina", slot: "1-overnight", on: true });
    expect(state.workshop.schedule["1-overnight"]).toEqual(["founder-marina"]);
    for (const id of ["founder-marina", "founder-caio"]) state = applyCommand(state, { type: "set-shift", memberId: id, slot: "6-overnight", on: true });
    expect(state.workshop.schedule["6-overnight"]).toEqual(["founder-marina", "founder-caio"]);
  });

  it("refuses the morning after an overnight, and the inverse", () => {
    let state = game();
    state = applyCommand(state, { type: "set-shift", memberId: "founder-marina", slot: "2-overnight", on: true });
    const morning = applyCommand(state, { type: "set-shift", memberId: "founder-marina", slot: "3-morning", on: true });
    expect(morning.workshop.schedule["3-morning"]).toBeUndefined();
    expect(morning.warning?.text).toContain("dormindo depois da madrugada");
    const free = { ...state, members: state.members.map((m) => ({ ...m, classSlots: [] })) };
    const withMorning = applyCommand(free, { type: "set-shift", memberId: "founder-caio", slot: "4-morning", on: true });
    const inverse = applyCommand(withMorning, { type: "set-shift", memberId: "founder-caio", slot: "3-overnight", on: true });
    expect(inverse.workshop.schedule["3-overnight"]).toBeUndefined();
  });

  it("grant-key adds a key holder", () => {
    const state = applyCommand(game(), { type: "grant-key", memberId: "president" });
    expect(state.workshop.keyHolders).toHaveLength(2);
  });

  it("empty schedule means workshop tasks do not progress", () => {
    const state = game();
    expect(estimateTaskDays({ ...state, credits: 9999 }, "build-gear", ["founder-marina"])).toBeNull();
    expect(workshopNow(state).open).toBe(false);
  });

  it("night-access-request no longer exists", () => {
    const state = applyCommand({ ...game(), clock: { hours: 0, speed: 0 } }, { type: "start-action", actionId: "night-access-request" });
    expect(state.tasks).toHaveLength(0);
    expect(state.warning).not.toBeNull();
  });

  it("suggested schedule avoids sleep conflicts", () => {
    let state = game();
    state = { ...state, credits: 9999, stock: { "carbon-fiber": 1 }, };
    state = applyCommand(state, { type: "start-action", actionId: "build-gear", memberIds: ["founder-marina"] });
    const { schedule } = suggestSchedule(state);
    const slots = Object.keys(schedule) as (keyof typeof schedule)[];
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      const [day, shift] = slot.split("-");
      if (shift !== "overnight") continue;
      const nextMorning = `${(Number(day) + 1) % 7}-morning` as keyof typeof schedule;
      expect(schedule[nextMorning] ?? []).not.toContain("founder-marina");
    }
  });
});

describe("tick", () => {
  it("never steps across a whole hour", () => {
    const state = at({ ...game(), clock: { hours: 0, speed: 1 } }, 7.5);
    const next = applyCommand(state, { type: "tick", realSeconds: 0.01 });
    expect(next.clock.hours).toBeLessThanOrEqual(8 + 1e-9);
  });
});
