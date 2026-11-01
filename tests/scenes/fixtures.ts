// Estados montados à mão para testar as cenas sem depender da simulação implementar tudo.

import { MOCK_PLAYBACKS } from "../../src/scenes/flight/mockPlaybacks";
import {
  createGame,
  PLAYER_TEAM_ID,
  type BatteryResult,
  type CompetitionState,
  type GameState,
  type Order,
  type Part,
  type Task
} from "../../src/sim";

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

/** Competição em voo: fila com as rivais e você no meio, manhã fria e vento de proa fraco. */
export function competition(state: GameState, overrides: Partial<CompetitionState> = {}): CompetitionState {
  const ids = state.rivals.map((rival) => rival.id);
  return {
    phase: "flights",
    battery: 1,
    queue: [...ids.slice(0, 6), PLAYER_TEAM_ID, ...ids.slice(6)],
    queueIndex: 2,
    plannedPayloadKg: null,
    weather: { temperatureK: 291, pressureHpa: 930, headwindMs: 2.5 },
    results: [],
    projectScores: {},
    penalties: {},
    inspectionIssues: [],
    ...overrides
  };
}

export function result(overrides: Partial<BatteryResult> & Pick<BatteryResult, "teamId">): BatteryResult {
  return {
    battery: 1,
    payloadKg: 6,
    densityAltitudeM: 600,
    outcome: "valid",
    points: null,
    playback: overrides.teamId === PLAYER_TEAM_ID ? MOCK_PLAYBACKS.valid : null,
    at: 100,
    ...overrides
  };
}
