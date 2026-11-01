// Galeria só de desenvolvimento dos personagens em pixel art (/sprites-dev.html): 24 alunos
// sorteados nas três poses e nas duas vistas, em 2× e 4×, e o catálogo de penteados e roupas.

import { render } from "preact";
import { useState } from "preact/hooks";
import { drawLook, TEAM_SHIRT_COLOR, type MemberLook } from "../sim";
import { HAIRS, HAIRS_BY_GENDER, spriteLookFrom, type SpriteGender, type SpriteLook, type SpritePose, type SpriteView } from "../scenes/people/sprite";
import { PixelAvatar } from "../ui/components/PixelAvatar";

const POSES: SpritePose[] = ["stand", "work", "nap"];
const VIEWS: SpriteView[] = ["front-right", "front-left"];

interface Student {
  id: string;
  look: MemberLook;
  gender: SpriteGender;
}

let rng = 2026;
const students: Student[] = Array.from({ length: 24 }, (_, i) => {
  const drawn = drawLook(rng);
  rng = drawn.rngState;
  // Mais meninas que os 20% do jogo, para a revisão da arte.
  return { id: `aluno-${i + 1}`, look: drawn.look, gender: i % 3 === 0 ? "f" : "m" };
});

const BASE: SpriteLook = {
  gender: "m",
  skin: 1,
  hairColor: 1,
  hair: "crew",
  top: "team",
  topColor: 0x2f6fb5,
  teamColor: TEAM_SHIRT_COLOR,
  legs: "jeans",
  legsColor: 0x35558a,
  shoeColor: 0xf0efe8
};

function describe(l: SpriteLook) {
  const extras = [l.glasses && "óculos", l.hat, l.headphones && "fone", l.beard && "barba"].filter(Boolean).join(" ");
  return `${l.gender} · ${HAIRS[l.hair].label} · ${l.top} · ${l.legs}${extras ? ` · ${extras}` : ""}`;
}

function Card({ student }: { student: Student }) {
  const look = spriteLookFrom(student.look, student.gender, student.id);
  return (
    <div class="card">
      <div class="caption">
        {student.id} · {describe(look)}
      </div>
      <div class="row">
        {POSES.flatMap((pose) => VIEWS.map((view) => <PixelAvatar key={pose + view} look={look} pose={pose} view={view} scale={2} />))}
      </div>
      <div class="row">
        <PixelAvatar look={look} pose="stand" view="front-right" scale={4} />
        <PixelAvatar look={look} pose="work" view="front-left" scale={4} />
        <PixelAvatar look={look} pose="nap" view="front-right" scale={4} />
      </div>
    </div>
  );
}

function Catalog() {
  const variants: { title: string; looks: SpriteLook[] }[] = [
    {
      title: "Penteados masculinos",
      looks: HAIRS_BY_GENDER.m.map((hair, i) => ({ ...BASE, hair, hairColor: i % 6, skin: (i * 2) % 6 }))
    },
    {
      title: "Penteados femininos",
      looks: HAIRS_BY_GENDER.f.map((hair, i) => ({ ...BASE, gender: "f", hair, hairColor: (i + 2) % 6, skin: (i * 3 + 1) % 6, mood: "smile" }))
    },
    {
      title: "Roupa de cima",
      looks: (["tee", "team", "hoodie", "jacket", "tank"] as const).map((top, i) => ({
        ...BASE,
        top,
        topColor: top === "jacket" ? 0x2a3550 : [0x2f6fb5, 0x3a8a5c, 0xc23b4a, 0x6b4fa0, 0xd9a43a][i]!
      }))
    },
    {
      title: "Pernas",
      looks: (["jeans", "pants", "shorts", "skirt"] as const).map((legs) => ({
        ...BASE,
        gender: legs === "skirt" ? "f" : "m",
        hair: legs === "skirt" ? "ponytail" : "crew",
        legs,
        legsColor: legs === "jeans" ? 0x35558a : 0x2a2f3a
      }))
    },
    {
      title: "Acessórios",
      looks: [
        { ...BASE, glasses: true },
        { ...BASE, hat: "cap", hatColor: 0xc23b4a },
        { ...BASE, hat: "beanie", hatColor: 0x3a8a5c },
        { ...BASE, headphones: true, hatColor: 0xd9a43a },
        { ...BASE, beard: true, hair: "shaggy" },
        { ...BASE, gender: "f", hair: "long", glasses: true, hat: "beanie", hatColor: 0xd77fa1 }
      ]
    },
    {
      title: "Tons de pele e cores de cabelo",
      looks: [0, 1, 2, 3, 4, 5].map((i) => ({ ...BASE, skin: i, hairColor: i, gender: i % 2 ? "f" : "m", hair: i % 2 ? "bob" : "quiff" }))
    }
  ];
  return (
    <>
      {variants.map((v) => (
        <section key={v.title}>
          <h2>{v.title}</h2>
          <div class="row wrap">
            {v.looks.map((look, i) => (
              <figure key={i}>
                <PixelAvatar look={look} scale={4} />
                <figcaption>{describe(look)}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function Gallery() {
  const [bg, setBg] = useState<"dark" | "floor" | "light">("dark");
  return (
    <div class={`page bg-${bg}`}>
      <header>
        <h1>Personagens em pixel art (dev)</h1>
        {(["dark", "floor", "light"] as const).map((b) => (
          <button key={b} class={b === bg ? "on" : ""} onClick={() => setBg(b)}>
            {b}
          </button>
        ))}
      </header>
      <section>
        <h2>24 alunos sorteados · parado, bancada, cochilo · frente-direita e frente-esquerda</h2>
        <div class="grid">
          {students.map((s) => (
            <Card key={s.id} student={s} />
          ))}
        </div>
      </section>
      <Catalog />
    </div>
  );
}

render(<Gallery />, document.getElementById("app")!);
