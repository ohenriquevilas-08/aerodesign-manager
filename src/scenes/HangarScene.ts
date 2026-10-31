// Hangar isométrico (design §11): piso, bancadas e os fundadores circulando enquanto o relógio corre.
// Cada bancada tem um cartão com a tarefa em andamento e as peças (ver hangar/benchView.ts).
// Profundidade: quem está mais à frente (maior y na tela) desenha por cima.
// Lê o store; nunca muda o estado.

import Phaser from "phaser";
import type { GameStore } from "../app/store";
import type { GameState, PartState } from "../sim";
import { benchViewsFromState, type BenchId, type BenchView } from "./hangar/benchView";
import { css, fonts, palette } from "./palette";

const TILE_W = 64;
const TILE_H = 32;
const COLS = 10;
const ROWS = 8;
const BENCH_LIFT = 18;
/** Cartões ficam acima de tudo que anda no piso. */
const CARD_DEPTH = 1_000_000;
const FLOOR_DEPTH = -1_000_000;

interface Bench {
  id: BenchId;
  col: number;
  row: number;
}

// Uma bancada em cada canto do piso, para os cartões não se cobrirem.
const BENCHES: Bench[] = [
  { id: "wing", col: 1, row: 1 },
  { id: "fuselage", col: 7, row: 1 },
  { id: "electronics", col: 1, row: 5 },
  { id: "report", col: 7, row: 5 }
];

const PART_COLOR: Record<PartState, number> = {
  new: palette.ok,
  worn: palette.accent,
  damaged: palette.warn,
  broken: palette.danger
};

/** Phaser 4 tipa polígonos como Vector2[]. */
function vec(points: { x: number; y: number }[]): Phaser.Math.Vector2[] {
  return points.map(({ x, y }) => new Phaser.Math.Vector2(x, y));
}

/** Coordenada isométrica do centro do tile, em pixels do mundo. */
function iso(col: number, row: number): { x: number; y: number } {
  return { x: (col - row) * (TILE_W / 2), y: (col + row) * (TILE_H / 2) };
}

interface BenchCard {
  container: Phaser.GameObjects.Container;
  bar: Phaser.GameObjects.Graphics;
  task: Phaser.GameObjects.Text;
  percent: Phaser.GameObjects.Text;
  parts: Phaser.GameObjects.Container;
  /** Assinatura do último desenho, para só redesenhar quando muda. */
  key: string;
}

const CARD_W = 128;

