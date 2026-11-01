// Canal entre a Prancheta (UI) e a BlueprintScene. O rascunho ainda não é estado do jogo,
// então a UI entrega o projeto por aqui, no molde do flightReplay. A cena assina ao criar.

import type { AircraftDesign } from "../../sim";

type Listener = (design: AircraftDesign) => void;

function createBlueprintChannel() {
  let current: AircraftDesign | null = null;
  const listeners = new Set<Listener>();
  return {
    show(design: AircraftDesign) {
      current = design;
      listeners.forEach((listener) => listener(design));
    },
    get current() {
      return current;
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

export const blueprintChannel = createBlueprintChannel();
