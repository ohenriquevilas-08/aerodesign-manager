import { useState } from "preact/hooks";
import { App } from "./App";
import { StartScreen } from "./StartScreen";

/** Abertura (Continuar / Novo jogo) e depois o jogo. */
export function Root() {
  const [started, setStarted] = useState(false);
  return started ? <App /> : <StartScreen onStart={() => setStarted(true)} />;
}
