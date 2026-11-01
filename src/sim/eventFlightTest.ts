// Dia de ensaio de voo (Fase 7, S3; design §7.3). O ensaio agendado na Fase 5 (`schedule-flight-test`)
// vira evento na manhã do dia: viagem e chegada (risco de transporte), montagem e checagem, uma
// decolagem por carga planejada e desmontagem. Decisões: peça com folga na checagem, rajada de
// vento antes de uma decolagem e, depois de um dano, encerrar o dia ou seguir. Cada decolagem usa
// resolveFlight (o motor da competição) e gera FlightPlayback; o fechamento alimenta testLog,
// evidência do avião e conhecimento da equipe.

import { citeTest, damageParts, installedParts, missingPartsText, PART_TYPE_LABELS, playerFlightModel } from "./aircraft";
import { damagePlayerParts, playerUnloadSeconds, resolveFlight } from "./competition";
import { BALANCE } from "./content/balance";
import { findVenue } from "./content/testVenues";
import { activeOf, askDecision, drawer, logLine, needsCredits, option, patchContext, patchEvent, payCost, syncClock } from "./eventCore";
import type { EventHandler } from "./events";
import { FLEW, FLIGHT_VIDEO_DEADLINE, isHiredPilot, OUTCOME_TEXT, venueDensityAltitude, venueWeather } from "./flightTests";
import { partState, PART_STATE_LABELS } from "./parts";
import { densityAltitude } from "./scoring";
import { clamp, learn } from "./team";
import type {
  ActiveEvent,
  EventBlock,
  EventDecision,
  EventSummary,
  FlightPlayback,
  FlightTest,
  FlightTestContext,
  FlightTestTakeoff,
  GameState,
  Part,
  TestRecord
} from "./types";

const F = BALANCE.flightTests;

const ctxOf = (state: GameState) => activeOf(state).context as FlightTestContext;
const testOf = (state: GameState) => state.flightTests.find((item) => item.id === ctxOf(state).testId)!;
const venueOf = (state: GameState) => findVenue(testOf(state).venueId)!;

const installedList = (state: GameState): Part[] => Object.values(installedParts(state)).filter((part): part is Part => !!part);

function blocksFor(test: FlightTest): EventBlock[] {
  const venue = findVenue(test.venueId);
  const start = test.at - test.day * 24;
  const blocks: EventBlock[] = [
    { id: "travel", startsAt: start - F.callLeadHours, label: `Viagem até ${venue?.name ?? "o campo"}`, kind: "travel" },
    { id: "assembly", startsAt: start - F.callLeadHours + 1.5, label: "Montagem e checagem do avião", kind: "assembly" }
  ];
  test.payloadPlanKg.forEach((kg, index) => {
    blocks.push({ id: `takeoff-${index + 1}`, startsAt: start + index * F.intervalHours, label: `Decolagem ${index + 1} com ${kg.toFixed(1)} kg`, kind: "takeoff" });
  });
  blocks.push({ id: "teardown", startsAt: start + test.payloadPlanKg.length * F.intervalHours + 0.5, label: "Desmontagem e volta", kind: "teardown" });
  return blocks;
}

/** Abre o evento do ensaio agendado (chamada do dia). */
export function buildFlightTestEvent(state: GameState, test: FlightTest): ActiveEvent {
  const venue = findVenue(test.venueId);
  const context: FlightTestContext = {
    kind: "flight-test",
    testId: test.id,
    takeoffs: [],
    records: [],
    transportDamage: [],
    gustHandled: -1,
    gustMs: 0,
    pilotPenalty: 0,
    payloadCutKg: 0,
    delayHours: 0,
    loosePart: false,
    checkHandled: false,
    damageHandled: -1,
    endedEarly: false,
    creditsSpent: 0,
    lines: [],
    partsBefore: Object.fromEntries(installedList(state).map((part) => [part.id, part.condition]))
  };
  return {
    id: `event-${test.id}`,
    kind: "flight-test",
    title: `Ensaio de voo: ${venue?.name ?? test.venueId}`,
    venueId: test.venueId,
    entered: false,
    day: 1,
    totalDays: 1,
    startsAtDay: test.day * 24,
    blocks: blocksFor(test),
    blockIndex: 0,
    pendingDecision: null,
    log: [],
    summary: null,
    context
  };
}

const takeoffIndex = (event: ActiveEvent) => Number(event.blocks[event.blockIndex]!.id.replace("takeoff-", "")) - 1;

