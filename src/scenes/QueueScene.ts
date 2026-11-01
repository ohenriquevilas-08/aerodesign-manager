// Fila de decolagem da competição (design §9.4 e §11), vista de lado como a FlightScene: a pista,
// as equipes esperando na taxiway com a sua destacada, o sol subindo com o relógio (o ar fica
// menos denso) e a biruta mostrando o vento. Quem chega à cabeceira e sai da fila decola.
// Lê o store (queue/queueView.ts); nunca muda o estado. As animações seguem clock.speed.

import Phaser from "phaser";
import type { GameStore } from "../app/store";
import { clockToDate, currentDensityAltitude, formatTime, type GameState } from "../sim";
import { css, fonts, palette, shade } from "./palette";
import { hourOfDay, queueViewFromState, sunElevation, sunProgress, windsock, type QueueTeamView, type QueueView } from "./queue/queueView";

/** Distância entre aviões na fila, px. */
const SLOT = 86;
/** Escala do desenho dos aviões. */
const PLANE_SCALE = 1.5;

const fmt = (value: number, digits = 1) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

interface Plane {
  root: Phaser.GameObjects.Container;
  team: QueueTeamView;
  /** Taxiando ou decolando: não reposicionar no layout. */
  moving: Phaser.Tweens.Tween | null;
}

