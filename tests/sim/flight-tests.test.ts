import { describe, expect, it } from "vitest";
import {
  applyCommand,
  BALANCE,
  clockToDate,
  COMPETITION_START,
  DEFAULT_DESIGN,
  deserializeState,
  findVenue,
  serializeState,
  TEST_VENUES,
  testHistory,
  upcomingEvents,
  venueDensityAltitude,
  type Command,
  type GameState,
  type Part,
  type PartType
} from "../../src/sim";
import { playEvent, startedGame, TEST_START_HOURS } from "./helpers";

/** Dia de jogo de hoje no começo do teste. */
const TODAY = Math.floor(TEST_START_HOURS / 24);

const F = BALANCE.flightTests;
const PART_TYPES: PartType[] = ["wing", "fuselage", "tail", "landingGear", "powertrain", "electronics"];
const parts = (): Part[] => PART_TYPES.map((type) => ({ id: `p-${type}`, type, label: type, quality: 75, condition: 100 }));

function hangar(seed = 7): GameState {
  const game = applyCommand(startedGame({ seed, teamName: "T" }), { type: "set-design", design: DEFAULT_DESIGN });
  return { ...game, parts: parts(), credits: 1000 };
}

const weekday = (day: number) => new Date(clockToDate(day * 24)).getUTCDay();
const firstDay = (from: number, days: readonly number[]) => {
  let day = from;
  while (!days.includes(weekday(day))) day += 1;
  return day;
};

type Schedule = Extract<Command, { type: "schedule-flight-test" }>;
const request = (patch: Partial<Schedule> = {}): Schedule => ({
  type: "schedule-flight-test",
  venueId: "farm",
  day: TODAY + 5,
  pilot: { hired: true },
  crew: ["founder-marina"],
  payloadPlanKg: [6, 8],
  ...patch
});

/** Roda o relógio até a chamada do ensaio e joga o evento até o fechamento. */
function runUntilDone(state: GameState, testId: string, pick?: Parameters<typeof playEvent>[1]): GameState {
  let next = state;
  for (let i = 0; i < 500 && !next.activeEvent && next.flightTests.find((test) => test.id === testId)!.status === "scheduled"; i += 1) {
    next = applyCommand(applyCommand(next, { type: "set-speed", speed: 4 }), { type: "tick", realSeconds: 5 });
  }
  return next.activeEvent ? playEvent(next, pick) : next;
}

describe("locais de ensaio (S2)", () => {
  it("cada local tem custo, antecedência, dias, distância e Hρ típica coerente com o clima do campo", () => {
    expect(TEST_VENUES.length).toBeGreaterThanOrEqual(3);
    for (const venue of TEST_VENUES) {
      expect(venue.cost).toBeGreaterThan(0);
      expect(venue.weekdays.length).toBeGreaterThan(0);
      let total = 0;
      for (let day = 0; day < 120; day += 1) total += venueDensityAltitude(7, venue, day * 24 + F.startHour);
      expect(Math.abs(total / 120 - venue.typicalDensityAltitudeM)).toBeLessThan(60);
    }
  });
});

describe("agendar e cancelar ensaio de voo (S2)", () => {
  it("agendar debita local e piloto contratado, entra no extrato e nos próximos eventos", () => {
    const state = applyCommand(hangar(), request());
    expect(state.warning).toBeNull();
    const test = state.flightTests[0]!;
    expect(test.status).toBe("scheduled");
    expect(test.at).toBe((TODAY + 5) * 24 + F.startHour);
    const paid = findVenue("farm")!.cost + F.hiredPilotCost;
    expect(test.paidCredits).toBe(paid);
    expect(state.credits).toBe(1000 - paid);
    expect(state.ledger.at(-1)!.credits).toBe(-paid);
    const events = upcomingEvents(state);
    expect(events.map((event) => event.kind)).toEqual(["flight-test", "competition"]);
    expect(events[0]!.daysLeft).toBe(5);
    expect(events[1]!.at).toBe(COMPETITION_START);
  });

  it("recusa local, antecedência, dia da semana, caixa, piloto fraco, tripulação ocupada e plano inválido", () => {
    const base = hangar();
    const refused = (state: GameState, command: Schedule) => applyCommand(state, command).warning?.text ?? null;
    expect(refused(base, request({ venueId: "lua" }))).toContain("desconhecido");
    expect(refused(base, request({ venueId: "aeroclub", day: firstDay(TODAY + 1, [0, 6]) }))).toContain("antecedência");
    expect(refused(base, request({ venueId: "model-field", day: firstDay(TODAY + 10, [1, 2, 4, 5]) }))).toContain("dia da semana");
    expect(refused({ ...base, credits: 10 }, request())).toContain("Caixa");
    expect(refused(base, request({ pilot: { memberId: "founder-caio" } }))).toContain("não pilota");
    expect(refused(base, request({ crew: [] }))).toContain("equipe de campo");
    expect(refused(base, request({ payloadPlanKg: [] }))).toContain("decolagens");
    expect(refused(base, request({ payloadPlanKg: [25] }))).toContain("entre 0 e 20");
    expect(refused(base, request({ crew: ["ghost"] }))).toContain("integrantes");
    const once = applyCommand(base, request());
    expect(refused(once, request({ venueId: "farm" }))).toContain("já está em outro ensaio");
    expect(refused({ ...base, parts: [] }, request())).toContain("Avião incompleto");
    // Integrante treinado pode pilotar.
    const trained = { ...base, members: base.members.map((m) => (m.id === "founder-caio" ? { ...m, piloting: F.minPiloting } : m)) };
    expect(refused(trained, request({ pilot: { memberId: "founder-caio" } }))).toBeNull();
  });

  it("cancelar devolve parte do pago e tira dos próximos eventos", () => {
    const scheduled = applyCommand(hangar(), request());
    const id = scheduled.flightTests[0]!.id;
    const cancelled = applyCommand(scheduled, { type: "cancel-flight-test", testId: id });
    const paid = scheduled.flightTests[0]!.paidCredits;
    expect(cancelled.credits).toBe(scheduled.credits + Math.round(paid * F.refundShare));
    expect(cancelled.flightTests[0]!.status).toBe("cancelled");
    expect(upcomingEvents(cancelled).map((event) => event.kind)).toEqual(["competition"]);
    expect(applyCommand(cancelled, { type: "cancel-flight-test", testId: id }).warning?.text).toContain("não está agendado");
  });

  it("o ensaio agendado sobrevive ao save", () => {
    const scheduled = applyCommand(hangar(), request());
    expect(deserializeState(serializeState(scheduled))!.flightTests).toEqual(scheduled.flightTests);
  });
});

