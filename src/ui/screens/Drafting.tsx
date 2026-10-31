import { useState } from "preact/hooks";
import { REGULAR_2026, spanFactor, surfacesFactor } from "../../sim";
import { Segmented, Slider } from "../components/Controls";
import { formatNumber } from "../format";

// Prancheta (design §6.1). Estado local enquanto a simulação não tem o projeto da aeronave:
// as escolhas ainda não afetam o jogo, só mostram o compromisso de cada uma.

type Philosophy = "payload" | "light" | "stable";
type Material = "balsa" | "composite" | "mixed";
type Gear = "low" | "high";

interface Draft {
  span: number;
  surfaces: 1 | 2 | 3;
  power: number;
  philosophy: Philosophy;
  material: Material;
  gear: Gear;
}

const DEFAULT_DRAFT: Draft = { span: 2.8, surfaces: 2, power: 550, philosophy: "light", material: "balsa", gear: "low" };

// Sobrevive à troca de tela; some ao recarregar (não é estado do jogo).
let savedDraft = DEFAULT_DRAFT;

const R = REGULAR_2026;
const n = formatNumber;
const SPAN_MIN = 1.5;

const SURFACES = [
  { value: 1, label: "Asa voadora", sub: "N = 1 · ×1,22" },
  { value: 2, label: "Convencional", sub: "N = 2 · ×1,00" },
  { value: 3, label: "Três superfícies", sub: "N = 3 · ×1,15" }
] as const;

const SURFACES_TEXT: Record<Draft["surfaces"], string> = {
  1: "Pontua 22% a mais, mas é difícil de estabilizar e o compartimento de carga briga com o centro de gravidade.",
  2: "Asa e empenagem: a escolha segura, fácil de projetar e de pilotar. Multiplicador neutro.",
  3: "Canard + asa + empenagem: 15% a mais e mais área para carga, desde que a terceira superfície tenha função real."
};

const PHILOSOPHIES = [
  { value: "payload", label: "Alta carga" },
  { value: "light", label: "Leve" },
  { value: "stable", label: "Estável" }
] as const;

const PHILOSOPHY_TEXT: Record<Philosophy, string> = {
  payload: "Asa grande e estrutura reforçada para levar muito peso. EE alta se a estrutura aguentar; peso vazio sobe junto.",
  light: "Cada grama conta: a EE cresce pelo denominador. Estrutura no limite, mais sensível a dano nos ensaios.",
  stable: "Margens folgadas de estabilidade e estrutura. Menos pontos no papel, menos susto na pista."
};

const MATERIALS = [
  { value: "balsa", label: "Balsa" },
  { value: "composite", label: "Compósito" },
  { value: "mixed", label: "Misto" }
] as const;

const MATERIAL_TEXT: Record<Material, string> = {
  balsa: "Barata e rápida de cortar. Peso vazio razoável; qualidade depende muito de quem fabrica.",
  composite: "Fibra e resina: leve e rígido, mas caro, exige molde e cura (⌛) e gente com mão de fabricação.",
  mixed: "Longarina em compósito, nervuras em balsa. Meio-termo de peso, custo e dificuldade."
};

const GEARS = [
  { value: "low", label: "Trem baixo" },
  { value: "high", label: "Trem alto" }
] as const;

const GEAR_TEXT: Record<Gear, string> = {
  low: "Mais leve e sem risco com a fita, mas a hélice fica perto do chão: limita o diâmetro.",
  high: "Permite hélice maior e rotação mais fácil. Altura é livre em 2026, mas se abortar a decolagem pode romper a fita."
};

interface Alert {
  tone: "danger" | "warn" | "info";
  text: string;
}

