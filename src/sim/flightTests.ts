// Ensaio de voo como evento (Fase 5, S2; design §7.3). A equipe marca local, dia, piloto,
// tripulação e cargas; paga adiantado; no dia o relógio pausa, o transporte pode danificar peça,
// o clima do local define a Hρ e cada carga vira uma decolagem resolvida por resolveFlight, o
// mesmo motor da competição. Os ensaios de bancada continuam tarefas da oficina (tasks.ts).

import { citeTest, damageParts, installedParts, missingPartsText, playerFlightModel } from "./aircraft";
import { COMPETITION_START, damagePlayerParts, playerUnloadSeconds, resolveFlight, weatherAt } from "./competition";
import { BALANCE } from "./content/balance";
import { OFFICIAL_CALENDAR } from "./content/season2026";
import { findVenue, type TestVenue } from "./content/testVenues";
import { REGULAR_2026 } from "./content/regulation2026";
import { recordLedger } from "./ledger";
import { nextRandom } from "./rng";
import { densityAltitude } from "./scoring";
import { addMessage, warn } from "./tasks";
import { canWork, learn } from "./team";
import { clockToDate, dateToHours } from "./time";
import type {
  Cost,
  FieldWeather,
  FlightOutcome,
  FlightPlayback,
  FlightTest,
  FlightTestPilot,
  FlightTestTakeoff,
  GameState,
  Part,
  PauseReason,
  TestRecord,
  UpcomingEvent,
  Weekday
} from "./types";

const F = BALANCE.flightTests;
const C = BALANCE.competition;
const R = REGULAR_2026;
const VIDEO_DEADLINE = dateToHours(OFFICIAL_CALENDAR.find((item) => item.id === "flight-video")!.date);

export interface ScheduleFlightTestRequest {
  venueId: string;
  /** Dia de jogo (Math.floor(horas / 24)). */
  day: number;
  pilot: FlightTestPilot;
  crew: string[];
  payloadPlanKg: number[];
  filmed?: boolean;
}

const isHired = (pilot: FlightTestPilot): pilot is { hired: true } => "hired" in pilot;
const weekdayOf = (day: number) => new Date(clockToDate(day * 24)).getUTCDay() as Weekday;
const today = (state: GameState) => Math.floor(state.clock.hours / 24);

/** Quem vai ao campo (piloto integrante + tripulação). */
function people(test: Pick<FlightTest, "pilot" | "crew">): string[] {
  return isHired(test.pilot) ? [...test.crew] : [test.pilot.memberId, ...test.crew];
}

/** ◆ adiantados de um ensaio: local + piloto contratado. */
export function flightTestCredits(venueId: string, pilot: FlightTestPilot): number {
  const venue = findVenue(venueId);
  return (venue?.cost ?? 0) + (isHired(pilot) ? F.hiredPilotCost : 0);
}

/**
 * Custo do ensaio no formato da casa (design §8): horas da tripulação no campo, ◆ adiantados,
 * antecedência mínima do local e risco (cresce com a estrada e com a carga mais alta planejada).
 */
export function flightTestCost(venueId: string, pilot: FlightTestPilot, crewSize: number): Cost {
  const venue = findVenue(venueId);
  const heads = crewSize + (isHired(pilot) ? 0 : 1);
  const transport = (venue?.distanceKm ?? 0) * F.transportRiskPerKm;
  return {
    hours: heads * F.crewHours,
    credits: flightTestCredits(venueId, pilot),
    leadDays: venue?.minLeadDays ?? 0,
    risk: transport >= 0.1 ? "high" : "medium"
  };
}

/** Clima do local na hora: o da região com a pressão do campo (Apêndice 4 dá a Hρ). */
export function venueWeather(seed: number, venue: TestVenue, hours: number): FieldWeather {
  const base = weatherAt(seed, hours);
  return { ...base, pressureHpa: venue.pressureHpa + (base.pressureHpa - C.weather.pressureHpa) };
}

/** Hρ do local na hora (Apêndice 4). */
export function venueDensityAltitude(seed: number, venue: TestVenue, hours: number): number {
  const weather = venueWeather(seed, venue, hours);
  return densityAltitude(weather.temperatureK, weather.pressureHpa);
}

