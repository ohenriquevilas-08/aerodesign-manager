// Hangar isométrico (design §11). Por enquanto é o esqueleto da cena: piso, bancadas
// e os fundadores circulando enquanto o relógio corre. Lê o store; nunca muda o estado.

import Phaser from "phaser";
import type { GameStore } from "../app/store";
import { palette } from "./palette";

const TILE_W = 64;
const TILE_H = 32;
const COLS = 10;
const ROWS = 8;

interface Bench {
  label: string;
  col: number;
  row: number;
}

const BENCHES: Bench[] = [
  { label: "ASA", col: 2, row: 1 },
  { label: "FUSELAGEM", col: 6, row: 1 },
  { label: "ELETRÔNICA", col: 2, row: 5 },
  { label: "RELATÓRIO", col: 6, row: 5 }
];

/** Phaser 4 tipa polígonos como Vector2[]. */
function vec(points: { x: number; y: number }[]): Phaser.Math.Vector2[] {
  return points.map(({ x, y }) => new Phaser.Math.Vector2(x, y));
}

/** Coordenada isométrica do centro do tile, relativa ao container. */
function iso(col: number, row: number): { x: number; y: number } {
  return { x: (col - row) * (TILE_W / 2), y: (col + row) * (TILE_H / 2) };
}

export class HangarScene extends Phaser.Scene {
  private store!: GameStore;
  private world!: Phaser.GameObjects.Container;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super("hangar");
  }

  init(data: { store: GameStore }) {
    this.store = data.store;
  }

  create() {
    this.world = this.add.container(0, 0);
    this.drawFloor();
    BENCHES.forEach((bench) => this.drawBench(bench));
    this.store.getState().members.forEach((member, index) => this.spawnPerson(member.name, index));

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.applySpeed(this.store.getState().clock.speed);
    this.unsubscribe = this.store.subscribe((state) => this.applySpeed(state.clock.speed));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
  }

  private layout() {
    const { width, height } = this.scale;
    const center = iso(COLS / 2, ROWS / 2);
    this.world.setPosition(width / 2 - center.x, height / 2 - center.y);
  }

  /** O tempo da cena acompanha o relógio do jogo: pausa junto e acelera junto. */
  private applySpeed(speed: number) {
    if (speed === 0) {
      this.tweens.pauseAll();
      this.time.paused = true;
      return;
    }
    this.time.paused = false;
    this.time.timeScale = speed;
    this.tweens.timeScale = speed;
    this.tweens.resumeAll();
  }

  private drawFloor() {
    const g = this.add.graphics();
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const { x, y } = iso(col, row);
        const points = [
          { x, y: y - TILE_H / 2 },
          { x: x + TILE_W / 2, y },
          { x, y: y + TILE_H / 2 },
          { x: x - TILE_W / 2, y }
        ];
        g.fillStyle(palette.floor, 1);
        g.fillPoints(vec(points), true);
        g.lineStyle(1, palette.floorLine, 0.6);
        g.strokePoints(vec(points), true);
      }
    }
    this.world.add(g);
  }

  private drawBench(bench: Bench) {
    const { x, y } = iso(bench.col + 0.5, bench.row + 0.5);
    const w = TILE_W;
    const h = TILE_H;
    const lift = 18;
    const g = this.add.graphics();
    const top = [
      { x, y: y - h / 2 - lift },
      { x: x + w / 2, y: y - lift },
      { x, y: y + h / 2 - lift },
      { x: x - w / 2, y: y - lift }
    ];
    g.fillStyle(palette.bench, 1);
    g.fillPoints(vec([{ x: x - w / 2, y: y - lift }, { x, y: y + h / 2 - lift }, { x, y: y + h / 2 }, { x: x - w / 2, y }]), true);
    g.fillStyle(0x0c1b29, 1);
    g.fillPoints(vec([{ x: x + w / 2, y: y - lift }, { x, y: y + h / 2 - lift }, { x, y: y + h / 2 }, { x: x + w / 2, y }]), true);
    g.fillStyle(palette.benchTop, 1);
    g.fillPoints(vec(top), true);
    g.lineStyle(1, palette.accent, 0.8);
    g.strokePoints(vec(top), true);
    const label = this.add
      .text(x, y - lift - 30, bench.label, {
        fontFamily: "Barlow Condensed",
        fontSize: "15px",
        fontStyle: "600",
        color: palette.text
      })
      .setOrigin(0.5);
    this.world.add([g, label]);
  }

  private spawnPerson(name: string, index: number) {
    const start = iso(4 + index, 3 + (index % 2));
    const token = this.add.container(start.x, start.y);
    const body = this.add.circle(0, -12, 10, index === 0 ? palette.highlight : palette.accent);
    const shadow = this.add.ellipse(0, 0, 18, 8, 0x000000, 0.35);
    const initials = this.add
      .text(0, -12, name.slice(0, 1).toUpperCase(), { fontFamily: "Inter", fontSize: "11px", fontStyle: "700", color: "#08121c" })
      .setOrigin(0.5);
    token.add([shadow, body, initials]);
    this.world.add(token);
    this.walk(token);
  }

  private walk(token: Phaser.GameObjects.Container) {
    const bench = Phaser.Utils.Array.GetRandom(BENCHES);
    const target = iso(bench.col + 0.5 + Phaser.Math.FloatBetween(-0.6, 0.6), bench.row + 1.4);
    const distance = Phaser.Math.Distance.Between(token.x, token.y, target.x, target.y);
    this.tweens.add({
      targets: token,
      x: target.x,
      y: target.y,
      duration: distance * 12,
      ease: "Sine.easeInOut",
      onComplete: () => this.time.delayedCall(Phaser.Math.Between(1200, 3000), () => this.walk(token))
    });
  }
}
