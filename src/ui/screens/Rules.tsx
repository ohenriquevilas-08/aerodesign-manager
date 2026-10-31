import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { useGame } from "../../app/useGame";
import {
  clockToDate,
  densityAltitude,
  DISCIPLINES,
  formatDate,
  OFFICIAL_CALENDAR,
  REGULAR_2026,
  reliabilityBonus,
  REPORT_CHAPTERS,
  scoreBattery,
  SEASON_START,
  spanFactor,
  surfacesFactor,
  type BatteryInput
} from "../../sim";
import { Segmented, Slider } from "../components/Controls";
import { DISCIPLINE_LABEL, formatNumber } from "../format";

// Tela Regulamento (design §3, §9 e §11): regras da Classe Regular 2026 em linguagem acessível
// e a aba "Como é pontuado", com as fórmulas reais e uma calculadora que chama scoring.ts.

type Tab = "rules" | "scoring";

export function Rules() {
  const [tab, setTab] = useState<Tab>("rules");
  return (
    <div class="screen">
      <header class="screen-head">
        <h1 class="screen-title">Regulamento 2026 · Classe Regular</h1>
        <div class="tabs" role="tablist" aria-label="Seções do regulamento">
          <button type="button" role="tab" aria-selected={tab === "rules"} onClick={() => setTab("rules")}>
            Regras
          </button>
          <button type="button" role="tab" aria-selected={tab === "scoring"} onClick={() => setTab("scoring")}>
            Como é pontuado
          </button>
        </div>
      </header>
      {tab === "rules" ? <RulesTab /> : <ScoringTab />}
    </div>
  );
}

const R = REGULAR_2026;
const n = formatNumber;

const CALENDAR = [
  { id: "rev00", date: SEASON_START, title: "Regulamento publicado (Rev00)", kind: "info" as const },
  ...OFFICIAL_CALENDAR
];

