import { useEffect, useState } from "preact/hooks";
import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import {
  aspectRatio,
  daysToRegulation,
  formatDate,
  REGULATION_DATE,
  regulationPublished,
  compareDesigns,
  DEFAULT_DESIGN,
  defaultTargetPayload,
  DESIGN_LIMITS,
  designProblem,
  estimateDesign,
  MASS_ITEM_LABELS,
  massBudget,
  maxPropDiameterIn,
  missionRequirements,
  powerPenalty,
  REGULAR_2026,
  spanFactor,
  spanPenalty,
  stabilityEstimate,
  surfacesFactor,
  type AircraftDesign,
  type DesignComparison,
  type DesignMaterial,
  type DesignPhilosophy,
  type DesignSnapshot,
  type Estimate,
  type GearHeight,
  type MassBudget,
  type MissionRequirement,
  type RequirementStatus,
  type WingPosition
} from "../../sim";
import { Segmented, Slider } from "../components/Controls";
import { EstimateRow } from "../components/EstimateRow";
import { formatNumber } from "../format";
import { useDerived } from "../hooks";
import { navigate } from "../nav";
import { blueprintChannel } from "../../scenes/blueprint/channel";
import { BlueprintScene } from "../../scenes/BlueprintScene";
import { PhaserStage } from "../PhaserStage";

// Prancheta (design §6.1). O projeto mora em state.aircraft.design e muda por set-design;
// antes do primeiro set-design a tela mostra DEFAULT_DESIGN.

const R = REGULAR_2026;
const n = formatNumber;
const SPAN = DESIGN_LIMITS.span;
const POWER = DESIGN_LIMITS.powerW;
const CHORD = DESIGN_LIMITS.chordM;
const TAIL = DESIGN_LIMITS.tailVolume;
const CG = DESIGN_LIMITS.cgPercentMac;
const PROP = DESIGN_LIMITS.propDiameterIn;

/** Altitudes densidade de referência para a estimativa (manhã fria → tarde quente). */
const REFERENCE_ALTITUDES = [300, 600, 900, 1200] as const;
// Sobrevive à troca de tela; não é estado do jogo.
let savedAltitude: number = 900;

const SURFACES = [
  { value: 1, label: "Asa voadora", sub: "N = 1 · ×1,22" },
  { value: 2, label: "Convencional", sub: "N = 2 · ×1,00" },
  { value: 3, label: "Três superfícies", sub: "N = 3 · ×1,15" }
] as const;

const SURFACES_TEXT: Record<AircraftDesign["surfaces"], string> = {
  1: "Pontua 22% a mais, mas é difícil de estabilizar e o compartimento de carga briga com o centro de gravidade.",
  2: "Asa e empenagem: a escolha segura, fácil de projetar e de pilotar. Multiplicador neutro.",
  3: "Canard + asa + empenagem: 15% a mais e mais área para carga, desde que a terceira superfície tenha função real."
};

const PHILOSOPHIES = [
  { value: "payload", label: "Alta carga" },
  { value: "light", label: "Leve" },
  { value: "stable", label: "Estável" }
] as const;

const PHILOSOPHY_TEXT: Record<DesignPhilosophy, string> = {
  payload: "Asa grande e estrutura reforçada para levar muito peso. EE alta se a estrutura aguentar; peso vazio sobe junto.",
  light: "Cada grama conta: a EE cresce pelo denominador. Estrutura no limite, mais sensível a dano nos ensaios.",
  stable: "Margens folgadas de estabilidade e estrutura. Menos pontos no papel, menos susto na pista."
};

const MATERIALS = [
  { value: "balsa", label: "Balsa" },
  { value: "composite", label: "Compósito" },
  { value: "mixed", label: "Misto" }
] as const;

const MATERIAL_TEXT: Record<DesignMaterial, string> = {
  balsa: "Barata e rápida de cortar. Peso vazio razoável; qualidade depende muito de quem fabrica.",
  composite: "Fibra e resina: leve e rígido, mas caro, exige molde e cura (⌛) e gente com mão de fabricação.",
  mixed: "Longarina em compósito, nervuras em balsa. Meio-termo de peso, custo e dificuldade."
};

const GEARS = [
  { value: "low", label: "Trem baixo" },
  { value: "high", label: "Trem alto" }
] as const;

