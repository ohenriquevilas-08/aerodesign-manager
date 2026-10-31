// Cena do voo da competição (design §9.3, §9.4 e §11), vista lateral no espírito de Into Space.
// Recebe um FlightPlayback já resolvido pela simulação (via flightReplay) e só anima:
// corrida, rotação, obstáculo de 0,9 m aos 55 m, circuito resumido, pouso, parada e retirada de carga.
// Nunca muda o estado do jogo. O replay tem velocidade própria, independente de clock.speed.

import Phaser from "phaser";
import type { GameStore } from "../app/store";
import { AircraftSprite } from "./flight/AircraftSprite";
import { ParticleField } from "./flight/particles";
import { FLIGHT_RULES, OUTCOME_LABEL, type FlightPlayback } from "./flight/playback";
import { flightReplay, type ReplayRequest } from "./flight/replayChannel";
import { buildFlightScript, playbackRate, type FlightEvent, type FlightPose, type FlightScript } from "./flight/script";
import { css, fonts, palette } from "./palette";

/** Pixels por metro no mundo. */
const S = 20;
const px = (m: number) => m * S;
const py = (h: number) => -h * S;

const fmt = (value: number, digits = 1) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const PHASE_LABEL: Record<FlightPose["phase"], string> = {
  ready: "Pronto para a corrida",
  roll: "Corrida de decolagem",
  abort: "Corrida abortada",
  climb: "Subida",
  circuit: "Circuito padrão",
  approach: "Aproximação",
  bounce: "Pouso",
  rollout: "Pouso",
  crash: "Perda de controle",
  wreck: "",
  unload: "Retirada rápida de carga"
};

interface Cloud {
  x: number;
  y: number;
  w: number;
  factor: number;
}

export class FlightScene extends Phaser.Scene {
  private bgLayer!: Phaser.GameObjects.Layer;
  private worldLayer!: Phaser.GameObjects.Layer;
  private hudLayer!: Phaser.GameObjects.Layer;
  private worldCam!: Phaser.Cameras.Scene2D.Camera;
  private hudCam!: Phaser.Cameras.Scene2D.Camera;

  private sky!: Phaser.GameObjects.Graphics;
  private backdrop!: Phaser.GameObjects.Graphics;
  private field!: Phaser.GameObjects.Graphics;
  private fieldLabels: Phaser.GameObjects.Text[] = [];
  private obstacle!: Phaser.GameObjects.Graphics;
  private windsock!: Phaser.GameObjects.Graphics;
  private unloadG!: Phaser.GameObjects.Graphics;
  private aircraft!: AircraftSprite;
  private particles!: ParticleField;
  private clouds: Cloud[] = [];
  private cloudDrift = 0;

  private hudInfo!: Phaser.GameObjects.Text;
  private hudTitle!: Phaser.GameObjects.Text;
  private hudPhase!: Phaser.GameObjects.Text;
  private hudReadout!: Phaser.GameObjects.Text;
  private hudCallout!: Phaser.GameObjects.Text;
  private hudTimer!: Phaser.GameObjects.Text;
  private hudTimerBar!: Phaser.GameObjects.Graphics;
  private hudMap!: Phaser.GameObjects.Graphics;
  private hudMapLabel!: Phaser.GameObjects.Text;
  private hudSpeed!: Phaser.GameObjects.Text;
  private hudIdle!: Phaser.GameObjects.Text;
  private vignette!: Phaser.GameObjects.Graphics;
  private stamp: Phaser.GameObjects.Container | null = null;
  private card: Phaser.GameObjects.Container | null = null;

