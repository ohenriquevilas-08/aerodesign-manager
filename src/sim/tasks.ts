// Tarefas a partir do catálogo de ações (design §4.2 e §8): iniciar, alocar, cancelar e concluir.
// Funções puras: recebem o estado e devolvem um estado novo.

import { findAction, type ActionDef, type StockItem } from "./content/actions";
import { BALANCE } from "./content/balance";
import { nextRandom } from "./rng";
import { drawCandidates, findSelectionFormat } from "./selection";
import { DISCIPLINES } from "./state";
import { clamp, DISCIPLINE_LABELS, learn, motivationFactor } from "./team";
import type { Discipline, GameState, InboxMessage, Member, Part, Task } from "./types";

const STOCK_LABELS: Record<StockItem, string> = { balsa: "balsa" };

const isDiscipline = (value: string | null | undefined): value is Discipline =>
  value != null && (DISCIPLINES as readonly string[]).includes(value);

/** Recusa o comando: estado igual, mais um aviso novo para a UI. */
export function warn(state: GameState, text: string): GameState {
  return { ...state, warning: { id: state.nextId, at: state.clock.hours, text }, nextId: state.nextId + 1 };
}

export function addMessage(state: GameState, message: Omit<InboxMessage, "id" | "at" | "read">): {
  state: GameState;
  id: string;
} {
  const id = `msg-${state.nextId}`;
  const full: InboxMessage = { ...message, id, at: state.clock.hours, read: false };
  return { state: { ...state, inbox: [...state.inbox, full], nextId: state.nextId + 1 }, id };
}

const replaceTask = (state: GameState, task: Task): GameState => ({
  ...state,
  tasks: state.tasks.map((item) => (item.id === task.id ? task : item))
});

function taskLabel(state: GameState, action: ActionDef, targetId: string | null): string {
  if (action.target === "discipline" && isDiscipline(targetId)) return `${action.label} (${DISCIPLINE_LABELS[targetId]})`;
  if (action.target === "selection-format") {
    const format = findSelectionFormat(targetId);
    if (format) return `${action.label} (${format.label})`;
  }
  if (action.target === "part") {
    const part = state.parts.find((item) => item.id === targetId);
    if (part) return `${action.label}: ${part.label}`;
  }
  if (action.target === "waiting-task") {
    const task = state.tasks.find((item) => item.id === targetId);
    if (task) return `${action.label}: ${task.label}`;
  }
  return action.label;
}

/** Valida o alvo exigido pela ação; devolve o texto do aviso se for inválido. */
function targetProblem(state: GameState, action: ActionDef, targetId: string | null): string | null {
  switch (action.target) {
    case undefined:
      return null;
    case "discipline":
      return isDiscipline(targetId) ? null : "Escolha a disciplina a documentar.";
    case "selection-format":
      return findSelectionFormat(targetId) ? null : "Escolha o formato da seletiva.";
    case "part":
      return state.parts.some((part) => part.id === targetId) ? null : "Escolha a peça a reparar.";
    case "waiting-task": {
      const task = state.tasks.find((item) => item.id === targetId);
      return task && task.status === "waiting" && task.readyAt !== null && task.readyAt > state.clock.hours
        ? null
        : "Frete expresso só vale para algo que ainda está chegando.";
    }
  }
}

export function startAction(state: GameState, actionId: string, targetId: string | null): GameState {
  const action = findAction(actionId);
  if (!action) return warn(state, "Ação desconhecida.");

  const problem = targetProblem(state, action, targetId);
  if (problem) return warn(state, problem);

  for (const [item, amount] of Object.entries(action.requires ?? {}) as [StockItem, number][]) {
    if ((state.stock[item] ?? 0) < amount) return warn(state, `Falta ${STOCK_LABELS[item]} no estoque. Compre antes de começar.`);
  }

  if (state.credits < action.cost.credits) {
    return warn(state, `Caixa insuficiente: faltam ◆ ${action.cost.credits - state.credits}. Faça captação antes.`);
  }

  const stock = { ...state.stock };
  for (const [item, amount] of Object.entries(action.requires ?? {}) as [StockItem, number][]) {
    stock[item] = (stock[item] ?? 0) - amount;
  }

  const now = state.clock.hours;
  const waits = action.cost.leadDays > 0;
  const task: Task = {
    id: `task-${state.nextId}`,
    actionId: action.id,
    label: taskLabel(state, action, targetId),
    hoursTotal: action.cost.hours,
    hoursDone: 0,
    readyAt: waits ? now + action.cost.leadDays * 24 : null,
    status: waits ? "waiting" : "active",
    assignees: [],
    contributions: {},
    targetId: action.target ? targetId : null,
    doneAt: null
  };
  const next: GameState = {
    ...state,
    credits: state.credits - action.cost.credits,
    stock,
    tasks: [...state.tasks, task],
    nextId: state.nextId + 1
  };

  // Sem horas e sem prazo (ex.: frete expresso): conclui na hora, sem pausar o relógio.
  if (!waits && action.cost.hours === 0) return completeTask(next, task.id).state;
  return next;
}

