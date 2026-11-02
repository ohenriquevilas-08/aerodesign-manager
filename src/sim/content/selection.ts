// Seletiva de fundação (design §5.2): formatos e faixas dos candidatos sorteados.
// Valores provisórios, para balancear no protótipo.

export type SelectionFormat = "broad" | "technical" | "referral" | "challenge";

type Range = readonly [min: number, max: number];

export interface SelectionFormatDef {
  id: SelectionFormat;
  label: string;
  description: string;
  /** Inscritos esperados sem divulgação nenhuma. */
  baseApplicants: number;
  /** Inscritos esperados a mais por ponto de alcance (GameState.outreach). */
  applicantsPerReach: number;
  /** Fase 8: bônus pequeno de conhecimento na disciplina que o candidato diz gostar (a base é parecida para todos). */
  focusKnowledge: Range;
  fabrication: Range;
  motivation: Range;
}

export const SELECTION_FORMATS: readonly SelectionFormatDef[] = [
  {
    id: "broad",
    label: "Ampla",
    description: "Divulgação no campus inteiro: muita gente, pouca experiência.",
    baseApplicants: 1,
    applicantsPerReach: 0.5,
    focusKnowledge: [0, 2],
    fabrication: [10, 22],
    motivation: [50, 80]
  },
  {
    id: "technical",
    label: "Técnica",
    description: "Prova de conceitos: poucos candidatos, mais preparados.",
    baseApplicants: 0.5,
    applicantsPerReach: 0.2,
    focusKnowledge: [3, 6],
    fabrication: [10, 20],
    motivation: [55, 80]
  },
  {
    id: "referral",
    label: "Por indicação",
    description: "Colegas indicados pelos fundadores: poucos, muito motivados.",
    baseApplicants: 2,
    applicantsPerReach: 0,
    focusKnowledge: [1, 4],
    fabrication: [10, 22],
    motivation: [75, 95]
  },
  {
    id: "challenge",
    label: "Desafio prático",
    description: "Montar uma peça na oficina: revela quem tem mão boa.",
    baseApplicants: 0.5,
    applicantsPerReach: 0.3,
    focusKnowledge: [0, 2],
    fabrication: [18, 30],
    motivation: [60, 85]
  }
];

export const CANDIDATE_HOURS_PER_DAY: Range = [2, 4];
export const CANDIDATE_AGILITY: Range = [20, 70];
export const CANDIDATE_COMMUNICATION: Range = [10, 60];
export const CANDIDATE_GRADUATIONS = ["2027.2", "2028.1", "2028.2", "2029.1", "2029.2", "2030.1"] as const;

