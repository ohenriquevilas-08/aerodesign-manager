// Partida de teste: o Ano 1 já fundado e em quinta, 19/fev/2026: regulamento publicado (Prancheta
// aberta) e depois de férias e Carnaval (horas normais), o ponto de partida que os testes das
// Fases 2 a 5 assumem. Presidente: Bia. Capitães: Marina (Aerodinâmica) e Caio (Estruturas).
// Rafa continua integrante.

import { applyCommand, createGame, dateToHours, type EventDecision, type GameState } from "../../src/sim";

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


/** Escolhe a primeira opção liberada da decisão. */
export const firstOption = (decision: EventDecision): string => decision.options.find((option) => !option.blocked)!.id;

/**
 * Joga o evento aberto como o jogador faria: aceita a chamada, decide (por `pick`) e segue até
 * `stop` ser verdadeiro. Devolve o estado e quantos comandos usou. Sem `stop`, roda até o resumo.
 */
export function driveEvent(
  state: GameState,
  options: { pick?: (decision: EventDecision, state: GameState) => string; stop?: (state: GameState) => boolean; maxSteps?: number } = {}
): { state: GameState; steps: number } {
  const pick = options.pick ?? firstOption;
  const maxSteps = options.maxSteps ?? 4000;
  let next = state;
  let steps = 0;
  const done = (s: GameState) => (options.stop ? options.stop(s) : !!s.activeEvent?.summary);
  while (steps < maxSteps && next.activeEvent && !done(next)) {
    const event = next.activeEvent;
    let command: Parameters<typeof applyCommand>[1];
    if (!event.entered) command = { type: "enter-event" };
    else if (event.pendingDecision) command = { type: "decide-event", optionId: pick(event.pendingDecision, next) };
    else command = { type: "advance-event" };
    const after = applyCommand(next, command);
    if (after === next) throw new Error(`Comando sem efeito: ${JSON.stringify(command)}`);
    next = after;
    steps += 1;
  }
  return { state: next, steps };
}

/** Joga o evento inteiro e fecha. */
export function playEvent(state: GameState, pick?: (decision: EventDecision, state: GameState) => string): GameState {
  const played = driveEvent(state, { pick }).state;
  return played.activeEvent ? applyCommand(played, { type: "close-event" }) : played;
}