function addLine(state: GameState, text: string, tone: "info" | "good" | "bad" = "info"): GameState {
  const context = ctxOf(state);
  return logLine(patchContext<FlightTestContext>(state, { lines: [...context.lines, text] }), text, tone);
}

function run(state: GameState): { state: GameState; done: boolean } {
  const event = activeOf(state);
  const block = event.blocks[event.blockIndex]!;
  const test = testOf(state);
  const venue = venueOf(state);
  const context = ctxOf(state);
  let next = state;

  switch (block.kind) {
    case "travel": {
      next = logLine(next, `A van sai com ${test.crew.length + (isHiredPilot(test.pilot) ? 0 : 1)} ${test.crew.length === 0 && isHiredPilot(test.pilot) ? "pessoa" : "pessoas"} e o avião rumo a ${venue.name} (${venue.distanceKm} km).`);
      const rng = drawer(next);
      if (missingPartsText(next) === null && rng.roll() < venue.distanceKm * F.transportRiskPerKm) {
        const installed = installedList(next);
        const hit = installed[Math.floor(rng.roll() * installed.length)]!;
        const [min, max] = F.transportDamage;
        const amount = min + (max - min) * rng.roll();
        next = rng.commit(damageParts(next, new Set([hit.id]), () => amount));
        next = patchContext<FlightTestContext>(next, { transportDamage: [...context.transportDamage, hit.label] });
        next = addLine(next, `${hit.label} sacudiu na estrada e chegou danificada.`, "bad");
      } else {
        next = rng.commit(next);
        next = logLine(next, "A estrada foi tranquila: o avião chega inteiro.", "good");
      }
      return { state: next, done: true };
    }
    case "assembly": {
      if (context.checkHandled) return { state: next, done: true };
      next = patchContext<FlightTestContext>(next, { checkHandled: true });
      next = logLine(next, "A equipe descarrega, monta as asas e confere cada ponto de fixação.");
      const installed = installedList(next);
      const rng = drawer(next);
      const loose = installed.length > 0 && rng.roll() < F.looseChance ? [...installed].sort((a, b) => a.condition - b.condition)[0]! : null;
      next = rng.commit(next);
      if (!loose) return { state: logLine(next, "Checagem sem novidades.", "good"), done: true };
      const decision: EventDecision = {
        id: `loose-part:${loose.id}`,
        prompt: `Na checagem, ${loose.label.toLowerCase()} está com folga. O que fazer?`,
        options: [
          option("fix", "Trocar o parafuso e reapertar", "Gasta uma hora do dia e deixa a peça melhor.", { hours: F.looseFixHours, credits: F.looseFixCredits, risk: "none" }, needsCredits(next, F.looseFixCredits)),
          option("fly", "Voar assim mesmo", "Sem perder tempo, mas a folga aumenta o risco de dano em todas as decolagens.", { risk: "high" })
        ]
      };
      return { state: askDecision(next, decision), done: false };
    }
    case "takeoff": {
      const index = takeoffIndex(event);
      if (context.endedEarly) return { state: logLine(next, "Dia encerrado: esta decolagem não acontece."), done: true };
      const problem = missingPartsText(next);
      if (problem) {
        next = patchContext<FlightTestContext>(next, { endedEarly: true });
        return { state: addLine(next, index === 0 ? `Sem voo: ${problem}` : `Fim dos voos: ${problem}`, "bad"), done: true };
      }
      const at = test.at + index * F.intervalHours + context.delayHours;
      if (context.gustHandled < index) {
        const rng = drawer(next);
        const gusty = rng.roll() < F.gustChance;
        const [min, max] = F.gustMs;
        const gust = min + (max - min) * rng.roll();
        next = patchContext<FlightTestContext>(rng.commit(next), { gustHandled: index, gustMs: gusty ? Math.round(gust) : 0, pilotPenalty: 0, payloadCutKg: 0 });
        if (gusty) {
          const speed = Math.round(gust);
          next = logLine(next, `O vento virou para ${speed} m/s de través.`, "bad");
          const plan = test.payloadPlanKg[index]!;
          const decision: EventDecision = {
            id: "gust",
            prompt: `O vento virou para ${speed} m/s de través antes da decolagem ${index + 1}. O que fazer?`,
            options: [
              option("fly", "Voar agora", "A pilotagem sente a rajada: o risco de incidente sobe bastante.", { risk: "high" }),
              option("wait", "Esperar 30 min", "A rajada costuma passar, mas nem sempre. A equipe fica parada ao sol.", { hours: 0.5, risk: "low" }),
              option("reduce", "Tirar 1 kg da carga", "Avião mais leve segura melhor a rajada. O ponto da reta de previsão sai com menos carga.", { risk: "medium" }, plan < 1 ? "Não há 1 kg de carga para tirar." : undefined)
            ]
          };
          return { state: askDecision(next, decision), done: false };
        }
      }
      return { state: flyTakeoff(next, index, at), done: true };
    }
    case "teardown":
      return { state: logLine(next, "A equipe desmonta tudo, guarda o avião e volta para a oficina."), done: true };
    default:
      return { state: next, done: true };
  }
}

