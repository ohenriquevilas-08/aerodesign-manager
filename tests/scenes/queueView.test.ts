import { describe, expect, it } from "vitest";
import { hourOfDay, queueViewFromState, sunElevation, sunProgress, windsock } from "../../src/scenes/queue/queueView";
import { PLAYER_TEAM_ID } from "../../src/sim";
import { baseState, competition } from "./fixtures";

describe("fila da competição", () => {
  it("sem competição não há fila", () => {
    expect(queueViewFromState(baseState(), 8)).toBeNull();
  });

  it("começa na próxima a voar, destaca você e conta quem está à frente", () => {
    const state = baseState();
    // Fixture: 6 rivais, você, o resto; queueIndex 2.
    state.competition = competition(state);
    const view = queueViewFromState(state, 8)!;
    expect(view.flown).toBe(2);
    expect(view.line).toHaveLength(8);
    expect(view.line[0]).toMatchObject({ teamId: state.rivals[2]!.id, label: state.rivals[2]!.acronym, status: "next" });
    expect(view.line[1]!.status).toBe("waiting");
    expect(view.playerAhead).toBe(4);
    expect(view.playerSlot).toBe(4);
    expect(view.line[4]).toMatchObject({ teamId: PLAYER_TEAM_ID, label: "VOCÊ", name: "Equipe Teste", isPlayer: true });
    expect(view.hidden).toBe(state.competition.queue.length - 2 - 8);
  });

  it("você fora da janela: posição sem slot; depois de voar, sem posição", () => {
    const state = baseState();
    state.competition = competition(state);
    expect(queueViewFromState(state, 3)).toMatchObject({ playerAhead: 4, playerSlot: null });
    state.competition.queueIndex = 7;
    expect(queueViewFromState(state, 3)).toMatchObject({ playerAhead: null, playerSlot: null, flown: 7 });
  });

  it("fila acabada: nada esperando", () => {
    const state = baseState();
    state.competition = competition(state);
    state.competition.queueIndex = state.competition.queue.length;
    const view = queueViewFromState(state, 5)!;
    expect(view.line).toEqual([]);
    expect(view.hidden).toBe(0);
    expect(view.flown).toBe(state.competition.queue.length);
  });
});

describe("sol e vento", () => {
  it("hora do dia segue o relógio do jogo", () => {
    const h = hourOfDay(0);
    expect(hourOfDay(7.5)).toBeCloseTo((h + 7.5) % 24, 5);
    expect(hourOfDay(24)).toBeCloseTo(h, 5);
  });

  it("sol nasce às 6 h, está no alto ao meio-dia e se põe às 18 h", () => {
    expect(sunElevation(6)).toBeCloseTo(0, 5);
    expect(sunElevation(12)).toBeCloseTo(1, 5);
    expect(sunElevation(18)).toBeCloseTo(0, 5);
    expect(sunElevation(9)).toBeLessThan(sunElevation(11));
    expect(sunElevation(3)).toBeLessThan(0);
    expect(sunProgress(12)).toBeCloseTo(0.5, 5);
    expect(sunProgress(4)).toBe(0);
  });

  it("biruta aponta para onde o vento vai e enche com a força", () => {
    expect(windsock(3)).toEqual({ direction: -1, strength: 0.5 });
    expect(windsock(-9)).toEqual({ direction: 1, strength: 1 });
    expect(windsock(0).strength).toBe(0);
  });
});
