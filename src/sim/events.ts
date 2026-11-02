// Modo evento (Fase 7, S1): comandos enter/advance/decide/close-event e a leitura eventView.
// Um evento tira o jogador da gestão: o relógio fica parado (tick e set-speed não andam) enquanto
// `activeEvent` existe. Cada tipo de evento é um EventHandler (eventSelection, eventFlightTest,
// eventCompetition); este arquivo só despacha e faz a mecânica comum de blocos e dias.

import { competitionHandler } from "./eventCompetition";
import { activeOf, blockTime, currentBlock, syncClock } from "./eventCore";
import { flightTestHandler } from "./eventFlightTest";
import { lectureHandler } from "./eventLecture";
import { selectionHandler } from "./eventSelection";
import { addMessage, warn } from "./tasks";
import type { ActiveEvent, EventBlock, EventBlockKind, EventDecision, EventKind, EventLogEntry, EventSummary, FlightPlayback, GameState } from "./types";

export interface EventHandler {
  /**
   * Resolve o bloco atual. `done` = o bloco terminou (o motor passa para o próximo); `false` =
   * parou no meio (decisão pendente ou seu voo, que pede replay) e o próximo `advance-event` continua.
   */
  run(state: GameState): { state: GameState; done: boolean };
  /** Aplica a escolha (já validada) e cobra o custo. `pendingDecision` já foi limpa. */
  decide(state: GameState, decision: EventDecision, optionId: string): GameState;
  /** Eventos de vários dias: monta o dia seguinte (day + 1, novos blocos, blockIndex 0). */
  nextDay?(state: GameState): GameState;
  summarize(state: GameState): EventSummary;
  /** Fechamento: aplica ao estado da gestão o que o evento guardou. */
  close(state: GameState): GameState;
}

const HANDLERS: Record<EventKind, EventHandler> = {
  "selection-day": selectionHandler,
  "selection-lecture": lectureHandler,
  "flight-test": flightTestHandler,
  competition: competitionHandler
};

const PAUSE_REASON = { "selection-day": "selection-day", "selection-lecture": "selection-lecture", "flight-test": "flight-test", competition: "competition" } as const;

/** Chamada de um evento novo: o relógio pausa e a tela mostra "Hoje: ...". */
export function openEvent(state: GameState, event: ActiveEvent, messageText: string): { state: GameState; pause: { reason: "selection-day" | "selection-lecture" | "flight-test" | "competition"; messageId: string } } {
  const added = addMessage(state, { from: "Equipe", title: `Hoje: ${event.title}`, body: messageText });
  return { state: { ...added.state, activeEvent: event }, pause: { reason: PAUSE_REASON[event.kind], messageId: added.id } };
}

export function enterEvent(state: GameState): GameState {
  const event = state.activeEvent;
  if (!event) return warn(state, "Não há evento para entrar.");
  if (event.entered) return state;
  const first = currentBlock(event);
  const entered: GameState = { ...state, activeEvent: { ...event, entered: true } };
  return first ? syncClock(entered, blockTime(event, first)) : entered;
}

export function advanceEvent(state: GameState): GameState {
  const event = state.activeEvent;
  if (!event) return warn(state, "Não há evento em andamento.");
  if (!event.entered) return warn(state, "Aceite a chamada do dia antes de seguir.");
  if (event.summary) return warn(state, "O dia acabou: feche o evento para voltar à equipe.");
  if (event.pendingDecision) return warn(state, "Há uma decisão esperando: escolha antes de seguir.");
  const handler = HANDLERS[event.kind];
  const ran = handler.run(state);
  if (!ran.done) return ran.state;

  let next = ran.state;
  const after = activeOf(next);
  if (after.blockIndex + 1 < after.blocks.length) {
    const block = after.blocks[after.blockIndex + 1]!;
    next = syncClock({ ...next, activeEvent: { ...after, blockIndex: after.blockIndex + 1 } }, blockTime(after, block));
  } else if (after.day < after.totalDays && handler.nextDay) {
    next = handler.nextDay(next);
    const moved = activeOf(next);
    const first = currentBlock(moved);
    if (first) next = syncClock(next, blockTime(moved, first));
  } else {
    next = { ...next, activeEvent: { ...after, summary: handler.summarize(next) } };
  }
  return next;
}

export function decideEvent(state: GameState, optionId: string): GameState {
  const event = state.activeEvent;
  const decision = event?.pendingDecision;
  if (!event || !decision) return warn(state, "Não há decisão pendente.");
  const chosen = decision.options.find((item) => item.id === optionId);
  if (!chosen) return warn(state, "Essa opção não existe nesta decisão.");
  if (chosen.blocked) return warn(state, chosen.blocked);
  // O caixa pode ter mudado desde que o cartão abriu.
  if (chosen.cost.credits > state.credits) return warn(state, `Caixa insuficiente: faltam ◆ ${chosen.cost.credits - state.credits}.`);
  const cleared: GameState = { ...state, activeEvent: { ...event, pendingDecision: null } };
  return HANDLERS[event.kind].decide(cleared, decision, optionId);
}

