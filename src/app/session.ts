// Início e fim de partida (Fase 4, U7): continuar do save, começar de novo.

import { createGame } from "../sim";
import { clearSave, loadSave, type LoadResult } from "./save";
import { foundDefault, store } from "./store";

/** Lido uma vez ao abrir a página: um save de versão antiga é apagado aqui e a tela avisa. */
export const initialSave: LoadResult = loadSave();

const TEAM_NAME = "Nova Equipe AeroDesign";

/** Carrega o save e deixa o relógio parado até o jogador soltar. */
export function continueGame(): boolean {
  if (!initialSave.state) return false;
  store.replace(initialSave.state);
  store.setSpeed(0);
  return true;
}

/** Apaga o save e começa o Ano 1 com outra semente. */
export function newGame() {
  clearSave();
  // PROVISÓRIO (Fase 6): fundação padrão até existir a abertura (U2).
  store.replace(foundDefault(createGame({ seed: (Date.now() % 2147483647) + 1, teamName: TEAM_NAME })));
  store.setSpeed(0);
}
