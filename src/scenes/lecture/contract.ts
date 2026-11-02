// O que a LectureScene lê da palestra de apresentação (Fase 9, C1): a lista de presentes e quem está no
// palco. A simulação (S1/S2) ainda não entrega `SelectionCampaign`/`Applicant`; os tipos abaixo são
// STUBS locais com os nomes exatos do contrato da Fase 9. PONTO DE TROCA: quando a Simulação entrar,
// apague o bloco "stubs" e importe `Applicant`, `ApplicantStage`, `ApplicantTag` e `SelectionCampaign`
// de "../../sim"; `lectureViewFromCampaign` continua igual (o resto é só a UI usar o `applicantView`).

import { drawLook, type MemberLook } from "../../sim";
import { palette } from "../palette";

// ------------------------------------------------------------------ stubs (Fase 9, S1)

export type ApplicantStage = "applied" | "lecture" | "dynamic" | "interview" | "approved" | "rejected" | "absent";
export type ApplicantTag = "call" | "maybe" | "no" | null;

export interface Applicant {
  id: string;
  name: string;
  course: string;
  semester: number;
  motivationText: string;
  stage: ApplicantStage;
  tag: ApplicantTag;
  notes: string[];
  /** Camadas reveladas aos poucos; o formato final é da Simulação. */
  revealed: Record<string, unknown>;
}

export interface SelectionCampaign {
  id: string;
  format: string;
  stage: string;
  openedAt: number;
  closesAt: number;
  lectureAt: number;
  dynamicDayAt: number;
  applicants: Applicant[];
  vacancies: number | null;
}

// ------------------------------------------------------------------ o que a cena lê

export interface LecturePerson {
  id: string;
  name: string;
  look: MemberLook;
}

export interface LectureView {
  id: string;
  /** Nome da equipe, nos slides. */
  teamName: string;
  /** Total de inscritos (para o contador "55 de 92"); null = não mostrar. */
  registered: number | null;
  /** Quem veio: a plateia. */
  attendees: LecturePerson[];
  /** Quem está no palco (o fundador que apresenta e, se houver, os outros). */
  onStage: LecturePerson[];
}

/** Camisetas dos inscritos: nada de laranja, que é a cor da equipe. */
const APPLICANT_SHIRTS = [palette.inkMuted, palette.accent, palette.ok, palette.ink, palette.warn, palette.inkDim, palette.danger];

/** Hash estável de texto (FNV-1a) para semear a aparência sem `Math.random`. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Aparência do inscrito, derivada do id. Enquanto a simulação não entrega o `look` do perfil escondido,
 * a cena sorteia de forma estável (mesmo id, mesma pessoa em qualquer cena).
 */
export function lookForApplicant(id: string): MemberLook {
  const seed = hashString(id);
  const female = ((seed >>> 8) % 100) < 30;
  const { look } = drawLook(seed || 1, female);
  return { ...look, shirt: APPLICANT_SHIRTS[seed % APPLICANT_SHIRTS.length]! };
}

/** Quem apareceu na palestra: a etapa já passou de `applied` e não é `absent`. */
export function attendedLecture(applicant: Pick<Applicant, "stage">): boolean {
  return applicant.stage !== "applied" && applicant.stage !== "absent";
}

/** Monta a leitura da cena a partir da campanha (depois que a Simulação resolveu a presença). */
export function lectureViewFromCampaign(campaign: SelectionCampaign, onStage: LecturePerson[], teamName: string): LectureView {
  return {
    id: `lecture:${campaign.id}`,
    teamName,
    registered: campaign.applicants.length,
    attendees: campaign.applicants
      .filter(attendedLecture)
      .map((a) => ({ id: a.id, name: a.name, look: lookForApplicant(a.id) })),
    onStage
  };
}
