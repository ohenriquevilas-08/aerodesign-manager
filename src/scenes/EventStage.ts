// Moldura dos eventos imersivos (Fase 7, C1 a C3): cenário isométrico por evento e bloco (campus da
// seletiva, aeroclube do ensaio, pátio da competição com tendas e a pista), a hora do dia no céu, a
// equipe presente, a dinâmica da seletiva (grupos montando planadores, destaque do grupo observado,
// lançamentos) e a bancada de inspeção com fiscais. A janela do voo e da fila fica na moldura
// (FRAME_WINDOW): a UI monta o PhaserStage de FlightScene/QueueScene nela.
// Só anima; o StageView chega por source.ts (ver contract.ts). Tempo real: os eventos pausam o relógio.
// A lógica (foco, lugares, trajetórias) é pura e vive em event/stage.ts.

import Phaser from "phaser";
import type { GameStore } from "../app/store";
import { sceneryForVenue } from "./flight/scenery";
import type { EventBlock, StageView } from "./event/contract";
import { eventChannel } from "./event/channel";
import { readEventView } from "./event/source";
import {
  CHECK_BENCH,
  FRAME_WINDOW,
  GRID,
  INSPECTION_BENCH,
  LANE_FULL_M,
  LAUNCH_LANE,
  anchorFor,
  assemblyParts,
  effectiveFocus,
  focusForView,
  formatDistance,
  framedSceneFor,
  gliderFrame,
  groupTables,
  inspectionLights,
  inspectionTally,
  landedGlider,
  planFigures,
  selectionPhase,
  settingForEvent,
  skyAt,
  zoomFor,
  type FigurePlan,
  type StageSetting
} from "./event/stage";
import { iso, isoBox, rowWallQuad, vec } from "./hangar/iso";
import { css, fonts, palette, shade } from "./palette";
import { setSprite } from "./people/sprite/phaser";

const AVATAR_SCALE = 2;
const WALK_SPEED = 3.2; // casas por segundo
const HORIZON = -10;
const GROUND_DEPTH = -1_000_000;
const PROPS_DEPTH = -500_000;
const FLOOR_FX_DEPTH = -400_000;
const OVERLAY_DEPTH = 1_000_000;

