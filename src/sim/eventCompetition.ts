// Competição como evento de vários dias (Fase 7, S4; design §9). Dia 1: chegada, exposição,
// inspeção técnica e reunião; dias seguintes: briefing e janelas de voo de 2 h (fila, clima e
// rivais da Fase 3); último bloco: placar e premiação. Decisões: pendências da inspeção
// (corrigir agora ou aceitar a penalidade), a carga de cada bateria (a decisão do bloco, no
// lugar de set-battery-payload, que continua valendo para revisar) e o reparo entre baterias.

import { estimatePerformance, installedParts, PART_TYPE_LABELS, requiredParts } from "./aircraft";
import {
  blockingFindings,
  COMPETITION_START,
  finishCompetition,
  flySlot,
  inspectionFindings,
  MIN_TEAMS_AHEAD_TO_REVISE,
  playerPayload,
  SLOT_HOURS,
  standings,
  weatherAt
} from "./competition";
import { BALANCE } from "./content/balance";
import { REGULAR_2026 } from "./content/regulation2026";
import { activeOf, askDecision, logLine, needsCredits, option, patchContext, patchEvent, payCost, syncClock } from "./eventCore";
import type { EventHandler } from "./events";
import { OUTCOME_TEXT } from "./flightTests";
import { partState, PART_STATE_LABELS } from "./parts";
import { densityAltitude, predictedPayload } from "./scoring";
import { awardReputation } from "./season";
import { clamp, learn } from "./team";
import type { ActiveEvent, BatteryResult, CompetitionEventContext, EventBlock, EventDecision, EventSummary, GameState, Part, PartType } from "./types";
import { PLAYER_TEAM_ID } from "./types";

const C = BALANCE.competition;
const E = C.event;
const R = REGULAR_2026;

const ctxOf = (state: GameState) => activeOf(state).context as CompetitionEventContext;
const SLOTS_PER_BLOCK = E.flightBlockHours / SLOT_HOURS;

const AWARDS: EventBlock = { id: "awards", startsAt: C.windowEndHour, label: "Placar final e premiação", kind: "awards" };

/** Blocos de um dia da competição (day 1 = chegada e inspeção). */
export function competitionBlocks(day: number, totalDays: number): EventBlock[] {
  if (day === 1) {
    return [
      { id: "d1-arrival", startsAt: 8, label: "Chegada ao pátio da competição", kind: "arrival" },
      { id: "d1-exhibition", startsAt: 9, label: "Exposição do avião", kind: "exhibition" },
      { id: "d1-inspection", startsAt: 13, label: "Inspeção técnica de segurança", kind: "inspection" },
      { id: "d1-briefing", startsAt: 16.5, label: "Reunião técnica: fila da bateria 1", kind: "briefing" }
    ];
  }
  const blocks: EventBlock[] = [{ id: `d${day}-briefing`, startsAt: C.windowStartHour - 0.5, label: "Briefing de segurança e previsão do tempo", kind: "briefing" }];
  const count = Math.ceil((C.windowEndHour - C.windowStartHour) / E.flightBlockHours);
  for (let i = 0; i < count; i += 1) {
    const from = C.windowStartHour + i * E.flightBlockHours;
    blocks.push({ id: `d${day}-flights-${i + 1}`, startsAt: from, label: `Janela de voo ${String(from).padStart(2, "0")}h às ${String(from + E.flightBlockHours).padStart(2, "0")}h`, kind: "flights" });
  }
  if (day === totalDays) blocks.push({ ...AWARDS });
  return blocks;
}

/** Abre o evento da competição (chamada do dia 1). `state.competition` já existe. */
export function buildCompetitionEvent(state: GameState): ActiveEvent {
  const totalDays = 1 + C.flightDays;
  const context: CompetitionEventContext = {
    kind: "competition",
    nextSlot: null,
    inspectionHandled: [],
    creditsSpent: 0,
    partsBefore: Object.fromEntries(Object.values(installedParts(state)).filter((part): part is Part => !!part).map((part) => [part.id, part.condition])),
    lastPlayback: null,
    repairHandled: 0,
    knowledge: []
  };
  return {
    id: "event-competition",
    kind: "competition",
    title: "Competição Aerodesign Brasil",
    entered: false,
    day: 1,
    totalDays,
    startsAtDay: COMPETITION_START,
    blocks: competitionBlocks(1, totalDays),
    blockIndex: 0,
    pendingDecision: null,
    log: [],
    summary: null,
    context
  };
}

