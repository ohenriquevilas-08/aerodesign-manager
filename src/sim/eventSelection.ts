// Dia da dinâmica da seletiva (Fase 7, S2; design §5.2). Depois da divulgação e da inscrição
// (tarefa), um dia agendado vira evento: recepção, apresentação, desafio prático em grupos
// (planador de balsa), entrevistas rápidas e deliberação. As decisões escolhem de que grupo
// o orientador chega perto, se dá segunda chance a quem travou e em quem confia (capitães ou
// a própria leitura). Convidar continua sendo `hire-candidate`; o fechamento só anota as fichas.

import { BALANCE } from "./content/balance";
import { activeOf, askDecision, drawer, logLine, option, patchContext } from "./eventCore";
import type { EventHandler } from "./events";
import { clamp, DISCIPLINE_LABELS } from "./team";
import type {
  ActiveEvent,
  Candidate,
  CandidateVerdict,
  DynamicsGroup,
  EventBlock,
  EventDecision,
  EventSummary,
  GameState,
  SelectionDayContext
} from "./types";

const S = BALANCE.selectionDay;

const GROUP_NAMES = ["Grupo Azul", "Grupo Verde", "Grupo Amarelo"] as const;

const BLOCKS: EventBlock[] = [
  { id: "reception", startsAt: 9, label: "Recepção no corredor do departamento", kind: "reception" },
  { id: "presentation", startsAt: 10, label: "Apresentação da equipe", kind: "presentation" },
  { id: "challenge", startsAt: 11, label: "Desafio prático: planador de balsa", kind: "challenge" },
  { id: "interviews", startsAt: 14, label: "Entrevistas rápidas", kind: "interviews" },
  { id: "deliberation", startsAt: 16, label: "Deliberação", kind: "deliberation" }
];

const ctxOf = (state: GameState) => activeOf(state).context as SelectionDayContext;
const candidateOf = (state: GameState, id: string) => state.candidates.find((candidate) => candidate.id === id);
const firstName = (candidate: Candidate) => candidate.name.split(" ")[0]!;

/** Horas de jogo da primeira hora do dia da dinâmica: dia seguinte à conclusão, `startHour`. */
export function selectionDayAt(completedAt: number): number {
  return (Math.floor(completedAt / 24) + 1) * 24 + S.startHour;
}

/** Abre o dia da dinâmica com os candidatos que ainda esperam resposta; null se não há ninguém. */
export function buildSelectionDay(state: GameState): ActiveEvent | null {
  const candidates = state.candidates.slice(0, S.maxCandidates);
  if (candidates.length === 0) return null;
  const groupCount = Math.max(1, Math.min(GROUP_NAMES.length, Math.ceil(candidates.length / S.groupSize)));
  const groups: DynamicsGroup[] = Array.from({ length: groupCount }, (_, index) => ({
    id: `group-${index + 1}`,
    name: GROUP_NAMES[index]!,
    candidateIds: [],
    gliderDistanceM: null
  }));
  candidates.forEach((candidate, index) => groups[index % groupCount]!.candidateIds.push(candidate.id));
  const context: SelectionDayContext = {
    kind: "selection-day",
    candidateIds: candidates.map((candidate) => candidate.id),
    groups,
    watchedGroupId: groupCount === 1 ? groups[0]!.id : null,
    frozeId: null,
    secondChance: null,
    notes: {},
    captainsPick: [],
    yourPick: [],
    followed: null,
    verdicts: {}
  };
  return {
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
}

function addNote(state: GameState, candidateId: string, text: string): GameState {
  const context = ctxOf(state);
  return patchContext<SelectionDayContext>(state, { notes: { ...context.notes, [candidateId]: [...(context.notes[candidateId] ?? []), text] } });
}

function groupOf(context: SelectionDayContext, candidateId: string): DynamicsGroup {
  return context.groups.find((group) => group.candidateIds.includes(candidateId))!;
}

/** O que os capitães enxergam de longe: conhecimento no foco, mão na oficina e conversa. */
const captainsScore = (candidate: Candidate) => candidate.knowledge[candidate.focus] * 0.5 + candidate.fabrication * 0.3 + candidate.communication * 0.2;

function yourScore(state: GameState, candidate: Candidate): number {
  const context = ctxOf(state);
  const watched = groupOf(context, candidate.id).id === context.watchedGroupId;
  const group = groupOf(context, candidate.id);
  const glider = (group.gliderDistanceM ?? S.gliderBase) / S.gliderBase;
  let score = candidate.motivation * 0.4 + candidate.agility * 0.2 + glider * 20 + (watched ? candidate.fabrication * 0.3 : 0);
  if (context.frozeId === candidate.id) score -= context.secondChance ? 0 : 12;
  if (context.notes[candidate.id]?.some((note) => note.startsWith("Recuperou"))) score += 8;
  return score;
}

function top(candidates: Candidate[], score: (candidate: Candidate) => number): string[] {
  const k = Math.max(1, Math.ceil(candidates.length / 2));
  return [...candidates]
    .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))
    .slice(0, k)
    .map((candidate) => candidate.id);
}