export function closeEvent(state: GameState): GameState {
  const event = state.activeEvent;
  if (!event) return warn(state, "Não há evento para fechar.");
  if (!event.summary) return warn(state, "O evento ainda não acabou.");
  const summary = event.summary;
  let next = HANDLERS[event.kind].close(state);
  next = addMessage(next, { from: "Equipe", title: summary.title, body: summary.lines.join(" ") }).state;
  return { ...next, activeEvent: null, pause: { reason: "manual", at: next.clock.hours, messageId: null } };
}

// ---------------------------------------------------------------------------
// Leitura para a UI e as cenas
// ---------------------------------------------------------------------------

export type EventStage = "call" | "running" | "summary";

export interface EventBlockView extends EventBlock {
  status: "done" | "current" | "upcoming";
}

export interface EventView {
  id: string;
  kind: EventKind;
  title: string;
  venueId?: string;
  stage: EventStage;
  /** Dia do evento (1…totalDays) e rótulo ("Dia 2 de 4"). */
  day: number;
  totalDays: number;
  dayLabel: string;
  /** Programação do dia atual com o estado de cada bloco. */
  blocks: EventBlockView[];
  blockIndex: number;
  currentBlock: EventBlock | null;
  /** Hora do dia (0–24) do evento agora: para o céu das cenas. */
  hourOfDay: number;
  decision: EventDecision | null;
  log: EventLogEntry[];
  summary: EventSummary | null;
  /** O botão "Seguir" vale agora (entrou, sem decisão e sem resumo). */
  canAdvance: boolean;
  /** Quem está no evento (ids dos integrantes). */
  presentIds: string[];
  /** Seu último voo no evento (competição e ensaio), para a FlightScene; null = nenhum. */
  lastPlayback: FlightPlayback | null;
  /** Rótulo curto do que o evento tem de mais urgente na tela. */
  headline: string;
}

const BLOCK_VERB: Record<EventBlockKind, string> = {
  arrival: "Chegada",
  briefing: "Briefing",
  exhibition: "Exposição",
  inspection: "Inspeção técnica",
  flights: "Janela de voo",
  awards: "Premiação",
  reception: "Recepção",
  presentation: "Apresentação",
  process: "Processo",
  questions: "Perguntas",
  closing: "Encerramento",
  challenge: "Desafio prático",
  interviews: "Entrevistas",
  deliberation: "Deliberação",
  travel: "Viagem",
  assembly: "Montagem",
  takeoff: "Decolagem",
  teardown: "Desmontagem"
};

export function eventView(state: GameState): EventView | null {
  const event = state.activeEvent;
  if (!event) return null;
  const stage: EventStage = event.summary ? "summary" : event.entered ? "running" : "call";
  const block = currentBlock(event);
  const blocks: EventBlockView[] = event.blocks.map((item, index) => ({
    ...item,
    status: event.summary || index < event.blockIndex ? "done" : index === event.blockIndex ? "current" : "upcoming"
  }));
  const context = event.context;
  const lastPlayback =
    context.kind === "competition" ? context.lastPlayback : context.kind === "flight-test" ? (context.takeoffs.at(-1)?.playback ?? null) : null;
  const crewIds =
    context.kind === "selection-day" || context.kind === "selection-lecture"
      ? state.members.filter((member) => member.role !== "trainee").map((member) => member.id)
      : context.kind === "flight-test"
        ? (() => {
            const test = state.flightTests.find((item) => item.id === context.testId);
            return test ? ("hired" in test.pilot ? test.crew : [test.pilot.memberId, ...test.crew]) : [];
          })()
        : state.members.map((member) => member.id);
  return {
    id: event.id,
    kind: event.kind,
    title: event.title,
    ...(event.venueId ? { venueId: event.venueId } : {}),
    stage,
    day: event.day,
    totalDays: event.totalDays,
    dayLabel: event.totalDays > 1 ? `Dia ${event.day} de ${event.totalDays}` : "Hoje",
    blocks,
    blockIndex: event.blockIndex,
    currentBlock: block,
    hourOfDay: block ? block.startsAt : 12,
    decision: event.pendingDecision,
    log: event.log,
    summary: event.summary,
    canAdvance: event.entered && !event.summary && !event.pendingDecision,
    presentIds: crewIds,
    lastPlayback,
    headline: event.summary ? event.summary.title : block ? `${BLOCK_VERB[block.kind]}: ${block.label}` : event.title
  };
}
