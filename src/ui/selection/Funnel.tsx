// O funil da seletiva desenhado (Fase 9, U2): cada etapa é uma barra centrada que afina com a
// multidão. Mostra só contagens que a simulação já revelou.

import type { FunnelStep } from "./model";

export function Funnel({ steps }: { steps: readonly FunnelStep[] }) {
  return (
    <ol class="funnel" aria-label="Funil da seletiva">
      {steps.map((step, index) => {
        const before = index > 0 ? steps[index - 1]!.count : 0;
        const kept = before > 0 && step.reached ? Math.round((step.count / before) * 100) : null;
        return (
          <li key={step.id} class={`funnel-step${step.reached ? " is-reached" : ""}`}>
            <div class="funnel-bar" style={{ width: `${Math.max(step.reached ? 6 : 3, step.ratio * 100)}%` }}>
              <strong>{step.reached ? step.count : "–"}</strong>
            </div>
            <span class="funnel-label">{step.label}</span>
            <span class="funnel-kept muted small">{kept !== null ? `${kept}% da etapa anterior` : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}