/** Primeiro motivo de recusa do agendamento; null se pode marcar. */
export function scheduleProblem(state: GameState, request: ScheduleFlightTestRequest): string | null {
  const venue = findVenue(request.venueId);
  if (!venue) return "Local de ensaio desconhecido.";
  const missing = missingPartsText(state);
  if (missing) return `Avião incompleto para voar. ${missing}`;
  if (!Number.isInteger(request.day)) return "Escolha um dia do calendário.";
  if (request.day * 24 + F.startHour >= COMPETITION_START) return "Depois da competição não há ensaio de voo nesta temporada.";
  if (request.day - today(state) < venue.minLeadDays) {
    return `${venue.name} pede ${venue.minLeadDays} ${venue.minLeadDays === 1 ? "dia" : "dias"} de antecedência.`;
  }
  if (!venue.weekdays.includes(weekdayOf(request.day))) return `${venue.name} não recebe a equipe nesse dia da semana.`;
  const plan = request.payloadPlanKg;
  if (plan.length === 0 || plan.length > F.maxTakeoffs) return `Planeje de 1 a ${F.maxTakeoffs} decolagens.`;
  if (plan.some((kg) => !(kg >= 0) || kg > R.maxTakeoffWeight)) return `Cada carga precisa ficar entre 0 e ${R.maxTakeoffWeight} kg.`;
  if (request.crew.length === 0) return "Leve pelo menos uma pessoa na tripulação.";
  if (request.crew.length > F.maxCrew) return `A van leva no máximo ${F.maxCrew} pessoas na tripulação.`;
  const everyone = people(request);
  if (new Set(everyone).size !== everyone.length) return "A mesma pessoa não pode estar duas vezes no ensaio.";
  for (const id of everyone) {
    const member = state.members.find((item) => item.id === id);
    if (!member || !canWork(member)) return "Só integrantes da equipe vão ao campo.";
  }
  if (!isHired(request.pilot)) {
    const pilot = state.members.find((item) => item.id === (request.pilot as { memberId: string }).memberId)!;
    if (pilot.piloting < F.minPiloting) return `${pilot.name} ainda não pilota (pilotagem ${Math.round(pilot.piloting)}, mínimo ${F.minPiloting}). Contrate um piloto ou treine.`;
  }
  const busy = state.flightTests.filter((test) => test.status === "scheduled" && test.day === request.day);
  const clash = everyone.find((id) => busy.some((test) => people(test).includes(id)));
  if (clash) return `${state.members.find((item) => item.id === clash)!.name} já está em outro ensaio nesse dia.`;
  if (state.credits < flightTestCredits(request.venueId, request.pilot)) return "Caixa insuficiente para o local e o piloto.";
  return null;
}

/** Marca o ensaio e debita o que é pago adiantado (local e piloto contratado). */
export function scheduleFlightTest(state: GameState, request: ScheduleFlightTestRequest): GameState {
  const problem = scheduleProblem(state, request);
  if (problem) return warn(state, problem);
  const venue = findVenue(request.venueId)!;
  const credits = flightTestCredits(request.venueId, request.pilot);
  const test: FlightTest = {
    id: `flight-test-${state.nextId}`,
    venueId: venue.id,
    day: request.day,
    at: request.day * 24 + F.startHour,
    pilot: isHired(request.pilot) ? { hired: true } : { memberId: request.pilot.memberId },
    crew: [...request.crew],
    payloadPlanKg: [...request.payloadPlanKg],
    filmed: request.filmed ?? false,
    status: "scheduled",
    paidCredits: credits,
    scheduledAt: state.clock.hours,
    takeoffs: [],
    densityAltitudeM: null,
    transportDamage: [],
    summary: null
  };
  const next: GameState = { ...state, credits: state.credits - credits, nextId: state.nextId + 1, flightTests: [...state.flightTests, test] };
  return recordLedger(next, { credits: -credits, kind: "action", label: `Ensaio de voo: ${venue.name}` });
}

/** Desmarca um ensaio ainda não feito; devolve parte do que foi pago (refundShare). */
export function cancelFlightTest(state: GameState, testId: string): GameState {
  const test = state.flightTests.find((item) => item.id === testId);
  if (!test || test.status !== "scheduled") return warn(state, "Esse ensaio não está agendado.");
  const refund = Math.round(test.paidCredits * F.refundShare);
  const next: GameState = {
    ...state,
    credits: state.credits + refund,
    flightTests: state.flightTests.map((item) => (item.id === testId ? { ...item, status: "cancelled" as const } : item))
  };
  return refund > 0 ? recordLedger(next, { credits: refund, kind: "action", label: `Reembolso do ensaio: ${findVenue(test.venueId)?.name ?? test.venueId}` }) : next;
}

