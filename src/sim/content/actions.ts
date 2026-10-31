// Catálogo de ações com custo nas três moedas (design §8.2).
// Valores numéricos são provisórios: o balanceamento acontece no protótipo.

import type { Cost, Discipline } from "../types";

export type ActionCategory = "hours" | "credits" | "both";

export interface ActionDef {
  id: string;
  label: string;
  category: ActionCategory;
  cost: Cost;
  /** Disciplina que ganha conhecimento tácito com a ação, se houver. */
  discipline?: Discipline;
}

const cost = (hours: number, credits: number, leadDays = 0, risk: Cost["risk"] = "none"): Cost => ({
  hours,
  credits,
  leadDays,
  risk
});

/** Classifica pela regra do design: só horas, só créditos ou os dois. */
export function categoryOf(value: Cost): ActionCategory {
  if (value.hours > 0 && value.credits > 0) return "both";
  return value.credits > 0 ? "credits" : "hours";
}

const defs: Omit<ActionDef, "category">[] = [
  // Só horas
  { id: "recruitment", label: "Processo seletivo", cost: cost(20, 0) },
  { id: "study-aero", label: "Estudo de aerodinâmica", cost: cost(24, 0), discipline: "aerodynamics" },
  { id: "report-chapter", label: "Escrever capítulo do relatório", cost: cost(30, 0) },
  { id: "document", label: "Documentar conhecimento", cost: cost(12, 0) },
  { id: "raffle", label: "Organizar rifa", cost: cost(16, 0) },
  { id: "sponsor-pitch", label: "Contato com patrocinador", cost: cost(10, 0, 14) },
  { id: "unload-drill", label: "Treino de retirada de carga", cost: cost(4, 0) },
  // Só créditos (quase sempre com prazo)
  { id: "buy-motor", label: "Comprar motor 600 W", cost: cost(0, 420, 10) },
  { id: "buy-servos", label: "Comprar servos comerciais", cost: cost(0, 260, 7) },
  { id: "buy-scale", label: "Comprar balança de precisão", cost: cost(0, 180, 5) },
  { id: "buy-balsa", label: "Comprar balsa", cost: cost(0, 150, 6) },
  { id: "express-shipping", label: "Frete expresso", cost: cost(0, 90) },
  // Horas + créditos
  { id: "build-wing", label: "Fabricar asa (balsa)", cost: cost(60, 180), discipline: "structures" },
  { id: "repair-part", label: "Reparar peça", cost: cost(10, 60) },
  { id: "test-flight", label: "Voo com carga incremental", cost: cost(12, 30, 0, "medium"), discipline: "performance" },
  { id: "flight-video", label: "Voo filmado (vídeo oficial)", cost: cost(12, 30, 0, "medium") }
];

export const ACTIONS: readonly ActionDef[] = defs.map((def) => ({ ...def, category: categoryOf(def.cost) }));
