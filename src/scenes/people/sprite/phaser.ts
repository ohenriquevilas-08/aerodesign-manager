// Ponte entre os sprites em pixel art e o Phaser: uma textura por pessoa, pose e vista, criada na
// primeira vez que aparece. A cena só escolhe a chave e posiciona a Image.

import Phaser from "phaser";
import type { MemberLook } from "../../../sim";
import { composeSprite } from "./compose";
import { genderOf, spriteLookFrom, type SpriteOutfit } from "./look";
import { addSpriteTexture } from "./render";
import type { SpritePose, SpriteView } from "./types";

export interface SpritePerson {
  id: string;
  look: MemberLook;
  /** Força a roupa: `own` sem a camiseta da equipe (inscritos), `team` com ela (capitães). */
  outfit?: SpriteOutfit;
}

export const viewFor = (facing: 1 | -1): SpriteView => (facing === 1 ? "front-right" : "front-left");

/** Chave da textura; inclui a camiseta porque a mesma pessoa pode mudar de cor entre cenas. */
export function spriteKey(person: SpritePerson, view: SpriteView, pose: SpritePose): string {
  return `px:${person.id}:${view}:${pose}:${person.look.shirt}:${person.look.female ? "f" : "m"}:${person.outfit ?? "-"}`;
}

const META = new Map<string, { key: string; anchor: { x: number; y: number }; width: number; height: number }>();

/** Garante a textura e devolve a chave e a âncora dos pés (em pixels da arte). */
export function ensureSprite(scene: Phaser.Scene, person: SpritePerson, view: SpriteView, pose: SpritePose) {
  const key = spriteKey(person, view, pose);
  const known = META.get(key);
  if (known && scene.textures.exists(key)) return known;
  const grid = composeSprite(spriteLookFrom(person.look, genderOf(person.look), person.id, person.outfit), view, pose);
  if (!scene.textures.exists(key)) {
    addSpriteTexture(scene.textures, key, grid)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  const meta = { key, anchor: grid.anchor, width: grid.width, height: grid.height };
  META.set(key, meta);
  return meta;
}

/** Define a textura da Image (pés na origem) para a pessoa, pose e lado. */
export function setSprite(image: Phaser.GameObjects.Image, person: SpritePerson, facing: 1 | -1, pose: SpritePose) {
  const { key, anchor, width, height } = ensureSprite(image.scene, person, viewFor(facing), pose);
  image.setTexture(key).setOrigin(anchor.x / width, anchor.y / height);
}
