// Faixa da margem estática para a cor do desenho do blueprint (design §6.5).

export type MarginBand = "ok" | "risk" | "unstable";

/** Faixa da margem: negativa = instável, 5–20% = ok, resto = risco. */
export function marginBand(marginPercentMac: number): MarginBand {
  if (marginPercentMac < 0) return "unstable";
  return marginPercentMac >= 5 && marginPercentMac <= 20 ? "ok" : "risk";
}
