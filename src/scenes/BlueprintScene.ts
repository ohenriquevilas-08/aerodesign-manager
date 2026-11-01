// Blueprint da Prancheta (design §6.1), no estilo da oficina do C.A.T.S: traço branco sobre azul técnico,
// vista de cima e vista lateral, cotas da envergadura. Redesenha ao vivo com o rascunho que a UI entrega
// por blueprintChannel.show(design). Só desenha: a geometria sai de blueprint/geometry.ts.
// A escala é fixa (cabe o maior avião possível), para o desenho crescer e encolher com os controles.

import Phaser from "phaser";
import { DEFAULT_DESIGN, DESIGN_LIMITS } from "../sim";
import { vec } from "./hangar/iso";
import { blueprintChannel } from "./blueprint/channel";
import { blueprintGeometry, type BlueprintGeometry, type Surface } from "./blueprint/geometry";
import { css, fonts, palette } from "./palette";
import { marginBand, type BlueprintDesign, type MarginBand } from "./phase5";

const fmt = (value: number, digits = 2) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Maior comprimento (hélice à cauda) e maior envergadura que o desenho precisa comportar, m. */
const REF_LENGTH = 2.5;
const REF_SPAN = DESIGN_LIMITS.span.max;
const MARGIN = 28;
const LINE = 2;

const BAND_COLOR: Record<MarginBand, number> = { ok: palette.ok, risk: palette.warn, unstable: palette.danger };
const BAND_LABEL: Record<MarginBand, string> = { ok: "margem", risk: "margem baixa", unstable: "INSTÁVEL" };

const SURFACE_LABEL = { 1: "Asa voadora (N = 1)", 2: "Convencional (N = 2)", 3: "Três superfícies (N = 3)" } as const;
const MATERIAL_LABEL = { balsa: "Balsa", composite: "Compósito", mixed: "Misto" } as const;
const PHILOSOPHY_LABEL = { payload: "Alta carga", light: "Leve", stable: "Estável" } as const;
const GEAR_LABEL = { low: "Baixo", high: "Alto" } as const;

type Point = [number, number];

