// O que a LectureScene lê da palestra de apresentação (Fase 9, C1): a lista de presentes e quem está no
// palco. Vem da leitura da Simulação (`applicantViews`): o perfil escondido nunca chega à cena.

import type { ApplicantStage, ApplicantView, MemberLook } from "../../sim";
import { palette } from "../palette";

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

/** Quem apareceu na palestra: a etapa já passou de `applied` e não é `absent`. */
export function attendedLecture(applicant: { stage: ApplicantStage }): boolean {
  return applicant.stage !== "applied" && applicant.stage !== "absent";
}

/** Camisetas dos inscritos: nada de laranja, que é a cor da equipe. */
const APPLICANT_SHIRTS = [palette.inkMuted, palette.accent, palette.ok, palette.ink, palette.warn, palette.inkDim, palette.danger];

/** Hash estável de texto (FNV-1a) para semear a camiseta sem `Math.random`. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Aparência do inscrito na plateia: a do perfil, com a camiseta trocada (a do perfil pode ser a da equipe). */
export function lookForApplicant(applicant: Pick<ApplicantView, "id" | "look">): MemberLook {
  return { ...applicant.look, shirt: APPLICANT_SHIRTS[hashString(applicant.id) % APPLICANT_SHIRTS.length]! };
}

/** Monta a leitura da cena a partir da planilha (depois que a Simulação resolveu a presença). */
export function lectureViewFromApplicants(id: string, applicants: readonly ApplicantView[], onStage: LecturePerson[], teamName: string): LectureView {
  return {
    id: `lecture:${id}`,
    teamName,
    registered: applicants.length,
    attendees: applicants.filter(attendedLecture).map((a) => ({ id: a.id, name: a.name, look: lookForApplicant(a) })),
    onStage
  };
}
