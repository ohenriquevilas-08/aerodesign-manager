import { describe, expect, it } from "vitest";
import { workerViewsFromState } from "../../src/scenes/hangar/benchView";
import { currentShift, lightingFor, overnightNapper, shiftForHour, shiftOfSlot, slotKey, workshopNow } from "../../src/scenes/hangar/workshop";
import { hourOfDay } from "../../src/scenes/queue/queueView";
import { baseState, task } from "./fixtures";

describe("turnos da oficina (stub do contrato)", () => {
  it("horários do §5.5", () => {
    expect(shiftForHour(9)).toBe("morning");
    expect(shiftForHour(12.5)).toBeNull();
    expect(shiftForHour(15)).toBe("afternoon");
    expect(shiftForHour(18.5)).toBeNull();
    expect(shiftForHour(20)).toBe("evening");
    expect(shiftForHour(23)).toBe("overnight");
    expect(shiftForHour(2.5)).toBe("overnight");
    expect(shiftForHour(5)).toBeNull();
  });

  it("fora de turno a oficina fica vazia e fechada; em turno, quem trabalha está lá", () => {
    const state = baseState();
    // Leva o relógio para as 5 h.
    state.clock.hours = (5 - hourOfDay(0) + 24) % 24;
    expect(currentShift(state)).toBeNull();
    expect(workshopNow(state)).toEqual({ slot: null, present: [], open: false, blocked: null });
    state.clock.hours += 4; // 9 h
    const now = workshopNow(state);
    const shift = currentShift(state)!;
    expect(shift.shift).toBe("morning");
    // slot é o SlotKey "dia-turno"; o objeto é o formato de currentShift.
    expect(now.slot).toBe(`${shift.day}-morning`);
    expect(shiftOfSlot(now.slot)).toBe("morning");
    expect(now.open).toBe(true);
    // Presidente não trabalha na oficina.
    expect(now.present).toEqual(state.members.filter((m) => m.role !== "president").map((m) => m.id));
  });
});

describe("luz pelo turno", () => {
  it("SlotKey ida e volta", () => {
    expect(slotKey({ day: 3, shift: "overnight" })).toBe("3-overnight");
    expect(shiftOfSlot("3-overnight")).toBe("overnight");
    expect(shiftOfSlot(null)).toBeNull();
  });

  it("dia claro de manhã e à tarde", () => {
    expect(lightingFor("morning", true, 9)).toMatchObject({ mode: "day", dim: 0, darkWindows: false, lampsOn: false });
    expect(lightingFor("afternoon", true, 15).mode).toBe("day");
  });

  it("à noite luz acesa e janela escura; de madrugada, mais escuro com café e pizza", () => {
    const evening = lightingFor("evening", true, 20);
    expect(evening).toMatchObject({ mode: "evening", darkWindows: true, lampsOn: true, overnightProps: false });
    const overnight = lightingFor("overnight", true, 1);
    expect(overnight).toMatchObject({ mode: "overnight", darkWindows: true, lampsOn: true, overnightProps: true });
    expect(overnight.dim).toBeGreaterThan(evening.dim);
  });

  it("fechada fica escura, sem luminária; janela escura só se for noite lá fora", () => {
    expect(lightingFor(null, false, 5)).toMatchObject({ mode: "closed", lampsOn: false, darkWindows: true });
    expect(lightingFor(null, false, 12.5)).toMatchObject({ mode: "closed", darkWindows: false });
    expect(lightingFor("morning", false, 9).mode).toBe("closed");
  });
});

describe("quem aparece", () => {
  it("só os presentes ficam na oficina, com slots contados entre eles", () => {
    const state = baseState();
    const [, aero, struct] = state.members.map((m) => m.id);
    state.tasks = [task({ id: "t1", actionId: "build-wing", assignees: [aero!, struct!] })];
    const views = workerViewsFromState(state, [struct!]);
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ memberId: struct, bench: "wing", slot: 0, working: true });
    expect(workerViewsFromState(state, [])).toEqual([]);
  });

  it("de madrugada cochila o primeiro presente fora das bancadas", () => {
    const workers = [
      { memberId: "a", bench: "wing" },
      { memberId: "b", bench: null },
      { memberId: "c", bench: null }
    ];
    expect(overnightNapper("overnight", workers)).toBe("b");
    expect(overnightNapper("evening", workers)).toBeNull();
    expect(overnightNapper("overnight", [workers[0]!])).toBeNull();
  });
});
