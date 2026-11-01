// Abertura (Fase 6, C1): a sala do professor orientador em isométrico, no estilo do hangar. Os fundadores
// entram pela porta, param em frente à mesa e quem está falando ganha destaque e um balão.
// Só anima: a lista de fundadores e o índice de quem fala chegam por introChannel (a UI, U2, decide
// o texto). A encenação (lugares, ordem, trajeto) é pura e vive em intro/staging.ts.
// Tempo real: não segue clock.speed, porque o relógio do jogo ainda está pausado na abertura.

import Phaser from "phaser";
import { iso, isoBox, vec, colWallQuad, rowWallQuad } from "./hangar/iso";
import { introChannel, type IntroFounder } from "./intro/channel";
import {
  DESK,
  ROOM,
  balloonDots,
  entranceDuration,
  founderFrame,
  speakerView,
  standSlots
} from "./intro/staging";
import { css, fonts, palette, shade } from "./palette";
import { setSprite } from "./people/sprite/phaser";

const WALL_H = 130;
/** Escala inteira do sprite em pixel art (48 px de arte = 96 px de tela). */
const AVATAR_SCALE = 2;
const SPRITE_HEIGHT_PX = 48 * AVATAR_SCALE;
const ROOM_DEPTH = -1_000_000;
const OVERLAY_DEPTH = 1_000_000;
const BALLOON_H = 40;

interface Figure {
  founder: IntroFounder;
  gfx: Phaser.GameObjects.Image;
  /** Facing com que o gfx foi desenhado; redesenha quando muda. */
  facing: 1 | -1;
  spot: Phaser.GameObjects.Graphics;
  /** 0 a 1: quanto o destaque já subiu (suaviza a troca de quem fala). */
  emphasis: number;
}

