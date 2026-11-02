import { BALANCE, type Member } from "../../sim";

// Barra de energia do aluno (Fase 8, U4): usada nas cartas, no Elenco, na escala da oficina e no
// painel das ações. A cor segue os limites da simulação (cansaço abaixo de 40, para sozinho abaixo de 15).

export type EnergyTone = "ok" | "tired" | "exhausted";

export function energyTone(energy: number): EnergyTone {
  return energy < BALANCE.energy.exhaustedBelow ? "exhausted" : energy < BALANCE.energy.tiredBelow ? "tired" : "ok";
}

export const ENERGY_LABEL: Record<EnergyTone, string> = { ok: "Disposto", tired: "Cansado", exhausted: "Exausto" };

/** "Energia 72 · Disposto". */
export function energyTitle(member: Pick<Member, "energy">): string {
  const value = Math.round(member.energy);
  return `Energia ${value} · ${ENERGY_LABEL[energyTone(value)]}`;
}

export function EnergyBar({ member, showValue = false, class: extra }: { member: Pick<Member, "energy">; showValue?: boolean; class?: string }) {
  const value = Math.max(0, Math.min(100, Math.round(member.energy)));
  const tone = energyTone(value);
  return (
    <span class={`energy energy-${tone}${extra ? ` ${extra}` : ""}`} title={energyTitle(member)}>
      <span
        class="energy-track"
        role="meter"
        aria-label="Energia"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span class="energy-fill" style={{ width: `${value}%` }} />
      </span>
      {showValue ? <span class="energy-value">{value}</span> : null}
    </span>
  );
}
