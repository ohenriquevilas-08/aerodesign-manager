// Tarefas a partir do catálogo de ações (design §4.2 e §8): iniciar, alocar, cancelar e concluir.
// Funções puras: recebem o estado e devolvem um estado novo.

import { applyTest, testProblem } from "./aircraft";
import { findAction, type ActionDef, type StockItem } from "./content/actions";
import { BALANCE } from "./content/balance";
import { findDedication, type Dedication } from "./content/dedication";
import { crewQuality, documentGain, fabricatedQuality, rollApplicants, rollMultiplier, sponsorChance } from "./outcome";
import { addReportHours } from "./report";
import { recordTest } from "./testlog";
import { recordLedger } from "./ledger";
import { nextRandom } from "./rng";
import { actionProblem, agendaBoost, applyTraining } from "./season";
import { selectionDayAt } from "./eventSelection";
import { drawCandidates, expectedApplicants, findSelectionFormat } from "./selection";
import { DISCIPLINES } from "./state";
import { clamp, DISCIPLINE_LABELS, learn } from "./team";
import type { Discipline, GameState, InboxMessage, Member, Part, Task } from "./types";
import { crewRates } from "./crew";
import { clockToDate } from "./time";

/** Efeitos cujo resultado depende da qualidade da equipe (sim/outcome.ts). */
const VARIABLE_EFFECTS = new Set(["credits", "sponsor", "fabricate", "document", "repair", "test"]);

const STOCK_LABELS: Record<StockItem, string> = {
  balsa: "balsa média",
  "balsa-light": "balsa leve",
  "balsa-hard": "balsa dura",
  "carbon-fiber": "fibra de carbono",
  resin: "resina"
};

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
      return state.parts.some((part) => part.id === targetId && part.partial === undefined) ? null : "Escolha a peça a reparar.";
    case "waiting-task": {
      const task = state.tasks.find((item) => item.id === targetId);
      return task && task.status === "waiting" && task.readyAt !== null && task.readyAt > state.clock.hours
        ? null
        : "Frete expresso só vale para algo que ainda está chegando.";
    }
  }
}

/** Peça parcial do tipo certo que uma tarefa de fabricar pode terminar (Fase 8, S2). */
function resumablePart(state: GameState, action: ActionDef, targetId: string | null): Part | undefined {
  if (action.effect?.kind !== "fabricate" || targetId === null) return undefined;
  const part = state.parts.find((item) => item.id === targetId);
  return part && part.partial !== undefined && part.type === action.effect.part ? part : undefined;
}

/** Quem pode entrar numa tarefa nova: existe, está livre e a lista não repete ninguém. */
function crewProblem(state: GameState, action: ActionDef, memberIds: readonly string[]): string | null {
  if (action.cost.hours === 0) return null;
  const { min, max } = action.crew;
  if (new Set(memberIds).size !== memberIds.length) return "A mesma pessoa foi escolhida duas vezes.";
  for (const id of memberIds) {
    const member = state.members.find((item) => item.id === id);
    if (!member) return "Integrante não encontrado.";
    if (member.taskId !== null) return `${member.name} já está numa tarefa. Encerre a tarefa dela ou escolha outra pessoa.`;
  }
  if (memberIds.length < min) {
    return min === 1 ? "Escolha pelo menos 1 pessoa: tarefa não anda sozinha." : `Essa tarefa precisa de pelo menos ${min} pessoas.`;
  }
  if (max !== null && memberIds.length > max) return max === 1 ? "Essa tarefa é de uma pessoa só." : `Essa tarefa comporta no máximo ${max} pessoas.`;
  return null;
}

