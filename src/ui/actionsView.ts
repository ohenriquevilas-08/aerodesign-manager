// Tela Ações por objetivo (Fase 8, U2): grupos, o que está disponível agora, o que destrava depois e a
// busca por nome. Puro (sem Preact), testado em tests/ui/. A simulação decide o que pode começar
// (actionProblem); aqui só se organiza o catálogo.

import {
  actionProblem,
  ACTIONS,
  formatDate,
  REGULATION_DATE,
  regulationPublished,
  type ActionDef,
  type GameState,
  type Task
} from "../sim";

export type ActionGroupId = "team" | "outreach" | "project" | "fabrication" | "tests" | "report" | "funding";

interface GroupDef {
  id: ActionGroupId;
  title: string;
  /** Uma linha sobre o objetivo do grupo. */
  goal: string;
  actionIds: readonly string[];
  /** Grupo que só destrava com o regulamento publicado (9/fev). */
  needsRegulation?: boolean;
}

export const ACTION_GROUPS: readonly GroupDef[] = [
  { id: "team", title: "Equipe", goal: "Trazer gente nova e guardar o que a equipe já sabe.", actionIds: ["selection-open", "trainee-training", "document"] },
  { id: "outreach", title: "Divulgação", goal: "Somar alcance para a próxima seletiva.", actionIds: ["outreach-posters", "outreach-social", "outreach-classroom", "outreach-freshers"] },
  { id: "project", title: "Projeto", goal: "Estudar, ler o regulamento e desenhar o avião.", actionIds: ["read-regulation", "study-aero", "drawings"] },
  { id: "fabrication", title: "Fabricação", goal: "Fazer e consertar as peças do avião.", actionIds: ["build-wing", "build-fuselage", "build-tail", "build-gear", "repair-part"], needsRegulation: true },
  { id: "tests", title: "Ensaios", goal: "Testar peças e treinar a equipe de voo.", actionIds: ["test-structural", "test-thrust", "pilot-training", "unload-drill"], needsRegulation: true },
  { id: "report", title: "Relatório", goal: "Escrever e ensaiar a entrega técnica.", actionIds: ["report-chapter", "oral-rehearsal"], needsRegulation: true },
  { id: "funding", title: "Captação", goal: "Levantar caixa para comprar material.", actionIds: ["raffle", "sponsor-pitch"] }
];

export const groupOf = (actionId: string): ActionGroupId | null => ACTION_GROUPS.find((group) => group.actionIds.includes(actionId))?.id ?? null;

export interface LaterAction {
  action: ActionDef;
  /** Quando destrava, em minúsculas: "depois do regulamento, 9/fev". */
  reason: string;
}

export interface GroupView {
  id: ActionGroupId;
  title: string;
  goal: string;
  available: ActionDef[];
  later: LaterAction[];
  /** Tarefas abertas das ações do grupo. */
  running: number;
}

/** "9/fev": só dia e mês, como as razões da linha "Mais adiante". */
function shortDate(date: number): string {
  const [, day, month] = /^\w+, (\d+) (\w+) /.exec(formatDate(date)) ?? [];
  return `${day}/${month}`;
}

/** Tira acento e caixa para a busca. */
export const normalize = (text: string): string => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Por que a ação não está disponível agora; null = disponível. `undefined` = nunca mais (some da lista). */
function lockedReason(state: GameState, action: ActionDef, needsRegulation: boolean): string | null | undefined {
  if (action.id === "read-regulation") {
    if (state.regulationRead) return undefined;
    if (!regulationPublished(state)) return `quando sair o regulamento, ${shortDate(REGULATION_DATE)}`;
  }
  if (needsRegulation && !regulationPublished(state)) return `depois do regulamento, ${shortDate(REGULATION_DATE)}`;
  if (action.id === "selection-open" && actionProblem(state, action)) return "quando o processo seletivo atual acabar";
  if (action.id === "trainee-training" && actionProblem(state, action)) return "quando houver trainees";
  return null;
}

/** Os grupos da tela, já filtrados pela busca. Grupo sem nada (nem agora, nem depois) some. */
export function actionGroups(state: GameState, query = ""): GroupView[] {
  const needle = normalize(query);
  const matches = (action: ActionDef) => needle === "" || normalize(action.label).includes(needle);
  const open = state.tasks.filter((task) => task.status !== "done");
  const views: GroupView[] = [];
  for (const group of ACTION_GROUPS) {
    const available: ActionDef[] = [];
    const later: LaterAction[] = [];
    for (const id of group.actionIds) {
      const action = ACTIONS.find((item) => item.id === id);
      if (!action || !matches(action)) continue;
      const reason = lockedReason(state, action, group.needsRegulation === true);
      if (reason === undefined) continue;
      if (reason === null) available.push(action);
      else later.push({ action, reason });
    }
    if (available.length === 0 && later.length === 0) continue;
    views.push({
      id: group.id,
      title: group.title,
      goal: group.goal,
      available,
      later,
      running: open.filter((task) => group.actionIds.includes(task.actionId)).length
    });
  }
  return views;
}

/** Resumo do grupo recolhido: "3 para fazer agora · 1 em andamento". */
export function groupSummary(view: GroupView): string {
  const parts: string[] = [];
  if (view.available.length > 0) parts.push(view.available.length === 1 ? "1 para fazer agora" : `${view.available.length} para fazer agora`);
  else parts.push("nada agora");
  if (view.running > 0) parts.push(view.running === 1 ? "1 em andamento" : `${view.running} em andamento`);
  return parts.join(" · ");
}

/**
 * O que a tarefa já entregou ("3 candidatos até agora"); null quando só entrega no fim ou ainda não
 * entregou nada que valha dizer.
 */
export function deliveredText(task: Pick<Task, "yielded" | "yieldTotal">, action: ActionDef | undefined): string | null {
  if (!action || task.yieldTotal === null) return null;
  const kind = action.effect?.kind;
  const done = task.yielded;
  switch (kind) {
    case "selection-open":
    case "outreach":
      return done < 0.5 ? "Ainda sem alcance" : `+${Math.round(done)} de alcance até agora`;
    case "report-chapter":
    case "drawings":
    case "oral-practice":
      return done < 0.5 ? null : `${Math.round(done)} h já entram na nota do relatório`;
    case "fabricate": {
      const steps = Math.floor(done * 3 + 1e-9);
      return steps === 0 ? "Peça ainda sem etapa pronta" : `${steps} de 3 etapas da peça prontas`;
    }
    default:
      return null;
  }
}

/** Como a ação entrega o resultado, para o painel antes de começar. */
export function yieldText(action: ActionDef): string | null {
  const kind = action.effect?.kind;
  if (action.cost.hours === 0) return null;
  if (action.yield === "at-end") return "Entrega só no fim. Encerrar antes não deixa nada pronto.";
  if (action.yield === "continuous") {
    return kind === "outreach" ? "O alcance chega aos poucos, na proporção das horas." : "Rende aos poucos, na proporção das horas. Encerrar antes fica com o que já rendeu.";
  }
  if (kind === "selection-open") return "A divulgação soma alcance enquanto anda; ao terminar (ou ao encerrar), as inscrições abrem e os inscritos chegam aos poucos.";
  if (kind === "fabricate") return "A peça avança em etapas (corte, montagem, acabamento). Encerrada no meio, fica parcial e dá para terminar depois.";
  return "Entrega em marcos ao longo da tarefa.";
}
