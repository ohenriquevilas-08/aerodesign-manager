import { describe, expect, it } from "vitest";
import { ARRIVAL_S, CREW_WATCH_X, PLANE_READY_X, VAN_PARK_X, arrivalFrame, sessionProgress, sessionTitle } from "../../src/scenes/flight/session";
import { COMPETITION_SCENERY, SCENERY_IDS, sceneryForVenue } from "../../src/scenes/flight/scenery";

describe("vinheta de chegada", () => {
  it("a van chega e para no ponto, e as portas abrem depois", () => {
    expect(arrivalFrame(0, 3).van.x).toBeLessThan(VAN_PARK_X - 30);
    expect(arrivalFrame(0, 3).van.moving).toBe(true);
    expect(arrivalFrame(3, 3).van.moving).toBe(false);
    expect(arrivalFrame(3, 3).van.x).toBeCloseTo(VAN_PARK_X, 0);
    expect(arrivalFrame(2, 3).van.doorsOpen).toBe(false);
    expect(arrivalFrame(4, 3).van.doorsOpen).toBe(true);
  });

  it("a equipe só aparece com as portas abertas e carrega o avião até a largada", () => {
    expect(arrivalFrame(1, 3).crew.every((c) => !c.visible)).toBe(true);
    expect(arrivalFrame(1, 3).plane.visible).toBe(false);
    const mid = arrivalFrame(5, 3);
    expect(mid.plane.carried).toBe(true);
    expect(mid.plane.h).toBeGreaterThan(0);
    expect(mid.crew.every((c) => c.carrying)).toBe(true);
    const end = arrivalFrame(ARRIVAL_S, 3);
    expect(end.done).toBe(true);
    expect(end.plane.x).toBeCloseTo(PLANE_READY_X);
    expect(end.plane.h).toBe(0);
    expect(end.crew[0]!.x).toBeCloseTo(CREW_WATCH_X);
  });

  it("o avião anda só para a frente enquanto é carregado", () => {
    let last = -Infinity;
    for (let t = 3; t <= ARRIVAL_S; t += 0.25) {
      const x = arrivalFrame(t, 2).plane.x;
      expect(x).toBeGreaterThanOrEqual(last - 1e-9);
      last = x;
    }
  });

  it("funciona sem tripulação e respeita o tamanho da equipe", () => {
    expect(arrivalFrame(5, 0).crew).toEqual([]);
    expect(arrivalFrame(5, 4).crew).toHaveLength(4);
  });

  it("o título numera as decolagens", () => {
    expect(sessionTitle("Campo do aeroclube")).toBe("ENSAIO · CAMPO DO AEROCLUBE");
    expect(sessionProgress(1, 3)).toBe("DECOLAGEM 2/3");
  });
});

describe("cenário do local", () => {
  it("cada local conhecido tem cenário próprio e o desconhecido cai no aeroclube", () => {
    expect(new Set(SCENERY_IDS.map((id) => sceneryForVenue(id).skyTop)).size).toBe(SCENERY_IDS.length);
    expect(sceneryForVenue("nao-existe").id).toBe("aeroclub");
    expect(sceneryForVenue("farm").backdrop).toBe("barn");
    expect(COMPETITION_SCENERY.backdrop).toBe("hills");
  });
});
