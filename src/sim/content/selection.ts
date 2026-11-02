// Seletiva imersiva (design §5.2; Fase 9): formatos, cursos e semestres dos inscritos.
// Valores provisórios, para balancear no protótipo (os de regra ficam em BALANCE.selection).

import type { CourseId, Discipline } from "../types";

export type SelectionFormat = "broad" | "technical" | "referral" | "challenge";

type Range = readonly [min: number, max: number];

export interface SelectionFormatDef {
  id: SelectionFormat;
  label: string;
  description: string;
  /** Inscritos esperados sem divulgação extra, numa janela de fator 1 (ver BALANCE.selection). */
  baseTotal: number;
  /** Fase 8: bônus pequeno de conhecimento na disciplina que o inscrito diz gostar (a base é parecida para todos). */
  focusKnowledge: Range;
  fabrication: Range;
  motivation: Range;
  /** Fase 9: chance da frase do formulário vir de indicação ("meu primo era da equipe"). */
  referralPhrase: number;
}

export const SELECTION_FORMATS: readonly SelectionFormatDef[] = [
  {
    id: "broad",
    label: "Ampla",
    description: "Divulgação no campus inteiro: muita gente, pouca experiência.",
    baseTotal: 55,
    focusKnowledge: [0, 2],
    fabrication: [10, 22],
    motivation: [50, 80],
    referralPhrase: 0.05
  },
  {
    id: "technical",
    label: "Técnica",
    description: "Prova de conceitos: poucos inscritos, mais preparados.",
    baseTotal: 35,
    focusKnowledge: [3, 6],
    fabrication: [10, 20],
    motivation: [55, 80],
    referralPhrase: 0.05
  },
  {
    id: "referral",
    label: "Por indicação",
    description: "Colegas indicados pelos fundadores: poucos, muito motivados.",
    baseTotal: 20,
    focusKnowledge: [1, 4],
    fabrication: [10, 22],
    motivation: [75, 95],
    referralPhrase: 0.5
  },
  {
    id: "challenge",
    label: "Desafio prático",
    description: "Montar uma peça na oficina: revela quem tem mão boa.",
    baseTotal: 40,
    focusKnowledge: [0, 2],
    fabrication: [18, 30],
    motivation: [60, 85],
    referralPhrase: 0.05
  }
];

export const CANDIDATE_HOURS_PER_DAY: Range = [2, 4];
export const CANDIDATE_AGILITY: Range = [20, 70];
export const CANDIDATE_COMMUNICATION: Range = [10, 60];
export const CANDIDATE_GRADUATIONS = ["2027.2", "2028.1", "2028.2", "2029.1", "2029.2", "2030.1"] as const;

/**
 * Curso do inscrito. `share` é a proporção entre os inscritos; `femaleShare`, a de mulheres no curso
 * (aeronáutica ~0,2). O curso puxa levemente o conhecimento de partida (`knowledge`, pontos a mais
 * por disciplina) e a fabricação.
 */
export interface CourseDef {
  id: CourseId;
  label: string;
  share: number;
  femaleShare: number;
  knowledge: Partial<Record<Discipline, number>>;
  fabrication: number;
}

export const COURSES: readonly CourseDef[] = [
  { id: "aeronautical", label: "Eng. Aeronáutica", share: 0.5, femaleShare: 0.2, knowledge: { aerodynamics: 2, conceptual: 2, performance: 1 }, fabrication: 1 },
  { id: "mechanical", label: "Eng. Mecânica", share: 0.22, femaleShare: 0.15, knowledge: { structures: 2, loads: 2 }, fabrication: 3 },
  { id: "electrical", label: "Eng. Elétrica", share: 0.12, femaleShare: 0.12, knowledge: { electrical: 3 }, fabrication: 0 },
  { id: "computing", label: "Eng. de Computação", share: 0.09, femaleShare: 0.18, knowledge: { stability: 2, electrical: 1 }, fabrication: -1 },
  { id: "production", label: "Eng. de Produção", share: 0.07, femaleShare: 0.35, knowledge: { conceptual: 1 }, fabrication: 1 }
];

export const findCourse = (id: CourseId): CourseDef => COURSES.find((course) => course.id === id)!;

/** Pesos do período (1 a 10): em março entram os calouros; em novembro a turma é mais espalhada. */
export const SEMESTER_WEIGHTS = {
  regular: [8, 12, 14, 14, 13, 12, 10, 8, 5, 4],
  freshers: [40, 26, 10, 7, 5, 4, 3, 2, 2, 1]
} as const;
