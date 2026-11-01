// Estados montados à mão para testar as cenas sem depender da simulação implementar tudo.

import { createGame, type GameState, type Order, type Part, type Task } from "../../src/sim";

export function baseState(): GameState {
  return createGame({ seed: 7, teamName: "Equipe Teste" });
}

export function task(overrides: Partial<Task> & Pick<Task, "id" | "actionId">): Task {
  return {
    label: overrides.actionId,
    hoursTotal: 10,
    hoursDone: 0,
    readyAt: null,
    expectedReadyAt: null,
    status: "active",
    assignees: [],
    contributions: {},
    targetId: null,
    doneAt: null,
    dedication: "normal",
    ...overrides
  };
}

export function part(overrides: Partial<Part> & Pick<Part, "id" | "type">): Part {
  return { label: overrides.type, quality: 60, condition: 90, ...overrides };
}

export function order(overrides: Partial<Order> & Pick<Order, "id" | "status">): Order {
  return {
    shopId: "hobbykong",
    lines: [{ productId: "motor-600", quantity: 1, unitPrice: 300 }],
    shipping: "standard",
    placedAt: 0,
    expectedAt: 240,
    arrivesAt: 260,
    customsDue: null,
    deliveredAt: null,
    ...overrides
  };
}