/** Tira o integrante da tarefa em que estiver. */
function detach(state: GameState, memberId: string): GameState {
  const member = state.members.find((item) => item.id === memberId);
  if (!member || member.taskId === null) return state;
  return {
    ...state,
    members: state.members.map((item) => (item.id === memberId ? { ...item, taskId: null } : item)),
    tasks: state.tasks.map((task) =>
      task.id === member.taskId ? { ...task, assignees: task.assignees.filter((id) => id !== memberId) } : task
    )
  };
}

export function assignMember(state: GameState, memberId: string, taskId: string): GameState {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return warn(state, "Integrante não encontrado.");
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || task.status === "done") return warn(state, "Essa tarefa não está mais aberta.");
  if (task.hoursTotal === 0) return warn(state, "Essa tarefa não usa horas da equipe: é só esperar.");
  if (member.taskId === taskId) return state;
  const { max } = findAction(task.actionId)!.crew;
  if (task.assignees.length >= max) {
    return warn(state, max === 1 ? "Essa tarefa é de uma pessoa só." : `Essa tarefa comporta no máximo ${max} pessoas.`);
  }

  const detached = detach(state, memberId);
  return {
    ...detached,
    members: detached.members.map((item) => (item.id === memberId ? { ...item, taskId } : item)),
    tasks: detached.tasks.map((item) => (item.id === taskId ? { ...item, assignees: [...item.assignees, memberId] } : item))
  };
}

export function unassignMember(state: GameState, memberId: string): GameState {
  return detach(state, memberId);
}

/** Cancela uma tarefa aberta. Créditos e material já gastos não voltam. */
export function cancelTask(state: GameState, taskId: string): GameState {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || task.status === "done") return warn(state, "Essa tarefa não está mais aberta.");
  return {
    ...state,
    members: state.members.map((member) => (member.taskId === taskId ? { ...member, taskId: null } : member)),
    tasks: state.tasks.filter((item) => item.id !== taskId)
  };
}

/** Média das habilidades de quem trabalhou, ponderada pelas horas de cada um. */
function weightedAverage(members: Member[], contributions: Record<string, number>, pick: (member: Member) => number): number {
  let total = 0;
  let weight = 0;
  for (const member of members) {
    const hours = contributions[member.id] ?? 0;
    total += pick(member) * hours;
    weight += hours;
  }
  return weight > 0 ? total / weight : 0;
}

/**
 * Conclui a tarefa: aplica o efeito da ação, ensina quem trabalhou, motiva quem está nela,
 * libera os integrantes e escreve na inbox. Devolve o id da mensagem para a pausa automática.
 */