function flyTakeoff(state: GameState, index: number, at: number): GameState {
  const test = testOf(state);
  const venue = venueOf(state);
  const context = ctxOf(state);
  const weather = venueWeather(state.seed, venue, at);
  const hrho = densityAltitude(weather.temperatureK, weather.pressureHpa);
  const payloadKg = Math.max(0, test.payloadPlanKg[index]! - context.payloadCutKg);
  const skill = isHiredPilot(test.pilot) ? F.hiredPilot : (state.members.find((member) => member.id === (test.pilot as { memberId: string }).memberId)?.piloting ?? 0);
  const model = playerFlightModel(state)!;
  const flightModel = context.loosePart ? { ...model, condition: clamp(model.condition - F.looseConditionPenalty) } : model;
  let next = state;
  let rngState = state.rngState;
  const resolved = resolveFlight(flightModel, payloadKg, weather, Math.max(0, skill - context.pilotPenalty), playerUnloadSeconds(next), rngState);
  rngState = resolved.rngState;
  const flight = resolved.flight;
  const before = next;

  // Desgaste de cada decolagem; pouso duro e queda danificam como na competição.
  next = damageParts(next, new Set(installedList(next).map((part) => part.id)), () => F.wearPerTakeoff);
  let damagedParts: string[] = [];
  if (flight.outcome === "crash" || flight.outcome === "damage") {
    const damaged = damagePlayerParts({ ...next, rngState }, flight.outcome === "crash");
    next = damaged.state;
    rngState = damaged.state.rngState;
    damagedParts = damaged.labels;
  }
  next = { ...next, rngState };

  const playback: FlightPlayback = {
    battery: index + 1,
    teamName: next.teamName,
    payloadKg,
    densityAltitudeM: hrho,
    headwindMs: weather.headwindMs,
    ...flight,
    ...(damagedParts.length ? { damagedParts } : {}),
    venueId: venue.id
  };
  const takeoff: FlightTestTakeoff = { payloadKg, outcome: flight.outcome, densityAltitudeM: hrho, at, playback };
  const text = `Decolagem ${index + 1} com ${payloadKg.toFixed(1)} kg: ${OUTCOME_TEXT[flight.outcome]}.`;
  const record: TestRecord = {
    at,
    test: "flight",
    densityAltitudeM: hrho,
    ok: flight.outcome === "valid" || flight.outcome === "landing-out",
    summary: text,
    affectedParts: next.parts.filter((part) => before.parts.some((old) => old.id === part.id && part.condition < old.condition)).map((part) => part.label),
    // Ponto da reta de previsão: a carga que de fato voou nessa Hρ (11.6).
    payloadKg: FLEW.has(flight.outcome) ? payloadKg : null,
    playback,
    flightTestId: test.id
  };
  next = patchContext<FlightTestContext>(next, {
    takeoffs: [...context.takeoffs, takeoff],
    records: [...context.records, record],
    pilotPenalty: 0,
    payloadCutKg: 0
  });
  next = syncClock(next, at);
  const ok = flight.outcome === "valid";
  next = addLine(next, damagedParts.length ? `${text} Danos: ${damagedParts.join(", ")}.` : text, ok ? "good" : flight.outcome === "landing-out" ? "info" : "bad");

  // Depois de um dano: encerrar o dia ou seguir (só se ainda há decolagens e o avião ainda voa).
  const damaged = flight.outcome === "damage" || flight.outcome === "crash";
  const more = index < test.payloadPlanKg.length - 1;
  if (damaged && more) {
    if (missingPartsText(next) !== null) {
      next = patchContext<FlightTestContext>(next, { endedEarly: true });
      return addLine(next, "O avião não tem mais peças para voar: o dia termina aqui.", "bad");
    }
    next = patchContext<FlightTestContext>(next, { damageHandled: index });
    const decision: EventDecision = {
      id: "after-damage",
      prompt: `${flight.outcome === "crash" ? "O avião caiu" : "Pouso duro"} na decolagem ${index + 1}. Encerrar o dia ou seguir?`,
      options: [
        option("go", "Seguir com as decolagens", `Faltam ${test.payloadPlanKg.length - index - 1}. As peças já danificadas aguentam menos.`, { risk: "high" }),
        option("stop", "Encerrar o dia", "Guarda o avião e ainda leva o que já foi medido para o relatório.")
      ]
    };
    return askDecision(next, decision);
  }
  return next;
}

