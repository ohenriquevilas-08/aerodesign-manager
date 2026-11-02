// Fundadores e agendas do presidente (Fase 6, S2; docs/phases/fase-6.md). Valores PROPOSTA.
// Os fundadores são fixos (a abertura conta a mesma história); só a aparência é sorteada.

import type { Discipline, FounderFlair, PresidentAgenda } from "../types";

export interface AgendaDef {
  id: PresidentAgenda;
  /** Rótulo curto da prioridade, sem prefixo: "Fazer o avião voar". */
  label: string;
  /** "Prioridade: fazer o avião voar" (Fase 7, S5): o que o presidente quer. */
  priority: string;
  /** O que acontece: "tarefas de fabricação e ensaio animam a equipe". */
  effect: string;
  /** Rótulo completo para a UI: `${priority} · ${effect}`. */
  text: string;
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

const agenda = (id: PresidentAgenda, label: string, effect: string, description: string, actions: readonly string[]): AgendaDef => ({
  id,
  label,
  priority: `Prioridade: ${label.charAt(0).toLowerCase()}${label.slice(1)}`,
  effect,
  text: `Prioridade: ${label.charAt(0).toLowerCase()}${label.slice(1)} · ${effect}`,
  description,
  actions
});

export const AGENDAS: readonly AgendaDef[] = [
  agenda("report", "Entregar o relatório", "leitura, capítulos, plantas e documentação animam a equipe", "Quer o relatório e o estudo em dia: leitura, capítulos, plantas e documentação.", REPORT_ACTIONS),
  agenda("flight", "Fazer o avião voar", "tarefas de fabricação e ensaio animam a equipe", "Quer o avião pronto e voando: fabricação, ensaios e treino de pilotagem.", FLIGHT_ACTIONS),
  agenda("funding", "Levantar caixa e gente", "rifas, patrocínio e divulgação animam a equipe", "Quer caixa e gente: rifas, patrocínio e divulgação.", FUNDING_ACTIONS),
  agenda("balanced", "Equilibrar as três frentes", "trabalhar em relatório, voo e captação ao mesmo tempo anima a equipe", "Quer um pouco de cada frente: relatório, voo e captação.", [...REPORT_ACTIONS, ...FLIGHT_ACTIONS, ...FUNDING_ACTIONS])
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
  flair: FounderFlair;
  /** Fase 8: intenção declarada na carta ("Diz que quer mexer com aerodinâmica"), não uma afirmação sobre o que ele faz bem. */
  likes: string;
  agenda: PresidentAgenda;
  /** Fase 8: o que o fundador diz gostar; o gosto real é sorteado e pode ser outro (BALANCE.people.statedTruthShare). */
  stated: readonly Discipline[];
  /** Fase 8: todo aluno chega com conhecimento baixo e parecido; só estas habilidades variam pouco. */
  fabrication: number;
  communication: number;
  piloting: number;
}

export const FOUNDERS: readonly FounderDef[] = [
  {
    id: "founder-marina",
    flair: "design",
    likes: "Diz que quer mexer com aerodinâmica e planilhas de dimensionamento.",
    agenda: "report",
    stated: ["aerodynamics"],
    fabrication: 16,
    communication: 38,
    piloting: 0
  },
  {
    id: "founder-caio",
    flair: "build",
    likes: "Diz que quer pôr a mão na massa: resina, asa na bancada, estrutura.",
    agenda: "flight",
    stated: ["structures"],
    fabrication: 20,
    communication: 32,
    piloting: 5
  },
  {
    id: "founder-bia",
    flair: "organize",
    likes: "Diz que quer cuidar do projeto como um todo, das rifas e dos patrocinadores.",
    agenda: "funding",
    stated: ["conceptual"],
    fabrication: 14,
    communication: 48,
    piloting: 0
  },
  {
    id: "founder-rafa",
    flair: "fly",
    likes: "Diz que quer ver o avião no ar e mexer com a eletrônica. Pilota aeromodelo.",
    agenda: "balanced",
    stated: ["electrical"],
    fabrication: 16,
    communication: 40,
    piloting: 32
  }
];
