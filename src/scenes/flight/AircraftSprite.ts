// Avião da Classe Regular em vista lateral, só com formas geométricas.
// Origem do container = ponto de contato do trem principal com o chão; frente para +x.

import Phaser from "phaser";
import { palette } from "../palette";

const v = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

export class AircraftSprite {
  readonly root: Phaser.GameObjects.Container;
  private readonly prop: Phaser.GameObjects.Rectangle;
  private readonly propDisc: Phaser.GameObjects.Ellipse;
  private readonly noseGear: Phaser.GameObjects.Graphics;
  private readonly wing: Phaser.GameObjects.Graphics;
  private readonly cargo: Phaser.GameObjects.Rectangle;
  private spin = 0;

  constructor(scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0);

    const gear = scene.add.graphics();
    gear.lineStyle(1.5, palette.inkMuted, 1);
    gear.lineBetween(0, -3, -2, -10);
    gear.fillStyle(palette.bg, 1);
    gear.fillCircle(0, -3, 3);
    gear.lineStyle(1.5, palette.inkMuted, 1);
    gear.strokeCircle(0, -3, 3);

    this.noseGear = scene.add.graphics();
    this.noseGear.lineStyle(1.5, palette.inkMuted, 1);
    this.noseGear.lineBetween(15, -2.5, 15, -10);
    this.noseGear.fillStyle(palette.bg, 1);
    this.noseGear.fillCircle(15, -2.5, 2.5);
    this.noseGear.strokeCircle(15, -2.5, 2.5);

    const body = scene.add.graphics();
    // Cone de cauda.
    body.fillStyle(palette.borderStrong, 1);
    body.fillRect(-26, -15.5, 24, 2.5);
    // Empenagem: estabilizador horizontal e deriva.
    body.fillStyle(palette.accent, 1);
    body.fillPoints([v(-31, -15.5), v(-22, -15.5), v(-23, -13.5), v(-31, -13.5)], true);
    body.fillPoints([v(-29, -15.5), v(-24, -15.5), v(-28, -25), v(-31, -25)], true);
    // Fuselagem (casulo da carga).
    body.fillStyle(palette.accent, 1);
    body.fillPoints([v(19, -10), v(21, -13.5), v(17, -17.5), v(-3, -18), v(-6, -12), v(9, -9)], true);
    body.lineStyle(1, palette.ink, 0.6);
    body.strokePoints([v(19, -10), v(21, -13.5), v(17, -17.5), v(-3, -18), v(-6, -12), v(9, -9)], true);

    this.cargo = scene.add.rectangle(4, -13.5, 9, 5, palette.highlight).setOrigin(0.5);

    // Asa alta: perfil visto de lado.
    this.wing = scene.add.graphics();
    this.wing.fillStyle(palette.ink, 1);
    this.wing.fillPoints([v(10, -18.5), v(6, -21.5), v(-2, -22), v(-9, -19.5), v(-9, -18.5)], true);

    this.propDisc = scene.add.ellipse(22, -13.5, 3, 15, palette.ink, 0.18);
    this.prop = scene.add.rectangle(22, -13.5, 1.6, 14, palette.ink).setOrigin(0.5);

    this.root.add([gear, this.noseGear, body, this.cargo, this.wing, this.propDisc, this.prop]);
  }

  /** Mostra a carga proporcional aos kg embarcados (só leitura visual). */
  setPayload(kg: number) {
    const w = Phaser.Math.Clamp(4 + kg * 0.9, 4, 13);
    this.cargo.setSize(w, 5).setVisible(kg > 0);
  }

  setCargoVisible(visible: boolean) {
    this.cargo.setVisible(visible);
  }

  reset() {
    this.noseGear.setVisible(true);
    this.wing.setVisible(true);
    this.wing.setPosition(0, 0).setRotation(0);
    this.cargo.setVisible(true);
    this.root.setAlpha(1);
  }

  dropNoseGear() {
    this.noseGear.setVisible(false);
  }

  breakWing() {
    this.wing.setPosition(-3, 3).setRotation(0.35);
  }

  /** throttle 0–1: velocidade aparente da hélice. */
  update(dt: number, throttle: number) {
    this.spin += dt * (6 + throttle * 60);
    const blur = throttle > 0.2;
    this.prop.setScale(1, blur ? Math.abs(Math.sin(this.spin)) * 0.8 + 0.2 : Math.cos(this.spin * 0.2) * 0.5 + 0.5);
    this.propDisc.setVisible(blur);
  }
}
