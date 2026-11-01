// Desenho dos polígonos de people/avatar.ts num Graphics do Phaser. Quem desenha bonecos nas cenas
// (hangar, vinheta do ensaio) usa isto, e o SVG das cartas usa os mesmos polígonos: o boneco é um só.
// Phaser 4.2: fillPoints e strokePoints exigem Vector2[].

import Phaser from "phaser";
import type { AvatarShape } from "./avatar";

/** Desenha `shapes` em `g` com os pés em (x, y), na escala dada. Não limpa o Graphics. */
export function drawAvatarShapes(g: Phaser.GameObjects.Graphics, shapes: AvatarShape[], x = 0, y = 0, scale = 1) {
  for (const shape of shapes) {
    const points = shape.points.map(([px, py]) => new Phaser.Math.Vector2(x + px * scale, y + py * scale));
    if (shape.line) g.lineStyle(1, shape.fill, 1).strokePoints(points, true, true);
    else g.fillStyle(shape.fill, 1).fillPoints(points, true);
  }
}
