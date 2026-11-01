// PONTO DE TROCA com a frente de Simulação (Fase 7, S1).
// Hoje a cena lê o `EventView` do `eventChannel`. Quando `eventView(state)` existir em `src/sim`,
// troque o corpo de `readEventView` por `return eventView(state)` (adaptando o formato, se divergir
// de ./contract.ts) e deixe o canal só para a montagem de dev.

import type { GameState } from "../../sim";
import { eventChannel } from "./channel";
import type { EventView } from "./contract";

export function readEventView(_state: GameState): EventView | null {
  return eventChannel.current;
}
