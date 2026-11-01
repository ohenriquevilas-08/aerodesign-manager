// Boneco isométrico 2.5D (estilo Habbo) do integrante. Geometria pura: MemberLook + pose entram,
// polígonos coloridos saem, de trás para frente. O hangar (hangar/Worker.ts) desenha esses polígonos
// no Phaser e ui/components/Avatar.tsx os mesmos em SVG, então carta e hangar mostram o mesmo boneco.
// Coordenadas: origem nos pés, y para baixo (altura = −y), unidades em pixels da cena.
// Mundo do boneco: x para a frente (rosto), y lateral, z altura; projeção isométrica 2:1.

import { palette, shade } from "../palette";
import type { MemberLook } from "../../sim";

const DEFAULT_LOOK: MemberLook = { skin: 1, hair: 0, hairColor: 0, shirt: 0xff9f2e };

export type AvatarPose = "stand" | "work" | "nap";
export type Point = [number, number];

export interface AvatarShape {
  points: Point[];
  fill: number;
  /** Só o traço, sem preencher (óculos, olhos fechados). */
  line?: boolean;
}

export interface AvatarOptions {
  /** 1 = olhando para a direita, −1 = espelhado. */
  facing?: 1 | -1;
  /** Fase do gesto de trabalho, 0 a 1 (só na pose `work`). */
  phase?: number;
}

/** Retângulo que contém qualquer pose (para o viewBox do SVG e a centralização). */
export const AVATAR_BOUNDS = { minX: -22, maxX: 22, minY: -58, maxY: 8 } as const;

type V3 = [number, number, number];

const KX = 0.87;
const project = ([x, y, z]: V3, facing: number): Point => [(x - y) * KX * facing, (x + y) * 0.5 - z];

/** Gira em torno de um pivô no plano x–z (θ > 0 inclina para a frente). */
function rotate(p: V3, pivot: V3, theta: number): V3 {
  if (theta === 0) return p;
  const dx = p[0] - pivot[0];
  const dz = p[2] - pivot[2];
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [pivot[0] + dx * c + dz * s, p[1], pivot[2] - dx * s + dz * c];
}

interface Rig {
  facing: number;
  /** Giros aplicados em ordem a cada vértice (do mais interno para o mais externo). */
  turns: { pivot: V3; theta: number }[];
}

const place = (rig: Rig, p: V3): V3 => rig.turns.reduce((acc, turn) => rotate(acc, turn.pivot, turn.theta), p);

/** Caixa min..max com as três faces visíveis (frente = x máx., lado = y máx., topo). */
function box(out: AvatarShape[], rig: Rig, min: V3, max: V3, color: number) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const P = (x: number, y: number, z: number) => project(place(rig, [x, y, z]), rig.facing);
  out.push({ points: [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], fill: shade(color, 0.3) });
  out.push({ points: [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], fill: shade(color, 0.12) });
  out.push({ points: [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], fill: color });
}

/** Retângulo sobre a face da frente (plano x fixo), em y e z. */
function onFront(out: AvatarShape[], rig: Rig, x: number, y0: number, y1: number, z0: number, z1: number, color: number, line = false) {
  const P = (y: number, z: number) => project(place(rig, [x, y, z]), rig.facing);
  out.push({ points: [P(y0, z0), P(y1, z0), P(y1, z1), P(y0, z1)], fill: color, line });
}

const LEG = { w: 4, d: 3.4, h: 11 };
const HIP_Z = LEG.h;
const TORSO = { w: 4.4, d: 8.4, h: 13 };
const SHOULDER_Z = HIP_Z + TORSO.h - 1.5;
const HEAD = 7.2;
const NECK_Z = HIP_Z + TORSO.h;

/** Ângulo do braço que trabalha, rad (0 = pendurado, positivo = para a frente). */
const workAngle = (phase: number) => 0.5 + phase * 0.9;

/**
 * Polígonos do boneco, de trás para frente. Mesmo `look` + `pose` + `options` = mesma saída.
 * Camiseta: `look.shirt`. Calça e sapato: paleta.
 */
