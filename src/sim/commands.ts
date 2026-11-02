// Comandos: a única forma de UI e cenas pedirem mudanças no estado.
// applyCommand é puro (estado novo, sem mutar o anterior).

import { setDesign } from "./aircraft";
import { rescheduleAction, scheduleAction, unscheduleAction, type ScheduleActionRequest } from "./calendar";
import { setArea } from "./formation";
import { foundTeam, type FoundTeamRequest } from "./season";
import { devStartCompetition, setBatteryPayload } from "./competition";
import { ensureCompetitionEvent } from "./eventCompetition";
import { advanceEvent, closeEvent, decideEvent, enterEvent } from "./events";
import { cancelFlightTest, scheduleFlightTest, type ScheduleFlightTestRequest } from "./flightTests";
import { tick } from "./loop";
import { setPredictions, submitReport } from "./report";
import { payCustoms, placeOrder, type OrderRequest } from "./shop";
import { advanceApplicants, approveApplicants, scheduleInterviews, setInterviewQuestions, tagApplicant } from "./selection";
import type { SelectionFormat } from "./content/selection";
import { applySuggestedSchedule, grantKey, setShift } from "./workshop";
import { assignMember, closeTask, startAction, unassignMember, warn } from "./tasks";
import type { AircraftDesign, ApplicantTag, ClockSpeed, Discipline, GameState, PayloadLine, SlotKey, TaskDedication } from "./types";

export type Command =
  | { type: "tick"; realSeconds: number }
  | { type: "set-speed"; speed: ClockSpeed }
  | { type: "read-message"; id: string }
  /**
   * targetId: disciplina (document), formato da seletiva (selection-open), id de peça (repair-part)
   * ou id de tarefa esperando (express-shipping).
   */
  /**
   * dedication: "rush" | "normal" | "careful" (padrão "normal"); ver DEDICATIONS.
   * memberIds (Fase 8, S1): quem entra na tarefa; a ação com horas exige pelo menos `crew.min` pessoas livres.
   */
  | { type: "start-action"; actionId: string; targetId?: string; dedication?: TaskDedication; memberIds?: string[] }
  /** Põe mais uma pessoa numa tarefa que já anda (sem limite onde a ação tem `max: null`). */
  | { type: "assign-member"; memberId: string; taskId: string }
  /** Recusa se a tarefa ficar abaixo do mínimo; o caminho é close-task. */
  | { type: "unassign-member"; memberId: string }
  /** Fase 8, S1: encerra antes do fim, fica com o parcial (peça parcial, inscritos já chegados) e libera a equipe. */
  | { type: "close-task"; taskId: string }
  // Fase 9 (docs/phases/fase-9.md): seletiva imersiva.
  /** Etapa 1: divulgação e abertura (tarefa com gente). Uma campanha por vez; as inscrições abrem quando ela termina. */
  | { type: "open-selection"; format: SelectionFormat; memberIds: string[]; dedication?: TaskDedication }
  /** Triagem na planilha: chamar, talvez, não (null limpa). */
  | { type: "tag-applicant"; applicantId: string; tag: ApplicantTag | null }
  /** Depois da dinâmica: quem passa para a entrevista (teto BALANCE.selection.interviewCap). */
  | { type: "advance-applicants"; ids: string[] }
  /** Tarefa com gente (entrevistadores); as respostas aparecem aos poucos nas fichas. */
  | { type: "schedule-interviews"; applicantIds: string[]; memberIds: string[] }
  | { type: "set-interview-questions"; applicantId: string; questionIds: string[] }
  /** Cada aprovado vira trainee; a campanha some e os demais recebem o e-mail. */
  | { type: "approve-applicants"; ids: string[] }
  // Fase 3 (docs/phases/fase-3.md)
  | { type: "set-design"; design: AircraftDesign }
  | { type: "set-predictions"; emptyWeightKg?: number; payloadLine?: PayloadLine }
  | { type: "submit-report" }
  | ({ type: "place-order" } & OrderRequest)
  | { type: "pay-customs"; orderId: string }
  | { type: "set-battery-payload"; payloadKg: number }
  // Escala da oficina (design §5.5);
  | { type: "set-shift"; memberId: string; slot: SlotKey; on: boolean }
  | { type: "apply-suggested-schedule" }
  | { type: "grant-key"; memberId: string }
  // Fase 4 (docs/phases/fase-4.md)
  /** area null = sem área; captain true ocupa a vaga de capitão da área. */
  | { type: "set-area"; memberId: string; area: Discipline | null; captain?: boolean }
  /** Só em dev: pula para o dia da competição com tudo pronto. */
  | { type: "dev-start-competition" }
  // Fase 5 (docs/phases/fase-5.md, S2): ensaio de voo como evento.
  /** day = dia de jogo (Math.floor(horas / 24)); pilot = integrante ou contratado. */
  | ({ type: "schedule-flight-test" } & ScheduleFlightTestRequest)
  | { type: "cancel-flight-test"; testId: string }
  // Fase 6 (docs/phases/fase-6.md): orientador, fundação e calendário.
  /** Eleição de fundação, só no estado `founding`: presidente, capitães por área e nome da equipe. */
  | ({ type: "found-team" } & FoundTeamRequest)
  /** startAt em horas de jogo (dateToHours); a ação vira tarefa sozinha nessa hora. */
  | ({ type: "schedule-action" } & ScheduleActionRequest)
  | { type: "reschedule-action"; plannedId: string; startAt: number }
  | { type: "unschedule-action"; plannedId: string }
  // Fase 7 (docs/phases/fase-7.md, S1): modo evento.
  /** Aceita a chamada do evento ("Hoje: ..."). */
  | { type: "enter-event" }
  /** Resolve o bloco atual e vai para o próximo; recusa com decisão pendente. */
  | { type: "advance-event" }
  | { type: "decide-event"; optionId: string }
  /** Aplica o resumo ao estado da gestão e devolve o relógio. */
  | { type: "close-event" };

