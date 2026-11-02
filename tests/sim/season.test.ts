// Fase 6, S1 e S4: temporada desde novembro, pré-temporada, regulamento e compatibilidade da data.

import { describe, expect, it } from "vitest";
import {
  ACADEMIC_PERIODS,
  academicFactor,
  applyCommand,
  BALANCE,
  clockToDate,
  createGame,
  dateToHours,
  DEFAULT_DESIGN,
  deserializeState,
  OFFICIAL_CALENDAR,
  PLAYER_TEAM_ID,
  REGULATION_DATE,
  REGULATION_HOURS,
  regulationPublished,
  SEASON_START,
  serializeState,
  type Command,
  type GameState
} from "../../src/sim";
import { foundedGame, startedGame } from "./helpers";

const run = (state: GameState, ...commands: Command[]): GameState => commands.reduce(applyCommand, state);
const at = (state: GameState, hours: number): GameState => ({ ...state, clock: { ...state.clock, hours } });
const utc = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day);

function play(state: GameState, days: number): GameState {
  const target = state.clock.hours + days * 24;
  let next = state;
  for (let guard = 0; guard < 10_000 && next.clock.hours < target - 1e-9; guard += 1) {
    if (next.clock.speed === 0) next = applyCommand(next, { type: "set-speed", speed: 1 });
    next = applyCommand(next, { type: "tick", realSeconds: ((target - next.clock.hours) * 10) / 24 });
  }
  return next;
}

describe("S1: relógio e calendário da temporada", () => {
  it("começa na seg 10/nov/2025 e o relógio converte datas a partir daí", () => {
    expect(SEASON_START).toBe(utc(2025, 11, 10));
    expect(new Date(SEASON_START).getUTCDay()).toBe(1);
    expect(clockToDate(0)).toBe(SEASON_START);
    expect(dateToHours(REGULATION_DATE)).toBe(91 * 24);
    expect(REGULATION_HOURS).toBe(91 * 24);
    expect(createGame({ seed: 1, teamName: "T" }).clock.hours).toBe(0);
  });

  it("tem os marcos da pré-temporada em ordem e as datas oficiais de 2026 intactas", () => {
    const ids = OFFICIAL_CALENDAR.map((item) => item.id);
    expect(ids.slice(0, 7)).toEqual(["founders", "selection", "trainee-start", "summer-break", "trainee-end", "regulation", "rev01"]);
    const sorted = [...OFFICIAL_CALENDAR].sort((a, b) => a.date - b.date).map((item) => item.id);
    expect(sorted).toEqual(ids);
    const date = (id: string) => OFFICIAL_CALENDAR.find((item) => item.id === id)!.date;
    expect(date("regulation")).toBe(utc(2026, 2, 9));
    expect(date("rev01")).toBe(utc(2026, 3, 1));
    expect(date("report")).toBe(utc(2026, 8, 16));
    expect(date("flight-video")).toBe(utc(2026, 9, 27));
    expect(date("oral")).toBe(utc(2026, 10, 17));
    expect(date("competition")).toBe(utc(2026, 10, 22));
  });

  it("cobre nov/2025 a nov/2026 com provas, férias de verão, Carnaval e férias de julho", () => {
    expect(academicFactor(utc(2025, 11, 10)).factor).toBe(1);
    expect(academicFactor(utc(2025, 11, 20))).toEqual({ factor: 0.4, label: "Provas" });
    expect(academicFactor(utc(2025, 12, 10))).toEqual({ factor: 0.4, label: "Provas" });
    for (const date of [utc(2025, 12, 20), utc(2026, 1, 15), utc(2026, 2, 9)]) {
      expect(academicFactor(date)).toEqual({ factor: BALANCE.season.summerFactor, label: "Férias de verão" });
    }
    expect(academicFactor(utc(2026, 2, 16)).label).toBe("Carnaval");
    expect(academicFactor(utc(2026, 2, 19)).factor).toBe(1);
    expect(academicFactor(utc(2026, 7, 10)).factor).toBe(1.6);
    expect(academicFactor(utc(2026, 11, 12)).factor).toBe(0.4);
    // Sem períodos sobrepostos.
    for (const a of ACADEMIC_PERIODS) for (const b of ACADEMIC_PERIODS) if (a !== b) expect(a.to < b.from || b.to < a.from).toBe(true);
  });

  it("marcos de pré-temporada avisam sem pausar; o regulamento pausa", () => {
    const selection = OFFICIAL_CALENDAR.find((item) => item.id === "selection")!;
    let game = at(foundedGame({ seed: 1, teamName: "T" }), dateToHours(selection.date) - 1);
    game = run(game, { type: "set-speed", speed: 1 }, { type: "tick", realSeconds: 1 });
    expect(game.clock.hours).toBeGreaterThan(dateToHours(selection.date));
    expect(game.clock.speed).toBe(1);
    expect(game.inbox.map((m) => m.title)).toContain(`Hoje: ${selection.title}`);

    game = at(foundedGame({ seed: 1, teamName: "T" }), REGULATION_HOURS - 1);
    game = run(game, { type: "set-speed", speed: 1 }, { type: "tick", realSeconds: 1 });
    expect(game.clock.speed).toBe(0);
    expect(game.pause?.reason).toBe("deadline-passed");
    expect(game.inbox.at(-1)!.title).toBe("Hoje: Regulamento 2026 publicado");
  });

  it("o processo seletivo só vale em novembro", () => {
    const november = foundedGame({ seed: 2, teamName: "T" });
    expect(run(november, { type: "start-action", actionId: "recruitment", targetId: "broad", memberIds: ["founder-marina"] }).tasks).toHaveLength(1);
    const december = at(november, dateToHours(utc(2025, 12, 2)));
    const refused = run(december, { type: "start-action", actionId: "recruitment", targetId: "broad", memberIds: ["founder-marina"] });
    expect(refused.tasks).toHaveLength(0);
    expect(refused.warning?.text).toContain("novembro");
  });
});