function RulesTab() {
  const day = useGame((state) => Math.floor(state.clock.hours / 24));
  const now = clockToDate(day * 24);
  const nextId = CALENDAR.find((item) => item.date > now)?.id;

  return (
    <div class="rules-grid">
      <div class="stack scroll-col">
        <section class="panel">
          <h2 class="panel-title">O avião</h2>
          <div class="panel-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Regra</th>
                  <th>Limite</th>
                  <th>Se passar</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Envergadura (b)</td>
                  <td class="num">≤ {n(R.maxSpan, 1)} m</td>
                  <td>Perde 100 pontos por metro de excesso, mais 20 se passar de 5 cm. Em toda bateria.</td>
                </tr>
                <tr>
                  <td>Potência de pico em voo</td>
                  <td class="num">≤ {R.maxPower} W</td>
                  <td>Perde 0,5 ponto por watt acima. Motor elétrico, medido pelo wattímetro.</td>
                </tr>
                <tr>
                  <td>Superfícies sustentadoras (N)</td>
                  <td class="num">1 a {R.maxSurfaces}</td>
                  <td>Asa voadora, convencional ou três superfícies. A terceira precisa ter função real.</td>
                </tr>
                <tr>
                  <td>Peso máximo de decolagem</td>
                  <td class="num">{R.maxTakeoffWeight} kg</td>
                  <td>Vazio + carga. Carga acima disso não conta na pontuação.</td>
                </tr>
                <tr>
                  <td>Altura</td>
                  <td class="num">livre</td>
                  <td>Mas avião alto que aborta a decolagem e rompe a fita perde o voo e as próximas tentativas.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <h2 class="panel-title">Decolagem e voo válido</h2>
          <div class="panel-body rule-list">
            <div class="rule">
              <span class="rule-key">Decolagem</span>
              <p>
                O avião precisa passar sobre um obstáculo de <strong>{n(R.obstacleHeight, 1)} m</strong> colocado a{" "}
                <strong>{R.obstacleDistance} m</strong> do início da corrida. Não passou, o voo é inválido.
              </p>
            </div>
            <div class="rule">
              <span class="rule-key">Circuito</span>
              <p>Depois da decolagem, circuito padrão e pouso na pista. Parar dentro da pista vale bônus (BPO).</p>
            </div>
            <div class="rule">
              <span class="rule-key">Voo válido</span>
              <p>
                Carga de pelo menos <strong>{n(R.minValidPayload, 1)} kg</strong> e pontuação da bateria maior que zero.
                A retirada da carga tem que acabar em até {R.maxUnloadSeconds / 60} min.
              </p>
            </div>
            <div class="rule">
              <span class="rule-key">Retirada</span>
              <p>Até duas pessoas tiram a carga num quadrado de 3 × 3 m. Até 20 s vale o bônus inteiro; aos 30 s zera.</p>
            </div>
            <div class="rule">
              <span class="rule-key">Fila</span>
              <p>Dá para trocar a carga na fila enquanto houver pelo menos 3 equipes à frente. Depois disso, é aquilo.</p>
            </div>
            <div class="rule">
              <span class="rule-key">Ar</span>
              <p>
                A CT divulga a altitude densidade ao longo do dia. Manhã fria = ar denso = mais carga. A previsão de
                carga entregue em 16/ago é avaliada na altitude densidade do momento do voo.
              </p>
            </div>
          </div>
        </section>

        <section class="panel">
          <h2 class="panel-title">Classificação para as baterias</h2>
          <div class="panel-body">
            <p class="muted">
              As três primeiras baterias são abertas. Da 4ª em diante, só voa quem já tem voo válido com eficiência
              estrutural mínima ou está entre as 10 primeiras, com um número mínimo de equipes.
            </p>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Bateria</th>
                  <th>EE mínima</th>
                  <th>Ou top</th>
                  <th>Mínimo de equipes</th>
                </tr>
              </thead>
              <tbody>
                {R.batteryCutoffs.map((cut, index) => (
                  <tr key={index}>
                    <td>{index + 1}ª</td>
                    <td class="num">{cut.minEE === null ? "aberta" : n(cut.minEE, 1)}</td>
                    <td class="num">{cut.topPositions ?? "—"}</td>
                    <td class="num">{cut.minTeams ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div class="stack scroll-col">
        <section class="panel">
          <h2 class="panel-title">Calendário oficial</h2>
          <div class="panel-body">
            {CALENDAR.map((item) => (
              <div
                key={item.id}
                class={`deadline${item.kind === "deadline" ? " is-due" : ""}${item.date <= now ? " is-past" : ""}${
                  item.id === nextId ? " is-next" : ""
                }`}
              >
                <div>
                  <span class="deadline-title">{item.title}</span>
                  <span class="deadline-date">{formatDate(item.date)}</span>
                </div>
                <span class="deadline-tag">
                  {item.date <= now ? "passou" : item.id === nextId ? "próximo" : KIND_LABEL[item.kind]}
                </span>
              </div>
            ))}
            <p class="muted small">
              O regulamento deixa a data da competição "a definir"; no jogo ela é na semana seguinte à apresentação oral.
            </p>
          </div>
        </section>

        <section class="panel">
          <h2 class="panel-title">Como se soma</h2>
          <div class="panel-body">
            <table class="data-table">
              <tbody>
                {DISCIPLINES.map((discipline) => (
                  <tr key={discipline}>
                    <td>{DISCIPLINE_LABEL[discipline]}</td>
                    <td class="num">{REPORT_CHAPTERS[discipline]}</td>
                  </tr>
                ))}
                <tr class="row-total">
                  <td>Relatório + plantas (NR)</td>
                  <td class="num">{R.reportMax}</td>
                </tr>
                <tr>
                  <td>Apresentação oral</td>
                  <td class="num">{R.oralMax}</td>
                </tr>
                <tr class="row-total">
                  <td>Competição de Projeto</td>
                  <td class="num">{R.reportMax + R.oralMax}</td>
                </tr>
              </tbody>
            </table>
            <p class="muted small">
              Na Competição de Voo vale a melhor bateria mais o bônus de consistência (BCF). O relatório também
              multiplica o voo: veja a aba "Como é pontuado".
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

const KIND_LABEL = { info: "aviso", deadline: "prazo", event: "evento" } as const;

// ---------------------------------------------------------------------------------------------
// Como é pontuado

const DEFAULT_INPUT: BatteryInput = {
  payload: 10,
  emptyWeight: 3.4,
  predictedEmptyWeight: 3.3,
  predictedPayload: 10.5,
  reportScore: 110,
  surfaces: 2,
  span: 3,
  peakPower: 580,
  stoppedInside: true,
  unloadSeconds: 18
};

// A calculadora guarda os valores entre trocas de tela (estado da interface, não do jogo).
let savedInput = DEFAULT_INPUT;

const SURFACE_OPTIONS = [
  { value: 1, label: "N = 1", sub: "asa voadora" },
  { value: 2, label: "N = 2", sub: "convencional" },
  { value: 3, label: "N = 3", sub: "três sup." }
] as const;

function ScoringTab() {
  const [input, setInputState] = useState(savedInput);
  const [secondShare, setSecondShare] = useState(90);
  const [temperatureC, setTemperatureC] = useState(25);
  const [pressure, setPressure] = useState(945);

  const set = <K extends keyof BatteryInput>(key: K, value: BatteryInput[K]) =>
    setInputState((previous) => (savedInput = { ...previous, [key]: value }));

  const score = scoreBattery(input);
  const counted = score.ee * input.emptyWeight;
  const configuration = surfacesFactor(input.surfaces) * spanFactor(input.span);
  const secondBest = (score.total * secondShare) / 100;
  const bcf = reliabilityBonus(score.total, secondBest);
  const rho = densityAltitude(temperatureC + 273.15, pressure);
  const invalidReasons = [
    counted < R.minValidPayload ? `carga contada abaixo de ${n(R.minValidPayload, 1)} kg` : null,
    score.total <= 0 ? "pontuação da bateria não é positiva" : null
  ].filter(Boolean);

  return (
    <div class="scoring-grid">
      <section class="panel">
        <h2 class="panel-title">Calculadora de bateria</h2>
        <div class="panel-body stack-tight">
          <p class="group-label">Voo</p>
          <Slider
            label="Carga real (CP)"
            value={input.payload}
            min={0}
            max={18}
            step={0.1}
            display={`${n(input.payload, 1)} kg`}
            alert={counted < input.payload - 1e-9}
            hint={counted < input.payload - 1e-9 ? `conta só ${n(counted, 1)} kg (peso máx. ${R.maxTakeoffWeight} kg)` : undefined}
            onChange={(value) => set("payload", value)}
          />
          <Slider
            label="Peso vazio real (PV)"
            value={input.emptyWeight}
            min={1}
            max={8}
            step={0.05}
            display={`${n(input.emptyWeight, 2)} kg`}
            onChange={(value) => set("emptyWeight", value)}
          />
          <Slider
            label="Tempo de retirada"
            value={input.unloadSeconds}
            min={5}
            max={45}
            step={0.5}
            display={`${n(input.unloadSeconds, 1)} s`}
            onChange={(value) => set("unloadSeconds", value)}
          />
          <label class="check">
            <input
              type="checkbox"
              checked={input.stoppedInside}
              onChange={(event) => set("stoppedInside", event.currentTarget.checked)}
            />
            Parou dentro da pista
          </label>

          <p class="group-label">Previsões entregues em 16/ago</p>
          <Slider
            label="Peso vazio previsto"
            value={input.predictedEmptyWeight}
            min={1}
            max={8}
            step={0.05}
            display={`${n(input.predictedEmptyWeight, 2)} kg`}
            onChange={(value) => set("predictedEmptyWeight", value)}
          />
          <Slider
            label="Carga prevista (reta no Hρ do voo)"
            value={input.predictedPayload}
            min={0.5}
            max={18}
            step={0.1}
            display={`${n(input.predictedPayload, 1)} kg`}
            onChange={(value) => set("predictedPayload", value)}
          />
          <Slider
            label="Nota do relatório (NR)"
            value={input.reportScore}
            min={0}
            max={R.reportMax}
            step={1}
            display={`${input.reportScore} / ${R.reportMax}`}
            onChange={(value) => set("reportScore", value)}
          />

          <p class="group-label">Configuração</p>
          <Segmented
            label="Superfícies sustentadoras"
            value={input.surfaces}
            options={SURFACE_OPTIONS}
            onChange={(value) => set("surfaces", value)}
          />
          <Slider
            label="Envergadura medida (b)"
            value={input.span}
            min={1.5}
            max={4.3}
            step={0.01}
            display={`${n(input.span, 2)} m`}
            alert={input.span > R.maxSpan}
            onChange={(value) => set("span", value)}
          />
          <Slider
            label="Potência de pico"
            value={input.peakPower}
            min={300}
            max={700}
            step={5}
            display={`${input.peakPower} W`}
            alert={input.peakPower > R.maxPower}
            onChange={(value) => set("peakPower", value)}
          />
          <button
            type="button"
            class="btn-ghost"
            onClick={() => {
              savedInput = DEFAULT_INPUT;
              setInputState(DEFAULT_INPUT);
            }}
          >
            Restaurar exemplo
          </button>
        </div>
      </section>

      <div class="scoring-results">
        <section class={`panel score-summary${score.valid ? "" : " is-invalid"}`}>
          <div class="score-total">
            <span class="score-total-label">Bateria</span>
            <span class="score-total-value">{n(score.total, 1)}</span>
            <span class={`badge ${score.valid ? "badge-ok" : "badge-danger"}`}>
              {score.valid ? "voo válido" : "voo inválido"}
            </span>
          </div>
          <div class="score-breakdown">
            <Part label="PVOO" value={score.pvoo} />
            <Part label="PAC" value={score.pac} />
            <Part label="BPO" value={score.bpo} />
            <Part label="BRC" value={score.brc} />
            <Part label="PD" value={score.pd} penalty />
            <Part label="PP" value={score.pp} penalty />
          </div>
          {invalidReasons.length > 0 ? <p class="score-warning">Inválido: {invalidReasons.join("; ")}.</p> : null}
        </section>

        <div class="panel formula-panel">
          <div class="panel-body formula-list">
            <Formula
              title="Eficiência estrutural"
              formula="EE = CP / PV"
              value={n(score.ee, 2)}
              text="Quanto o avião carrega por quilo dele mesmo. É o coração da nota de voo: um avião leve vale tanto quanto um que carrega muito."
            />
            <Formula
              title="Pontos de eficiência"
              formula="PEE = 50 × EE"
              value={n(score.pee, 1)}
              text="Cada ponto de EE vale 50 pontos antes dos multiplicadores."
            />
            <Formula
              title="Fator de peso vazio"
              formula="FPV = 1,10 − 15 × ((PVprevisto − PVreal) / PVprevisto)²   (mínimo 0,80)"
              value={`× ${n(score.fpv, 3)}`}
              text="Premia quem conhece o próprio avião. Acertar em cheio dá ×1,10; errar 10% já cai para ×0,95."
            />
            <Formula
              title="Fator do relatório"
              formula="FPR = min(1,00 ; 0,50 + 0,75 × NR / 185)"
              value={`× ${n(score.fpr, 3)}`}
              text={`O relatório multiplica o voo. Com NR a partir de ${n((0.5 / 0.75) * R.reportMax, 0)} o fator chega ao máximo; relatório zerado corta o voo pela metade.`}
            />
            <Formula
              title="Configuração"
              formula="(0,185N² − 0,775N + 1,81) × 1,15^(−b)"
              value={`× ${n(configuration, 3)}`}
              text={`Superfícies × envergadura: ${n(surfacesFactor(input.surfaces), 2)} × ${n(spanFactor(input.span), 3)}. Asa voadora (×1,22) e três superfícies (×1,15) valem mais que a convencional; cada metro de envergadura custa 13%.`}
            />
            <Formula
              title="Pontos de voo"
              formula="PVOO = FPV × FPR × PEE × configuração"
              value={n(score.pvoo, 1)}
              text="A parte grande da bateria."
            />
            <Formula
              title="Acerto da previsão de carga"
              formula="PAC = max(0 ; 30 − 830 × |(CPprevista − CPreal) / CPprevista|^1,75)"
              value={n(score.pac, 1)}
              text="Até 30 pontos por acertar a carga que você disse que levaria. Errar 10% custa metade; errar 20% zera."
            />
            <Formula
              title="Bônus de pouso"
              formula="BPO = 2,0 × EE   (se parou dentro da pista)"
              value={n(score.bpo, 1)}
              text="Pequeno, mas vem de graça para quem pousa bem."
            />
            <Formula
              title="Bônus de retirada de carga"
              formula="BRC = 20 se t ≤ 20 s ;  max(0 ; 20 − 6,324 × √(t − 20)) se t > 20 s"
              value={n(score.brc, 1)}
              text="Treino de retirada vale pontos: o bônus despenca depois de 20 s e zera aos 30 s."
            />
            <Formula
              title="Penalidades de envergadura e potência"
              formula="PD = 100 × excesso de b (+20 se > 5 cm) ;  PP = 0,5 × excesso de potência em W"
              value={score.pd + score.pp > 0 ? `− ${n(score.pd + score.pp, 1)}` : n(0, 1)}
              tone={score.pd + score.pp > 0 ? "danger" : undefined}
              text={`Limites: b ≤ ${n(R.maxSpan, 1)} m e pico ≤ ${R.maxPower} W. Descontadas em toda bateria.`}
            />
            <Formula
              title="Bateria"
              formula="Bateria = PVOO + PAC + BPO + BRC − PD − PP"
              value={n(score.total, 1)}
              text={`Válida com carga ≥ ${n(R.minValidPayload, 1)} kg e total maior que zero.`}
            />
            <Formula
              title="Bônus de consistência"
              formula="BCF = max(0 ; 20 × [1 − (5 × (PB1 − PB2) / PB1)²])"
              value={n(bcf, 1)}
              text="Uma vez na competição: premia duas boas baterias parecidas. Abaixo de 80% da melhor, zera."
            >
              <Slider
                label="Segunda melhor bateria (PB2)"
                value={secondShare}
                min={50}
                max={100}
                step={1}
                display={`${secondShare}% de PB1 · ${n(secondBest, 1)}`}
                onChange={setSecondShare}
              />
            </Formula>
            <Formula
              title="Altitude densidade"
              formula="Hρ = (T0 / 0,0065) × [1 − ((Plocal / P0) / (Tlocal / T0))^0,234959]   T0 = 288,15 K · P0 = 1013,25 hPa"
              value={`${n(rho, 0)} m`}
              text="A altitude que o avião 'sente'. Quanto mais alta, menos carga ele levanta, e a sua reta de previsão é lida nesse ponto."
            >
              <div class="formula-inputs">
                <Slider
                  label="Temperatura"
                  value={temperatureC}
                  min={0}
                  max={40}
                  step={0.5}
                  display={`${n(temperatureC, 1)} °C`}
                  onChange={setTemperatureC}
                />
                <Slider
                  label="Pressão local"
                  value={pressure}
                  min={850}
                  max={1013}
                  step={1}
                  display={`${pressure} hPa`}
                  onChange={setPressure}
                />
              </div>
            </Formula>
          </div>
        </div>
      </div>
    </div>
  );
}

function Part({ label, value, penalty }: { label: string; value: number; penalty?: boolean }) {
  const negative = penalty && value > 0;
  return (
    <div class={`score-part${negative ? " is-negative" : ""}`}>
      <span>{label}</span>
      <strong>{negative ? `− ${n(value, 1)}` : n(value, 1)}</strong>
    </div>
  );
}

interface FormulaProps {
  title: string;
  formula: string;
  value: string;
  text: string;
  tone?: "danger";
  children?: ComponentChildren;
}

function Formula({ title, formula, value, text, tone, children }: FormulaProps) {
  return (
    <article class="formula">
      <div class="formula-head">
        <h3>{title}</h3>
        <span class={`formula-value${tone ? ` is-${tone}` : ""}`}>{value}</span>
      </div>
      <code>{formula}</code>
      <p>{text}</p>
      {children}
    </article>
  );
}
