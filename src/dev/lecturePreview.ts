// Montagem só de desenvolvimento da LectureScene (/lecture-dev.html), com palestras de mentira.
// A palestra de verdade (U-fase 9) monta a cena por PhaserStage e entrega a leitura da campanha.
// Parâmetros: ?present=N&founders=1..3

import Phaser from "phaser";
import { LectureScene } from "../scenes/LectureScene";
import { lectureChannel } from "../scenes/lecture/channel";
import { mockLectureView } from "../scenes/lecture/mock";
import { palette } from "../scenes/palette";

const params = new URLSearchParams(location.search);
let present = Number(params.get("present") ?? 30);
let founders = Number(params.get("founders") ?? 1);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "stage",
  backgroundColor: palette.bg,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  banner: false,
  audio: { noAudio: true },
  scene: LectureScene
});

const bar = document.getElementById("bar")!;

function render() {
  lectureChannel.show(mockLectureView(present, undefined, founders));
  bar.replaceChildren();
  const button = (label: string, on: boolean, onClick: () => void) => {
    const el = document.createElement("button");
    el.textContent = label;
    el.className = on ? "on" : "";
    el.onclick = onClick;
    bar.appendChild(el);
  };
  [0, 12, 30, 55, 100, 108, 125].forEach((n) =>
    button(`${n} presentes`, n === present, () => {
      present = n;
      render();
    })
  );
  bar.appendChild(document.createTextNode(" | no palco: "));
  [1, 2, 3].forEach((n) =>
    button(String(n), n === founders, () => {
      founders = n;
      render();
    })
  );
  bar.appendChild(document.createTextNode(" | slide: "));
  button("auto", false, () => lectureChannel.setSlide(null));
  [0, 1, 2, 3, 4].forEach((i) => button(String(i + 1), false, () => lectureChannel.setSlide(i)));
}

render();
(window as unknown as { __lectureGame?: Phaser.Game }).__lectureGame = game;
