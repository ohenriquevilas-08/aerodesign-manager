import { useState } from "preact/hooks";
import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import {
  clockToDate,
  DISCIPLINES,
  estimatePerformance,
  estimateReportScore,
  formatCountdown,
  formatDate,
  OFFICIAL_CALENDAR,
  predictedPayload,
  reportChecklist,
  type ChapterState,
  type ReportChecklist,
  REGULAR_2026,
  reportFactor,
  REPORT_CHAPTERS,
  type Estimate,
  type PayloadLine
} from "../../sim";
import { Slider } from "../components/Controls";
import { EstimateRow } from "../components/EstimateRow";
import { DISCIPLINE_LABEL, formatNumber } from "../format";
import { useDerived } from "../hooks";
import { navigate } from "../nav";

// Relatório e Portal da CT (design §6.2, §9.1, §11). Capítulos e plantas vêm do trabalho da equipe;
// as previsões (peso vazio → FPV, reta de carga → PAC) são rascunho até o envio, depois congelam.

const R = REGULAR_2026;
const n = formatNumber;
const REPORT_DEADLINE = OFFICIAL_CALENDAR.find((item) => item.id === "report")!;
const LATE_DEADLINE = OFFICIAL_CALENDAR.find((item) => item.id === "report-late")!;

/** Rascunho mostrado antes da primeira gravação: uma reta plausível, para o jogador ajustar. */
const DEFAULT_LINE: PayloadLine = { a: -0.004, b: 14, cap: null };
const DEFAULT_EMPTY_WEIGHT = 3.5;

/** Eixo de Hρ do gráfico (m) e pontos onde a faixa estimada é calculada. */
const ALT_MAX = 1500;
const ALT_STEP = 150;
const ALTITUDES = Array.from({ length: ALT_MAX / ALT_STEP + 1 }, (_, i) => i * ALT_STEP);

export function Report() {
  const report = useGame((state) => state.report);
  const hours = useGame((state) => Math.floor(state.clock.hours));
  const nr = useDerived((state) => estimateReportScore(state), []);
  const band = useDerived(
    (state) => ALTITUDES.map((altitude) => estimatePerformance(state, altitude)?.maxPayloadKg ?? null),
    []
  );
  const emptyEstimate = useDerived((state) => estimatePerformance(state, 0)?.emptyWeightKg ?? null, []);

  const checklist = useDerived((state) => reportChecklist(state), []);
  const frozen = report.submittedAt !== null;
  const line = report.payloadLine ?? DEFAULT_LINE;
  const emptyWeight = report.predictedEmptyWeightKg ?? DEFAULT_EMPTY_WEIGHT;
  const setLine = (patch: Partial<PayloadLine>) =>
    store.dispatch({ type: "set-predictions", payloadLine: { ...line, ...patch } });

  return (
    <div class="screen">
      <header class="screen-head">
        <h1 class="screen-title">Relatório</h1>
        <Countdown checklist={checklist} sentAt={report.submittedAt} />
        <div class="stat-row">
          <div class="stat">
            <span class="stat-label">{report.score === null ? "NR estimada" : "NR da CT"}</span>
            <strong>{report.score === null ? estimateText(nr, 0) : n(report.score, 1)} <small class="muted">/ {R.reportMax}</small></strong>
          </div>
          <div class="stat">
            <span class="stat-label">FPR no voo</span>
            <strong>{fprText(report.score, nr)}</strong>
          </div>
        </div>
      </header>
      <div class="report-grid">
        <Checklist checklist={checklist} frozen={frozen} oralScore={report.oralScore} />

        <section class="panel">
          <h2 class="panel-title">Previsões do Portal da CT</h2>
          <div class="panel-body stack predictions">
            <div class="predictions-controls">
              <div class="stack-tight">
                <Slider
                  label="Peso vazio previsto (vira o FPV)"
                  value={emptyWeight}
                  min={1}
                  max={10}
                  step={0.05}
                  display={`${n(emptyWeight, 2)} kg`}
                  disabled={frozen}
                  onChange={(value) =>
                    store.dispatch({ type: "set-predictions", emptyWeightKg: Math.round(value * 100) / 100 })
                  }
                />
                <EstimateRow label="Estimativa da equipe" value={emptyEstimate} unit="kg" digits={2} />
              </div>
              <Slider
                label="Inclinação a (carga perdida a cada 1.000 m)"
                value={-line.a * 1000}
                min={0}
                max={12}
                step={0.1}
                display={`${n(-line.a * 1000, 1)} kg`}
                  disabled={frozen}
                onChange={(value) => setLine({ a: -Math.round(value * 10) / 10000 })}
              />
              <Slider
                label="Intercepto b (carga ao nível do mar)"
                value={line.b}
                min={0}
                max={25}
                step={0.1}
                display={`${n(line.b, 1)} kg`}
                  disabled={frozen}
                onChange={(value) => setLine({ b: Math.round(value * 10) / 10 })}
              />
              <div class="stack-tight">
                <label class="check">
                  <input
                    type="checkbox"
                    checked={line.cap !== null}
                    disabled={frozen}
                    onChange={(event) =>
                      setLine({ cap: event.currentTarget.checked ? Math.round(predictedPayload(line, 0) * 10) / 10 : null })
                    }
                  />
                  Patamar máximo
                </label>
                {line.cap !== null ? (
                  <Slider
                    label="Patamar"
                    value={line.cap}
                    min={0}
                    max={25}
                    step={0.1}
                    display={`${n(line.cap, 1)} kg`}
                  disabled={frozen}
                    onChange={(value) => setLine({ cap: Math.round(value * 10) / 10 })}
                  />
                ) : null}
              </div>
            </div>
            <PayloadChart line={line} band={band} />
            <p class="muted small">
              Carga = a × Hρ + b{line.cap !== null ? ", limitada ao patamar" : ""}. Na competição, a reta é lida na Hρ do
              momento: o PAC (até 30 pontos) cai rápido quando a carga real se afasta dela. Conservador perde carga;
              agressivo arrisca o PAC.
            </p>
            {!report.payloadLine || report.predictedEmptyWeightKg === null ? (
              <p class="alert alert-warn">
                {frozen
                  ? "Previsões enviadas incompletas."
                  : "Rascunho ainda não gravado: mexa nos controles para gravar peso vazio e reta."}
              </p>
            ) : null}
            <SubmitBar frozen={frozen} checklist={checklist} nr={nr} />
          </div>
        </section>
      </div>
    </div>
  );
}

