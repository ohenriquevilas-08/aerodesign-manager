// Deriva o SpriteLook da aparência atual (MemberLook) e do id do aluno. Pele, cor do cabelo e
// acessório vêm do MemberLook; penteado da lista do gênero (mantendo o espírito do estilo antigo),
// roupa e cores saem de um sorteio próprio semeado pelo id. Determinístico: mesmo id = mesmo visual.

import { palette } from "../../palette";
import type { MemberLook } from "../../../sim";
import { FEMALE_HAIRS, MALE_HAIRS } from "./parts/hair";
import type { FemaleHair, HairStyle, LegsKind, MaleHair, SpriteGender, SpriteLook, TopKind } from "./types";

/** Proporção de mulheres na engenharia aeronáutica, usada quando o gênero não vem da simulação. */
export const FEMALE_SHARE = 0.2;

const S = palette.sprite;

/** FNV-1a de 32 bits. */
function hash(seed: string | number): number {
  const text = String(seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** mulberry32: sequência pseudoaleatória a partir do hash. */
function stream(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted<T>(roll: number, options: readonly (readonly [T, number])[]): T {
  const total = options.reduce((sum, [, w]) => sum + w, 0);
  let acc = 0;
  for (const [value, w] of options) {
    acc += w / total;
    if (roll < acc) return value;
  }
  return options[options.length - 1]![0];
}

const pick = <T>(roll: number, list: readonly T[]): T => list[Math.floor(roll * list.length) % list.length]!;

/** Estilo antigo (0 curto, 1 longo, 2 moicano, 3 black power, 4 rabo) → penteado novo. */
const MALE_FROM_OLD: readonly (readonly MaleHair[])[] = [["crew", "buzz", "quiff"], ["shaggy"], ["spiky"], ["afro"], ["manbun"]];
const FEMALE_FROM_OLD: readonly (readonly FemaleHair[])[] = [["pixie", "bob"], ["long"], ["bun"], ["curly"], ["ponytail"]];

const TOPS: readonly (readonly [TopKind, number])[] = [
  ["team", 35],
  ["tee", 20],
  ["hoodie", 20],
  ["jacket", 15],
  ["tank", 10]
];
const LEGS: Record<SpriteGender, readonly (readonly [LegsKind, number])[]> = {
  m: [
    ["jeans", 45],
    ["pants", 35],
    ["shorts", 20]
  ],
  f: [
    ["jeans", 40],
    ["pants", 20],
    ["shorts", 15],
    ["skirt", 25]
  ]
};

/** Gênero da arte vindo da simulação (`MemberLook.female`; ausente = masculino). */
export const genderOf = (look: MemberLook): SpriteGender => (look.female ? "f" : "m");

/**
 * Aparência em pixel art de um integrante.
 * `gender` ausente: sorteado pelo id com FEMALE_SHARE. Ponto de troca: quando a simulação tiver
 * `gender` no integrante, passe-o aqui; o resto do visual não muda, só o penteado e o rosto.
 */
export function spriteLookFrom(look: MemberLook, gender: SpriteGender | undefined, seed: string | number): SpriteLook {
  const roll = stream(hash(seed));
  const genderRoll = roll();
  const g: SpriteGender = gender ?? (genderRoll < FEMALE_SHARE ? "f" : "m");
  const families = g === "f" ? FEMALE_FROM_OLD : MALE_FROM_OLD;
  const hair: HairStyle = pick(roll(), families[look.hair % families.length]!);
  const top = weighted(roll(), TOPS);
  const legs = weighted(roll(), LEGS[g]);
  const topColor = top === "jacket" ? pick(roll(), S.jacket) : pick(roll(), S.cloth);
  const legsColor = legs === "jeans" ? pick(roll(), S.denim) : pick(roll(), S.pants);
  const shoeColor = pick(roll(), S.shoe);
  const hatColor = pick(roll(), S.cloth);
  const beard = g === "m" && roll() < 0.25;
  const mood = roll() < 0.5 ? "smile" : "neutral";
  const result: SpriteLook = {
    gender: g,
    skin: look.skin,
    hairColor: look.hairColor,
    hair,
    top,
    topColor,
    teamColor: look.shirt,
    legs,
    legsColor,
    shoeColor,
    mood
  };
  if (beard) result.beard = true;
  if (look.accessory === "glasses") result.glasses = true;
  // Faixa de cabeça antiga vira gorro ou fone; o boné continua boné.
  if (look.accessory === "cap") result.hat = "cap";
  if (look.accessory === "headband") {
    if (roll() < 0.5) result.hat = "beanie";
    else result.headphones = true;
  }
  if (result.hat || result.headphones) result.hatColor = hatColor;
  return result;
}

export const HAIRS_BY_GENDER: Record<SpriteGender, readonly HairStyle[]> = { m: MALE_HAIRS, f: FEMALE_HAIRS };
