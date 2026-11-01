// Tipos do personagem em pixel art (estilo isométrico 3/4 com contorno escuro, arte própria do jogo).
// Os dados das partes são grades de caracteres; compose.ts as empilha numa grade final indexada.

export type SpriteGender = "m" | "f";
export type SpriteView = "front-right" | "front-left";
/** Mesmos nomes de `AvatarPose` (people/avatar.ts), para a troca ser direta. */
export type SpritePose = "stand" | "work" | "nap";
export type SpriteExpression = "neutral" | "smile" | "focus" | "sleep" | "surprise";

export type MaleHair = "buzz" | "crew" | "spiky" | "quiff" | "afro" | "shaggy" | "manbun";
export type FemaleHair = "long" | "ponytail" | "bob" | "bun" | "curly" | "pixie";
export type HairStyle = MaleHair | FemaleHair;

export type TopKind = "tee" | "team" | "hoodie" | "jacket" | "tank";
export type LegsKind = "jeans" | "pants" | "shorts" | "skirt";
export type HatKind = "cap" | "beanie";

/** Aparência completa do personagem. Cores em 0xRRGGBB; pele e cabelo são índices 0–5. */
export interface SpriteLook {
  gender: SpriteGender;
  skin: number;
  hairColor: number;
  hair: HairStyle;
  top: TopKind;
  /** Cor da peça de cima (na jaqueta, a cor da jaqueta). */
  topColor: number;
  /** Cor da equipe: camiseta da equipe e a camiseta por baixo da jaqueta. */
  teamColor: number;
  legs: LegsKind;
  legsColor: number;
  shoeColor: number;
  glasses?: boolean;
  hat?: HatKind;
  hatColor?: number;
  headphones?: boolean;
  /** Só masculino. */
  beard?: boolean;
  /** Expressão de pé; trabalho e cochilo têm a sua. */
  mood?: "neutral" | "smile";
}

/** Grade final: `pixels[y * width + x]` indexa `palette`; 0 = transparente. */
export interface SpriteGrid {
  width: number;
  height: number;
  /** Cores 0xRRGGBB; a posição 0 é reservada para transparente. */
  palette: number[];
  pixels: Uint8Array;
  /** Ponto dos pés no chão, em pixels da grade. */
  anchor: { x: number; y: number };
}

/** Pedaço de arte: grade retangular de caracteres na posição (x, y). '.' = vazio. */
export interface Part {
  x: number;
  y: number;
  rows: readonly string[];
}
