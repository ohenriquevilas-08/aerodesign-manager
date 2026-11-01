import { leadDaysRange, type ActionDef, type Cost } from "../../sim";
import { costParts, crewText, type LeadRange, DISCIPLINE_SHORT, SKILL_LABEL } from "../format";

/** Custo de uma ação na ordem fixa ⏱ ◆ ⌛ ⚠, omitindo o que for zero (design §8). Prazo em faixa se houver `lead`. */
export function CostTag({ cost, lead }: { cost: Cost; lead?: LeadRange | null }) {
  const parts = costParts(cost, lead);
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

/** Cartão de ação do catálogo: custo, disciplina e quantas pessoas cabem. Clicável quando há onSelect. */
export function ActionCard({
  action,
  selected,
  highlight,
  onSelect
}: {
  action: ActionDef;
  selected?: boolean;
  /** Destaque do cartão (ex.: Leitura do regulamento no dia em que ele sai). */
  highlight?: boolean;
  onSelect?: () => void;
}) {
  const body = (
    <>
      <span class="action-head">
        <span class="action-label">{action.label}</span>
        {action.discipline ? <span class="chip">{DISCIPLINE_SHORT[action.discipline]}</span> : null}
      </span>
      <CostTag cost={action.cost} lead={leadDaysRange(action.id)} />
      {action.crew.max > 0 ? (
        <span class="crew-rule">
          {crewText(action.crew)}
          {action.skill ? ` · rende com ${SKILL_LABEL[action.skill]}` : ""}
        </span>
      ) : null}
    </>
  );
  if (!onSelect) return <article class={`action-card${highlight ? " is-highlight" : ""}`}>{body}</article>;
  return (
    <button type="button" class={`action-card is-button${highlight ? " is-highlight" : ""}`} aria-pressed={selected} onClick={onSelect}>
      {highlight ? <span class="action-flag">Regulamento publicado: leia agora</span> : null}
      {body}
    </button>
  );
}
