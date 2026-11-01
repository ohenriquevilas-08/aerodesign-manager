import { describe, expect, it, vi } from "vitest";
import { MOCK_PLAYBACKS } from "../../src/scenes/flight/mockPlaybacks";
import { flightReplay } from "../../src/scenes/flight/replayChannel";
import { BENCH_TEST_SECONDS, benchTestFrame, RESULT_AT, TEST_BENCH } from "../../src/scenes/hangar/benchTest";
import { benchTestChannel, playTest, type BenchTestEntry } from "../../src/scenes/tests/testEntry";

const entry = (patch: Partial<BenchTestEntry>): BenchTestEntry => ({
  kind: "structural",
  label: "Ensaio",
  outcome: "pass",
  gauge: 0.6,
  result: "ok",
  ...patch
});

describe("animação de ensaio de bancada", () => {
  it("cada ensaio tem a sua bancada", () => {
    expect(TEST_BENCH).toEqual({ structural: "wing", thrust: "electronics", scale: "fuselage" });
  });

  it("começa zerado e o resultado só aparece no fim", () => {
    for (const kind of ["structural", "thrust", "scale"] as const) {
      const e = entry({ kind });
      expect(benchTestFrame(e, 0).gauge).toBeCloseTo(0, 5);
      expect(benchTestFrame(e, RESULT_AT - 0.1).showResult).toBe(false);
      expect(benchTestFrame(e, RESULT_AT).showResult).toBe(true);
    }
  });

  it("estrutural aprovado assenta no valor medido, sem quebrar", () => {
    const end = benchTestFrame(entry({ gauge: 0.6 }), BENCH_TEST_SECONDS);
    expect(end.gauge).toBeCloseTo(0.6, 3);
    expect(end.broken).toBe(false);
  });

  it("estrutural reprovado sobe ao fundo de escala e rompe", () => {
    const e = entry({ outcome: "fail" });
    expect(benchTestFrame(e, 2.1).gauge).toBeGreaterThan(0.9);
    expect(benchTestFrame(e, 2.1).broken).toBe(false);
    expect(benchTestFrame(e, 3).broken).toBe(true);
    expect(benchTestFrame(e, BENCH_TEST_SECONDS).gauge).toBeLessThan(0.2);
  });

  it("tração e balança assentam no valor medido; a hélice gira", () => {
    expect(benchTestFrame(entry({ kind: "thrust", gauge: 0.7 }), BENCH_TEST_SECONDS).gauge).toBeCloseTo(0.7, 1);
    expect(benchTestFrame(entry({ kind: "thrust" }), 1).spin).toBeGreaterThan(0);
    expect(benchTestFrame(entry({ kind: "scale", gauge: 0.4 }), BENCH_TEST_SECONDS).gauge).toBeCloseTo(0.4, 2);
  });

  it("é determinística e o ponteiro fica entre 0 e 1", () => {
    const e = entry({ kind: "scale", gauge: 1 });
    for (let t = 0; t <= BENCH_TEST_SECONDS; t += 0.1) {
      const frame = benchTestFrame(e, t);
      expect(frame).toEqual(benchTestFrame(e, t));
      expect(frame.gauge).toBeGreaterThanOrEqual(0);
      expect(frame.gauge).toBeLessThanOrEqual(1);
    }
  });
});

describe("playTest", () => {
  it("ensaio de voo vai para a FlightScene; de bancada, para o hangar", () => {
    const playback = Object.values(MOCK_PLAYBACKS)[0]!;
    const before = flightReplay.current?.serial ?? 0;
    const heard = vi.fn();
    const off = benchTestChannel.subscribe(heard);
    playTest({ kind: "flight", playback });
    expect(flightReplay.current?.serial).toBe(before + 1);
    expect(heard).not.toHaveBeenCalled();
    const bench = entry({ kind: "thrust" });
    playTest(bench);
    expect(heard).toHaveBeenCalledWith(bench);
    off();
  });
});
