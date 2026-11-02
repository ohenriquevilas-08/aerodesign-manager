// Fase 8, S4 e S5: energia por aluno e alunos não determinados.

import { describe, expect, it } from "vitest";
import {
  APTITUDE_LABELS,
  applyCommand,
  BALANCE,
  createGame,
  DEFAULT_ADVISOR_NAME,
  DISCIPLINES,
  drawPreferences,
  energyFactor,
  energyOutlook,
  energyRecoveryPerHour,
  isAptitudeRevealed,
  isOverloaded,
  memberHoursPerDay,
  revealAptitude,
  type Command,
  type Discipline,
  type GameState,
  type Member
} from "../../src/sim";
import { FOUNDERS } from "../../src/sim/content/founders";
import { approveApplicants } from "../../src/sim/selection";
import { foundedGame, startedGame, withApplicants } from "./helpers";

const run = (state: GameState, ...commands: Command[]): GameState => commands.reduce(applyCommand, state);
const member = (state: GameState, id: string): Member => state.members.find((item) => item.id === id)!;
const lastTask = (state: GameState) => state.tasks[state.tasks.length - 1]!;

function until(state: GameState, done: (s: GameState) => boolean, maxHours = 24 * 120): GameState {
  let next: GameState = { ...state, clock: { ...state.clock, speed: 1 }, pause: null };
  for (let i = 0; i < maxHours && !done(next); i += 1) {
    next = applyCommand(next, { type: "tick", realSeconds: 10 / 24 });
    if (next.clock.speed === 0) next = { ...next, clock: { ...next.clock, speed: 1 }, pause: null };
  }
  return next;
}

const patch = (state: GameState, id: string, change: Partial<Member>): GameState => ({
  ...state,
  members: state.members.map((item) => (item.id === id ? { ...item, ...change } : item))
});

/** Oficina com escala dada para os integrantes; sem aulas. */
function withShifts(state: GameState, ids: string[], shifts: ("morning" | "afternoon" | "overnight")[]): GameState {
  const schedule: GameState["workshop"]["schedule"] = {};
  for (let day = 0; day <= 6; day += 1) for (const shift of shifts) schedule[`${day as 0}-${shift}`] = ids;
  return {
    ...state,
    members: state.members.map((item) => ({ ...item, classSlots: [] })),
    workshop: { ...state.workshop, keyHolders: ids, schedule }
  };
}