describe("S1: regulamento e Prancheta", () => {
  it("a Prancheta fica travada até 9/fev", () => {
    const before = foundedGame({ seed: 3, teamName: "T" });
    expect(regulationPublished(before)).toBe(false);
    const refused = run(before, { type: "set-design", design: DEFAULT_DESIGN });
    expect(refused.aircraft).toBeNull();
    expect(refused.warning?.text).toContain("Aguardando regulamento");
    const open = run(at(before, REGULATION_HOURS), { type: "set-design", design: DEFAULT_DESIGN });
    expect(regulationPublished(open)).toBe(true);
    expect(open.aircraft).not.toBeNull();
  });

  it("estudo, seletiva, captação e compras continuam permitidos antes de 9/fev", () => {
    let game = foundedGame({ seed: 3, teamName: "T" });
    const crew = ["founder-marina", "founder-caio", "founder-bia", "founder-rafa"];
    for (const [index, [actionId, targetId]] of ([["study-aero"], ["raffle"], ["outreach-social"], ["recruitment", "broad"]] as const).entries()) {
      game = run(game, { type: "start-action", actionId, targetId, memberIds: [crew[index]!] });
    }
    expect(game.tasks).toHaveLength(4);
    expect(game.warning).toBeNull();
  });

  it("read-regulation só sai depois de 9/fev, dá conhecimento conceitual e marca o regulamento como lido", () => {
    const before = foundedGame({ seed: 4, teamName: "T" });
    const refused = run(before, { type: "start-action", actionId: "read-regulation", memberIds: ["founder-marina"] });
    expect(refused.tasks).toHaveLength(0);
    expect(refused.warning?.text).toContain("9/fev");

    const marina = before.members.find((m) => m.id === "founder-marina")!;
    let game = run(at(before, REGULATION_HOURS), { type: "start-action", actionId: "read-regulation", memberIds: [marina.id] });
    expect(game.tasks).toHaveLength(1);
    // Uma leitura por vez.
    expect(run(game, { type: "start-action", actionId: "read-regulation", memberIds: ["founder-caio"] }).tasks).toHaveLength(1);
    for (let i = 0; i < 40 && game.tasks[0]!.status !== "done"; i += 1) game = play(game, 1);
    expect(game.tasks[0]!.status).toBe("done");
    expect(game.regulationRead).toBe(true);
    expect(game.members.find((m) => m.id === marina.id)!.knowledge.conceptual).toBeGreaterThan(marina.knowledge.conceptual);
    const again = run(game, { type: "start-action", actionId: "read-regulation", memberIds: [marina.id] });
    expect(again.warning?.text).toContain("já foi lido");
  });

  it("sem a leitura, a penalidade por alteração tardia de projeto na inspeção é maior", () => {
    const base = startedGame({ seed: 5, teamName: "T" });
    const designed = run(base, { type: "set-design", design: DEFAULT_DESIGN });
    const late = { ...designed, aircraft: { ...designed.aircraft!, lateChanges: 2 } };
    const penalty = (state: GameState) => run(state, { type: "dev-start-competition" }).competition!.penalties[PLAYER_TEAM_ID]!;
    expect(penalty({ ...late, regulationRead: true })).toBe(2 * BALANCE.competition.lateChangePenalty);
    expect(penalty({ ...late, regulationRead: false })).toBe(2 * BALANCE.competition.lateChangePenalty * BALANCE.season.unreadPenaltyFactor);
  });
});

describe("S4: o que dependia da data antiga continua funcionando", () => {
  it("dev-start-competition funciona na abertura (sem fundar) e numa equipe já fundada", () => {
    const fresh = run(createGame({ seed: 11, teamName: "T" }), { type: "dev-start-competition" });
    expect(fresh.founding).toBe(false);
    expect(fresh.competition).not.toBeNull();
    expect(fresh.aircraft).not.toBeNull();
    expect(fresh.members.some((m) => m.role === "president")).toBe(true);
    const started = run(startedGame({ seed: 11, teamName: "T" }), { type: "dev-start-competition" });
    expect(started.competition?.phase).toBe("inspection");
    expect(started.clock.hours).toBeGreaterThanOrEqual(dateToHours(utc(2026, 10, 22)));
    expect(started.activeEvent?.kind).toBe("competition");
  });

  it("o save tem a versão 9 e descarta o da versão 6", () => {
    const state = startedGame({ seed: 1, teamName: "X" });
    expect(state.version).toBe(9);
    expect(deserializeState(serializeState(state))).toEqual(state);
    expect(deserializeState(JSON.stringify({ ...state, version: 6 }))).toBeNull();
  });

  it("o relógio atravessa a pré-temporada até a competição sem travar", () => {
    let game = foundedGame({ seed: 8, teamName: "T" });
    game = play(game, 40);
    expect(game.clock.hours).toBeGreaterThanOrEqual(40 * 24 - 1e-6);
    expect(game.founding).toBe(false);
  });
});