function SubmitBar({ frozen, checklist, nr }: { frozen: boolean; checklist: ReportChecklist; nr: Estimate | null }) {
  const [confirming, setConfirming] = useState(false);
  if (frozen) {
    return <p class="alert alert-info">Previsões congeladas: são estas que a CT usa no FPV e no PAC.</p>;
  }
  const notReady = checklist.chapters.filter((chapter) => chapter.state !== "ready").length;
  if (!confirming) {
    return (
      <div class="stack-tight">
        {checklist.blocker ? <p class="alert alert-warn">{checklist.blocker}</p> : null}
        <button type="button" class="btn-primary" disabled={checklist.blocker !== null} onClick={() => setConfirming(true)}>
          Enviar ao Portal da CT
        </button>
      </div>
    );
  }
  return (
    <div class="stack-tight submit-confirm">
      <p class="alert alert-warn">
        Nota esperada do relatório: <strong>{estimateText(nr, 0)}</strong> de {R.reportMax}.
        {notReady > 0 ? ` ${notReady} de ${checklist.chapters.length} capítulos ainda não estão prontos.` : ""} Depois do
        envio, relatório e previsões não mudam mais.
      </p>
      <div class="confirm-row">
        <button type="button" class="btn-ghost" onClick={() => setConfirming(false)}>
          Voltar
        </button>
        <button
          type="button"
          class="btn-primary"
          onClick={() => {
            setConfirming(false);
            store.dispatch({ type: "submit-report" });
          }}
        >
          Confirmar envio
        </button>
      </div>
    </div>
  );
}

const STATE_LABEL: Record<ChapterState, string> = { "not-started": "Não começou", writing: "Escrevendo", ready: "Pronto" };
const PREDICTION_LABEL = { missing: "Falta gravar", ready: "Gravada", sent: "Enviada" } as const;

function Countdown({ checklist, sentAt }: { checklist: ReportChecklist; sentAt: number | null }) {
  if (sentAt !== null) {
    return <span class="deadline-chip is-done">Enviado ao Portal da CT em {formatDate(clockToDate(sentAt))}</span>;
  }
  const { deadline } = checklist;
  return (
    <span class={`deadline-chip${deadline.passed ? " is-late" : ""}`}>
      {deadline.passed
        ? `Prazo vencido: envio com penalidade até ${formatDate(LATE_DEADLINE.date)}`
        : `Entrega em ${formatDate(REPORT_DEADLINE.date)} · faltam ${deadline.countdown}`}
    </span>
  );
}

