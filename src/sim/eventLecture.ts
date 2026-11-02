// Palestra de apresentação como evento (fase-9.md, ajustes do playtest; design §5.2). Na data marcada
// (e com a triagem enviada) a campanha sorteia quem veio e abre o evento: recepção, apresentação da
// equipe, como funciona o processo, perguntas da plateia e o encerramento com a chamada para a dinâmica.
// Duas decisões leves (o que destacar e como responder) mexem na motivação escondida de quem veio.

import { hasHistory } from "./content/applicantPhrases";
import { BALANCE } from "./content/balance";
import { activeOf, askDecision, logLine, option, patchContext } from "./eventCore";
import type { EventHandler } from "./events";
import { dayLabel, drawLecture } from "./selection";
import { addMessage } from "./tasks";
import { clamp } from "./team";
import type { ActiveEvent, EventBlock, EventDecision, EventSummary, GameState, SelectionLectureContext } from "./types";

const L = BALANCE.selection.lecture;

const BLOCKS: EventBlock[] = [
  { id: "reception", startsAt: 18.5, label: "Recepção dos inscritos", kind: "reception" },
  { id: "presentation", startsAt: 19, label: "Apresentação da equipe", kind: "presentation" },
  { id: "process", startsAt: 19.5, label: "Como funciona o processo", kind: "process" },
  { id: "questions", startsAt: 20, label: "Perguntas da plateia", kind: "questions" },
  { id: "closing", startsAt: 20.5, label: "Encerramento", kind: "closing" }
];

const ctxOf = (state: GameState) => activeOf(state).context as SelectionLectureContext;

