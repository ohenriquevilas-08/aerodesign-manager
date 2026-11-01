import { describe, expect, it } from "vitest";
import { completeTask } from "../../src/sim/tasks";
import { weatherAt } from "../../src/sim/competition";
import { maxPayloadKg, playerFlightModel, requiredParts } from "../../src/sim/aircraft";
import {
  applyCommand,
  dateToHours,
  DEFAULT_DESIGN,
  densityAltitude,
  financeSummary,
  PART_TYPE_LABELS,
  testHistory,
  type GameState
} from "../../src/sim";
import { startedGame } from "./helpers";

const game = (): GameState => startedGame({ seed: 12, teamName: "Caixa" });

/** Inicia a ação, finge que as horas acabaram e conclui. */
function finish(state: GameState, actionId: string, targetId?: string): GameState {
  const started = applyCommand(state, { type: "start-action", actionId, targetId });
  const task = started.tasks.at(-1)!;
  const worked = {
    ...started,
    members: started.members.map((m) => (m.id === "founder-marina" ? { ...m, taskId: task.id } : m)),
    tasks: started.tasks.map((t) => (t.id === task.id ? { ...t, status: "active" as const, hoursDone: t.hoursTotal, contributions: { "founder-marina": Math.max(1, t.hoursTotal) } } : t))
  };
  return completeTask(worked, task.id).state;
}

describe("ledger", () => {
  it("starts empty and sums to the cash change", () => {
    const start = { ...game(), credits: 5000, stock: { "carbon-fiber": 1 } };
    let state = applyCommand(start, {
      type: "place-order",
      shopId: "mercadosolto",
      lines: [{ productId: "scale", quantity: 1 }],
      shipping: "standard"
    });
    state = finish(state, "build-gear");
    state = finish(state, "raffle");
    expect(state.ledger.map((e) => e.kind)).toEqual(expect.arrayContaining(["order", "action", "raffle"]));
    expect(state.ledger.reduce((sum, e) => sum + e.credits, 0)).toBe(state.credits - start.credits);
    expect(state.ledger.every((e) => e.credits !== 0)).toBe(true);
  });

  it("records customs, sponsor money and refuses nothing when the order is refused", () => {
    const poor = game();
    const refused = applyCommand(poor, { type: "place-order", shopId: "mercadosolto", lines: [{ productId: "scale", quantity: 1 }], shipping: "standard" });
    expect(refused.ledger).toEqual([]);
    let state: GameState = { ...poor, credits: 3000 };
    state = applyCommand(state, { type: "place-order", shopId: "hobbykong", lines: [{ productId: "motor-600", quantity: 1 }], shipping: "standard" });
    const order = state.orders[0]!;
    state = { ...state, orders: [{ ...order, status: "held-customs", customsDue: 90 }] };
    const before = state.credits;
    state = applyCommand(state, { type: "pay-customs", orderId: order.id });
    expect(state.credits).toBe(before - 90);
    expect(state.ledger.at(-1)).toMatchObject({ kind: "customs", credits: -90 });
  });
});

/** Horas de jogo de 9/fev/2026 (a temporada começa em 10/nov/2025). */
const FEB9 = dateToHours(Date.UTC(2026, 1, 9));

describe("financeSummary", () => {
  it("splits income and expense by kind and by month", () => {
    const base = game();
    const state: GameState = {
      ...base,
      credits: 1000,
      ledger: [
        { at: FEB9 + 24 * 5, credits: 500, kind: "raffle", label: "Rifa" },
        { at: FEB9 + 24 * 6, credits: -200, kind: "order", label: "Pedido" },
        { at: FEB9 + 24 * 40, credits: -50, kind: "customs", label: "Imposto" },
        { at: FEB9 + 24 * 41, credits: 300, kind: "sponsor", label: "Patrocínio" }
      ]
    };
    const summary = financeSummary(state);
    expect(summary.cash).toBe(1000);
    expect(summary.income).toBe(800);
    expect(summary.expense).toBe(250);
    expect(summary.byKind.raffle).toEqual({ income: 500, expense: 0 });
    expect(summary.byKind.order).toEqual({ income: 0, expense: 200 });
    // Dia 5 e 6 a partir de 9/fev caem em fevereiro; dias 40 e 41, em março.
    expect(summary.byMonth).toEqual([
      { month: "2026-02", income: 500, expense: 200, net: 300 },
      { month: "2026-03", income: 300, expense: 50, net: 250 }
    ]);
  });

  it("is empty for a new game", () => {
    expect(financeSummary(game())).toEqual({ cash: 0, income: 0, expense: 0, byKind: {}, byMonth: [] });
  });
});

describe("testHistory", () => {
  function hangar(): GameState {
    let state = applyCommand({ ...game(), credits: 9999 }, { type: "set-design", design: DEFAULT_DESIGN });
    const parts = requiredParts(state.aircraft!.design).map((type, index) => ({
      id: `p-${index}`,
      type,
      label: PART_TYPE_LABELS[type],
      quality: 75,
      condition: 100
    }));
    state = { ...state, parts, clock: { hours: 24 * 30 + 14, speed: 0 } };
    return state;
  }

  it("starts empty", () => {
    expect(testHistory(game())).toEqual({ entries: [], points: [] });
  });

  it("records the day, Hρ, result and affected parts of each test", () => {
    let state = finish(hangar(), "test-thrust");
    const history = testHistory(state);
    expect(history.entries).toHaveLength(1);
    const entry = history.entries[0]!;
    expect(entry.test).toBe("thrust");
    expect(entry.label).toBe("Ensaio de motor e hélice");
    expect(entry.at).toBe(24 * 30 + 14);
    const weather = weatherAt(state.seed, entry.at);
    expect(entry.densityAltitudeM).toBeCloseTo(densityAltitude(weather.temperatureK, weather.pressureHpa), 6);
    expect(entry.ok).toBe(true);
    expect(entry.affectedParts).toEqual([PART_TYPE_LABELS.powertrain]);
    expect(entry.summary.length).toBeGreaterThan(0);
    expect(history.points).toEqual([]);
    state = finish(state, "test-structural");
    expect(testHistory(state).entries.map((e) => e.test)).toEqual(["structural", "thrust"]);
  });

  it("flags a test with an incident and lists the damaged part", () => {
    let found = false;
    for (let seed = 1; seed < 80 && !found; seed += 1) {
      const state = finish({ ...hangar(), seed, rngState: seed * 7919 }, "test-structural");
      const entry = testHistory(state).entries[0];
      if (entry && !entry.ok) {
        found = true;
        expect(entry.affectedParts).toContain(PART_TYPE_LABELS.wing);
      }
    }
    expect(found).toBe(true);
  });
});
