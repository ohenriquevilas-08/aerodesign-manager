// Geometria isométrica do hangar: tiles 64×32, coluna cresce para baixo-direita, linha para baixo-esquerda.
// `isoBox` desenha qualquer volume (bancada, parede, fuselagem) com topo e as duas faces visíveis.

import Phaser from "phaser";

export const TILE_W = 64;
export const TILE_H = 32;

/** Ponto no piso (col, row) elevado z pixels, em pixels do mundo. */
export function iso(col: number, row: number, z = 0): { x: number; y: number } {
  return { x: (col - row) * (TILE_W / 2), y: (col + row) * (TILE_H / 2) - z };
}

/** Phaser 4 tipa polígonos como Vector2[]. */
export function vec(points: { x: number; y: number }[]): Phaser.Math.Vector2[] {
  return points.map(({ x, y }) => new Phaser.Math.Vector2(x, y));
}

export interface BoxColors {
  top: number;
  /** Face voltada para baixo-esquerda (lado de maior linha). */
  left: number;
  /** Face voltada para baixo-direita (lado de maior coluna). */
  right: number;
  /** Contorno do topo, opcional. */
  edge?: number;
  alpha?: number;
}

/** Volume de col0..col1 × row0..row1, da altura z0 até z0 + height (pixels). */
export function isoBox(
  g: Phaser.GameObjects.Graphics,
  col0: number,
  col1: number,
  row0: number,
  row1: number,
  z0: number,
  height: number,
  colors: BoxColors
) {
  const z1 = z0 + height;
  const alpha = colors.alpha ?? 1;
  g.fillStyle(colors.left, alpha);
  g.fillPoints(vec([iso(col0, row1, z0), iso(col1, row1, z0), iso(col1, row1, z1), iso(col0, row1, z1)]), true);
  g.fillStyle(colors.right, alpha);
  g.fillPoints(vec([iso(col1, row0, z0), iso(col1, row1, z0), iso(col1, row1, z1), iso(col1, row0, z1)]), true);
  const top = vec([iso(col0, row0, z1), iso(col1, row0, z1), iso(col1, row1, z1), iso(col0, row1, z1)]);
  g.fillStyle(colors.top, alpha);
  g.fillPoints(top, true);
  if (colors.edge !== undefined) {
    g.lineStyle(1, colors.edge, 0.8 * alpha);
    g.strokePoints(top, true);
  }
}

/** Quadrilátero numa parede de linha fixa (parede do fundo à direita): col0..col1, altura z0..z1. */
export function rowWallQuad(row: number, col0: number, col1: number, z0: number, z1: number) {
  return vec([iso(col0, row, z0), iso(col1, row, z0), iso(col1, row, z1), iso(col0, row, z1)]);
}

/** Quadrilátero numa parede de coluna fixa (parede do fundo à esquerda): row0..row1, altura z0..z1. */
export function colWallQuad(col: number, row0: number, row1: number, z0: number, z1: number) {
  return vec([iso(col, row0, z0), iso(col, row1, z0), iso(col, row1, z1), iso(col, row0, z1)]);
}
