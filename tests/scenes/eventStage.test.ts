import { describe, expect, it } from "vitest";
import { mockEventView, MOCK_SELECTION_BLOCKS } from "../../src/scenes/event/mock";
import {
  ASSEMBLY_SECONDS,
  FRAME_WINDOW,
  INSPECTOR_LOOKS,
  KIT_PARTS,
  LANE_FULL_M,
  LAUNCH_LANE,
  anchorFor,
  assemblyParts,
  crewSlots,
  effectiveFocus,
  focusForBlock,
  formatDistance,
  framedSceneFor,
  gliderFrame,
  groupTables,
  inspectionLights,
  inspectionTally,
  landedGlider,
  launchStart,
  planFigures,
  seatsAround,
  selectionPhase,
  settingForEvent,
  skyAt,
  zoomFor
} from "../../src/scenes/event/stage";
import { palette } from "../../src/scenes/palette";

describe("cenário e foco", () => {
  it("escolhe o cenário pelo tipo de evento", () => {
    expect(settingForEvent("selection-day")).toBe("campus");
    expect(settingForEvent("flight-test")).toBe("aeroclub");
    expect(settingForEvent("competition")).toBe("competition");
  });

  it("mapeia o bloco para o foco da câmera", () => {
    expect(focusForBlock("challenge")).toBe("work");
    expect(focusForBlock("inspection")).toBe("bench");
    expect(focusForBlock("flight")).toBe("runway");
    expect(focusForBlock("queue")).toBe("runway");
    expect(focusForBlock("launch")).toBe("launch");
    expect(focusForBlock("ceremony")).toBe("podium");
    expect(focusForBlock("interview")).toBe("gathering");
  });

  it("foco que o cenário não tem cai na reunião", () => {
    expect(effectiveFocus("campus", "bench")).toBe("gathering");
    expect(effectiveFocus("competition", "bench")).toBe("bench");
    expect(anchorFor("campus", "podium")).toEqual(anchorFor("campus", "gathering"));
    expect(zoomFor("campus", "bench")).toBe(zoomFor("campus", "gathering"));
  });
});

describe("céu", () => {
  it("é dia ao meio-dia e noite à meia-noite", () => {
    expect(skyAt(12).night).toBe(0);
    expect(skyAt(0).night).toBe(1);
  });

  it("alaranja perto do nascer e do pôr do sol, não ao meio-dia", () => {
    expect(skyAt(6.2).warm).toBeGreaterThan(0.8);
    expect(skyAt(17.8).warm).toBeGreaterThan(0.8);
    expect(skyAt(12).warm).toBe(0);
  });

  it("o sol anda de leste (6 h) a oeste (18 h)", () => {
    expect(skyAt(6).sunProgress).toBe(0);
    expect(skyAt(18).sunProgress).toBe(1);
  });
});

describe("equipe", () => {
  it("dá um lugar distinto a cada integrante", () => {
    const slots = crewSlots(6, "competition", "gathering");
    expect(slots).toHaveLength(6);
    expect(new Set(slots.map((s) => `${s.col.toFixed(2)},${s.row.toFixed(2)}`)).size).toBe(6);
  });

  it("a fileira fica centrada na âncora", () => {
    const slots = crewSlots(3, "competition", "gathering");
    const mid = slots[1]!;
    expect(mid.col).toBeCloseTo(8, 5);
    expect(mid.row).toBeCloseTo(7, 5);
  });

  it("a equipe vai para a bancada na inspeção e para a pista no voo", () => {
    const bench = crewSlots(1, "competition", "bench")[0]!;
    const runway = crewSlots(1, "competition", "runway")[0]!;
    expect(bench).not.toEqual(runway);
    expect(runway.row).toBeGreaterThan(bench.row);
  });
});

describe("planFigures", () => {
  it("ids são estáveis entre blocos (a cena anima o caminho)", () => {
    const a = planFigures(mockEventView("competition", 0)).map((p) => p.id);
    const b = planFigures(mockEventView("competition", 3)).map((p) => p.id);
    expect(a.filter((id) => id.startsWith("crew:"))).toEqual(b.filter((id) => id.startsWith("crew:")));
  });

  it("os fiscais só aparecem na inspeção técnica", () => {
    const inspectors = (index: number) => planFigures(mockEventView("competition", index)).filter((p) => p.role === "inspector");
    expect(inspectors(1)).toHaveLength(INSPECTOR_LOOKS.length);
    expect(inspectors(0)).toHaveLength(0);
    expect(inspectors(4)).toHaveLength(0);
  });

  it("a equipe trabalha no foco work e fica de pé no resto", () => {
    const pose = (index: number) => planFigures(mockEventView("competition", index)).find((p) => p.role === "crew")!.pose;
    expect(pose(2)).toBe("work");
    expect(pose(4)).toBe("stand");
  });

  it("candidatos da seletiva ficam em volta das mesas e depois na linha de lançamento", () => {
    const candidates = (index: number) => planFigures(mockEventView("selection-day", index)).filter((p) => p.role === "candidate");
    expect(candidates(0)).toHaveLength(12);
    const tables = groupTables(4);
    const first = candidates(2)[0]!;
    expect(Math.hypot(first.col - tables[0]!.col, first.row - tables[0]!.row)).toBeCloseTo(1.5, 5);
    expect(candidates(2).every((c) => c.pose === "work")).toBe(true);
    expect(candidates(3).every((c) => c.col < LAUNCH_LANE.col0)).toBe(true);
    expect(candidates(3).every((c) => c.pose === "stand")).toBe(true);
  });

  it("sem seleção não há candidatos", () => {
    expect(planFigures(mockEventView("flight-test", 1)).some((p) => p.role === "candidate")).toBe(false);
  });
});