export function startAction(
  state: GameState,
  actionId: string,
  targetId: string | null,
  dedication: Dedication = "normal",
  memberIds: readonly string[] = []
): GameState {
  const action = findAction(actionId);
  if (!action) return warn(state, "Ação desconhecida.");

  const resumes = resumablePart(state, action, targetId);
  const problem =
    actionProblem(state, action) ??
    (action.effect?.kind === "fabricate" && targetId !== null && !resumes ? "Escolha uma peça parcial desse tipo para terminar." : null) ??
    (action.effect?.kind === "fabricate" ? null : targetProblem(state, action, targetId)) ??
    crewProblem(state, action, memberIds) ??
    (action.effect?.kind === "test" ? testProblem(state, action.effect.test) : null);
  if (problem) return warn(state, problem);

  // Terminar uma peça parcial não gasta material nem caixa de novo: só as horas que faltam.
  const credits = resumes ? 0 : action.cost.credits;
  if (!resumes) {
    for (const [item, amount] of Object.entries(action.requires ?? {}) as [StockItem, number][]) {
      if ((state.stock[item] ?? 0) < amount) return warn(state, `Falta ${STOCK_LABELS[item]} no estoque. Compre antes de começar.`);
    }
  }
  if (state.credits < credits) return warn(state, `Caixa insuficiente: faltam ◆ ${credits - state.credits}. Faça captação antes.`);

  const stock = { ...state.stock };
  if (!resumes) {
    for (const [item, amount] of Object.entries(action.requires ?? {}) as [StockItem, number][]) {
      stock[item] = (stock[item] ?? 0) - amount;
    }
  }

  const now = state.clock.hours;
  const waits = action.cost.leadDays > 0;
  // Prazo real sorteado em torno do prometido: nenhuma entrega é garantida (BALANCE.lead).
  let rngState = state.rngState;
  let readyAt: number | null = null;
  if (waits) {
    const roll = nextRandom(rngState);
    rngState = roll.state;
    const factor = BALANCE.lead.minFactor + (BALANCE.lead.maxFactor - BALANCE.lead.minFactor) * roll.value;
    readyAt = now + action.cost.leadDays * 24 * factor;
  }
  // Dedicação só faz sentido com horas; compras ficam sempre "normal".
  const taskDedication = action.cost.hours > 0 ? dedication : "normal";
  const remaining = resumes ? 1 - (resumes.partial ?? 0) : 1;
  const hoursTotal = action.cost.hours * findDedication(taskDedication).hoursFactor * remaining;

  // Quanto a tarefa entrega ao todo (S2): sorteado aqui, com a equipe escolhida, para o parcial
  // mais o restante dar sempre o total.
  let yieldTotal: number | null = null;
  const effect = action.effect;
  if (effect && hoursTotal > 0) {
    const team = memberIds.map((id) => state.members.find((member) => member.id === id)).filter((m): m is Member => !!m);
    const weights: Record<string, number> = {};
    crewRates(team, action.crew, clockToDate(now)).forEach((rate, id) => (weights[id] = rate));
    const quality = clamp(crewQuality(state, action, targetId, weights) + findDedication(taskDedication).qualityBonus);
    if (effect.kind === "outreach") {
      const rolled = rollMultiplier(rngState, quality);
      rngState = rolled.rngState;
      yieldTotal = effect.amount * rolled.multiplier;
    } else if (effect.kind === "selection") {
      const format = findSelectionFormat(targetId);
      if (format) {
        // Inscritos dependem do alcance acumulado, de quem conduz e de sorte; chegam aos poucos (milestones).
        const rolled = rollMultiplier(rngState, quality);
        const applicants = rollApplicants(rolled.rngState, expectedApplicants(format, state.outreach), rolled.multiplier);
        rngState = applicants.rngState;
        yieldTotal = applicants.count;
      }
    } else if (effect.kind === "report-chapter" || effect.kind === "drawings" || effect.kind === "oral-practice") {
      yieldTotal = hoursTotal;
    } else if (effect.kind === "fabricate") {
      yieldTotal = 1;
    }
  }

  const task: Task = {
    id: `task-${state.nextId}`,
    actionId: action.id,
    label: resumes ? `${action.label} (terminar)` : taskLabel(state, action, targetId),
    hoursTotal,
    hoursDone: 0,
    readyAt,
    expectedReadyAt: waits ? now + action.cost.leadDays * 24 : null,
    status: waits ? "waiting" : "active",
    assignees: hoursTotal > 0 ? [...memberIds] : [],
    contributions: {},
    targetId: action.target || resumes ? targetId : null,
    dedication: taskDedication,
    startedAt: now,
    doneAt: null,
    yieldTotal,
    yielded: 0
  };
  const crewSet = new Set(task.assignees);
  const next: GameState = recordLedger(
    {
      ...state,
      credits: state.credits - credits,
      rngState,
      stock,
      members: crewSet.size > 0 ? state.members.map((member) => (crewSet.has(member.id) ? { ...member, taskId: task.id } : member)) : state.members,
      tasks: [...state.tasks, task],
      nextId: state.nextId + 1
    },
    { credits: -credits, kind: "action", label: task.label }
  );

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

/** A tarefa fica abaixo do mínimo se esta pessoa sair? (compras sem horas nunca têm gente) */
function wouldLeaveBelowMin(state: GameState, member: Member): boolean {
  const task = member.taskId ? state.tasks.find((item) => item.id === member.taskId) : undefined;
  const action = task ? findAction(task.actionId) : undefined;
  return !!task && !!action && task.hoursTotal > 0 && task.assignees.length - 1 < action.crew.min;
}

export function assignMember(state: GameState, memberId: string, taskId: string): GameState {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return warn(state, "Integrante não encontrado.");
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || task.status === "done") return warn(state, "Essa tarefa não está mais aberta.");
  if (task.hoursTotal === 0) return warn(state, "Essa tarefa não usa horas da equipe: é só esperar.");
  if (member.taskId === taskId) return state;
  const { max } = findAction(task.actionId)!.crew;
  if (max !== null && task.assignees.length >= max) {
    return warn(state, max === 1 ? "Essa tarefa é de uma pessoa só." : `Essa tarefa comporta no máximo ${max} pessoas.`);
  }
  if (member.taskId !== null && wouldLeaveBelowMin(state, member)) {
    return warn(state, `${member.name} está numa tarefa que ficaria abaixo do mínimo. Encerre essa tarefa para liberar a pessoa.`);
  }

  const detached = detach(state, memberId);
  return {
    ...detached,
    members: detached.members.map((item) => (item.id === memberId ? { ...item, taskId } : item)),
    tasks: detached.tasks.map((item) => (item.id === taskId ? { ...item, assignees: [...item.assignees, memberId] } : item))
  };
}

