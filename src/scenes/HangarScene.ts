// Hangar isométrico (design §11), no espírito de Habbo: paredes, portão, bancadas com o trabalho
// de cada disciplina, o avião no cavalete e os integrantes trabalhando nos seus postos.
// Cada bancada tem um cartão com a tarefa em andamento e as peças (ver hangar/benchView.ts);
// cada integrante vai para a bancada da tarefa em que está alocado, ou fica na área livre.
// Pedidos das lojas a caminho viram caixas no portão; o entregue é aberto (hangar/packages.ts).
// A escala da oficina (hangar/workshop.ts, design §5.5) decide quem está lá e a luz do turno.
// Profundidade: quem está mais à frente (maior y na tela) desenha por cima.
// Lê o store; nunca muda o estado. O tempo da cena segue clock.speed.

import Phaser from "phaser";
import type { GameStore } from "../app/store";
import type { GameState, PartState } from "../sim";
import {
  aircraftViewFromState,
  benchViewsFromState,
  workerViewsFromState,
  type BenchId,
  type BenchView,
  type WorkerView
} from "./hangar/benchView";
import {
  aircraftAnchor,
  BENCH_LEN,
  BENCH_TOP,
  benchHotspot,
  COLS,
  CRATE,
  DOOR_CRATE_SLOTS,
  drawAircraft,
  drawBench,
  drawCrate,
  drawCrateLid,
  drawNightWindows,
  drawRoom,
  drawSnacks,
  NAP_SPOT,
  ROWS,
  WALL_LAMPS,
  UNPACK_SPOT,
  WALL_H
} from "./hangar/hangarArt";
import { packagesAtDoor, recentDeliveries, type PackageView } from "./hangar/packages";
import { lightingFor, overnightNapper, shiftOfSlot, workshopNow, type WorkshopLighting, type WorkshopNow } from "./hangar/workshop";
import { hourOfDay } from "./queue/queueView";
import { iso } from "./hangar/iso";
import { Worker } from "./hangar/Worker";
import { css, fonts, palette } from "./palette";

/** Área livre na frente do hangar, entre as bancadas de baixo: quem não está numa bancada fica aqui. */
const FREE_AREA = { col: 3.7, row: 5.4, perRow: 4 };

/** Posto de um integrante: na frente da bancada (até 4 por bancada) ou na área livre. */
function workerSpot(view: WorkerView): { x: number; y: number; facingLeft: boolean } {
  if (view.bench === null) {
    const col = FREE_AREA.col + (view.slot % FREE_AREA.perRow) * 0.75;
    const row = FREE_AREA.row + Math.floor(view.slot / FREE_AREA.perRow) * 0.8;
    return { ...iso(col, row), facingLeft: view.slot % 2 === 0 };
  }
  const bench = BENCHES.find((b) => b.id === view.bench)!;
  const left = view.slot % 2 === 0;
  const col = bench.col + (left ? 0.45 : 1.15);
  return { ...iso(col, bench.row + 1.3 + Math.floor(view.slot / 2) * 0.55), facingLeft: left };
}

/** Escreve rótulo + sufixo, cortando o rótulo com reticências até caber na largura. */
function fitText(target: Phaser.GameObjects.Text, label: string, suffix: string, maxWidth: number) {
  let text = label;
  target.setText(text + suffix);
  while (target.width > maxWidth && text.length > 4) {
    text = text.slice(0, -1);
    target.setText(`${text.trimEnd()}…${suffix}`);
  }
}

/** Escuro do turno por cima de piso, paredes e gente; luz das luminárias por cima dele. */
const DIM_DEPTH = 900_000;
const LAMP_DEPTH = 900_001;

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

/** Caixa entregue sendo aberta. Anima em tempo real (como um aviso), mesmo com o relógio pausado. */
interface Opening {
  t: number;
  /** y da tampa fechada, em pixels do mundo. */
  top: number;
  body: Phaser.GameObjects.Graphics;
  lid: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  peanuts: { dot: Phaser.GameObjects.Arc; vx: number; vy: number }[];
}