describe("dinâmica da seletiva", () => {
  it("as mesas não se sobrepõem e há uma por grupo", () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const tables = groupTables(n);
      expect(tables).toHaveLength(n);
      for (let i = 0; i < n; i += 1)
        for (let j = i + 1; j < n; j += 1)
          expect(Math.hypot(tables[i]!.col - tables[j]!.col, tables[i]!.row - tables[j]!.row)).toBeGreaterThan(2);
    }
  });

  it("os lugares ficam a 1,5 casa da mesa, virados para ela", () => {
    const table = { col: 10, row: 4 };
    for (const seat of seatsAround(table, 3)) {
      expect(Math.hypot(seat.col - table.col, seat.row - table.row)).toBeCloseTo(1.5, 5);
      expect(seat.facing).toBe(seat.col > table.col ? -1 : 1);
    }
  });

  it("a fase segue a ordem dos blocos", () => {
    const phase = (blockIndex: number) => selectionPhase({ blocks: MOCK_SELECTION_BLOCKS, blockIndex });
    expect(phase(0)).toBe("kit");
    expect(phase(1)).toBe("kit");
    expect(phase(2)).toBe("assembling");
    expect(phase(3)).toBe("launching");
    expect(phase(4)).toBe("landed");
  });

  it("monta as quatro peças ao longo do desafio, com atraso por grupo", () => {
    expect(assemblyParts(0, 0)).toBe(0);
    expect(assemblyParts(0, ASSEMBLY_SECONDS)).toBe(KIT_PARTS);
    expect(assemblyParts(0, ASSEMBLY_SECONDS / 2)).toBe(KIT_PARTS / 2);
    expect(assemblyParts(3, ASSEMBLY_SECONDS / 2)).toBeLessThanOrEqual(assemblyParts(0, ASSEMBLY_SECONDS / 2));
    expect(assemblyParts(0, 1000)).toBe(KIT_PARTS);
  });

  it("o planador pousa na distância da simulação", () => {
    const end = landedGlider(1, LANE_FULL_M / 2);
    expect(end.landed).toBe(true);
    expect(end.col).toBeCloseTo(LAUNCH_LANE.col0 + LAUNCH_LANE.length / 2, 5);
    expect(landedGlider(0, 5).col).toBeLessThan(landedGlider(0, 20).col);
    expect(landedGlider(0, 1000).col).toBeCloseTo(LAUNCH_LANE.col0 + LAUNCH_LANE.length, 5);
  });

  it("antes de lançar fica na mão e durante o voo sobe e avança", () => {
    const start = launchStart(2);
    const before = gliderFrame(2, 15, start - 0.5);
    expect(before.landed).toBe(false);
    expect(before.col).toBeCloseTo(LAUNCH_LANE.col0, 5);
    const mid = gliderFrame(2, 15, start + 1.5);
    expect(mid.z).toBeGreaterThan(before.z);
    expect(mid.col).toBeGreaterThan(before.col);
    expect(mid.landed).toBe(false);
  });

  it("cada grupo lança depois do anterior e tem a sua pista", () => {
    expect(launchStart(1)).toBeGreaterThan(launchStart(0));
    expect(gliderFrame(1, 10, 0).row).toBeGreaterThan(gliderFrame(0, 10, 0).row);
  });

  it("formata a distância em vírgula", () => {
    expect(formatDistance(14.25)).toBe("14,3 m");
  });
});

describe("inspeção", () => {
  const items = mockEventView("competition").inspection!.items;

  it("cada item vira uma luz na cor do status; só a pendência pisca", () => {
    const lights = inspectionLights(items);
    expect(lights).toHaveLength(items.length);
    expect(lights[0]).toEqual({ color: palette.ok, blink: false });
    expect(lights[2]).toEqual({ color: palette.warn, blink: true });
    expect(lights[4]).toEqual({ color: palette.danger, blink: false });
  });

  it("conta os status", () => {
    expect(inspectionTally(items)).toEqual({ ok: 3, pending: 1, fail: 1 });
  });
});

describe("janela do voo e da fila", () => {
  it("só voo e fila rodam dentro da moldura", () => {
    expect(framedSceneFor("flight")).toBe("flight");
    expect(framedSceneFor("queue")).toBe("queue");
    expect(framedSceneFor("inspection")).toBeNull();
    expect(framedSceneFor("challenge")).toBeNull();
  });

  it("a janela cabe na tela", () => {
    expect(FRAME_WINDOW.x + FRAME_WINDOW.w).toBeLessThanOrEqual(1);
    expect(FRAME_WINDOW.y + FRAME_WINDOW.h).toBeLessThanOrEqual(1);
  });
});