/** Tira uma pessoa da tarefa; recusa se a tarefa ficaria abaixo do mínimo (o caminho é encerrar). */
export function unassignMember(state: GameState, memberId: string): GameState {
  const member = state.members.find((item) => item.id === memberId);
  if (!member || member.taskId === null) return state;
  if (wouldLeaveBelowMin(state, member)) {
    const task = state.tasks.find((item) => item.id === member.taskId)!;
    const min = findAction(task.actionId)!.crew.min;
    return warn(state, `${task.label} precisa de pelo menos ${min} ${min === 1 ? "pessoa" : "pessoas"}. Para liberar, encerre a tarefa.`);
  }
  return detach(state, memberId);
}

// ---------------------------------------------------------------------------
// Resultado aos poucos (Fase 8, S2)
// ---------------------------------------------------------------------------

/** Menor múltiplo de `step` que não passa de `value` (com folga numérica). */
const floorToStep = (value: number, step: number): number => Math.floor(value / step + 1e-9) * step;

/** Quanto da tarefa já devia ter sido entregue, dado o progresso `fraction` (0–1) das horas. */
function yieldTarget(task: Task, action: ActionDef, fraction: number): number {
  if (task.yieldTotal === null) return 0;
  if (fraction >= 1 - 1e-9) return task.yieldTotal;
  switch (action.yield) {
    case "continuous":
      return task.yieldTotal * fraction;
    case "milestones":
      // Seletiva: os inscritos chegam a cada marco; fabricação entrega no fechamento (peça parcial).
      return action.effect?.kind === "selection" ? Math.floor(task.yieldTotal * floorToStep(fraction, BALANCE.yield.selectionStep) + 1e-9) : 0;
    case "at-end":
      return 0;
  }
}