export function avatarShapes(look: MemberLook = DEFAULT_LOOK, pose: AvatarPose = "stand", options: AvatarOptions = {}): AvatarShape[] {
  const facing = options.facing ?? 1;
  const phase = Math.min(1, Math.max(0, options.phase ?? 0));
  const skin = palette.skin[look.skin % palette.skin.length]!;
  const hairColor = palette.hair[look.hairColor % palette.hair.length]!;
  const out: AvatarShape[] = [];

  // Sombra no piso.
  const shadow: Point[] = [];
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    shadow.push([Math.cos(a) * 11 * facing, Math.sin(a) * 4.2]);
  }
  out.push({ points: shadow, fill: palette.bg });

  const base: Rig = { facing, turns: [] };
  const hip: V3 = [0, 0, HIP_Z];
  // Tronco encostado para trás no cochilo; no trabalho, inclina um pouco para a frente.
  const lean = pose === "nap" ? -0.55 : pose === "work" ? 0.1 : 0;
  const upperTurns = lean ? [{ pivot: hip, theta: lean }] : [];
  const upper: Rig = { facing, turns: upperTurns };
  const neck: V3 = [0, 0, NECK_Z];
  const headRig: Rig = { facing, turns: [...(pose === "nap" ? [{ pivot: neck, theta: 0.5 }] : []), ...upperTurns] };

  const armY = TORSO.d / 2 + 1.1;
  const arm = (side: -1 | 1, theta: number): Rig => ({ facing, turns: [{ pivot: [0, side * armY, SHOULDER_Z], theta }, ...upperTurns] });
  const sleeve = shade(look.shirt, 0.18);
  const armBox = (rig: Rig, side: -1 | 1) => {
    const y = side * armY;
    box(out, rig, [-1.2, y - 1.2, SHOULDER_Z - 11], [1.2, y + 1.2, SHOULDER_Z], sleeve);
    box(out, rig, [-1.1, y - 1.1, SHOULDER_Z - 13.2], [1.1, y + 1.1, SHOULDER_Z - 11], skin);
  };

  // De trás para a frente: braço distante, pernas, tronco, cabeça, braço próximo.
  armBox(arm(-1, 0), -1);
  for (const side of [-1, 1] as const) {
    const y = side * (LEG.d / 2 + 0.3);
    box(out, base, [-LEG.w / 2, y - LEG.d / 2, 0], [LEG.w / 2, y + LEG.d / 2, LEG.h], palette.pants);
    box(out, base, [-LEG.w / 2 - 0.4, y - LEG.d / 2 - 0.2, 0], [LEG.w / 2 + 1.4, y + LEG.d / 2 + 0.2, 2.2], palette.shoe);
  }
  box(out, upper, [-TORSO.w / 2, -TORSO.d / 2, HIP_Z], [TORSO.w / 2, TORSO.d / 2, NECK_Z], look.shirt);
  box(out, upper, [-TORSO.w / 2 - 0.05, -TORSO.d / 2 - 0.05, HIP_Z], [TORSO.w / 2 + 0.05, TORSO.d / 2 + 0.05, HIP_Z + 2], shade(look.shirt, 0.25));

  // Cabelo de trás (por baixo da cabeça).
  const h0: V3 = [-HEAD / 2, -HEAD / 2, NECK_Z];
  const h1: V3 = [HEAD / 2, HEAD / 2, NECK_Z + HEAD];
  const style = look.hair % 5;
  if (style === 1) box(out, headRig, [h0[0] - 1.2, h0[1] - 0.4, NECK_Z - 4], [h0[0] + 1.6, h1[1] + 0.4, h1[2] - 1], hairColor); // longo
  if (style === 4) box(out, headRig, [h0[0] - 2.4, -1.2, NECK_Z + 2], [h0[0] + 0.6, 1.2, NECK_Z + 6], hairColor); // rabo
  box(out, headRig, h0, h1, skin);
  // Cabelo sobre a cabeça.
  if (style === 0 || style === 4) box(out, headRig, [h0[0] - 0.3, h0[1] - 0.3, h1[2] - 1.8], [h1[0] + 0.3, h1[1] + 0.3, h1[2] + 0.6], hairColor); // curto
  if (style === 1) box(out, headRig, [h0[0] - 0.3, h0[1] - 0.3, h1[2] - 1.8], [h1[0] - 1.2, h1[1] + 0.3, h1[2] + 0.8], hairColor);
  if (style === 2) box(out, headRig, [h0[0] + 1, -0.9, h1[2]], [h1[0] - 1, 0.9, h1[2] + 2.8], hairColor); // moicano
  if (style === 3) box(out, headRig, [h0[0] - 1.2, h0[1] - 1.2, h1[2] - 2.4], [h1[0] + 0.4, h1[1] + 1.2, h1[2] + 2.6], hairColor); // black power

  // Rosto na face da frente: olhos (fechados no cochilo) e boca.
  const faceX = h1[0] + 0.02;
  const eyeZ = NECK_Z + HEAD * 0.5;
  for (const side of [-1, 1]) {
    if (pose === "nap") onFront(out, headRig, faceX, side * 1.9 - 0.8, side * 1.9 + 0.8, eyeZ, eyeZ + 0.25, palette.bg, true);
    else onFront(out, headRig, faceX, side * 1.9 - 0.45, side * 1.9 + 0.45, eyeZ - 0.2, eyeZ + 1.1, palette.bg);
  }
  onFront(out, headRig, faceX, -0.9, 0.9, NECK_Z + 1.6, NECK_Z + 2, shade(skin, 0.45));

  // Acessórios.
  if (look.accessory === "glasses") {
    for (const side of [-1, 1]) onFront(out, headRig, faceX + 0.02, side * 1.9 - 1.2, side * 1.9 + 1.2, eyeZ - 0.9, eyeZ + 1.5, palette.ink, true);
    onFront(out, headRig, faceX + 0.02, -0.7, 0.7, eyeZ + 0.3, eyeZ + 0.6, palette.ink, true);
  } else if (look.accessory === "cap") {
    box(out, headRig, [h0[0] - 0.4, h0[1] - 0.4, h1[2] - 1.6], [h1[0] + 0.4, h1[1] + 0.4, h1[2] + 1.4], look.shirt);
    box(out, headRig, [h1[0] + 0.2, h0[1] + 0.8, h1[2] - 1.6], [h1[0] + 3.4, h1[1] - 0.8, h1[2] - 0.6], shade(look.shirt, 0.25));
  } else if (look.accessory === "headband") {
    box(out, headRig, [h0[0] - 0.25, h0[1] - 0.25, h1[2] - 2.6], [h1[0] + 0.25, h1[1] + 0.25, h1[2] - 1.6], palette.highlight);
  }

  armBox(arm(1, pose === "work" ? workAngle(phase) : pose === "nap" ? 0.05 : 0), 1);
  return out;
}