  private script: FlightScript | null = null;
  private time0 = 0;
  private eventIndex = 0;
  private tension = 0;
  private tapeBroken = 0;
  private wrecked = false;
  private unloading = false;
  private calloutUntil = 0;
  private zoom = 1.5;
  private camX = 0;
  private camY = -100;
  private snapCamera = true;
  private elapsed = 0;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super("flight");
  }

  // O store chega como nas outras cenas; o voo não lê o relógio (replay tem velocidade própria).
  init(_data: { store: GameStore }) {}

  create() {
    this.bgLayer = this.add.layer();
    this.worldLayer = this.add.layer();
    this.hudLayer = this.add.layer();

    const main = this.cameras.main;
    this.worldCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.hudCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    main.ignore([this.worldLayer, this.hudLayer]);
    this.worldCam.ignore([this.bgLayer, this.hudLayer]);
    this.hudCam.ignore([this.bgLayer, this.worldLayer]);

    this.sky = this.add.graphics();
    this.backdrop = this.add.graphics();
    this.bgLayer.add([this.sky, this.backdrop]);
    this.clouds = Array.from({ length: 9 }, (_, i) => ({
      x: i * 190 + Math.random() * 120,
      y: 40 + Math.random() * 160,
      w: 60 + Math.random() * 90,
      factor: 0.15 + Math.random() * 0.35
    }));

    this.field = this.add.graphics().setDepth(0);
    this.obstacle = this.add.graphics().setDepth(10);
    this.windsock = this.add.graphics().setDepth(10);
    this.unloadG = this.add.graphics().setDepth(30);
    this.worldLayer.add([this.field, this.obstacle, this.windsock, this.unloadG]);
    this.aircraft = new AircraftSprite(this);
    this.aircraft.root.setDepth(40);
    this.worldLayer.add(this.aircraft.root);
    this.particles = new ParticleField(this, this.worldLayer);

    this.createHud();
    this.drawField(160);
    this.layout();
    this.scale.on("resize", this.layout, this);

    this.unsubscribe = flightReplay.subscribe(
      (request) => this.start(request),
      () => this.updateSpeedLabel()
    );
    // game.destroy() (ao trocar de tela) emite DESTROY, não SHUTDOWN: limpar nos dois.
    const cleanup = () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.scale.off("resize", this.layout, this);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    if (flightReplay.current) this.start(flightReplay.current);
    else this.showIdle();
    // Atalho de depuração: window.__flightScene.seek(t) no console.
    if (import.meta.env.DEV) (window as unknown as { __flightScene?: FlightScene }).__flightScene = this;
  }

  /** Pula o replay para o instante t (s), disparando os eventos no caminho. Para depuração. */
  seek(t: number) {
    if (!this.script || !flightReplay.current) return;
    if (t < this.time0) this.start(flightReplay.current);
    const script = this.script;
    const target = Phaser.Math.Clamp(t, 0, script.duration);
    this.time0 = target;
    while (this.eventIndex < script.events.length && script.events[this.eventIndex]!.t <= target) {
      this.handleEvent(script.events[this.eventIndex]!, script.playback);
      this.eventIndex += 1;
    }
    this.snapCamera = true;
  }

  /** Instante do primeiro evento do tipo pedido, para depuração. */
  eventTime(type: FlightEvent["type"]): number | null {
    return this.script?.events.find((event) => event.type === type)?.t ?? null;
  }

  // ------------------------------------------------------------------ replay

  private start(request: ReplayRequest) {
    const script = buildFlightScript(request.playback);
    this.script = script;
    this.time0 = 0;
    this.eventIndex = 0;
    this.tension = 0;
    this.tapeBroken = 0;
    this.wrecked = false;
    this.unloading = false;
    this.calloutUntil = 0;
    this.snapCamera = true;
    this.particles.clear();
    this.aircraft.reset();
    this.aircraft.setPayload(request.playback.payloadKg);
    this.stamp?.destroy();
    this.stamp = null;
    this.card?.destroy();
    this.card = null;
    this.unloadG.clear();
    this.hudIdle.setVisible(false);
    this.hudPhase.setText("");
    this.hudCallout.setVisible(false);
    this.hudTimer.setVisible(false);
    this.hudTimerBar.clear();
    this.drawField(script.runwayEndM);
    this.hudTitle.setText(`Bateria ${request.playback.battery} · ${request.playback.teamName}`.toUpperCase());
    this.hudInfo.setText(this.conditionsText(request.playback));
    this.worldCam.resetFX();
    this.worldCam.fadeIn(250, 8, 18, 28);
  }

  private showIdle() {
    this.hudIdle.setVisible(true);
    this.hudTitle.setText("COMPETIÇÃO AERODESIGN BRASIL · CLASSE REGULAR");
    this.hudInfo.setText("Pista com obstáculo de 0,9 m a 55 m da largada");
    this.hudPhase.setText("");
    this.hudReadout.setText("");
    this.aircraft.root.setPosition(0, 0).setRotation(0);
  }

  private conditionsText(p: FlightPlayback) {
    const wind =
      Math.abs(p.headwindMs) < 0.2
        ? "calmo"
        : `${fmt(Math.abs(p.headwindMs))} m/s ${p.headwindMs > 0 ? "de proa" : "de cauda"}`;
    return `Carga ${fmt(p.payloadKg)} kg   ·   Hρ ${fmt(p.densityAltitudeM, 0)} m   ·   Vento ${wind}`;
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.elapsed += dt;
    const script = this.script;
    let pose: FlightPose = { phase: "ready", x: 0, h: 0, pitchDeg: 0, onGround: true, progress: 0 };
    let rate = 1;

    if (script) {
      rate = flightReplay.speed * playbackRate(script.sample(this.time0));
      this.time0 = Math.min(script.duration, this.time0 + dt * rate);
      while (this.eventIndex < script.events.length && script.events[this.eventIndex]!.t <= this.time0) {
        this.handleEvent(script.events[this.eventIndex]!, script.playback);
        this.eventIndex += 1;
      }
      pose = script.sample(this.time0);
    }

    const simDt = dt * rate;
    this.placeAircraft(pose, simDt);
    this.emitAmbient(pose, simDt);
    this.particles.update(simDt);
    this.cloudDrift -= (script?.playback.headwindMs ?? 1) * simDt * 6;
    this.drawObstacle();
    this.drawWindsock(script?.playback.headwindMs ?? 1);
    if (script && pose.phase === "unload") this.drawUnload(pose, script.playback);
    this.updateCamera(pose, dt);
    this.drawBackdrop();
    this.updateHud(pose, script);
  }

  private handleEvent(event: FlightEvent, p: FlightPlayback) {
    const ex = px(event.x);
    const ey = py(event.h);
    switch (event.type) {
      case "rotate":
        this.callout(`ROTAÇÃO · ${fmt(event.x)} m`, palette.accent);
        this.particles.emit("dust", ex, -2, 10, { vx: -60, speed: 30 });
        break;
      case "obstacle-clear":
        this.callout(`PASSOU · FOLGA +${fmt(p.obstacleClearanceM ?? 0, 2)} m`, palette.ok);
        break;
      case "tape-break":
        this.tapeBroken = this.elapsed;
        this.particles.emit("tape", px(FLIGHT_RULES.obstacleDistanceM), py(FLIGHT_RULES.obstacleHeightM), 26, {
          vx: 140,
          vy: -40,
          speed: 120
        });
        this.worldCam.shake(220, 0.006);
        this.showStamp("Rompeu a fita", palette.danger, "Voo inválido");
        break;
      case "abort":
        this.callout("NÃO SAIU DO CHÃO", palette.danger);
        this.particles.emit("dust", ex, -2, 24, { vx: 40, speed: 50 });
        break;
      case "circuit-start":
        this.callout("CIRCUITO PADRÃO", palette.accent);
        break;
      case "approach-start":
        this.snapCamera = true;
        this.worldCam.fadeIn(350, 8, 18, 28);
        break;
      case "touchdown":
        this.particles.emit("dust", ex, -2, 18, { vx: 80, speed: 50 });
        if (p.outcome === "damage") {
          this.particles.emit("spark", ex, -2, 18, { vx: 120, vy: -80, speed: 120 });
          this.worldCam.shake(200, 0.008);
        }
        break;
      case "bounce":
        this.aircraft.dropNoseGear();
        this.particles.emit("spark", ex + 15, -2, 26, { vx: 160, vy: -120, speed: 140 });
        this.particles.emit("debris", ex + 15, -4, 4, { vx: 120, vy: -200, speed: 80 });
        this.worldCam.shake(260, 0.01);
        this.callout("TREM DO NARIZ CEDEU", palette.warn);
        break;
      case "runway-exit":
        this.callout("SAIU DA PISTA", palette.warn);
        break;
      case "stop":
        this.onStop(event, p);
        break;
      case "crash-impact":
        this.wrecked = true;
        this.aircraft.breakWing();
        this.particles.emit("debris", ex, -4, 22, { vx: 120, vy: -260, speed: 160 });
        this.particles.emit("dust", ex, -2, 30, { speed: 90 });
        this.particles.emit("spark", ex, -2, 20, { vy: -120, speed: 160 });
        this.worldCam.shake(450, 0.018);
        this.showStamp("Queda", palette.danger, (p.damagedParts ?? []).join(" · ") || "Peças danificadas");
        break;
      case "unload-start":
        this.unloading = true;
        if (this.stamp) this.tweens.add({ targets: this.stamp, alpha: 0, duration: 200 });
        this.hudTimer.setVisible(true);
        this.callout("VALENDO! ATÉ 2 PESSOAS NO QUADRADO", palette.highlight);
        break;
      case "unload-end": {
        const t = p.unloadTimeS ?? 0;
        this.aircraft.setCargoVisible(false);
        this.callout(`RETIRADA EM ${fmt(t)} s`, unloadColor(t));
        break;
      }
      case "end":
        this.showCard(p);
        break;
      default:
        break;
    }
  }

  private onStop(event: FlightEvent, p: FlightPlayback) {
    const stop = p.stopDistanceM ?? 0;
    switch (p.outcome) {
      case "valid":
        this.showStamp("Voo válido", palette.ok, `Parou dentro da pista · ${fmt(stop)} m`);
        break;
      case "landing-out":
        this.showStamp("Pouso fora da pista", palette.warn, "Voo válido, sem bônus de pouso");
        break;
      case "damage":
        this.showStamp("Pouso com dano", palette.warn, (p.damagedParts ?? []).join(" · ") || "Peças danificadas");
        break;
      case "no-takeoff":
        this.showStamp("Não decolou", palette.danger, "Não saiu do chão antes do obstáculo · voo inválido");
        this.particles.emit("dust", px(event.x), -2, 10, { speed: 30 });
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------------ mundo

  private placeAircraft(pose: FlightPose, dt: number) {
    const root = this.aircraft.root;
    root.setPosition(px(pose.x), py(pose.h));
    root.setRotation((-pose.pitchDeg * Math.PI) / 180);
    const powered = ["roll", "climb", "circuit", "approach"].includes(pose.phase);
    const throttle = this.wrecked ? 0 : powered ? 1 : pose.phase === "rollout" || pose.phase === "bounce" ? 0.3 : pose.phase === "ready" ? 0.25 : 0;
    this.aircraft.update(dt, throttle);
  }

  private emitAmbient(pose: FlightPose, dt: number) {
    if (dt <= 0) return;
    const x = px(pose.x);
    const moving = pose.phase === "roll" || pose.phase === "rollout" || pose.phase === "abort";
    if (moving && pose.onGround && Math.random() < 0.7) {
      const offRunway = this.script && pose.x > this.script.runwayEndM;
      this.particles.emit("dust", x - 4, -2, offRunway ? 3 : 1, { vx: -50, vy: -10, speed: 20 });
    }
    if (!pose.onGround && (pose.phase === "climb" || pose.phase === "circuit" || pose.phase === "approach") && Math.random() < 0.5) {
      this.particles.emit("trail", x - 30, py(pose.h) - 15, 1, { speed: 4 });
    }
    if (this.wrecked && Math.random() < 0.35) {
      this.particles.emit("smoke", x + Phaser.Math.Between(-10, 10), -8, 1, { vy: -20, vx: -8, speed: 10 });
    }
  }

  private drawField(runwayEndM: number) {
    const g = this.field;
    g.clear();
    this.fieldLabels.forEach((label) => label.destroy());
    this.fieldLabels = [];

    // Solo e gramado.
    g.fillStyle(palette.floor, 1);
    g.fillRect(px(-250), 0, px(1100), px(40));
    g.lineStyle(1, palette.border, 1);
    g.lineBetween(px(-250), 0, px(850), 0);
    g.lineStyle(1, palette.inkDim, 0.45);
    for (let m = -250; m < 850; m += 1.7) {
      if (m > -12 && m < runwayEndM) continue;
      const x = px(m) + ((m * 37) % 7);
      g.lineBetween(x, 0, x - 2, -4 - ((m * 13) % 3));
    }

    // Pista: faixa clara com eixo tracejado.
    g.fillStyle(palette.panelRaised, 1);
    g.fillRect(px(-12), 0, px(runwayEndM + 12), 7);
    g.fillStyle(palette.inkDim, 0.7);
    for (let m = -10; m < runwayEndM - 2; m += 4) g.fillRect(px(m), 2.5, px(2), 2);

    // Marcas a cada 5 m; 40 a 55 m com cones e rótulo (zona da decisão).
    for (let m = 0; m <= FLIGHT_RULES.obstacleDistanceM; m += 5) {
      const major = (FLIGHT_RULES.runwayMarksM as readonly number[]).includes(m);
      g.fillStyle(major ? palette.ink : palette.inkDim, 1);
      g.fillRect(px(m) - 1, 0, 2, major ? 11 : 7);
      if (major && m !== FLIGHT_RULES.obstacleDistanceM) {
        g.fillStyle(palette.highlight, 1);
        g.fillTriangle(px(m) - 4, 0, px(m) + 4, 0, px(m), -9);
      }
      if (major || m === 0) this.fieldLabel(px(m), 14, m === 0 ? "LARGADA" : `${m} m`, major ? palette.text : palette.textMuted);
    }
    g.fillStyle(palette.accent, 1);
    g.fillRect(px(0) - 1.5, -2, 3, 13);
    this.fieldLabel(px(FLIGHT_RULES.obstacleDistanceM) + 22, py(FLIGHT_RULES.obstacleHeightM) - 22, "0,9 m", palette.textMuted);

    // Fim da área de pouso.
    const end = px(runwayEndM);
    g.fillStyle(palette.inkMuted, 1);
    g.fillRect(end - 1, -34, 2, 34);
    for (let i = 0; i < 4; i += 1) {
      g.fillStyle(i % 2 === 0 ? palette.danger : palette.ink, 1);
      g.fillRect(end + 1, -34 + i * 4, 14, 4);
    }
    this.fieldLabel(end, 14, "FIM DA PISTA", palette.textMuted);
  }

  private fieldLabel(x: number, y: number, text: string, color: string) {
    if (!text) return;
    const label = this.add
      .text(x, y, text, { fontFamily: fonts.display, fontSize: "12px", fontStyle: "600", color })
      .setOrigin(0.5, 0)
      .setResolution(3)
      .setDepth(5);
    this.worldLayer.add(label);
    this.fieldLabels.push(label);
  }

  /** Obstáculo de 0,9 m aos 55 m: dois postes em perspectiva e a fita entre eles. */
  private drawObstacle() {
    const g = this.obstacle;
    g.clear();
    const x = px(FLIGHT_RULES.obstacleDistanceM);
    const top = py(FLIGHT_RULES.obstacleHeightM);
    const back = { dx: 10, dy: -5 };

    g.fillStyle(palette.inkMuted, 1);
    g.fillRect(x + back.dx - 1, back.dy + top, 2, -top - back.dy);
    g.fillRect(x - 1.5, top, 3, -top);
    g.lineStyle(1, palette.inkDim, 0.8);
    for (let y = top; y < 0; y += 3) g.lineBetween(x - 9, y, x - 5, y);
    const pulse = this.tension > 0.4 ? 0.6 + Math.sin(this.elapsed * 14) * 0.4 : 1;
    if (!this.tapeBroken) {
      // Fita listrada entre os postes.
      for (let i = 0; i < 4; i += 1) {
        g.lineStyle(3.5, i % 2 === 0 ? palette.highlight : palette.ink, pulse);
        g.lineBetween(x + (back.dx * i) / 4, top + (back.dy * i) / 4, x + (back.dx * (i + 1)) / 4, top + (back.dy * (i + 1)) / 4);
      }
    } else {
      // Pontas soltas balançando com o vento.
      const t = this.elapsed - this.tapeBroken;
      const sway = Math.sin(t * 9) * 3 * Math.exp(-t * 0.4) + 1;
      g.lineStyle(2, palette.highlight, 1);
      g.lineBetween(x, top, x + 4 + sway, top + 7);
      g.lineBetween(x + back.dx, top + back.dy, x + back.dx + 3 - sway, top + back.dy + 8);
    }
  }

  private drawWindsock(headwind: number) {
    const g = this.windsock;
    g.clear();
    const x = px(-7);
    const poleTop = py(3.2);
    g.fillStyle(palette.inkMuted, 1);
    g.fillRect(x - 1, poleTop, 2, -poleTop);
    // Vento de proa sopra contra a corrida (para -x).
    const dir = headwind >= 0 ? -1 : 1;
    const strength = Phaser.Math.Clamp(Math.abs(headwind) / 6, 0.1, 1);
    const droop = (1 - strength) * 14;
    for (let i = 0; i < 4; i += 1) {
      const flap = Math.sin(this.elapsed * 8 + i) * 1.2 * strength;
      const x0 = x + dir * i * 7;
      const y0 = poleTop + (droop * i) / 4 + flap;
      g.fillStyle(i % 2 === 0 ? palette.highlight : palette.ink, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(x0, y0),
          new Phaser.Math.Vector2(x0 + dir * 7, y0 + droop / 4 + flap),
          new Phaser.Math.Vector2(x0 + dir * 7, y0 + droop / 4 + 6 - i * 0.6 + flap),
          new Phaser.Math.Vector2(x0, y0 + 6.5 - i * 0.6)
        ],
        true
      );
    }
  }

  /** Retirada rápida: quadrado de 3×3 m, duas pessoas levando a carga para fora. */
  private drawUnload(pose: FlightPose, p: FlightPlayback) {
    const g = this.unloadG;
    g.clear();
    const cx = px(pose.x) + 4;
    const half = px(FLIGHT_RULES.unloadSquareM / 2);
    const depth = 8;
    g.fillStyle(palette.accent, 0.08);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(cx - half, 0),
        new Phaser.Math.Vector2(cx + half, 0),
        new Phaser.Math.Vector2(cx + half + depth, -depth),
        new Phaser.Math.Vector2(cx - half + depth, -depth)
      ],
      true
    );
    g.lineStyle(1.5, palette.accent, 0.9);
    g.strokePoints(
      [
        new Phaser.Math.Vector2(cx - half, 0),
        new Phaser.Math.Vector2(cx + half, 0),
        new Phaser.Math.Vector2(cx + half + depth, -depth),
        new Phaser.Math.Vector2(cx - half + depth, -depth)
      ],
      true
    );

    // Caixas de carga: entregues fora do quadrado à medida que o tempo passa.
    const boxes = Math.max(2, Math.min(6, Math.round(p.payloadKg)));
    const delivered = Math.min(boxes, Math.floor(pose.progress * boxes + 0.0001));
    this.aircraft.setCargoVisible(delivered < boxes);
    for (let i = 0; i < delivered; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const stack = Math.floor(i / 2);
      g.fillStyle(palette.highlight, 1);
      g.fillRect(cx + side * (half + 14) - 5, -6 - stack * 6, 10, 5);
    }

    // Cada pessoa vai do avião até a borda e volta; carrega caixa na ida para fora.
    const trips = boxes / 2;
    [-1, 1].forEach((side, index) => {
      const phase = (pose.progress * trips + index * 0.15) % 1;
      const out = phase < 0.5 ? phase * 2 : 2 - phase * 2;
      const carrying = phase < 0.5;
      const x = cx + side * (6 + out * (half + 4));
      const bob = Math.abs(Math.sin(this.elapsed * 14 + index)) * 1.5;
      const color = index === 0 ? palette.highlight : palette.warn;
      g.fillStyle(palette.bg, 0.4);
      g.fillEllipse(x, 0, 10, 3);
      g.fillStyle(color, 1);
      g.fillRoundedRect(x - 3.5, -24 - bob, 7, 15, 2.5);
      g.fillRect(x - 3, -10 - bob, 2.2, 10 + bob);
      g.fillRect(x + 0.8, -10 - bob, 2.2, 10 + bob);
      g.fillStyle(palette.ink, 1);
      g.fillCircle(x, -29 - bob, 3.6);
      if (carrying && pose.progress < 0.995) {
        g.fillStyle(palette.highlight, 1);
        g.fillRect(x + side * 3, -19 - bob, 8, 5);
      }
    });
  }

  private updateCamera(pose: FlightPose, dt: number) {
    const { height } = this.scale;
    const base = Phaser.Math.Clamp(height / 480, 0.7, 1.6);
    let target = 1.5;
    switch (pose.phase) {
      case "ready":
      case "roll":
      case "abort":
        target = 1.5 + Phaser.Math.Clamp((pose.x - 30) / 25, 0, 1) * 0.8;
        break;
      case "climb":
        target = Phaser.Math.Linear(2.3, 0.85, Phaser.Math.Clamp((pose.h - 1) / 12, 0, 1));
        break;
      case "circuit":
        target = 1.15;
        break;
      case "approach":
        target = Phaser.Math.Linear(1.6, 0.95, Phaser.Math.Clamp(pose.h / 10, 0, 1));
        break;
      case "bounce":
      case "rollout":
        target = 1.7;
        break;
      case "crash":
        target = 1.2;
        break;
      case "wreck":
        target = this.unloading ? 2.6 : 1.8;
        break;
      case "unload":
        target = 2.6;
        break;
    }
    target *= base;

    const lead = pose.onGround ? 70 : 110;
    const tx = px(pose.x) + lead / target;
    const groundCenter = -(0.25 * height) / target;
    const planeY = py(pose.h) - 15;
    const ty = Math.min(groundCenter, planeY + (0.06 * height) / target);

    if (this.snapCamera) {
      this.zoom = target;
      this.camX = tx;
      this.camY = ty;
      this.snapCamera = false;
    } else {
      const k = Math.min(1, dt * 3.2);
      this.zoom += (target - this.zoom) * k;
      this.camX += (tx - this.camX) * Math.min(1, dt * 7);
      this.camY += (ty - this.camY) * Math.min(1, dt * 5);
    }
    this.worldCam.setZoom(this.zoom);
    this.worldCam.centerOn(this.camX, this.camY);
  }

  /** Céu, horizonte e nuvens em paralaxe, na câmera de fundo (sem zoom). */
  private drawBackdrop() {
    const { width, height } = this.scale;
    const g = this.backdrop;
    g.clear();
    const horizon = height / 2 + (0 - this.camY) * this.zoom;

    this.clouds.forEach((cloud) => {
      const span = width + 300;
      const raw = cloud.x - this.camX * this.zoom * cloud.factor * 0.25 + this.cloudDrift * cloud.factor * 10;
      const x = ((raw % span) + span) % span - 150;
      const y = Math.min(horizon - 40, cloud.y + (this.camY * this.zoom * cloud.factor) * 0.15 + height * 0.05);
      g.fillStyle(palette.panelRaised, 0.55);
      g.fillEllipse(x, y, cloud.w, cloud.w * 0.28);
      g.fillEllipse(x + cloud.w * 0.22, y - cloud.w * 0.08, cloud.w * 0.55, cloud.w * 0.26);
    });

    // Morros distantes no horizonte.
    const hillShift = -this.camX * this.zoom * 0.05;
    g.fillStyle(palette.bgGrid, 1);
    for (let i = -1; i < 7; i += 1) {
      const span = width / 4;
      const x = ((((i * span + hillShift) % (span * 7)) + span * 7) % (span * 7)) - span;
      g.fillEllipse(x, horizon, span * 1.6, 70 + (i % 3) * 22);
    }
  }

  // ------------------------------------------------------------------ HUD

  private createHud() {
    const add = (obj: Phaser.GameObjects.GameObject) => {
      this.hudLayer.add(obj);
      return obj;
    };
    const style = (size: number, color: string = palette.text, family: string = fonts.display) => ({
      fontFamily: family,
      fontSize: `${size}px`,
      fontStyle: family === fonts.display ? "600" : "500",
      color
    });

    this.vignette = add(this.add.graphics()) as Phaser.GameObjects.Graphics;
    this.hudTitle = add(this.add.text(16, 12, "", { ...style(18), letterSpacing: 1 })) as Phaser.GameObjects.Text;
    this.hudInfo = add(this.add.text(16, 36, "", style(13, palette.textMuted, fonts.mono))) as Phaser.GameObjects.Text;
    this.hudPhase = add(this.add.text(0, 14, "", { ...style(22, css(palette.accent)), letterSpacing: 2 }).setOrigin(0.5, 0)) as Phaser.GameObjects.Text;
    this.hudReadout = add(this.add.text(16, 0, "", style(26, palette.text, fonts.mono)).setOrigin(0, 1)) as Phaser.GameObjects.Text;
    this.hudCallout = add(
      this.add.text(0, 0, "", { ...style(30), letterSpacing: 2, stroke: css(palette.bg), strokeThickness: 5 }).setOrigin(0.5)
    ) as Phaser.GameObjects.Text;
    this.hudTimer = add(this.add.text(0, 48, "", style(40, palette.text, fonts.mono)).setOrigin(0.5, 0)) as Phaser.GameObjects.Text;
    this.hudTimerBar = add(this.add.graphics()) as Phaser.GameObjects.Graphics;
    this.hudMap = add(this.add.graphics()) as Phaser.GameObjects.Graphics;
    this.hudMapLabel = add(this.add.text(0, 0, "CIRCUITO", style(12, palette.textMuted)).setOrigin(0.5, 0)) as Phaser.GameObjects.Text;
    this.hudSpeed = add(this.add.text(0, 0, "", style(13, palette.textMuted, fonts.mono)).setOrigin(1, 1)) as Phaser.GameObjects.Text;
    this.hudIdle = add(
      this.add.text(0, 0, "AGUARDANDO A BATERIA", { ...style(26, palette.textMuted), letterSpacing: 3 }).setOrigin(0.5)
    ) as Phaser.GameObjects.Text;
    this.hudCallout.setVisible(false);
    this.updateSpeedLabel();
  }

  private layout() {
    const { width, height } = this.scale;
    this.cameras.main.setSize(width, height);
    this.worldCam.setSize(width, height);
    this.hudCam.setSize(width, height);
    this.sky.clear();
    this.sky.fillGradientStyle(palette.bg, palette.bg, palette.panelRaised, palette.panelRaised, 1);
    this.sky.fillRect(0, 0, width, height);
    this.hudPhase.setPosition(width / 2, 14);
    this.hudTimer.setPosition(width / 2, 46);
    this.hudReadout.setPosition(16, height - 14);
    this.hudCallout.setPosition(width / 2, height * 0.2);
    this.hudSpeed.setPosition(width - 14, height - 12);
    this.hudIdle.setPosition(width / 2, height * 0.42);
    this.hudMapLabel.setPosition(width - 86, 12);
    if (this.stamp) this.stamp.setPosition(width / 2, height * 0.3);
    if (this.card) this.card.setPosition(width / 2, height / 2);
  }

  private updateSpeedLabel() {
    this.hudSpeed?.setText(`REPLAY ${String(flightReplay.speed).replace(".", ",")}×`);
  }

  private updateHud(pose: FlightPose, script: FlightScript | null) {
    const { width, height } = this.scale;
    if (!script) return;

    const label = pose.phase === "wreck" ? this.restingLabel(script.playback) : PHASE_LABEL[pose.phase];
    const nearObstacle = (pose.phase === "roll" || pose.phase === "climb") && pose.x > 38 && pose.x < FLIGHT_RULES.obstacleDistanceM;
    if (label) this.hudPhase.setText((nearObstacle ? "Obstáculo à frente" : label).toUpperCase());
    this.hudPhase.setColor(css(nearObstacle ? palette.highlight : palette.accent));

    if (pose.phase === "ready" || pose.phase === "roll" || pose.phase === "abort" || (pose.phase === "climb" && pose.x <= 60)) {
      this.hudReadout.setText(`${fmt(pose.x)} m   h ${fmt(pose.h, 2)} m`);
    } else if (pose.phase === "climb" || pose.phase === "circuit" || pose.phase === "approach" || pose.phase === "crash") {
      this.hudReadout.setText(`h ${fmt(pose.h)} m`);
    } else if (pose.phase === "rollout" || pose.phase === "bounce") {
      const touchdown = script.events.find((event) => event.type === "touchdown");
      this.hudReadout.setText(`parada ${fmt(Math.max(0, pose.x - (touchdown?.x ?? pose.x)))} m`);
    } else if (pose.phase === "unload" || (pose.phase === "wreck" && this.wrecked)) {
      this.hudReadout.setText("");
    }

    // Tensão: cresce na reta final até o obstáculo, some depois.
    const targetTension = nearObstacle || (pose.phase === "abort" && pose.x > 40) ? Phaser.Math.Clamp((pose.x - 30) / 25, 0, 1) : 0;
    this.tension += (targetTension - this.tension) * 0.08;
    this.vignette.clear();
    if (this.tension > 0.02) {
      const a = 0.5 * this.tension;
      const band = Math.min(width, height) * 0.22;
      this.vignette.fillGradientStyle(palette.bg, palette.bg, palette.bg, palette.bg, a, a, 0, 0);
      this.vignette.fillRect(0, 0, width, band);
      this.vignette.fillGradientStyle(palette.bg, palette.bg, palette.bg, palette.bg, 0, 0, a, a);
      this.vignette.fillRect(0, height - band, width, band);
      this.vignette.fillGradientStyle(palette.bg, palette.bg, palette.bg, palette.bg, a, 0, a, 0);
      this.vignette.fillRect(0, 0, band, height);
      this.vignette.fillGradientStyle(palette.bg, palette.bg, palette.bg, palette.bg, 0, a, 0, a);
      this.vignette.fillRect(width - band, 0, band, height);
    }

    if (this.calloutUntil && this.elapsed > this.calloutUntil) {
      this.hudCallout.setVisible(false);
      this.calloutUntil = 0;
    }

    this.drawMinimap(pose, script);

    if (this.unloading) {
      const t = pose.phase === "unload" ? pose.progress * (script.playback.unloadTimeS ?? 0) : (script.playback.unloadTimeS ?? 0);
      this.hudTimer.setText(`${fmt(t)} s`).setColor(css(unloadColor(t)));
      this.drawTimerBar(t, width);
    }
  }

  /** Rótulo da fase quando o avião está parado (depois da parada, da queda ou do corte). */
  private restingLabel(p: FlightPlayback): string {
    if (this.unloading) return PHASE_LABEL.unload;
    if (p.outcome === "crash") return "Queda";
    if (p.outcome === "no-takeoff") return PHASE_LABEL.abort;
    return this.eventIndex > 1 ? "Pouso" : PHASE_LABEL.ready;
  }

  private drawMinimap(pose: FlightPose, script: FlightScript) {
    const g = this.hudMap;
    g.clear();
    const show = pose.phase === "circuit" || pose.phase === "approach" || (pose.phase === "climb" && pose.x > 60) || pose.phase === "crash";
    this.hudMapLabel.setVisible(show);
    if (!show) return;
    const { width } = this.scale;
    const cx = width - 86;
    const cy = 64;
    const rx = 62;
    const ry = 26;
    g.fillStyle(palette.panel, 0.85);
    g.fillRoundedRect(cx - rx - 12, 8, rx * 2 + 24, ry * 2 + 50, 8);
    g.lineStyle(1, palette.border, 1);
    g.strokeRoundedRect(cx - rx - 12, 8, rx * 2 + 24, ry * 2 + 50, 8);
    g.lineStyle(1.5, palette.borderStrong, 1);
    g.strokeEllipse(cx, cy, rx * 2, ry * 2);
    // Pista na perna de baixo do circuito.
    g.fillStyle(palette.inkMuted, 1);
    g.fillRect(cx - 34, cy + ry - 2, 68, 4);

    // Progresso: subida = início da perna de baixo; circuito dá a volta; aproximação fecha.
    let u = 0;
    if (pose.phase === "climb") u = Phaser.Math.Clamp((pose.x - 55) / 90, 0, 1) * 0.12;
    else if (pose.phase === "circuit") u = 0.12 + pose.progress * 0.73;
    else if (pose.phase === "approach") u = 0.85 + pose.progress * 0.15;
    else if (pose.phase === "crash") u = script.playback.crashPhase === "approach" ? 0.92 : 0.12 + 0.55 * 0.73;
    // Ângulo: começa no meio da perna de baixo indo para a direita (sentido anti-horário na tela).
    const angle = Math.PI / 2 - u * Math.PI * 2;
    const dx = cx + Math.cos(angle) * rx;
    const dy = cy + Math.sin(angle) * ry;
    g.fillStyle(pose.phase === "crash" ? palette.danger : palette.highlight, 1);
    g.fillCircle(dx, dy, 4);
  }

  private drawTimerBar(t: number, width: number) {
    const g = this.hudTimerBar;
    g.clear();
    const w = 260;
    const x = width / 2 - w / 2;
    const y = 96;
    const max = 36;
    const scale = (s: number) => x + (Math.min(s, max) / max) * w;
    g.fillStyle(palette.panel, 0.9);
    g.fillRoundedRect(x - 6, y - 5, w + 12, 16, 6);
    g.fillStyle(palette.ok, 0.25);
    g.fillRect(x, y, scale(FLIGHT_RULES.unloadFullBonusS) - x, 6);
    g.fillStyle(palette.warn, 0.25);
    g.fillRect(scale(FLIGHT_RULES.unloadFullBonusS), y, scale(FLIGHT_RULES.unloadZeroBonusS) - scale(FLIGHT_RULES.unloadFullBonusS), 6);
    g.fillStyle(palette.danger, 0.25);
    g.fillRect(scale(FLIGHT_RULES.unloadZeroBonusS), y, x + w - scale(FLIGHT_RULES.unloadZeroBonusS), 6);
    g.fillStyle(unloadColor(t), 1);
    g.fillRect(x, y, scale(t) - x, 6);
    g.fillStyle(palette.ink, 1);
    g.fillRect(scale(FLIGHT_RULES.unloadFullBonusS) - 1, y - 3, 2, 12);
    g.fillRect(scale(FLIGHT_RULES.unloadZeroBonusS) - 1, y - 3, 2, 12);
  }

  private callout(text: string, color: number) {
    this.hudCallout.setText(text).setColor(css(color)).setVisible(true).setAlpha(0).setScale(0.85);
    this.tweens.add({ targets: this.hudCallout, alpha: 1, scale: 1, duration: 180, ease: "Back.easeOut" });
    this.calloutUntil = this.elapsed + 2.2 / Math.max(0.5, flightReplay.speed);
  }

  private showStamp(title: string, color: number, subtitle: string) {
    const { width, height } = this.scale;
    this.stamp?.destroy();
    this.hudCallout.setVisible(false);
    this.calloutUntil = 0;
    const titleText = this.add
      .text(0, -8, title.toUpperCase(), {
        fontFamily: fonts.display,
        fontSize: "44px",
        fontStyle: "700",
        color: css(color),
        letterSpacing: 3
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(0, 28, subtitle, { fontFamily: fonts.body, fontSize: "14px", color: palette.text, align: "center", wordWrap: { width: 420 } })
      .setOrigin(0.5, 0);
    const w = Math.max(titleText.width, sub.width) + 48;
    const h = 64 + sub.height;
    const box = this.add.graphics();
    box.fillStyle(palette.bg, 0.82);
    box.fillRoundedRect(-w / 2, -h / 2 - 8, w, h + 10, 10);
    box.lineStyle(3, color, 1);
    box.strokeRoundedRect(-w / 2, -h / 2 - 8, w, h + 10, 10);
    const stamp = this.add.container(width / 2, height * 0.3, [box, titleText, sub]);
    stamp.setRotation(-0.05).setScale(1.6).setAlpha(0);
    this.hudLayer.add(stamp);
    this.stamp = stamp;
    this.tweens.add({ targets: stamp, scale: 1, alpha: 1, duration: 260, ease: "Back.easeOut" });
    this.tweens.add({ targets: stamp, alpha: 0, delay: 2600, duration: 400 });
  }

  private showCard(p: FlightPlayback) {
    const { width, height } = this.scale;
    this.stamp?.destroy();
    this.stamp = null;
    this.hudCallout.setVisible(false);
    this.calloutUntil = 0;
    const color = outcomeColor(p);
    const rows: [string, string][] = [
      ["Carga", `${fmt(p.payloadKg)} kg`],
      ["Altitude densidade", `${fmt(p.densityAltitudeM, 0)} m`],
      ["Vento", Math.abs(p.headwindMs) < 0.2 ? "calmo" : `${fmt(Math.abs(p.headwindMs))} m/s ${p.headwindMs > 0 ? "de proa" : "de cauda"}`],
      ["Rotação", p.rotationDistanceM === null ? "não saiu do chão" : `${fmt(p.rotationDistanceM)} m`],
      [
        "Obstáculo (0,9 m)",
        p.obstacleClearanceM === null
          ? "não chegou"
          : p.obstacleClearanceM >= 0
            ? `passou, folga ${fmt(p.obstacleClearanceM, 2)} m`
            : `rompeu a fita (${fmt(p.obstacleClearanceM, 2)} m)`
      ],
      ["Parada", p.stopDistanceM === null ? "sem pouso" : `${fmt(p.stopDistanceM)} m${p.outcome === "landing-out" ? " (fora da pista)" : ""}`],
      ["Retirada de carga", p.unloadTimeS === null ? "não houve" : `${fmt(p.unloadTimeS)} s`]
    ];
    if (p.damagedParts?.length) rows.push(["Peças", p.damagedParts.join(", ")]);

    const w = 420;
    const rowH = 22;
    const h = 76 + rows.length * rowH + 14;
    const box = this.add.graphics();
    box.fillStyle(palette.panel, 0.95);
    box.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    box.lineStyle(1, palette.border, 1);
    box.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    box.fillStyle(color, 1);
    box.fillRect(-w / 2, -h / 2 + 10, 4, 44);
    const children: Phaser.GameObjects.GameObject[] = [box];
    children.push(
      this.add.text(-w / 2 + 20, -h / 2 + 12, `BATERIA ${p.battery}`, { fontFamily: fonts.display, fontSize: "13px", fontStyle: "600", color: palette.textMuted, letterSpacing: 2 }),
      this.add.text(-w / 2 + 20, -h / 2 + 28, OUTCOME_LABEL[p.outcome].toUpperCase(), {
        fontFamily: fonts.display,
        fontSize: "26px",
        fontStyle: "700",
        color: css(color),
        letterSpacing: 1
      })
    );
    rows.forEach(([key, value], i) => {
      const y = -h / 2 + 74 + i * rowH;
      children.push(
        this.add.text(-w / 2 + 20, y, key, { fontFamily: fonts.body, fontSize: "13px", color: palette.textMuted }),
        this.add.text(w / 2 - 20, y, value, { fontFamily: fonts.mono, fontSize: "13px", color: palette.text }).setOrigin(1, 0)
      );
    });
    const card = this.add.container(width / 2, height / 2, children).setAlpha(0);
    this.hudLayer.add(card);
    this.card = card;
    this.tweens.add({ targets: card, alpha: 1, y: { from: height / 2 + 16, to: height / 2 }, duration: 300, ease: "Sine.easeOut" });
  }
}

function unloadColor(t: number): number {
  if (t <= FLIGHT_RULES.unloadFullBonusS) return palette.ok;
  if (t < FLIGHT_RULES.unloadZeroBonusS) return palette.warn;
  return palette.danger;
}

function outcomeColor(p: FlightPlayback): number {
  switch (p.outcome) {
    case "valid":
      return palette.ok;
    case "landing-out":
    case "damage":
      return palette.warn;
    default:
      return palette.danger;
  }
}
