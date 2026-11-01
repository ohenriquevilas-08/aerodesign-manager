// Catálogo de ações com custo nas três moedas (design §8.2).
// Valores numéricos são provisórios: o balanceamento acontece no protótipo.

import type { Cost, Discipline, PartType } from "../types";

export type ActionCategory = "hours" | "credits" | "both";

/** Itens de estoque (consumíveis) e equipamentos (permanentes). */
export type StockItem = "balsa" | "balsa-light" | "balsa-hard" | "carbon-fiber" | "resin";
export type EquipmentItem = "scale" | "thrust-stand";

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
 * - outreach: soma alcance de divulgação (GameState.outreach), que a seletiva consome.
 * - selection: sorteia candidatos da seletiva no formato escolhido ao iniciar (design §5.2).
 * - test: ensaio (design §7.3); estreita margens, cita nos capítulos, desgasta peças (sim/aircraft.ts).
 * - report-chapter / drawings / oral-practice: horas que entram no relatório e na apresentação (sim/report.ts).
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
  | { kind: "agility" }
  | { kind: "selection" }
  | { kind: "outreach"; amount: number }
  | { kind: "test"; test: "structural" | "thrust" }
  | { kind: "report-chapter" }
  | { kind: "drawings" }
  | { kind: "oral-practice" };

/** Alvo exigido no comando start-action. */
export type ActionTarget = "part" | "waiting-task" | "discipline" | "selection-format";

/**
 * Quantas pessoas trabalham juntas. Abaixo de `min` a tarefa não avança; acima de `ideal`
 * cada pessoa extra rende BALANCE.crew.extraEfficiency; `max` é o teto do assign-member.
 * Ações sem horas (compras) têm tudo 0.
 */
export interface Crew {
  min: number;
  ideal: number;
  max: number;
}

/**
 * Habilidade que define a qualidade da equipe na tarefa (sim/outcome.ts).
 * "knowledge" usa a disciplina da ação, ou a escolhida como alvo (document).
 */
export type ActionSkill = "fabrication" | "agility" | "piloting" | "communication" | "knowledge";

