// Contrato do modo evento (Fase 7, docs/phases/fase-7.md) como as cenas o leem.
// STUB LOCAL até a frente de Simulação (S1) entrar: os nomes e campos de ActiveEvent, EventBlock e
// EventDecision seguem o documento da fase; `EventView` é o que as cenas precisam de `eventView(state)`
// (a leitura real da sim). Ponto de troca: src/scenes/event/source.ts (ver architecture.md, Cenas).
// `EventBlockKind` é nosso: o documento só diz que o bloco tem `kind`; a sim deve usar estes valores
// (ou avisar para ajustarmos `focusForBlock`).

import type { MemberLook } from "../../sim";

export type EventKind = "selection-day" | "flight-test" | "competition";

export type EventBlockKind =
  | "arrival" // chegada, vinheta
  | "briefing" // briefing / recepção
  | "presentation" // apresentação da equipe
  | "challenge" // desafio prático em grupos (seletiva)
  | "launch" // lançamento dos planadores (seletiva)
  | "interview" // entrevistas rápidas
  | "deliberation" // deliberação
  | "setup" // montagem e checagem
  | "inspection" // inspeção técnica (competição)
  | "exhibit" // exposição (competição, dia 1)
  | "queue" // fila para a cabeceira
  | "flight" // decolagem
  | "repair" // reparo entre baterias
  | "teardown" // desmontagem
  | "ceremony"; // placar e premiação

export interface EventBlock {
  id: string;
  /** Hora do dia em que o bloco começa (0–24). */
  startsAt: number;
  label: string;
  kind: EventBlockKind;
}

export interface EventPerson {
  id: string;
  name: string;
  look: MemberLook;
}

/** Grupo de candidatos da dinâmica; `gliderDistanceM` vem pronto da simulação (null até o desafio acabar). */
export interface SelectionGroupView {
  id: string;
  label: string;
  members: EventPerson[];
  gliderDistanceM: number | null;
}

export interface SelectionView {
  groups: SelectionGroupView[];
  /** Grupo de que o jogador chegou perto (decisão da dinâmica); null = nenhum. */
  observedGroupId: string | null;
}

export type InspectionStatus = "ok" | "pending" | "fail";

export interface InspectionItemView {
  id: string;
  label: string;
  status: InspectionStatus;
}

export interface InspectionView {
  items: InspectionItemView[];
}

export interface EventView {
  id: string;
  kind: EventKind;
  /** 1-based; a competição tem 3 dias. */
  day: number;
  dayCount: number;
  blocks: EventBlock[];
  blockIndex: number;
  /** Local do ensaio de voo (`sceneryForVenue`); ignorado nos outros eventos. */
  venueId?: string;
  /** A equipe presente (jogador). */
  crew: EventPerson[];
  selection: SelectionView | null;
  inspection: InspectionView | null;
}