/** Abre a palestra: sorteia a presença (a campanha vai para a dinâmica) e monta o evento. */
export function buildLectureEvent(state: GameState): { state: GameState; event: ActiveEvent } {
  const drawn = drawLecture(state);
  const context: SelectionLectureContext = { kind: "selection-lecture", attendeeIds: drawn.attendeeIds, registered: drawn.total, highlight: null, answer: null, mood: 0 };
  const event: ActiveEvent = {
    id: `event-lecture-${state.nextId}`,
    kind: "selection-lecture",
    title: "Palestra de apresentação da seletiva",
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
  return { state: drawn.state, event };
}

function run(state: GameState): { state: GameState; done: boolean } {
  const event = activeOf(state);
  const block = event.blocks[event.blockIndex]!;
  const context = ctxOf(state);
  const campaign = state.selection;
  let next = state;
  switch (block.kind) {
    case "reception":
      next = logLine(next, `${context.attendeeIds.length} de ${context.registered} inscritos vieram. Os capitães recebem na porta e o auditório vai enchendo.`);
      return { state: next, done: true };
    case "presentation": {
      if (context.highlight === null) {
        const decision: EventDecision = {
          id: "highlight",
          prompt: "Os fundadores vão apresentar a equipe. O que destacar?",
          options: [
            option("project", "O projeto e a competição", "O avião, a competição e o desafio técnico. Anima quem já está empolgado."),
            option("community", "A convivência", "O grupo, a oficina e o time. Aproxima quem estava mais tímido."),
            option("cv", "O currículo e o estágio", "O que a equipe abre depois de formado. Convence quem estava em dúvida, mas esfria os mais empolgados.")
          ]
        };
        return { state: askDecision(next, decision), done: false };
      }
      next = logLine(
        next,
        hasHistory(next)
          ? "Os fundadores mostram o hangar, as fotos da última competição e o que cada área faz."
          : "Os fundadores mostram o hangar ainda novo, o que cada área vai fazer e o plano para a primeira competição."
      );
      return { state: next, done: true };
    }
    case "process": {
      const dynamic = campaign?.dynamicDayAt ?? null;
      next = logLine(
        next,
        `Como funciona: uma dinâmica em grupos${dynamic === null ? "" : ` em ${dayLabel(dynamic)}`}, depois entrevistas com os capitães e só então a aprovação. Quem for chamado recebe aviso; nem todos seguem.`
      );
      return { state: next, done: true };
    }
    case "questions": {
      if (context.answer === null) {
        const decision: EventDecision = {
          id: "answer",
          prompt: "Alguém pergunta quanto tempo a equipe exige por semana. Como responder?",
          options: [
            option("honest", "Falar a verdade", "Várias tardes e noites por semana. Assusta quem estava morno, mas quem fica vem de verdade."),
            option("sell", "Mostrar o lado bom", "Falar da oficina, do avião e dos amigos, sem insistir na carga. Anima os mornos; os mais sérios estranham.")
          ]
        };
        return { state: askDecision(next, decision), done: false };
      }
      return { state: next, done: true };
    }
    case "closing": {
      const when = campaign?.dynamicDayAt != null ? ` (${dayLabel(campaign.dynamicDayAt)}, ${BALANCE.selectionDay.startHour}h)` : "";
      next = logLine(next, `Encerramento: os capitães lembram a chamada para a dinâmica${when}.`);
      return { state: next, done: true };
    }
    default:
      return { state: next, done: true };
  }
}

/** Empurra a motivação de quem veio conforme o perfil (pouco, médio ou muito motivado). */
function nudge(state: GameState, delta: { low: number; mid: number; high: number }): GameState {
  const campaign = state.selection;
  if (!campaign) return state;
  const context = ctxOf(state);
  const ids = new Set(context.attendeeIds);
  let sum = 0;
  const applicants = campaign.applicants.map((applicant) => {
    if (!ids.has(applicant.id)) return applicant;
    const m = applicant.profile.motivation;
    const change = m < L.lowBelow ? delta.low : m >= L.highFrom ? delta.high : delta.mid;
    sum += change;
    return { ...applicant, profile: { ...applicant.profile, motivation: clamp(m + change) } };
  });
  return patchContext<SelectionLectureContext>({ ...state, selection: { ...campaign, applicants } }, { mood: context.mood + sum });
}

function decide(state: GameState, decision: EventDecision, optionId: string): GameState {
  let next = state;
  if (decision.id === "highlight") {
    const effect = {
      project: { low: L.projectLow, mid: Math.round((L.projectLow + L.projectHigh) / 2), high: L.projectHigh },
      community: { low: L.communityLow, mid: Math.round((L.communityLow + L.communityHigh) / 2), high: L.communityHigh },
      cv: { low: L.cvLow, mid: 1, high: L.cvHigh }
    }[optionId as "project" | "community" | "cv"];
    next = nudge(next, effect);
    next = patchContext<SelectionLectureContext>(next, { highlight: optionId });
    const line =
      optionId === "project"
        ? "A apresentação puxa para o projeto e a competição: a plateia se anima."
        : optionId === "community"
          ? "A apresentação puxa para o grupo e a oficina: o clima fica acolhedor."
          : "A apresentação puxa para o currículo e o estágio: parte da plateia se convence.";
    return logLine(next, line);
  }
  const effect = optionId === "honest" ? { low: L.honestLow, mid: 0, high: L.honestHigh } : { low: L.sellLow, mid: 1, high: L.sellHigh };
  next = nudge(next, effect);
  next = patchContext<SelectionLectureContext>(next, { answer: optionId });
  return logLine(next, optionId === "honest" ? "A resposta é franca sobre a carga de trabalho: murmúrio na sala e olhares sérios." : "A resposta fala do lado bom da equipe: risadas e mais perguntas.");
}

/** Clima da plateia pela média do empurrão por pessoa. */
export function lectureMood(context: Pick<SelectionLectureContext, "attendeeIds" | "mood">): string {
  const average = context.attendeeIds.length === 0 ? 0 : context.mood / context.attendeeIds.length;
  return average >= L.moodWarm ? "animada" : average >= L.moodOk ? "receptiva" : "morna";
}

function summarize(state: GameState): EventSummary {
  const context = ctxOf(state);
  return {
    title: "Fim da palestra de apresentação",
    lines: [
      `${context.attendeeIds.length} de ${context.registered} inscritos vieram. Quem faltou saiu do processo.`,
      `Clima da plateia: ${lectureMood(context)}.`,
      "Triar a planilha e enviar a avaliação ao presidente abre a dinâmica."
    ],
    points: null,
    damage: [],
    knowledge: [],
    creditsSpent: 0
  };
}

function close(state: GameState): GameState {
  const context = ctxOf(state);
  const event = activeOf(state);
  const campaign = state.selection;
  const when = campaign?.dynamicDayAt != null ? `A dinâmica é ${dayLabel(campaign.dynamicDayAt)} às ${BALANCE.selectionDay.startHour}h.` : "";
  const next = addMessage(state, {
    from: "Equipe",
    title: "Palestra de apresentação",
    body: `${context.attendeeIds.length} de ${context.registered} vieram; clima ${lectureMood(context)}. ${when} Marque na planilha quem você quer ver lá e envie a avaliação ao presidente.`
  }).state;
  return { ...next, clock: { ...next.clock, hours: Math.max(next.clock.hours, event.startsAtDay + 21) } };
}

export const lectureHandler: EventHandler = { run, decide, summarize, close };
