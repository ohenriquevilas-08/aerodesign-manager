// Núcleo do modo evento (Fase 7, S1): ferramentas que os três eventos compartilham.
// Os eventos em si vivem em eventSelection.ts, eventFlightTest.ts e eventCompetition.ts; o
// despacho dos comandos fica em events.ts. Aqui não há regra de nenhum evento específico.

import { recordLedger } from "./ledger";
import { nextRandom } from "./rng";
import { clamp } from "./team";
import type { ActiveEvent, Cost, EventBlock, EventDecision, EventLogEntry, EventOption, GameState } from "./types";

export const NO_COST: Cost = { hours: 0, credits: 0, leadDays: 0, risk: "none" };

/** Motivação perdida por hora de trabalho pesado numa decisão (conserto no pátio, esperar o vento). */
export const FATIGUE_PER_HOUR = 0.4;

export function activeOf(state: GameState): ActiveEvent {
  if (!state.activeEvent) throw new Error("Nenhum evento em andamento.");
  return state.activeEvent;
}

export function patchEvent(state: GameState, patch: Partial<ActiveEvent>): GameState {
  return { ...state, activeEvent: { ...activeOf(state), ...patch } };
}

/** Troca só os campos do `context` (o tipo do evento não muda). */
export function patchContext<C extends ActiveEvent["context"]>(state: GameState, patch: Partial<C>): GameState {
  const event = activeOf(state);
  return { ...state, activeEvent: { ...event, context: { ...event.context, ...patch } as ActiveEvent["context"] } };
}

/** Horas de jogo do começo de um bloco do dia atual. */
export function blockTime(event: ActiveEvent, block: EventBlock): number {
  return event.startsAtDay + (event.day - 1) * 24 + block.startsAt;
}

export const currentBlock = (event: ActiveEvent): EventBlock | null => event.blocks[event.blockIndex] ?? null;

export function logLine(state: GameState, text: string, tone: EventLogEntry["tone"] = "info", at?: number): GameState {
  const event = activeOf(state);
  const block = currentBlock(event);
  const entry: EventLogEntry = { at: at ?? state.clock.hours, blockId: block?.id ?? "end", text, tone };
  return { ...state, activeEvent: { ...event, log: [...event.log, entry] } };
}

export function askDecision(state: GameState, decision: EventDecision): GameState {
  return patchEvent(state, { pendingDecision: decision });
}

export const option = (id: string, label: string, hint: string, cost: Partial<Cost> = {}, blocked?: string): EventOption => ({
  id,
  label,
  hint,
  cost: { ...NO_COST, ...cost },
  ...(blocked ? { blocked } : {})
});

/** Paga o custo de uma opção: ◆ do caixa (o chamador já conferiu) e cansaço da equipe pelas horas. */
export function payCost(state: GameState, cost: Cost, label: string): GameState {
  const members = cost.hours > 0 ? state.members.map((member) => ({ ...member, motivation: clamp(member.motivation - cost.hours * FATIGUE_PER_HOUR) })) : state.members;
  const paid: GameState = { ...state, credits: state.credits - cost.credits, members };
  return cost.credits > 0 ? recordLedger(paid, { credits: -cost.credits, kind: "action", label }) : paid;
}

/** Motivo de bloqueio de uma opção por falta de caixa; undefined = livre. */
export const needsCredits = (state: GameState, credits: number): string | undefined =>
  state.credits < credits ? `Caixa insuficiente: faltam ◆ ${credits - state.credits}.` : undefined;

/** Move o relógio da gestão para a hora do evento (nunca para trás); a velocidade continua 0. */
export function syncClock(state: GameState, hours: number): GameState {
  return hours > state.clock.hours ? { ...state, clock: { ...state.clock, hours } } : state;
}

/** Sorteio a partir do rngState do estado; `commit` devolve o estado com o rngState avançado. */
export function drawer(state: GameState): { roll: () => number; commit: (next: GameState) => GameState } {
  let rng = state.rngState;
  return {
    roll: () => {
      const r = nextRandom(rng);
      rng = r.state;
      return r.value;
    },
    commit: (next) => ({ ...next, rngState: rng })
  };
}