describe("S4: energia por aluno", () => {
  it("todo aluno começa com energia cheia e não existe mais workStreakHours", () => {
    const game = createGame({ seed: 3, teamName: "T" });
    expect(game.members.every((item) => item.energy === BALANCE.energy.start)).toBe(true);
    expect(game.members.some((item) => "workStreakHours" in item)).toBe(false);
  });

  it("energyFactor: cheio acima do limite de cansaço, cai até o de exaustão e zera abaixo", () => {
    const e = BALANCE.energy;
    expect(energyFactor(100)).toBe(1);
    expect(energyFactor(e.tiredBelow)).toBe(1);
    expect(energyFactor(e.exhaustedBelow)).toBeCloseTo(e.factorAtExhausted);
    expect(energyFactor((e.tiredBelow + e.exhaustedBelow) / 2)).toBeGreaterThan(e.factorAtExhausted);
    expect(energyFactor(e.exhaustedBelow - 1)).toBe(0);
    const tired = member(startedGame({ seed: 1, teamName: "T" }), "founder-marina");
    const date = Date.UTC(2026, 1, 19);
    expect(memberHoursPerDay({ ...tired, energy: 30 }, date)).toBeLessThan(memberHoursPerDay({ ...tired, energy: 100 }, date));
    expect(memberHoursPerDay({ ...tired, energy: 5 }, date)).toBe(0);
    expect(isOverloaded({ energy: 30 })).toBe(true);
    expect(isOverloaded({ energy: 80 })).toBe(false);
  });

  it("dormir e o fim de semana recuperam mais do que ficar acordado em dia útil", () => {
    const monday = Date.UTC(2026, 1, 16);
    const hoursMondayNoon = (monday - Date.UTC(2025, 10, 10)) / 3_600_000 + 12;
    const hoursMondayNight = hoursMondayNoon + 12;
    const hoursSaturdayNoon = hoursMondayNoon + 5 * 24;
    expect(energyRecoveryPerHour(hoursMondayNight)).toBeGreaterThan(energyRecoveryPerHour(hoursMondayNoon));
    expect(energyRecoveryPerHour(hoursSaturdayNoon)).toBeGreaterThan(energyRecoveryPerHour(hoursMondayNoon));
  });

  it("trabalhar gasta energia; parado, ela volta", () => {
    let state = run(startedGame({ seed: 4, teamName: "T" }), { type: "start-action", actionId: "report-chapter", targetId: "performance", memberIds: ["founder-marina"] });
    state = patch(state, "founder-marina", { energy: 70 });
    const worked = until(state, (s) => s.clock.hours >= state.clock.hours + 24);
    const marina = member(worked, "founder-marina").energy;
    const bia = member(worked, "founder-bia").energy;
    expect(marina).toBeLessThan(100);
    expect(bia).toBe(100);
    // Parada (tarefa encerrada), sobe de novo.
    const rested = until(run(worked, { type: "close-task", taskId: lastTask(worked).id }), (s) => s.clock.hours >= worked.clock.hours + 48);
    expect(member(rested, "founder-marina").energy).toBeGreaterThan(marina);
  });

  it("semana pesada de madrugada derruba a energia e o fim de semana devolve", () => {
    const base = startedGame({ seed: 5, teamName: "T" });
    const ids = ["founder-caio", "founder-marina"];
    // Segunda a sexta de madrugada na bancada.
    let state = withShifts({ ...base, credits: 5000, stock: { balsa: 4 } }, ids, ["overnight"]);
    state = run(state, { type: "start-action", actionId: "build-wing", memberIds: ids });
    const start = member(state, "founder-caio").energy;
    const heavy = until(state, (s) => s.clock.hours >= state.clock.hours + 24 * 5);
    expect(member(heavy, "founder-caio").energy).toBeLessThan(start - 20);
    // Quem virou a noite vive com pouca energia: rende menos horas por dia.
    expect(memberHoursPerDay(member(heavy, "founder-caio"), Date.UTC(2026, 1, 23))).toBeLessThanOrEqual(memberHoursPerDay(member(state, "founder-caio"), Date.UTC(2026, 1, 23)));
    const low = member(heavy, "founder-caio").energy;
    const restedState = until(run(heavy, { type: "close-task", taskId: lastTask(heavy).id }), (s) => s.clock.hours >= heavy.clock.hours + 48);
    expect(member(restedState, "founder-caio").energy).toBeGreaterThan(low + 20);
  });

  it("a madrugada gasta mais energia que o turno de dia pelo mesmo número de horas", () => {
    const base = startedGame({ seed: 6, teamName: "T" });
    const ids = ["founder-caio", "founder-marina"];
    const energyAfter = (shift: "afternoon" | "overnight") => {
      let state = withShifts({ ...base, credits: 5000, stock: { balsa: 4 } }, ids, [shift]);
      state = run(state, { type: "start-action", actionId: "build-wing", memberIds: ids });
      const end = until(state, (s) => s.clock.hours >= state.clock.hours + 24 * 3);
      const worked = member(end, "founder-caio");
      return { energy: worked.energy, hours: end.tasks[0]!.contributions["founder-caio"] ?? 0 };
    };
    const day = energyAfter("afternoon");
    const night = energyAfter("overnight");
    const lossPerHour = (sample: { energy: number; hours: number }) => (100 - sample.energy) / Math.max(sample.hours, 1e-9);
    expect(night.hours).toBeGreaterThan(0);
    expect(lossPerHour(night)).toBeGreaterThan(lossPerHour(day));
  });

  it("abaixo do limite de exaustão a pessoa para sozinha, e a energia sobe sem trabalhar", () => {
    let state = run(startedGame({ seed: 7, teamName: "T" }), { type: "start-action", actionId: "study-aero", memberIds: ["founder-marina"] });
    state = patch(state, "founder-marina", { energy: BALANCE.energy.exhaustedBelow - 3 });
    const done = lastTask(state).hoursDone;
    const after = until(state, (s) => s.clock.hours >= state.clock.hours + 1);
    expect(lastTask(after).hoursDone).toBe(done);
    expect(member(after, "founder-marina").energy).toBeGreaterThan(BALANCE.energy.exhaustedBelow - 3);
    // Voltando acima do limite, a tarefa anda de novo.
    const later = until(after, (s) => lastTask(s).hoursDone > done, 24 * 5);
    expect(lastTask(later).hoursDone).toBeGreaterThan(done);
  });

  it("leitura energyOutlook: nível, tendência e quando chega ao limite no ritmo atual", () => {
    const base = startedGame({ seed: 8, teamName: "T" });
    const idle = energyOutlook(patch(base, "founder-bia", { energy: 60 }), "founder-bia")!;
    expect(idle).toMatchObject({ energy: 60, level: "ok", trend: "up", hoursToLimit: null });
    expect(idle.perDay).toBeGreaterThan(0);

    const ids = ["founder-caio", "founder-marina"];
    let heavy = withShifts({ ...base, credits: 5000, stock: { balsa: 4 } }, ids, ["morning", "afternoon", "overnight"]);
    heavy = run(heavy, { type: "start-action", actionId: "build-wing", memberIds: ids });
    const outlook = energyOutlook(heavy, "founder-caio")!;
    expect(outlook.trend).toBe("down");
    expect(outlook.perDay).toBeLessThan(0);
    expect(outlook.hoursToLimit).toBeGreaterThan(0);
    expect(energyOutlook(patch(heavy, "founder-caio", { energy: 30 }), "founder-caio")!.level).toBe("tired");
    expect(energyOutlook(patch(heavy, "founder-caio", { energy: 5 }), "founder-caio")).toMatchObject({ level: "exhausted", hoursToLimit: null });
    expect(energyOutlook(base, "ghost")).toBeNull();
  });
});

