// Formação da equipe por área (Fase 4, S3). Cada categoria da competição tem a sua lista de áreas;
// cada área tem 1 vaga de capitão e `members` vagas de integrante. Sem banco nem reserva.
// Valores provisórios (docs/design/ano-1.md §5.1): 6 capitães + 10 integrantes na Classe Regular.

import type { Discipline } from "../types";

export interface FormationArea {
  discipline: Discipline;
  /** Vagas de integrante (além do capitão). */
  members: number;
  /** O que para sem ninguém na área (aviso da escalação). */
  stops: string;
}

export type FormationCategory = "regular";

export const FORMATIONS: Record<FormationCategory, readonly FormationArea[]> = {
  regular: [
    { discipline: "aerodynamics", members: 2, stops: "Aerodinâmica sem ninguém: polares e dimensionamento da asa param." },
    { discipline: "structures", members: 3, stops: "Estruturas sem ninguém: laminação e ensaios estruturais param." },
    { discipline: "electrical", members: 2, stops: "Elétrica sem ninguém: capítulo de safety e ensaios de motor param." },
    { discipline: "performance", members: 1, stops: "Desempenho sem ninguém: previsão de carga e de decolagem fica no escuro." },
    { discipline: "stability", members: 1, stops: "Estabilidade e controle sem ninguém: cálculo de empenagem e margem estática param." },
    { discipline: "loads", members: 1, stops: "Cargas sem ninguém: diagrama V-n e aeroelasticidade param." }
  ]
};

/** Categoria do Ano 1 (o estado ainda não escolhe categoria). */
export const DEFAULT_CATEGORY: FormationCategory = "regular";

export const findFormationArea = (category: FormationCategory, discipline: Discipline): FormationArea | undefined =>
  FORMATIONS[category].find((area) => area.discipline === discipline);
