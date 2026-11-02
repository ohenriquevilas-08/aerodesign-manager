// Dia da dinâmica da seletiva (Fase 7, S2; Fase 9, S3; design §5.2). Na data marcada pela campanha,
// os inscritos que vieram (convidados pela planilha, sem os faltosos) viram um evento: recepção,
// apresentação da equipe, desafio prático em grupos de 5–6 (planador de balsa) e deliberação. O
// jogador acompanha de perto alguns grupos (BALANCE.selection.watchedGroups): os acompanhados geram
// anotações para todos os membros, os outros só uma anotação geral do grupo. Quem passa para a
// entrevista é escolha depois, em `advance-applicants`; o fechamento só passa as anotações às fichas.

import { BALANCE } from "./content/balance";
import { activeOf, askDecision, drawer, logLine, option, patchContext } from "./eventCore";
import type { EventHandler } from "./events";
import { inviteToDynamic } from "./selection";
import { addMessage } from "./tasks";
import { clamp } from "./team";
import type { ActiveEvent, Applicant, DynamicsGroup, EventBlock, EventDecision, EventSummary, GameState, SelectionDayContext } from "./types";

const S = BALANCE.selectionDay;
const SEL = BALANCE.selection;

const GROUP_NAMES = ["Azul", "Verde", "Amarelo", "Vermelho", "Roxo", "Laranja", "Branco", "Preto", "Rosa", "Cinza", "Marrom", "Ciano"] as const;

const BLOCKS: EventBlock[] = [
  { id: "reception", startsAt: 9, label: "Recepção no corredor do departamento", kind: "reception" },
  { id: "presentation", startsAt: 10, label: "Apresentação da equipe", kind: "presentation" },
  { id: "challenge", startsAt: 11, label: "Desafio prático: planador de balsa", kind: "challenge" },
  { id: "deliberation", startsAt: 16, label: "Deliberação", kind: "deliberation" }
];

const ctxOf = (state: GameState) => activeOf(state).context as SelectionDayContext;
const applicantOf = (state: GameState, id: string) => state.selection?.applicants.find((applicant) => applicant.id === id);
const firstName = (applicant: Applicant) => applicant.name.split(" ")[0]!;

/** Quantos grupos de 5–6 para `n` pessoas (um só se houver poucos). */
export function groupCountFor(n: number): number {
  if (n <= S.groupMax) return 1;
  const min = Math.ceil(n / S.groupMax);
  const max = Math.floor(n / S.groupMin);
  return min <= max ? Math.min(max, Math.max(min, Math.round(n / ((S.groupMin + S.groupMax) / 2)))) : min;
}

function groupName(index: number): string {
  return GROUP_NAMES[index] ? `Grupo ${GROUP_NAMES[index]}` : `Grupo ${index + 1}`;
}

/**
 * Abre o dia da dinâmica da campanha: convida pela planilha (tags e teto), sorteia os faltosos e
 * monta os grupos. Devolve o estado (inscritos já na etapa certa) e o evento; sem ninguém, a
 * campanha acaba e `event` é null.
 */
export function buildSelectionDay(state: GameState): { state: GameState; event: ActiveEvent | null } {
  const invited = inviteToDynamic(state);
  let next = invited.state;
  const ids = invited.attendees;
  if (ids.length === 0) {
    next = addMessage({ ...next, selection: null, outreach: 0 }, {
      from: "Equipe",
      title: "Ninguém veio à dinâmica",
      body: "Nenhum dos convidados apareceu. O processo seletivo termina sem aprovados; dá para abrir outro."
    }).state;
    return { state: next, event: null };
  }

  const rng = drawer(next);
  // Embaralha para os grupos não saírem na ordem da planilha.
  const order = ids.map((id) => ({ id, key: rng.roll() })).sort((a, b) => a.key - b.key).map((item) => item.id);
  next = rng.commit(next);
  const count = groupCountFor(order.length);
  const groups: DynamicsGroup[] = Array.from({ length: count }, (_, index) => ({ id: `group-${index + 1}`, name: groupName(index), candidateIds: [], gliderDistanceM: null }));
  const base = Math.floor(order.length / count);
  const extra = order.length % count;
  let cursor = 0;
  groups.forEach((group, index) => {
    const size = base + (index < extra ? 1 : 0);
    group.candidateIds = order.slice(cursor, cursor + size);
    cursor += size;
  });

  const context: SelectionDayContext = {
    kind: "selection-day",
    candidateIds: order,
    groups,
    watchedGroupId: null,
    watchedGroupIds: [],
    watchDone: false,
    frozeId: null,
    secondChance: null,
    notes: {},
    captainsPick: []
  };
  // Espelho enxuto para as cenas (GameState.candidates, deprecado).
  const mirror = order.map((id) => {
    const applicant = applicantOf(next, id)!;
    return { id, name: applicant.name, look: applicant.profile.look };
  });
  const event: ActiveEvent = {
    id: `event-selection-${state.nextId}`,
    kind: "selection-day",
    title: "Dia da dinâmica da seletiva",
    entered: false,
    day: 1,
    totalDays: 1,
    startsAtDay: Math.floor(state.clock.hours / 24) * 24,
    blocks: BLOCKS.map((block) => ({ ...block })),
    blockIndex: 0,
    pendingDecision: null,
    log: [],
    summary: null,
    context
  };
  return { state: { ...next, candidates: mirror }, event };
}

