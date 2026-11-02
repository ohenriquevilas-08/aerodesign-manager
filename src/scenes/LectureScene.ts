// Palestra de apresentação (Fase 9, C1): o auditório do campus em isométrico, com a plateia de inscritos
// em pixel art, um fundador no palco ao lado do telão e os slides passando. A ocupação das cadeiras
// reflete quantos vieram (de dezenas a cerca de 100); quem passa da lotação fica em pé no fundo.
// Só anima: a lista de presentes e quem está no palco chegam por lectureChannel (a UI decide quando
// abrir). A lógica (cadeiras, entrada, palco, slides) é pura e vive em lecture/auditorium.ts.
// Tempo real: a palestra é um evento de uma noite e pausa o relógio da gestão.

import Phaser from "phaser";
import { iso, isoBox, vec, colWallQuad, rowWallQuad } from "./hangar/iso";
import { lectureChannel } from "./lecture/channel";
import type { LectureView } from "./lecture/contract";
import {
  LECTERN,
  ROOM,
  STAGE,
  attendanceLabel,
  audienceFrame,
  occupancy,
  placeAudience,
  seats,
  slideAt,
  slidesFor,
  stageSpots,
  type AudienceSpot
} from "./lecture/auditorium";
import { css, fonts, palette, shade } from "./palette";
import { setSprite } from "./people/sprite/phaser";

const WALL_H = 150;
/** Escala inteira do sprite: com ~100 pessoas na sala o boneco fica em 1x (48 px de altura), no palco também. */
const AVATAR_SCALE = 1;
const STAGE_SCALE = 1;
const ROOM_DEPTH = -1_000_000;
const OVERLAY_DEPTH = 1_000_000;
/** Pixels de arte cortados embaixo de quem está sentado (pernas escondidas pela cadeira). */
const SEATED_CROP = 13;
const SEATED_DROP = 6;

interface Figure {
  gfx: Phaser.GameObjects.Image;
  spot: AudienceSpot;
  order: number;
  facing: 1 | -1;
  seated: boolean;
}

interface Speaker {
  gfx: Phaser.GameObjects.Image;
  col: number;
  row: number;
  facing: 1 | -1;
}

