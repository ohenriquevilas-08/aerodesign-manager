// Catálogo de ações com custo nas três moedas (design §8.2).
// Valores numéricos são provisórios: o balanceamento acontece no protótipo.

import type { Cost, Discipline, PartType } from "../types";

export type ActionCategory = "hours" | "credits" | "both";

/** Itens de estoque (consumíveis) e equipamentos (permanentes). */
export type StockItem = "balsa";
export type EquipmentItem = "scale";

/**
 * O que acontece quando a tarefa termina. A simulação interpreta; o catálogo só descreve.
 * - credits: credita no caixa (rifa).
 * - sponsor: sorteia (rngState) se o patrocinador aceita (BALANCE.sponsor).
 * - fabricate: cria peça com qualidade a partir da fabricação de quem trabalhou.
 * - purchase-part: cria peça comercial com qualidade fixa.
 * - stock / equipment: entra no estoque ou no inventário de equipamentos.
 * - document: converte tácito em documentado na disciplina escolhida ao iniciar.
 * - repair: recupera condição da peça alvo.
 * - expedite: encurta a espera da tarefa alvo (fração da espera restante que sobra).
 * - agility: treino que aumenta agilidade de quem participou.
 */
export type ActionEffect =
  | { kind: "credits"; amount: number }
  | { kind: "sponsor" }
  | { kind: "fabricate"; part: PartType; label: string }
  | { kind: "purchase-part"; part: PartType; label: string }
  | { kind: "stock"; item: StockItem; amount: number }
  | { kind: "equipment"; item: EquipmentItem }
  | { kind: "document" }
  | { kind: "repair"; amount: number }
  | { kind: "expedite"; remainingFactor: number }
  | { kind: "agility" };

/** Alvo exigido no comando start-action. */
export type ActionTarget = "part" | "waiting-task" | "discipline";

export interface ActionDef {
  id: string;
  label: string;
  category: ActionCategory;
  cost: Cost;
  /** Disciplina que ganha conhecimento tácito com a ação, se houver. */
  discipline?: Discipline;
  effect?: ActionEffect;
  /** Consumíveis retirados do estoque ao iniciar. */
  requires?: Partial<Record<StockItem, number>>;
  target?: ActionTarget;
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
  { id: "document", label: "Documentar conhecimento", cost: cost(12, 0), effect: { kind: "document" }, target: "discipline" },
  { id: "raffle", label: "Organizar rifa", cost: cost(16, 0), effect: { kind: "credits", amount: 420 } },
  { id: "sponsor-pitch", label: "Contato com patrocinador", cost: cost(10, 0, 14), effect: { kind: "sponsor" } },
  { id: "unload-drill", label: "Treino de retirada de carga", cost: cost(4, 0), effect: { kind: "agility" } },
  // Só créditos (quase sempre com prazo)
  {
    id: "buy-motor",
    label: "Comprar motor 600 W",
    cost: cost(0, 420, 10),
    effect: { kind: "purchase-part", part: "powertrain", label: "Motor 600 W" }
  },
  {
    id: "buy-servos",
    label: "Comprar servos comerciais",
    cost: cost(0, 260, 7),
    effect: { kind: "purchase-part", part: "electronics", label: "Servos comerciais" }
  },
  { id: "buy-scale", label: "Comprar balança de precisão", cost: cost(0, 180, 5), effect: { kind: "equipment", item: "scale" } },
  { id: "buy-balsa", label: "Comprar balsa", cost: cost(0, 150, 6), effect: { kind: "stock", item: "balsa", amount: 1 } },
  {
    id: "express-shipping",
    label: "Frete expresso",
    cost: cost(0, 90),
    effect: { kind: "expedite", remainingFactor: 0.3 },
    target: "waiting-task"
  },
  // Horas + créditos
  {
    id: "build-wing",
    label: "Fabricar asa (balsa)",
    cost: cost(60, 180),
    discipline: "structures",
    effect: { kind: "fabricate", part: "wing", label: "Asa (balsa)" },
    requires: { balsa: 1 }
  },
  { id: "repair-part", label: "Reparar peça", cost: cost(10, 60), effect: { kind: "repair", amount: 30 }, target: "part" },
  { id: "test-flight", label: "Voo com carga incremental", cost: cost(12, 30, 0, "medium"), discipline: "performance" },
  { id: "flight-video", label: "Voo filmado (vídeo oficial)", cost: cost(12, 30, 0, "medium") }
];

export const ACTIONS: readonly ActionDef[] = defs.map((def) => ({ ...def, category: categoryOf(def.cost) }));

export function findAction(id: string): ActionDef | undefined {
  return ACTIONS.find((action) => action.id === id);
}