export function completeTask(state: GameState, taskId: string): { state: GameState; messageId: string } {
  const task = state.tasks.find((item) => item.id === taskId)!;
  const action = findAction(task.actionId)!;
  const contributors = state.members.filter((member) => (task.contributions[member.id] ?? 0) > 0);
  let next: GameState = state;
  let body = "Tarefa concluída.";

  // Conhecimento tácito e habilidades de quem trabalhou (design §5.3).
  const fabricates = action.effect?.kind === "fabricate";
  const drills = action.effect?.kind === "agility";
  next = {
    ...next,
    members: next.members.map((member) => {
      const hours = task.contributions[member.id] ?? 0;
      if (hours <= 0) return member;
      let updated = member;
      if (action.discipline) {
        const discipline = action.discipline;
        updated = {
          ...updated,
          knowledge: {
            ...updated.knowledge,
            [discipline]: learn(updated.knowledge[discipline], hours, BALANCE.knowledge.perHour)
          }
        };
      }
      if (fabricates) updated = { ...updated, fabrication: learn(updated.fabrication, hours, BALANCE.knowledge.fabricationPerHour) };
      if (drills) updated = { ...updated, agility: learn(updated.agility, hours, BALANCE.knowledge.agilityPerHour) };
      return updated;
    })
  };

  const effect = action.effect;
  switch (effect?.kind) {
    case undefined:
      break;
    case "credits":
      next = { ...next, credits: next.credits + effect.amount };
      body = `Entraram ◆ ${effect.amount} no caixa.`;
      break;
    case "sponsor": {
      const roll = nextRandom(next.rngState);
      next = { ...next, rngState: roll.state };
      if (roll.value < BALANCE.sponsor.successChance) {
        next = { ...next, credits: next.credits + BALANCE.sponsor.amount };
        body = `O patrocinador topou: ◆ ${BALANCE.sponsor.amount} no caixa.`;
      } else {
        body = "O patrocinador agradeceu, mas não vai apoiar nesta temporada.";
      }
      break;
    }
    case "fabricate": {
      // Qualidade a partir da fabricação de quem trabalhou, motivação e equipamento (design §7.1).
      const skill = weightedAverage(contributors, task.contributions, (member) => member.fabrication);
      const mood = weightedAverage(contributors, task.contributions, (member) => motivationFactor(member.motivation));
      const bonus = next.equipment.reduce((sum, item) => sum + (BALANCE.parts.equipmentQualityBonus[item] ?? 0), 0);
      const quality = Math.round(
        clamp((BALANCE.parts.fabricatedQualityBase + BALANCE.parts.fabricatedQualityPerSkill * skill) * mood + bonus)
      );
      next = addPart(next, { type: effect.part, label: effect.label, quality, condition: 100 });
      body = `${effect.label} pronta, qualidade ${quality}.`;
      break;
    }
    case "purchase-part":
      next = addPart(next, { type: effect.part, label: effect.label, quality: BALANCE.parts.purchasedQuality, condition: 100 });
      body = `${effect.label} chegou ao hangar.`;
      break;
    case "stock":
      next = { ...next, stock: { ...next.stock, [effect.item]: (next.stock[effect.item] ?? 0) + effect.amount } };
      body = `Chegou ${STOCK_LABELS[effect.item]} para o estoque.`;
      break;
    case "equipment":
      if (!next.equipment.includes(effect.item)) next = { ...next, equipment: [...next.equipment, effect.item] };
      body = "Equipamento novo no hangar.";
      break;
    case "document": {
      if (isDiscipline(task.targetId)) {
        const discipline = task.targetId;
        const best = Math.max(0, ...contributors.map((member) => member.knowledge[discipline]));
        const current = next.documented[discipline];
        const gained = Math.max(0, (best - current) * BALANCE.knowledge.documentTransfer);
        next = { ...next, documented: { ...next.documented, [discipline]: current + gained } };
        body = `Acervo de ${DISCIPLINE_LABELS[discipline]} subiu ${gained.toFixed(1)} pontos.`;
      }
      break;
    }
    case "repair": {
      const part = next.parts.find((item) => item.id === task.targetId);
      if (part) {
        next = {
          ...next,
          parts: next.parts.map((item) => (item.id === part.id ? { ...item, condition: clamp(item.condition + effect.amount) } : item))
        };
        body = `${part.label} reparada.`;
      } else {
        body = "A peça não existe mais; o reparo não teve efeito.";
      }
      break;
    }
    case "expedite": {
      const target = next.tasks.find((item) => item.id === task.targetId);
      if (target && target.status === "waiting" && target.readyAt !== null) {
        const now = next.clock.hours;
        const readyAt = now + Math.max(0, target.readyAt - now) * effect.remainingFactor;
        next = replaceTask(next, { ...target, readyAt });
        body = `${target.label} vai chegar antes.`;
      }
      break;
    }
    case "agility":
      body = "A equipe ficou mais rápida na retirada de carga.";
      break;
    case "selection": {
      const format = findSelectionFormat(task.targetId);
      if (format) {
        const before = next.candidates.length;
        next = drawCandidates(next, format.id);
        body = `${next.candidates.length - before} candidatos aguardam convite. Veja os pareceres dos capitães.`;
      }
      break;
    }
  }

  // Concluir motiva quem está na tarefa no fim; todos ficam livres.
  const finishers = new Set(task.assignees);
  next = {
    ...next,
    members: next.members.map((member) =>
      finishers.has(member.id)
        ? { ...member, taskId: null, motivation: clamp(member.motivation + BALANCE.motivation.completionBoost) }
        : member
    )
  };
  next = replaceTask(next, {
    ...task,
    hoursDone: task.hoursTotal,
    status: "done",
    assignees: [],
    doneAt: next.clock.hours
  });

  const added = addMessage(next, { from: "Equipe", title: `Concluído: ${task.label}`, body });
  return { state: added.state, messageId: added.id };
}

function addPart(state: GameState, part: Omit<Part, "id">): GameState {
  return { ...state, parts: [...state.parts, { ...part, id: `part-${state.nextId}` }], nextId: state.nextId + 1 };
}