describe("S5: alunos não determinados", () => {
  it("conhecimento inicial baixo e parecido: fundadores, candidatos e trainees", () => {
    const { baseKnowledge, knowledgeSpread } = BALANCE.people;
    const near = (knowledge: Record<Discipline, number>, bonus = 0) => {
      for (const discipline of DISCIPLINES) {
        expect(knowledge[discipline]).toBeGreaterThanOrEqual(baseKnowledge - knowledgeSpread);
        expect(knowledge[discipline]).toBeLessThanOrEqual(baseKnowledge + knowledgeSpread + bonus);
      }
    };
    for (const seed of [1, 2, 3, 4, 5]) {
      const game = createGame({ seed, teamName: "T" });
      for (const founder of game.members) near(founder.knowledge);
      // O curso puxa levemente (até +3) além do bônus do formato (até +6).
      const founded = withApplicants(foundedGame({ seed, teamName: "T" }), 6, "technical");
      for (const applicant of founded.selection!.applicants) near(applicant.profile.knowledge, 9);
      const hired = approveApplicants(founded, [founded.selection!.applicants[0]!.id]).members.at(-1)!;
      expect(hired.role).toBe("trainee");
      near(hired.knowledge, 9);
    }
    // Ninguém é "mais forte em X" por diferença grande: a amplitude entre fundadores é pequena.
    const founders = createGame({ seed: 9, teamName: "T" }).members;
    for (const discipline of DISCIPLINES) {
      const values = founders.map((item) => item.knowledge[discipline]);
      expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2 * knowledgeSpread);
    }
  });

  it("os textos dos fundadores são intenções, não afirmações", () => {
    for (const founder of FOUNDERS) expect(founder.likes).toMatch(/^Diz que quer /);
    const game = createGame({ seed: 2, teamName: "T" });
    for (const def of FOUNDERS) expect(member(game, def.id).statedLikes).toEqual(def.stated);
  });

  it("o que a pessoa diz gostar bate com o gosto real só em parte", () => {
    let matches = 0;
    let total = 0;
    let withMismatch = 0;
    for (let seed = 1; seed <= 150; seed += 1) {
      for (const person of createGame({ seed, teamName: "T" }).members) {
        const hits = person.statedLikes.filter((discipline) => person.likes.includes(discipline)).length;
        matches += hits;
        total += person.statedLikes.length;
        if (hits < person.statedLikes.length) withMismatch += 1;
        // Gosta e detesta são disjuntos; 1 a 2 gostos reais.
        expect(person.likes.length).toBeGreaterThanOrEqual(1);
        expect(person.likes.length).toBeLessThanOrEqual(3);
        expect(person.dislikes.some((discipline) => person.likes.includes(discipline))).toBe(false);
      }
    }
    const share = matches / total;
    expect(share).toBeGreaterThan(BALANCE.people.statedTruthShare - 0.2);
    expect(share).toBeLessThan(BALANCE.people.statedTruthShare + 0.2);
    expect(withMismatch).toBeGreaterThan(50);
  });

  it("inscritos declaram 0 a 2 gostos e carregam preferência e facilidade para o integrante", () => {
    const game = withApplicants(foundedGame({ seed: 3, teamName: "T" }), 12);
    const profiles = game.selection!.applicants.map((a) => a.profile);
    expect(new Set(profiles.map((p) => p.statedLikes.length)).size).toBeGreaterThan(1);
    for (const profile of profiles) {
      expect(profile.statedLikes.length).toBeLessThanOrEqual(2);
      expect(Object.keys(profile.aptitude).sort()).toEqual([...DISCIPLINES].sort());
    }
    const first = game.selection!.applicants[0]!;
    const hired = approveApplicants(game, [first.id]).members.at(-1)!;
    expect(hired).toMatchObject({ statedLikes: first.profile.statedLikes, likes: first.profile.likes, dislikes: first.profile.dislikes, aptitude: first.profile.aptitude, revealedAptitude: [], energy: 100 });
  });

  it("a facilidade escondida multiplica o ganho de conhecimento", () => {
    const base = startedGame({ seed: 10, teamName: "T" });
    const fast = { ...base.members[0]!.aptitude, aerodynamics: "fast" as const };
    const slow = { ...base.members[0]!.aptitude, aerodynamics: "slow" as const };
    let state = patch(patch(base, "founder-marina", { aptitude: fast }), "founder-caio", { aptitude: slow });
    state = patch(patch(state, "founder-marina", { knowledge: { ...member(state, "founder-marina").knowledge, aerodynamics: 10 } }), "founder-caio", {
      knowledge: { ...member(state, "founder-caio").knowledge, aerodynamics: 10 }
    });
    state = run(state, { type: "start-action", actionId: "study-aero", memberIds: ["founder-marina", "founder-caio"] });
    const done = until(state, (s) => lastTask(s).hoursDone >= 6);
    const gainFast = member(done, "founder-marina").knowledge.aerodynamics - 10;
    const gainSlow = member(done, "founder-caio").knowledge.aerodynamics - 10;
    expect(gainFast).toBeGreaterThan(0);
    expect(gainFast / gainSlow).toBeGreaterThan(2);
    expect(gainFast / gainSlow).toBeLessThan(3);
  });

  it("a facilidade só aparece depois de N horas na disciplina, com mensagem", () => {
    const base = patch(startedGame({ seed: 11, teamName: "T" }), "founder-marina", {
      aptitude: { ...member(startedGame({ seed: 11, teamName: "T" }), "founder-marina").aptitude, aerodynamics: "fast" },
      revealedAptitude: [],
      studyHours: { ...member(startedGame({ seed: 11, teamName: "T" }), "founder-marina").studyHours, aerodynamics: 0 }
    });
    const started = run(base, { type: "start-action", actionId: "study-aero", memberIds: ["founder-marina"] });
    const early = until(started, (s) => member(s, "founder-marina").studyHours.aerodynamics >= 3);
    expect(isAptitudeRevealed(member(early, "founder-marina"), "aerodynamics")).toBe(false);
    const revealed = until(early, (s) => isAptitudeRevealed(member(s, "founder-marina"), "aerodynamics"));
    expect(member(revealed, "founder-marina").studyHours.aerodynamics).toBeGreaterThanOrEqual(BALANCE.aptitude.revealAfterHours);
    const note = revealed.inbox.at(-1)!;
    expect(note.body).toMatch(/pegou rápido Aerodinâmica/);
    // Outras disciplinas seguem escondidas.
    expect(member(revealed, "founder-marina").revealedAptitude).toEqual(["aerodynamics"]);
    expect(Object.keys(APTITUDE_LABELS)).toEqual(["slow", "normal", "fast"]);
  });

  it("revealAptitude (gancho da árvore do orientador) revela uma vez só", () => {
    const base = startedGame({ seed: 12, teamName: "T" });
    const first = revealAptitude(base, "founder-caio", "structures")!;
    expect(isAptitudeRevealed(member(first.state, "founder-caio"), "structures")).toBe(true);
    expect(first.text).toContain(member(base, "founder-caio").name.split(" ")[0]);
    expect(revealAptitude(first.state, "founder-caio", "structures")).toBeNull();
    expect(revealAptitude(base, "ghost", "structures")).toBeNull();
  });

  it("fazer o que gosta anima; o que detesta gasta mais energia e desanima", () => {
    const base = startedGame({ seed: 13, teamName: "T" });
    const loves = patch(base, "founder-marina", { likes: ["aerodynamics"], dislikes: [], motivation: 60 });
    const hates = patch(base, "founder-marina", { likes: [], dislikes: ["aerodynamics"], motivation: 60 });
    const play = (s: GameState) => until(run(s, { type: "start-action", actionId: "study-aero", memberIds: ["founder-marina"] }), (n) => n.clock.hours >= s.clock.hours + 24 * 2);
    const liked = member(play(loves), "founder-marina");
    const disliked = member(play(hates), "founder-marina");
    expect(liked.motivation).toBeGreaterThan(60);
    expect(disliked.motivation).toBeLessThan(liked.motivation);
    expect(disliked.energy).toBeLessThan(liked.energy);
  });

  it("drawPreferences é reproduzível pelo seed e respeita o declarado dos fundadores", () => {
    expect(drawPreferences(77).prefs).toEqual(drawPreferences(77).prefs);
    const given = drawPreferences(77, ["structures"]).prefs;
    expect(given.statedLikes).toEqual(["structures"]);
  });

  it("o orientador tem nome padrão masculino e editável", () => {
    expect(DEFAULT_ADVISOR_NAME).toBe("Ricardo Prado");
    expect(createGame({ seed: 1, teamName: "T" }).advisor.name).toBe(DEFAULT_ADVISOR_NAME);
    expect(createGame({ seed: 1, teamName: "T", advisorName: "Otávio Lins" }).advisor.name).toBe("Otávio Lins");
  });
});
