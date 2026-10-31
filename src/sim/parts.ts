// Peças: estado visível derivado da condição (design §7.2).

import type { PartState } from "./types";

export const PART_STATE_LABELS: Record<PartState, string> = {
  new: "Nova",
  worn: "Desgastada",
  damaged: "Danificada",
  broken: "Quebrada"
};

/** Nova 80–100 · Desgastada 50–79 · Danificada 20–49 · Quebrada 0–19. */
export function partState(condition: number): PartState {
  if (condition >= 80) return "new";
  if (condition >= 50) return "worn";
  if (condition >= 20) return "damaged";
  return "broken";
}
