// Canal provisório do EventView, no molde do introChannel: enquanto `eventView(state)` não existe na
// sim, a UI/dev entrega a leitura por aqui. Quando a sim entrar, source.ts passa a ler do estado e
// este canal fica só para a montagem de desenvolvimento.

import type { EventView } from "./contract";

type Listener = (view: EventView | null) => void;

function createEventChannel() {
  let view: EventView | null = null;
  const listeners = new Set<Listener>();
  return {
    show(next: EventView | null) {
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