/** Garante o evento da competição aberto (dev-start-competition); a chamada pausa o relógio. */
export function ensureCompetitionEvent(state: GameState): GameState {
  if (!state.competition || state.competition.phase === "finished" || state.activeEvent) return state;
  return { ...state, activeEvent: buildCompetitionEvent(state) };
}

// ---------------------------------------------------------------------------
// Dia 1: chegada, exposição, inspeção e reunião
// ---------------------------------------------------------------------------

function inspectionDecision(state: GameState, id: "incomplete" | "no-video" | "counterfeit", text: string): EventDecision {
  const waivedNote = "A CT anota a pendência como penalidade no placar.";
  switch (id) {
    case "incomplete": {
      const fix = E.improviseParts;
      return {
        id: "inspect:incomplete",
        prompt: `Pendência da inspeção: ${text}`,
        options: [
          option("fix", "Improvisar as peças com a oficina móvel", `Peças de qualidade ${fix.quality}, feitas no pátio. Libera o voo.`, { hours: fix.hours, credits: fix.credits, risk: "medium" }, needsCredits(state, fix.credits)),
          option("skip", "Ficar de fora dos voos", "Sem as peças o avião não decola. A equipe acompanha as outras de fora.")
        ]
      };
    }
    case "no-video":
      return {
        id: "inspect:no-video",
        prompt: `Pendência da inspeção: ${text}`,
        options: [
          option("waive", "Pedir liberação condicional à CT", `Voa mesmo assim, com ${E.noVideoPenalty} pontos de penalidade. ${waivedNote}`, { risk: "medium" }),
          option("skip", "Aceitar ficar no chão", "Sem o vídeo a CT não libera. A equipe acompanha as outras de fora.")
        ]
      };
    case "counterfeit": {
      const fix = E.certifiedElectronics;
      return {
        id: "inspect:counterfeit",
        prompt: `Pendência da inspeção: ${text}`,
        options: [
          option("fix", "Comprar eletrônica certificada no pátio", "Um vendedor credenciado troca o componente na hora e a pendência some.", { hours: fix.hours, credits: fix.credits, risk: "low" }, needsCredits(state, fix.credits)),
          option("waive", "Voar assim, com penalidade", `${E.counterfeitPenalty} pontos no placar. A peça falsificada continua no avião. ${waivedNote}`, { risk: "high" })
        ]
      };
    }
  }
}

function runInspection(state: GameState): { state: GameState; done: boolean } {
  const context = ctxOf(state);
  let next = state;
  const findings = inspectionFindings(next);
  const pending = findings.find((finding) => !context.inspectionHandled.includes(finding.id));
  if (!pending) {
    const left = blockingFindings(next);
    next = left.length
      ? logLine(next, `Os fiscais fecham a inspeção. Sem liberação: ${left.map((item) => item.text).join(" ")}`, "bad")
      : logLine(next, "Os fiscais fecham a inspeção: avião liberado para voar.", "good");
    return { state: next, done: true };
  }
  if (pending.id === "no-aircraft") {
    next = patchContext<CompetitionEventContext>(next, { inspectionHandled: [...context.inspectionHandled, pending.id] });
    return { state: logLine(next, pending.text, "bad"), done: false };
  }
  next = logLine(next, `Os fiscais apontam: ${pending.text}`, "bad");
  return { state: askDecision(next, inspectionDecision(next, pending.id, pending.text)), done: false };
}