export interface ActionDef {
  id: string;
  label: string;
  category: ActionCategory;
  cost: Cost;
  crew: Crew;
  skill?: ActionSkill;
  /** Disciplina que ganha conhecimento tácito com a ação, se houver. */
  discipline?: Discipline;
  effect?: ActionEffect;
  /** Consumíveis retirados do estoque ao iniciar. */
  requires?: Partial<Record<StockItem, number>>;
  target?: ActionTarget;
  /** Tarefa de oficina: só anda nos turnos escalados, com chave e lotação (design §5.5). */
  workshop?: boolean;
  /** Exige duas pessoas no turno (resina, máquinas). */
  needsPair?: boolean;
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

const crew = (min: number, ideal: number, max: number): Crew => ({ min, ideal, max });

const defs: Omit<ActionDef, "category">[] = [
  // Só horas
  {
    id: "recruitment",
    label: "Processo seletivo",
    cost: cost(20, 0), crew: crew(1, 2, 2), skill: "communication",
    effect: { kind: "selection" },
    target: "selection-format"
  },
  // Divulgação: ações pequenas que somam alcance para a próxima seletiva.
  { id: "outreach-posters", label: "Cartazes no campus", cost: cost(2, 0), crew: crew(1, 1, 1), skill: "communication", effect: { kind: "outreach", amount: 4 } },
  { id: "outreach-social", label: "Post nas redes", cost: cost(1, 0), crew: crew(1, 1, 1), skill: "communication", effect: { kind: "outreach", amount: 2 } },
  { id: "outreach-classroom", label: "Passar em sala de aula", cost: cost(3, 0), crew: crew(1, 2, 2), skill: "communication", effect: { kind: "outreach", amount: 6 } },
  { id: "outreach-freshers", label: "Stand na recepção de calouros", cost: cost(6, 0), crew: crew(2, 2, 3), skill: "communication", effect: { kind: "outreach", amount: 12 } },
  { id: "study-aero", label: "Estudo de aerodinâmica", cost: cost(24, 0), crew: crew(1, 2, 3), skill: "knowledge", discipline: "aerodynamics" },
  // Relatório (design §9.1): o capítulo é a disciplina escolhida; as horas entram na nota.
  {
    id: "report-chapter",
    label: "Escrever capítulo do relatório",
    cost: cost(30, 0), crew: crew(1, 1, 1), skill: "knowledge",
    effect: { kind: "report-chapter" },
    target: "discipline"
  },
  { id: "drawings", label: "Desenhar plantas", cost: cost(20, 0), crew: crew(1, 1, 2), skill: "knowledge", discipline: "conceptual", effect: { kind: "drawings" } },
  { id: "oral-rehearsal", label: "Ensaiar apresentação oral", cost: cost(6, 0), crew: crew(1, 2, 3), skill: "communication", effect: { kind: "oral-practice" } },
  { id: "document", label: "Documentar conhecimento", cost: cost(12, 0), crew: crew(1, 1, 1), skill: "knowledge", effect: { kind: "document" }, target: "discipline" },
  { id: "raffle", label: "Organizar rifa", cost: cost(16, 0), crew: crew(1, 3, 4), skill: "communication", effect: { kind: "credits", amount: 500 } },
  { id: "sponsor-pitch", label: "Contato com patrocinador", cost: cost(10, 0, 14), crew: crew(1, 1, 2), skill: "communication", effect: { kind: "sponsor" } },
  { id: "unload-drill", label: "Treino de retirada de carga", cost: cost(4, 0), crew: crew(1, 2, 2), skill: "agility", effect: { kind: "agility" } },
  // Horas + créditos
  {
    id: "build-wing",
    label: "Fabricar asa (balsa)",
    cost: cost(60, 180), crew: crew(1, 2, 3), skill: "fabrication",
    discipline: "structures",
    effect: { kind: "fabricate", part: "wing", label: "Asa (balsa)" },
    requires: { balsa: 1 },
    workshop: true, needsPair: true
  },
  {
    id: "build-fuselage",
    label: "Fabricar fuselagem (balsa)",
    cost: cost(40, 120), crew: crew(1, 2, 3), skill: "fabrication",
    discipline: "structures",
    effect: { kind: "fabricate", part: "fuselage", label: "Fuselagem" },
    requires: { "balsa-hard": 1 },
    workshop: true, needsPair: true
  },
  {
    id: "build-tail",
    label: "Fabricar empenagem (balsa)",
    cost: cost(24, 60), crew: crew(1, 2, 2), skill: "fabrication",
    discipline: "stability",
    effect: { kind: "fabricate", part: "tail", label: "Empenagem" },
    requires: { "balsa-light": 1 },
    workshop: true
  },
  {
    id: "build-gear",
    label: "Fabricar trem de pouso",
    cost: cost(16, 80), crew: crew(1, 1, 2), skill: "fabrication",
    discipline: "loads",
    effect: { kind: "fabricate", part: "landingGear", label: "Trem de pouso" },
    requires: { "carbon-fiber": 1 },
    workshop: true
  },
  { id: "repair-part", label: "Reparar peça", cost: cost(10, 60), crew: crew(1, 1, 2), skill: "fabrication", effect: { kind: "repair", amount: 30 }, target: "part", workshop: true },
  // Ensaios (design §7.3): exigem as peças no hangar (sim/aircraft.ts, testProblem).
  { id: "test-structural", label: "Ensaio estrutural de bancada", cost: cost(8, 20, 0, "medium"), crew: crew(2, 2, 3), skill: "knowledge", discipline: "structures", effect: { kind: "test", test: "structural" }, workshop: true, needsPair: true },
  { id: "test-thrust", label: "Ensaio de motor e hélice", cost: cost(4, 10, 0, "low"), crew: crew(1, 2, 2), skill: "knowledge", discipline: "electrical", effect: { kind: "test", test: "thrust" }, workshop: true },
  // Voo de ensaio e voo filmado viraram evento agendado (Fase 5, S2: schedule-flight-test).
  // Treino de pilotagem: simulador e aeromodelo-escola, para um integrante chegar a pilotar o ensaio.
  { id: "pilot-training", label: "Treino de pilotagem (simulador e aeromodelo-escola)", cost: cost(10, 20, 0, "low"), crew: crew(1, 1, 2), skill: "piloting" }
];

export const ACTIONS: readonly ActionDef[] = defs.map((def) => ({ ...def, category: categoryOf(def.cost) }));

export function findAction(id: string): ActionDef | undefined {
  return ACTIONS.find((action) => action.id === id);
}