/** Entrega à parte o que a tarefa já devia ter entregue até aqui (nunca duas vezes). */
export function deliverProgress(state: GameState, taskId: string): GameState {
  const task = state.tasks.find((item) => item.id === taskId);
  const action = task ? findAction(task.actionId) : undefined;
  if (!task || !action || task.status === "done" || task.hoursTotal <= 0 || task.yieldTotal === null) return state;
  const target = yieldTarget(task, action, task.hoursDone / task.hoursTotal);
  const delta = target - task.yielded;
  if (delta <= 1e-9) return state;
  const effect = action.effect;
  let next = state;
  if (effect?.kind === "outreach") next = { ...next, outreach: next.outreach + delta };
  else if (effect?.kind === "selection") {
    const format = findSelectionFormat(task.targetId);
    if (format) next = drawCandidates(next, format.id, Math.round(delta));
  } else if (effect?.kind === "report-chapter" || effect?.kind === "drawings" || effect?.kind === "oral-practice") {
    next = addReportHours(next, effect.kind, delta, isDiscipline(task.targetId) ? task.targetId : null).state;
  }
  return replaceTask(next, { ...task, yielded: task.yielded + delta });
}

/** Etapa (0–1 do trabalho inteiro da peça) a que uma fabricação chegaria se fosse encerrada agora. */
function fabricationReached(state: GameState, task: Task): { base: number; reached: number } {
  const base = state.parts.find((item) => item.id === task.targetId)?.partial ?? 0;
  const fraction = task.hoursTotal > 0 ? Math.min(1, task.hoursDone / task.hoursTotal) : 0;
  return { base, reached: floorToStep(base + (1 - base) * fraction, BALANCE.yield.fabricateStep) };
}

/** O que fica se a tarefa for encerrada agora, em texto para a UI ("3 inscritos até agora"). */
export function taskKeeps(state: GameState, taskId: string): string {
  const task = state.tasks.find((item) => item.id === taskId);
  const action = task ? findAction(task.actionId) : undefined;
  if (!task || !action) return "";
  switch (action.effect?.kind) {
    case "outreach":
      return `Alcance +${Math.round(task.yielded)} até agora.`;
    case "selection": {
      const n = Math.round(task.yielded);
      return n === 0 ? "Nenhum inscrito até agora." : `${n} ${n === 1 ? "inscrito" : "inscritos"} até agora.`;
    }
    case "report-chapter":
    case "drawings":
    case "oral-practice":
      return `${Math.round(task.yielded)} h de escrita entregues.`;
    case "fabricate": {
      const { base, reached } = fabricationReached(state, task);
      if (reached > base + 1e-9) return `A peça fica parcial (${Math.round(reached * 100)}%).`;
      return base > 0 ? "A peça segue parcial." : "Nenhuma etapa concluída: o material se perde.";
    }
    default:
      return action.cost.hours > 0 ? "Só rende no fim: o parcial se perde (o aprendizado fica)." : "";
  }
}

/**
 * Encerra uma tarefa antes do fim (Fase 8, S1): o que já foi entregue fica, a peça de fabricação
 * vira parcial, o que só rende no fim se perde (o aprendizado dos alunos fica) e a equipe é liberada.
 */
