// Montagem só de desenvolvimento da IntroScene (/intro-dev.html), com fundadores de mentira.
// A abertura de verdade (U2) monta a cena por PhaserStage e entrega os fundadores do estado.

import Phaser from "phaser";
import { drawLook } from "../sim";
import { IntroScene } from "../scenes/IntroScene";
import { introChannel, type IntroFounder } from "../scenes/intro/channel";
import { palette } from "../scenes/palette";

const NAMES = ["Marina", "Caio", "Beatriz", "Rafael"];

let rng = 7;
const founders: IntroFounder[] = NAMES.map((name, i) => {
  const drawn = drawLook(rng);
  rng = drawn.rngState;
  return { id: `f${i}`, name, look: drawn.look };
});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "stage",
  backgroundColor: palette.bg,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  banner: false,
  audio: { noAudio: true },
  scene: IntroScene
});

const bar = document.getElementById("bar")!;
const button = (label: string, onClick: () => void) => {
  const el = document.createElement("button");
  el.textContent = label;
  el.onclick = onClick;
  bar.appendChild(el);
};
button("Reentrar", () => introChannel.show(founders));
founders.forEach((f, i) => button(`Fala: ${f.name}`, () => introChannel.speak(i)));
button("Ninguém", () => introChannel.speak(null));

introChannel.show(founders);
(window as unknown as { __introGame?: Phaser.Game }).__introGame = game;