export class QueueScene extends Phaser.Scene {
  private store!: GameStore;
  private sky!: Phaser.GameObjects.Graphics;
  private ground!: Phaser.GameObjects.Graphics;
  private sock!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private hiddenTag!: Phaser.GameObjects.Text;
  private idle!: Phaser.GameObjects.Text;
  private planes = new Map<string, Plane>();
  private lastBattery: number | null = null;
  private lastFlown = 0;
  private lineKey = "";
  private skyHour = -1;
  private wind = { direction: -1 as -1 | 1, strength: 0 };
  private flap = 0;
  /** Última velocidade aplicada; -1 força aplicar na primeira leitura. */
  private speed = -1;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super("queue");
  }

  init(data: { store: GameStore }) {
    this.store = data.store;
  }

  create() {
    this.sky = this.add.graphics().setDepth(0);
    this.ground = this.add.graphics().setDepth(2);
    this.sock = this.add.graphics().setDepth(5);
    const hud = (size: string, color: string, family: string = fonts.mono) =>
      this.add.text(0, 0, "", { fontFamily: family, fontSize: size, color }).setResolution(2).setDepth(100);
    this.title = hud("18px", palette.text, fonts.display).setFontStyle("600").setLetterSpacing(1);
    this.info = hud("11px", palette.textMuted);
    this.status = hud("12px", palette.text, fonts.body);
    this.hiddenTag = hud("11px", palette.textMuted).setOrigin(0, 0.5);
    this.idle = hud("22px", palette.textMuted, fonts.display).setOrigin(0.5).setFontStyle("600").setLetterSpacing(2);

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.unsubscribe = this.store.subscribe((state) => this.refresh(state));
    // game.destroy() (ao trocar de tela) emite DESTROY, não SHUTDOWN: limpar nos dois.
    const cleanup = () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.scale.off("resize", this.layout, this);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  // ------------------------------------------------------------------ geometria

  private get geo() {
    const { width, height } = this.scale;
    const horizon = Math.round(height * 0.56);
    const runway = Math.round(height * 0.8);
    const threshold = Math.round(width * 0.46);
    return { width, height, horizon, runway, threshold };
  }

  /** Quantos aviões cabem entre a borda esquerda e a cabeceira. */
  private get maxShown() {
    return Math.max(1, Math.floor((this.geo.threshold - 40) / SLOT) + 1);
  }

  private slotX(slot: number) {
    return this.geo.threshold - slot * SLOT;
  }

  private layout() {
    const { width, height } = this.geo;
    this.cameras.main.setSize(width, height);
    this.title.setPosition(20, 16);
    this.info.setPosition(20, 42);
    this.status.setPosition(20, 60);
    this.idle.setPosition(width / 2, height * 0.38);
    this.drawGround();
    this.skyHour = -1;
    this.lineKey = "";
    this.refresh(this.store.getState());
    // Ao montar e ao redimensionar, os aviões vão para o lugar sem taxiar.
    this.placePlanes(false);
  }

  // ------------------------------------------------------------------ estado

  private refresh(state: GameState) {
    this.applySpeed(state.clock.speed);
    const hour = hourOfDay(state.clock.hours);
    // Céu e sol mudam devagar: redesenhar a cada minuto de jogo basta.
    if (Math.abs(hour - this.skyHour) > 1 / 60) {
      this.skyHour = hour;
      this.drawSky(hour);
    }

    const competition = state.competition;
    if (!competition) {
      this.showIdle("A COMPETIÇÃO AINDA NÃO COMEÇOU");
      this.title.setText("COMPETIÇÃO AERODESIGN BRASIL · FILA DE DECOLAGEM");
      this.info.setText("");
      this.status.setText("");
      this.wind = windsock(0);
      if (this.lineKey !== "none") {
        this.lineKey = "none";
        this.planes.forEach((plane) => this.removePlane(plane));
        this.planes.clear();
        this.hiddenTag.setVisible(false);
        this.lastBattery = null;
      }
      return;
    }

    this.wind = windsock(competition.weather.headwindMs);
    const view = queueViewFromState(state, this.maxShown)!;
    this.title.setText(this.titleText(view));
    this.info.setText(this.weatherText(state));
    this.status.setText(this.statusText(view)).setColor(view.playerAhead !== null ? css(palette.highlight) : palette.text);

    if (view.phase === "inspection") this.showIdle("INSPEÇÃO DE SEGURANÇA");
    else if (view.phase === "finished") this.showIdle("COMPETIÇÃO ENCERRADA");
    else if (view.line.length === 0) this.showIdle(`BATERIA ${view.battery} CONCLUÍDA`);
    else this.idle.setVisible(false);

    const key = JSON.stringify([view.phase, view.battery, view.line.map((t) => t.teamId), view.hidden]);
    if (key === this.lineKey) return;
    this.lineKey = key;
    this.updateLine(view.phase === "flights" ? view : { ...view, line: [], hidden: 0 });
  }

  private showIdle(text: string) {
    this.idle.setText(text).setVisible(true);
  }

  private titleText(view: QueueView) {
    if (view.phase === "inspection") return "INSPEÇÃO DE SEGURANÇA · ANTES DA FILA";
    if (view.phase === "finished") return "COMPETIÇÃO ENCERRADA";
    return `BATERIA ${view.battery} · FILA DE DECOLAGEM`;
  }

  private weatherText(state: GameState) {
    const weather = state.competition!.weather;
    const hρ = currentDensityAltitude(state);
    const wind =
      Math.abs(weather.headwindMs) < 0.2
        ? "calmo"
        : `${fmt(Math.abs(weather.headwindMs))} m/s ${weather.headwindMs > 0 ? "de proa" : "de cauda"}`;
    return [
      formatTime(clockToDate(state.clock.hours)),
      `${fmt(weather.temperatureK - 273.15)} °C`,
      `${fmt(weather.pressureHpa, 0)} hPa`,
      hρ === null ? "" : `Hρ ${fmt(hρ, 0)} m`,
      `Vento ${wind}`
    ]
      .filter(Boolean)
      .join("   ·   ");
  }

  private statusText(view: QueueView) {
    if (view.phase !== "flights") return "";
    const flown = view.flown === 1 ? "1 equipe já voou" : `${view.flown} equipes já voaram`;
    if (view.playerAhead === null) return flown;
    if (view.playerAhead === 0) return `${flown}   ·   SUA VEZ: na cabeceira`;
    const ahead = view.playerAhead === 1 ? "1 equipe à sua frente" : `${view.playerAhead} equipes à sua frente`;
    return `${flown}   ·   ${ahead}`;
  }

  /** O tempo da cena acompanha o relógio do jogo: pausa junto e acelera junto. */
  private applySpeed(speed: number) {
    if (speed === this.speed) return;
    this.speed = speed;
    if (speed === 0) {
      this.tweens.pauseAll();
      return;
    }
    this.tweens.timeScale = speed;
    this.tweens.resumeAll();
  }

  // ------------------------------------------------------------------ fila

  private updateLine(view: QueueView) {
    const battery = view.battery;
    if (this.lastBattery !== battery) {
      // Bateria nova: a fila é outra.
      this.planes.forEach((plane) => this.removePlane(plane));
      this.planes.clear();
      this.lastBattery = battery;
      this.lastFlown = view.flown;
    }
    // Só decola quem saiu da cabeceira porque a fila andou (não por troca de fase).
    const advanced = view.phase === "flights" && view.flown > this.lastFlown;
    this.lastFlown = view.flown;
    const front = [...this.planes.values()].find((plane) => plane.root.getData("slot") === 0);
    const ids = new Set(view.line.map((t) => t.teamId));
    this.planes.forEach((plane, id) => {
      if (ids.has(id)) return;
      this.planes.delete(id);
      // Quem estava na cabeceira e saiu da fila foi voar.
      if (plane === front && advanced) this.takeOff(plane);
      else this.removePlane(plane);
    });
    view.line.forEach((team, slot) => {
      let plane = this.planes.get(team.teamId);
      if (!plane) {
        plane = this.createPlane(team, -SLOT);
        this.planes.set(team.teamId, plane);
      }
      plane.root.setData("slot", slot);
    });
    this.placePlanes(true);

    this.hiddenTag
      .setText(view.hidden > 0 ? `+${view.hidden}` : "")
      .setPosition(8, this.geo.runway - 34)
      .setVisible(view.hidden > 0);
  }

  /** Leva cada avião ao seu lugar na fila, taxiando ou de uma vez (resize). */
  private placePlanes(animate: boolean) {
    const y = this.geo.runway;
    this.planes.forEach((plane) => {
      const x = this.slotX(plane.root.getData("slot") as number);
      if (!animate) {
        plane.moving?.stop();
        plane.moving = null;
        plane.root.setPosition(x, y);
        return;
      }
      if (Math.abs(plane.root.x - x) < 1 && plane.root.y === y) return;
      plane.moving?.stop();
      plane.root.y = y;
      plane.moving = this.tweens.add({
        targets: plane.root,
        x,
        duration: 500 + Math.abs(plane.root.x - x) * 6,
        ease: "Sine.easeInOut",
        onComplete: () => (plane.moving = null)
      });
    });
  }

  private createPlane(team: QueueTeamView, x: number): Plane {
    const root = this.add.container(x, this.geo.runway).setDepth(20);
    const color = team.isPlayer ? palette.highlight : team.status === "next" ? palette.accent : palette.inkMuted;
    const g = this.add.graphics();
    drawPlane(g, team.isPlayer ? palette.highlight : palette.ink);
    g.setScale(PLANE_SCALE);
    const label = this.add
      .text(0, 12, team.label, {
        fontFamily: fonts.mono,
        fontSize: "11px",
        color: css(color),
        backgroundColor: team.isPlayer ? css(shade(palette.highlight, 0.75)) : undefined,
        padding: team.isPlayer ? { x: 4, y: 1 } : undefined
      })
      .setOrigin(0.5, 0)
      .setResolution(2);
    root.add([g, label]);
    if (team.isPlayer) {
      // Seta sobre o seu avião, pulando no ritmo do relógio.
      const arrow = this.add.graphics();
      arrow.fillStyle(palette.highlight, 1);
      arrow.fillTriangle(-7, -56, 7, -56, 0, -46);
      root.add(arrow);
      this.tweens.add({ targets: arrow, y: -5, duration: 450, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    return { root, team, moving: null };
  }

  private removePlane(plane: Plane) {
    plane.moving?.stop();
    this.tweens.killTweensOf(plane.root);
    plane.root.destroy();
  }

  /** Corrida até o fim da tela e subida para fora: só animação, o voo de verdade é a FlightScene. */
  private takeOff(plane: Plane) {
    plane.moving?.stop();
    const { width, runway } = this.geo;
    plane.root.setDepth(30);
    this.tweens.chain({
      targets: plane.root,
      tweens: [
        { x: width * 0.72, duration: 1400, ease: "Quad.easeIn" },
        { x: width + 80, y: runway - 160, rotation: -0.28, duration: 1300, ease: "Sine.easeIn" }
      ],
      onComplete: () => plane.root.destroy()
    });
  }

  // ------------------------------------------------------------------ cenário

  private drawSky(hour: number) {
    const { width, horizon } = this.geo;
    const g = this.sky;
    const day = Math.pow(Phaser.Math.Clamp(sunElevation(hour), 0, 1), 0.6);
    const mix = (a: number, b: number) => {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(a),
        Phaser.Display.Color.IntegerToColor(b),
        100,
        day * 100
      );
      return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    };
    g.clear();
    const top = mix(palette.bg, palette.panelRaised);
    const bottom = mix(palette.panelRaised, palette.borderStrong);
    g.fillGradientStyle(top, top, bottom, bottom, 1);
    g.fillRect(0, 0, width, horizon + 2);
    // Manhã e fim de tarde: brilho laranja baixo no horizonte.
    const glow = Phaser.Math.Clamp(1 - Math.abs(sunElevation(hour)) * 3, 0, 1);
    if (glow > 0) {
      g.fillStyle(palette.highlight, 0.12 * glow);
      g.fillRect(0, horizon - 60, width, 62);
      g.fillStyle(palette.highlight, 0.12 * glow);
      g.fillRect(0, horizon - 24, width, 26);
    }
    // Sol no arco do céu.
    const elevation = sunElevation(hour);
    if (elevation > -0.1) {
      const x = width * (0.06 + 0.88 * sunProgress(hour));
      const y = horizon - Math.max(0, elevation) * (horizon - 70) + 6;
      g.fillStyle(palette.warn, 0.08);
      g.fillCircle(x, y, 46);
      g.fillStyle(palette.warn, 0.16);
      g.fillCircle(x, y, 28);
      g.fillStyle(elevation < 0.25 ? palette.highlight : palette.warn, 1);
      g.fillCircle(x, y, 15);
    }
  }

  private drawGround() {
    const { width, height, horizon, runway, threshold } = this.geo;
    const g = this.ground;
    g.clear();
    // Morros ao longe.
    g.fillStyle(palette.bgGrid, 1);
    const hills: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(0, horizon)];
    for (let x = 0; x <= width; x += 40) hills.push(new Phaser.Math.Vector2(x, horizon - 14 - Math.sin(x / 130) * 10 - Math.sin(x / 47) * 4));
    hills.push(new Phaser.Math.Vector2(width, horizon));
    g.fillPoints(hills, true);
    // Campo.
    g.fillGradientStyle(palette.panel, palette.panel, palette.bg, palette.bg, 1);
    g.fillRect(0, horizon, width, height - horizon);
    // Tendas das equipes ao fundo.
    const tents = [0.08, 0.2, 0.33, 0.6, 0.74, 0.88];
    tents.forEach((fx, i) => {
      const x = width * fx;
      const y = horizon + 14 + (i % 2) * 6;
      const roof = [palette.highlight, palette.accent, palette.ok, palette.warn][i % 4]!;
      g.fillStyle(palette.panelRaised, 1);
      g.fillRect(x - 18, y - 10, 36, 12);
      g.fillStyle(shade(roof, 0.35), 1);
      g.fillTriangle(x - 22, y - 9, x + 22, y - 9, x, y - 22);
    });
    // Taxiway (fila) até a cabeceira e pista dali para a frente.
    g.fillStyle(palette.border, 1);
    g.fillRect(0, runway + 2, threshold, 10);
    g.fillStyle(palette.bgGrid, 1);
    g.fillRect(threshold - 20, runway + 2, width - threshold + 20, 14);
    g.fillStyle(palette.ink, 0.85);
    for (let i = 0; i < 5; i += 1) g.fillRect(threshold - 14 + i * 4, runway + 4, 2, 10);
    g.fillStyle(palette.ink, 0.5);
    for (let x = threshold + 30; x < width; x += 46) g.fillRect(x, runway + 8, 22, 2);
    // Faixa amarela da taxiway.
    g.fillStyle(palette.warn, 0.7);
    for (let x = 6; x < threshold - 24; x += 18) g.fillRect(x, runway + 6, 10, 2);
  }

  update(_time: number, deltaMs: number) {
    // A biruta balança com o relógio do jogo (parada quando pausado).
    this.flap += (deltaMs / 1000) * Math.max(0, this.speed);
    this.drawWindsock();
  }

  private drawWindsock() {
    const { runway, threshold } = this.geo;
    const g = this.sock;
    g.clear();
    const x = threshold + 36;
    const base = runway - 6;
    const top = base - 70;
    g.fillStyle(palette.inkMuted, 1);
    g.fillRect(x - 1.5, top, 3, base - top);
    const { direction, strength } = this.wind;
    const droop = (1 - strength) * 30;
    const k = Math.max(0.15, strength);
    for (let i = 0; i < 5; i += 1) {
      const flap = Math.sin(this.flap * 8 + i) * 2 * k;
      const x0 = x + direction * i * 11 * (0.4 + 0.6 * k);
      const y0 = top + 2 + (droop * i) / 5 + flap;
      const x1 = x0 + direction * 11 * (0.4 + 0.6 * k);
      const h = 12 - i * 1.3;
      g.fillStyle(i % 2 === 0 ? palette.highlight : palette.ink, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(x0, y0),
          new Phaser.Math.Vector2(x1, y0 + droop / 5 + flap * 0.5),
          new Phaser.Math.Vector2(x1, y0 + droop / 5 + h - 1.2 + flap * 0.5),
          new Phaser.Math.Vector2(x0, y0 + h)
        ],
        true
      );
    }
  }
}

/** Silhueta de lado de um avião cargueiro, nariz para a direita, rodas em y = 0. */
function drawPlane(g: Phaser.GameObjects.Graphics, color: number) {
  const dark = shade(color, 0.35);
  g.fillStyle(palette.bg, 0.4);
  g.fillEllipse(0, 1, 40, 5);
  // Trem.
  g.lineStyle(2, palette.inkMuted, 1);
  g.lineBetween(6, -8, 8, -3);
  g.lineBetween(-12, -9, -13, -3);
  g.fillStyle(palette.bg, 1);
  g.fillCircle(8, -2.5, 2.8);
  g.fillCircle(-13, -2.5, 2.2);
  // Fuselagem, empenagem e asa.
  g.fillStyle(color, 1);
  g.fillRoundedRect(-16, -15, 32, 7, 3);
  g.fillTriangle(-18, -15, -12, -15, -18, -25);
  g.fillStyle(dark, 1);
  g.fillRect(-6, -17, 14, 3);
  // Hélice.
  g.fillStyle(palette.inkMuted, 1);
  g.fillRect(16, -19, 2, 15);
}
