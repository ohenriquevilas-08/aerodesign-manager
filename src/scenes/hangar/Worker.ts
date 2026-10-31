// Integrante no hangar: bonequinho isométrico (pernas, tronco, braço, cabeça) com pose de trabalho.
// Origem do container = pés no piso. Tweens e timers seguem o relógio da cena.

import Phaser from "phaser";
import { css, fonts, palette, shade } from "../palette";

const SHIRTS = [palette.highlight, palette.accent, palette.ok, palette.warn, palette.danger];

export class Worker {
  readonly root: Phaser.GameObjects.Container;
  private readonly arm: Phaser.GameObjects.Rectangle;
  private readonly torso: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, name: string, index: number, x: number, y: number, facingLeft: boolean) {
    const shirt = SHIRTS[index % SHIRTS.length]!;
    this.root = scene.add.container(x, y);

    const shadow = scene.add.ellipse(0, 0, 18, 7, palette.bg, 0.5);
    const legs = scene.add.graphics();
    legs.fillStyle(palette.border, 1);
    legs.fillRoundedRect(-4.5, -11, 3.6, 11, 1.5);
    legs.fillRoundedRect(0.9, -11, 3.6, 11, 1.5);
    legs.fillStyle(palette.bg, 1);
    legs.fillRect(-5, -2, 4.5, 2);
    legs.fillRect(0.5, -2, 4.5, 2);

    this.torso = scene.add.container(0, 0);
    const body = scene.add.graphics();
    body.fillStyle(shirt, 1);
    body.fillRoundedRect(-6, -25, 12, 15, 4);
    body.fillStyle(shade(shirt, 0.3), 1);
    body.fillRect(-6, -13, 12, 3);
    const initial = scene.add
      .text(0, -18.5, name.slice(0, 1).toUpperCase(), { fontFamily: fonts.body, fontSize: "8px", fontStyle: "700", color: css(palette.bg) })
      .setOrigin(0.5)
      .setResolution(3);
    // Braço que trabalha, do lado da bancada.
    const side = facingLeft ? -1 : 1;
    this.arm = scene.add.rectangle(side * 5, -22, 3.2, 10, shade(shirt, 0.15)).setOrigin(0.5, 0);
    const head = scene.add.circle(0, -30, 5.5, palette.ink);
    const hair = scene.add.graphics();
    hair.fillStyle(palette.borderStrong, 1);
    hair.slice(0, -30, 5.7, Math.PI, 0, false);
    hair.fillPath();
    this.torso.add([body, initial, head, hair, this.arm]);

    this.root.add([shadow, legs, this.torso]);
    this.root.setDepth(y);

    // Pose de trabalho: braço indo e vindo e um leve balanço do tronco.
    this.arm.setRotation(side * -0.6);
    scene.tweens.add({
      targets: this.arm,
      rotation: side * -1.4,
      duration: Phaser.Math.Between(380, 560),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: index * 90
    });
    scene.tweens.add({
      targets: this.torso,
      y: -1.2,
      duration: Phaser.Math.Between(900, 1300),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }
}