export class HangarScene extends Phaser.Scene {
  private store!: GameStore;
  private people: Phaser.GameObjects.Container[] = [];
  private cards = new Map<BenchId, BenchCard>();
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super("hangar");
  }

  init(data: { store: GameStore }) {
    this.store = data.store;
  }

  create() {
    this.drawFloor();
    BENCHES.forEach((bench) => this.drawBench(bench));
    this.store.getState().members.forEach((member, index) => this.spawnPerson(member.name, index));
    this.refreshCards(this.store.getState());

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.applySpeed(this.store.getState().clock.speed);
    this.unsubscribe = this.store.subscribe((state) => {
      this.applySpeed(state.clock.speed);
      this.refreshCards(state);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.scale.off("resize", this.layout, this);
    });
  }

  update() {
    // Ordem de desenho pela posição no piso: quem está mais embaixo na tela fica na frente.
    this.people.forEach((person) => person.setDepth(person.y));
  }

  private layout() {
    const { width, height } = this.scale;
    const center = iso(COLS / 2, ROWS / 2);
    // Piso + cartões ocupam ~620×400 px; aproxima até preencher o painel.
    const zoom = Phaser.Math.Clamp(Math.min(width / 620, height / 400), 0.7, 1.7);
    this.cameras.main.setZoom(zoom);
    // Sobe um pouco o centro para os cartões das bancadas de trás caberem.
    this.cameras.main.centerOn(center.x, center.y - 30);
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
    const g = this.add.graphics().setDepth(FLOOR_DEPTH);
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
  }

  private drawBench(bench: Bench) {
    const { x, y } = iso(bench.col + 0.5, bench.row + 0.5);
    const w = TILE_W;
    const h = TILE_H;
    const lift = BENCH_LIFT;
    const g = this.add.graphics();
    const top = [
      { x, y: y - h / 2 - lift },
      { x: x + w / 2, y: y - lift },
      { x, y: y + h / 2 - lift },
      { x: x - w / 2, y: y - lift }
    ];
    g.fillStyle(palette.bench, 1);
    g.fillPoints(vec([{ x: x - w / 2, y: y - lift }, { x, y: y + h / 2 - lift }, { x, y: y + h / 2 }, { x: x - w / 2, y }]), true);
    g.fillStyle(palette.bgGrid, 1);
    g.fillPoints(vec([{ x: x + w / 2, y: y - lift }, { x, y: y + h / 2 - lift }, { x, y: y + h / 2 }, { x: x + w / 2, y }]), true);
    g.fillStyle(palette.benchTop, 1);
    g.fillPoints(vec(top), true);
    g.lineStyle(1, palette.accent, 0.8);
    g.strokePoints(vec(top), true);
    // Profundidade pelo centro do tile: quem está atrás (y menor) fica escondido pela bancada.
    g.setDepth(y);

    this.cards.set(bench.id, this.createCard(x, y - h / 2 - lift - 8));
  }

  /** Cartão da bancada: título, tarefa com barra de progresso e peças. Ancorado pela base. */
  private createCard(x: number, bottom: number): BenchCard {
    const container = this.add.container(x, bottom).setDepth(CARD_DEPTH);
    const bar = this.add.graphics();
    const task = this.add
      .text(-CARD_W / 2 + 8, 0, "", { fontFamily: fonts.body, fontSize: "10px", color: palette.textMuted })
      .setResolution(2);
    const percent = this.add
      .text(CARD_W / 2 - 8, 0, "", { fontFamily: fonts.mono, fontSize: "10px", color: palette.text })
      .setOrigin(1, 0)
      .setResolution(2);
    const parts = this.add.container(0, 0);
    container.add([bar, task, percent, parts]);
    return { container, bar, task, percent, parts, key: "" };
  }

  private refreshCards(state: GameState) {
    benchViewsFromState(state).forEach((view) => {
      const card = this.cards.get(view.id);
      if (!card) return;
      const key = JSON.stringify([view.title, view.task?.label, Math.round((view.task?.progress ?? 0) * 100), view.task?.waiting, view.parts]);
      if (key === card.key) return;
      card.key = key;
      this.drawCard(card, view);
    });
  }

  private drawCard(card: BenchCard, view: BenchView) {
    const pad = 8;
    const partRows = view.parts.length;
    const height = 22 + (view.task ? 22 : 0) + partRows * 13 + pad - 2;
    const top = -height;
    const left = -CARD_W / 2;

    const g = card.bar;
    g.clear();
    g.fillStyle(palette.panel, 0.94);
    g.fillRoundedRect(left, top, CARD_W, height, 6);
    g.lineStyle(1, palette.border, 1);
    g.strokeRoundedRect(left, top, CARD_W, height, 6);
    // Pino ligando o cartão à bancada.
    g.fillStyle(palette.border, 1);
    g.fillTriangle(-5, 0, 5, 0, 0, 6);

    card.parts.removeAll(true);
    const title = this.add
      .text(left + pad, top + 4, view.title.toUpperCase(), {
        fontFamily: fonts.display,
        fontSize: "14px",
        fontStyle: "600",
        color: palette.text,
        letterSpacing: 1
      })
      .setResolution(2);
    card.parts.add(title);

    let y = top + 22;
    if (view.task) {
      const progress = Phaser.Math.Clamp(view.task.progress, 0, 1);
      card.percent
        .setText(`${Math.round(progress * 100)}%`)
        .setColor(view.task.waiting ? palette.textMuted : palette.text)
        .setPosition(-left - pad, top + 7)
        .setVisible(true);
      card.task.setText(view.task.waiting ? `${view.task.label} · espera` : view.task.label).setPosition(left + pad, y).setVisible(true);
      const barY = y + 14;
      const barW = CARD_W - pad * 2;
      g.fillStyle(palette.bgGrid, 1);
      g.fillRoundedRect(left + pad, barY, barW, 5, 2.5);
      const color = view.task.waiting ? palette.inkMuted : palette.accent;
      if (view.task.waiting) {
        // Espera de prazo: barra tracejada.
        g.fillStyle(color, 0.8);
        for (let dx = 0; dx < barW * progress; dx += 6) g.fillRect(left + pad + dx, barY, Math.min(3, barW * progress - dx), 5);
      } else if (progress > 0) {
        g.fillStyle(color, 1);
        g.fillRoundedRect(left + pad, barY, Math.max(5, barW * progress), 5, 2.5);
      }
      y += 22;
    } else {
      card.task.setVisible(false);
      card.percent.setVisible(false);
    }

    view.parts.forEach((part) => {
      const dot = this.add.circle(left + pad + 3, y + 6, 3, PART_COLOR[part.state]);
      const label = this.add
        .text(left + pad + 11, y + 1, part.label, { fontFamily: fonts.body, fontSize: "10px", color: css(palette.ink) })
        .setResolution(2);
      card.parts.add([dot, label]);
      y += 13;
    });
  }

  private spawnPerson(name: string, index: number) {
    const start = iso(4 + index, 3 + (index % 2));
    const token = this.add.container(start.x, start.y);
    const body = this.add.circle(0, -12, 10, index === 0 ? palette.highlight : palette.accent);
    const shadow = this.add.ellipse(0, 0, 18, 8, palette.bg, 0.45);
    const initials = this.add
      .text(0, -12, name.slice(0, 1).toUpperCase(), { fontFamily: fonts.body, fontSize: "11px", fontStyle: "700", color: css(palette.bg) })
      .setOrigin(0.5)
      .setResolution(2);
    token.add([shadow, body, initials]);
    token.setDepth(start.y);
    this.people.push(token);
    this.walk(token);
  }

  /** Vai até a frente de uma bancada (abaixo dela na tela, longe do cartão), trabalha e segue. */
  private walk(token: Phaser.GameObjects.Container) {
    const bench = Phaser.Utils.Array.GetRandom(BENCHES);
    const target = iso(bench.col + 0.5 + Phaser.Math.FloatBetween(-0.4, 0.6), bench.row + 1.25);
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