function run(state: GameState): { state: GameState; done: boolean } {
  const event = activeOf(state);
  const block = event.blocks[event.blockIndex]!;
  const context = ctxOf(state);
  const candidates = context.candidateIds.map((id) => candidateOf(state, id)).filter((item): item is Candidate => !!item);
  let next = state;

  switch (block.kind) {
    case "reception": {
      next = logLine(next, `${candidates.length} ${candidates.length === 1 ? "candidato chega" : "candidatos chegam"} ao departamento. Os capitães entregam crachás e dividem a turma em ${context.groups.length} ${context.groups.length === 1 ? "grupo" : "grupos"}.`);
      for (const candidate of candidates) {
        if (candidate.communication >= S.talkative) next = addNote(next, candidate.id, `${firstName(candidate)} chegou puxando conversa com todo mundo.`);
        else if (candidate.communication <= S.shy) next = addNote(next, candidate.id, `${firstName(candidate)} ficou quieto no canto, olhando os aviões da estante.`);
      }
      return { state: next, done: true };
    }
    case "presentation": {
      next = logLine(next, "A equipe mostra o hangar, as fotos da última competição e o que cada área faz.");
      for (const candidate of candidates) {
        if (candidate.motivation >= S.eager) next = addNote(next, candidate.id, `${firstName(candidate)} perguntou quando poderia pegar numa peça de verdade.`);
      }
      return { state: next, done: true };
    }
    case "challenge":
      return runChallenge(next, candidates);
    case "interviews": {
      next = logLine(next, "Entrevistas de cinco minutos: o que cada um sabe, quanto tempo tem e por que quer entrar.");
      for (const candidate of candidates) {
        const watched = groupOf(context, candidate.id).id === context.watchedGroupId;
        const level = candidate.knowledge[candidate.focus];
        const subject = DISCIPLINE_LABELS[candidate.focus];
        const detail =
          level >= S.knowsLot ? `chega sabendo bastante de ${subject}` : level >= S.knowsSome ? `tem base em ${subject}` : `ainda não domina ${subject}`;
        const time = watched ? ` e conta com ${candidate.hoursPerDay} h por dia` : "";
        next = addNote(next, candidate.id, `Na entrevista, ${firstName(candidate)} ${detail}${time}.`);
      }
      return { state: next, done: true };
    }
    case "deliberation": {
      if (context.followed !== null) return { state: next, done: true };
      const captainsPick = top(candidates, captainsScore);
      const yourPick = top(candidates, (candidate) => yourScore(next, candidate));
      next = patchContext<SelectionDayContext>(next, { captainsPick, yourPick });
      next = logLine(next, "Hora de fechar a lista: os capitães e você comparam as anotações.");
      const names = (ids: string[]) => ids.map((id) => candidateOf(next, id)?.name ?? id).join(", ");
      const decision: EventDecision = {
        id: "deliberation",
        prompt: "Quem entra na lista de convidados?",
        options: [
          option("captains", "Seguir a recomendação dos capitães", `Eles indicam: ${names(captainsPick)}. Olham o que cada um já sabe fazer.`),
          option("mine", "Confiar na minha leitura do dia", `Você aponta: ${names(yourPick)}. Pesa o que viu no desafio e na motivação.`)
        ]
      };
      return { state: askDecision(next, decision), done: false };
    }
    default:
      return { state: next, done: true };
  }
}

