// Integrante no hangar: boneco isométrico desenhado a partir de people/avatar.ts (os mesmos polígonos
// que ui/components/Avatar.tsx desenha em SVG nas cartas). Origem do container = pés no piso.
// Tweens e timers seguem o relógio da cena.
// `place` leva a pessoa até o posto (bancada ou área livre) e liga ou desliga o trabalho.

import Phaser from "phaser";
import { palette } from "../palette";
import type { MemberLook } from "../phase5";
import { avatarShapes, type AvatarPose } from "../people/avatar";
import { drawAvatarShapes } from "../people/draw";

/** Escala do boneco no hangar (as peças do avatar têm ~46 px de altura). */
const SCALE = 0.85;

export class Worker {
  readonly root: Phaser.GameObjects.Container;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly scene: Phaser.Scene;
  private readonly swing = { phase: 0 };
  private readonly swingTween: Phaser.Tweens.Tween;
  private readonly bob: Phaser.Tweens.Tween;
  private readonly look: MemberLook;
  private pose: AvatarPose = "stand";
  private facing: 1 | -1;
  private move: Phaser.Tweens.Tween | null = null;
  private zzz: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, look: MemberLook, index: number, x: number, y: number, facingLeft: boolean) {
    this.scene = scene;
    this.look = look;
    this.facing = facingLeft ? -1 : 1;
    this.root = scene.add.container(x, y);
    this.gfx = scene.add.graphics().setScale(SCALE);
    this.root.add(this.gfx);
    this.root.setDepth(y);
    this.redraw();

    // Pose de trabalho: o braço vai e volta; o tweens só mexe na fase, o desenho sai do avatar.
    this.swingTween = scene.tweens.add({
      targets: this.swing,
      phase: 1,
      duration: Phaser.Math.Between(380, 560),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: index * 90,
      paused: true,
      onUpdate: () => this.redraw()
    });
    // Leve balanço do corpo.
    this.bob = scene.tweens.add({
      targets: this.gfx,
      y: -1,
      duration: Phaser.Math.Between(900, 1300),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  private redraw() {
    const g = this.gfx;
    g.clear();
    drawAvatarShapes(g, avatarShapes(this.look, this.pose, { facing: this.facing, phase: this.swing.phase }));
  }

  private setPose(pose: AvatarPose) {
    if (pose === this.pose) return;
    this.pose = pose;
    this.redraw();
  }

  /** Cochilando no canto (madrugada): tronco encostado, braço parado e "z" subindo. */
  setNapping(napping: boolean) {
    if (!napping) {
      if (this.zzz) this.scene.tweens.killTweensOf(this.zzz);
      this.zzz?.destroy();
      this.zzz = null;
      if (this.pose === "nap") this.setPose("stand");
      return;
    }
    this.swingTween.pause();
    this.setPose("nap");
    if (this.zzz) return;
    this.zzz = this.scene.add
      .text(8, -52, "z", { fontFamily: "JetBrains Mono", fontSize: "10px", color: palette.textMuted })
      .setResolution(2);
    this.root.add(this.zzz);
    this.scene.tweens.add({ targets: this.zzz, y: -66, x: 14, alpha: 0, duration: 1600, repeat: -1, ease: "Sine.easeOut" });
  }

  /** Vai até (x, y) no piso; trabalhando mexe o braço, parado fica com o braço junto ao corpo. */
  place(x: number, y: number, facingLeft: boolean, working: boolean) {
    this.facing = facingLeft ? -1 : 1;
    if (this.pose !== "nap") {
      if (working) {
        this.setPose("work");
        if (this.swingTween.isPaused()) this.swingTween.resume();
      } else {
        this.swingTween.pause();
        this.swing.phase = 0;
        this.setPose("stand");
      }
    }
    this.redraw();
    this.move?.stop();
    const distance = Phaser.Math.Distance.Between(this.root.x, this.root.y, x, y);
    if (distance < 1) return;
    // Andar a uns 60 px por segundo de cena (que segue o relógio do jogo).
    this.move = this.scene.tweens.add({
      targets: this.root,
      x,
      y,
      duration: Math.max(200, (distance / 60) * 1000),
      ease: "Sine.easeInOut",
      onUpdate: () => this.root.setDepth(this.root.y),
      onComplete: () => this.root.setDepth(y)
    });
  }

  destroy() {
    this.setNapping(false);
    this.move?.stop();
    this.swingTween.remove();
    this.bob.remove();
    this.root.destroy();
  }
}
