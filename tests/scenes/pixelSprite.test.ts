import { describe, expect, it } from "vitest";
import { palette } from "../../src/scenes/palette";
import { composeSprite, FEMALE_SHARE, HAIRS, HAIRS_BY_GENDER, spriteLookFrom, type SpriteGrid, type SpriteLook } from "../../src/scenes/people/sprite";
import { POSES, TORSO } from "../../src/scenes/people/sprite/parts/body";
import { BEARD, FACES_FOR_TEST, GLASSES, HEAD } from "../../src/scenes/people/sprite/parts/head";
import * as wear from "../../src/scenes/people/sprite/parts/wear";
import type { Part } from "../../src/scenes/people/sprite/types";
import type { MemberLook } from "../../src/sim";

const BASE: SpriteLook = {
  gender: "m",
  skin: 2,
  hairColor: 3,
  hair: "crew",
  top: "tee",
  topColor: 0x2f6fb5,
  teamColor: 0xff9f2e,
  legs: "jeans",
  legsColor: 0x35558a,
  shoeColor: 0xf0efe8
};

const colors = (g: SpriteGrid) => new Set(Array.from(g.pixels, (i) => g.palette[i]).filter((_, k) => g.pixels[k] !== 0));
const mask = (g: SpriteGrid) => Array.from(g.pixels, (i) => (i === 0 ? 0 : 1)).join("");
const topRow = (g: SpriteGrid) => Math.floor(g.pixels.findIndex((i) => i !== 0) / g.width);

function allParts(): [string, readonly string[]][] {
  const out: [string, readonly string[]][] = [["TORSO", TORSO], ["HEAD", HEAD], ["BEARD", BEARD.rows], ["GLASSES", GLASSES.rows]];
  for (const [name, pose] of Object.entries(POSES)) {
    for (const [key, part] of Object.entries(pose)) if (part && "rows" in part) out.push([`${name}.${key}`, (part as Part).rows]);
  }
  for (const [g, faces] of Object.entries(FACES_FOR_TEST)) for (const [e, rows] of Object.entries(faces)) out.push([`face.${g}.${e}`, rows]);
  for (const [name, hair] of Object.entries(HAIRS)) {
    out.push([`hair.${name}.front`, hair.front.rows]);
    if (hair.back) out.push([`hair.${name}.back`, hair.back.rows]);
  }
  for (const [name, value] of Object.entries(wear)) {
    if ("rows" in value) out.push([name, (value as Part).rows]);
    else for (const [hat, def] of Object.entries(value as typeof wear.HATS)) out.push([`hat.${hat}`, def.part.rows]);
  }
  return out;
}

describe("partes em pixel art", () => {
  it("toda grade é retangular", () => {
    for (const [name, rows] of allParts()) {
      const width = rows[0]!.length;
      for (const row of rows) expect(row.length, name).toBe(width);
    }
  });

  it("há pelo menos 6 penteados masculinos e 5 femininos", () => {
    expect(HAIRS_BY_GENDER.m.length).toBeGreaterThanOrEqual(6);
    expect(HAIRS_BY_GENDER.f.length).toBeGreaterThanOrEqual(5);
  });
});

