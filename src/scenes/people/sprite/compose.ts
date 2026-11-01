// Monta o personagem: empilha as partes (de trás para a frente), cada uma com contorno próprio
// de 1 px na cor escura do seu material, e devolve a grade indexada. Puro: sem DOM, sem sorteio.

import { palette } from "../../palette";
import { POSES, TORSO, type PoseParts } from "./parts/body";
import { BEARD, GLASSES, HEAD, faceRows } from "./parts/head";
import { HAIRS } from "./parts/hair";
import { HATS, HEADPHONES, HOODIE_DETAILS, HOODIE_HOOD, JACKET_PANELS, TEAM_STRIPE } from "./parts/wear";
import type { Part, SpriteExpression, SpriteGrid, SpriteLook, SpritePose, SpriteView } from "./types";

export const SPRITE_WIDTH = 30;
export const SPRITE_HEIGHT = 48;
/** Margem de cima para cabelo arrepiado, coque e pompom. */
export const SPRITE_TOP = 2;
/** Pés no chão (entre os dois tênis), na grade da vista frente-direita. */
const ANCHOR = { x: 14, y: 45 + SPRITE_TOP };

const S = palette.sprite;

export interface ComposeOptions {
  /** Padrão: `look.mood` de pé, `focus` trabalhando, `sleep` no cochilo. */
  expression?: SpriteExpression;
  /** Caixote do cochilo; `false` para a cena pôr o próprio assento. */
  seat?: boolean;
}

// ---------------------------------------------------------------------------
// Cores
// ---------------------------------------------------------------------------

function mix(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 0xff) * (1 - t) + ((b >> shift) & 0xff) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

function luminance(color: number): number {
  return (0.299 * ((color >> 16) & 0xff) + 0.587 * ((color >> 8) & 0xff) + 0.114 * (color & 0xff)) / 255;
}

interface Ramp {
  light: number;
  base: number;
  shade: number;
  deep: number;
  /** Contorno que a peça projeta em volta de si. */
  edge: number;
}

function ramp(base: number, shadeTo: number = S.ink): Ramp {
  return {
    light: mix(base, 0xffffff, 0.22),
    base,
    shade: mix(base, shadeTo, 0.28),
    deep: mix(base, shadeTo, 0.5),
    edge: mix(base, S.ink, 0.78)
  };
}

interface Ink {
  fill: number;
  edge: number;
}

const solid = (r: Ramp, fill: number): Ink => ({ fill, edge: r.edge });

/** '#', '+', '-', '=' no material da peça. */
function tone(r: Ramp, ch: string): Ink | null {
  if (ch === "#") return solid(r, r.base);
  if (ch === "+") return solid(r, r.light);
  if (ch === "-") return solid(r, r.shade);
  if (ch === "=") return solid(r, r.deep);
  return null;
}

// ---------------------------------------------------------------------------
// Camadas
// ---------------------------------------------------------------------------

interface Layer {
  part: Part;
  ink: (ch: string) => Ink | null;
  outline: boolean;
  /** Filtra pixels pela linha da parte (recorte do cabelo sob o chapéu). */
  keepRow?: (row: number) => boolean;
}

class Canvas {
  readonly px = new Int32Array(SPRITE_WIDTH * SPRITE_HEIGHT).fill(-1);

  paint(layer: Layer) {
    const fills = new Map<number, Ink>();
    const { x, y, rows } = layer.part;
    rows.forEach((row, r) => {
      if (layer.keepRow && !layer.keepRow(r)) return;
      for (let c = 0; c < row.length; c += 1) {
        const ch = row[c]!;
        if (ch === ".") continue;
        const ink = layer.ink(ch);
        if (!ink) continue;
        const X = x + c;
        const Y = y + r + SPRITE_TOP;
        if (X < 0 || Y < 0 || X >= SPRITE_WIDTH || Y >= SPRITE_HEIGHT) continue;
        fills.set(Y * SPRITE_WIDTH + X, ink);
      }
    });
    if (layer.outline) {
      const edges = new Map<number, number>();
      for (const [i, ink] of fills) {
        const X = i % SPRITE_WIDTH;
        const around = [X > 0 ? i - 1 : -1, X < SPRITE_WIDTH - 1 ? i + 1 : -1, i - SPRITE_WIDTH, i + SPRITE_WIDTH];
        for (const n of around) {
          if (n < 0 || n >= this.px.length || fills.has(n) || edges.has(n)) continue;
          edges.set(n, ink.edge);
        }
      }
      for (const [i, color] of edges) this.px[i] = color;
    }
    for (const [i, ink] of fills) this.px[i] = ink.fill;
  }
}

