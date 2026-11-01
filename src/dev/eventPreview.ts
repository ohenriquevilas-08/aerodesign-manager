// Montagem só de desenvolvimento da EventStage (/event-dev.html), com eventos de mentira.
// Mostra também como a UI (U1) encaixa FlightScene/QueueScene na janela da moldura (FRAME_WINDOW).
// Parâmetros: ?event=selection-day|flight-test|competition&block=N&observed=gN

import Phaser from "phaser";
import { createStore } from "../app/store";
import { createGame, PLAYER_TEAM_ID } from "../sim";
import { EventStage } from "../scenes/EventStage";
import { FlightScene } from "../scenes/FlightScene";
import { QueueScene } from "../scenes/QueueScene";
import { eventChannel } from "../scenes/event/channel";
import type { EventKind, StageView } from "../scenes/event/contract";
import { mockEventView } from "../scenes/event/mock";
import { FRAME_WINDOW, framedSceneFor } from "../scenes/event/stage";
import { flightReplay } from "../scenes/flight/replayChannel";
import { MOCK_PLAYBACKS } from "../scenes/flight/mockPlaybacks";
import { palette } from "../scenes/palette";

const base = createGame({ seed: 20260209, teamName: "Nova Equipe AeroDesign" });
const ids = base.rivals.map((rival) => rival.id);
// Fila de mentira com a sua equipe no meio, para a QueueScene dentro da moldura.
const store = createStore({
  ...base,
  competition: {
    phase: "flights",
    battery: 1,
    queue: [...ids.slice(0, 6), PLAYER_TEAM_ID, ...ids.slice(6)],
    queueIndex: 2,
    plannedPayloadKg: null,
    weather: { temperatureK: 291, pressureHpa: 930, headwindMs: 2.5 },
    results: [],
    projectScores: {},
    penalties: {},
    inspectionIssues: []
  }
});

const params = new URLSearchParams(location.search);
let kind = (params.get("event") as EventKind | null) ?? "selection-day";
let blockIndex = Number(params.get("block") ?? 0);
let observed: string | null = params.get("observed");

const newGame = (parent: string | HTMLElement, scene: new () => Phaser.Scene, key: string) => {
  const host = typeof parent === "string" ? document.getElementById(parent)! : parent;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    backgroundColor: palette.bg,
    scale: { mode: Phaser.Scale.RESIZE, width: host.clientWidth || window.innerWidth, height: host.clientHeight || window.innerHeight },
    banner: false,
    audio: { noAudio: true }
  });
  game.scene.add(key, scene, true, { store });
  return game;
};

const stage = newGame("stage", EventStage, "event");
(window as unknown as { __eventGame?: Phaser.Game }).__eventGame = stage;

const framed = document.getElementById("framed")!;
let nested: Phaser.Game | null = null;
let nestedKey: string | null = null;

function syncNested(view: StageView) {
  const block = view.blocks[view.blockIndex];
  const which = block ? framedSceneFor(block.kind) : null;
  if (which === nestedKey) return;
  nested?.destroy(true);
  nested = null;
  nestedKey = which;
  if (!which) {
    framed.style.display = "none";
    return;
  }
  framed.style.display = "block";
  framed.style.left = `${FRAME_WINDOW.x * 100}%`;
  framed.style.top = `${FRAME_WINDOW.y * 100}%`;
  framed.style.width = `${FRAME_WINDOW.w * 100}%`;
  framed.style.height = `${FRAME_WINDOW.h * 100}%`;
  nested = newGame(framed, which === "flight" ? FlightScene : QueueScene, which);
  if (which === "flight") setTimeout(() => flightReplay.play(MOCK_PLAYBACKS.valid), 600);
}

const bar = document.getElementById("bar")!;

function render() {
  const view = mockEventView(kind, blockIndex);
  if (view.selection) view.selection.observedGroupId = observed;
  eventChannel.show(view);
  syncNested(view);

  bar.replaceChildren();
  const button = (label: string, on: boolean, onClick: () => void) => {
    const el = document.createElement("button");
    el.textContent = label;
    el.className = on ? "on" : "";
    el.onclick = onClick;
    bar.appendChild(el);
  };
  (["selection-day", "flight-test", "competition"] as const).forEach((k) =>
    button(k, k === kind, () => {
      kind = k;
      blockIndex = 0;
      render();
    })
  );
  bar.appendChild(document.createTextNode(" | "));
  view.blocks.forEach((b, i) => button(`${i + 1}. ${b.label}`, i === blockIndex, () => {
    blockIndex = i;
    render();
  }));
  if (view.selection) {
    bar.appendChild(document.createTextNode(" | observar: "));
    button("nenhum", observed === null, () => {
      observed = null;
      render();
    });
    view.selection.groups.forEach((group) => button(group.label, observed === group.id, () => {
      observed = group.id;
      render();
    }));
  }
}

render();