function addNote(state: GameState, applicantId: string, text: string): GameState {
  const context = ctxOf(state);
  return patchContext<SelectionDayContext>(state, { notes: { ...context.notes, [applicantId]: [...(context.notes[applicantId] ?? []), text] } });
}

const groupOf = (context: SelectionDayContext, applicantId: string): DynamicsGroup => context.groups.find((group) => group.candidateIds.includes(applicantId))!;
const isWatched = (context: SelectionDayContext, applicantId: string) => context.watchedGroupIds.includes(groupOf(context, applicantId).id);

/** O que os capitães enxergam de longe: conhecimento no foco, mão na oficina e conversa. */
const captainsScore = (applicant: Applicant) => {
  const profile = applicant.profile;
  return profile.knowledge[profile.focus] * 0.5 + profile.fabrication * 0.3 + profile.communication * 0.2;
};

function run(state: GameState): { state: GameState; done: boolean } {
  const event = activeOf(state);
  const block = event.blocks[event.blockIndex]!;
  const context = ctxOf(state);
  const people = context.candidateIds.map((id) => applicantOf(state, id)).filter((item): item is Applicant => !!item);
  let next = state;

  switch (block.kind) {
    case "reception": {
      next = logLine(next, `${people.length} ${people.length === 1 ? "inscrito chega" : "inscritos chegam"} ao departamento. Os capitães entregam crachás e dividem a turma em ${context.groups.length} ${context.groups.length === 1 ? "grupo" : "grupos"} de 5 a 6 pessoas.`);
      return { state: next, done: true };
    }
    case "presentation": {
      next = logLine(next, "A equipe mostra o hangar, as fotos da última competição e o que cada área faz.");
      return { state: next, done: true };
    }
    case "challenge":
      return runChallenge(next, people);
    case "deliberation": {
      if (context.captainsPick.length > 0) return { state: next, done: true };
      const k = Math.max(1, Math.ceil(people.length / 3));
      const pick = [...people].sort((a, b) => captainsScore(b) - captainsScore(a) || a.id.localeCompare(b.id)).slice(0, k);
      next = patchContext<SelectionDayContext>(next, { captainsPick: pick.map((applicant) => applicant.id) });
      next = logLine(next, "Hora de fechar: os capitães comparam as anotações. Quem avança para a entrevista é escolha sua, na aba Seletiva.");
      next = logLine(next, `Os capitães ficaram de olho em ${pick.length} ${pick.length === 1 ? "pessoa" : "pessoas"}; isso vai para as fichas, sem decidir nada.`);
      return { state: next, done: true };
    }
    default:
      return { state: next, done: true };
  }
}