function decideInspection(state: GameState, decision: EventDecision, optionId: string): GameState {
  const id = decision.id.slice("inspect:".length) as "incomplete" | "no-video" | "counterfeit";
  const context = ctxOf(state);
  const chosen = decision.options.find((item) => item.id === optionId)!;
  let next = patchContext<CompetitionEventContext>(state, { inspectionHandled: [...context.inspectionHandled, id] });
  const competition = next.competition!;
  if (optionId === "skip") return logLine(next, "A equipe aceita ficar de fora dos voos.", "bad");
  next = payCost(next, chosen.cost, "Competição: inspeção técnica");
  next = patchContext<CompetitionEventContext>(next, { creditsSpent: context.creditsSpent + chosen.cost.credits });
  if (optionId === "waive") {
    const penalty = id === "no-video" ? E.noVideoPenalty : E.counterfeitPenalty;
    next = {
      ...next,
      competition: {
        ...competition,
        waivedIssues: [...(competition.waivedIssues ?? []), id],
        penalties: { ...competition.penalties, [PLAYER_TEAM_ID]: (competition.penalties[PLAYER_TEAM_ID] ?? 0) + penalty }
      }
    };
    return logLine(next, `Liberação condicional: ${penalty} pontos de penalidade no placar.`, "bad");
  }
  if (id === "counterfeit") {
    const old = installedParts(next).electronics;
    if (old) {
      const fresh: Part = { id: `part-${next.nextId}`, type: "electronics", label: old.label.replace(/ \(falsific.*\)$/, ""), quality: BALANCE.parts.purchasedQuality, condition: 100 };
      next = { ...next, nextId: next.nextId + 1, parts: [...next.parts.filter((part) => part.id !== old.id), fresh] };
    }
    return logLine(next, "A eletrônica certificada é instalada e a pendência some.", "good");
  }
  // incomplete: peças improvisadas para cada tipo que falta
  const have = installedParts(next);
  const missing = next.aircraft ? requiredParts(next.aircraft.design).filter((type: PartType) => !have[type]) : [];
  let nextId = next.nextId;
  const fresh: Part[] = missing.map((type) => ({ id: `part-${nextId++}`, type, label: PART_TYPE_LABELS[type], quality: E.improviseParts.quality, condition: 100 }));
  next = { ...next, nextId, parts: [...next.parts, ...fresh] };
  return logLine(next, `Peças improvisadas no pátio: ${fresh.map((part) => part.label.toLowerCase()).join(", ")}.`, "good");
}

// ---------------------------------------------------------------------------
// Dias de voo
// ---------------------------------------------------------------------------

function payloadDecision(state: GameState): EventDecision {
  const competition = state.competition!;
  const weather = competition.weather;
  const hrho = densityAltitude(weather.temperatureK, weather.pressureHpa);
  const line = state.report.payloadLine;
  const estimate = estimatePerformance(state, hrho);
  const base = clamp(line ? predictedPayload(line, hrho) : (estimate?.maxPayloadKg.value ?? R.minValidPayload), R.minValidPayload, R.maxTakeoffWeight);
  const round = (kg: number) => Math.round(clamp(kg, R.minValidPayload, R.maxTakeoffWeight) * 100) / 100;
  const margin = estimate ? ` O limite estimado hoje é ${estimate.maxPayloadKg.value.toFixed(1)} ± ${estimate.maxPayloadKg.margin.toFixed(1)} kg.` : "";
  const ahead = competition.queue.indexOf(PLAYER_TEAM_ID) - competition.queueIndex;
  const revise = ahead >= MIN_TEAMS_AHEAD_TO_REVISE ? ` Dá para revisar depois (${ahead} equipes à frente).` : " Depois disso a carga trava (R[10.1.5.3]).";
  return {
    id: "payload",
    prompt: `Bateria ${competition.battery}: com quanto você declara a carga? Hρ agora ${hrho.toFixed(0)} m, vento ${weather.headwindMs.toFixed(1)} m/s.${margin}`,
    options: [
      option(`line:${round(base)}`, `Seguir a previsão: ${round(base).toFixed(2)} kg`, `A carga da reta que a equipe entregou à CT.${revise}`, { risk: "medium" }),
      option(`bold:${round(base * E.boldShare)}`, `Subir a carga: ${round(base * E.boldShare).toFixed(2)} kg`, "Mais pontos se der certo; fica perto do limite do avião e a previsão erra.", { risk: "high" }),
      option(`safe:${round(base * E.safeShare)}`, `Aliviar a carga: ${round(base * E.safeShare).toFixed(2)} kg`, "Voo mais seguro, com menos pontos de carga.", { risk: "low" })
    ]
  };
}

