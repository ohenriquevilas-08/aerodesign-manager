// Fundadores e agendas do presidente (Fase 6, S2; docs/phases/fase-6.md). Valores PROPOSTA.
// Os fundadores são fixos (a abertura conta a mesma história); só a aparência é sorteada.

import type { Discipline, FounderFlair, PresidentAgenda } from "../types";

export interface AgendaDef {
  id: PresidentAgenda;
  label: string;
  /** Uma frase para a carta do fundador e para o cartão do presidente. */
  description: string;
  /** Ações do catálogo que contam como "da agenda". balanced: qualquer uma das três frentes. */
  actions: readonly string[];
}

const REPORT_ACTIONS = ["read-regulation", "report-chapter", "drawings", "oral-rehearsal", "document", "study-aero"] as const;
const FLIGHT_ACTIONS = [
  "test-structural",
  "test-thrust",
  "pilot-training",
  "unload-drill",
  "build-wing",
  "build-fuselage",
  "build-tail",
  "build-gear",
  "repair-part"
] as const;
const FUNDING_ACTIONS = ["raffle", "sponsor-pitch", "outreach-posters", "outreach-social", "outreach-classroom", "outreach-freshers"] as const;

export const AGENDAS: readonly AgendaDef[] = [
  { id: "report", label: "Relatório", description: "Quer o relatório e o estudo em dia: leitura, capítulos, plantas e documentação.", actions: REPORT_ACTIONS },
  { id: "flight", label: "Voo", description: "Quer o avião pronto e voando: fabricação, ensaios e treino de pilotagem.", actions: FLIGHT_ACTIONS },
  { id: "funding", label: "Captação", description: "Quer caixa e gente: rifas, patrocínio e divulgação.", actions: FUNDING_ACTIONS },
  {
    id: "balanced",
    label: "Equilibrada",
    description: "Quer um pouco de cada frente: relatório, voo e captação.",
    actions: [...REPORT_ACTIONS, ...FLIGHT_ACTIONS, ...FUNDING_ACTIONS]
  }
];

export const findAgenda = (id: PresidentAgenda): AgendaDef => AGENDAS.find((agenda) => agenda.id === id)!;

/** A ação conta como da agenda? */
export const actionInAgenda = (agenda: PresidentAgenda, actionId: string): boolean => findAgenda(agenda).actions.includes(actionId);

/** Frente a que a ação pertence (para a agenda equilibrada); null se não pertence a nenhuma. */
export function frontOf(actionId: string): Exclude<PresidentAgenda, "balanced"> | null {
  for (const id of ["report", "flight", "funding"] as const) {
    if (findAgenda(id).actions.includes(actionId)) return id;
  }
  return null;
}

export interface FounderDef {
  id: string;
  name: string;
  flair: FounderFlair;
  /** Frase da carta: o que gosta de fazer. */
  likes: string;
  agenda: PresidentAgenda;
  focus: Discipline;
  /** Conhecimento inicial baixo na disciplina de foco. */
  knowledge: number;
  fabrication: number;
  communication: number;
  piloting: number;
}

export const FOUNDERS: readonly FounderDef[] = [
  {
    id: "founder-marina",
    name: "Marina Alves",
    flair: "design",
    likes: "Passa horas em polares e planilhas de dimensionamento.",
    agenda: "report",
    focus: "aerodynamics",
    knowledge: 14,
    fabrication: 15,
    communication: 35,
    piloting: 0
  },
  {
    id: "founder-caio",
    name: "Caio Ferreira",
    flair: "build",
    likes: "Só fica feliz com resina nas mãos e uma asa na bancada.",
    agenda: "flight",
    focus: "structures",
    knowledge: 14,
    fabrication: 32,
    communication: 25,
    piloting: 10
  },
  {
    id: "founder-bia",
    name: "Bia Nogueira",
    flair: "organize",
    likes: "Faz rifa, convence patrocinador e sabe o nome de todo mundo.",
    agenda: "funding",
    focus: "conceptual",
    knowledge: 12,
    fabrication: 12,
    communication: 60,
    piloting: 0
  },
  {
    id: "founder-rafa",
    name: "Rafa Tavares",
    flair: "fly",
    likes: "Pilota aeromodelo desde o ensino médio e quer ver o avião no ar.",
    agenda: "balanced",
    focus: "electrical",
    knowledge: 12,
    fabrication: 20,
    communication: 40,
    piloting: 32
  }
];