const at = (part: Part, dx: number, dy: number): Part => ({ x: part.x + dx, y: part.y + dy, rows: part.rows });

// ---------------------------------------------------------------------------
// Roupa por região do corpo
// ---------------------------------------------------------------------------

interface Outfit {
  skin: Ramp;
  /** Regiões k q v c u f h t n → material. */
  region: Record<string, Ramp>;
  collar: Ink;
}

function outfitFor(look: SpriteLook, skin: Ramp): Outfit {
  const top = ramp(look.topColor);
  const team = ramp(look.teamColor);
  const legs = ramp(look.legsColor);
  const white = ramp(S.white);
  const region: Record<string, Ramp> = { k: skin, h: skin, q: top, c: top, u: top, f: skin, t: legs, n: legs };
  let collar = solid(top, top.shade);
  switch (look.top) {
    case "team":
      Object.assign(region, { q: team, c: team, u: team });
      collar = solid(white, white.base);
      break;
    case "hoodie":
      region.f = top;
      break;
    case "jacket":
      Object.assign(region, { c: team, f: top });
      collar = solid(team, team.base);
      break;
    case "tank":
      Object.assign(region, { q: skin, u: skin });
      collar = solid(skin, skin.base);
      break;
    case "tee":
      break;
  }
  if (look.legs === "shorts") region.n = skin;
  if (look.legs === "skirt") Object.assign(region, { t: skin, n: skin });
  return { skin, region, collar };
}

function bodyInk(outfit: Outfit) {
  return (ch: string): Ink | null => {
    if (ch === "v") return outfit.collar;
    const r = outfit.region[ch.toLowerCase()];
    if (!r) return null;
    return solid(r, ch === ch.toLowerCase() ? r.base : r.shade);
  };
}