function repairDecision(state: GameState, labels: string[]): EventDecision {
  const full = E.repairFull;
  const patch = E.repairPatch;
  return {
    id: "repair",
    prompt: `Seu voo deixou danos: ${labels.join(", ")}. Reparar antes da próxima bateria?`,
    options: [
      option("full", "Reparo completo no hangarete", `Leva as peças afetadas a ${full.to} de condição. Ocupa a equipe.`, { hours: full.hours, credits: full.credits, risk: "low" }, needsCredits(state, full.credits)),
      option("patch", "Remendo rápido", `Soma ${patch.gain} de condição nas peças afetadas, sem resolver tudo.`, { hours: patch.hours, credits: patch.credits, risk: "medium" }, needsCredits(state, patch.credits)),
      option("none", "Seguir sem reparar", "As peças danificadas aguentam menos na próxima bateria.", { risk: "high" })
    ]
  };
}

const playerResults = (state: GameState): BatteryResult[] => state.competition!.results.filter((result) => result.teamId === PLAYER_TEAM_ID);

function runFlights(state: GameState): { state: GameState; done: boolean } {
  const event = activeOf(state);
  const block = event.blocks[event.blockIndex]!;
  const blockStart = COMPETITION_START + (event.day - 1) * 24 + block.startsAt;
  const kStart = Math.round(blockStart / SLOT_HOURS);
  const kEnd = kStart + SLOTS_PER_BLOCK;
  let next = state;
  let k = Math.max(kStart, ctxOf(next).nextSlot ?? kStart);

  while (k < kEnd) {
    const competition = next.competition!;
    if (competition.phase === "finished") break;
    const playerAt = competition.queue.indexOf(PLAYER_TEAM_ID);
    // A carga é declarada quando a bateria abre e você está nela (e o avião está liberado).
    if (playerAt >= competition.queueIndex && competition.payloadDeclaredFor !== competition.battery && blockingFindings(next).length === 0) {
      next = patchContext<CompetitionEventContext>(next, { nextSlot: k });
      next = logLine(next, `Bateria ${competition.battery} aberta: ${competition.queue.length} equipes na fila, você é a ${playerAt - competition.queueIndex + 1}ª.`);
      return { state: askDecision(next, payloadDecision(next)), done: false };
    }
    const at = k * SLOT_HOURS;
    if (competition.phase === "inspection") next = { ...next, competition: { ...competition, phase: "flights" } };
    const resultsBefore = playerResults(next).length;
    const flown = flySlot(next, at);
    next = syncClock(flown.state, at);
    k += 1;
    next = patchContext<CompetitionEventContext>(next, { nextSlot: k });

    const mine = playerResults(next);
    const playerFlew = mine.length > resultsBefore;
    const finished = next.competition!.phase === "finished";
    if (playerFlew) {
      const result = mine.at(-1)!;
      const points = result.points ? `${result.points.total.toFixed(1)} pontos` : "sem pontuação";
      next = patchContext<CompetitionEventContext>(next, { lastPlayback: result.playback });
      next = logLine(next, `Seu voo na bateria ${result.battery} com ${result.payloadKg.toFixed(2)} kg: ${OUTCOME_TEXT[result.outcome]}, ${points}.`, result.outcome === "valid" ? "good" : result.outcome === "landing-out" ? "info" : "bad", at);
      const damaged = result.playback?.damagedParts ?? [];
      if (damaged.length && !finished) {
        next = patchContext<CompetitionEventContext>(next, { repairHandled: result.battery });
        next = askDecision(next, repairDecision(next, damaged));
      }
    } else if (flown.pending?.reason === "competition" && !finished && flown.state.inbox.at(-1)?.title.includes("não decolou")) {
      next = logLine(next, flown.state.inbox.at(-1)!.body, "bad", at);
    }

    if (finished) {
      const ev = activeOf(next);
      next = patchEvent(next, { blocks: [...ev.blocks.slice(0, ev.blockIndex + 1), { ...AWARDS, startsAt: block.startsAt + E.flightBlockHours }], totalDays: ev.day });
      return { state: next, done: true };
    }
    if (playerFlew) return { state: next, done: false };
  }
  return { state: next, done: true };
}