function runChallenge(state: GameState, candidates: Candidate[]): { state: GameState; done: boolean } {
  const context = ctxOf(state);
  let next = state;

  if (context.watchedGroupId === null) {
    const decision: EventDecision = {
      id: "watch-group",
      prompt: "O desafio vai começar. De que grupo você chega perto?",
      options: context.groups.map((group) =>
        option(
          group.id,
          group.name,
          `${group.candidateIds.map((id) => candidateOf(state, id)?.name ?? id).join(", ")}. Quem você observa de perto fica mais claro nas fichas.`
        )
      )
    };
    return { state: askDecision(next, decision), done: false };
  }

  if (context.groups[0]!.gliderDistanceM === null) {
    const rng = drawer(next);
    const groups = context.groups.map((group) => {
      const members = group.candidateIds.map((id) => candidateOf(next, id)).filter((item): item is Candidate => !!item);
      const fabrication = members.reduce((sum, item) => sum + item.fabrication, 0) / members.length;
      const agility = members.reduce((sum, item) => sum + item.agility, 0) / members.length;
      const distance = S.gliderBase * (0.6 + (fabrication / 100) * 0.9 + (agility / 100) * 0.3) + S.gliderNoise * (2 * rng.roll() - 1);
      return { ...group, gliderDistanceM: Math.round(distance * 10) / 10 };
    });
    // Quem tem menos conversa e menos motivação é quem mais pode travar.
    const nervous = [...candidates].sort((a, b) => a.motivation + a.communication - (b.motivation + b.communication))[0];
    const froze = candidates.length >= 2 && nervous && rng.roll() < S.freezeChance ? nervous : null;
    next = rng.commit(next);
    next = patchContext<SelectionDayContext>(next, { groups, frozeId: froze?.id ?? null });
    next = logLine(next, "Cada grupo recebe balsa, cola e vinte minutos para montar um planador.");
    const watched = groups.find((group) => group.id === context.watchedGroupId)!;
    for (const id of watched.candidateIds) {
      const candidate = candidateOf(next, id)!;
      if (candidate.fabrication >= S.steadyHands) next = addNote(next, id, `${firstName(candidate)} montou a longarina sem refazer nada: mão firme.`);
      else if (candidate.fabrication <= S.clumsyHands) next = addNote(next, id, `${firstName(candidate)} colou a asa torta e precisou de ajuda para refazer.`);
      else next = addNote(next, id, `${firstName(candidate)} trabalhou no ritmo do grupo, sem se destacar na oficina.`);
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
      const group = context.groups.find((item) => item.id === optionId)!;
      next = patchContext<SelectionDayContext>(next, { watchedGroupId: group.id });
      return logLine(next, `Você se aproxima do ${group.name} para acompanhar a montagem.`);
    }
    case "second-chance": {
      const candidate = candidateOf(next, context.frozeId!)!;
      if (optionId === "no") {
        next = patchContext<SelectionDayContext>(next, { secondChance: false });
        return logLine(next, `O desafio segue sem ${firstName(candidate)}.`);
      }
      const rng = drawer(next);
      const recovered = rng.roll() < clamp(candidate.motivation / 100 + S.recoverBonus, 0, 0.95);
      next = rng.commit(next);
      next = patchContext<SelectionDayContext>(next, { secondChance: true });
      next = payHours(next, 0.5);
      if (recovered) {
        next = addNote(next, candidate.id, `Recuperou-se na segunda chance: ${firstName(candidate)} terminou a asa sozinho e pediu para refazer o teste.`);
        return logLine(next, `${candidate.name} respirou, recomeçou e entregou a asa pronta.`, "good");
      }
      next = addNote(next, candidate.id, `${firstName(candidate)} travou de novo, mesmo com um capitão ao lado.`);
      return logLine(next, `${candidate.name} não conseguiu se soltar nem com ajuda.`, "bad");
    }
    default: {
      const followed = optionId === "captains" ? "captains" : "mine";
      const main = followed === "captains" ? context.captainsPick : context.yourPick;
      const other = followed === "captains" ? context.yourPick : context.captainsPick;
      const verdicts: Record<string, CandidateVerdict> = {};
      for (const id of context.candidateIds) verdicts[id] = main.includes(id) ? "strong" : other.includes(id) ? "promising" : "unclear";
      next = patchContext<SelectionDayContext>(next, { followed, verdicts });
      return logLine(next, followed === "captains" ? "A lista segue a recomendação dos capitães." : "A lista segue a sua leitura do dia.", "info");
    }
  }
}