const mix = (a: number, b: number, k: number) => {
  const ch = (shift: number) => Math.round(((a >> shift) & 0xff) * (1 - k) + ((b >> shift) & 0xff) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

export class IntroScene extends Phaser.Scene {
  private figures: Figure[] = [];
  private t = 0;
  private speaker: number | null = null;
  private balloon!: Phaser.GameObjects.Container;
  private balloonBox!: Phaser.GameObjects.Graphics;
  private balloonName!: Phaser.GameObjects.Text;
  private balloonDots!: Phaser.GameObjects.Text;
  private balloonKey = "";
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super("intro");
  }

  create() {
    this.drawRoom();
    this.createBalloon();
    this.rebuild(introChannel.founders);
    this.setSpeaker(introChannel.speaker);

    this.unsubscribe = introChannel.subscribe(
      (founders) => {
        this.rebuild(founders);
        this.setSpeaker(null);
      },
      (speaker) => this.setSpeaker(speaker)
    );
    this.layout();
    this.scale.on("resize", this.layout, this);
    // game.destroy() (ao trocar de tela) emite DESTROY, não SHUTDOWN: limpar nos dois.
    const cleanup = () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.scale.off("resize", this.layout, this);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    // Atalho de depuração: window.__introScene.seek(t) pula a entrada (s).
    if (import.meta.env.DEV) (window as unknown as { __introScene?: IntroScene }).__introScene = this;
  }

  /** Só para depuração: leva a entrada ao instante t (s). */
  seek(t: number) {
    this.t = t;
  }

  private layout() {
    const { width, height } = this.scale;
    const left = iso(0, ROOM.rows).x - 24;
    const right = iso(ROOM.cols, 0).x + 24;
    const top = iso(0, 0, WALL_H).y - 20;
    const bottom = iso(ROOM.cols, ROOM.rows).y + 20;
    const zoom = Phaser.Math.Clamp(Math.min(width / (right - left), height / (bottom - top)), 0.5, 2);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn((left + right) / 2, (top + bottom) / 2);
  }

  // ------------------------------------------------------------------ sala

  private drawRoom() {
    const g = this.add.graphics().setDepth(ROOM_DEPTH);
    const { cols, rows } = ROOM;

    // Piso: losangos em xadrez suave.
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        g.fillStyle((c + r) % 2 === 0 ? palette.floor : shade(palette.floor, 0.12), 1);
        g.fillPoints(vec([iso(c, r), iso(c + 1, r), iso(c + 1, r + 1), iso(c, r + 1)]), true);
      }
    }
    g.lineStyle(1, palette.floorLine, 0.35);
    for (let c = 0; c <= cols; c += 1) g.lineBetween(iso(c, 0).x, iso(c, 0).y, iso(c, rows).x, iso(c, rows).y);
    for (let r = 0; r <= rows; r += 1) g.lineBetween(iso(0, r).x, iso(0, r).y, iso(cols, r).x, iso(cols, r).y);

    // Tapete sob os fundadores.
    g.fillStyle(palette.blueprint, 1).fillPoints(vec([iso(1.8, 2.9), iso(7.6, 2.9), iso(7.6, 5.9), iso(1.8, 5.9)]), true);
    g.lineStyle(2, palette.blueprintGrid, 1).strokePoints(vec([iso(1.95, 3.05), iso(7.45, 3.05), iso(7.45, 5.75), iso(1.95, 5.75)]), true, true);

    // Paredes do fundo: esquerda (coluna 0, com a porta e a estante) e direita (linha 0, com a janela).
    g.fillStyle(palette.panel, 1).fillPoints(colWallQuad(0, 0, rows, 0, WALL_H), true);
    g.fillStyle(shade(palette.panel, 0.25), 1).fillPoints(rowWallQuad(0, 0, cols, 0, WALL_H), true);
    g.fillStyle(palette.border, 1).fillPoints(colWallQuad(0, 0, rows, 0, 9), true);
    g.fillStyle(shade(palette.border, 0.25), 1).fillPoints(rowWallQuad(0, 0, cols, 0, 9), true);

    this.drawDoor(g);
    this.drawWindow(g);
    this.drawShelf(g);
    this.drawBoard(g);
    this.drawDesk();
  }

  private drawDoor(g: Phaser.GameObjects.Graphics) {
    // Porta aberta na parede esquerda: abertura escura e batente.
    g.fillStyle(palette.night, 1).fillPoints(colWallQuad(0, 3.9, 5.1, 0, 92), true);
    g.lineStyle(3, palette.borderStrong, 1).strokePoints(colWallQuad(0, 3.9, 5.1, 0, 92), true, true);
    g.fillStyle(palette.lamp, 0.12).fillPoints(colWallQuad(0, 4.0, 5.0, 0, 88), true);
  }

  private drawWindow(g: Phaser.GameObjects.Graphics) {
    // Janela na parede direita (linha 0): colunas 2.2..6.8, altura 42..108. Dentro, o campus.
    const c0 = 2.2;
    const c1 = 6.8;
    const z0 = 42;
    const z1 = 108;
    const quad = (a: number, b: number, za: number, zb: number) => rowWallQuad(0, a, b, za, zb);
    g.fillStyle(palette.borderStrong, 1).fillPoints(quad(c0 - 0.12, c1 + 0.12, z0 - 6, z1 + 6), true);

    // Céu em faixas, do azul de cima ao claro do horizonte.
    const bands = 5;
    for (let i = 0; i < bands; i += 1) {
      const k = i / (bands - 1);
      const color = mix(palette.venueClubTop, palette.venueClubBottom, k);
      const zb = z1 - ((z1 - z0) * i) / bands;
      g.fillStyle(color, 1).fillPoints(quad(c0, c1, zb - (z1 - z0) / bands, zb), true);
    }
    // Colinas ao fundo e gramado.
    g.fillStyle(mix(palette.venueGrass, palette.venueClubBottom, 0.45), 1);
    g.fillPoints(vec([iso(c0, 0, z0 + 16), iso(3.4, 0, z0 + 24), iso(4.8, 0, z0 + 18), iso(6.1, 0, z0 + 26), iso(c1, 0, z0 + 20), iso(c1, 0, z0), iso(c0, 0, z0)]), true);
    g.fillStyle(palette.venueGrass, 1).fillPoints(quad(c0, c1, z0, z0 + 10), true);
    // Prédios do campus: bloco com telhado, o galpão do aeroclube em vermelho.
    const building = (a: number, b: number, h: number, wall: number, roof: number) => {
      g.fillStyle(wall, 1).fillPoints(quad(a, b, z0 + 8, z0 + 8 + h), true);
      g.fillStyle(roof, 1).fillPoints(quad(a - 0.05, b + 0.05, z0 + 8 + h, z0 + 12 + h), true);
      g.fillStyle(shade(wall, 0.35), 1);
      for (let col = a + 0.18; col + 0.14 < b; col += 0.34) g.fillPoints(quad(col, col + 0.14, z0 + 14, z0 + 8 + h * 0.6), true);
    };
    building(2.5, 3.5, 30, palette.venueWall, palette.venueRoof);
    building(3.7, 4.5, 22, palette.venueBarn, palette.venueRoof);
    building(5.3, 6.4, 36, palette.venueWall, palette.venueRoof);
    // Árvores.
    const tree = (col: number, h: number) => {
      g.fillStyle(palette.venueTrunk, 1).fillPoints(quad(col - 0.03, col + 0.03, z0 + 6, z0 + 6 + h * 0.4), true);
      g.fillStyle(palette.venueLeaves, 1).fillPoints(vec([iso(col - 0.2, 0, z0 + 6 + h * 0.3), iso(col + 0.2, 0, z0 + 6 + h * 0.3), iso(col, 0, z0 + 6 + h)]), true);
    };
    tree(4.65, 22);
    tree(5.0, 16);
    tree(6.65, 18);
    // Caixilho em cruz e peitoril.
    const mid = (c0 + c1) / 2;
    g.fillStyle(palette.borderStrong, 1).fillPoints(quad(mid - 0.04, mid + 0.04, z0, z1), true);
    g.fillStyle(palette.borderStrong, 1).fillPoints(quad(c0, c1, (z0 + z1) / 2 - 2, (z0 + z1) / 2 + 2), true);
    g.fillStyle(palette.benchTop, 1).fillPoints(quad(c0 - 0.2, c1 + 0.2, z0 - 10, z0 - 6), true);
  }

  private drawShelf(g: Phaser.GameObjects.Graphics) {
    // Estante na parede esquerda (coluna 0): linhas 0.5..3.5, vista pela face voltada para +coluna.
    const r0 = 0.5;
    const r1 = 3.5;
    const depth = 0.7;
    isoBox(g, 0, depth, r0, r1, 0, 104, { top: palette.benchTop, left: shade(palette.bench, 0.3), right: palette.bench, edge: palette.borderStrong });
    const faceQuad = (a: number, b: number, za: number, zb: number) => colWallQuad(depth, a, b, za, zb);
    g.fillStyle(shade(palette.panel, 0.4), 1);
    const shelves = [4, 30, 56, 82];
    for (const z of shelves) g.fillPoints(faceQuad(r0 + 0.08, r1 - 0.08, z + 2, z + 24), true);
    const bookColors = [palette.accent, palette.highlight, palette.ok, palette.warn, palette.danger, palette.inkMuted, palette.blueprintGrid];
    shelves.forEach((z, s) => {
      let row = r0 + 0.14;
      let i = s * 3;
      while (row < r1 - 0.2) {
        const w = 0.09 + ((i * 7) % 4) * 0.025;
        const h = 14 + ((i * 5) % 4) * 3;
        g.fillStyle(bookColors[i % bookColors.length]!, 1).fillPoints(faceQuad(row, row + w, z + 2, z + 2 + h), true);
        row += w + 0.02;
        i += 1;
      }
    });
    // Um modelo de avião na prateleira do topo: o recado de que aqui se fala de aviões.
    const top = iso(depth, 2.2, 108);
    g.fillStyle(palette.ink, 1).fillPoints(vec([{ x: top.x - 14, y: top.y - 2 }, { x: top.x + 14, y: top.y + 5 }, { x: top.x + 12, y: top.y + 8 }, { x: top.x - 16, y: top.y + 1 }]), true);
    g.fillStyle(palette.highlight, 1).fillPoints(vec([{ x: top.x - 3, y: top.y - 4 }, { x: top.x + 4, y: top.y + 0 }, { x: top.x - 4, y: top.y + 9 }, { x: top.x - 10, y: top.y + 5 }]), true);
  }

  private drawBoard(g: Phaser.GameObjects.Graphics) {
    // Quadro branco na parede direita, à esquerda da janela, com um rabisco de asa.
    const quad = (a: number, b: number, za: number, zb: number) => rowWallQuad(0, a, b, za, zb);
    g.fillStyle(palette.borderStrong, 1).fillPoints(quad(7.2, 8.7, 44, 104), true);
    g.fillStyle(palette.ink, 1).fillPoints(quad(7.26, 8.64, 50, 98), true);
    g.lineStyle(2, palette.blueprint, 1);
    const a = iso(7.5, 0, 82);
    const b = iso(8.4, 0, 76);
    g.lineBetween(a.x, a.y, b.x, b.y);
    g.lineStyle(1, palette.blueprintGrid, 1);
    for (const z of [66, 58]) {
      const p = iso(7.5, 0, z);
      const q = iso(8.3, 0, z - 2);
      g.lineBetween(p.x, p.y, q.x, q.y);
    }
  }

  private drawDesk() {
    // Mesa do orientador no primeiro plano; a câmera é o ponto de vista dele, então vemos o tampo
    // e os papéis de frente para os fundadores.
    const g = this.add.graphics().setDepth(iso(DESK.col1, DESK.row1).y);
    const { col0, col1, row0, row1 } = DESK;
    // Pernas e gaveta.
    isoBox(g, col0 + 0.1, col0 + 0.4, row0 + 0.1, row1 - 0.1, 0, 22, { top: palette.panelRaised, left: shade(palette.bench, 0.3), right: palette.bench });
    isoBox(g, col1 - 0.4, col1 - 0.1, row0 + 0.1, row1 - 0.1, 0, 22, { top: palette.panelRaised, left: shade(palette.bench, 0.3), right: palette.bench });
    // Tampo.
    isoBox(g, col0, col1, row0, row1, 22, 4, { top: palette.benchTop, left: shade(palette.bench, 0.2), right: shade(palette.bench, 0.05), edge: palette.ink });
    const topZ = 26;
    // Papéis e prancheta.
    g.fillStyle(palette.ink, 1).fillPoints(vec([iso(3.2, 6.45, topZ), iso(3.9, 6.55, topZ), iso(3.85, 7.0, topZ), iso(3.15, 6.9, topZ)]), true);
    g.fillStyle(palette.inkMuted, 1).fillPoints(vec([iso(4.0, 6.5, topZ), iso(4.6, 6.5, topZ), iso(4.6, 6.95, topZ), iso(4.0, 6.95, topZ)]), true);
    // Notebook aberto de costas para nós (o professor está do outro lado).
    isoBox(g, 5.2, 5.9, 6.55, 7.2, topZ, 1.5, { top: palette.panel, left: palette.border, right: palette.border });
    isoBox(g, 5.2, 5.28, 6.55, 7.2, topZ, 14, { top: palette.panel, left: palette.panel, right: palette.border });
    // Caneca.
    isoBox(g, 6.0, 6.25, 6.6, 6.85, topZ, 7, { top: palette.highlight, left: shade(palette.highlight, 0.35), right: shade(palette.highlight, 0.15) });
  }

  // ------------------------------------------------------------------ fundadores

  private rebuild(founders: IntroFounder[]) {
    for (const figure of this.figures) {
      figure.gfx.destroy();
      figure.spot.destroy();
    }
    this.figures = founders.map((founder) => {
      const spot = this.add.graphics();
      const gfx = this.add.image(0, 0, "__DEFAULT").setScale(AVATAR_SCALE);
      const figure: Figure = { founder, gfx, spot, facing: 1, emphasis: 0 };
      this.paint(figure, 1);
      return figure;
    });
    this.t = 0;
    this.speaker = null;
    this.balloonKey = "";
    this.balloon.setVisible(false);
  }

  private paint(figure: Figure, facing: 1 | -1) {
    figure.facing = facing;
    setSprite(figure.gfx, figure.founder, facing, "stand");
  }

  private setSpeaker(index: number | null) {
    this.speaker = speakerView(this.figures.length, index).index;
  }

  private createBalloon() {
    this.balloonBox = this.add.graphics();
    this.balloonName = this.add
      .text(0, 0, "", { fontFamily: fonts.body, fontSize: "11px", color: css(palette.blueprintGrid), fontStyle: "600" })
      .setOrigin(0.5, 0)
      .setResolution(2);
    this.balloonDots = this.add
      .text(0, 0, "", { fontFamily: fonts.mono, fontSize: "16px", color: css(palette.bg) })
      .setOrigin(0.5, 0)
      .setResolution(2);
    this.balloon = this.add.container(0, 0, [this.balloonBox, this.balloonName, this.balloonDots]).setDepth(OVERLAY_DEPTH).setVisible(false);
  }

  /** Balão acima do falante: nome em cima e os pontinhos de "falando" embaixo. */
  private placeBalloon(x: number, y: number, name: string, dots: number) {
    const key = name;
    if (key !== this.balloonKey) {
      this.balloonKey = key;
      this.balloonName.setText(name);
      const w = Math.max(72, this.balloonName.width + 24);
      const h = BALLOON_H;
      this.balloonBox.clear();
      this.balloonBox.fillStyle(palette.ink, 1);
      this.balloonBox.fillRoundedRect(-w / 2, -h, w, h, 8);
      this.balloonBox.fillPoints(vec([{ x: -6, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 9 }]), true);
      this.balloonBox.lineStyle(2, palette.highlight, 1).strokeRoundedRect(-w / 2, -h, w, h, 8);
      this.balloonName.setPosition(0, -h + 5);
    }
    this.balloonDots.setText("•".repeat(dots) + " ".repeat(3 - dots)).setPosition(0, -BALLOON_H + 19);
    this.balloon.setPosition(x, y).setVisible(true);
  }

  update(_time: number, delta: number) {
    this.t += delta / 1000;
    const count = this.figures.length;
    const slots = standSlots(count);
    const arrived = this.t >= entranceDuration(count);

    this.figures.forEach((figure, index) => {
      const frame = founderFrame(index, count, this.t);
      figure.gfx.setVisible(frame.visible);
      if (!frame.visible) {
        figure.spot.setVisible(false);
        return;
      }
      if (frame.facing !== figure.facing) this.paint(figure, frame.facing);
      const speaking = arrived && this.speaker === index;
      const target = speaking ? 1 : 0;
      figure.emphasis += (target - figure.emphasis) * 0.2;

      const base = iso(frame.col, frame.row);
      const bob = frame.walking ? -Math.abs(Math.sin(this.t * 11)) * 3 : 0;
      const hop = figure.emphasis * -4;
      const scale = 1 + figure.emphasis * 0.1;
      const dim = arrived && this.speaker !== null && !speaking ? 0.6 : 1;
      figure.gfx.setPosition(base.x, base.y + bob + hop).setAlpha(dim).setDepth(base.y);

      // Mancha de luz no piso sob quem fala.
      figure.spot.clear().setVisible(figure.emphasis > 0.02).setDepth(base.y - 1);
      if (figure.emphasis > 0.02) {
        figure.spot.fillStyle(palette.highlight, 0.35 * figure.emphasis).fillEllipse(base.x, base.y + 2, 58 * (0.7 + 0.3 * figure.emphasis), 28);
        figure.spot.lineStyle(2, palette.highlight, 0.9 * figure.emphasis).strokeEllipse(base.x, base.y + 2, 58 * (0.7 + 0.3 * figure.emphasis), 28);
      }
    });

    const speakerFigure = this.speaker !== null ? this.figures[this.speaker] : undefined;
    const slot = this.speaker !== null ? slots[this.speaker] : undefined;
    if (arrived && speakerFigure && slot) {
      const head = iso(slot.col, slot.row);
      this.placeBalloon(head.x, head.y - SPRITE_HEIGHT_PX - 6, speakerFigure.founder.name, balloonDots(this.t));
    } else {
      this.balloon.setVisible(false);
    }
  }
}
