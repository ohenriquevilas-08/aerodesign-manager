// Canal do StageView só para a montagem de desenvolvimento (/event-dev.html); no jogo, source.ts
// lê do estado.

import type { StageView } from "./contract";

type Listener = (view: StageView | null) => void;

function createEventChannel() {
  let view: StageView | null = null;
  const listeners = new Set<Listener>();
  return {
    show(next: StageView | null) {
      view = next;
      listeners.forEach((listener) => listener(next));
    },
    get current() {
      return view;
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

export const eventChannel = createEventChannel();