function decideFlights(state: GameState, decision: EventDecision, optionId: string): GameState {
  let next = state;
  const context = ctxOf(state);
  const chosen = decision.options.find((item) => item.id === optionId)!;
  if (decision.id === "payload") {
    const kg = Number(optionId.split(":")[1]);
    const competition = next.competition!;
    next = { ...next, competition: { ...competition, plannedPayloadKg: kg, payloadDeclaredFor: competition.battery } };
    return logLine(next, `Carga declarada para a bateria ${competition.battery}: ${kg.toFixed(2)} kg.`, "info");
  }
  // repair
  if (optionId === "none") return logLine(next, "A equipe segue sem reparar as peças afetadas.", "bad");
  next = payCost(next, chosen.cost, "Competição: reparo entre baterias");
  next = patchContext<CompetitionEventContext>(next, { creditsSpent: context.creditsSpent + chosen.cost.credits });
  const raise = (condition: number) => (optionId === "full" ? Math.max(condition, E.repairFull.to) : clamp(condition + E.repairPatch.gain));
  next = { ...next, parts: next.parts.map((part) => (part.condition < 80 && part.condition >= 0 ? { ...part, condition: raise(part.condition) } : part)) };
  return logLine(next, optionId === "full" ? "Reparo completo: as peças voltam a um bom estado." : "Remendo feito: dá para voar de novo.", "good");
}

// ---------------------------------------------------------------------------
// Motor
// ---------------------------------------------------------------------------

function run(state: GameState): { state: GameState; done: boolean } {
  const event = activeOf(state);
  const block = event.blocks[event.blockIndex]!;
  const competition = state.competition!;
  let next = state;

  switch (block.kind) {
    case "arrival":
      return { state: logLine(next, `${state.teamName} chega ao pátio da competição: tendas, caminhões e ${competition.queue.length} equipes montando os aviões.`), done: true };
    case "exhibition": {
      const stars = state.rivals.filter((team) => team.archetype !== null).slice(0, 3).map((team) => team.name);
      next = logLine(next, `Exposição aberta ao público e aos fiscais. No pátio: ${stars.join(", ")} e mais ${state.rivals.length - stars.length} equipes.`);
      return { state: next, done: true };
    }
    case "inspection":
      return runInspection(next);
    case "briefing": {
      if (event.day === 1) {
        const at = competition.queue.indexOf(PLAYER_TEAM_ID);
        next = patchContext<CompetitionEventContext>(next, { nextSlot: null });
        next = logLine(next, at >= 0 ? `Fila da bateria 1 sorteada: você é a ${at + 1}ª entre ${competition.queue.length}. Os voos começam amanhã às ${String(C.windowStartHour).padStart(2, "0")}h.` : "Sua equipe não está na fila da bateria 1.");
        return { state: next, done: true };
      }
      const dayStart = COMPETITION_START + (event.day - 1) * 24;
      const weather = weatherAt(state.seed, dayStart + C.windowStartHour);
      const hot = weatherAt(state.seed, dayStart + 15);
      const hr = (w: typeof weather) => densityAltitude(w.temperatureK, w.pressureHpa);
      next = { ...next, competition: { ...competition, weather } };
      next = logLine(next, `Previsão do dia: Hρ de ${hr(weather).toFixed(0)} m de manhã a ${hr(hot).toFixed(0)} m à tarde; vento de ${weather.headwindMs.toFixed(1)} m/s. Bateria ${competition.battery} em andamento.`);
      return { state: next, done: true };
    }
    case "flights":
      return runFlights(next);
    case "awards": {
      if (next.competition!.phase !== "finished") next = finishCompetition(next).state;
      const table = standings(next);
      const mine = table.find((row) => row.teamId === PLAYER_TEAM_ID)!;
      next = logLine(next, `${table[0]!.teamName} vence com ${table[0]!.total.toFixed(1)} pontos.`);
      next = logLine(next, `${state.teamName}: ${mine.position}º de ${table.length}, ${mine.total.toFixed(1)} pontos.`, mine.position <= 10 ? "good" : "info");
      return { state: next, done: true };
    }
    default:
      return { state: next, done: true };
  }
}