function defaultExpression(look: SpriteLook, pose: SpritePose): SpriteExpression {
  if (pose === "work") return "focus";
  if (pose === "nap") return "sleep";
  return look.mood ?? "neutral";
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

/**
 * Grade final do personagem. Mesmos argumentos = mesma grade. A vista frente-esquerda é o espelho
 * horizontal da frente-direita (a arte é desenhada olhando para a direita).
 */
export function composeSprite(
  look: SpriteLook,
  view: SpriteView = "front-right",
  pose: SpritePose = "stand",
  options: ComposeOptions = {}
): SpriteGrid {
  const body: PoseParts = POSES[pose];
  const skin = ramp(palette.skin[look.skin % palette.skin.length]!, 0x5a2430);
  const hairBase = palette.hair[look.hairColor % palette.hair.length]!;
  const hair = ramp(hairBase);
  const outfit = outfitFor(look, skin);
  const hairDef = HAIRS[look.hair];
  const hat = look.hat ? HATS[look.hat] : undefined;
  const accent = ramp(look.hatColor ?? S.cloth[2]!);
  const shoe = ramp(look.shoeColor);
  const sole = luminance(look.shoeColor) > 0.75 ? shoe.shade : S.white;
  const white = ramp(S.white);
  const canvas = new Canvas();
  const head = body.head;
  const torso = body.torso;
  const atHead = (part: Part) => at(part, head.x, head.y);
  const atTorso = (part: Part) => at(part, torso.x, torso.y);
  const regionInk = bodyInk(outfit);

  const hairInk = (ch: string): Ink | null => {
    if (ch === ":") return solid(hair, mix(hairBase, skin.base, 0.45));
    if (ch === ";") return solid(hair, mix(hairBase, skin.base, 0.2));
    return tone(hair, ch);
  };

  // 1. Atrás de tudo: caixote do cochilo e cabelo comprido.
  if (body.seat && options.seat !== false) canvas.paint({ part: body.seat, ink: (ch) => tone(ramp(S.wood), ch), outline: true });
  if (hairDef.back) canvas.paint({ part: atHead(hairDef.back), ink: hairInk, outline: true });

  // 2. Braço do fundo, pernas, tênis e saia.
  canvas.paint({ part: body.farArm, ink: regionInk, outline: true });
  canvas.paint({ part: body.legs, ink: regionInk, outline: true });
  const shoeInk = (ch: string): Ink | null => (ch === "w" ? solid(shoe, sole) : tone(shoe, ch));
  canvas.paint({ part: body.farShoe, ink: shoeInk, outline: true });
  canvas.paint({ part: body.nearShoe, ink: shoeInk, outline: true });
  if (look.legs === "skirt") canvas.paint({ part: body.skirt, ink: (ch) => tone(ramp(look.legsColor), ch), outline: true });

  // 3. Tronco e o que vai sobre ele.
  canvas.paint({ part: { x: torso.x, y: torso.y, rows: TORSO }, ink: regionInk, outline: true });
  const top = ramp(look.topColor);
  if (look.top === "team") canvas.paint({ part: atTorso(TEAM_STRIPE), ink: (ch) => tone(white, ch === "W" ? "#" : ch), outline: false });
  if (look.top === "jacket") canvas.paint({ part: atTorso(JACKET_PANELS), ink: (ch) => tone(top, ch), outline: true });
  if (look.top === "hoodie") {
    canvas.paint({ part: atTorso(HOODIE_DETAILS), ink: (ch) => (ch === "W" ? solid(white, S.white) : tone(top, ch)), outline: false });
    canvas.paint({ part: atTorso(HOODIE_HOOD), ink: (ch) => tone(top, ch), outline: true });
  }

  // 4. Braço da frente, cabeça e rosto.
  canvas.paint({ part: body.nearArm, ink: regionInk, outline: true });
  canvas.paint({ part: atHead({ x: 0, y: 0, rows: HEAD }), ink: (ch) => tone(skin, ch), outline: true });
  const face = faceRows(look.gender, options.expression ?? defaultExpression(look, pose));
  const faceInk = (ch: string): Ink | null => {
    const fill =
      ch === "e" ? S.ink
      : ch === "b" ? hair.deep
      : ch === "n" ? skin.shade
      : ch === "m" ? S.mouth
      : ch === "p" ? S.lips
      : ch === "r" ? mix(skin.base, S.blush, 0.45)
      : ch === "w" ? S.white
      : null;
    return fill === null ? null : solid(skin, fill);
  };
  canvas.paint({ part: atHead({ x: 0, y: face.y, rows: face.rows }), ink: faceInk, outline: false });
  if (look.beard && look.gender === "m") canvas.paint({ part: atHead(BEARD), ink: hairInk, outline: false });

  // 5. Cabelo, óculos, chapéu e fone.
  canvas.paint({
    part: atHead(hairDef.front),
    ink: hairInk,
    outline: !hairDef.flat,
    keepRow: hat ? (row) => hairDef.front.y + row >= hat.clipAbove : undefined
  });
  if (look.glasses) canvas.paint({ part: atHead(GLASSES), ink: (ch) => (ch === "x" ? solid(hair, S.frame) : null), outline: false });
  if (hat) canvas.paint({ part: atHead(hat.part), ink: (ch) => tone(accent, ch), outline: true });
  if (look.headphones) {
    const band = ramp(S.jacket[3]!);
    const cup = (ch: string) => (ch === "*" ? solid(accent, accent.base) : ch === "+" ? solid(accent, accent.light) : tone(band, ch));
    canvas.paint({ part: atHead(HEADPHONES), ink: cup, outline: true });
  }

  return toGrid(canvas.px, view === "front-left");
}

function toGrid(px: Int32Array, mirror: boolean): SpriteGrid {
  const colors: number[] = [0];
  const index = new Map<number, number>();
  const pixels = new Uint8Array(px.length);
  for (let y = 0; y < SPRITE_HEIGHT; y += 1) {
    for (let x = 0; x < SPRITE_WIDTH; x += 1) {
      const color = px[y * SPRITE_WIDTH + (mirror ? SPRITE_WIDTH - 1 - x : x)]!;
      if (color < 0) continue;
      let i = index.get(color);
      if (i === undefined) {
        i = colors.length;
        colors.push(color);
        index.set(color, i);
      }
      pixels[y * SPRITE_WIDTH + x] = i;
    }
  }
  return {
    width: SPRITE_WIDTH,
    height: SPRITE_HEIGHT,
    palette: colors,
    pixels,
    anchor: { x: mirror ? SPRITE_WIDTH - 1 - ANCHOR.x : ANCHOR.x, y: ANCHOR.y }
  };
}
