import { useState } from "preact/hooks";
import { App } from "./App";
import { Intro } from "./Intro";
import { StartScreen } from "./StartScreen";

type Phase = { name: "start" } | { name: "intro"; seed: number } | { name: "game" };

/** Abertura (Continuar / Novo jogo), a fundação da equipe (Fase 6, U2) e depois o jogo. */
export function Root() {
  const [phase, setPhase] = useState<Phase>({ name: "start" });
  if (phase.name === "start") {
    return <StartScreen onContinue={() => setPhase({ name: "game" })} onNew={(seed) => setPhase({ name: "intro", seed })} />;
  }
  if (phase.name === "intro") return <Intro seed={phase.seed} onDone={() => setPhase({ name: "game" })} />;
  return <App onNewGame={(seed) => setPhase({ name: "intro", seed })} />;
}