const OPENING_SECONDS = 2.2;

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
  private people = new Map<string, { worker: Worker; key: string }>();
  private spawned = 0;
  private cards = new Map<BenchId, BenchCard>();
  private aircraft!: Phaser.GameObjects.Graphics;
  private aircraftKey = "";
  private unsubscribe: (() => void) | null = null;
  private crates: Phaser.GameObjects.Graphics[] = [];
  private cratesKey = "";
  private crateCaption!: Phaser.GameObjects.Text;
  /** Pedidos já abertos nesta cena, para cada entrega abrir uma vez só. */
  private opened = new Set<string>();
  private openings: Opening[] = [];
  private windows!: Phaser.GameObjects.Graphics;
  private dim!: Phaser.GameObjects.Graphics;
  private lamps!: Phaser.GameObjects.Graphics;
  private snacks!: Phaser.GameObjects.Graphics;
  private sign!: Phaser.GameObjects.Text;
  private lightKey = "";

  constructor() {
    super("hangar");
  }

  init(data: { store: GameStore }) {
    this.store = data.store;
  }

  create() {
    drawRoom(this.add.graphics().setDepth(ROOM_DEPTH));
    this.windows = this.add.graphics().setDepth(ROOM_DEPTH + 1);
    this.dim = this.add.graphics().setDepth(DIM_DEPTH);
    this.lamps = this.add.graphics().setDepth(LAMP_DEPTH).setBlendMode(Phaser.BlendModes.ADD);
    this.snacks = this.add.graphics();
    drawSnacks(this.snacks);
    this.snacks.setDepth(iso(6.5, 7.1).y).setVisible(false);
    const signAt = iso(6.2, -0.5, 66);
    this.sign = this.add
      .text(signAt.x, signAt.y, "", {
        fontFamily: fonts.body,
        fontSize: "10px",
        color: palette.text,
        backgroundColor: css(palette.panel),
        padding: { x: 6, y: 4 },
        align: "center"
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(CARD_DEPTH - 1)
      .setVisible(false);
    BENCHES.forEach((bench) => this.createBench(bench));
    this.aircraft = this.add.graphics().setDepth(aircraftAnchor().y);
    const caption = iso(3.6, -0.5, 52);
    this.crateCaption = this.add
      .text(caption.x, caption.y, "", { fontFamily: fonts.mono, fontSize: "9px", color: palette.textMuted })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(ROOM_DEPTH + 1);
    this.refresh(this.store.getState());
    this.startAmbient();

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.applySpeed(this.store.getState().clock.speed);
    this.unsubscribe = this.store.subscribe((state) => {
      this.applySpeed(state.clock.speed);
      this.refresh(state);
    });
    // game.destroy() (ao trocar de tela) emite DESTROY, não SHUTDOWN: limpar nos dois.
    const cleanup = () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.scale.off("resize", this.layout, this);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
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
    const now = workshopNow(state);
    this.refreshCards(state);
    this.refreshPeople(state, now);
    this.refreshLight(lightingFor(shiftOfSlot(now.slot), now.open, hourOfDay(state.clock.hours)), now);
    this.refreshPackages(state);
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
      const key = JSON.stringify([
        view.title,
        view.task?.label,
        Math.round((view.task?.progress ?? 0) * 100),
        view.task?.waiting,
        view.queued,
        view.parts,
        view.moreParts
      ]);
      if (key === card.key) return;
      card.key = key;
      this.drawCard(card, view);
    });
  }

  private drawCard(card: BenchCard, view: BenchView) {
    const pad = 8;
    const partRows = view.parts.length + (view.moreParts > 0 ? 1 : 0);
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
      const suffix = [view.task.waiting ? "espera" : "", view.queued > 0 ? `+${view.queued}` : ""].filter(Boolean).join(" · ");
      card.task.setPosition(left + pad, y).setVisible(true);
      fitText(card.task, view.task.label, suffix ? ` · ${suffix}` : "", CARD_W - pad * 2);
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
      // Peça fora da especificação: anel amarelo em volta do ponto, sem texto.
      if (part.counterfeit) dot.setStrokeStyle(1.5, palette.warn, 1).setRadius(3.5);
      const label = this.add
        .text(left + pad + 11, y + 1, part.label, { fontFamily: fonts.body, fontSize: "10px", color: css(palette.ink) })
        .setResolution(2);
      card.parts.add([dot, label]);
      y += 13;
    });
    if (view.moreParts > 0) {
      const more = this.add
        .text(left + pad + 11, y + 1, `+${view.moreParts} peças`, { fontFamily: fonts.body, fontSize: "10px", color: palette.textDim })
        .setResolution(2);
      card.parts.add(more);
    }
  }

  /** Caixas no portão (redesenha só quando muda) e abertura das entregas novas. */
  private refreshPackages(state: GameState) {
    const door = packagesAtDoor(state);
    const key = door.map((p) => `${p.orderId}:${p.held}`).join("|");
    if (key !== this.cratesKey) {
      this.cratesKey = key;
      this.crates.forEach((g) => g.destroy());
      this.crates = door.slice(0, DOOR_CRATE_SLOTS.length).map((pack, i) => {
        const slot = DOOR_CRATE_SLOTS[i]!;
        const g = this.add.graphics();
        drawCrate(g, slot.col, slot.row, slot.z, pack.held);
        return g.setDepth(iso(slot.col + CRATE.size, slot.row + CRATE.size).y + slot.z / 100);
      });
      const held = door.filter((p) => p.held).length;
      const transit = door.length - held;
      const parts = [transit > 0 ? `${transit} A CAMINHO` : "", held > 0 ? `${held} RETIDO${held > 1 ? "S" : ""}` : ""];
      this.crateCaption.setText(parts.filter(Boolean).join(" · "));
    }
    recentDeliveries(state).forEach((pack, i) => {
      if (this.opened.has(pack.orderId)) return;
      this.opened.add(pack.orderId);
      this.startOpening(pack, i);
    });
  }

  private startOpening(pack: PackageView, index: number) {
    const { col, row } = UNPACK_SPOT;
    const body = this.add.graphics();
    drawCrate(body, col, row, 0, false, true);
    body.setDepth(iso(col + CRATE.size, row + CRATE.size).y);
    const center = iso(col + CRATE.size / 2, row + CRATE.size / 2, CRATE.height);
    const lid = this.add.graphics().setPosition(center.x, center.y).setDepth(body.depth + 1);
    drawCrateLid(lid);
    const label = this.add
      .text(center.x, center.y - 30, `Chegou: ${pack.label}`, {
        fontFamily: fonts.body,
        fontSize: "10px",
        color: palette.text,
        backgroundColor: css(palette.panel),
        padding: { x: 6, y: 3 }
      })
      .setOrigin(0.5, 1)
      .setResolution(2)
      .setDepth(CARD_DEPTH);
    const peanuts = Array.from({ length: 7 }, (_, i) => ({
      dot: this.add.circle(center.x, center.y, 1.6, i % 2 ? palette.ink : palette.inkMuted).setDepth(body.depth + 2).setVisible(false),
      vx: Phaser.Math.FloatBetween(-28, 28),
      vy: Phaser.Math.FloatBetween(-70, -40)
    }));
    // Várias entregas no mesmo instante abrem uma depois da outra.
    const opening: Opening = { t: -index * OPENING_SECONDS, top: center.y, body, lid, label, peanuts };
    [body, lid, label].forEach((obj) => obj.setAlpha(0));
    this.openings.push(opening);
  }

  update(_time: number, deltaMs: number) {
    if (this.openings.length === 0) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    this.openings = this.openings.filter((o) => {
      o.t += dt;
      if (o.t < 0) return true;
      const t = o.t;
      const at = (t0: number, t1: number) => Phaser.Math.Clamp((t - t0) / (t1 - t0), 0, 1);
      // Caixa cai no lugar, a tampa sobe girando, o enchimento pula, o rótulo sobe e tudo some.
      const drop = 1 - Phaser.Math.Easing.Bounce.Out(at(0, 0.35));
      const fade = 1 - at(1.7, OPENING_SECONDS);
      o.body.setAlpha(at(0, 0.1) * fade).setY(-drop * 24);
      const lift = Phaser.Math.Easing.Quadratic.Out(at(0.45, 1.0));
      const top = o.top;
      o.lid
        .setAlpha(at(0, 0.1) * (1 - at(0.8, 1.2)))
        .setY(top - drop * 24 - lift * 26)
        .setRotation(lift * 0.7);
      o.label.setAlpha(at(0.5, 0.75) * (1 - at(1.8, OPENING_SECONDS))).setY(top - 30 - at(0.5, OPENING_SECONDS) * 18);
      o.peanuts.forEach((p) => {
        const pt = t - 0.5;
        p.dot.setVisible(pt > 0 && pt < 1.1).setAlpha(1 - at(1.2, 1.6));
        if (pt > 0) p.dot.setPosition(o.lid.x + p.vx * pt, top + p.vy * pt + 90 * pt * pt);
      });
      if (t < OPENING_SECONDS) return true;
      [o.body, o.lid, o.label, ...o.peanuts.map((p) => p.dot)].forEach((obj) => obj.destroy());
      return false;
    });
  }

  /** Luz do turno, adereços da madrugada e placa no portão. Só redesenha quando muda. */
  private refreshLight(light: WorkshopLighting, now: WorkshopNow) {
    const key = JSON.stringify([light, now.open, now.blocked]);
    if (key === this.lightKey) return;
    this.lightKey = key;

    this.windows.clear();
    if (light.darkWindows) drawNightWindows(this.windows);

    this.dim.clear();
    if (light.dim > 0) {
      // Cobre todo o hangar (com folga), abaixo dos cartões.
      const left = iso(-1, ROWS).x - 40;
      const right = iso(COLS, -1).x + 40;
      const top = iso(-1, -1, WALL_H).y - 40;
      const bottom = iso(COLS, ROWS).y + 40;
      this.dim.fillStyle(palette.night, light.dim);
      this.dim.fillRect(left, top, right - left, bottom - top);
    }

    this.lamps.clear();
    if (light.lampsOn) {
      WALL_LAMPS.forEach((col) => {
        const p = iso(col, -0.5, 100);
        this.lamps.fillStyle(palette.lamp, 0.1);
        this.lamps.fillCircle(p.x, p.y, 34);
        this.lamps.fillStyle(palette.lamp, 0.5);
        this.lamps.fillCircle(p.x, p.y, 4);
      });
      // Luz sobre cada bancada.
      BENCHES.forEach((bench) => {
        const c = iso(bench.col + BENCH_LEN / 2, bench.row + 0.55);
        this.lamps.fillStyle(palette.lamp, 0.07);
        this.lamps.fillEllipse(c.x, c.y + 4, 150, 70);
        this.lamps.fillStyle(palette.lamp, 0.05);
        this.lamps.fillEllipse(c.x, c.y + 4, 90, 42);
      });
    }

    this.snacks.setVisible(light.overnightProps);

    if (now.blocked) {
      this.sign.setText(`OFICINA PARADA
${now.blocked}`).setColor(css(palette.warn)).setVisible(true);
    } else if (!now.open) {
      this.sign.setText("FECHADA").setColor(palette.textMuted).setVisible(true);
    } else {
      this.sign.setVisible(false);
    }
  }

  /** Cria quem chegou ao turno, tira quem saiu e leva cada um ao seu posto. */
  private refreshPeople(state: GameState, now: WorkshopNow) {
    const views = workerViewsFromState(state, now.present);
    const napper = overnightNapper(shiftOfSlot(now.slot), views);
    const present = new Set(views.map((view) => view.memberId));
    this.people.forEach((person, id) => {
      if (present.has(id)) return;
      person.worker.destroy();
      this.people.delete(id);
    });
    views.forEach((view) => {
      const napping = view.memberId === napper;
      const key = `${view.bench}:${view.slot}:${view.working}:${napping}`;
      const spot = napping ? { ...iso(NAP_SPOT.col, NAP_SPOT.row), facingLeft: false } : workerSpot(view);
      let person = this.people.get(view.memberId);
      if (!person) {
        // Nasce já no posto: só quem muda de tarefa anda pelo hangar.
        const worker = new Worker(this, view.name, this.spawned, spot.x, spot.y, spot.facingLeft);
        this.spawned += 1;
        person = { worker, key: "" };
        this.people.set(view.memberId, person);
      }
      if (person.key === key) return;
      person.key = key;
      person.worker.place(spot.x, spot.y, spot.facingLeft, view.working);
      person.worker.setNapping(napping);
    });
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
