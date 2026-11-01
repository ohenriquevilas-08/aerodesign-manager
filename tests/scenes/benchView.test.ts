import { describe, expect, it } from "vitest";
import {
  aircraftViewFromState,
  benchForTask,
  benchViewsFromState,
  MAX_BENCH_PARTS,
  taskProgress,
  workerViewsFromState
} from "../../src/scenes/hangar/benchView";
import { baseState, part, task } from "./fixtures";

const bench = (state: ReturnType<typeof baseState>, id: string) => benchViewsFromState(state).find((view) => view.id === id)!;

describe("bancadas do hangar", () => {
  it("estado inicial: bancadas vazias e avião sem peças", () => {
    const state = baseState();
    benchViewsFromState(state).forEach((view) => {
      expect(view.task).toBeNull();
      expect(view.parts).toEqual([]);
    });
    expect(Object.values(aircraftViewFromState(state)).every((value) => value === null)).toBe(true);
  });

  it("mapeia ação para bancada; o que não é de bancada não aparece", () => {
    const state = baseState();
    state.parts = [part({ id: "p1", type: "landingGear" })];
    const of = (actionId: string, targetId: string | null = null) => benchForTask(state, { actionId, targetId });
    expect(of("build-wing")).toBe("wing");
    expect(of("build-fuselage")).toBe("fuselage");
    expect(of("build-tail")).toBe("fuselage");
    expect(of("build-gear")).toBe("fuselage");
    expect(of("test-structural")).toBe("wing");
    expect(of("test-thrust")).toBe("electronics");
    expect(of("drawings")).toBe("report");
    expect(of("oral-rehearsal")).toBe("report");
    expect(of("buy-motor")).toBe("electronics");
    expect(of("buy-servos")).toBe("electronics");
    expect(of("report-chapter")).toBe("report");
    expect(of("document")).toBe("report");
    expect(of("repair-part", "p1")).toBe("fuselage");
    expect(of("repair-part", "sumiu")).toBeNull();
    expect(of("raffle")).toBeNull();
    expect(of("study-aero")).toBeNull();
    expect(of("outreach-social")).toBeNull();
    expect(of("test-flight")).toBeNull();
  });

  it("mostra a tarefa ativa da bancada com progresso por horas e conta as outras", () => {
    const state = baseState();
    state.tasks = [
      task({ id: "t1", actionId: "test-thrust", status: "waiting", hoursTotal: 8 }),
      task({ id: "t2", actionId: "build-wing", label: "Fabricar asa", hoursTotal: 60, hoursDone: 15 }),
      task({ id: "t3", actionId: "test-thrust", status: "done", doneAt: 5 })
    ];
    expect(bench(state, "wing").task).toEqual({ id: "t2", label: "Fabricar asa", progress: 0.25, waiting: false });
    expect(bench(state, "wing").queued).toBe(0);
    const electronics = bench(state, "electronics");
    expect(electronics.task?.id).toBe("t1");
    expect(electronics.task?.waiting).toBe(true);
    expect(electronics.queued).toBe(0);
  });

  it("espera ⌛ anda pelo prazo prometido e nunca chega a 100% antes de concluir", () => {
    const state = baseState();
    // sponsor-pitch promete 14 dias; iniciada na hora 0.
    const waiting = task({ id: "t1", actionId: "sponsor-pitch", status: "waiting", expectedReadyAt: 14 * 24, readyAt: 18 * 24 });
    state.clock.hours = 7 * 24;
    expect(taskProgress(state, waiting)).toBeCloseTo(0.5, 5);
    state.clock.hours = 16 * 24;
    expect(taskProgress(state, waiting)).toBe(0.99);
  });

  it("peças vão para a bancada do tipo, com estado visível e limite no cartão", () => {
    const state = baseState();
    state.parts = [
      part({ id: "p1", type: "powertrain", label: "Motor 600 W", condition: 15 }),
      part({ id: "p2", type: "tail", label: "Empenagem", condition: 60 }),
      ...Array.from({ length: MAX_BENCH_PARTS + 2 }, (_, i) => part({ id: `w${i}`, type: "wing", label: `Asa ${i}` }))
    ];
    expect(bench(state, "electronics").parts).toEqual([{ label: "Motor 600 W", state: "broken", counterfeit: false }]);
    expect(bench(state, "fuselage").parts).toEqual([{ label: "Empenagem", state: "worn", counterfeit: false }]);
    expect(bench(state, "wing").parts).toHaveLength(MAX_BENCH_PARTS);
    expect(bench(state, "wing").moreParts).toBe(2);
  });

  it("peça fora da especificação ganha marca", () => {
    const state = baseState();
    state.parts = [{ ...part({ id: "s", type: "electronics", label: "Servos" }), counterfeit: true } as ReturnType<typeof part>];
    expect(bench(state, "electronics").parts[0]!.counterfeit).toBe(true);
  });

  it("avião usa a melhor peça de cada tipo", () => {
    const state = baseState();
    state.parts = [
      part({ id: "a", type: "wing", condition: 30 }),
      part({ id: "b", type: "wing", condition: 85 }),
      part({ id: "c", type: "landingGear", condition: 40, quality: 90 }),
      part({ id: "d", type: "landingGear", condition: 40, quality: 20 })
    ];
    const view = aircraftViewFromState(state);
    expect(view.wing).toBe("new");
    expect(view.landingGear).toBe("damaged");
    expect(view.fuselage).toBeNull();
  });
});

describe("integrantes no hangar", () => {
  it("vão para a bancada da tarefa conforme assignees; presidente e quem está fora ficam na área livre", () => {
    const state = baseState();
    const [president, aero, struct] = state.members.map((member) => member.id);
    state.tasks = [
      task({ id: "t1", actionId: "build-wing", assignees: [aero!] }),
      task({ id: "t2", actionId: "test-thrust", status: "waiting", assignees: [struct!] })
    ];
    const views = workerViewsFromState(state);
    expect(views.find((v) => v.memberId === president)).toMatchObject({ bench: null, working: false, slot: 0 });
    expect(views.find((v) => v.memberId === aero)).toMatchObject({ bench: "wing", working: true, slot: 0 });
    // Alocado em tarefa esperando prazo: na bancada, sem trabalhar.
    expect(views.find((v) => v.memberId === struct)).toMatchObject({ bench: "electronics", working: false });
  });

  it("tarefa fora do hangar deixa a pessoa na área livre; slots contam por lugar", () => {
    const state = baseState();
    const [, aero, struct] = state.members.map((member) => member.id);
    state.tasks = [task({ id: "t1", actionId: "raffle", assignees: [aero!, struct!] })];
    const views = workerViewsFromState(state);
    expect(views.map((v) => [v.bench, v.slot])).toEqual([
      [null, 0],
      [null, 1],
      [null, 2]
    ]);
  });
});
