// O que a cena da fila mostra (design §9.4): quem já voou, quem está na cabeceira, quem espera,
// a sua equipe destacada, o sol pela hora do relógio e a biruta pelo vento. Funções puras
// (testadas em tests/scenes/); a QueueScene só desenha.

import { clockToDate, PLAYER_TEAM_ID, type CompetitionPhase, type GameState } from "../../sim";

export type QueueSlotStatus = "next" | "waiting";

export interface QueueTeamView {
  teamId: string;
  /** Sigla da rival; "VOCÊ" para a sua equipe. */
  label: string;
  name: string;
  isPlayer: boolean;
  status: QueueSlotStatus;
}

export interface QueueView {
  phase: CompetitionPhase;
  battery: number;
  /** Equipes que já voaram nesta bateria. */
  flown: number;
  /** Da cabeceira (próxima a voar) para trás, até o limite pedido. */
  line: QueueTeamView[];
  /** Equipes na fila além das mostradas. */
  hidden: number;
  /** Equipes à sua frente; null se você não está na fila ou já voou nesta bateria. */
  playerAhead: number | null;
  /** Sua posição em `line`, ou null se você está fora da janela mostrada. */
  playerSlot: number | null;
}

export function queueViewFromState(state: GameState, maxShown: number): QueueView | null {
  const competition = state.competition;
  if (!competition) return null;
  const { queue, queueIndex } = competition;
  const rivals = new Map(state.rivals.map((rival) => [rival.id, rival]));
  const waiting = queue.slice(queueIndex);
  const line = waiting.slice(0, Math.max(0, maxShown)).map((teamId, i): QueueTeamView => {
    const isPlayer = teamId === PLAYER_TEAM_ID;
    const rival = rivals.get(teamId);
    return {
      teamId,
      label: isPlayer ? "VOCÊ" : (rival?.acronym ?? teamId),
      name: isPlayer ? state.teamName : (rival?.name ?? teamId),
      isPlayer,
      status: i === 0 ? "next" : "waiting"
    };
  });
  const ahead = waiting.indexOf(PLAYER_TEAM_ID);
  return {
    phase: competition.phase,
    battery: competition.battery,
    flown: Math.min(queueIndex, queue.length),
    line,
    hidden: waiting.length - line.length,
    playerAhead: ahead >= 0 ? ahead : null,
    playerSlot: ahead >= 0 && ahead < line.length ? ahead : null
  };
}

/** Hora do dia (0–24, fração) no relógio do jogo. */
export function hourOfDay(hours: number): number {
  const date = new Date(clockToDate(hours));
  return date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
}

/** Altura do sol: 0 no nascer (6 h) e no pôr (18 h), 1 ao meio-dia, negativa à noite. */
export function sunElevation(hour: number): number {
  return Math.sin(((hour - 6) / 12) * Math.PI);
}

/** Posição do sol no arco do céu: 0 = horizonte leste (6 h), 1 = horizonte oeste (18 h). */
export function sunProgress(hour: number): number {
  return Math.min(1, Math.max(0, (hour - 6) / 12));
}

/**
 * Biruta: vento de proa (+) sopra contra a corrida, que vai para a direita; a biruta aponta para
 * onde o vento vai. `strength` 0–1 (cheia a partir de 6 m/s; com calmaria, murcha).
 */
export function windsock(headwindMs: number): { direction: -1 | 1; strength: number } {
  return {
    direction: headwindMs >= 0 ? -1 : 1,
    strength: Math.min(1, Math.abs(headwindMs) / 6)
  };
}
