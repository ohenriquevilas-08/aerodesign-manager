// O que as cenas leem do modo evento: `StageView`, montado por ./source.ts a partir de `eventView(state)`
// e do estado (equipe presente, grupos da dinâmica, luzes da inspeção). Os tipos de bloco e de evento
// são os da simulação (src/sim/types.ts).

import type { EventBlock, EventKind, MemberLook } from "../../sim";

export type { EventBlock, EventBlockKind, EventKind } from "../../sim";

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
  /**
   * Fase 9: o jogador acompanha vários grupos (a S3 limita quantos). Soma-se a `observedGroupId`; a
   * Simulação hoje entrega só um, então `source.ts` não preenche este campo até a S3 entrar.
   */
  observedGroupIds?: string[];
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

export interface StageView {
  id: string;
  kind: EventKind;
  /** 1-based. */
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
