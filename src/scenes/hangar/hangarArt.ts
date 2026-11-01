// Desenho do hangar só com formas da paleta: paredes, porta, janelas, piso, bancadas com
// os objetos de cada disciplina e o avião montado no centro. Funções puras de desenho:
// recebem um Graphics e não guardam estado.

import Phaser from "phaser";
import type { PartState } from "../../sim";
import { palette, shade } from "../palette";
import type { AircraftView, BenchId } from "./benchView";
import { colWallQuad, iso, isoBox, rowWallQuad, TILE_H, TILE_W, vec } from "./iso";

export const COLS = 10;
export const ROWS = 8;
export const WALL_H = 120;
/** Altura do tampo das bancadas, px. */
export const BENCH_TOP = 22;
/** Comprimento da bancada ao longo das colunas, em tiles. */
export const BENCH_LEN = 1.6;

/** Centro do avião no cavalete: no fundo, na frente do portão. */
const AIRCRAFT = { col: 4.45, row: 1.95 };
/** Zona de montagem pintada no piso, em volta do avião. */
const ZONE = { col0: 2.45, col1: 6.5, row0: 0.6, row1: 3.3 };

export function drawRoom(g: Phaser.GameObjects.Graphics) {
  // Piso xadrez discreto.
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const { x, y } = iso(col, row);
      const tile = vec([
        { x, y: y - TILE_H / 2 },
        { x: x + TILE_W / 2, y },
        { x, y: y + TILE_H / 2 },
        { x: x - TILE_W / 2, y }
      ]);
      g.fillStyle((col + row) % 2 === 0 ? palette.floor : palette.bgGrid, 1);
      g.fillPoints(tile, true);
      g.lineStyle(1, palette.floorLine, 0.35);
      g.strokePoints(tile, true);
    }
  }

  // Luz das janelas entrando no piso.
  [1.2, 4.2].forEach((r0) => {
    g.fillStyle(palette.accent, 0.05);
    g.fillPoints(vec([iso(-0.5, r0), iso(-0.5, r0 + 1.6), iso(2.4, r0 + 2.6), iso(2.4, r0 + 1)]), true);
  });

  // Zona de montagem: faixa tracejada de segurança.
  g.lineStyle(2, palette.highlight, 0.55);
  const corners = [iso(ZONE.col0, ZONE.row0), iso(ZONE.col1, ZONE.row0), iso(ZONE.col1, ZONE.row1), iso(ZONE.col0, ZONE.row1)];
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % 4]!;
    const steps = Math.round(Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / 10);
    for (let s = 0; s < steps; s += 2) {
      g.lineBetween(
        Phaser.Math.Linear(a.x, b.x, s / steps),
        Phaser.Math.Linear(a.y, b.y, s / steps),
        Phaser.Math.Linear(a.x, b.x, (s + 1) / steps),
        Phaser.Math.Linear(a.y, b.y, (s + 1) / steps)
      );
    }
  });

  drawWalls(g);
}