function decide(state: GameState, decision: EventDecision, optionId: string): GameState {
  return decision.id.startsWith("inspect:") ? decideInspection(state, decision, optionId) : decideFlights(state, decision, optionId);
}

function nextDay(state: GameState): GameState {
  const event = activeOf(state);
  const day = event.day + 1;
  const blocks = competitionBlocks(day, event.totalDays);
  let next = patchEvent(state, { day, blocks, blockIndex: 0 });
  next = patchContext<CompetitionEventContext>(next, { nextSlot: null });
  return logLine(next, `Fim do dia ${event.day}. Começa o dia ${day} da competição.`);
}

function summarize(state: GameState): EventSummary {
  const table = standings(state);
  const mine = table.find((row) => row.teamId === PLAYER_TEAM_ID)!;
  const context = ctxOf(state);
  const flights = playerResults(state);
  const valid = flights.filter((result) => result.points?.valid).length;
  const damage = state.parts
    .filter((part) => context.partsBefore[part.id] !== undefined && part.condition < context.partsBefore[part.id]! - 0.5)
    .map((part) => `${PART_TYPE_LABELS[part.type]}: ${PART_STATE_LABELS[partState(part.condition)].toLowerCase()}`);
  const fakes = state.parts.filter((part) => part.counterfeit).map((part) => part.label);
  return {
    title: "Fim da Competição Aerodesign Brasil",
    lines: [
      `${table[0]!.teamName} venceu com ${table[0]!.total.toFixed(1)} pontos.`,
      `${state.teamName} ficou em ${mine.position}º de ${table.length}, com ${mine.total.toFixed(1)} pontos (melhor bateria ${mine.bestBattery.toFixed(1)}, projeto ${mine.project.toFixed(1)}${mine.penalties ? `, penalidades ${mine.penalties.toFixed(1)}` : ""}).`,
      `Você voou ${flights.length} ${flights.length === 1 ? "bateria" : "baterias"}, ${valid} válidas.`,
      ...(fakes.length ? [`Relatório final da CT: peças fora da especificação no hangar (${fakes.join(", ")}).`] : [])
    ],
    points: mine.total,
    damage,
    knowledge: flights.length ? ["Desempenho e Estabilidade ganham conhecimento tácito com as baterias voadas."] : [],
    creditsSpent: context.creditsSpent
  };
}

function close(state: GameState): GameState {
  const event = activeOf(state);
  const table = standings(state);
  const position = table.find((row) => row.teamId === PLAYER_TEAM_ID)?.position ?? table.length;
  let next = awardReputation(state, BALANCE.advisor.competitionBase + (table.length - position) * BALANCE.advisor.competitionPerPlaceFromLast);
  const hours = playerResults(next).length * E.knowledgeHoursPerFlight;
  if (hours > 0) {
    next = {
      ...next,
      members: next.members.map((member) => ({
        ...member,
        knowledge: {
          ...member.knowledge,
          performance: learn(member.knowledge.performance, hours, BALANCE.knowledge.perHour),
          stability: learn(member.knowledge.stability, hours, BALANCE.knowledge.perHour / 2)
        }
      }))
    };
  }
  return syncClock(next, COMPETITION_START + (event.day - 1) * 24 + C.windowEndHour + 0.5);
}

export const competitionHandler: EventHandler = { run, decide, nextDay, summarize, close };
