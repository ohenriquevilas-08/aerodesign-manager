// Hangar isométrico (design §11), no espírito de Habbo: paredes, portão, bancadas com o trabalho
// de cada disciplina, o avião no cavalete e os integrantes trabalhando nos seus postos.
// Cada bancada tem um cartão com a tarefa em andamento e as peças (ver hangar/benchView.ts).
// Profundidade: quem está mais à frente (maior y na tela) desenha por cima.
// Lê o store; nunca muda o estado. O tempo da cena segue clock.speed.

import Phaser from "phaser";
import type { GameStore } from "../app/store";
import type { GameState, PartState } from "../sim";
import { aircraftViewFromState, benchViewsFromState, type BenchId, type BenchView } from "./hangar/benchView";
import { aircraftAnchor, BENCH_LEN, BENCH_TOP, benchHotspot, COLS, drawAircraft, drawBench, drawRoom, ROWS, WALL_H } from "./hangar/hangarArt";
import { iso } from "./hangar/iso";
import { Worker } from "./hangar/Worker";
import { css, fonts, palette } from "./palette";

/** Cartões ficam acima de tudo que anda no piso. */
const CARD_DEPTH = 1_000_000;
const ROOM_DEPTH = -1_000_000;

interface Bench {
  id: BenchId;
  col: number;
  row: number;
}

// Uma bancada em cada canto do piso, para os cartões não se cobrirem.
const BENCHES: Bench[] = [
  { id: "wing", col: 0.8, row: 1 },
  { id: "fuselage", col: 7.4, row: 1 },
  { id: "electronics", col: 0.8, row: 5.6 },
  { id: "report", col: 7.4, row: 5.6 }
];

const PART_COLOR: Record<PartState, number> = {
  new: palette.ok,
  worn: palette.accent,
  damaged: palette.warn,
  broken: palette.danger
};

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
  private people: Worker[] = [];
  private cards = new Map<BenchId, BenchCard>();
  private aircraft!: Phaser.GameObjects.Graphics;
  private aircraftKey = "";
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super("hangar");
  }

  init(data: { store: GameStore }) {
    this.store = data.store;
  }

  create() {
    drawRoom(this.add.graphics().setDepth(ROOM_DEPTH));
    BENCHES.forEach((bench) => this.createBench(bench));
    this.aircraft = this.add.graphics().setDepth(aircraftAnchor().y);
    this.store.getState().members.forEach((member, index) => this.spawnPerson(member.name, index));
    this.refresh(this.store.getState());
    this.startAmbient();

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.applySpeed(this.store.getState().clock.speed);
    this.unsubscribe = this.store.subscribe((state) => {
      this.applySpeed(state.clock.speed);
      this.refresh(state);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.scale.off("resize", this.layout, this);
    });
  }

  private layout() {
    const { width, height } = this.scale;
    // Caixa do conteúdo: dos cantos do piso, do topo das paredes até a quina da frente.
    const left = iso(-0.8, ROWS - 0.5).x;
    const right = iso(COLS - 0.5, -0.8).x;
    const top = iso(-0.8, -0.8, WALL_H).y;
    const bottom = iso(COLS - 0.5, ROWS - 0.5).y;
    const zoom = Phaser.Math.Clamp(Math.min(width / (right - left + 40), height / (bottom - top + 30)), 0.6, 1.8);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn((left + right) / 2, (top + bottom) / 2);
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

  private refresh(state: GameState) {
    this.refreshCards(state);
    const view = aircraftViewFromState(state);
    const key = JSON.stringify(view);
    if (key === this.aircraftKey) return;
    this.aircraftKey = key;
    this.aircraft.clear();
    drawAircraft(this.aircraft, view);
  }

  private createBench(bench: Bench) {
    const g = this.add.graphics();
    drawBench(g, bench.id, bench.col, bench.row);
    // Profundidade pelo centro da bancada: quem está atrás (y menor) fica escondido por ela.
    g.setDepth(iso(bench.col + BENCH_LEN / 2, bench.row + 0.55).y);
    const anchor = iso(bench.col + BENCH_LEN / 2, bench.row + 0.55, BENCH_TOP + 30);
    this.cards.set(bench.id, this.createCard(anchor.x, anchor.y));
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
    // Cada pessoa fica numa bancada fixa; quando houver tarefas, `member.taskId` decide qual.
    const bench = BENCHES[index % BENCHES.length]!;
    const slot = Math.floor(index / BENCHES.length);
    const col = bench.col + (slot % 2 === 0 ? 0.45 : 1.15);
    const spot = iso(col, bench.row + 1.3);
    this.people.push(new Worker(this, name, index, spot.x, spot.y, slot % 2 === 0));
  }

  /** Vida na oficina: faíscas da solda na eletrônica e pó da lixa na asa, no ritmo do relógio. */
  private startAmbient() {
    BENCHES.forEach((bench) => {
      if (bench.id !== "electronics" && bench.id !== "wing") return;
      const spot = benchHotspot(bench.id, bench.col, bench.row);
      const depth = iso(bench.col + BENCH_LEN / 2, bench.row + 0.55).y + 1;
      const spark = bench.id === "electronics";
      const loop = () => {
        this.burst(spot.x, spot.y, depth, spark);
        this.time.delayedCall(Phaser.Math.Between(spark ? 1200 : 1800, spark ? 3200 : 4200), loop);
      };
      this.time.delayedCall(Phaser.Math.Between(400, 1500), loop);
    });
  }

  private burst(x: number, y: number, depth: number, spark: boolean) {
    for (let i = 0; i < (spark ? 6 : 4); i += 1) {
      const color = spark ? (i % 2 ? palette.warn : palette.highlight) : palette.inkMuted;
      const dot = this.add.circle(x, y, spark ? 1.2 : 2.2, color, spark ? 1 : 0.5).setDepth(depth);
      const angle = spark ? Phaser.Math.FloatBetween(-Math.PI, 0) : Phaser.Math.FloatBetween(-2.4, -0.7);
      const dist = spark ? Phaser.Math.Between(6, 14) : Phaser.Math.Between(4, 9);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - (spark ? 0 : 6),
        alpha: 0,
        scale: spark ? 0.5 : 2,
        duration: spark ? 380 : 1100,
        ease: "Quad.easeOut",
        onComplete: () => dot.destroy()
      });
    }
  }
}