function drawWalls(g: Phaser.GameObjects.Graphics) {
  const top = palette.borderStrong;
  // Parede esquerda (face interna voltada para baixo-direita).
  isoBox(g, -0.8, -0.5, -0.8, ROWS - 0.5, 0, WALL_H, { top, left: palette.bgGrid, right: palette.panel });
  // Parede do fundo (face interna voltada para baixo-esquerda).
  isoBox(g, -0.8, COLS - 0.5, -0.8, -0.5, 0, WALL_H, { top, left: palette.panelRaised, right: palette.bgGrid });

  // Rodapé.
  g.fillStyle(palette.border, 1);
  g.fillPoints(rowWallQuad(-0.5, -0.5, COLS - 0.5, 0, 6), true);
  g.fillPoints(colWallQuad(-0.5, -0.5, ROWS - 0.5, 0, 6), true);

  // Portão do hangar com ripas e faixa de atenção.
  const door = { col0: 4.3, col1: 8.1, z1: 94 };
  g.fillStyle(palette.bgGrid, 1);
  g.fillPoints(rowWallQuad(-0.5, door.col0, door.col1, 0, door.z1), true);
  g.lineStyle(1, palette.border, 0.9);
  for (let z = 10; z < door.z1; z += 8) {
    const a = iso(door.col0, -0.5, z);
    const b = iso(door.col1, -0.5, z);
    g.lineBetween(a.x, a.y, b.x, b.y);
  }
  for (let i = 0; i < 10; i += 1) {
    const c0 = door.col0 + ((door.col1 - door.col0) * i) / 10;
    const c1 = door.col0 + ((door.col1 - door.col0) * (i + 1)) / 10;
    g.fillStyle(i % 2 === 0 ? palette.highlight : palette.bg, 0.85);
    g.fillPoints(rowWallQuad(-0.5, c0, c1, 0, 6), true);
  }
  g.lineStyle(3, palette.borderStrong, 1);
  g.strokePoints(rowWallQuad(-0.5, door.col0, door.col1, 0, door.z1), true);

  // Quadro de avisos com post-its (prazos, regulamento).
  g.fillStyle(palette.panel, 1);
  g.fillPoints(rowWallQuad(-0.5, 0.5, 2.9, 44, 90), true);
  g.lineStyle(2, palette.borderStrong, 1);
  g.strokePoints(rowWallQuad(-0.5, 0.5, 2.9, 44, 90), true);
  const notes: [number, number, number][] = [
    [0.7, 72, palette.highlight],
    [1.15, 74, palette.accent],
    [1.6, 70, palette.ok],
    [2.1, 73, palette.warn],
    [0.8, 52, palette.ink],
    [1.4, 55, palette.highlight],
    [2.3, 52, palette.accent]
  ];
  notes.forEach(([c, z, color]) => {
    g.fillStyle(color, 0.85);
    g.fillPoints(rowWallQuad(-0.5, c, c + 0.32, z, z + 12), true);
  });

  // Luminárias de parede.
  [3.4, 9].forEach((c) => {
    const p = iso(c, -0.5, 100);
    g.fillStyle(palette.warn, 0.12);
    g.fillCircle(p.x, p.y, 16);
    g.fillStyle(palette.warn, 0.9);
    g.fillCircle(p.x, p.y, 3);
  });

  // Janelas da parede esquerda.
  [1.2, 4.2].forEach((r0) => {
    const r1 = r0 + 1.6;
    g.fillStyle(palette.accent, 0.22);
    g.fillPoints(colWallQuad(-0.5, r0, r1, 44, 96), true);
    g.lineStyle(2, palette.borderStrong, 1);
    g.strokePoints(colWallQuad(-0.5, r0, r1, 44, 96), true);
    const mid = (r0 + r1) / 2;
    const a = iso(-0.5, mid, 44);
    const b = iso(-0.5, mid, 96);
    g.lineBetween(a.x, a.y, b.x, b.y);
    const c = iso(-0.5, r0, 70);
    const d = iso(-0.5, r1, 70);
    g.lineBetween(c.x, c.y, d.x, d.y);
  });

  // Estante com caixas no canto esquerdo.
  const shelf = { col0: -0.5, col1: 0, row0: 6.4, row1: 7.4 };
  [0, 22, 44].forEach((z) =>
    isoBox(g, shelf.col0, shelf.col1, shelf.row0, shelf.row1, z, 3, { top: palette.borderStrong, left: palette.border, right: palette.bgGrid })
  );
  isoBox(g, -0.45, -0.1, 6.5, 6.9, 3, 14, { top: palette.highlight, left: shade(palette.highlight, 0.25), right: shade(palette.highlight, 0.45) });
  isoBox(g, -0.45, -0.15, 7.0, 7.3, 3, 10, { top: palette.ink, left: palette.inkMuted, right: palette.inkDim });
  isoBox(g, -0.45, -0.1, 6.6, 7.2, 25, 12, { top: palette.accent, left: shade(palette.accent, 0.25), right: shade(palette.accent, 0.45) });
}

