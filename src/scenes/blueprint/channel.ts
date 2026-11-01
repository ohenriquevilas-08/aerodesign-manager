// Canal entre a Prancheta (UI) e a BlueprintScene. O rascunho ainda não é estado do jogo,
// então a UI entrega o projeto por aqui, no molde do flightReplay. A cena assina ao criar.
// Modo comparação: `compare(design)` entrega o projeto gravado, desenhado em traço apagado por baixo
// do rascunho; `compare(null)` desliga.

import type { AircraftDesign } from "../../sim";

type Listener = (design: AircraftDesign) => void;
type ReferenceListener = (reference: AircraftDesign | null) => void;

function createBlueprintChannel() {
  let current: AircraftDesign | null = null;
  let reference: AircraftDesign | null = null;
  const listeners = new Set<Listener>();
  const referenceListeners = new Set<ReferenceListener>();
  return {
    show(design: AircraftDesign) {
      current = design;
      listeners.forEach((listener) => listener(design));
    },
    compare(design: AircraftDesign | null) {
      reference = design;
      referenceListeners.forEach((listener) => listener(design));
    },
    get current() {
      return current;
    },
    get reference() {
      return reference;
    },
    subscribe(listener: Listener, onReference?: ReferenceListener): () => void {
      listeners.add(listener);
      if (onReference) referenceListeners.add(onReference);
      return () => {
        listeners.delete(listener);
        if (onReference) referenceListeners.delete(onReference);
      };
    }
  };
}

export const blueprintChannel = createBlueprintChannel();