export function closeTask(state: GameState, taskId: string, reason?: string): GameState {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || task.status === "done") return warn(state, "Essa tarefa não está mais aberta.");
  const action = findAction(task.actionId)!;
  let next = deliverProgress(state, taskId);
  const open = next.tasks.find((item) => item.id === taskId)!;
  const body = taskKeeps(next, taskId);
  const effect = action.effect;

  if (effect?.kind === "fabricate" && open.hoursTotal > 0) {
    const { base, reached } = fabricationReached(next, open);
    if (base > 0) {
      if (reached > base + 1e-9) next = { ...next, parts: next.parts.map((item) => (item.id === open.targetId ? { ...item, partial: reached } : item)) };
    } else if (reached > 1e-9) {
      next = addPart(next, { type: effect.part, label: `${effect.label} (parcial)`, quality: 0, condition: 100, partial: reached });
    }
  }
  if (effect?.kind === "selection") {
    // A dinâmica é marcada para quem já se inscreveu; a seletiva gasta o alcance.
    const format = findSelectionFormat(open.targetId);
    next = { ...next, outreach: 0 };
    if (format && open.yielded > 0) next = { ...next, selectionDay: { at: selectionDayAt(next.clock.hours), format: format.id } };
  }

  const crew = new Set(open.assignees);
  next = {
    ...next,
    members: next.members.map((member) => (crew.has(member.id) || member.taskId === taskId ? { ...member, taskId: null } : member)),
    tasks: next.tasks.filter((item) => item.id !== taskId)
  };
  const text = [reason, body].filter(Boolean).join(" ");
  return addMessage(next, { from: "Equipe", title: `Encerrada: ${task.label}`, body: text || "Tarefa encerrada." }).state;
}

/**
 * Tarefa que ficou abaixo do mínimo de pessoas (alguém foi desligado ou se formou) encerra sozinha
 * com o parcial e avisa na caixa de entrada.
 */
export function closeUnderstaffed(state: GameState): GameState {
  let next = state;
  for (const task of state.tasks) {
    if (task.status === "done" || task.hoursTotal <= 0) continue;
    const min = findAction(task.actionId)!.crew.min;
    const live = next.tasks.find((item) => item.id === task.id);
    if (live && live.assignees.length < min) next = closeTask(next, task.id, "Ficou sem gente suficiente para andar.");
  }
  return next;
}

/**
 * Conclui a tarefa: aplica o efeito da ação, ensina quem trabalhou, motiva quem está nela,
 * libera os integrantes e escreve na inbox. Devolve o id da mensagem para a pausa automática.
 */