function decide(state: GameState, decision: EventDecision, optionId: string): GameState {
  let next = state;
  const context = ctxOf(state);
  if (decision.id.startsWith("loose-part:")) {
    const partId = decision.id.slice("loose-part:".length);
    const part = state.parts.find((item) => item.id === partId);
    if (optionId === "fix") {
      const cost = decision.options.find((item) => item.id === "fix")!.cost;
      next = payCost(next, cost, `Ensaio de voo: ${venueOf(next).name} (reaperto)`);
      next = patchContext<FlightTestContext>(next, { creditsSpent: context.creditsSpent + cost.credits });
      next = { ...next, parts: next.parts.map((item) => (item.id === partId ? { ...item, condition: clamp(item.condition + F.looseFixGain) } : item)) };
      return addLine(next, `${part?.label ?? "A peça"} reapertada: a folga some e o dia segue.`, "good");
    }
    next = patchContext<FlightTestContext>(next, { loosePart: true });
    return addLine(next, `${part?.label ?? "A peça"} segue com folga: a equipe vai voar assim.`, "bad");
  }
  if (decision.id === "gust") {
    const index = takeoffIndex(activeOf(next));
    if (optionId === "fly") {
      next = patchContext<FlightTestContext>(next, { pilotPenalty: F.gustPilotPenalty });
      return logLine(next, "Sem esperar: o piloto encara a rajada.", "info");
    }
    if (optionId === "wait") {
      const rng = drawer(next);
      const passed = rng.roll() < F.gustPassesChance;
      next = rng.commit(next);
      next = payCost(next, decision.options.find((item) => item.id === "wait")!.cost, "Espera do vento");
      next = patchContext<FlightTestContext>(next, { delayHours: context.delayHours + 0.5, pilotPenalty: passed ? 0 : F.gustPilotPenalty });
      return logLine(next, passed ? "Meia hora depois a rajada passou." : "Meia hora depois e o vento continua batendo.", passed ? "good" : "bad");
    }
    const cut = Math.min(1, testOf(next).payloadPlanKg[index]!);
    next = patchContext<FlightTestContext>(next, { payloadCutKg: cut, pilotPenalty: F.reducedLoadPenalty });
    return logLine(next, `A equipe tira ${cut.toFixed(0)} kg da carga e decola com o avião mais leve.`);
  }
  // after-damage
  if (optionId === "stop") {
    const event = activeOf(next);
    const teardown = event.blocks.find((block) => block.kind === "teardown")!;
    next = patchEvent(next, { blocks: [...event.blocks.slice(0, event.blockIndex), teardown] });
    next = patchContext<FlightTestContext>(next, { endedEarly: true });
    return addLine(next, "O dia termina aqui para guardar o avião.", "info");
  }
  return logLine(next, "A equipe segue para a próxima decolagem.");
}

function damageLabels(state: GameState): string[] {
  const context = ctxOf(state);
  return state.parts
    .filter((part) => context.partsBefore[part.id] !== undefined && part.condition < context.partsBefore[part.id]! - 0.5)
    .map((part) => `${PART_TYPE_LABELS[part.type]}: ${PART_STATE_LABELS[partState(part.condition)].toLowerCase()}`);
}

function summarize(state: GameState): EventSummary {
  const context = ctxOf(state);
  const venue = venueOf(state);
  const flew = context.takeoffs.filter((item) => FLEW.has(item.outcome)).length;
  const lines = context.lines.length ? [...context.lines] : ["Ensaio sem decolagens."];
  const knowledge = context.takeoffs.length
    ? ["Desempenho, Aerodinâmica e Estabilidade ganham conhecimento tácito para quem foi ao campo.", `${flew} ${flew === 1 ? "ponto novo entra" : "pontos novos entram"} na reta de previsão.`]
    : [];
  return { title: `Ensaio de voo: ${venue.name}`, lines, points: null, damage: damageLabels(state), knowledge, creditsSpent: context.creditsSpent };
}