function runChallenge(state: GameState, people: Applicant[]): { state: GameState; done: boolean } {
  const context = ctxOf(state);
  let next = state;

  if (!context.watchDone) {
    const left = SEL.watchedGroups - context.watchedGroupIds.length;
    const open = context.groups.filter((group) => !context.watchedGroupIds.includes(group.id));
    const options = open.map((group) =>
      option(group.id, group.name, `${group.candidateIds.length} pessoas. Quem você observa de perto fica claro nas fichas; os outros grupos ganham só uma anotação geral.`)
    );
    if (context.watchedGroupIds.length > 0) options.push(option("enough", "Já chega", "Acompanhar só os grupos escolhidos."));
    const prompt =
      context.watchedGroupIds.length === 0
        ? `O desafio vai começar. De que grupo você chega perto? (Dá para acompanhar até ${SEL.watchedGroups}.)`
        : `Mais um grupo para acompanhar de perto? (Restam ${left}.)`;
    return { state: askDecision(next, { id: "watch-group", prompt, options } as EventDecision), done: false };
  }

  if (context.groups[0]!.gliderDistanceM === null) {
    const rng = drawer(next);
    const groups = context.groups.map((group) => {
      const members = group.candidateIds.map((id) => applicantOf(next, id)).filter((item): item is Applicant => !!item);
      const fabrication = members.reduce((sum, item) => sum + item.profile.fabrication, 0) / members.length;
      const agility = members.reduce((sum, item) => sum + item.profile.agility, 0) / members.length;
      const distance = S.gliderBase * (0.6 + (fabrication / 100) * 0.9 + (agility / 100) * 0.3) + S.gliderNoise * (2 * rng.roll() - 1);
      return { ...group, gliderDistanceM: Math.round(distance * 10) / 10 };
    });
    // Quem tem menos conversa e menos motivação é quem mais pode travar; só vale em grupo acompanhado.
    const watched = people.filter((item) => context.watchedGroupIds.includes(groupOf({ ...context, groups }, item.id).id));
    const nervous = [...watched].sort((a, b) => a.profile.motivation + a.profile.communication - (b.profile.motivation + b.profile.communication))[0];
    const froze = watched.length >= 2 && nervous && rng.roll() < S.freezeChance ? nervous : null;
    next = rng.commit(next);
    next = patchContext<SelectionDayContext>(next, { groups, frozeId: froze?.id ?? null });
    next = logLine(next, "Cada grupo recebe balsa, cola e vinte minutos para montar um planador.");

    for (const group of groups) {
      const members = group.candidateIds.map((id) => applicantOf(next, id)!);
      if (context.watchedGroupIds.includes(group.id)) {
        for (const applicant of members) {
          const profile = applicant.profile;
          if (profile.fabrication >= S.steadyHands) next = addNote(next, applicant.id, `${firstName(applicant)} montou a longarina sem refazer nada: mão firme.`);
          else if (profile.fabrication <= S.clumsyHands) next = addNote(next, applicant.id, `${firstName(applicant)} colou a asa torta e precisou de ajuda para refazer.`);
          else next = addNote(next, applicant.id, `${firstName(applicant)} trabalhou no ritmo do grupo, sem se destacar na oficina.`);
          if (profile.communication >= S.talkative) next = addNote(next, applicant.id, `${firstName(applicant)} puxou a conversa e distribuiu as tarefas do grupo.`);
          else if (profile.communication <= S.shy) next = addNote(next, applicant.id, `${firstName(applicant)} ficou quieto e só falou quando perguntaram.`);
          if (profile.motivation >= S.eager) next = addNote(next, applicant.id, `${firstName(applicant)} perguntou quando poderia pegar numa peça de verdade.`);
        }
      } else {
        const text = `${group.name}: visto de longe, o grupo trabalhou junto e o planador voou ${group.gliderDistanceM!.toFixed(1)} m.`;
        for (const applicant of members) next = addNote(next, applicant.id, text);
      }
    }
    for (const group of groups) {
      next = logLine(next, `${group.name}: o planador voou ${group.gliderDistanceM!.toFixed(1)} m.`, group.gliderDistanceM! >= S.gliderBase ? "good" : "info");
    }
    if (froze) {
      next = logLine(next, `${froze.name} travou na hora de montar a asa e parou de mexer.`, "bad");
      next = addNote(next, froze.id, `${firstName(froze)} travou no desafio prático.`);
      const decision: EventDecision = {
        id: "second-chance",
        prompt: `${froze.name} travou na montagem. Dar uma segunda chance?`,
        options: [
          option("yes", "Dar uma segunda chance", "Dez minutos a mais com um capitão ao lado. Dá para ver quem a pessoa é sem a pressão.", { hours: 0.5, risk: "low" }),
          option("no", "Seguir com o desafio", "Quem travou fica sem avaliação nessa parte.")
        ]
      };
      return { state: askDecision(next, decision), done: false };
    }
  }
  return { state: next, done: true };
}