function alertsFor(draft: Draft): Alert[] {
  const alerts: Alert[] = [];
  if (draft.span >= R.maxSpan - 0.05) {
    alerts.push({
      tone: "danger",
      text: `Envergadura no limite de ${n(R.maxSpan, 1)} m. Um erro de fabricação vira penalidade: 100 pontos por metro de excesso, +20 se passar de 5 cm, em toda bateria.`
    });
  }
  if (draft.power >= R.maxPower) {
    alerts.push({
      tone: "danger",
      text: `Potência no limite de ${R.maxPower} W. O wattímetro mede o pico; cada watt acima custa 0,5 ponto por bateria.`
    });
  }
  if (draft.power < 400) {
    alerts.push({
      tone: "warn",
      text: `Pouca potência: com carga alta, risco de não passar o obstáculo de ${n(R.obstacleHeight, 1)} m aos ${R.obstacleDistance} m.`
    });
  }
  if (draft.philosophy === "payload" && draft.span < 2.5) {
    alerts.push({ tone: "warn", text: "Alta carga com asa curta: falta área para sustentar o peso que a filosofia promete." });
  }
  if (draft.surfaces === 1) {
    alerts.push({ tone: "warn", text: "Asa voadora: estabilidade e controle viram o capítulo mais difícil do relatório." });
  }
  if (draft.surfaces === 3) {
    alerts.push({ tone: "info", text: "Três superfícies: a terceira precisa sustentar de verdade para contar como N = 3." });
  }
  if (draft.gear === "high") {
    alerts.push({ tone: "warn", text: "Trem alto: decolagem abortada pode romper a fita, invalidar o voo e tirar as próximas tentativas." });
  }
  if (draft.material === "composite" && draft.philosophy === "stable") {
    alerts.push({ tone: "info", text: "Compósito numa filosofia estável: paga caro por uma leveza que o projeto não aproveita." });
  }
  return alerts;
}

export function Drafting() {
  const [draft, setDraftState] = useState(savedDraft);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraftState((previous) => (savedDraft = { ...previous, [key]: value }));

  const sf = surfacesFactor(draft.surfaces);
  const bf = spanFactor(draft.span);
  const multiplier = sf * bf;
  // Melhor caso de FPV (1,10) e FPR (1,00): pontos de voo por ponto de EE.
  const perEE = 50 * 1.1 * multiplier;
  const alerts = alertsFor(draft);

  return (
    <div class="screen">
      <header class="screen-head">
        <h1 class="screen-title">Prancheta</h1>
        <span class="muted">Rascunho: as escolhas ainda não entram na simulação.</span>
      </header>
      <div class="drafting-grid">
        <section class="panel">
          <h2 class="panel-title">Decisões de projeto</h2>
          <div class="panel-body drafting-controls">
            <div class="decision">
              <Slider
                label="Envergadura (b)"
                value={draft.span}
                min={SPAN_MIN}
                max={R.maxSpan}
                step={0.05}
                display={`${n(draft.span, 2)} m`}
                alert={draft.span >= R.maxSpan - 0.05}
                onChange={(value) => set("span", value)}
              />
              <p class="decision-text">
                Mais envergadura = mais sustentação e carga. Mas a nota de voo é multiplicada por 1,15^(−b): aqui ×
                {n(bf, 3)}.
              </p>
            </div>
            <div class="decision">
              <Segmented
                label="Superfícies sustentadoras (N)"
                value={draft.surfaces}
                options={SURFACES}
                onChange={(value) => set("surfaces", value)}
              />
              <p class="decision-text">{SURFACES_TEXT[draft.surfaces]}</p>
            </div>
            <div class="decision">
              <Slider
                label="Potência (P)"
                value={draft.power}
                min={300}
                max={R.maxPower}
                step={10}
                display={`${draft.power} W`}
                alert={draft.power >= R.maxPower}
                onChange={(value) => set("power", value)}
              />
              <p class="decision-text">
                Mais potência decola antes dos {R.obstacleDistance} m com mais carga, mas pede bateria e motor mais
                pesados, que aumentam o peso vazio.
              </p>
            </div>
            <div class="decision">
              <Segmented
                label="Filosofia"
                value={draft.philosophy}
                options={PHILOSOPHIES}
                onChange={(value) => set("philosophy", value)}
              />
              <p class="decision-text">{PHILOSOPHY_TEXT[draft.philosophy]}</p>
            </div>
            <div class="decision">
              <Segmented label="Material" value={draft.material} options={MATERIALS} onChange={(value) => set("material", value)} />
              <p class="decision-text">{MATERIAL_TEXT[draft.material]}</p>
            </div>
            <div class="decision">
              <Segmented label="Altura do trem" value={draft.gear} options={GEARS} onChange={(value) => set("gear", value)} />
              <p class="decision-text">{GEAR_TEXT[draft.gear]}</p>
            </div>
          </div>
        </section>

        <div class="stack scroll-col">
          <section class="panel">
            <h2 class="panel-title">Multiplicador de pontuação</h2>
            <div class="panel-body">
              <div class="multiplier">
                <span class="multiplier-value">× {n(multiplier, 3)}</span>
                <span class="multiplier-formula">
                  superfícies × {n(sf, 2)} · envergadura × {n(bf, 3)}
                </span>
              </div>
              <MultiplierChart span={draft.span} surfaces={draft.surfaces} />
              <p class="muted small">
                No melhor caso (FPV 1,10 e relatório com FPR 1,00), cada ponto de eficiência estrutural vale{" "}
                <strong class="text-accent">{n(perEE, 1)}</strong> pontos de voo. Com EE 3,0:{" "}
                <strong class="text-accent">{n(perEE * 3, 0)}</strong>.
              </p>
            </div>
          </section>
          <section class="panel">
            <h2 class="panel-title">Alertas do regulamento</h2>
            <div class="panel-body stack-tight">
              {alerts.length === 0 ? <p class="muted">Nenhum alerta para esta configuração.</p> : null}
              {alerts.map((alert) => (
                <p key={alert.text} class={`alert alert-${alert.tone}`}>
                  {alert.text}
                </p>
              ))}
            </div>
          </section>
          <button
            type="button"
            class="btn-ghost"
            onClick={() => {
              savedDraft = DEFAULT_DRAFT;
              setDraftState(DEFAULT_DRAFT);
            }}
          >
            Restaurar rascunho
          </button>
        </div>
      </div>
    </div>
  );
}

