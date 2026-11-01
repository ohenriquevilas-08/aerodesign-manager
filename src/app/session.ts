// Início e fim de partida (Fase 4, U7): continuar do save, começar de novo. Fase 6 (U2): o jogo novo
// nasce na abertura (`founding`) e só vira equipe com o comando found-team.

import { createGame, type FoundTeamRequest, type GameState } from "../sim";
import { clearSave, loadSave, type LoadResult } from "./save";
import { store } from "./store";

/** Lido uma vez ao abrir a página: um save de versão antiga é apagado aqui e a tela avisa. */
export const initialSave: LoadResult = loadSave();

export const DEFAULT_TEAM_NAME = "Nova Equipe AeroDesign";

/** Carrega o save e deixa o relógio parado até o jogador soltar. */
export function continueGame(): boolean {
  if (!initialSave.state) return false;
  store.replace(initialSave.state);
  store.setSpeed(0);
  return true;
}

/** Apaga o save e abre um jogo novo, ainda sem equipe (estado `founding`). Devolve a semente. */
export function newGame(): number {
  clearSave();
  const seed = (Date.now() % 2147483647) + 1;
  store.replace(createGame({ seed, teamName: DEFAULT_TEAM_NAME }));
  store.setSpeed(0);
  return seed;
}

/**
 * Fim da abertura: refaz o jogo com a mesma semente (mesmos fundadores) e o nome do orientador
 * escolhido, e funda a equipe. Devolve o aviso de recusa, se houver.
 */
export function foundTeam(seed: number, advisorName: string, request: FoundTeamRequest): GameState {
  const name = advisorName.trim();
  store.replace(createGame({ seed, teamName: DEFAULT_TEAM_NAME, ...(name ? { advisorName: name } : {}) }));
  store.dispatch({ type: "found-team", ...request });
  store.setSpeed(0);
  return store.getState();
}
