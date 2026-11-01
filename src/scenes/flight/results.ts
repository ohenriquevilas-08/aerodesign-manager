// Ponte entre os resultados das baterias no store (competition.results) e o replay da FlightScene.
// Funções puras (testadas em tests/scenes/); o único estado é a chave do último voo tocado sozinho,
// guardada aqui fora da cena para trocar de tela não repetir o mesmo replay.

import { PLAYER_TEAM_ID, type BatteryResult, type FlightPlayback, type GameState } from "../../sim";
import { flightReplay } from "./replayChannel";

/** Identifica um voo: equipe, bateria e momento. */
export function resultKey(result: BatteryResult): string {
  return `${result.teamId}:${result.battery}:${result.at}`;
}

/** Seu último voo com replay, ou null. */
export function latestPlayerResult(state: GameState): BatteryResult | null {
  const results = state.competition?.results ?? [];
  for (let i = results.length - 1; i >= 0; i -= 1) {
    const result = results[i]!;
    if (result.teamId === PLAYER_TEAM_ID && result.playback) return result;
  }
  return null;
}

/** Voos das rivais de destaque que guardam replay (para tocar sob demanda), na ordem em que voaram. */
export function rivalReplays(state: GameState): (BatteryResult & { playback: FlightPlayback })[] {
  return (state.competition?.results ?? []).filter(
    (result): result is BatteryResult & { playback: FlightPlayback } => result.teamId !== PLAYER_TEAM_ID && result.playback !== null
  );
}

/** Seu último voo, se for diferente do último tocado sozinho (`seenKey`). */
export function nextAutoReplay(state: GameState, seenKey: string | null): { key: string; playback: FlightPlayback } | null {
  const result = latestPlayerResult(state);
  if (!result?.playback) return null;
  const key = resultKey(result);
  return key === seenKey ? null : { key, playback: result.playback };
}

let autoPlayedKey: string | null = null;

/** Toca o seu voo novo, uma vez só. Chamado pela FlightScene a cada mudança dos resultados. */
export function autoPlayLatest(state: GameState): boolean {
  const next = nextAutoReplay(state, autoPlayedKey);
  if (!next) return false;
  autoPlayedKey = next.key;
  flightReplay.play(next.playback);
  return true;
}

/** Toca o replay de qualquer bateria guardada (rival de destaque ou sua). Para a UI. */
export function playResult(result: BatteryResult): boolean {
  if (!result.playback) return false;
  flightReplay.play(result.playback);
  return true;
}