// Multiplicador × envergadura para N = 1, 2 e 3, com a configuração atual marcada.
const CHART = { width: 340, height: 150, pad: 28, yMin: 0.5, yMax: 1.0 };

function MultiplierChart({ span, surfaces }: { span: number; surfaces: number }) {
  const { width, height, pad, yMin, yMax } = CHART;
  const x = (b: number) => pad + ((b - SPAN_MIN) / (R.maxSpan - SPAN_MIN)) * (width - pad - 8);
  const y = (m: number) => 8 + (1 - (m - yMin) / (yMax - yMin)) * (height - pad - 8);
  const spans = Array.from({ length: 26 }, (_, i) => SPAN_MIN + (i * (R.maxSpan - SPAN_MIN)) / 25);
  const line = (count: number) =>
    spans.map((b) => `${x(b).toFixed(1)},${y(Math.min(yMax, surfacesFactor(count) * spanFactor(b))).toFixed(1)}`).join(" ");
  const current = surfacesFactor(surfaces) * spanFactor(span);

  return (
    <svg class="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Multiplicador por envergadura">
      {[0.5, 0.75, 1.0].map((m) => (
        <g key={m}>
          <line class="chart-grid" x1={pad} x2={width - 8} y1={y(m)} y2={y(m)} />
          <text class="chart-label" x={pad - 4} y={y(m) + 4} text-anchor="end">
            {n(m, 2)}
          </text>
        </g>
      ))}
      {[1.5, 2, 2.5, 3, 3.5, 4].map((b) => (
        <text key={b} class="chart-label" x={x(b)} y={height - 8} text-anchor="middle">
          {n(b, 1)} m
        </text>
      ))}
      {[1, 2, 3].map((count) => (
        <g key={count}>
          <polyline class={`chart-line${count === surfaces ? " is-active" : ""}`} points={line(count)} />
          <text class="chart-label" x={x(SPAN_MIN) + 4} y={y(Math.min(yMax, surfacesFactor(count) * spanFactor(SPAN_MIN))) - 4}>
            N={count}
          </text>
        </g>
      ))}
      <circle class="chart-dot" cx={x(span)} cy={y(Math.min(yMax, current))} r={5} />
    </svg>
  );
}