/** Fechamento: o dia entra no histórico, a evidência estreita as estimativas e a equipe aprende. */
function close(state: GameState): GameState {
  const context = ctxOf(state);
  const test = testOf(state);
  const event = activeOf(state);
  let next = state;
  const takeoffs = context.takeoffs;
  const rng = drawer(next);

  // Ensaio feito: a opinião da equipe é sorteada de novo, mais perto do real (margem menor).
  if (next.aircraft && takeoffs.length) {
    const evidence = { emptyWeight: 0, payload: 0, takeoff: 0, stability: 0, ...(next.aircraft.evidence ?? {}) };
    for (const item of takeoffs) {
      const gain = FLEW.has(item.outcome) ? F.validEvidence : F.limitEvidence;
      evidence.payload += gain.payload;
      evidence.takeoff += gain.takeoff;
      evidence.stability += gain.stability;
    }
    const bias = { emptyWeight: 0, payload: 0, takeoff: 0, ...(next.aircraft.hidden.bias ?? {}) } as NonNullable<NonNullable<GameState["aircraft"]>["hidden"]["bias"]>;
    bias.payload = 2 * rng.roll() - 1;
    bias.takeoff = 2 * rng.roll() - 1;
    bias.stability = 2 * rng.roll() - 1;
    next = { ...next, aircraft: { ...next.aircraft, evidence, hidden: { ...next.aircraft.hidden, bias } } };
    next = citeTest(next, "flight");
  }

  const records = [...context.records];
  const lines = [...context.lines];
  // Voo filmado: vale como vídeo oficial com um voo limpo até 27/set.
  const clean = takeoffs.find((item) => item.outcome === "valid" || item.outcome === "landing-out");
  if (test.filmed && next.aircraft) {
    const inTime = test.at <= FLIGHT_VIDEO_DEADLINE;
    if (clean && inTime) {
      next = { ...next, aircraft: { ...next.aircraft, flightVideoAt: clean.at } };
      lines.push("Vídeo oficial gravado e enviado à Comissão Técnica.");
    } else {
      lines.push(clean ? "O voo foi bom, mas o prazo do vídeo (27/set) já passou: a CT não aceita." : "Nenhum voo limpo para o vídeo oficial.");
    }
    records.push({
      at: test.at,
      test: "video",
      densityAltitudeM: takeoffs[0]?.densityAltitudeM ?? venueDensityAltitude(next.seed, venueOf(next), test.at),
      ok: !!clean && inTime,
      summary: clean && inTime ? "Voo filmado válido." : "Voo filmado sem vídeo válido.",
      affectedParts: [],
      payloadKg: null,
      flightTestId: test.id
    });
  }

  // Conhecimento tácito para quem foi ao campo; o piloto integrante treina pilotagem.
  if (takeoffs.length) {
    const crew = new Set(test.crew);
    const pilotId = isHiredPilot(test.pilot) ? null : test.pilot.memberId;
    const hours = F.crewHours;
    next = {
      ...next,
      members: next.members.map((member) => {
        let updated = member;
        if (crew.has(member.id) || member.id === pilotId) {
          updated = {
            ...updated,
            knowledge: {
              ...updated.knowledge,
              performance: learn(updated.knowledge.performance, hours, F.knowledgePerHour),
              aerodynamics: learn(updated.knowledge.aerodynamics, hours, F.knowledgePerHour / 2),
              stability: learn(updated.knowledge.stability, hours, F.knowledgePerHour / 2)
            }
          };
        }
        if (member.id === pilotId) updated = { ...updated, piloting: learn(updated.piloting, hours, BALANCE.tests.pilotingPerHour) };
        return updated;
      })
    };
  }

  const done: FlightTest = {
    ...test,
    status: "done",
    takeoffs,
    densityAltitudeM: takeoffs[0]?.densityAltitudeM ?? null,
    transportDamage: context.transportDamage,
    summary: lines.join(" ") || null
  };
  next = rng.commit({
    ...next,
    testLog: [...next.testLog, ...records],
    flightTests: next.flightTests.map((item) => (item.id === test.id ? done : item))
  });
  return syncClock(next, event.startsAtDay + (event.blocks.at(-1)?.startsAt ?? 16) + 0.5);
}

export const flightTestHandler: EventHandler = { run, decide, summarize, close };
