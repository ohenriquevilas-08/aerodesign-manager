import { describe, expect, it } from "vitest";
import { AVATAR_BOUNDS, avatarShapes } from "../../src/scenes/people/avatar";
import { palette } from "../../src/scenes/palette";
import type { MemberLook } from "../../src/sim";

const look: MemberLook = { skin: 2, hair: 1, hairColor: 3, shirt: 0xff9f2e };

describe("avatar isométrico", () => {
  it("é determinístico", () => {
    expect(avatarShapes(look, "work", { phase: 0.4 })).toEqual(avatarShapes(look, "work", { phase: 0.4 }));
  });

  it("usa a cor da camiseta, a pele e o cabelo do look", () => {
    const colors = avatarShapes(look, "stand").map((s) => s.fill);
    expect(colors).toContain(look.shirt);
    expect(colors).toContain(palette.skin[2]);
    expect(colors).toContain(palette.hair[3]);
  });

  it("aparências diferentes dão desenhos diferentes", () => {
    const stand = avatarShapes(look, "stand");
    expect(avatarShapes({ ...look, skin: 4 }, "stand")).not.toEqual(stand);
    expect(avatarShapes({ ...look, hair: 3 }, "stand")).not.toEqual(stand);
    expect(avatarShapes({ ...look, accessory: "glasses" }, "stand").length).toBeGreaterThan(stand.length);
  });

  it("as poses mudam a geometria e a fase move o braço", () => {
    const stand = avatarShapes(look, "stand");
    expect(avatarShapes(look, "work")).not.toEqual(stand);
    expect(avatarShapes(look, "nap")).not.toEqual(stand);
    expect(avatarShapes(look, "work", { phase: 1 })).not.toEqual(avatarShapes(look, "work", { phase: 0 }));
    // Fora do trabalho a fase não faz nada.
    expect(avatarShapes(look, "stand", { phase: 1 })).toEqual(stand);
  });

  it("espelhar inverte o x e mantém o y", () => {
    const a = avatarShapes(look, "stand", { facing: 1 });
    const b = avatarShapes(look, "stand", { facing: -1 });
    expect(b).toHaveLength(a.length);
    a.forEach((shape, i) =>
      shape.points.forEach(([x, y], j) => {
        expect(b[i]!.points[j]![0]).toBeCloseTo(-x);
        expect(b[i]!.points[j]![1]).toBeCloseTo(y);
      })
    );
  });

  it("cabe em AVATAR_BOUNDS em qualquer pose", () => {
    for (const pose of ["stand", "work", "nap"] as const) {
      for (const phase of [0, 0.5, 1]) {
        for (const facing of [1, -1] as const) {
          for (const shape of avatarShapes({ ...look, accessory: "cap", hair: 3 }, pose, { phase, facing })) {
            for (const [x, y] of shape.points) {
              expect(x).toBeGreaterThanOrEqual(AVATAR_BOUNDS.minX);
              expect(x).toBeLessThanOrEqual(AVATAR_BOUNDS.maxX);
              expect(y).toBeGreaterThanOrEqual(AVATAR_BOUNDS.minY);
              expect(y).toBeLessThanOrEqual(AVATAR_BOUNDS.maxY);
            }
          }
        }
      }
    }
  });

  it("todo polígono tem ao menos 3 pontos finitos", () => {
    for (const shape of avatarShapes(look, "nap")) {
      expect(shape.points.length).toBeGreaterThanOrEqual(3);
      shape.points.forEach(([x, y]) => expect(Number.isFinite(x + y)).toBe(true));
    }
  });
});
