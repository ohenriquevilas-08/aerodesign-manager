// Partida de teste: o Ano 1 já fundado e em quinta, 19/fev/2026: regulamento publicado (Prancheta
// aberta) e depois de férias e Carnaval (horas normais), o ponto de partida que os testes das
// Fases 2 a 5 assumem. Presidente: Bia. Capitães: Marina (Aerodinâmica) e Caio (Estruturas).
// Rafa continua integrante.

import { applyCommand, createGame, dateToHours, type GameState } from "../../src/sim";

export const TEST_START_HOURS = dateToHours(Date.UTC(2026, 1, 19));

export function startedGame(options: { seed: number; teamName: string }): GameState {
  const founded = applyCommand(createGame(options), {
    type: "found-team",
    presidentId: "founder-bia",
    captains: { aerodynamics: "founder-marina", structures: "founder-caio" }
  });
  return { ...founded, clock: { ...founded.clock, hours: TEST_START_HOURS }, pause: null };
}

/** Fundada no primeiro dia (10/nov/2025): processo seletivo e trainee ainda valem, Prancheta travada. */
export function foundedGame(options: { seed: number; teamName: string }): GameState {
  const founded = applyCommand(createGame(options), {
    type: "found-team",
    presidentId: "founder-bia",
    captains: { aerodynamics: "founder-marina", structures: "founder-caio" }
  });
  return { ...founded, pause: null };
}