export function applyCommand(state: GameState, command: Command): GameState {
  switch (command.type) {
    case "tick":
      return tick(state, command.realSeconds);
    case "set-speed":
      if (state.activeEvent && command.speed !== 0) return warn(state, "Há um evento em andamento: termine o dia antes de soltar o relógio.");
      if (state.founding && command.speed !== 0) return warn(state, "A equipe ainda não foi fundada: escolha o presidente e os capitães.");
      if (state.clock.speed === command.speed) return state;
      return {
        ...state,
        clock: { ...state.clock, speed: command.speed },
        pause: command.speed === 0 ? { reason: "manual", at: state.clock.hours, messageId: null } : null
      };
    case "read-message":
      return {
        ...state,
        inbox: state.inbox.map((message) => (message.id === command.id ? { ...message, read: true } : message))
      };
    case "start-action":
      return startAction(state, command.actionId, command.targetId ?? null, command.dedication ?? "normal", command.memberIds ?? []);
    case "assign-member":
      return assignMember(state, command.memberId, command.taskId);
    case "unassign-member":
      return unassignMember(state, command.memberId);
    case "close-task":
      return closeTask(state, command.taskId);
    case "open-selection":
      return startAction(state, "selection-open", command.format, command.dedication ?? "normal", command.memberIds);
    case "tag-applicant":
      return tagApplicant(state, command.applicantId, command.tag);
    case "advance-applicants":
      return advanceApplicants(state, command.ids);
    case "schedule-interviews":
      return scheduleInterviews(state, command.applicantIds, command.memberIds);
    case "set-interview-questions":
      return setInterviewQuestions(state, command.applicantId, command.questionIds);
    case "approve-applicants":
      return approveApplicants(state, command.ids);
    case "set-design":
      return setDesign(state, command.design);
    case "set-predictions":
      return setPredictions(state, command);
    case "submit-report":
      return submitReport(state);
    case "place-order":
      return placeOrder(state, command);
    case "pay-customs":
      return payCustoms(state, command.orderId);
    case "set-battery-payload":
      return setBatteryPayload(state, command.payloadKg);
    case "set-shift":
      return setShift(state, command.memberId, command.slot, command.on);
    case "apply-suggested-schedule":
      return applySuggestedSchedule(state);
    case "set-area":
      return setArea(state, command.memberId, command.area, command.captain ?? false);
    case "grant-key":
      return grantKey(state, command.memberId);
    case "dev-start-competition":
      return ensureCompetitionEvent(devStartCompetition(state));
    case "schedule-flight-test":
      return scheduleFlightTest(state, command);
    case "cancel-flight-test":
      return cancelFlightTest(state, command.testId);
    case "found-team":
      return foundTeam(state, command);
    case "schedule-action":
      return scheduleAction(state, command);
    case "reschedule-action":
      return rescheduleAction(state, command.plannedId, command.startAt);
    case "unschedule-action":
      return unscheduleAction(state, command.plannedId);
    case "enter-event":
      return enterEvent(state);
    case "advance-event":
      return advanceEvent(state);
    case "decide-event":
      return decideEvent(state, command.optionId);
    case "close-event":
      return closeEvent(state);
  }
}
