import { describe, expect, it } from "vitest";
import { palette } from "../../src/scenes/palette";

/** Cinza: canais quase iguais e claros o bastante para não ser preto. */
const isGrey = (color: number): boolean => {
  const channels = [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
  return Math.max(...channels) - Math.min(...channels) < 0x20 && Math.max(...channels) > 0x60;
};

describe("paleta de cabelo dos alunos (Fase 8, S5)", () => {
  it("não tem cabelo cinza", () => {
    expect(palette.hair.filter(isGrey)).toEqual([]);
  });
});