/** Meia hora a mais de trabalho dos capitães: cansa um pouco a equipe. */
function payHours(state: GameState, hours: number): GameState {
  return { ...state, members: state.members.map((member) => (member.role === "captain" ? { ...member, motivation: clamp(member.motivation - hours * 0.4) } : member)) };
}

function summarize(state: GameState): EventSummary {
  const context = ctxOf(state);
  const lines: string[] = [];
  for (const group of context.groups) lines.push(`${group.name}: planador a ${group.gliderDistanceM?.toFixed(1) ?? "?"} m.`);
  if (context.frozeId) {
    const candidate = candidateOf(state, context.frozeId);
    if (candidate) lines.push(`${candidate.name} travou no desafio${context.secondChance ? " e ganhou uma segunda chance" : ""}.`);
  }
  const strong = context.candidateIds.filter((id) => context.verdicts[id] === "strong").map((id) => candidateOf(state, id)?.name).filter(Boolean);
  lines.push(strong.length ? `Lista de convidados (${context.followed === "captains" ? "capitães" : "sua leitura"}): ${strong.join(", ")}.` : "Ninguém se destacou.");
  const noted = context.candidateIds.reduce((sum, id) => sum + (context.notes[id]?.length ?? 0), 0);
  return {
    title: "Fim da dinâmica da seletiva",
    lines,
    points: null,
    damage: [],
    knowledge: [`${noted} anotações nas fichas dos candidatos.`],
    creditsSpent: 0
  };
}

/** Fechamento: as anotações e o parecer vão para as fichas; convidar continua sendo hire-candidate. */
function close(state: GameState): GameState {
  const context = ctxOf(state);
  const event = activeOf(state);
  const candidates = state.candidates.map((candidate) =>
    context.candidateIds.includes(candidate.id)
      ? {
          ...candidate,
          observations: [...(candidate.observations ?? []), ...(context.notes[candidate.id] ?? [])],
          verdict: context.verdicts[candidate.id] ?? "unclear"
        }
      : candidate
  );
  // A equipe sai animada de um dia bem conduzido; quem foi ouvido (capitães seguidos) ganha um pouco.
  const members = state.members.map((member) =>
    member.role === "captain" && context.followed === "captains" ? { ...member, motivation: clamp(member.motivation + S.captainsHeardBoost) } : member
  );
  return { ...state, candidates, members, clock: { ...state.clock, hours: Math.max(state.clock.hours, event.startsAtDay + 17) } };
}

export const selectionHandler: EventHandler = { run, decide, summarize, close };