describe("o dia do ensaio (S2)", () => {
  it("pausa o relógio, resolve cada carga com o motor da competição e guarda pontos Hρ × carga", () => {
    const scheduled = applyCommand(hangar(), request({ payloadPlanKg: [5, 7, 9] }));
    const id = scheduled.flightTests[0]!.id;
    const state = runUntilDone(scheduled, id);
    expect(state.activeEvent).toBeNull();
    expect(state.clock.speed).toBe(0);
    expect(state.clock.hours).toBeGreaterThanOrEqual(scheduled.flightTests[0]!.at);
    const test = state.flightTests[0]!;
    expect(test.status).toBe("done");
    expect(test.takeoffs.length).toBeGreaterThan(0);
    expect(test.takeoffs.length).toBeLessThanOrEqual(3);
    expect(test.summary).toBeTruthy();
    test.takeoffs.forEach((takeoff, index) => {
      expect(takeoff.playback.venueId).toBe("farm");
      expect(takeoff.playback.battery).toBe(index + 1);
      expect(takeoff.playback.payloadKg).toBe(takeoff.payloadKg);
      expect(takeoff.at).toBeGreaterThanOrEqual(test.at + index * F.intervalHours - 1e-9);
    });
    const records = state.testLog.filter((record) => record.flightTestId === id);
    expect(records).toHaveLength(test.takeoffs.length);
    const flown = test.takeoffs.filter((takeoff) => ["valid", "landing-out", "damage"].includes(takeoff.outcome));
    expect(testHistory(state).points).toHaveLength(flown.length);
    expect(state.aircraft!.evidence!.payload).toBeGreaterThan(0);
    expect(state.aircraft!.evidence!.stability).toBeGreaterThan(0);
    expect(state.report.chapters.performance.testsCited).toBe(1);
    // Tripulação aprende; o piloto contratado não leva conhecimento para a equipe.
    const before = scheduled.members.find((m) => m.id === "founder-marina")!;
    const after = state.members.find((m) => m.id === "founder-marina")!;
    expect(after.knowledge.performance).toBeGreaterThan(before.knowledge.performance);
    expect(state.members.find((m) => m.id === "founder-caio")!.knowledge.performance).toBe(
      scheduled.members.find((m) => m.id === "founder-caio")!.knowledge.performance
    );
    // Peças desgastam.
    expect(Math.min(...state.parts.map((part) => part.condition))).toBeLessThan(100);
  });

  it("é determinístico pelo rngState", () => {
    const scheduled = applyCommand(hangar(11), request());
    const id = scheduled.flightTests[0]!.id;
    expect(runUntilDone(scheduled, id).flightTests).toEqual(runUntilDone(scheduled, id).flightTests);
  });

  it("piloto integrante treina pilotagem; queda encerra o dia", () => {
    const base = hangar();
    const trained = { ...base, members: base.members.map((m) => (m.id === "founder-caio" ? { ...m, piloting: 40 } : m)) };
    const scheduled = applyCommand(trained, request({ pilot: { memberId: "founder-caio" } }));
    const done = runUntilDone(scheduled, scheduled.flightTests[0]!.id);
    expect(done.members.find((m) => m.id === "founder-caio")!.piloting).toBeGreaterThan(40);
    // Carga muito acima da sustentação: estola e cai na primeira, o resto não voa.
    const heavy = applyCommand(hangar(), request({ payloadPlanKg: [16, 6] }));
    const crashed = runUntilDone(heavy, heavy.flightTests[0]!.id).flightTests[0]!;
    if (crashed.takeoffs[0]!.outcome === "crash") expect(crashed.takeoffs).toHaveLength(1);
    expect(["no-takeoff", "tape-break", "crash"]).toContain(crashed.takeoffs[0]!.outcome);
  });

  it("voo filmado com um voo limpo até 27/set vale como vídeo oficial", () => {
    let found = false;
    for (let seed = 1; seed < 30 && !found; seed += 1) {
      const scheduled = applyCommand(hangar(seed), request({ payloadPlanKg: [5], filmed: true }));
      const done = runUntilDone(scheduled, scheduled.flightTests[0]!.id);
      const takeoff = done.flightTests[0]!.takeoffs[0];
      if (takeoff && (takeoff.outcome === "valid" || takeoff.outcome === "landing-out")) {
        found = true;
        expect(done.aircraft!.flightVideoAt).toBe(takeoff.at);
        expect(done.testLog.some((record) => record.test === "video" && record.ok)).toBe(true);
      }
    }
    expect(found).toBe(true);
  });
});
