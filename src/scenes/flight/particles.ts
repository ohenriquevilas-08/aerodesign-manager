// Partículas leves desenhadas num único Graphics por quadro (poeira, faíscas, fita, fumaça, destroços).
// Sem texturas: tudo são círculos e retângulos da paleta.

import Phaser from "phaser";
import { palette } from "../palette";

export type ParticleKind = "dust" | "spark" | "tape" | "smoke" | "debris" | "trail";

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  spin: number;
  angle: number;
}

const GRAVITY: Record<ParticleKind, number> = { dust: -8, spark: 420, tape: 60, smoke: -30, debris: 520, trail: 0 };
const DRAG: Record<ParticleKind, number> = { dust: 2.4, spark: 0.6, tape: 1.8, smoke: 0.9, debris: 0.4, trail: 0 };
const MAX_PARTICLES = 420;

export class ParticleField {
  private readonly items: Particle[] = [];
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    this.g = scene.add.graphics();
    this.g.setDepth(50);
    layer.add(this.g);
  }

  clear() {
    this.items.length = 0;
    this.g.clear();
  }

  /** x, y em pixels do mundo; velocidades em px/s. */
  emit(kind: ParticleKind, x: number, y: number, count: number, spread: { vx?: number; vy?: number; speed?: number } = {}) {
    for (let i = 0; i < count; i += 1) {
      if (this.items.length >= MAX_PARTICLES) this.items.shift();
      const speed = spread.speed ?? 60;
      const angle = Math.random() * Math.PI * 2;
      const life = kind === "smoke" ? 1.6 + Math.random() * 1.4 : kind === "trail" ? 0.5 : 0.5 + Math.random() * 0.7;
      this.items.push({
        kind,
        x,
        y,
        vx: (spread.vx ?? 0) + Math.cos(angle) * speed * Math.random(),
        vy: (spread.vy ?? 0) + Math.sin(angle) * speed * Math.random(),
        life,
        maxLife: life,
        size: sizeOf(kind),
        color: colorOf(kind),
        spin: (Math.random() - 0.5) * 12,
        angle: Math.random() * Math.PI
      });
    }
  }

  update(dt: number) {
    const g = this.g;
    g.clear();
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const p = this.items[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      const drag = Math.max(0, 1 - DRAG[p.kind] * dt);
      p.vx *= drag;
      p.vy = p.vy * drag + GRAVITY[p.kind] * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      // Chão em y = 0: destroços e faíscas quicam e perdem energia.
      if (p.y > 0 && (p.kind === "debris" || p.kind === "spark")) {
        p.y = 0;
        p.vy *= -0.35;
        p.vx *= 0.6;
        p.spin *= 0.5;
      }
      const t = p.life / p.maxLife;
      const grow = p.kind === "dust" || p.kind === "smoke" ? 1 + (1 - t) * 2.2 : 1;
      g.fillStyle(p.color, alphaOf(p.kind) * t);
      if (p.kind === "debris" || p.kind === "tape") {
        const w = p.size * 1.8;
        const h = p.size * 0.7;
        const c = Math.cos(p.angle);
        const s = Math.sin(p.angle);
        g.fillPoints(
          [
            new Phaser.Math.Vector2(p.x + (-w * c + h * s) / 2, p.y + (-w * s - h * c) / 2),
            new Phaser.Math.Vector2(p.x + (w * c + h * s) / 2, p.y + (w * s - h * c) / 2),
            new Phaser.Math.Vector2(p.x + (w * c - h * s) / 2, p.y + (w * s + h * c) / 2),
            new Phaser.Math.Vector2(p.x + (-w * c - h * s) / 2, p.y + (-w * s + h * c) / 2)
          ],
          true
        );
      } else {
        g.fillCircle(p.x, p.y, p.size * grow);
      }
    }
  }
}

function sizeOf(kind: ParticleKind): number {
  switch (kind) {
    case "dust":
      return 2 + Math.random() * 2;
    case "spark":
      return 1 + Math.random();
    case "tape":
      return 3 + Math.random() * 2;
    case "smoke":
      return 4 + Math.random() * 4;
    case "debris":
      return 2.5 + Math.random() * 3;
    case "trail":
      return 1.2;
  }
}

function colorOf(kind: ParticleKind): number {
  switch (kind) {
    case "dust":
      return palette.inkMuted;
    case "spark":
      return Math.random() < 0.5 ? palette.warn : palette.highlight;
    case "tape":
      return Math.random() < 0.5 ? palette.highlight : palette.ink;
    case "smoke":
      return Math.random() < 0.5 ? palette.inkDim : palette.border;
    case "debris":
      return [palette.accent, palette.ink, palette.panelRaised][Math.floor(Math.random() * 3)]!;
    case "trail":
      return palette.accent;
  }
}

function alphaOf(kind: ParticleKind): number {
  switch (kind) {
    case "dust":
      return 0.35;
    case "smoke":
      return 0.5;
    case "trail":
      return 0.35;
    default:
      return 1;
  }
}
