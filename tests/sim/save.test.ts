import { describe, expect, it } from "vitest";
import { clearSave, hasSave, loadSave, SAVE_KEY, startAutosave, writeSave } from "../../src/app/save";
import { createStore } from "../../src/app/store";
import { applyCommand, deserializeState, serializeState, type GameState } from "../../src/sim";
import { step } from "../../src/sim/loop";
import { startedGame } from "./helpers";

const devGame = (): GameState => applyCommand(startedGame({ seed: 5, teamName: "Salva" }), { type: "dev-start-competition" });

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key)
  };
}

describe("serializeState / deserializeState", () => {
  it("round trip keeps rng, clock, orders and competition", () => {
    let state = devGame();
    state = { ...state, credits: 5000 };
    state = applyCommand(state, { type: "place-order", shopId: "mercadosolto", lines: [{ productId: "scale", quantity: 1 }], shipping: "standard" });
    state = step({ ...state, clock: { ...state.clock, speed: 4 } }, 3);
    const back = deserializeState(serializeState(state));
    expect(back).toEqual(state);
    expect(back!.rngState).toBe(state.rngState);
    expect(back!.clock).toEqual(state.clock);
    expect(back!.orders.length).toBeGreaterThan(0);
    expect(back!.competition).not.toBeNull();
    expect(back!.competition!.queue).toEqual(state.competition!.queue);
  });

  it("a restored game continues exactly like the original", () => {
    const state = { ...devGame(), clock: { hours: 100, speed: 4 as const } };
    const back = deserializeState(serializeState(state))!;
    expect(step(back, 6)).toEqual(step(state, 6));
  });

  it("returns null for another version, broken JSON or a hollow object", () => {
    const state = startedGame({ seed: 1, teamName: "X" });
    expect(deserializeState(JSON.stringify({ ...state, version: 4 }))).toBeNull();
    expect(deserializeState("{ não é json")).toBeNull();
    expect(deserializeState("null")).toBeNull();
    expect(deserializeState(JSON.stringify({ version: 5 }))).toBeNull();
  });
});

describe("app/save (localStorage)", () => {
  it("writes, loads and clears a single slot", () => {
    const storage = fakeStorage();
    const state = startedGame({ seed: 2, teamName: "Slot" });
    expect(hasSave(storage)).toBe(false);
    expect(loadSave(storage)).toEqual({ state: null, discarded: false });
    expect(writeSave(state, storage)).toBe(true);
    expect(storage.data.has(SAVE_KEY)).toBe(true);
    expect(loadSave(storage).state).toEqual(state);
    clearSave(storage);
    expect(hasSave(storage)).toBe(false);
  });

  it("discards and warns about an old version", () => {
    const storage = fakeStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ ...startedGame({ seed: 1, teamName: "Velho" }), version: 4 }));
    expect(loadSave(storage)).toEqual({ state: null, discarded: true });
    expect(storage.data.has(SAVE_KEY)).toBe(false);
  });

  it("works without storage (private window)", () => {
    expect(writeSave(startedGame({ seed: 1, teamName: "X" }), null)).toBe(false);
    expect(loadSave(null)).toEqual({ state: null, discarded: false });
  });

  it("autosaves when the game day turns and when the clock pauses", () => {
    const storage = fakeStorage();
    const store = createStore({ ...startedGame({ seed: 3, teamName: "Auto" }), clock: { hours: 0, speed: 1 } });
    const stop = startAutosave(store, storage);
    store.dispatch({ type: "set-speed", speed: 4 });
    expect(storage.data.has(SAVE_KEY)).toBe(false);
    store.dispatch({ type: "tick", realSeconds: 5 });
    expect(loadSave(storage).state!.clock.hours).toBeGreaterThanOrEqual(24);
    clearSave(storage);
    store.dispatch({ type: "set-speed", speed: 0 });
    expect(hasSave(storage)).toBe(true);
    stop();
    clearSave(storage);
    store.dispatch({ type: "set-speed", speed: 1 });
    store.dispatch({ type: "set-speed", speed: 0 });
    expect(hasSave(storage)).toBe(false);
  });

  it("autosaves each step of an open event, so a reload resumes where the player was", () => {
    const storage = fakeStorage();
    const store = createStore(devGame());
    const stop = startAutosave(store, storage);
    store.dispatch({ type: "enter-event" });
    expect(loadSave(storage).state!.activeEvent!.entered).toBe(true);
    store.dispatch({ type: "advance-event" });
    const saved = loadSave(storage).state!.activeEvent!;
    expect(saved.log.length).toBe(store.getState().activeEvent!.log.length);
    stop();
  });
});