function decide(state: GameState, decision: EventDecision, optionId: string): GameState {
  let next = state;
  const context = ctxOf(state);
  switch (decision.id) {
    case "watch-group": {
      if (optionId === "enough") return patchContext<SelectionDayContext>(next, { watchDone: true });
      const group = context.groups.find((item) => item.id === optionId)!;
      const ids = [...context.watchedGroupIds, group.id];
      next = patchContext<SelectionDayContext>(next, { watchedGroupIds: ids, watchedGroupId: context.watchedGroupId ?? group.id, watchDone: ids.length >= SEL.watchedGroups || ids.length >= context.groups.length });
      return logLine(next, `Você se aproxima do ${group.name} para acompanhar a montagem.`);
    }
    default: {
      const applicant = applicantOf(next, context.frozeId!)!;
      if (optionId === "no") {
        next = patchContext<SelectionDayContext>(next, { secondChance: false });
        return logLine(next, `O desafio segue sem ${firstName(applicant)}.`);
      }
      const rng = drawer(next);
      const recovered = rng.roll() < clamp(applicant.profile.motivation / 100 + S.recoverBonus, 0, 0.95);
      next = rng.commit(next);
      next = patchContext<SelectionDayContext>(next, { secondChance: true });
      next = payHours(next, 0.5);
      if (recovered) {
        next = addNote(next, applicant.id, `Recuperou-se na segunda chance: ${firstName(applicant)} terminou a asa sozinho e pediu para refazer o teste.`);
        return logLine(next, `${applicant.name} respirou, recomeçou e entregou a asa pronta.`, "good");
      }
      next = addNote(next, applicant.id, `${firstName(applicant)} travou de novo, mesmo com um capitão ao lado.`);
      return logLine(next, `${applicant.name} não conseguiu se soltar nem com ajuda.`, "bad");
    }
  }
}

/** Meia hora a mais de trabalho dos capitães: cansa um pouco a equipe. */
function payHours(state: GameState, hours: number): GameState {
  return { ...state, members: state.members.map((member) => (member.role === "captain" ? { ...member, motivation: clamp(member.motivation - hours * 0.4) } : member)) };
}

function summarize(state: GameState): EventSummary {
  const context = ctxOf(state);
  const lines: string[] = [`${context.candidateIds.length} inscritos vieram, em ${context.groups.length} ${context.groups.length === 1 ? "grupo" : "grupos"}.`];
  for (const group of context.groups) lines.push(`${group.name}: planador a ${group.gliderDistanceM?.toFixed(1) ?? "?"} m${context.watchedGroupIds.includes(group.id) ? " (acompanhado)" : ""}.`);
  if (context.frozeId) {
    const applicant = applicantOf(state, context.frozeId);
    if (applicant) lines.push(`${applicant.name} travou no desafio${context.secondChance ? " e ganhou uma segunda chance" : ""}.`);
  }
  lines.push("Escolha quem avança para a entrevista na aba Seletiva.");
  const noted = context.candidateIds.reduce((sum, id) => sum + (context.notes[id]?.length ?? 0), 0);
  return { title: "Fim da dinâmica da seletiva", lines, points: null, damage: [], knowledge: [`${noted} anotações nas fichas dos inscritos.`], creditsSpent: 0 };
}

/** Fechamento: anotações e a olhada dos capitães vão para as fichas; a campanha passa a escolher quem entrevista. */
function close(state: GameState): GameState {
  const context = ctxOf(state);
  const event = activeOf(state);
  const campaign = state.selection;
  let next = state;
  if (campaign) {
    const applicants = campaign.applicants.map((applicant) => {
      const notes = context.notes[applicant.id];
      if (!notes && !context.captainsPick.includes(applicant.id)) return applicant;
      const extra = context.captainsPick.includes(applicant.id) ? ["Os capitães ficaram de olho nesta pessoa."] : [];
      return { ...applicant, notes: [...applicant.notes, ...(notes ?? []), ...extra] };
    });
    next = { ...next, selection: { ...campaign, applicants, stage: "shortlist" } };
  }
  // A equipe sai animada de um dia bem conduzido.
  const members = next.members.map((member) => (member.role === "captain" ? { ...member, motivation: clamp(member.motivation + S.captainsHeardBoost) } : member));
  return { ...next, members, candidates: [], clock: { ...next.clock, hours: Math.max(next.clock.hours, event.startsAtDay + 17) } };
}

export const selectionHandler: EventHandler = { run, decide, summarize, close };
