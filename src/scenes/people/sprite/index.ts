// Personagens em pixel art (arte própria, isométrico 3/4 com contorno). Substituto planejado de
// people/avatar.ts; veja "Personagens em pixel art" em docs/architecture.md.

export { composeSprite, SPRITE_HEIGHT, SPRITE_WIDTH, type ComposeOptions } from "./compose";
export { FEMALE_SHARE, HAIRS_BY_GENDER, spriteLookFrom } from "./look";
export { HAIRS } from "./parts/hair";
export { addSpriteTexture, paintSprite, spriteCanvas } from "./render";
export type * from "./types";