export class BlueprintScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private labelCursor = 0;
  /** Projeto pedido e projeto desenhado; envergadura e potência deslizam até o pedido. */
  private target: BlueprintDesign = DEFAULT_DESIGN;
  private shown: BlueprintDesign = DEFAULT_DESIGN;
  /** Projeto gravado do modo comparação, desenhado em traço apagado por baixo do rascunho. */
  private reference: BlueprintDesign | null = null;
  private ghost = false;
  private dirty = true;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super("blueprint");
  }

  create() {
    this.target = blueprintChannel.current ?? DEFAULT_DESIGN;
    this.shown = this.target;
    this.gfx = this.add.graphics();
    this.reference = blueprintChannel.reference;
    this.unsubscribe = blueprintChannel.subscribe(
      (design) => {
        this.target = design;
        this.dirty = true;
      },
      (reference) => {
        this.reference = reference;
        this.dirty = true;
      }
    );
    const onResize = () => {
      this.dirty = true;
    };
    this.scale.on("resize", onResize);
    // game.destroy() (ao trocar de tela) emite DESTROY, não SHUTDOWN: limpar nos dois.
    const cleanup = () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.scale.off("resize", onResize);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  update() {
    if (!this.dirty) return;
    // Desliza envergadura e potência; o resto troca na hora.
    const ease = (from: number, to: number) => (Math.abs(to - from) < 0.002 * Math.abs(to) ? to : from + (to - from) * 0.25);
    this.shown = {
      ...this.target,
      span: ease(this.shown.span, this.target.span),
      powerW: ease(this.shown.powerW, this.target.powerW)
    };
    this.dirty = this.shown.span !== this.target.span || this.shown.powerW !== this.target.powerW;
    this.draw();
  }

  // ------------------------------------------------------------------ texto

  private text(content: string, x: number, y: number, options: { color?: string; size?: string; origin?: Point; family?: string } = {}) {
    if (this.ghost) return;
    let label = this.labels[this.labelCursor];
    if (!label) {
      label = this.add.text(0, 0, "", { fontFamily: fonts.mono }).setResolution(2).setDepth(10);
      this.labels.push(label);
    }
    this.labelCursor += 1;
    const [ox, oy] = options.origin ?? [0, 0];
    label
      .setStyle({ fontFamily: options.family ?? fonts.mono, fontSize: options.size ?? "11px", color: options.color ?? palette.text })
      .setText(content)
      .setOrigin(ox, oy)
      .setPosition(x, y)
      .setVisible(true);
  }

  // ------------------------------------------------------------------ desenho

  private draw() {
    const g = this.gfx;
    const { width, height } = this.scale;
    g.clear();
    this.labelCursor = 0;

    g.fillStyle(palette.blueprint, 1).fillRect(0, 0, width, height);
    this.drawGrid(width, height);

    // Três vistas: superior e lateral à esquerda, frontal numa coluna à direita (com o carimbo embaixo).
    const frontW = Math.min(300, Math.max(120, width * 0.3));
    const mainW = width - frontW - MARGIN * 2;
    const scale = Math.min((mainW - 150) / REF_LENGTH, (height - 160) / (REF_SPAN + 1.1));
    const topY = MARGIN + 34 + (REF_SPAN * scale) / 2;
    const originX = MARGIN + 56 + 0.1 * scale;
    const groundY = Math.min(height - MARGIN - 20, topY + (REF_SPAN * scale) / 2 + 40 + 0.8 * scale);
    const frontScale = (frontW - 40) / REF_SPAN;
    const frontX = width - MARGIN - frontW / 2;
    const frontGroundY = MARGIN + 30 + 1.1 * frontScale * 1.6;

    const geo = blueprintGeometry(this.shown);
    if (this.reference) {
      this.ghost = true;
      const ref = blueprintGeometry(this.reference);
      this.drawTopView(ref, originX, topY, scale);
      this.drawSideView(ref, originX, groundY, scale);
      this.drawFrontView(ref, frontX, frontGroundY, frontScale);
      this.ghost = false;
    }
    this.drawTopView(geo, originX, topY, scale);
    this.drawSideView(geo, originX, groundY, scale);
    this.drawFrontView(geo, frontX, frontGroundY, frontScale);
    if (this.reference) this.text("TRAÇO APAGADO: PROJETO GRAVADO", MARGIN, height - MARGIN - 6, { color: palette.textMuted, size: "10px", origin: [0, 1] });
    if (width >= 760) this.drawTitleBlock(geo, width, height);

    for (let i = this.labelCursor; i < this.labels.length; i += 1) this.labels[i]!.setVisible(false);
  }

  private drawGrid(width: number, height: number) {
    const g = this.gfx;
    for (const [step, alpha] of [[20, 0.25], [100, 0.55]] as const) {
      g.lineStyle(1, palette.blueprintGrid, alpha);
      for (let x = 0; x <= width; x += step) g.lineBetween(x, 0, x, height);
      for (let y = 0; y <= height; y += step) g.lineBetween(0, y, width, y);
    }
    g.lineStyle(LINE, palette.ink, 0.9).strokeRect(10, 10, width - 20, height - 20);
  }

  /** Caneta: no modo fantasma (projeto gravado) o traço fica apagado e sem cor de alerta. */
  private pen(width: number, color: number, alpha: number) {
    return this.gfx.lineStyle(width, this.ghost ? palette.inkMuted : color, this.ghost ? alpha * 0.4 : alpha);
  }

  private line(a: Point, b: Point, color: number = palette.ink, width = LINE, alpha = 1) {
    this.pen(width, color, alpha).lineBetween(a[0], a[1], b[0], b[1]);
  }

  /** Contorno de polígono. `fillPoints` e `strokePoints` do Phaser 4.2 exigem Vector2[]. */
  private poly(points: Point[], fill = 0.0) {
    const vectors = vec(points.map(([x, y]) => ({ x, y })));
    if (fill > 0 && !this.ghost) this.gfx.fillStyle(palette.ink, fill).fillPoints(vectors, true);
    this.pen(LINE, palette.ink, 1).strokePoints(vectors, true, true);
  }

  private dashed(a: Point, b: Point, color: number = palette.ink, alpha = 0.7) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.floor(length / 10);
    for (let i = 0; i < steps; i += 2) {
      const t0 = i / steps;
      const t1 = Math.min(1, (i + 1) / steps);
      this.line([a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1], color, 1, alpha);
    }
  }

  /** Cota: linha com setas nas pontas e o valor no meio. */
  private dimension(a: Point, b: Point, label: string, color: number = palette.ink, side: 1 | -1 = 1) {
    if (this.ghost) return;
    this.line(a, b, color, 1);
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    for (const [tip, dir] of [[a, 1], [b, -1]] as const) {
      for (const spread of [0.4, -0.4]) {
        const x = tip[0] + dir * Math.cos(angle + spread) * 9;
        const y = tip[1] + dir * Math.sin(angle + spread) * 9;
        this.line(tip, [x, y], color, 1);
      }
    }
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const vertical = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]);
    this.text(label, vertical ? mx + 8 * side : mx, vertical ? my : my - 6 * side, {
      color: css(color),
      origin: vertical ? [side === 1 ? 0 : 1, 0.5] : [0.5, side === 1 ? 1 : 0]
    });
  }

  // ------------------------------------------------------------------ vista de cima

  private drawTopView(geo: BlueprintGeometry, ox: number, cy: number, s: number) {
    const X = (x: number) => ox + x * s;
    const Y = (y: number) => cy + y * s;
    this.text("VISTA SUPERIOR", MARGIN, MARGIN - 8, { color: palette.textMuted, size: "11px" });
    this.dashed([X(-0.15), Y(0)], [X(geo.length + 0.1), Y(0)]);

    // Asas, canard e empenagem: contorno, longarina e hachura.
    for (const surface of geo.surfaces) this.drawSurfaceTop(geo, surface, X, Y, s);

    // Fuselagem: nariz arredondado, cauda afunilada.
    const half = geo.fuselage.width / 2;
    const L = geo.fuselage.length;
    this.poly([
      [X(0), Y(0)],
      [X(L * 0.06), Y(-half * 0.7)],
      [X(L * 0.16), Y(-half)],
      [X(L * 0.6), Y(-half)],
      [X(L), Y(-half * 0.25)],
      [X(L), Y(half * 0.25)],
      [X(L * 0.6), Y(half)],
      [X(L * 0.16), Y(half)],
      [X(L * 0.06), Y(half * 0.7)]
    ], 0.1);

    // Deriva (vista de cima é uma linha sobre o eixo).
    this.line([X(geo.fin.x), Y(0)], [X(geo.fin.x + geo.fin.chord), Y(0)], palette.ink, 4);

    // Motor e hélice no nariz.
    const mh = geo.motor.diameter / 2;
    this.poly([[X(geo.motor.x), Y(-mh)], [X(geo.motor.x + geo.motor.length), Y(-mh)], [X(geo.motor.x + geo.motor.length), Y(mh)], [X(geo.motor.x), Y(mh)]], 0.15);
    this.line([X(geo.prop.x), Y(-geo.prop.diameter / 2)], [X(geo.prop.x), Y(geo.prop.diameter / 2)], palette.ink, 3);
    this.pen(1, palette.ink, 0.35).strokeCircle(X(geo.prop.x), Y(0), (geo.prop.diameter / 2) * s);

    // Rodas: principal em dois pontos, de nariz no eixo.
    const wheel = (x: number, y: number) =>
      this.poly([[X(x - geo.gear.wheelDiameter / 2), Y(y - 0.015)], [X(x + geo.gear.wheelDiameter / 2), Y(y - 0.015)], [X(x + geo.gear.wheelDiameter / 2), Y(y + 0.015)], [X(x - geo.gear.wheelDiameter / 2), Y(y + 0.015)]]);
    wheel(geo.gear.mainX, -geo.gear.mainTrack / 2);
    wheel(geo.gear.mainX, geo.gear.mainTrack / 2);
    wheel(geo.gear.noseX, 0);

    // Cotas: envergadura à direita, comprimento embaixo.
    const wing = geo.surfaces[0]!;
    const dx = X(geo.length) + 36;
    this.line([X(wing.x + wing.span * 0 + wing.sweep + wing.chord), Y(-wing.span / 2)], [dx + 6, Y(-wing.span / 2)], palette.ink, 1, 0.5);
    this.line([X(wing.x + wing.sweep + wing.chord), Y(wing.span / 2)], [dx + 6, Y(wing.span / 2)], palette.ink, 1, 0.5);
    this.dimension([dx, Y(-wing.span / 2)], [dx, Y(wing.span / 2)], `b = ${fmt(geo.wingspan)} m`, palette.highlight);
    const dy = Y(Math.max(wing.span / 2, 0.4)) + 22;
    this.dimension([X(geo.prop.x), dy], [X(geo.length), dy], `${fmt(geo.length - geo.prop.x)} m`);

    // Corda da ponta (acima da semi-asa), alongamento junto à cota da envergadura e volume de cauda.
    const [leTip, teTip] = this.edges(wing, wing.span / 2);
    this.dimension([X(leTip), Y(-wing.span / 2) - 12], [X(teTip), Y(-wing.span / 2) - 12], `c ${fmt(wing.chord)} m (raiz)`, palette.accent, 1);
    this.text(`AR = ${fmt(geo.aspectRatio, 1)}`, dx + 8, Y(0) + 18, { color: palette.textMuted });
    const tail = geo.surfaces.find((surface) => surface.role === "tail");
    if (tail) this.text(`VH = ${fmt(geo.tailVolume)}`, X(tail.x + tail.chord) + 6, Y(-tail.span / 2) - 4, { color: palette.textMuted, origin: [0, 1] });
  }

  /** Posição do bordo de ataque e de fuga a uma distância |y| do eixo. */
  private edges(surface: Surface, y: number): [number, number] {
    const t = Math.min(1, Math.abs(y) / (surface.span / 2));
    const le = surface.x + surface.sweep * t;
    return [le, le + surface.chord * (1 - surface.taper * t)];
  }

  private drawSurfaceTop(geo: BlueprintGeometry, surface: Surface, X: (x: number) => number, Y: (y: number) => number, s: number) {
    const half = surface.span / 2;
    const [leRoot, teRoot] = this.edges(surface, 0);
    const [leTip, teTip] = this.edges(surface, half);
    this.poly([
      [X(leRoot), Y(-0)],
      [X(leTip), Y(-half)],
      [X(teTip), Y(-half)],
      [X(teRoot), Y(0)],
      [X(teTip), Y(half)],
      [X(leTip), Y(half)]
    ], 0.07);
    this.pen(1, palette.ink, 0.6);
    const isWing = surface.role === "wing";
    const sparWidth = isWing ? geo.sparWidth : geo.sparWidth * 0.6;
    const hatch = isWing ? geo.hatch : "ribs";

    // Nervuras: uma linha do bordo de ataque ao de fuga a cada estação.
    if (hatch === "ribs" || hatch === "mixed") {
      const count = isWing ? geo.ribs : Math.max(2, Math.round(geo.ribs * (surface.span / geo.wingspan)));
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 1; i <= count; i += 1) {
          const y = side * (half * i) / (count + 1) * 1.0;
          const [le, te] = this.edges(surface, y);
          this.line([X(le), Y(y)], [X(te), Y(y)], palette.ink, 1, 0.45);
        }
      }
    }
    // Trama de compósito: tracinhos em X dentro do contorno (todo no compósito, só na faixa da longarina no misto).
    if (hatch === "weave" || hatch === "mixed") {
      const cell = 0.06;
      for (let y = -half + cell / 2; y < half; y += cell) {
        const [le, te] = this.edges(surface, y);
        const from = hatch === "mixed" ? le + (te - le) * (geo.sparAt - 0.12) : le;
        const to = hatch === "mixed" ? le + (te - le) * (geo.sparAt + 0.12) : te;
        for (let x = from + cell / 2; x < to; x += cell) {
          const h = (cell / 2) * s * 0.7;
          this.line([X(x) - h, Y(y) + h], [X(x) + h, Y(y) - h], palette.ink, 1, 0.4);
          if (hatch === "weave") this.line([X(x) - h, Y(y) - h], [X(x) + h, Y(y) + h], palette.ink, 1, 0.4);
        }
      }
    }
    // Longarina: linha grossa ao longo da envergadura.
    const [le0, te0] = this.edges(surface, 0);
    const [le1, te1] = this.edges(surface, half);
    const at = geo.sparAt;
    const spar = (side: 1 | -1) => this.line([X(le0 + (te0 - le0) * at), Y(0)], [X(le1 + (te1 - le1) * at), Y(side * half)], palette.accent, Math.max(2, sparWidth * s), 0.9);
    spar(-1);
    spar(1);
  }

  // ------------------------------------------------------------------ vista lateral

  private drawSideView(geo: BlueprintGeometry, ox: number, groundY: number, s: number) {
    const X = (x: number) => ox + x * s;
    const Z = (z: number) => groundY - z * s;
    this.text("VISTA LATERAL", MARGIN, groundY - 1.1 * s - 52, { color: palette.textMuted });

    // Solo com hachura.
    this.line([MARGIN + 20, Z(0)], [X(REF_LENGTH) + 20, Z(0)], palette.ink, 2);
    for (let x = MARGIN + 20; x < X(REF_LENGTH) + 20; x += 14) this.line([x, Z(0)], [x - 8, Z(0) + 8], palette.ink, 1, 0.35);

    const f = geo.fuselage;
    const L = f.length;
    // Fuselagem: cabine abaulada, cauda subindo.
    this.poly([
      [X(0), Z(f.z + f.height * 0.35)],
      [X(L * 0.05), Z(f.z + f.height * 0.8)],
      [X(L * 0.2), Z(f.z + f.height)],
      [X(L * 0.55), Z(f.z + f.height)],
      [X(L), Z(f.z + f.height * 0.8)],
      [X(L), Z(f.z + f.height * 0.5)],
      [X(L * 0.55), Z(f.z)],
      [X(L * 0.2), Z(f.z)],
      [X(L * 0.05), Z(f.z + f.height * 0.1)]
    ], 0.1);

    // Deriva.
    const top = f.z + f.height * 0.9;
    this.poly([[X(geo.fin.x), Z(top)], [X(geo.fin.x + geo.fin.chord * 0.4), Z(top + geo.fin.height)], [X(geo.fin.x + geo.fin.chord), Z(top + geo.fin.height)], [X(geo.fin.x + geo.fin.chord), Z(top)]], 0.08);

    // Perfis das superfícies sustentadoras.
    for (const surface of geo.surfaces) {
      const thick = surface.role === "wing" ? geo.airfoilThickness : surface.chord * 0.1;
      const x0 = X(surface.x);
      const x1 = X(surface.x + surface.chord);
      const z = Z(surface.z);
      const t = thick * s;
      this.poly([[x0, z], [x0 + (x1 - x0) * 0.15, z - t * 0.6], [x0 + (x1 - x0) * 0.35, z - t / 2 - t * 0.5], [x1, z - t * 0.1], [x1, z], [x0 + (x1 - x0) * 0.4, z + t * 0.4]], 0.18);
      if (surface.role === "wing") {
        this.line([x0 + (x1 - x0) * geo.sparAt, z - t * 0.9], [x0 + (x1 - x0) * geo.sparAt, z + t * 0.4], palette.accent, Math.max(2, geo.sparWidth * s));
      }
    }

    // Motor e hélice.
    const mh = geo.motor.diameter / 2;
    const mz = geo.motor.z;
    this.poly([[X(geo.motor.x), Z(mz + mh)], [X(geo.motor.x + geo.motor.length), Z(mz + mh)], [X(geo.motor.x + geo.motor.length), Z(mz - mh)], [X(geo.motor.x), Z(mz - mh)]], 0.15);
    const clear = geo.propClearance;
    const bad = clear < 0.02;
    const propColor = bad ? palette.danger : palette.ink;
    this.line([X(geo.prop.x), Z(mz + geo.prop.diameter / 2)], [X(geo.prop.x), Z(mz - geo.prop.diameter / 2)], propColor, 3);

    // Trem: pernas e rodas.
    const wheelR = geo.gear.wheelDiameter / 2;
    for (const x of [geo.gear.noseX, geo.gear.mainX]) {
      this.line([X(x), Z(f.z)], [X(x), Z(wheelR)], palette.ink, 2);
      this.pen(LINE, palette.ink, 1).strokeCircle(X(x), Z(wheelR), wheelR * s);
    }

    // Cota da folga da hélice ao solo.
    const cx = X(geo.prop.x) - 22;
    const tip = mz - geo.prop.diameter / 2;
    if (tip > 0.005) {
      this.dimension([cx, Z(0)], [cx, Z(tip)], `${fmt(clear * 100, 0)} cm`, propColor, -1);
    } else {
      this.text(`HÉLICE NO SOLO (${fmt(clear * 100, 0)} cm)`, X(geo.prop.x) - 6, Z(0) + 14, { color: css(palette.danger), origin: [0, 0] });
    }
    this.dimension([X(geo.length) + 36, Z(0)], [X(geo.length) + 36, Z(f.z + f.height + geo.fin.height)], `${fmt(f.z + f.height + geo.fin.height)} m`, palette.ink);
    this.drawStability(geo, X, Z, s);
  }

  /** CG e ponto neutro na lateral, com a margem estática entre eles na cor da faixa. */
  private drawStability(geo: BlueprintGeometry, X: (x: number) => number, Z: (z: number) => number, s: number) {
    const color = BAND_COLOR[marginBand(geo.marginPercentMac)];
    const f = geo.fuselage;
    const cx = X(geo.cg.x);
    const nx = X(geo.neutral.x);
    const y = Z(geo.cg.z);
    const above = Z(f.z + f.height) - 34;
    const r = 6;
    // PN: losango vazado. CG: círculo em quartos (símbolo de centro de massa).
    this.pen(2, color, 1).strokePoints(vec([{ x: nx, y: y - r }, { x: nx + r, y }, { x: nx, y: y + r }, { x: nx - r, y }]), true, true);
    this.pen(2, palette.ink, 1).strokeCircle(cx, y, r);
    if (!this.ghost) {
      this.gfx.fillStyle(palette.ink, 1);
      this.gfx.slice(cx, y, r, 0, Math.PI / 2, false).fillPath();
      this.gfx.slice(cx, y, r, Math.PI, Math.PI * 1.5, false).fillPath();
    }
    this.line([cx, y - r], [cx, above], palette.ink, 1, 0.6);
    this.line([nx, y - r], [nx, above], color, 1, 0.8);
    const band = marginBand(geo.marginPercentMac);
    if (Math.abs(nx - cx) > 14) this.dimension([Math.min(cx, nx), above], [Math.max(cx, nx), above], "", color);
    this.text(`${BAND_LABEL[band]} ${fmt(geo.marginPercentMac, 1)}% CMA`, (cx + nx) / 2, above - 4, { origin: [0.5, 1], size: "10px", color: css(color) });
    this.text(`CG ${fmt(geo.cg.percentMac, 0)}%`, Math.min(cx, nx) - 4, above + 4, { origin: [1, 0], size: "10px" });
    this.text("PN", Math.max(cx, nx) + 4, above + 4, { origin: [0, 0], size: "10px", color: css(color) });
    // CMA: barra fina sob a asa.
    const zWing = Z(geo.surfaces[0]!.z) + 18;
    this.line([X(geo.mac.x), zWing], [X(geo.mac.x + geo.mac.length), zWing], palette.accent, 2, 0.8);
    this.text("CMA", X(geo.mac.x + geo.mac.length / 2), zWing + 3, { size: "9px", color: css(palette.accent), origin: [0.5, 0] });
    void s;
  }

  // ------------------------------------------------------------------ vista frontal

  private drawFrontView(geo: BlueprintGeometry, cx: number, groundY: number, s: number) {
    const Y = (y: number) => cx + y * s;
    const Z = (z: number) => groundY - z * s;
    const fr = geo.front;
    this.text("VISTA FRONTAL", cx - REF_SPAN * s / 2, Z(0) - 1.7 * s - 18, { color: palette.textMuted });
    this.line([cx - (REF_SPAN * s) / 2, Z(0)], [cx + (REF_SPAN * s) / 2, Z(0)], palette.ink, 2);

    // Fuselagem (seção): elipse achatada em polígono.
    const f = geo.fuselage;
    const hw = f.width / 2;
    const section: Point[] = [];
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      section.push([Y(Math.cos(a) * hw), Z(f.z + f.height / 2 + Math.sin(a) * (f.height / 2))]);
    }
    this.poly(section, 0.1);

    // Deriva (sobre o eixo) e empenagem horizontal.
    const finTop = f.z + f.height * 0.9 + geo.fin.height;
    this.line([Y(0), Z(f.z + f.height * 0.9)], [Y(0), Z(finTop)], palette.ink, 3);
    if (fr.tailSpan > 0) this.line([Y(-fr.tailSpan / 2), Z(fr.tailZ)], [Y(fr.tailSpan / 2), Z(fr.tailZ)], palette.ink, 2, 0.8);

    // Asa com diedro fixo: da raiz à ponta, sobe nos dois lados; posição alta ou baixa.
    const half = geo.wingspan / 2;
    const thick = geo.airfoilThickness;
    this.poly([
      [Y(-half), Z(fr.wingTipZ)],
      [Y(0), Z(fr.wingRootZ)],
      [Y(half), Z(fr.wingTipZ)],
      [Y(half), Z(fr.wingTipZ) - Math.max(2, thick * 0.4 * s)],
      [Y(0), Z(fr.wingRootZ) + thick * s * 0.5],
      [Y(-half), Z(fr.wingTipZ) - Math.max(2, thick * 0.4 * s)]
    ], 0.15);

    // Motor/hélice de frente: disco da hélice e cubo.
    const mz = geo.motor.z;
    const bad = geo.propClearance < 0.02;
    const propColor = bad ? palette.danger : palette.ink;
    this.pen(1.5, propColor, 0.8).strokeCircle(Y(0), Z(mz), (fr.propDiameter / 2) * s);
    this.line([Y(-fr.propDiameter / 2), Z(mz)], [Y(fr.propDiameter / 2), Z(mz)], propColor, 2, 0.5);
    this.pen(2, palette.ink, 1).strokeCircle(Y(0), Z(mz), (geo.motor.diameter / 2) * s);

    // Trem: bitola e rodas.
    const wheelR = geo.gear.wheelDiameter / 2;
    for (const side of [-1, 1]) {
      this.line([Y(side * Math.min(hw, fr.track / 2) * 0.6), Z(f.z)], [Y(side * fr.track / 2), Z(wheelR)], palette.ink, 2);
      this.poly([[Y(side * fr.track / 2) - wheelR * s * 0.3, Z(0)], [Y(side * fr.track / 2) + wheelR * s * 0.3, Z(0)], [Y(side * fr.track / 2) + wheelR * s * 0.3, Z(wheelR * 2)], [Y(side * fr.track / 2) - wheelR * s * 0.3, Z(wheelR * 2)]]);
    }

    // Cotas: diâmetro da hélice (polegadas) e posição da asa.
    this.text(`ASA ${fr.wingPosition === "high" ? "ALTA" : "BAIXA"} · DIEDRO ${fr.dihedralDeg}° · HÉLICE ${fmt(fr.propDiameter / 0.0254, 0)}"`, cx, Z(0) + 14, { color: palette.textMuted, size: "10px", origin: [0.5, 0] });
  }

  // ------------------------------------------------------------------ carimbo

  private drawTitleBlock(_geo: BlueprintGeometry, width: number, height: number) {
    const design = this.target;
    const rows: [string, string][] = [
      ["ENVERGADURA", `${fmt(design.span)} m`],
      ["SUPERFÍCIES", SURFACE_LABEL[design.surfaces]],
      ["POTÊNCIA", `${Math.round(design.powerW)} W`],
      ["FILOSOFIA", PHILOSOPHY_LABEL[design.philosophy]],
      ["MATERIAL", MATERIAL_LABEL[design.material]],
      ["TREM", GEAR_LABEL[design.gear]]
    ];
    const w = 230;
    const h = 34 + rows.length * 16;
    const x = width - w - MARGIN;
    const y = height - h - MARGIN;
    const g = this.gfx;
    g.fillStyle(palette.blueprint, 0.9).fillRect(x, y, w, h);
    g.lineStyle(LINE, palette.ink, 1).strokeRect(x, y, w, h);
    g.lineStyle(1, palette.ink, 0.6).lineBetween(x, y + 24, x + w, y + 24);
    this.text("PROJETO DA EQUIPE", x + 10, y + 5, { size: "15px", family: fonts.display });
    rows.forEach(([key, value], i) => {
      const ry = y + 32 + i * 16;
      this.text(key, x + 10, ry, { color: palette.textMuted, size: "10px" });
      this.text(value, x + w - 10, ry, { origin: [1, 0] });
    });
  }
}