/** Bancada com pés, prateleira e os objetos da disciplina em cima. Origem: canto (col, row). */
export function drawBench(g: Phaser.GameObjects.Graphics, id: BenchId, col: number, row: number) {
  const c0 = col;
  const c1 = col + BENCH_LEN;
  const r0 = row + 0.15;
  const r1 = row + 0.95;
  const leg = { top: palette.border, left: palette.border, right: palette.bgGrid };

  // Luz sobre a bancada.
  const center = iso(col + BENCH_LEN / 2, row + 0.55);
  g.fillStyle(palette.accent, 0.05);
  g.fillEllipse(center.x, center.y + 10, 170, 80);
  g.fillEllipse(center.x, center.y + 10, 110, 52);

  isoBox(g, c0 + 0.05, c0 + 0.12, r0 + 0.05, r0 + 0.12, 0, BENCH_TOP - 4, leg);
  isoBox(g, c1 - 0.12, c1 - 0.05, r0 + 0.05, r0 + 0.12, 0, BENCH_TOP - 4, leg);
  isoBox(g, c0 + 0.05, c1 - 0.05, r0 + 0.1, r1 - 0.1, 5, 2, { top: palette.border, left: palette.bgGrid, right: palette.bgGrid });
  isoBox(g, c0 + 0.05, c0 + 0.12, r1 - 0.12, r1 - 0.05, 0, BENCH_TOP - 4, leg);
  isoBox(g, c1 - 0.12, c1 - 0.05, r1 - 0.12, r1 - 0.05, 0, BENCH_TOP - 4, leg);
  isoBox(g, c0, c1, r0, r1, BENCH_TOP - 4, 4, {
    top: palette.benchTop,
    left: palette.bench,
    right: palette.bgGrid,
    edge: palette.accent
  });

  const z = BENCH_TOP;
  switch (id) {
    case "wing": {
      // Painel de asa com nervuras.
      isoBox(g, c0 + 0.12, c1 - 0.12, r0 + 0.2, r1 - 0.25, z, 3, { top: palette.ink, left: palette.inkMuted, right: palette.inkDim });
      g.lineStyle(1, palette.borderStrong, 0.9);
      for (let c = c0 + 0.25; c < c1 - 0.15; c += 0.17) {
        const a = iso(c, r0 + 0.2, z + 3);
        const b = iso(c, r1 - 0.25, z + 3);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
      // Lixa ao lado.
      isoBox(g, c1 - 0.35, c1 - 0.15, r1 - 0.2, r1 - 0.08, z, 3, { top: palette.highlight, left: shade(palette.highlight, 0.3), right: shade(palette.highlight, 0.5) });
      break;
    }
    case "fuselage": {
      // Treliça em arame: caixa só de arestas com diagonais.
      const a0 = c0 + 0.25;
      const a1 = c1 - 0.25;
      const b0 = r0 + 0.25;
      const b1 = r1 - 0.25;
      const h = 16;
      const p = (c: number, r: number, zz: number) => iso(c, r, z + zz);
      g.lineStyle(1.5, palette.accent, 1);
      const edges: [number, number, number, number, number, number][] = [
        [a0, b0, 0, a1, b0, 0],
        [a0, b1, 0, a1, b1, 0],
        [a0, b0, h, a1, b0, h],
        [a0, b1, h, a1, b1, h],
        [a0, b0, 0, a0, b0, h],
        [a1, b0, 0, a1, b0, h],
        [a0, b1, 0, a0, b1, h],
        [a1, b1, 0, a1, b1, h],
        [a0, b0, h, a0, b1, h],
        [a1, b0, h, a1, b1, h]
      ];
      edges.forEach(([ca, ra, za, cb, rb, zb]) => {
        const s = p(ca, ra, za);
        const e = p(cb, rb, zb);
        g.lineBetween(s.x, s.y, e.x, e.y);
      });
      g.lineStyle(1, palette.accent, 0.6);
      for (let i = 0; i < 3; i += 1) {
        const ca = a0 + ((a1 - a0) * i) / 3;
        const cb = a0 + ((a1 - a0) * (i + 1)) / 3;
        const s = p(ca, b1, 0);
        const e = p(cb, b1, h);
        g.lineBetween(s.x, s.y, e.x, e.y);
      }
      break;
    }
    case "electronics": {
      // Bateria, multímetro com tela acesa e fios.
      isoBox(g, c0 + 0.15, c0 + 0.55, r0 + 0.3, r1 - 0.2, z, 7, { top: palette.highlight, left: shade(palette.highlight, 0.3), right: shade(palette.highlight, 0.5) });
      isoBox(g, c0 + 0.9, c0 + 1.3, r0 + 0.2, r0 + 0.45, z, 14, { top: palette.panelRaised, left: palette.panel, right: palette.bgGrid });
      g.fillStyle(palette.ok, 0.85);
      g.fillPoints(vec([iso(c0 + 0.96, r0 + 0.45, z + 5), iso(c0 + 1.24, r0 + 0.45, z + 5), iso(c0 + 1.24, r0 + 0.45, z + 12), iso(c0 + 0.96, r0 + 0.45, z + 12)]), true);
      g.lineStyle(1.5, palette.danger, 0.9);
      const w0 = iso(c0 + 0.5, r0 + 0.45, z + 6);
      const w1 = iso(c0 + 0.95, r1 - 0.15, z + 1);
      g.lineBetween(w0.x, w0.y, w1.x, w1.y);
      g.lineStyle(1.5, palette.ink, 0.9);
      const w2 = iso(c0 + 0.5, r0 + 0.6, z + 6);
      const w3 = iso(c0 + 1.1, r1 - 0.12, z + 1);
      g.lineBetween(w2.x, w2.y, w3.x, w3.y);
      break;
    }
    case "report": {
      // Notebook aberto e pilhas de papel.
      isoBox(g, c0 + 0.3, c0 + 0.8, r0 + 0.3, r1 - 0.15, z, 2, { top: palette.inkDim, left: palette.border, right: palette.bgGrid });
      g.fillStyle(palette.border, 1);
      g.fillPoints(vec([iso(c0 + 0.3, r0 + 0.3, z + 2), iso(c0 + 0.8, r0 + 0.3, z + 2), iso(c0 + 0.8, r0 + 0.3, z + 20), iso(c0 + 0.3, r0 + 0.3, z + 20)]), true);
      g.fillStyle(palette.accent, 0.85);
      g.fillPoints(vec([iso(c0 + 0.34, r0 + 0.31, z + 4), iso(c0 + 0.76, r0 + 0.31, z + 4), iso(c0 + 0.76, r0 + 0.31, z + 18), iso(c0 + 0.34, r0 + 0.31, z + 18)]), true);
      isoBox(g, c0 + 1.0, c0 + 1.35, r0 + 0.25, r1 - 0.3, z, 9, { top: palette.ink, left: palette.inkMuted, right: palette.inkDim });
      isoBox(g, c0 + 1.05, c0 + 1.4, r1 - 0.28, r1 - 0.05, z, 5, { top: palette.ink, left: palette.inkMuted, right: palette.inkDim });
      break;
    }
  }
}

/** Ponto onde nascem as faíscas da solda / pó da lixa, para efeitos da cena. */
export function benchHotspot(id: BenchId, col: number, row: number): { x: number; y: number } {
  if (id === "electronics") return iso(col + 0.95, row + 0.85, BENCH_TOP + 2);
  return iso(col + BENCH_LEN - 0.3, row + 0.8, BENCH_TOP + 4);
}

const BASE: Record<keyof AircraftView, number> = {
  wing: palette.ink,
  fuselage: palette.accent,
  tail: palette.accent,
  landingGear: palette.inkMuted,
  powertrain: palette.ink,
  electronics: palette.ok
};

function partColor(part: keyof AircraftView, state: PartState): number {
  if (state === "damaged") return palette.warn;
  if (state === "broken") return palette.danger;
  return state === "worn" ? shade(BASE[part], 0.3) : BASE[part];
}

function partBox(part: keyof AircraftView, state: PartState) {
  const color = partColor(part, state);
  return { top: color, left: shade(color, 0.25), right: shade(color, 0.45) };
}

/** Avião no cavalete, no meio da zona de montagem; nariz para baixo-direita. Peças null não aparecem. */
export function drawAircraft(g: Phaser.GameObjects.Graphics, view: AircraftView) {
  const row = AIRCRAFT.row;
  // Coordenadas abaixo são do desenho original centrado na coluna 4,9; dc desloca para AIRCRAFT.col.
  const dc = AIRCRAFT.col - 4.9;
  const lift = 18;

  // Sombra e cavaletes.
  const shadow = iso(4.9 + dc, row);
  g.fillStyle(palette.bg, 0.4);
  g.fillEllipse(shadow.x, shadow.y + 4, 200, 46);
  isoBox(g, 4.3 + dc, 4.5 + dc, row - 0.25, row + 0.25, 0, lift, { top: palette.borderStrong, left: palette.border, right: palette.bgGrid });
  isoBox(g, 5.6 + dc, 5.8 + dc, row - 0.25, row + 0.25, 0, lift, { top: palette.borderStrong, left: palette.border, right: palette.bgGrid });

  if (view.tail) {
    isoBox(g, 2.9 + dc, 3.3 + dc, row - 0.5, row + 0.5, lift + 9, 2, partBox("tail", view.tail));
    isoBox(g, 2.9 + dc, 3.85 + dc, row - 0.05, row + 0.05, lift + 6, 4, partBox("tail", view.tail));
    isoBox(g, 2.9 + dc, 3.25 + dc, row - 0.02, row + 0.02, lift + 11, 20, partBox("tail", view.tail));
  }
  if (view.landingGear) {
    const color = partColor("landingGear", view.landingGear);
    g.lineStyle(2, color, 1);
    [
      [5.2 + dc, row - 0.45],
      [5.2 + dc, row + 0.45],
      [6.1 + dc, row]
    ].forEach(([c, r]) => {
      const top = iso(c!, row, lift + 2);
      const wheel = iso(c!, r!, 6);
      g.lineBetween(top.x, top.y, wheel.x, wheel.y);
      g.fillStyle(palette.bg, 1);
      g.fillCircle(wheel.x, wheel.y, 5);
      g.lineStyle(2, color, 1);
      g.strokeCircle(wheel.x, wheel.y, 5);
    });
  }
  if (view.fuselage) {
    isoBox(g, 3.8 + dc, 6.3 + dc, row - 0.16, row + 0.16, lift, 15, { ...partBox("fuselage", view.fuselage), edge: palette.ink });
    if (view.electronics) {
      // Tampa do compartimento de eletrônica.
      g.fillStyle(partColor("electronics", view.electronics), 0.9);
      g.fillPoints(vec([iso(5.7 + dc, row - 0.1, lift + 15), iso(6.1 + dc, row - 0.1, lift + 15), iso(6.1 + dc, row + 0.1, lift + 15), iso(5.7 + dc, row + 0.1, lift + 15)]), true);
    }
  }
  if (view.wing) {
    isoBox(g, 4.75 + dc, 5.4 + dc, row - 1.25, row + 1.25, lift + 16, 3, { ...partBox("wing", view.wing), edge: palette.borderStrong });
  }
  if (view.powertrain) {
    const color = partColor("powertrain", view.powertrain);
    const hub = iso(6.36 + dc, row, lift + 8);
    g.fillStyle(color, 1);
    g.fillCircle(hub.x, hub.y, 3);
    g.lineStyle(3, color, 1);
    const a = iso(6.38 + dc, row - 0.45, lift + 8);
    const b = iso(6.38 + dc, row + 0.45, lift + 8);
    g.lineBetween(a.x, a.y, b.x, b.y);
  }
}

/** Ponto na tela do centro do avião, para profundidade. */
export function aircraftAnchor() {
  return iso(AIRCRAFT.col, AIRCRAFT.row);
}

/** Lado e altura de uma caixa de pedido, em tiles e pixels. */
export const CRATE = { size: 0.42, height: 13 };
/**
 * Caixas encostadas na parede, ao lado esquerdo do portão (o lado direito fica sob o cartão
 * da fuselagem): três no piso e mais três empilhadas por cima.
 */
export const DOOR_CRATE_SLOTS: readonly { col: number; row: number; z: number }[] = [
  { col: 3.75, row: -0.35, z: 0 },
  { col: 3.25, row: -0.35, z: 0 },
  { col: 3.55, row: 0.15, z: 0 },
  { col: 3.75, row: -0.35, z: CRATE.height },
  { col: 3.25, row: -0.35, z: CRATE.height },
  { col: 3.55, row: 0.15, z: CRATE.height }
];
/** Onde a caixa entregue é aberta: na frente das outras, fora da zona de montagem. */
export const UNPACK_SPOT = { col: 3.3, row: 0.6 };

/** Papelão: o laranja da paleta escurecido. */
const CARDBOARD = shade(palette.highlight, 0.35);

/** Caixa de papelão com fita; retida na fiscalização ganha faixa de aviso. Sem tampa se `open`. */
export function drawCrate(g: Phaser.GameObjects.Graphics, col: number, row: number, z: number, held: boolean, open = false) {
  const c1 = col + CRATE.size;
  const r1 = row + CRATE.size;
  const h = CRATE.height;
  isoBox(g, col, c1, row, r1, z, h, { top: open ? shade(CARDBOARD, 0.6) : CARDBOARD, left: shade(CARDBOARD, 0.2), right: shade(CARDBOARD, 0.4) });
  if (!open) {
    // Fita no meio da tampa.
    const mid = col + CRATE.size / 2;
    const a = iso(mid, row, z + h);
    const b = iso(mid, r1, z + h);
    g.lineStyle(2, palette.ink, 0.7);
    g.lineBetween(a.x, a.y, b.x, b.y);
  }
  if (held) {
    // Faixa de aviso nas duas faces visíveis.
    g.fillStyle(palette.warn, 0.95);
    g.fillPoints(vec([iso(col, r1, z + 4), iso(c1, r1, z + 4), iso(c1, r1, z + 8), iso(col, r1, z + 8)]), true);
    g.fillPoints(vec([iso(c1, row, z + 4), iso(c1, r1, z + 4), iso(c1, r1, z + 8), iso(c1, row, z + 8)]), true);
  }
}

/** Tampa solta da caixa (para a animação de abertura), centrada na origem do Graphics. */
export function drawCrateLid(g: Phaser.GameObjects.Graphics) {
  const half = CRATE.size / 2;
  isoBox(g, -half, half, -half, half, 0, 2, { top: CARDBOARD, left: shade(CARDBOARD, 0.2), right: shade(CARDBOARD, 0.4) });
  const a = iso(0, -half, 2);
  const b = iso(0, half, 2);
  g.lineStyle(2, palette.ink, 0.7);
  g.lineBetween(a.x, a.y, b.x, b.y);
}