const OUTCOME_TEXT: Record<FlightOutcome, string> = {
  valid: "voo válido",
  "no-takeoff": "não decolou",
  "tape-break": "passou baixo no obstáculo",
  "landing-out": "pousou longo",
  damage: "pouso duro",
  crash: "caiu"
};

const FLEW: ReadonlySet<FlightOutcome> = new Set(["valid", "landing-out", "damage"]);

const changedLabels = (before: GameState, after: GameState) =>
  after.parts
    .filter((part) => {
      const old = before.parts.find((item) => item.id === part.id);
      return !!old && part.condition < old.condition;
    })
    .map((part) => part.label);

/** O dia do ensaio: transporte, decolagens, evidência, conhecimento, inbox. */
function runFlightTest(state: GameState, test: FlightTest): { state: GameState; messageId: string } {
  const venue = findVenue(test.venueId)!;
  let next = state;
  let rng = state.rngState;
  const roll = () => {
    const r = nextRandom(rng);
    rng = r.state;
    return r.value;
  };
  const lines: string[] = [];
  const transportDamage: string[] = [];

  // Transporte: a estrada pode danificar uma peça (design §7.3).
  if (missingPartsText(next) === null && roll() < venue.distanceKm * F.transportRiskPerKm) {
    const installed = Object.values(installedParts(next)).filter((part): part is Part => !!part);
    const hit = installed[Math.floor(roll() * installed.length)]!;
    const [min, max] = F.transportDamage;
    const amount = min + (max - min) * roll();
    next = damageParts(next, new Set([hit.id]), () => amount);
    transportDamage.push(hit.label);
    lines.push(`${hit.label} sacudiu na estrada e chegou danificada.`);
  }

  const pilotSkill = isHired(test.pilot) ? F.hiredPilot : (next.members.find((m) => m.id === (test.pilot as { memberId: string }).memberId)?.piloting ?? 0);
  const unload = playerUnloadSeconds(next);
  const evidence = { emptyWeight: 0, payload: 0, takeoff: 0, stability: 0, ...(next.aircraft?.evidence ?? {}) };
  const takeoffs: FlightTestTakeoff[] = [];
  const records: TestRecord[] = [];

  for (let i = 0; i < test.payloadPlanKg.length; i += 1) {
    const problem = missingPartsText(next);
    if (problem) {
      lines.push(i === 0 ? `Sem voo: ${problem}` : `Fim dos voos: ${problem}`);
      break;
    }
    const payloadKg = test.payloadPlanKg[i]!;
    const at = test.at + i * F.intervalHours;
    const weather = venueWeather(next.seed, venue, at);
    const hrho = densityAltitude(weather.temperatureK, weather.pressureHpa);
    const model = playerFlightModel(next)!;
    const resolved = resolveFlight(model, payloadKg, weather, pilotSkill, unload, rng);
    rng = resolved.rngState;
    const flight = resolved.flight;
    const before = next;

    // Desgaste de cada decolagem; pouso duro e queda danificam como na competição.
    const used = new Set(Object.values(installedParts(next)).filter((part): part is Part => !!part).map((part) => part.id));
    next = damageParts(next, used, () => F.wearPerTakeoff);
    let damagedParts: string[] = [];
    if (flight.outcome === "crash" || flight.outcome === "damage") {
      const damaged = damagePlayerParts({ ...next, rngState: rng }, flight.outcome === "crash");
      next = damaged.state;
      rng = damaged.state.rngState;
      damagedParts = damaged.labels;
    }

    const gain = FLEW.has(flight.outcome) ? F.validEvidence : F.limitEvidence;
    evidence.payload += gain.payload;
    evidence.takeoff += gain.takeoff;
    evidence.stability += gain.stability;

    const playback: FlightPlayback = {
      battery: i + 1,
      teamName: next.teamName,
      payloadKg,
      densityAltitudeM: hrho,
      headwindMs: weather.headwindMs,
      ...flight,
      ...(damagedParts.length ? { damagedParts } : {}),
      venueId: venue.id
    };
    takeoffs.push({ payloadKg, outcome: flight.outcome, densityAltitudeM: hrho, at, playback });
    const text = `Decolagem ${i + 1} com ${payloadKg.toFixed(1)} kg: ${OUTCOME_TEXT[flight.outcome]}.`;
    lines.push(damagedParts.length ? `${text} Danos: ${damagedParts.join(", ")}.` : text);
    records.push({
      at,
      test: "flight",
      densityAltitudeM: hrho,
      ok: flight.outcome === "valid" || flight.outcome === "landing-out",
      summary: text,
      affectedParts: changedLabels(before, next),
      // Ponto da reta de previsão: a carga que de fato voou nessa Hρ (11.6).
      payloadKg: FLEW.has(flight.outcome) ? payloadKg : null,
      playback,
      flightTestId: test.id
    });
    if (flight.outcome === "crash") break;
  }

  // Ensaio feito: a opinião da equipe é sorteada de novo, mais perto do real (margem menor).
  if (next.aircraft && takeoffs.length) {
    const bias = { emptyWeight: 0, payload: 0, takeoff: 0, ...(next.aircraft.hidden.bias ?? {}) };
    bias.payload = 2 * roll() - 1;
    bias.takeoff = 2 * roll() - 1;
    bias.stability = 2 * roll() - 1;
    next = { ...next, aircraft: { ...next.aircraft, evidence, hidden: { ...next.aircraft.hidden, bias } } };
    next = citeTest(next, "flight");
  }

  // Voo filmado: vale como vídeo oficial com um voo limpo até 27/set.
  const clean = takeoffs.find((item) => item.outcome === "valid" || item.outcome === "landing-out");
  if (test.filmed && next.aircraft) {
    const inTime = test.at <= VIDEO_DEADLINE;
    if (clean && inTime) {
      next = { ...next, aircraft: { ...next.aircraft, flightVideoAt: clean.at } };
      lines.push("Vídeo oficial gravado e enviado à Comissão Técnica.");
    } else {
      lines.push(clean ? "O voo foi bom, mas o prazo do vídeo (27/set) já passou: a CT não aceita." : "Nenhum voo limpo para o vídeo oficial.");
    }
    records.push({
      at: test.at,
      test: "video",
      densityAltitudeM: takeoffs[0]?.densityAltitudeM ?? venueDensityAltitude(next.seed, venue, test.at),
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
    const pilotId = isHired(test.pilot) ? null : test.pilot.memberId;
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

  const summary = lines.join(" ");
  const done: FlightTest = {
    ...test,
    status: "done",
    takeoffs,
    densityAltitudeM: takeoffs[0]?.densityAltitudeM ?? null,
    transportDamage,
    summary
  };
  next = {
    ...next,
    rngState: rng,
    testLog: [...next.testLog, ...records],
    flightTests: next.flightTests.map((item) => (item.id === test.id ? done : item))
  };
  const added = addMessage(next, { from: "Equipe", title: `Ensaio de voo: ${venue.name}`, body: summary || "Ensaio sem decolagens." });
  return { state: added.state, messageId: added.id };
}

/** Ensaios cujo horário cai neste passo do relógio; cada um pausa com "flight-test". */
export function advanceFlightTests(state: GameState, t0: number, t1: number): { state: GameState; pauses: { reason: PauseReason; messageId: string }[] } {
  const due = state.flightTests.filter((test) => test.status === "scheduled" && t0 < test.at && test.at <= t1);
  let next = state;
  const pauses: { reason: PauseReason; messageId: string }[] = [];
  for (const test of due) {
    const ran = runFlightTest(next, next.flightTests.find((item) => item.id === test.id)!);
    next = ran.state;
    pauses.push({ reason: "flight-test", messageId: ran.messageId });
  }
  return { state: next, pauses };
}

/** Próximos eventos (ensaios agendados e a competição), do mais próximo ao mais distante. */
export function upcomingEvents(state: GameState): UpcomingEvent[] {
  const now = state.clock.hours;
  const daysLeft = (at: number) => Math.max(0, Math.floor(at / 24) - Math.floor(now / 24));
  const events: UpcomingEvent[] = state.flightTests
    .filter((test) => test.status === "scheduled")
    .map((test) => ({
      kind: "flight-test" as const,
      id: test.id,
      at: test.at,
      title: `Ensaio de voo: ${findVenue(test.venueId)?.name ?? test.venueId}${test.filmed ? " (filmado)" : ""}`,
      daysLeft: daysLeft(test.at),
      venueId: test.venueId
    }));
  if (state.competition?.phase !== "finished") {
    events.push({ kind: "competition", id: "competition", at: COMPETITION_START, title: "Competição Aerodesign Brasil", daysLeft: daysLeft(COMPETITION_START) });
  }
  return events.sort((a, b) => a.at - b.at);
}
