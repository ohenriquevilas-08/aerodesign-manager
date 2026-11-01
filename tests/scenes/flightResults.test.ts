import { describe, expect, it } from "vitest";
import { MOCK_PLAYBACKS } from "../../src/scenes/flight/mockPlaybacks";
import { latestPlayerResult, nextAutoReplay, resultKey, rivalReplays } from "../../src/scenes/flight/results";
import { PLAYER_TEAM_ID } from "../../src/sim";
import { baseState, competition, result } from "./fixtures";

describe("replays a partir dos resultados", () => {
  it("fora da competição não há o que tocar", () => {
    const state = baseState();
    expect(latestPlayerResult(state)).toBeNull();
    expect(nextAutoReplay(state, null)).toBeNull();
    expect(rivalReplays(state)).toEqual([]);
  });

  it("pega o seu último voo com replay e ignora o das rivais", () => {
    const state = baseState();
    const rival = state.rivals[0]!.id;
    state.competition = competition(state, {
      results: [
        result({ teamId: PLAYER_TEAM_ID, battery: 1, at: 100, playback: MOCK_PLAYBACKS.valid }),
        result({ teamId: rival, battery: 1, at: 101, playback: MOCK_PLAYBACKS.crash }),
        result({ teamId: PLAYER_TEAM_ID, battery: 2, at: 130, playback: MOCK_PLAYBACKS["tape-break"] }),
        result({ teamId: state.rivals[1]!.id, battery: 2, at: 131 })
      ]
    });
    expect(latestPlayerResult(state)?.battery).toBe(2);
    expect(rivalReplays(state).map((r) => r.teamId)).toEqual([rival]);
  });

  it("toca o voo novo uma vez: com a mesma chave não repete", () => {
    const state = baseState();
    const first = result({ teamId: PLAYER_TEAM_ID, battery: 1, at: 100 });
    state.competition = competition(state, { results: [first] });
    const next = nextAutoReplay(state, null);
    expect(next?.playback).toBe(MOCK_PLAYBACKS.valid);
    expect(next?.key).toBe(resultKey(first));
    expect(nextAutoReplay(state, next!.key)).toBeNull();

    state.competition.results = [first, result({ teamId: PLAYER_TEAM_ID, battery: 2, at: 140, playback: MOCK_PLAYBACKS.damage })];
    expect(nextAutoReplay(state, next!.key)?.playback).toBe(MOCK_PLAYBACKS.damage);
  });

  it("voo seu sem replay não toca", () => {
    const state = baseState();
    state.competition = competition(state, { results: [result({ teamId: PLAYER_TEAM_ID, playback: null })] });
    expect(nextAutoReplay(state, null)).toBeNull();
  });
});