function Checklist({ checklist, frozen, oralScore }: { checklist: ReportChecklist; frozen: boolean; oralScore: number | null }) {
  const write = (actionId: string, targetId?: string) => navigate("actions", { actionId, targetId });
  const ready = checklist.chapters.filter((chapter) => chapter.state === "ready").length;
  return (
    <section class="panel">
      <h2 class="panel-title">
        Checklist de entrega{" "}
        <span class="panel-count">
          {ready}/{checklist.chapters.length} capítulos
        </span>
      </h2>
      <div class="panel-body stack-tight scroll-col">
        {checklist.chapters.map((chapter) => (
          <article key={chapter.discipline} class={`check-card is-${chapter.state}`}>
            <header class="check-head">
              <span class="check-title">{DISCIPLINE_LABEL[chapter.discipline]}</span>
              <span class={`check-state state-${chapter.state}`}>{STATE_LABEL[chapter.state]}</span>
            </header>
            <div class="check-meta">
              <span>
                {n(chapter.hours)} / {n(chapter.readyHours)} h
              </span>
              <span>{chapter.testsCited > 0 ? `${n(chapter.testsCited)} ensaio(s) citado(s)` : "sem ensaios citados"}</span>
              <span>
                nota esperada {n(chapter.expectedScore, 1)} / {n(chapter.maxScore)}
              </span>
            </div>
            {chapter.missing.length > 0 ? (
              <ul class="check-missing">
                {chapter.missing.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            ) : null}
            {!frozen ? (
              <button type="button" class="btn-ghost check-write" onClick={() => write("report-chapter", chapter.discipline)}>
                Escrever
              </button>
            ) : null}
          </article>
        ))}
        <article class={`check-card is-${checklist.drawings.state}`}>
          <header class="check-head">
            <span class="check-title">Plantas (Conceitual e Estruturas)</span>
            <span class={`check-state state-${checklist.drawings.state}`}>{STATE_LABEL[checklist.drawings.state]}</span>
          </header>
          <div class="check-meta">
            <span>
              {n(checklist.drawings.hours)} / {n(checklist.drawings.readyHours)} h
            </span>
          </div>
          {!frozen ? (
            <button type="button" class="btn-ghost check-write" onClick={() => write("drawings")}>
              Desenhar
            </button>
          ) : null}
        </article>
        {(
          [
            ["Peso vazio previsto", checklist.predictions.emptyWeight],
            ["Reta de carga prevista", checklist.predictions.payloadLine]
          ] as const
        ).map(([label, state]) => (
          <article key={label} class={`check-card is-${state === "missing" ? "not-started" : "ready"}`}>
            <header class="check-head">
              <span class="check-title">{label}</span>
              <span class={`check-state state-${state === "missing" ? "not-started" : "ready"}`}>{PREDICTION_LABEL[state]}</span>
            </header>
            {state === "missing" ? <p class="check-meta">Ajuste os controles do painel ao lado para gravar.</p> : null}
          </article>
        ))}
        <details class="how-it-works">
          <summary>Como funciona</summary>
          <p class="muted small">
            A nota de cada capítulo vem de conhecimento documentado, horas de escrita e ensaios citados. A NR multiplica a
            nota de voo: FPR = mín(1,00; 0,50 + 0,75 × NR / {R.reportMax}). Peso vazio previsto vira o FPV; a reta de carga
            vira o PAC. Apresentação oral vale mais {R.oralMax} pontos
            {oralScore !== null ? ` (nota: ${n(oralScore, 1)})` : ""}.
          </p>
        </details>
      </div>
    </section>
  );
}

function estimateText(value: Estimate | null, digits: number): string {
  return value ? `${n(value.value, digits)} ± ${n(value.margin, digits)}` : "—";
}

function fprText(score: number | null, estimate: Estimate | null): string {
  if (score !== null) return `× ${n(reportFactor(score), 2)}`;
  if (!estimate) return "—";
  const low = reportFactor(Math.max(0, estimate.value - estimate.margin));
  const high = reportFactor(Math.min(R.reportMax, estimate.value + estimate.margin));
  return low === high ? `× ${n(low, 2)}` : `× ${n(low, 2)}–${n(high, 2)}`;
}

// Reta de previsão sobre a faixa de carga máxima estimada (skill dataviz: linha 2 px,
// faixa em lavagem de 10%, grade recessiva, legenda com 2 séries, cruz + dica ao passar o mouse).
const CH = { width: 560, height: 230, left: 48, right: 14, top: 10, bottom: 30 };

function PayloadChart({ line, band }: { line: PayloadLine; band: (Estimate | null)[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const known = band.filter((item): item is Estimate => item !== null);
  const lineValues = ALTITUDES.map((altitude) => predictedPayload(line, altitude));
  const peak = Math.max(10, ...lineValues, ...known.map((item) => item.value + item.margin));
  const yMax = Math.ceil(peak / 5) * 5;
  const plotW = CH.width - CH.left - CH.right;
  const plotH = CH.height - CH.top - CH.bottom;
  const x = (altitude: number) => CH.left + (altitude / ALT_MAX) * plotW;
  const y = (kg: number) => CH.top + (1 - Math.max(0, Math.min(yMax, kg)) / yMax) * plotH;
  const yTicks = Array.from({ length: yMax / 5 + 1 }, (_, i) => i * 5);

  const linePoints = ALTITUDES.map((altitude, i) => `${x(altitude).toFixed(1)},${y(lineValues[i]!).toFixed(1)}`).join(" ");
  const hasBand = known.length === band.length;
  const bandPath = hasBand
    ? `M${ALTITUDES.map((altitude, i) => `${x(altitude).toFixed(1)},${y(band[i]!.value + band[i]!.margin).toFixed(1)}`).join(" L")} L${ALTITUDES.map((altitude, i) => `${x(altitude).toFixed(1)},${y(band[i]!.value - band[i]!.margin).toFixed(1)}`).reverse().join(" L")} Z`
    : "";
  const bandMid = hasBand ? ALTITUDES.map((altitude, i) => `${x(altitude).toFixed(1)},${y(band[i]!.value).toFixed(1)}`).join(" ") : "";

  const onMove = (event: PointerEvent) => {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * CH.width;
    const altitude = ((px - CH.left) / plotW) * ALT_MAX;
    const index = Math.round(altitude / ALT_STEP);
    setHover(index >= 0 && index < ALTITUDES.length ? index : null);
  };

  const hoverAltitude = hover === null ? null : ALTITUDES[hover]!;
  const hoverBand = hover === null ? null : band[hover];

  return (
    <figure class="payload-chart">
      <div class="chart-legend">
        <span class="legend-item">
          <span class="legend-line legend-line-accent" /> Sua reta de previsão
        </span>
        <span class="legend-item">
          <span class="legend-swatch legend-swatch-highlight" /> Carga máxima estimada (± margem)
        </span>
      </div>
      <div class="chart-wrap">
        <svg
          class="chart chart-payload"
          viewBox={`0 0 ${CH.width} ${CH.height}`}
          role="img"
          aria-label="Reta de previsão de carga por altitude densidade"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {yTicks.map((kg) => (
            <g key={kg}>
              <line class="chart-grid" x1={CH.left} x2={CH.width - CH.right} y1={y(kg)} y2={y(kg)} />
              <text class="chart-label" x={CH.left - 6} y={y(kg) + 4} text-anchor="end">
                {kg === yMax ? `${kg} kg` : kg}
              </text>
            </g>
          ))}
          {[0, 300, 600, 900, 1200, 1500].map((altitude) => (
            <text key={altitude} class="chart-label" x={x(altitude)} y={CH.height - 10} text-anchor="middle">
              {n(altitude)} m
            </text>
          ))}
          {hasBand ? (
            <>
              <path class="chart-band" d={bandPath} />
              <polyline class="chart-band-mid" points={bandMid} />
            </>
          ) : null}
          <polyline class="chart-line is-active" points={linePoints} />
          {hoverAltitude !== null ? (
            <>
              <line class="chart-crosshair" x1={x(hoverAltitude)} x2={x(hoverAltitude)} y1={CH.top} y2={CH.top + plotH} />
              <circle class="chart-dot" cx={x(hoverAltitude)} cy={y(lineValues[hover!]!)} r={5} />
            </>
          ) : null}
        </svg>
        {hoverAltitude !== null ? (
          <div
            class={`chart-tooltip${hoverAltitude > ALT_MAX * 0.6 ? " is-flipped" : ""}`}
            style={{ left: `${(x(hoverAltitude) / CH.width) * 100}%` }}
            role="status"
          >
            <span class="chart-tooltip-title">Hρ {n(hoverAltitude)} m</span>
            <span class="chart-tooltip-row">
              <span class="legend-line legend-line-accent" />
              <strong>{n(lineValues[hover!]!, 1)} kg</strong> sua reta
            </span>
            <span class="chart-tooltip-row">
              <span class="legend-swatch legend-swatch-highlight" />
              <strong>{hoverBand ? `${n(hoverBand.value, 1)} ± ${n(hoverBand.margin, 1)} kg` : "—"}</strong> estimada
            </span>
          </div>
        ) : null}
      </div>
      {!hasBand ? (
        <figcaption class="muted small">
          Faixa estimada indisponível: a equipe ainda não tem estimativa de carga para este projeto.
        </figcaption>
      ) : null}
      <details class="chart-table">
        <summary>Ver como tabela</summary>
        <table class="data-table">
          <thead>
            <tr>
              <th>Hρ</th>
              <th class="num">Sua reta</th>
              <th class="num">Estimada</th>
            </tr>
          </thead>
          <tbody>
            {ALTITUDES.filter((_, i) => i % 2 === 0).map((altitude) => {
              const i = altitude / ALT_STEP;
              const item = band[i];
              return (
                <tr key={altitude}>
                  <td>{n(altitude)} m</td>
                  <td class="num">{n(lineValues[i]!, 1)} kg</td>
                  <td class="num">{item ? `${n(item.value, 1)} ± ${n(item.margin, 1)} kg` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
