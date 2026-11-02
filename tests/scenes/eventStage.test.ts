import { describe, expect, it } from "vitest";
import { mockEventView, MOCK_CANDIDATE_COUNT, MOCK_SELECTION_BLOCKS } from "../../src/scenes/event/mock";
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
  focusForView,
  formatDistance,
  framedSceneFor,
  GRID,
  gliderFrame,
  groupTables,
  laneRow,
  laneStep,
  inspectionLights,
  inspectionTally,
  landedGlider,
  launchStart,
  planFigures,
  seatsAround,
  selectionPhase,
  settingForEvent,
  skyAt,
  zoomFor,
  BENCH_HALF, GLIDER_PARTS, PART_TRAVEL_SECONDS, PATROL_SECONDS, assemblyClock, assemblyProgress, flightFrame, heldHeight, partFrame, partStart, patrolStop
} from "../../src/scenes/event/stage";
import { palette } from "../../src/scenes/palette";

describe("cenário e foco", () => {
  it("o bloco depois do desafio da dinâmica olha para a pista de lançamento", () => {
    const view = mockEventView("selection-day", 3);
    expect(focusForView(view)).toBe("launch");
    expect(focusForView(mockEventView("selection-day", 2))).toBe("work");
  });

  it("escolhe o cenário pelo tipo de evento", () => {
    expect(settingForEvent("selection-day")).toBe("campus");
    expect(settingForEvent("flight-test")).toBe("aeroclub");
    expect(settingForEvent("competition")).toBe("competition");
  });

  it("mapeia o bloco para o foco da câmera", () => {
    expect(focusForBlock("challenge")).toBe("work");
    expect(focusForBlock("inspection")).toBe("bench");
    expect(focusForBlock("flights")).toBe("runway");
    expect(focusForBlock("takeoff")).toBe("runway");
    expect(focusForBlock("assembly")).toBe("work");
    expect(focusForBlock("awards")).toBe("podium");
    expect(focusForBlock("interviews")).toBe("gathering");
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
    expect(inspectors(2)).toHaveLength(INSPECTOR_LOOKS.length);
    expect(inspectors(0)).toHaveLength(0);
    expect(inspectors(4)).toHaveLength(0);
  });

  it("a equipe trabalha no foco work e fica de pé no resto", () => {
    const pose = (index: number) => planFigures(mockEventView("competition", index)).find((p) => p.role === "crew")!.pose;
    expect(pose(1)).toBe("work");
    expect(pose(4)).toBe("stand");
  });

  it("candidatos da seletiva ficam em volta das mesas, em todas as fases", () => {
    const candidates = (index: number) => planFigures(mockEventView("selection-day", index)).filter((p) => p.role === "candidate");
    expect(candidates(0)).toHaveLength(MOCK_CANDIDATE_COUNT);
    const tables = groupTables(Math.ceil(MOCK_CANDIDATE_COUNT / 6));
    const first = candidates(2)[0]!;
    // Colados na bancada: a elipse que contorna o tampo.
    const reach = Math.hypot((first.col - tables[0]!.col) / (BENCH_HALF.col + 0.55), (first.row - tables[0]!.row) / (BENCH_HALF.row + 0.55));
    expect(reach).toBeCloseTo(1, 5);
    expect(candidates(2).every((c) => c.pose === "work")).toBe(true);
    expect(candidates(0).every((c) => c.pose === "stand")).toBe(true);
    // O lançamento sai das bancadas: ninguém sai do lugar depois do desafio.
    expect(candidates(3).map((c) => [c.col, c.row])).toEqual(candidates(2).map((c) => [c.col, c.row]));
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

  it("os lugares contornam a bancada, virados para ela", () => {
    const table = { col: 10, row: 4 };
    for (const seat of seatsAround(table, 3)) {
      const reach = Math.hypot((seat.col - table.col) / (BENCH_HALF.col + 0.55), (seat.row - table.row) / (BENCH_HALF.row + 0.55));
      expect(reach).toBeCloseTo(1, 5);
      // À esquerda do centro na tela olha para a direita (facing 1) e vice-versa.
      expect(seat.facing).toBe(seat.col - seat.row > table.col - table.row ? -1 : 1);
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
  it("só o voo roda dentro da moldura", () => {
    expect(framedSceneFor("flights")).toBe("flight");
    expect(framedSceneFor("takeoff")).toBe("flight");
    expect(framedSceneFor("inspection")).toBeNull();
    expect(framedSceneFor("challenge")).toBeNull();
  });

  it("a janela cabe na tela", () => {
    expect(FRAME_WINDOW.x + FRAME_WINDOW.w).toBeLessThanOrEqual(1);
    expect(FRAME_WINDOW.y + FRAME_WINDOW.h).toBeLessThanOrEqual(1);
  });
});

describe("dinâmica cheia (Fase 9): grupos de 5 a 6", () => {
  const dist = (a: { col: number; row: number }, b: { col: number; row: number }) => Math.hypot(a.col - b.col, a.row - b.row);

  it("com 5 a 8 grupos as mesas continuam separadas e dentro do piso", () => {
    for (const n of [5, 6, 7, 8]) {
      const tables = groupTables(n);
      for (let i = 0; i < n; i += 1) {
        expect(tables[i]!.col).toBeGreaterThan(1);
        expect(tables[i]!.col).toBeLessThan(GRID.cols - 1);
        expect(tables[i]!.row).toBeGreaterThan(0.5);
        expect(tables[i]!.row).toBeLessThan(GRID.rows - 1);
        for (let j = i + 1; j < n; j += 1) expect(dist(tables[i]!, tables[j]!)).toBeGreaterThan(3);
      }
    }
  });

  it("os lugares em volta da mesa de 6 não se tocam", () => {
    const around = seatsAround({ col: 10, row: 5 }, 6);
    for (let i = 0; i < 6; i += 1) for (let j = i + 1; j < 6; j += 1) expect(dist(around[i]!, around[j]!)).toBeGreaterThan(0.8);
  });

  it("a pista comprime as faixas com mais grupos, mas mantém o espaço antigo até 4", () => {
    expect(laneStep(4)).toBe(LAUNCH_LANE.rowStep);
    expect(laneStep(6)).toBeLessThan(LAUNCH_LANE.rowStep);
    expect(laneRow(5, 6)).toBeLessThanOrEqual(GRID.rows);
    expect(laneRow(0, 6)).toBe(LAUNCH_LANE.row0);
    expect(gliderFrame(1, 10, 0).row).toBe(laneRow(1, 4));
    expect(gliderFrame(5, 10, 0, 6).row).toBe(laneRow(5, 6));
    expect(landedGlider(5, 10, 6).row).toBe(laneRow(5, 6));
  });

  it("cada grupo trabalha na própria bancada, com um que ergue o planador", () => {
    const view = mockEventView("selection-day", 3);
    const plans = planFigures(view).filter((p) => p.role === "candidate");
    expect(plans).toHaveLength(MOCK_CANDIDATE_COUNT);
    const groups = view.selection!.groups;
    const tables = groupTables(groups.length);
    groups.forEach((group, g) => {
      const mine = plans.filter((p) => p.groupId === group.id);
      expect(mine).toHaveLength(group.members.length);
      expect(mine.every((p) => dist(p, tables[g]!) < 2)).toBe(true);
      expect(mine.filter((p) => p.lifter)).toHaveLength(1);
    });
  });

  it("candidatos usam roupa própria e a equipe, a camiseta da equipe", () => {
    const plans = planFigures(mockEventView("selection-day", 2));
    expect(plans.filter((p) => p.role === "candidate").every((p) => p.outfit === "own")).toBe(true);
    const crew = plans.filter((p) => p.role === "crew");
    expect(crew.length).toBeGreaterThan(0);
    expect(crew.every((p) => p.outfit === "team" && !!p.patrol)).toBe(true);
  });

  it("os capitães passam de bancada em bancada e não param todos no mesmo grupo", () => {
    const view = mockEventView("selection-day", 2);
    const crew = planFigures(view).filter((p) => p.role === "crew");
    const at = (t: number) => crew.map((p) => patrolStop(p.patrol!, t));
    const first = at(0);
    expect(new Set(first.map((s) => `${s.col},${s.row}`)).size).toBeGreaterThan(1);
    const later = at(PATROL_SECONDS);
    expect(later.map((s) => `${s.col},${s.row}`)).not.toEqual(first.map((s) => `${s.col},${s.row}`));
    // Dá a volta na ronda.
    const n = crew[0]!.patrol!.stops.length;
    expect(patrolStop(crew[0]!.patrol!, PATROL_SECONDS * n)).toEqual(first[0]);
    // A parada fica fora do tampo, ao lado da bancada.
    const tables = groupTables(view.selection!.groups.length);
    for (const stop of crew[0]!.patrol!.stops) expect(Math.min(...tables.map((t) => dist(stop, t)))).toBeGreaterThan(1.5);
  });

  it("o planador é montado em partes: solto no começo, encaixando uma a uma e inteiro no fim", () => {
    expect(GLIDER_PARTS.map((p) => p.id)).toEqual(["fuselage", "wing", "tail", "ballast"]);
    expect(assemblyProgress(0, 0)).toBe(0);
    expect(assemblyProgress(0, ASSEMBLY_SECONDS + 5)).toBe(1);
    let last = -1;
    for (let t = 0; t <= ASSEMBLY_SECONDS + 3; t += 0.5) {
      const progress = assemblyProgress(2, t);
      expect(progress).toBeGreaterThanOrEqual(last);
      last = progress;
    }
    // As peças vão em sequência: a asa só começa depois da fuselagem.
    const mid = partStart(0, 1) + 0.1;
    expect(partFrame(0, 0, mid).k).toBe(1);
    expect(partFrame(0, 1, mid).k).toBeGreaterThan(0);
    expect(partFrame(0, 3, mid).k).toBe(0);
    // Solta tem deslocamento; montada, nenhum, e a peça sobe no ar pelo caminho.
    expect(partFrame(0, 1, -1)).toMatchObject({ k: 0, dc: GLIDER_PARTS[1]!.loose.col, dr: GLIDER_PARTS[1]!.loose.row });
    const done = partFrame(0, 1, 1e6);
    expect(done.k).toBe(1);
    expect(done.dc).toBeCloseTo(0);
    expect(done.dr).toBeCloseTo(0);
    expect(done.lift).toBeCloseTo(0);
    expect(partFrame(0, 1, partStart(0, 1) + PART_TRAVEL_SECONDS / 2).lift).toBeGreaterThan(0);
  });

  it("o relógio da montagem segue a fase: soltas, em andamento, prontas", () => {
    expect(assemblyProgress(0, assemblyClock("kit", 99))).toBe(0);
    expect(assemblyClock("assembling", 7)).toBe(7);
    expect(assemblyProgress(0, assemblyClock("launching", 0))).toBe(1);
    expect(assemblyProgress(0, assemblyClock("landed", 0))).toBe(1);
  });

  it("o planador sai da mão de quem o ergue e pousa na faixa do grupo, na distância da simulação", () => {
    const start = { col: 9, row: 5 };
    const held = flightFrame(start, 2, 15, 0, 6, 56);
    expect(held).toMatchObject({ held: true, landed: false, col: start.col, row: start.row, z: 56 });
    const flying = flightFrame(start, 2, 15, launchStart(2) + 1, 6);
    expect(flying.held).toBe(false);
    expect(flying.z).toBeGreaterThan(3);
    const landed = flightFrame(start, 2, 15, 1e6, 6);
    expect(landed).toMatchObject({ landed: true, z: 3, row: laneRow(2, 6) });
    expect(landed.col).toBeCloseTo(LAUNCH_LANE.col0 + (15 / LANE_FULL_M) * LAUNCH_LANE.length);
    expect(flightFrame(start, 2, 22, 1e6, 6).col).toBeGreaterThan(landed.col);
  });

  it("quem ergue o planador fica acima da cabeça", () => {
    expect(heldHeight(1)).toBe(56);
    expect(heldHeight(2)).toBeGreaterThan(heldHeight(1));
  });
});