export class LectureScene extends Phaser.Scene {
  private view: LectureView | null = null;
  private figures: Figure[] = [];
  private speakers: Speaker[] = [];
  private t = 0;
  private forcedSlide: number | null = null;
  private slideKey = "";
  private slideBumpAt = -10;
  private worldLayer!: Phaser.GameObjects.Layer;
  private hudLayer!: Phaser.GameObjects.Layer;
  private hudCam!: Phaser.Cameras.Scene2D.Camera;
  private screenGfx!: Phaser.GameObjects.Graphics;
  private slideTitle!: Phaser.GameObjects.Text;
  private slideBody!: Phaser.GameObjects.Text;
  private hudGfx!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private countText!: Phaser.GameObjects.Text;
  private idleText!: Phaser.GameObjects.Text;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super("lecture");
  }

  create() {
    this.worldLayer = this.add.layer();
    this.hudLayer = this.add.layer();
    this.hudCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.cameras.main.ignore(this.hudLayer);
    this.hudCam.ignore(this.worldLayer);

    this.drawRoom();
    this.createScreen();
    this.createHud();

    this.unsubscribe = lectureChannel.subscribe(
      (view) => this.rebuild(view),
      (slide) => {
        this.forcedSlide = slide;
      }
    );
    this.forcedSlide = lectureChannel.slide;
    this.layout();
    this.scale.on("resize", this.layout, this);
    this.rebuild(lectureChannel.current);
    // game.destroy() (ao trocar de tela) emite DESTROY, não SHUTDOWN: limpar nos dois.
    const cleanup = () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.scale.off("resize", this.layout, this);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    // Atalho de depuração: window.__lectureScene.seek(t) pula a entrada da plateia (s).
    if (import.meta.env.DEV) (window as unknown as { __lectureScene?: LectureScene }).__lectureScene = this;
  }

  /** Só para depuração: leva a entrada da plateia ao instante t (s). */
  seek(t: number) {
    this.t = t;
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
    const left = iso(0, ROOM.rows).x - 30;
    const right = iso(ROOM.cols, 0).x + 30;
    const top = iso(0, 0, WALL_H).y - 30;
    const bottom = iso(ROOM.cols, ROOM.rows).y + 30;
    // Reserva a faixa de cima para o cabeçalho.
    const usable = Math.max(200, height - 70);
    const zoom = Phaser.Math.Clamp(Math.min(width / (right - left), usable / (bottom - top)), 0.4, 3);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn((left + right) / 2, (top + bottom) / 2 - 35 / zoom);
    this.titleText.setPosition(16, 14);
    this.countText.setPosition(16, 40);
    this.idleText.setPosition(width / 2, height / 2);
  }

  // ------------------------------------------------------------------ auditório

  private drawRoom() {
    const g = this.world(this.add.graphics().setDepth(ROOM_DEPTH));
    const { cols, rows } = ROOM;

    // Piso: carpete em xadrez suave.
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        g.fillStyle((c + r) % 2 === 0 ? palette.floor : shade(palette.floor, 0.12), 1);
        g.fillPoints(vec([iso(c, r), iso(c + 1, r), iso(c + 1, r + 1), iso(c, r + 1)]), true);
      }
    }
    // Linhas da grade do piso.
    g.lineStyle(1, palette.floorLine, 0.3);
    for (let c = 0; c <= cols; c += 1) g.lineBetween(iso(c, 0).x, iso(c, 0).y, iso(c, rows).x, iso(c, rows).y);
    for (let r = 0; r <= rows; r += 1) g.lineBetween(iso(0, r).x, iso(0, r).y, iso(cols, r).x, iso(cols, r).y);

    // Paredes do fundo: a da coluna 0 (palco e telão) e a da linha 0 (portas de emergência e janelas).
    g.fillStyle(palette.panel, 1).fillPoints(colWallQuad(0, 0, rows, 0, WALL_H), true);
    g.fillStyle(shade(palette.panel, 0.25), 1).fillPoints(rowWallQuad(0, 0, cols, 0, WALL_H), true);
    g.fillStyle(palette.border, 1).fillPoints(colWallQuad(0, 0, rows, 0, 9), true);
    g.fillStyle(shade(palette.border, 0.25), 1).fillPoints(rowWallQuad(0, 0, cols, 0, 9), true);
    // Cortina atrás do palco.
    g.fillStyle(shade(palette.blueprint, 0.1), 1).fillPoints(colWallQuad(0, STAGE.row0, STAGE.row1, STAGE.height, WALL_H - 10), true);
    g.fillStyle(palette.blueprintGrid, 0.45);
    for (let r = STAGE.row0 + 0.3; r < STAGE.row1; r += 0.9) g.fillPoints(colWallQuad(0, r, r + 0.35, STAGE.height, WALL_H - 10), true);
    // Janelas na parede da linha 0.
    for (let c = 6; c < cols - 1; c += 3.2) {
      g.fillStyle(palette.borderStrong, 1).fillPoints(rowWallQuad(0, c, c + 2, 60, 118), true);
      g.fillStyle(palette.venueClubBottom, 0.85).fillPoints(rowWallQuad(0, c + 0.1, c + 1.9, 66, 112), true);
    }

    // Palco: plataforma, degraus e atril.
    const faces = { top: palette.benchTop, left: shade(palette.bench, 0.3), right: palette.bench, edge: palette.ink };
    isoBox(g, STAGE.col0, STAGE.col1, STAGE.row0, STAGE.row1, 0, STAGE.height, faces);
    isoBox(g, STAGE.col1, STAGE.col1 + 0.5, 5.2, 7.4, 0, 6, { top: palette.benchTop, left: shade(palette.bench, 0.3), right: palette.bench });
    isoBox(g, LECTERN.col0, LECTERN.col1, LECTERN.row0, LECTERN.row1, STAGE.height, 20, {
      top: palette.panelRaised,
      left: shade(palette.bench, 0.35),
      right: shade(palette.bench, 0.1),
      edge: palette.ink
    });

    // Cadeiras: assento baixo; as ocupadas ficam sob o boneco sentado.
    for (const seat of seats()) {
      isoBox(g, seat.col - 0.3, seat.col + 0.3, seat.row - 0.3, seat.row + 0.3, 0, 7, {
        top: palette.borderStrong,
        left: shade(palette.borderStrong, 0.6),
        right: shade(palette.borderStrong, 0.45),
        edge: palette.bg
      });
    }
    // Porta do fundo, no canto da plateia.
    g.fillStyle(palette.night, 1).fillPoints(rowWallQuad(ROOM.rows, 15.6, 17, 0, 78), true);
  }

  private createScreen() {
    // O telão é uma placa de frente para a câmera, pendurada sobre o palco (um quadro plano; a parede
    // inclinada deformaria o texto).
    const center = iso(0, (STAGE.row0 + STAGE.row1) / 2 - 1.2, 96);
    const w = 270;
    const h = 130;
    this.screenGfx = this.world(this.add.graphics().setDepth(ROOM_DEPTH + 1));
    this.screenGfx.fillStyle(palette.bg, 1).fillRoundedRect(center.x - w / 2 - 6, center.y - h / 2 - 6, w + 12, h + 12, 6);
    this.screenGfx.fillStyle(palette.ink, 1).fillRect(center.x - w / 2, center.y - h / 2, w, h);
    this.screenGfx.fillStyle(palette.blueprint, 1).fillRect(center.x - w / 2 + 4, center.y - h / 2 + 4, w - 8, h - 8);
    this.screenGfx.fillStyle(palette.highlight, 1).fillRect(center.x - w / 2 + 4, center.y - h / 2 + 4, 6, h - 8);
    this.slideTitle = this.world(
      this.add
        .text(center.x - w / 2 + 22, center.y - h / 2 + 14, "", { fontFamily: fonts.display, fontSize: "26px", color: css(palette.ink), fontStyle: "600" })
        .setResolution(2)
        .setDepth(ROOM_DEPTH + 2)
    );
    this.slideBody = this.world(
      this.add
        .text(center.x - w / 2 + 22, center.y - h / 2 + 52, "", { fontFamily: fonts.body, fontSize: "13px", color: css(palette.ink), lineSpacing: 4 })
        .setResolution(2)
        .setDepth(ROOM_DEPTH + 2)
    );
  }

  private createHud() {
    this.hudGfx = this.hud(this.add.graphics());
    this.titleText = this.hud(
      this.add.text(0, 0, "PALESTRA DE APRESENTAÇÃO", { fontFamily: fonts.display, fontSize: "22px", color: palette.text, fontStyle: "600" }).setResolution(2).setLetterSpacing(1)
    );
    this.countText = this.hud(this.add.text(0, 0, "", { fontFamily: fonts.mono, fontSize: "13px", color: palette.textMuted }).setResolution(2));
    this.idleText = this.hud(
      this.add.text(0, 0, "SEM PALESTRA", { fontFamily: fonts.display, fontSize: "22px", color: palette.textMuted, fontStyle: "600" }).setOrigin(0.5).setResolution(2).setLetterSpacing(2)
    );
  }

  // ------------------------------------------------------------------ gente

  private clearFigures() {
    for (const figure of this.figures) figure.gfx.destroy();
    for (const speaker of this.speakers) speaker.gfx.destroy();
    this.figures = [];
    this.speakers = [];
  }

  private rebuild(view: LectureView | null) {
    this.clearFigures();
    this.view = view;
    this.t = 0;
    this.slideKey = "";
    this.idleText.setVisible(!view);
    this.screenGfx.setVisible(!!view);
    this.slideTitle.setVisible(!!view);
    this.slideBody.setVisible(!!view);
    if (!view) {
      this.titleText.setText("PALESTRA DE APRESENTAÇÃO");
      this.countText.setText("");
      this.hudGfx.clear();
      return;
    }
    const spots = placeAudience(view.attendees.length);
    this.figures = spots.map((spot, order) => {
      const person = view.attendees[order]!;
      const gfx = this.world(this.add.image(0, 0, "__DEFAULT").setScale(AVATAR_SCALE).setVisible(false));
      setSprite(gfx, person, -1, "stand");
      return { gfx, spot, order, facing: -1, seated: false };
    });
    const stage = stageSpots(view.onStage.length);
    this.speakers = view.onStage.map((person, i) => {
      const gfx = this.world(this.add.image(0, 0, "__DEFAULT").setScale(STAGE_SCALE));
      setSprite(gfx, person, stage[i]!.facing, "stand");
      return { gfx, col: stage[i]!.col, row: stage[i]!.row, facing: stage[i]!.facing };
    });
    this.titleText.setText(`PALESTRA · ${view.teamName.toUpperCase()}`);
    this.drawHud(view);
  }

  private drawHud(view: LectureView) {
    const present = view.attendees.length;
    this.countText.setText(`${attendanceLabel(present, view.registered)} · sala ${Math.round(occupancy(present) * 100)}% cheia`);
    const g = this.hudGfx;
    g.clear();
    const w = 200;
    const filled = Math.min(1, occupancy(present));
    g.fillStyle(palette.panel, 1).fillRect(16, 62, w, 6);
    g.fillStyle(palette.highlight, 1).fillRect(16, 62, w * filled, 6);
    g.lineStyle(1, palette.border, 1).strokeRect(16, 62, w, 6);
  }

  // ------------------------------------------------------------------ quadro a quadro

  update(_time: number, delta: number) {
    this.t += delta / 1000;
    const view = this.view;
    if (!view) return;
    const count = this.figures.length;

    for (const figure of this.figures) {
      const frame = audienceFrame(figure.spot, figure.order, count, this.t);
      figure.gfx.setVisible(frame.visible);
      if (!frame.visible) continue;
      const seated = !frame.walking && figure.spot.seat !== null;
      if (frame.facing !== figure.facing || seated !== figure.seated) {
        figure.facing = frame.facing;
        figure.seated = seated;
        const person = view.attendees[figure.order]!;
        setSprite(figure.gfx, person, frame.facing, "stand");
        const { width, height } = figure.gfx;
        // Sentado: esconde as pernas (a cadeira ocupa o lugar) e desce o corpo até o assento.
        if (seated) figure.gfx.setCrop(0, 0, width, height - SEATED_CROP);
        else figure.gfx.setCrop();
      }
      const base = iso(frame.col, frame.row);
      const bob = frame.walking ? -Math.abs(Math.sin(this.t * 11 + figure.order)) * 2 : 0;
      const drop = seated ? SEATED_DROP : 0;
      figure.gfx.setPosition(base.x, base.y + bob + drop).setDepth(base.y);
    }

    this.updateSlides(view);
    this.updateSpeakers();
  }

  private updateSlides(view: LectureView) {
    const slides = slidesFor(view.teamName);
    const index = slideAt(this.t, slides.length, this.forcedSlide);
    const key = `${view.id}:${index}`;
    if (key === this.slideKey) return;
    if (this.slideKey) this.slideBumpAt = this.t;
    this.slideKey = key;
    const slide = slides[index]!;
    this.slideTitle.setText(slide.title);
    this.slideBody.setText(slide.lines.join("\n"));
  }

  /** O apresentador dá um pulinho a cada slide novo; os outros ficam parados. */
  private updateSpeakers() {
    const sinceBump = this.t - this.slideBumpAt;
    this.speakers.forEach((speaker, i) => {
      const base = iso(speaker.col, speaker.row, STAGE.height);
      const hop = i === 0 && sinceBump >= 0 && sinceBump < 0.3 ? -Math.sin((sinceBump / 0.3) * Math.PI) * 5 : 0;
      speaker.gfx.setPosition(base.x, base.y + hop).setDepth(base.y);
    });
  }
}
