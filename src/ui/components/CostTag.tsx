import type { ActionDef, Cost } from "../../sim";
import { costParts, DISCIPLINE_SHORT } from "../format";

/** Custo de uma ação na ordem fixa ⏱ ◆ ⌛ ⚠, omitindo o que for zero (design §8). */
export function CostTag({ cost }: { cost: Cost }) {
  const parts = costParts(cost);
  if (parts.length === 0) return <span class="cost cost-free">grátis</span>;
  return (
    <span class="cost">
      {parts.map((part) => (
        <span key={part.kind} class={`cost-part cost-${part.kind}`} title={part.title}>
          <span aria-hidden="true">{part.icon}</span> {part.text}
        </span>
      ))}
    </span>
  );
}

const LEGEND = [
  { kind: "hours", icon: "⏱", text: "horas-pessoa" },
  { kind: "credits", icon: "◆", text: "créditos" },
  { kind: "lead", icon: "⌛", text: "espera no calendário" },
  { kind: "risk", icon: "⚠", text: "desgaste e risco" }
] as const;

export function CostLegend() {
  return (
    <span class="cost cost-legend">
      {LEGEND.map((item) => (
        <span key={item.kind} class={`cost-part cost-${item.kind}`}>
          <span aria-hidden="true">{item.icon}</span> {item.text}
        </span>
      ))}
    </span>
  );
}

/** Cartão de ação do catálogo. Ainda sem botão: os comandos de tarefa chegam com a simulação. */
export function ActionCard({ action }: { action: ActionDef }) {
  return (
    <article class="action-card">
      <div class="action-head">
        <span class="action-label">{action.label}</span>
        {action.discipline ? <span class="chip">{DISCIPLINE_SHORT[action.discipline]}</span> : null}
      </div>
      <CostTag cost={action.cost} />
    </article>
  );
}
