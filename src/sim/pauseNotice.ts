// Leitura pura da pausa automática (aviso central da UI). Nenhuma regra muda: só junta o motivo da
// pausa (PauseInfo e seus `also`) com a mensagem da caixa de entrada e diz para onde "Ver resultado" leva.

import { findAction } from "./content/actions";
import type { GameState, PauseReason } from "./types";

/** Tela (ou overlay) que mostra o resultado do aviso. */
export type NoticeTarget = "central" | "actions" | "calendar" | "team" | "tests" | "report" | "browser" | "competition" | "lecture";

export interface PauseNotice {
  reason: PauseReason;
  messageId: string;
  /** O que aconteceu, em uma frase. */
  title: string;
  /** Resultado resumido (ex.: "Alcance da divulgação +4"). */
  result: string;
  target: NoticeTarget;
  /** "Seguir o tempo" faz sentido? Falso quando um evento está aberto. */
  canResume: boolean;
}

/** Motivos sem aviso central: início, pausa manual e eventos (esses têm o próprio "Entrar"). */
const NO_NOTICE: ReadonlySet<PauseReason> = new Set<PauseReason>(["start", "manual", "selection-day", "flight-test", "competition"]);

const TARGET_BY_REASON: Partial<Record<PauseReason, NoticeTarget>> = {
  "deadline-soon": "calendar",
  "deadline-passed": "calendar",
  scheduled: "calendar",
  order: "browser",
  flight: "competition",
  selection: "lecture"
};

/** Para onde levar o resultado de uma tarefa concluída, pela ação dela. */
function targetOfTask(actionId: string): NoticeTarget {
  const action = findAction(actionId);
  switch (action?.effect?.kind) {
    case "outreach":
    case "referral-ask":
      return "actions";
    case "selection-open":
    case "selection-interviews":
    case "train":
      return "team";
    case "test":
      return "tests";
    case "report-chapter":
    case "drawings":
    case "oral-practice":
      return "report";
    default:
      return "central";
  }
}

/**
 * Avisos da pausa automática atual, na ordem em que aconteceram. Vazio se o relógio não está pausado por
 * um motivo que mereça aviso (ou se há um evento aberto, que tem a sua própria moldura).
 */
export function pauseNotices(state: Pick<GameState, "pause" | "inbox" | "tasks" | "activeEvent">): PauseNotice[] {
  const pause = state.pause;
  if (!pause || state.activeEvent) return [];
  const entries = [{ reason: pause.reason, messageId: pause.messageId }, ...(pause.also ?? [])];
  const notices: PauseNotice[] = [];
  for (const entry of entries) {
    if (NO_NOTICE.has(entry.reason) || entry.messageId === null) continue;
    const message = state.inbox.find((item) => item.id === entry.messageId);
    if (!message) continue;
    let target = TARGET_BY_REASON[entry.reason] ?? "central";
    if (entry.reason === "task-done") {
      const task = state.tasks.find((item) => item.status === "done" && `Concluído: ${item.label}` === message.title);
      if (task) target = targetOfTask(task.actionId);
    }
    notices.push({ reason: entry.reason, messageId: entry.messageId, title: message.title, result: message.body, target, canResume: true });
  }
  return notices;
}