export function completeTask(state: GameState, taskId: string): { state: GameState; messageId: string } {
  let task = state.tasks.find((item) => item.id === taskId)!;
  const action = findAction(task.actionId)!;
  const contributors = state.members.filter((member) => (task.contributions[member.id] ?? 0) > 0);
  let next: GameState = state;
  let body = "Tarefa concluída.";

  // Rendimento: qualidade de quem trabalhou (antes de aprender com a tarefa) e um sorteio.
  // Madrugada: cansaço gera erro, proporcional à fatia do trabalho feita de madrugada (design §5.5).
  const tired = task.hoursTotal > 0 ? Math.min(1, (task.overnightHours ?? 0) / task.hoursTotal) : 0;
  const quality = clamp(
    crewQuality(state, action, task.targetId, task.contributions) + findDedication(task.dedication).qualityBonus - BALANCE.workshop.overnightQualityPenalty * tired
  );
  const rolled = rollMultiplier(next.rngState, quality);
  const multiplier = rolled.multiplier;
  if (action.effect && VARIABLE_EFFECTS.has(action.effect.kind)) next = { ...next, rngState: rolled.rngState };

  // O conhecimento e as habilidades de quem trabalhou sobem hora a hora no loop (Fase 8, S2).
  // O que falta entregar do efeito (alcance, inscritos, horas de relatório) sai agora.
  next = deliverProgress(next, taskId);
  task = next.tasks.find((item) => item.id === taskId)!;

  const effect = action.effect;
  switch (effect?.kind) {
    case undefined:
      break;
    case "credits": {
      const amount = Math.round(effect.amount * multiplier);
      next = recordLedger({ ...next, credits: next.credits + amount }, { credits: amount, kind: "raffle", label: task.label });
      body = `Entraram ◆ ${amount} no caixa.`;
      break;
    }
    case "sponsor": {
      const roll = nextRandom(next.rngState);
      next = { ...next, rngState: roll.state };
      if (roll.value < sponsorChance(quality)) {
        const amount = Math.round(BALANCE.sponsor.amount * multiplier);
        next = recordLedger({ ...next, credits: next.credits + amount }, { credits: amount, kind: "sponsor", label: task.label });
        body = `O patrocinador topou: ◆ ${amount} no caixa.`;
      } else {
        body = "O patrocinador agradeceu, mas não vai apoiar nesta temporada.";
      }
      break;
    }
    case "fabricate": {
      // Qualidade da peça: fabricação de quem trabalhou, motivação, sorteio e equipamento (design §7.1).
      const partQuality = fabricatedQuality(multiplier, next.equipment);
      const finishing = next.parts.find((item) => item.id === task.targetId && item.partial !== undefined);
      if (finishing) {
        const { partial: _partial, ...whole } = finishing;
        next = { ...next, parts: next.parts.map((item) => (item.id === finishing.id ? { ...whole, label: effect.label, quality: partQuality, condition: 100 } : item)) };
      } else {
        next = addPart(next, { type: effect.part, label: effect.label, quality: partQuality, condition: 100 });
      }
      body = `${effect.label} pronta, qualidade ${partQuality}.`;
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
        const gained = documentGain(best, current, multiplier);
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
          parts: next.parts.map((item) =>
            item.id === part.id ? { ...item, condition: clamp(item.condition + Math.round(effect.amount * multiplier)) } : item
          )
        };
        body = `${part.label} reparada (+${Math.round(effect.amount * multiplier)} de condição).`;
      } else {
        body = "A peça não existe mais; o reparo não teve efeito.";
      }
      break;
    }
    case "expedite": {
      const target = next.tasks.find((item) => item.id === task.targetId);
      if (target && target.status === "waiting" && target.readyAt !== null) {
        const now = next.clock.hours;
        const shorten = (at: number) => now + Math.max(0, at - now) * effect.remainingFactor;
        next = replaceTask(next, {
          ...target,
          readyAt: shorten(target.readyAt),
          expectedReadyAt: target.expectedReadyAt === null ? null : shorten(target.expectedReadyAt)
        });
        body = `${target.label} vai chegar antes.`;
      }
      break;
    }
    case "agility":
      body = "A equipe ficou mais rápida na retirada de carga.";
      break;
    case "report-chapter":
    case "drawings":
    case "oral-practice": {
      // As horas já entraram no relatório hora a hora (S2); aqui só a mensagem de fechamento.
      body = addReportHours(next, effect.kind, 0, isDiscipline(task.targetId) ? task.targetId : null).body;
      break;
    }
    case "test": {
      const tested = applyTest(next, effect.test, quality, multiplier);
      next = tested.incident === null ? tested.state : recordTest(next, tested.state, effect.test, tested.body, !tested.incident);
      body = tested.body;
      break;
    }
    case "read-regulation":
      next = { ...next, regulationRead: true };
      body = "Regulamento lido. As mudanças de projeto ficam menos arriscadas na inspeção.";
      break;
    case "train": {
      const trained = applyTraining(next, task);
      next = trained.state;
      body = trained.body;
      break;
    }
    case "outreach": {
      body = `Alcance da divulgação +${Math.round(task.yielded)} (total ${Math.round(next.outreach)}).`;
      break;
    }
    case "selection": {
      const format = findSelectionFormat(task.targetId);
      if (format) {
        // Os inscritos chegaram aos poucos (S2); a seletiva gasta o alcance.
        next = { ...next, outreach: 0 };
        const drawn = Math.round(task.yielded);
        if (drawn > 0) next = { ...next, selectionDay: { at: selectionDayAt(next.clock.hours), format: format.id } };
        body =
          drawn === 0
            ? "Ninguém se inscreveu. Divulgue antes da próxima seletiva (cartazes, redes, sala de aula, stand)."
            : `${drawn} ${drawn === 1 ? "inscrito aguarda" : "inscritos aguardam"} convite. Veja os pareceres dos capitães. A dinâmica da seletiva é amanhã às 9h: lá dá para conhecê-los melhor.`;
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
  next = agendaBoost(next, task.actionId);
  next = replaceTask(next, {
    ...task,
    yielded: task.yieldTotal ?? task.yielded,
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