describe("composeSprite", () => {
  it("é determinístico e devolve a grade indexada", () => {
    const a = composeSprite(BASE, "front-right", "work");
    expect(composeSprite(BASE, "front-right", "work")).toEqual(a);
    expect(a.pixels.length).toBe(a.width * a.height);
    expect(a.palette[0]).toBe(0);
    expect(Math.max(...a.pixels)).toBeLessThan(a.palette.length);
  });

  it("a vista frente-esquerda é o espelho da frente-direita", () => {
    for (const pose of ["stand", "work", "nap"] as const) {
      const r = composeSprite(BASE, "front-right", pose);
      const l = composeSprite(BASE, "front-left", pose);
      for (let y = 0; y < r.height; y += 1) {
        for (let x = 0; x < r.width; x += 1) {
          expect(l.palette[l.pixels[y * l.width + x]!]).toBe(r.palette[r.pixels[y * r.width + (r.width - 1 - x)]!]);
        }
      }
      expect(l.anchor.x).toBe(r.width - 1 - r.anchor.x);
    }
  });

  it("usa a pele e o cabelo da paleta e a cor da equipe na camiseta da equipe", () => {
    const tee = colors(composeSprite(BASE));
    expect(tee).toContain(palette.skin[2]);
    expect(tee).toContain(palette.hair[3]);
    expect(tee).toContain(BASE.topColor);
    expect(tee).not.toContain(BASE.teamColor);
    expect(colors(composeSprite({ ...BASE, top: "team" }))).toContain(BASE.teamColor);
    // A jaqueta mostra a camiseta da equipe no vão da frente.
    expect(colors(composeSprite({ ...BASE, top: "jacket", topColor: palette.sprite.jacket[0] }))).toContain(BASE.teamColor);
  });

  it("cada penteado tem silhueta própria", () => {
    for (const gender of ["m", "f"] as const) {
      const masks = HAIRS_BY_GENDER[gender].map((hair) => mask(composeSprite({ ...BASE, gender, hair })));
      expect(new Set(masks).size).toBe(masks.length);
    }
  });

  it("as três poses são diferentes", () => {
    const masks = (["stand", "work", "nap"] as const).map((pose) => mask(composeSprite(BASE, "front-right", pose)));
    expect(new Set(masks).size).toBe(3);
  });

  it("o chapéu esconde o cabelo arrepiado", () => {
    const spiky = { ...BASE, hair: "spiky" as const };
    expect(topRow(composeSprite({ ...spiky, hat: "cap" }))).toBeGreaterThan(topRow(composeSprite(spiky)));
  });

  it("o cochilo pode ficar sem o caixote", () => {
    const withSeat = composeSprite(BASE, "front-right", "nap");
    const noSeat = composeSprite(BASE, "front-right", "nap", { seat: false });
    expect(colors(withSeat)).toContain(palette.sprite.wood);
    expect(colors(noSeat)).not.toContain(palette.sprite.wood);
  });

  it("monta qualquer combinação de roupa e acessório", () => {
    for (const top of ["tee", "team", "hoodie", "jacket", "tank"] as const) {
      for (const legs of ["jeans", "pants", "shorts", "skirt"] as const) {
        for (const extra of [{}, { glasses: true }, { hat: "cap" as const }, { hat: "beanie" as const }, { headphones: true }, { beard: true }]) {
          const g = composeSprite({ ...BASE, top, legs, ...extra }, "front-left", "nap");
          expect(g.pixels.some((i) => i !== 0)).toBe(true);
        }
      }
    }
  });
});

describe("spriteLookFrom", () => {
  const member: MemberLook = { skin: 4, hair: 3, hairColor: 1, shirt: 0xff9f2e, accessory: "glasses" };

  it("é determinístico pelo id e herda pele, cabelo, camiseta e óculos", () => {
    const a = spriteLookFrom(member, undefined, "m-7");
    expect(spriteLookFrom(member, undefined, "m-7")).toEqual(a);
    expect(a).toMatchObject({ skin: 4, hairColor: 1, teamColor: 0xff9f2e, glasses: true });
  });

  it("respeita o gênero e escolhe penteado da lista certa", () => {
    for (let i = 0; i < 50; i += 1) {
      const f = spriteLookFrom({ ...member, hair: i % 5 }, "f", `id-${i}`);
      const m = spriteLookFrom({ ...member, hair: i % 5 }, "m", `id-${i}`);
      expect(HAIRS_BY_GENDER.f).toContain(f.hair);
      expect(HAIRS_BY_GENDER.m).toContain(m.hair);
      expect(f.beard).toBeUndefined();
      expect(m.legs).not.toBe("skirt");
    }
  });

  it("sem gênero, sorteia perto da proporção da engenharia", () => {
    let women = 0;
    const n = 2000;
    for (let i = 0; i < n; i += 1) if (spriteLookFrom(member, undefined, `aluno-${i}`).gender === "f") women += 1;
    expect(women / n).toBeGreaterThan(FEMALE_SHARE - 0.04);
    expect(women / n).toBeLessThan(FEMALE_SHARE + 0.04);
  });

  it("boné vira boné; faixa vira gorro ou fone", () => {
    expect(spriteLookFrom({ ...member, accessory: "cap" }, "m", "x").hat).toBe("cap");
    for (let i = 0; i < 20; i += 1) {
      const l = spriteLookFrom({ ...member, accessory: "headband" }, "m", `h-${i}`);
      expect(l.hat === "beanie" || l.headphones === true).toBe(true);
    }
  });
});