const GEAR_TEXT: Record<GearHeight, string> = {
  low: "Mais leve e sem risco com a fita, mas a hélice fica perto do chão: limita o diâmetro.",
  high: "Permite hélice maior e rotação mais fácil. Altura é livre em 2026, mas se abortar a decolagem pode romper a fita."
};

interface Alert {
  tone: "danger" | "warn" | "info";
  text: string;
}

function alertsFor(draft: AircraftDesign): Alert[] {
  const alerts: Alert[] = [];
  if (draft.span > R.maxSpan) {
    alerts.push({
      tone: "danger",
      text: `Envergadura acima de ${n(R.maxSpan, 1)} m: penalidade de ${n(spanPenalty(draft.span), 0)} pontos (100 por metro, +20 passando de 5 cm) em toda bateria.`
    });
  } else if (draft.span >= R.maxSpan - 0.05) {
    alerts.push({
      tone: "danger",
      text: `Envergadura no limite de ${n(R.maxSpan, 1)} m. Um erro de fabricação vira penalidade: 100 pontos por metro de excesso, +20 se passar de 5 cm, em toda bateria.`
    });
  }
  if (draft.powerW > R.maxPower) {
    alerts.push({
      tone: "danger",
      text: `Potência acima de ${R.maxPower} W: ${n(powerPenalty(draft.powerW), 0)} pontos de penalidade por bateria (0,5 por watt).`
    });
  } else if (draft.powerW >= R.maxPower) {
    alerts.push({
      tone: "danger",
      text: `Potência no limite de ${R.maxPower} W. O wattímetro mede o pico; cada watt acima custa 0,5 ponto por bateria.`
    });
  }
  if (draft.powerW < 400) {
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

type DraftTab = "requirements" | "mass" | "compare";
// Sobrevivem à troca de tela; não são estado do jogo.
let savedDraft: AircraftDesign | null = null;
let savedTab: DraftTab = "requirements";
let savedTarget: number | null = null;

const WING_POSITIONS = [
  { value: "high", label: "Asa alta" },
  { value: "low", label: "Asa baixa" }
] as const;

const WING_POSITION_TEXT: Record<WingPosition, string> = {
  high: "Estabilidade lateral de graça (efeito pêndulo). A corrida é um pouco mais longa: sem efeito solo.",
  low: "Efeito solo ajuda a decolar, mas a estabilidade lateral é menor e o trem fica mais exposto."
};

const STATUS_LABEL: Record<RequirementStatus, string> = { ok: "OK", risk: "Risco", fail: "Falha" };
const draftKey = (design: AircraftDesign) => JSON.stringify(design);
const unitDigits = (unit: string) => (unit === "kg" ? 2 : unit === "W" ? 0 : 1);

export function Drafting() {
  const published = useGame((state) => regulationPublished(state));
  const daysLeft = useGame((state) => daysToRegulation(state));
  const saved = useGame((state) => state.aircraft?.design ?? null);
  const [draft, setDraftState] = useState<AircraftDesign>(() => savedDraft ?? saved ?? DEFAULT_DESIGN);
  const [tab, setTabState] = useState(savedTab);
  const [target, setTargetState] = useState(savedTarget);
  const [altitude, setAltitudeState] = useState(savedAltitude);
  const savedKey = saved ? draftKey(saved) : null;
  const dirty = savedKey === null || savedKey !== draftKey(draft);
  const problem = designProblem(draft);

  const setDraft = (next: AircraftDesign) => setDraftState((savedDraft = next));
  const setTab = (value: DraftTab) => setTabState((savedTab = value));
  const setTarget = (value: number | null) => setTargetState((savedTarget = value));
  const setAltitude = (value: number) => {
    savedAltitude = value;
    setAltitudeState(value);
  };
  const set = <K extends keyof AircraftDesign>(key: K, value: AircraftDesign[K]) => {
    const next = { ...draft, [key]: value };
    // O trem limita a hélice: trocar para trem baixo encolhe a hélice em vez de deixar o projeto inválido.
    next.propDiameterIn = Math.min(next.propDiameterIn, maxPropDiameterIn(next.gear));
    setDraft(next);
  };
  const commit = () => store.dispatch({ type: "set-design", design: draft });
  const discard = () => setDraft(saved ?? DEFAULT_DESIGN);

  // O rascunho ainda não é estado do jogo: a cena do blueprint recebe o projeto por este canal;
  // na aba Comparar, o gravado aparece em traço apagado por baixo.
  const key = draftKey(draft);
  useEffect(() => {
    blueprintChannel.show(draft);
  }, [key]);
  useEffect(() => {
    blueprintChannel.compare(tab === "compare" && saved ? saved : null);
    return () => blueprintChannel.compare(null);
  }, [tab, savedKey]);

  const analysis = useDerived(
    (state) => {
      const defaultTarget = defaultTargetPayload(state, draft, altitude);
      const payload = target ?? defaultTarget;
      return {
        defaultTarget,
        estimate: estimateDesign(state, draft, altitude),
        requirements: missionRequirements(state, draft, altitude, payload),
        mass: massBudget(draft, state),
        stability: stabilityEstimate(draft, state),
        comparison: saved ? compareDesigns(state, saved, draft, altitude, payload) : null
      };
    },
    [key, altitude, target, savedKey]
  );
  const payload = target ?? analysis.defaultTarget;

  const sf = surfacesFactor(draft.surfaces);
  const bf = spanFactor(draft.span);
  const multiplier = sf * bf;
  // Melhor caso de FPV (1,10) e FPR (1,00): pontos de voo por ponto de EE.
  const perEE = 50 * 1.1 * multiplier;
  const alerts = alertsFor(draft);
  const maxProp = maxPropDiameterIn(draft.gear);

  // Fase 6 (U4): antes de 9/fev o regulamento não saiu e a Prancheta fica travada.
  if (!published) {
    return (
      <div class="screen">
        <header class="screen-head">
          <h1 class="screen-title">Prancheta</h1>
        </header>
        <section class="panel locked-panel" data-testid="drafting-locked">
          <div class="locked-icon" aria-hidden="true">🔒</div>
          <h2 class="locked-title">Aguardando regulamento (9/fev)</h2>
          <p class="muted">
            O regulamento 2026 sai em {formatDate(REGULATION_DATE)}, daqui a {daysLeft} {daysLeft === 1 ? "dia" : "dias"}. Sem as regras não há
            projeto para fechar. Até lá a equipe estuda, faz a seletiva e o treino dos trainees, capta recursos e compra material.
          </p>
          <div class="locked-actions">
            <button type="button" class="btn-primary" onClick={() => navigate("actions")}>
              Ver ações
            </button>
            <button type="button" class="btn-ghost" onClick={() => navigate("calendar")}>
              Abrir calendário
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div class="screen">
      <header class="screen-head">
        <h1 class="screen-title">Prancheta</h1>
        <span class="muted">
          {!saved
            ? "Ainda sem projeto: grave para a equipe passar a trabalhar nele."
            : dirty
              ? "Rascunho com mudanças: o avião da equipe continua no projeto gravado."
              : "Projeto gravado: é o avião da equipe."}
        </span>
        <div class="draft-actions">
          <button type="button" class="btn-ghost" disabled={!dirty} onClick={discard}>
            Descartar
          </button>
          <button type="button" class="btn-primary" disabled={!dirty || problem !== null} title={problem ?? undefined} onClick={commit}>
            Gravar projeto
          </button>
        </div>
      </header>
      <div class="drafting-grid">
        <section class="panel">
          <h2 class="panel-title">Decisões de projeto</h2>
          <div class="panel-body drafting-controls">
            <h3 class="decision-group">Asa</h3>
            <div class="decision">
              <Slider
                label="Envergadura (b)"
                value={draft.span}
                min={SPAN.min}
                max={SPAN.max}
                step={0.05}
                display={`${n(draft.span, 2)} m`}
                alert={draft.span >= R.maxSpan - 0.05}
                onChange={(value) => set("span", Math.round(value * 100) / 100)}
              />
              <p class="decision-text">
                Mais envergadura = mais sustentação e carga. A nota de voo é multiplicada por 1,15^(−b): aqui ×{n(bf, 3)}.
                Acima de {n(R.maxSpan, 1)} m, penalidade em toda bateria.
              </p>
            </div>
            <div class="decision">
              <Slider
                label="Corda média"
                value={draft.chordM}
                min={CHORD.min}
                max={CHORD.max}
                step={0.01}
                display={`${n(draft.chordM, 2)} m · AR ${n(aspectRatio(draft), 1)}`}
                onChange={(value) => set("chordM", Math.round(value * 100) / 100)}
              />
              <p class="decision-text">Corda grande dá área e carga; alongamento alto (asa fina e comprida) rende mais por área, mas pesa na estrutura.</p>
            </div>
            <div class="decision">
              <Segmented label="Posição da asa" value={draft.wingPosition} options={WING_POSITIONS} onChange={(value) => set("wingPosition", value)} />
              <p class="decision-text">{WING_POSITION_TEXT[draft.wingPosition]}</p>
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

            <h3 class="decision-group">Estrutura</h3>
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

            <h3 class="decision-group">Empenagem e estabilidade</h3>
            <div class="decision">
              <Slider
                label="Volume de cauda (VH)"
                value={draft.tailVolume}
                min={TAIL.min}
                max={TAIL.max}
                step={0.01}
                display={n(draft.tailVolume, 2)}
                onChange={(value) => set("tailVolume", Math.round(value * 100) / 100)}
              />
              <p class="decision-text">
                {draft.surfaces === 1
                  ? "Asa voadora não tem cauda horizontal: o volume de cauda não muda nada."
                  : "Cauda maior empurra o ponto neutro para trás (mais estável) e pesa mais."}
              </p>
            </div>
            <div class="decision">
              <Slider
                label="Posição do CG"
                value={draft.cgPercentMac}
                min={CG.min}
                max={CG.max}
                step={0.5}
                display={`${n(draft.cgPercentMac, 1)} % CMA`}
                onChange={(value) => set("cgPercentMac", value)}
              />
              <p class="decision-text">
                Margem estática = ponto neutro − CG. Entre 5 e 20 % é o confortável; negativa é instável. CG avançado = mais estável,
                mas pede mais cauda e piora a rotação.
              </p>
            </div>

            <h3 class="decision-group">Propulsão</h3>
            <div class="decision">
              <Slider
                label="Potência (P)"
                value={draft.powerW}
                min={POWER.min}
                max={POWER.max}
                step={10}
                display={`${draft.powerW} W`}
                alert={draft.powerW >= R.maxPower}
                onChange={(value) => set("powerW", value)}
              />
              <p class="decision-text">
                Mais potência decola antes dos {R.obstacleDistance} m com mais carga, mas pede bateria e motor mais pesados.
                Acima de {R.maxPower} W, penalidade por watt.
              </p>
            </div>
            <div class="decision">
              <Slider
                label="Diâmetro da hélice"
                value={draft.propDiameterIn}
                min={PROP.min}
                max={maxProp}
                step={0.5}
                display={`${n(draft.propDiameterIn, 1)} pol.`}
                hint={`Máximo ${maxProp} pol. com este trem`}
                onChange={(value) => set("propDiameterIn", value)}
              />
            </div>

            <h3 class="decision-group">Trem de pouso</h3>
            <div class="decision">
              <Segmented label="Altura do trem" value={draft.gear} options={GEARS} onChange={(value) => set("gear", value)} />
              <p class="decision-text">{GEAR_TEXT[draft.gear]}</p>
            </div>
          </div>
        </section>

        <section class="panel blueprint-panel">
          <h2 class="panel-title">Blueprint</h2>
          <PhaserStage scene={BlueprintScene} sceneKey="blueprint" />
        </section>

        <div class="stack scroll-col">
          <section class="panel">
            <div class="tabs draft-tabs" role="tablist" aria-label="Análise do projeto">
              {(
                [
                  ["requirements", "Requisitos"],
                  ["mass", "Massa"],
                  ["compare", "Comparar"]
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div class="panel-body stack-tight">
              {tab === "requirements" ? (
                <RequirementsTab
                  requirements={analysis.requirements}
                  payload={payload}
                  isDefault={target === null}
                  onPayload={setTarget}
                  altitude={altitude}
                  onAltitude={setAltitude}
                />
              ) : null}
              {tab === "mass" ? <MassTab mass={analysis.mass} /> : null}
              {tab === "compare" ? <CompareTab comparison={analysis.comparison} dirty={dirty} /> : null}
            </div>
          </section>
          <section class="panel">
            <h2 class="panel-title">Estimativa de desempenho</h2>
            <div class="panel-body stack-tight">
              <EstimateRow label="Peso vazio" value={analysis.estimate.emptyWeightKg} unit="kg" digits={2} />
              <EstimateRow label="Carga máxima" value={analysis.estimate.maxPayloadKg} unit="kg" digits={1} />
              <EstimateRow label="Eficiência estrutural" value={analysis.estimate.structuralEfficiency} digits={2} />
              <EstimateRow label="Corrida de decolagem" value={analysis.estimate.takeoffDistanceM} unit="m" digits={0} />
              <p class="muted small">
                É o que a equipe acha do rascunho, não o avião real: o real costuma cair dentro da margem. Ensaios e conhecimento
                encolhem a faixa. Obstáculo aos {R.obstacleDistance} m.
              </p>
            </div>
          </section>
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
              {problem ? <p class="alert alert-danger">{problem}</p> : null}
              {alerts.length === 0 && !problem ? <p class="muted">Nenhum alerta para esta configuração.</p> : null}
              {alerts.map((alert) => (
                <p key={alert.text} class={`alert alert-${alert.tone}`}>
                  {alert.text}
                </p>
              ))}
            </div>
          </section>
          <button type="button" class="btn-ghost" onClick={() => setDraft(DEFAULT_DESIGN)}>
            Restaurar projeto padrão (rascunho)
          </button>
        </div>
      </div>
    </div>
  );
}

function RequirementsTab({
  requirements,
  payload,
  isDefault,
  onPayload,
  altitude,
  onAltitude
}: {
  requirements: MissionRequirement[];
  payload: number;
  isDefault: boolean;
  onPayload: (value: number | null) => void;
  altitude: number;
  onAltitude: (value: number) => void;
}) {
  return (
    <>
      <Segmented
        label="Altitude densidade de referência (Hρ)"
        value={altitude}
        options={REFERENCE_ALTITUDES.map((value) => ({ value, label: `${n(value)} m` }))}
        onChange={onAltitude}
      />
      <Slider
        label="Carga-alvo"
        value={payload}
        min={0}
        max={12}
        step={0.1}
        display={`${n(payload, 1)} kg`}
        hint={
          isDefault ? (
            "Sugestão da equipe: a previsão do relatório ou a carga máxima estimada."
          ) : (
            <button type="button" class="link-btn" onClick={() => onPayload(null)}>
              Voltar à sugestão da equipe
            </button>
          )
        }
        onChange={(value) => onPayload(Math.round(value * 10) / 10)}
      />
      <ul class="req-list">
        {requirements.map((req) => (
          <li key={req.id} class={`req req-${req.status}`}>
            <span class="req-status">{STATUS_LABEL[req.status]}</span>
            <span class="req-label">{req.label}</span>
            <span class="req-value">
              {n(req.value.value, unitDigits(req.unit))}
              <span class="estimate-margin">
                {" "}
                ± {n(req.value.margin, unitDigits(req.unit))} {req.unit}
              </span>
            </span>
            <span class="req-target">alvo {req.target}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function MassTab({ mass }: { mass: MassBudget }) {
  const biggest = Math.max(...mass.items.map((item) => item.kg.value), 0.01);
  return (
    <>
      <ul class="mass-list">
        {mass.items.map((item) => (
          <li key={item.id}>
            <span class="mass-label">{MASS_ITEM_LABELS[item.id] ?? item.label}</span>
            <span class="mass-bar" aria-hidden="true">
              <span class="mass-fill" style={{ width: `${(item.kg.value / biggest) * 100}%` }} />
            </span>
            <span class="mass-value">
              {n(item.kg.value, 2)}
              <span class="estimate-margin"> ± {n(item.kg.margin, 2)}</span>
            </span>
          </li>
        ))}
      </ul>
      <div class="mass-total">
        <span>Peso vazio</span>
        <strong>
          {n(mass.total.value, 2)} kg<span class="estimate-margin"> ± {n(mass.total.margin, 2)}</span>
        </strong>
      </div>
      <p class="muted small">
        A soma dos subsistemas é o peso vazio da estimativa. Filosofia, material e potência mexem nas barras; a margem encolhe com
        conhecimento e pesagem.
      </p>
    </>
  );
}

function CompareTab({ comparison, dirty }: { comparison: DesignComparison | null; dirty: boolean }) {
  if (!comparison) return <p class="muted">Grave um projeto primeiro: a comparação é entre o gravado e o rascunho.</p>;
  const { a, b } = comparison;
  const ok = (snap: DesignSnapshot) => snap.requirements.filter((req) => req.status === "ok").length;
  const total = a.requirements.length;
  const est = (value: Estimate, digits: number) => `${n(value.value, digits)} ± ${n(value.margin, digits)}`;
  const rows: { label: string; a: string; b: string; delta: number | null; digits: number; better: "up" | "down" }[] = [
    { label: "Nota de voo estimada", a: est(a.flightScore, 0), b: est(b.flightScore, 0), delta: b.flightScore.value - a.flightScore.value, digits: 0, better: "up" },
    { label: "Carga máxima (kg)", a: est(a.maxPayloadKg, 1), b: est(b.maxPayloadKg, 1), delta: b.maxPayloadKg.value - a.maxPayloadKg.value, digits: 1, better: "up" },
    { label: "Peso vazio (kg)", a: est(a.mass.total, 2), b: est(b.mass.total, 2), delta: b.mass.total.value - a.mass.total.value, digits: 2, better: "down" },
    {
      label: "Margem estática (% CMA)",
      a: est(a.stability.staticMarginPercentMac, 1),
      b: est(b.stability.staticMarginPercentMac, 1),
      delta: null,
      digits: 1,
      better: "up"
    },
    { label: "Multiplicador", a: `× ${n(a.multiplier, 3)}`, b: `× ${n(b.multiplier, 3)}`, delta: b.multiplier - a.multiplier, digits: 3, better: "up" },
    { label: "Requisitos OK", a: `${ok(a)}/${total}`, b: `${ok(b)}/${total}`, delta: ok(b) - ok(a), digits: 0, better: "up" }
  ];
  return (
    <>
      <p class="muted small">
        Mesma Hρ ({n(comparison.densityAltitudeM)} m) e mesma carga-alvo ({n(comparison.targetPayloadKg, 1)} kg). O gravado aparece em
        traço apagado no blueprint.
      </p>
      {!dirty ? <p class="muted small">O rascunho é igual ao gravado: mude alguma decisão para ver a diferença.</p> : null}
      <table class="compare-table">
        <thead>
          <tr>
            <th />
            <th>Gravado</th>
            <th>Rascunho</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const changed = row.delta !== null && Math.abs(row.delta) >= 10 ** -row.digits / 2;
            const tone = changed ? ((row.delta! > 0) === (row.better === "up") ? " is-better" : " is-worse") : "";
            return (
              <tr key={row.label}>
                <th>{row.label}</th>
                <td>{row.a}</td>
                <td class={`compare-draft${tone}`}>{row.b}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

// Multiplicador × envergadura para N = 1, 2 e 3, com a configuração atual marcada.
const CHART = { width: 340, height: 150, pad: 28, yMin: 0.5, yMax: 1.0 };

function MultiplierChart({ span, surfaces }: { span: number; surfaces: number }) {
  const { width, height, pad, yMin, yMax } = CHART;
  const x = (b: number) => pad + ((b - SPAN.min) / (SPAN.max - SPAN.min)) * (width - pad - 8);
  const y = (m: number) => 8 + (1 - (m - yMin) / (yMax - yMin)) * (height - pad - 8);
  const spans = Array.from({ length: 26 }, (_, i) => SPAN.min + (i * (SPAN.max - SPAN.min)) / 25);
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
      {[1.5, 2, 2.5, 3, 3.5, 4, 4.5].map((b) => (
        <text key={b} class="chart-label" x={x(b)} y={height - 8} text-anchor="middle">
          {n(b, 1)} m
        </text>
      ))}
      {[1, 2, 3].map((count) => (
        <g key={count}>
          <polyline class={`chart-line${count === surfaces ? " is-active" : ""}`} points={line(count)} />
          <text class="chart-label" x={x(SPAN.min) + 4} y={y(Math.min(yMax, surfacesFactor(count) * spanFactor(SPAN.min))) - 4}>
            N={count}
          </text>
        </g>
      ))}
      <circle class="chart-dot" cx={x(span)} cy={y(Math.min(yMax, current))} r={5} />
    </svg>
  );
}