const mix = (a: number, b: number, k: number) => {
  const ch = (shift: number) => Math.round(((a >> shift) & 0xff) * (1 - k) + ((b >> shift) & 0xff) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

interface Figure {
  plan: FigurePlan;
  gfx: Phaser.GameObjects.Image;
  col: number;
  row: number;
  drawnKey: string;
}

interface TableView {
  groupId: string;
  gfx: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  distance: Phaser.GameObjects.Text;
  glider: Phaser.GameObjects.Graphics;
}

export class EventStage extends Phaser.Scene {
  private view: StageView | null = null;
  private setting: StageSetting | null = null;
  private worldLayer!: Phaser.GameObjects.Layer;
  private hudLayer!: Phaser.GameObjects.Layer;
  private hudCam!: Phaser.Cameras.Scene2D.Camera;
  private sky!: Phaser.GameObjects.Graphics;
  private ground!: Phaser.GameObjects.Graphics;
  private props!: Phaser.GameObjects.Graphics;
  private floorFx!: Phaser.GameObjects.Graphics;
  private benchGfx!: Phaser.GameObjects.Graphics;
  private benchLights!: Phaser.GameObjects.Graphics;
  private hudGfx!: Phaser.GameObjects.Graphics;
  private clockText!: Phaser.GameObjects.Text;
  private blockText!: Phaser.GameObjects.Text;
  private tallyText!: Phaser.GameObjects.Text;
  private idleText!: Phaser.GameObjects.Text;
  private figures = new Map<string, Figure>();
  private tables: TableView[] = [];
  private tablesKey = "";
  private skyKey = "";
  private blockKey = "";
  private t = 0;
  private blockT = 0;
  private camX = 0;
  private camY = 0;
  private camZoom = 0;
  private snap = true;
  private unsubscribe: (() => void)[] = [];
  private store!: GameStore;

  constructor() {
    super("event");
  }

  init(data: { store: GameStore }) {
    this.store = data.store;
  }

  create() {
    this.worldLayer = this.add.layer();
    this.hudLayer = this.add.layer();
    this.hudCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.cameras.main.ignore(this.hudLayer);
    this.hudCam.ignore(this.worldLayer);

    this.sky = this.world(this.add.graphics().setDepth(GROUND_DEPTH - 1));
    this.ground = this.world(this.add.graphics().setDepth(GROUND_DEPTH));
    this.props = this.world(this.add.graphics().setDepth(PROPS_DEPTH));
    this.floorFx = this.world(this.add.graphics().setDepth(FLOOR_FX_DEPTH));
    this.benchGfx = this.world(this.add.graphics());
    this.benchLights = this.world(this.add.graphics().setDepth(OVERLAY_DEPTH - 1));

    this.hudGfx = this.hud(this.add.graphics());
    const text = (size: string, color: string, family: string) =>
      this.hud(this.add.text(0, 0, "", { fontFamily: family, fontSize: size, color }).setResolution(2));
    this.clockText = text("13px", palette.textMuted, fonts.mono);
    this.blockText = text("22px", palette.text, fonts.display).setFontStyle("600").setLetterSpacing(1);
    this.tallyText = text("12px", palette.text, fonts.body);
    this.idleText = text("22px", palette.textMuted, fonts.display).setOrigin(0.5).setFontStyle("600").setLetterSpacing(2);
    this.idleText.setText("SEM EVENTO");

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.unsubscribe.push(this.store.subscribe((state) => this.refresh(readEventView(state))));
    this.unsubscribe.push(eventChannel.subscribe(() => this.refresh(readEventView(this.store.getState()))));
    // game.destroy() (ao trocar de tela) emite DESTROY, não SHUTDOWN: limpar nos dois.
    const cleanup = () => {
      this.unsubscribe.forEach((off) => off());
      this.unsubscribe = [];
      this.scale.off("resize", this.layout, this);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    this.refresh(readEventView(this.store.getState()));
    if (import.meta.env.DEV) (window as unknown as { __eventStage?: EventStage }).__eventStage = this;
  }

  /** Só para depuração: leva o tempo do bloco (s) ao instante t e a câmera ao destino. */
  seek(t: number) {
    this.blockT = t;
    this.snap = true;
    for (const figure of this.figures.values()) {
      figure.col = figure.plan.col;
      figure.row = figure.plan.row;
    }
  }

  private world<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.worldLayer.add(obj);
    return obj;
  }

  private hud<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.hudLayer.add(obj);
    return obj;
  }

  private layout() {
    const { width, height } = this.scale;
    this.cameras.main.setSize(width, height);
    this.hudCam.setSize(width, height);
    this.clockText.setPosition(16, 14);
    this.blockText.setPosition(16, 30);
    this.tallyText.setPosition(16, 62);
    this.idleText.setPosition(width / 2, height / 2);
    this.snap = true;
  }

  // ------------------------------------------------------------------ leitura

  private block(): EventBlock | undefined {
    return this.view?.blocks[this.view.blockIndex];
  }

  private refresh(view: StageView | null) {
    const previous = this.view;
    this.view = view;
    this.idleText.setVisible(!view);
    if (!view) {
      this.clearFigures();
      this.clearTables();
      this.setting = null;
      this.benchLights.clear();
      this.benchGfx.clear();
      this.props.clear();
      this.ground.clear();
      this.sky.clear();
      this.hudGfx.clear();
      this.clockText.setText("");
      this.blockText.setText("");
      this.tallyText.setText("");
      return;
    }
    const setting = settingForEvent(view.kind);
    if (setting !== this.setting || view.venueId !== previous?.venueId) {
      this.setting = setting;
      this.drawGround(setting, view.venueId);
      this.drawProps(setting);
      this.skyKey = "";
    }
    const key = `${view.id}:${view.day}:${view.blockIndex}`;
    if (key !== this.blockKey) {
      this.blockKey = key;
      this.blockT = 0;
    }
    this.syncTables(view);
    this.syncFigures(planFigures(view), !previous);
    this.drawHud(view);
  }

  private syncFigures(plans: FigurePlan[], instant = false) {
    const seen = new Set<string>();
    for (const plan of plans) {
      seen.add(plan.id);
      const existing = this.figures.get(plan.id);
      if (existing) {
        existing.plan = plan;
        continue;
      }
      // Quem chega entra pela borda esquerda do pátio, andando até o lugar.
      const gfx = this.world(this.add.image(0, 0, "__DEFAULT").setScale(AVATAR_SCALE));
      const enters = !instant && plan.role !== "inspector";
      this.figures.set(plan.id, { plan, gfx, col: enters ? -1 : plan.col, row: plan.row, drawnKey: "" });
    }
    for (const [id, figure] of this.figures) {
      if (seen.has(id)) continue;
      figure.gfx.destroy();
      this.figures.delete(id);
    }
  }

  private clearFigures() {
    for (const figure of this.figures.values()) figure.gfx.destroy();
    this.figures.clear();
  }

  private clearTables() {
    for (const table of this.tables) {
      table.gfx.destroy();
      table.label.destroy();
      table.distance.destroy();
      table.glider.destroy();
    }
    this.tables = [];
    this.tablesKey = "";
  }

  private syncTables(view: StageView) {
    const groups = view.selection?.groups ?? [];
    const key = groups.map((g) => `${g.id}:${g.label}`).join("|");
    if (key === this.tablesKey) return;
    this.clearTables();
    this.tablesKey = key;
    const spots = groupTables(groups.length);
    this.tables = groups.map((group, g) => {
      const spot = spots[g]!;
      const base = iso(spot.col, spot.row);
      const gfx = this.world(this.add.graphics().setDepth(base.y));
      const label = this.world(
        this.add
          .text(base.x, base.y - 74, group.label.toUpperCase(), { fontFamily: fonts.display, fontSize: "15px", color: css(palette.ink), fontStyle: "600" })
          .setOrigin(0.5, 1)
          .setResolution(2)
          .setLetterSpacing(1)
          .setDepth(OVERLAY_DEPTH)
      );
      const distance = this.world(
        this.add
          .text(0, 0, "", { fontFamily: fonts.mono, fontSize: "12px", color: css(palette.ink) })
          .setOrigin(0.5, 1)
          .setResolution(2)
          .setDepth(OVERLAY_DEPTH)
          .setVisible(false)
      );
      const glider = this.world(this.add.graphics().setDepth(OVERLAY_DEPTH - 2));
      return { groupId: group.id, gfx, label, distance, glider };
    });
  }

  // ------------------------------------------------------------------ cenário

  /** Escurece o cenário à noite (eventos acontecem de dia, mas o céu é contínuo). */
  private dim(color: number, hour: number) {
    return shade(color, skyAt(hour).night * 0.6);
  }

  private currentHour() {
    return this.block()?.startsAt ?? 12;
  }

  private drawGround(setting: StageSetting, venueId?: string) {
    const g = this.ground;
    g.clear();
    const hour = this.currentHour();
    const scenery = sceneryForVenue(venueId ?? "aeroclub");
    const outer = setting === "aeroclub" ? scenery.ground : palette.venueGrass;
    const inner =
      setting === "campus"
        ? mix(palette.venueWall, palette.floor, 0.45)
        : setting === "aeroclub"
          ? mix(scenery.ground, palette.ok, 0.18)
          : mix(palette.venueSoil, palette.venueGrass, 0.4);
    g.fillStyle(this.dim(outer, hour), 1).fillRect(-3000, HORIZON, 6000, 2200);
    // Morros ao fundo.
    const hills = [new Phaser.Math.Vector2(-3000, HORIZON)];
    for (let x = -3000; x <= 3000; x += 60) hills.push(new Phaser.Math.Vector2(x, HORIZON - 26 - Math.sin(x / 210) * 18 - Math.sin(x / 67) * 6));
    hills.push(new Phaser.Math.Vector2(3000, HORIZON));
    g.fillStyle(this.dim(setting === "aeroclub" ? scenery.hills : palette.venueLeaves, hour), 1).fillPoints(hills, true);
    // Piso do cenário em xadrez suave.
    for (let c = 0; c < GRID.cols; c += 1) {
      for (let r = 0; r < GRID.rows; r += 1) {
        g.fillStyle(this.dim((c + r) % 2 === 0 ? inner : shade(inner, 0.08), hour), 1);
        g.fillPoints(vec([iso(c, r), iso(c + 1, r), iso(c + 1, r + 1), iso(c, r + 1)]), true);
      }
    }
  }

  private drawSky() {
    const view = this.view;
    if (!view) return;
    const hour = this.currentHour();
    const key = `${this.setting}:${view.venueId ?? ""}:${hour.toFixed(2)}`;
    if (key === this.skyKey) return;
    this.skyKey = key;
    const sky = skyAt(hour);
    const scenery = sceneryForVenue(view.venueId ?? "aeroclub");
    const top0 = this.setting === "competition" ? palette.venueStripTop : this.setting === "aeroclub" ? scenery.skyTop : palette.venueClubTop;
    const bottom0 = this.setting === "competition" ? palette.venueStripBottom : this.setting === "aeroclub" ? scenery.skyBottom : palette.venueClubBottom;
    const top = mix(top0, palette.night, sky.night * 0.9);
    const bottom = mix(mix(bottom0, palette.highlight, sky.warm * 0.45), palette.bg, sky.night * 0.85);
    const g = this.sky;
    g.clear();
    const bands = 14;
    const from = -1500;
    const to = HORIZON + 4;
    for (let i = 0; i < bands; i += 1) {
      g.fillStyle(mix(top, bottom, (i / (bands - 1)) ** 0.8), 1).fillRect(-3000, from + ((to - from) * i) / bands, 6000, (to - from) / bands + 2);
    }
    // Sol de leste (esquerda) a oeste (direita); lua à noite.
    const cx = (iso(GRID.cols, 0).x + iso(0, GRID.rows).x) / 2;
    const sx = cx + (sky.sunProgress - 0.5) * 1200;
    const sy = -140 - Math.max(0, sky.elevation) * 480;
    if (sky.night < 1) {
      g.fillStyle(palette.lamp, 0.25 * (1 - sky.night)).fillCircle(sx, sy, 46);
      g.fillStyle(mix(palette.lamp, palette.ink, 0.4), 1 - sky.night).fillCircle(sx, sy, 24);
    }
    if (sky.night > 0.3) g.fillStyle(palette.ink, sky.night).fillCircle(cx + 260, -360, 16);
    // Nuvens fixas.
    g.fillStyle(palette.ink, 0.5 * (1 - sky.night));
    for (const [x, y, w] of [[-300, -320, 150], [80, -420, 190], [420, -280, 130], [-620, -450, 170]] as const) {
      g.fillEllipse(cx + x, y, w, 26).fillEllipse(cx + x + w * 0.25, y - 10, w * 0.6, 22);
    }
  }

  private face(g: Phaser.GameObjects.Graphics, color: number, hour = this.currentHour()) {
    return { top: this.dim(color, hour), left: this.dim(shade(color, 0.32), hour), right: this.dim(shade(color, 0.14), hour) };
  }

  private building(g: Phaser.GameObjects.Graphics, c0: number, c1: number, r0: number, r1: number, h: number, wall: number, roof: number) {
    isoBox(g, c0, c1, r0, r1, 0, h, this.face(g, wall));
    isoBox(g, c0 - 0.1, c1 + 0.1, r0 - 0.1, r1 + 0.1, h, 5, this.face(g, roof));
    g.fillStyle(this.dim(shade(wall, 0.55), this.currentHour()), 1);
    for (let col = c0 + 0.3; col + 0.28 < c1; col += 0.62) {
      for (let z = 16; z + 20 < h; z += 30) g.fillPoints(rowWallQuad(r1, col, col + 0.28, z, z + 16), true);
    }
  }

  private tree(g: Phaser.GameObjects.Graphics, col: number, row: number, h = 46) {
    const p = iso(col, row);
    const hour = this.currentHour();
    g.fillStyle(this.dim(palette.venueTrunk, hour), 1).fillRect(p.x - 3, p.y - h * 0.45, 6, h * 0.45);
    g.fillStyle(this.dim(palette.venueLeaves, hour), 1).fillPoints(vec([{ x: p.x - 18, y: p.y - h * 0.35 }, { x: p.x + 18, y: p.y - h * 0.35 }, { x: p.x, y: p.y - h }]), true);
    g.fillStyle(this.dim(shade(palette.venueLeaves, 0.2), hour), 1).fillPoints(vec([{ x: p.x - 14, y: p.y - h * 0.6 }, { x: p.x + 14, y: p.y - h * 0.6 }, { x: p.x, y: p.y - h * 1.15 }]), true);
  }

  private windsock(g: Phaser.GameObjects.Graphics, col: number, row: number) {
    const p = iso(col, row);
    const hour = this.currentHour();
    g.fillStyle(this.dim(palette.ink, hour), 1).fillRect(p.x - 1.5, p.y - 62, 3, 62);
    g.fillStyle(this.dim(palette.highlight, hour), 1).fillPoints(vec([{ x: p.x, y: p.y - 62 }, { x: p.x + 30, y: p.y - 56 }, { x: p.x + 30, y: p.y - 48 }, { x: p.x, y: p.y - 52 }]), true);
    g.fillStyle(this.dim(palette.ink, hour), 1).fillPoints(vec([{ x: p.x + 10, y: p.y - 59.5 }, { x: p.x + 17, y: p.y - 58 }, { x: p.x + 17, y: p.y - 50.6 }, { x: p.x + 10, y: p.y - 51.4 }]), true);
  }

  private tent(g: Phaser.GameObjects.Graphics, c0: number, c1: number, r0: number, r1: number, color: number) {
    const hour = this.currentHour();
    const post = (c: number, r: number) => isoBox(g, c - 0.04, c + 0.04, r - 0.04, r + 0.04, 0, 48, { top: this.dim(palette.ink, hour), left: this.dim(shade(palette.ink, 0.4), hour), right: this.dim(shade(palette.ink, 0.25), hour) });
    post(c0, r0);
    post(c1, r0);
    // Cobertura plana com a barra listrada na frente.
    g.fillStyle(this.dim(color, hour), 0.95).fillPoints(vec([iso(c0, r0, 48), iso(c1, r0, 48), iso(c1, r1, 48), iso(c0, r1, 48)]), true);
    g.lineStyle(1, this.dim(shade(color, 0.4), hour), 0.9).strokePoints(vec([iso(c0, r0, 48), iso(c1, r0, 48), iso(c1, r1, 48), iso(c0, r1, 48)]), true, true);
    const stripes = Math.max(2, Math.round((c1 - c0) / 0.5));
    for (let s = 0; s < stripes; s += 1) {
      const a = c0 + ((c1 - c0) * s) / stripes;
      const b = c0 + ((c1 - c0) * (s + 1)) / stripes;
      g.fillStyle(this.dim(s % 2 === 0 ? palette.ink : color, hour), 1).fillPoints(rowWallQuad(r1, a, b, 40, 48), true);
    }
    post(c0, r1);
    post(c1, r1);
  }

  private drawProps(setting: StageSetting) {
    const g = this.props;
    g.clear();
    const hour = this.currentHour();
    const line = (c0: number, r0: number, c1: number, r1: number, color: number, alpha = 1, width = 2) => {
      const a = iso(c0, r0);
      const b = iso(c1, r1);
      g.lineStyle(width, this.dim(color, hour), alpha).lineBetween(a.x, a.y, b.x, b.y);
    };
    const strip = (c0: number, c1: number, r0: number, r1: number, color: number) =>
      g.fillStyle(this.dim(color, hour), 1).fillPoints(vec([iso(c0, r0), iso(c1, r0), iso(c1, r1), iso(c0, r1)]), true);

    if (setting === "campus") {
      this.building(g, 1, 5.5, 0.2, 1.8, 96, palette.venueWall, palette.venueRoof);
      this.building(g, 6.6, 10.4, 0.4, 1.8, 58, palette.venueBarn, palette.venueRoof);
      this.building(g, 12, 16.6, 0.2, 2, 118, palette.venueWall, palette.venueRoof);
      [[0.6, 4], [17, 4.8], [2.2, 3.6], [15.4, 3.4]].forEach(([c, r]) => this.tree(g, c!, r!));
      // Faixa de boas-vindas.
      isoBox(g, 2.6, 4.6, 2.8, 2.9, 0, 30, this.face(g, palette.blueprint));
      g.fillStyle(this.dim(palette.highlight, hour), 1).fillPoints(rowWallQuad(2.9, 2.75, 4.45, 16, 24), true);
      // Pista de lançamento: faixa clara com marcas a cada 5 m.
      const lane = (n: number) => LAUNCH_LANE.row0 + n * LAUNCH_LANE.rowStep;
      strip(LAUNCH_LANE.col0 - 1.4, LAUNCH_LANE.col0 + LAUNCH_LANE.length + 0.8, lane(0) - 0.3, lane(3) + 0.35, mix(palette.venueWall, palette.ink, 0.25));
      line(LAUNCH_LANE.col0, lane(0) - 0.3, LAUNCH_LANE.col0, lane(3) + 0.35, palette.ink, 0.9);
      for (let m = 5; m <= LANE_FULL_M; m += 5) {
        const col = LAUNCH_LANE.col0 + (m / LANE_FULL_M) * LAUNCH_LANE.length;
        line(col, lane(0) - 0.3, col, lane(3) + 0.35, palette.inkMuted, 0.6, 1);
      }
    } else if (setting === "aeroclub") {
      this.building(g, 0.8, 6, 0.4, 3, 78, palette.venueWall, palette.venueRoof);
      g.fillStyle(this.dim(palette.night, hour), 1).fillPoints(rowWallQuad(3, 2.3, 4.5, 0, 52), true);
      this.building(g, 8.4, 11.6, 0.6, 2.4, 46, palette.venueBarn, palette.venueRoof);
      [[13, 2], [14.2, 1.4], [15.4, 2.2], [16.6, 1.5], [17.4, 3]].forEach(([c, r]) => this.tree(g, c!, r!));
      strip(0, GRID.cols, 8.2, 10.6, palette.venueWall);
      for (let c = 0.8; c < GRID.cols; c += 2.2) strip(c, c + 1.1, 9.35, 9.5, palette.ink);
      this.windsock(g, 16.2, 7.4);
      // Van da equipe encostada no hangar.
      isoBox(g, 2.2, 4.2, 5.4, 6.3, 0, 26, this.face(g, palette.accent));
      isoBox(g, 2.2, 2.8, 5.4, 6.3, 26, 8, this.face(g, palette.border));
    } else {
      // Tendas: a sua (laranja), a da inspeção (branca) e as das rivais ao fundo.
      this.tent(g, 0.6, 3.1, 0.6, 2.6, palette.accent);
      this.tent(g, 11.8, 14.8, 0.8, 2.8, palette.ok);
      this.tent(g, 14.9, 17.4, 1.4, 3.4, palette.danger);
      this.tent(g, 3.2, 6.8, 3.0, 5.4, palette.highlight);
      this.tent(g, 7.6, 11.2, 2.3, 5.3, palette.ink);
      [[0.4, 8], [17.4, 8.4], [17.2, 0.4]].forEach(([c, r]) => this.tree(g, c!, r!));
      strip(0, GRID.cols, 8.6, 11.2, palette.venueWall);
      for (let c = 0.8; c < GRID.cols; c += 2.2) strip(c, c + 1.1, 9.85, 10, palette.ink);
      for (let k = 0; k < 5; k += 1) strip(0.3, 1.6, 8.8 + k * 0.45, 9 + k * 0.45, palette.ink);
      this.windsock(g, 16.6, 7.6);
      // Pódio com três degraus e o placar atrás.
      const stepFace = (color: number) => this.face(g, color);
      isoBox(g, 13.4, 14.4, 6.2, 7.0, 0, 28, stepFace(palette.highlight));
      isoBox(g, 12.3, 13.4, 6.2, 7.0, 0, 20, stepFace(palette.accent));
      isoBox(g, 14.4, 15.5, 6.2, 7.0, 0, 14, stepFace(palette.ok));
      isoBox(g, 12.2, 15.6, 5.2, 5.4, 0, 70, stepFace(palette.panelRaised));
      g.fillStyle(this.dim(palette.accent, hour), 1).fillPoints(rowWallQuad(5.4, 12.5, 15.3, 38, 62), true);
    }
  }

  // ------------------------------------------------------------------ quadro a quadro

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    this.t += dt;
    this.blockT += dt;
    const view = this.view;
    if (!view) return;
    this.drawSky();
    this.moveCamera(view, dt);
    this.updateFigures(dt);
    this.updateBench(view);
    this.updateTables(view);
  }

  private moveCamera(view: StageView, dt: number) {
    const setting = settingForEvent(view.kind);
    const block = this.block();
    const focus = effectiveFocus(setting, focusForView(view));
    const cell = anchorFor(setting, focus);
    const anchor = iso(cell.col, cell.row);
    const { width, height } = this.scale;
    const left = iso(0, GRID.rows).x - 40;
    const right = iso(GRID.cols, 0).x + 40;
    const top = -240;
    const bottom = iso(GRID.cols, GRID.rows).y + 40;
    const fit = Math.min(width / (right - left), height / (bottom - top));
    const zoom = Phaser.Math.Clamp(fit * zoomFor(setting, focus), 0.35, 3);
    if (this.snap) {
      this.camX = anchor.x;
      this.camY = anchor.y - 30;
      this.camZoom = zoom;
      this.snap = false;
    } else {
      const k = Math.min(1, dt * 2.6);
      this.camX += (anchor.x - this.camX) * k;
      this.camY += (anchor.y - 30 - this.camY) * k;
      this.camZoom += (zoom - this.camZoom) * k;
    }
    this.cameras.main.setZoom(this.camZoom);
    this.cameras.main.centerOn(this.camX, this.camY);
  }

  private updateFigures(dt: number) {
    const observed = this.view?.selection?.observedGroupId ?? null;
    for (const figure of this.figures.values()) {
      const { plan } = figure;
      const dc = plan.col - figure.col;
      const dr = plan.row - figure.row;
      const dist = Math.hypot(dc, dr);
      const walking = dist > 0.05;
      if (walking) {
        const step = Math.min(dist, WALK_SPEED * dt);
        figure.col += (dc / dist) * step;
        figure.row += (dr / dist) * step;
      }
      const facing = walking && Math.abs(dc - dr) > 0.05 ? (dc - dr > 0 ? 1 : -1) : plan.facing;
      const working = !walking && plan.pose === "work";
      const phase = working ? (this.t * 1.4 + plan.col) % 1 : 0;
      const key = `${facing}:${walking ? "s" : plan.pose}:${Math.round(phase * 8)}:${plan.look.shirt}`;
      if (key !== figure.drawnKey) {
        figure.drawnKey = key;
        setSprite(figure.gfx, { id: plan.id, look: plan.look }, facing, working ? "work" : "stand");
      }
      const base = iso(figure.col, figure.row);
      const bob = walking ? -Math.abs(Math.sin(this.t * 11)) * 3 : 0;
      const dim = observed && plan.role === "candidate" && plan.groupId !== observed ? 0.65 : 1;
      figure.gfx.setPosition(base.x + (working ? Math.round(phase) * facing : 0), base.y + bob).setDepth(base.y).setAlpha(dim);
    }
  }

  /** Bancada de inspeção (competição) ou de checagem (aeroclube): o avião e as luzes do que falta. */
  private updateBench(view: StageView) {
    const g = this.benchGfx;
    const lights = this.benchLights;
    g.clear();
    lights.clear();
    this.tallyText.setText("");
    const bench = this.setting === "competition" ? INSPECTION_BENCH : this.setting === "aeroclub" ? CHECK_BENCH : null;
    if (!bench) return;
    const hour = this.currentHour();
    const mid = { col: (bench.col0 + bench.col1) / 2, row: (bench.row0 + bench.row1) / 2 };
    g.setDepth(iso(bench.col1, bench.row1).y);
    isoBox(g, bench.col0, bench.col1, bench.row0, bench.row1, 0, 22, { top: this.dim(palette.benchTop, hour), left: this.dim(shade(palette.bench, 0.3), hour), right: this.dim(palette.bench, hour), edge: palette.ink });
    // Avião de ensaio sobre a bancada: fuselagem, asa e empenagem.
    const z = 22;
    const part = (c0: number, c1: number, r0: number, r1: number, h: number, color: number) =>
      isoBox(g, mid.col + c0, mid.col + c1, mid.row + r0, mid.row + r1, z, h, { top: color, left: shade(color, 0.3), right: shade(color, 0.15) });
    part(-0.85, 0.85, -0.07, 0.07, 8, palette.ink);
    part(-0.25, 0.25, -0.95, 0.95, 2, palette.inkMuted);
    part(0.62, 0.82, -0.38, 0.38, 2, palette.inkMuted);
    part(0.66, 0.78, -0.03, 0.03, 12, palette.highlight);
    part(-0.95, -0.82, -0.05, 0.05, 6, palette.accent);

    const items = view.inspection?.items;
    if (items && this.setting === "competition") {
      const blink = (Math.sin(this.t * 6) + 1) / 2;
      const set = inspectionLights(items);
      lights.setDepth(OVERLAY_DEPTH - 1);
      set.forEach((light, i) => {
        const lateral = (i - (set.length - 1) / 2) * 0.38;
        const p = iso(mid.col + lateral * 0.7, bench.row1 + 0.15 - lateral * 0.7, 52);
        const alpha = light.blink ? 0.35 + 0.65 * blink : 1;
        lights.fillStyle(light.color, 0.25 * alpha).fillCircle(p.x, p.y, 9);
        lights.fillStyle(light.color, alpha).fillCircle(p.x, p.y, 4.5);
        lights.lineStyle(1, palette.bg, 0.8).strokeCircle(p.x, p.y, 4.5);
      });
      const tally = inspectionTally(items);
      const focused = this.block()?.kind === "inspection";
      if (focused) this.tallyText.setText(`Inspeção: ${tally.ok} ok · ${tally.pending} pendente${tally.pending === 1 ? "" : "s"} · ${tally.fail} reprovado${tally.fail === 1 ? "" : "s"}`);
    }
  }

  /** Mesas dos grupos, planadores em montagem, destaque do grupo observado e os lançamentos. */
  private updateTables(view: StageView) {
    const groups = view.selection?.groups ?? [];
    const observed = view.selection?.observedGroupId ?? null;
    const phase = selectionPhase(view);
    const spots = groupTables(groups.length);
    const fx = this.floorFx;
    fx.clear();
    const pulse = (Math.sin(this.t * 3) + 1) / 2;
    const hour = this.currentHour();

    groups.forEach((group, g) => {
      const view2 = this.tables[g];
      const spot = spots[g];
      if (!view2 || !spot) return;
      const isObserved = observed === group.id;
      const dim = observed && !isObserved ? 0.75 : 1;
      const tg = view2.gfx;
      tg.clear();
      tg.setAlpha(dim);
      // Mesa de trabalho.
      isoBox(tg, spot.col - 0.75 - spot.col, spot.col + 0.75 - spot.col, spot.row - 0.55 - spot.row, spot.row + 0.55 - spot.row, 0, 20, {
        top: this.dim(palette.benchTop, hour),
        left: this.dim(shade(palette.bench, 0.3), hour),
        right: this.dim(palette.bench, hour),
        edge: palette.ink
      });
      tg.setPosition(iso(spot.col, spot.row).x - iso(0, 0).x, iso(spot.col, spot.row).y - iso(0, 0).y);
      this.drawKit(tg, phase, g, this.blockT);

      view2.label.setAlpha(dim).setColor(isObserved ? css(palette.highlight) : css(palette.ink));
      if (isObserved) {
        const base = iso(spot.col, spot.row);
        const w = 150 + pulse * 10;
        fx.fillStyle(palette.highlight, 0.18 + pulse * 0.1).fillEllipse(base.x, base.y + 4, w, w * 0.5);
        fx.lineStyle(2, palette.highlight, 0.85).strokeEllipse(base.x, base.y + 4, w, w * 0.5);
      }

      // Planador voando (ou pousado) na pista do grupo.
      const gg = view2.glider;
      gg.clear();
      view2.distance.setVisible(false);
      const distanceM = group.gliderDistanceM;
      if ((phase === "launching" || phase === "landed") && distanceM !== null) {
        const frame = phase === "landed" ? landedGlider(g, distanceM) : gliderFrame(g, distanceM, this.blockT);
        const p = iso(frame.col, frame.row, frame.z);
        const shadowP = iso(frame.col, frame.row);
        gg.fillStyle(palette.bg, 0.3).fillEllipse(shadowP.x, shadowP.y, 16, 6);
        this.drawGlider(gg, frame.col, frame.row, frame.z, isObserved);
        void p;
        if (frame.landed) {
          view2.distance
            .setText(`${group.label.slice(-1)} · ${formatDistance(distanceM)}`)
            .setPosition(shadowP.x, shadowP.y - 12)
            .setColor(isObserved ? css(palette.highlight) : css(palette.ink))
            .setVisible(true);
          if (isObserved) {
            fx.lineStyle(2, palette.highlight, 0.85).strokeEllipse(shadowP.x, shadowP.y, 44 + pulse * 6, 20);
          }
        }
      }
    });
  }

  /** Material em cima da mesa: caixa fechada, peças aparecendo na montagem, ou vazia. */
  private drawKit(tg: Phaser.GameObjects.Graphics, phase: ReturnType<typeof selectionPhase>, groupIndex: number, t: number) {
    const spot = { col: 0, row: 0 };
    const z = 20;
    const part = (c0: number, c1: number, r0: number, r1: number, h: number, color: number) =>
      isoBox(tg, spot.col + c0, spot.col + c1, spot.row + r0, spot.row + r1, z, h, { top: color, left: shade(color, 0.3), right: shade(color, 0.15) });
    if (phase === "kit") {
      part(-0.3, 0.3, -0.25, 0.25, 5, palette.venueSoil);
      return;
    }
    if (phase !== "assembling") return;
    const n = assemblyParts(groupIndex, t);
    part(-0.65, -0.35, -0.4, -0.2, 2, palette.lamp); // sobras de balsa
    if (n >= 1) part(-0.45, 0.45, -0.04, 0.04, 3, palette.lamp); // fuselagem
    if (n >= 2) part(-0.1, 0.18, -0.5, 0.5, 1.5, palette.lamp); // asa
    if (n >= 3) part(0.32, 0.46, -0.2, 0.2, 1.5, palette.lamp); // empenagem
    if (n >= 4) part(-0.52, -0.42, -0.05, 0.05, 4, palette.accent); // lastro na proa
  }

  private drawGlider(g: Phaser.GameObjects.Graphics, col: number, row: number, z: number, emphasized: boolean) {
    const nose = iso(col + 0.45, row, z);
    const tail = iso(col - 0.45, row, z);
    const left = iso(col, row - 0.55, z);
    const right = iso(col, row + 0.55, z);
    const color = emphasized ? palette.highlight : palette.lamp;
    g.fillStyle(color, 1).fillPoints(vec([iso(col + 0.12, row - 0.55, z), iso(col - 0.12, row - 0.55, z), iso(col - 0.12, row + 0.55, z), iso(col + 0.12, row + 0.55, z)]), true);
    void left;
    void right;
    g.lineStyle(2, palette.ink, 1).lineBetween(tail.x, tail.y, nose.x, nose.y);
    const fin = iso(col - 0.45, row, z + 7);
    g.lineStyle(2, palette.ink, 1).lineBetween(tail.x, tail.y, fin.x, fin.y);
  }

  // ------------------------------------------------------------------ HUD

  private drawHud(view: StageView) {
    const block = this.block();
    const hour = block?.startsAt ?? 12;
    const hh = Math.floor(hour);
    const mm = Math.round((hour - hh) * 60);
    const clock = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    const days = view.dayCount > 1 ? `DIA ${view.day} DE ${view.dayCount} · ` : "";
    this.clockText.setText(`${days}${clock}`);
    this.blockText.setText((block?.label ?? "").toUpperCase());

    const g = this.hudGfx;
    g.clear();
    const framed = block ? framedSceneFor(block.kind) : null;
    if (framed) {
      const { width, height } = this.scale;
      const x = width * FRAME_WINDOW.x;
      const y = height * FRAME_WINDOW.y;
      const w = width * FRAME_WINDOW.w;
      const h = height * FRAME_WINDOW.h;
      g.fillStyle(palette.bg, 0.55).fillRect(0, 0, width, height);
      g.lineStyle(6, palette.borderStrong, 1).strokeRoundedRect(x - 4, y - 4, w + 8, h + 8, 10);
      g.lineStyle(2, palette.highlight, 0.9).strokeRoundedRect(x - 8, y - 8, w + 16, h + 16, 12);
    }
  }
}
