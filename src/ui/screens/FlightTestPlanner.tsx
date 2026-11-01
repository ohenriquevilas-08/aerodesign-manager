import { useState } from "preact/hooks";
import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import {
  BALANCE,
  clockToDate,
  COMPETITION_START,
  findVenue,
  flightTestCost,
  formatDate,
  rosterMembers,
  scheduleProblem,
  TEST_VENUES,
  type FlightTestPilot,
  type GameState,
  type ScheduleFlightTestRequest
} from "../../sim";
import { CostTag } from "../components/CostTag";
import { formatNumber } from "../format";
import { useDerived } from "../hooks";
import { navigate } from "../nav";

// Agendar ensaio de voo (Fase 5, U4): local e dia, piloto e tripulação, cargas planejadas.
// O custo é o `flightTestCost` da simulação; quem recusa o agendamento é `scheduleProblem`.

const F = BALANCE.flightTests;
const n = formatNumber;
const STEPS = ["Local e dia", "Piloto e tripulação", "Cargas"] as const;

/** Dias de jogo em que o local recebe a equipe, respeitando a antecedência e a data da competição. */
function eligibleDays(today: number, venueId: string): number[] {
  const venue = findVenue(venueId);
  if (!venue) return [];
  const days: number[] = [];
  for (let day = today + venue.minLeadDays; day < today + 75 && day * 24 + F.startHour < COMPETITION_START; day++) {
    const weekday = new Date(clockToDate(day * 24)).getUTCDay();
    if ((venue.weekdays as number[]).includes(weekday)) days.push(day);
  }
  return days;
}

const pilotKey = (pilot: FlightTestPilot) => ("hired" in pilot ? "hired" : pilot.memberId);

export function FlightTestPlanner({ onClose }: { onClose: () => void }) {
  const members = useGame((state) => state.members);
  const roster = rosterMembers({ members });
  const today = useGame((state) => Math.floor(state.clock.hours / 24));
  const credits = useGame((state) => state.credits);
  const [step, setStep] = useState(0);
  const [venueId, setVenueId] = useState(TEST_VENUES[0]!.id);
  const [dayChoice, setDay] = useState<number | null>(null);
  const [pilot, setPilot] = useState<FlightTestPilot>(() => {
    const able = roster.find((member) => member.piloting >= F.minPiloting);
    return able ? { memberId: able.id } : { hired: true };
  });
  const [crew, setCrew] = useState<string[]>([]);
  const [payloads, setPayloads] = useState<number[]>([2]);
  const [filmed, setFilmed] = useState(false);

  const days = eligibleDays(today, venueId);
  const day = dayChoice !== null && days.includes(dayChoice) ? dayChoice : (days[0] ?? today);
  const venue = findVenue(venueId)!;
  const pilotId = "hired" in pilot ? null : pilot.memberId;
  const crewIds = crew.filter((id) => id !== pilotId);
  const request: ScheduleFlightTestRequest = { venueId, day, pilot, crew: crewIds, payloadPlanKg: payloads, filmed };
  const problem = useDerived((state: GameState) => scheduleProblem(state, request), [JSON.stringify(request)]);
  const cost = flightTestCost(venueId, pilot, crewIds.length);

  const toggleCrew = (id: string) => setCrew((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const setPayload = (index: number, value: number) =>
    setPayloads((current) => current.map((item, i) => (i === index ? Math.max(0, Math.round(value * 10) / 10) : item)));
  const schedule = () => {
    const before = store.getState().flightTests.length;
    store.dispatch({ type: "schedule-flight-test", ...request });
    if (store.getState().flightTests.length > before) onClose();
  };

  return (
    <section class="panel planner">
      <h2 class="panel-title">
        Agendar ensaio de voo
        <button type="button" class="btn-ghost planner-close" onClick={onClose}>
          Fechar
        </button>
      </h2>
      <div class="panel-body stack-tight">
        <ol class="planner-steps" aria-label="Passos">
          {STEPS.map((label, index) => (
            <li key={label} class={index === step ? "is-current" : index < step ? "is-done" : ""}>
              <button type="button" onClick={() => setStep(index)}>
                <span>{index + 1}</span> {label}
              </button>
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <>
            <div class="venue-list" role="radiogroup" aria-label="Local">
              {TEST_VENUES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={item.id === venueId}
                  class="venue-card"
                  onClick={() => setVenueId(item.id)}
                >
                  <strong>{item.name}</strong>
                  <span class="small muted">{item.description}</span>
                  <span class="small">
                    <span class="text-credits">◆ {n(item.cost)}</span> · antecedência {item.minLeadDays}{" "}
                    {item.minLeadDays === 1 ? "dia" : "dias"} · {item.distanceKm} km · Hρ típica {n(item.typicalDensityAltitudeM)} m
                  </span>
                </button>
              ))}
            </div>
            <label class="field">
              <span class="slider-label">Dia</span>
              <select value={day} onChange={(event) => setDay(Number(event.currentTarget.value))}>
                {days.map((value) => (
                  <option key={value} value={value}>
                    {formatDate(clockToDate(value * 24))} · {F.startHour}h
                  </option>
                ))}
              </select>
            </label>
            {days.length === 0 ? <p class="alert alert-warn">Nenhum dia disponível neste local antes da competição.</p> : null}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div class="field">
              <span class="slider-label">Piloto</span>
              <div class="pick-list" role="radiogroup" aria-label="Piloto">
                {roster.map((member) => {
                  const able = member.piloting >= F.minPiloting;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      role="radio"
                      aria-checked={pilotKey(pilot) === member.id}
                      class="pick"
                      disabled={!able}
                      title={able ? undefined : `Pilotagem ${Math.round(member.piloting)}, mínimo ${F.minPiloting}`}
                      onClick={() => setPilot({ memberId: member.id })}
                    >
                      {member.name}
                      <small>pilotagem {Math.round(member.piloting)}</small>
                    </button>
                  );
                })}
                <button type="button" role="radio" aria-checked={pilotKey(pilot) === "hired"} class="pick" onClick={() => setPilot({ hired: true })}>
                  Piloto contratado
                  <small>
                    pilotagem {F.hiredPilot} · ◆ {n(F.hiredPilotCost)} · não gera conhecimento
                  </small>
                </button>
              </div>
              {!roster.some((member) => member.piloting >= F.minPiloting) ? (
                <p class="small muted">
                  Ninguém da equipe pilota ainda.{" "}
                  <button type="button" class="link-btn" onClick={() => navigate("actions", { actionId: "pilot-training" })}>
                    Treino de pilotagem
                  </button>{" "}
                  forma um piloto.
                </p>
              ) : null}
            </div>
            <div class="field">
              <span class="slider-label">
                Tripulação ({crewIds.length}/{F.maxCrew})
              </span>
              <div class="pick-list">
                {roster
                  .filter((member) => member.id !== pilotId)
                  .map((member) => (
                    <button key={member.id} type="button" class="pick" aria-pressed={crewIds.includes(member.id)} onClick={() => toggleCrew(member.id)}>
                      {member.name}
                      <small>{crewIds.includes(member.id) ? "vai ao campo" : "fica"}</small>
                    </button>
                  ))}
              </div>
              <p class="small muted">Quem vai ao campo passa {F.crewHours} h lá e aprende com o voo.</p>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div class="field">
              <span class="slider-label">Cargas planejadas (uma decolagem por carga)</span>
              {payloads.map((kg, index) => (
                <div key={index} class="payload-row">
                  <span class="muted small">Voo {index + 1}</span>
                  <input type="number" min={0} max={20} step={0.5} value={kg} onInput={(event) => setPayload(index, Number(event.currentTarget.value))} />
                  <span class="muted small">kg</span>
                  <button type="button" class="btn-ghost" disabled={payloads.length === 1} onClick={() => setPayloads((current) => current.filter((_, i) => i !== index))}>
                    Tirar
                  </button>
                </div>
              ))}
              <button
                type="button"
                class="btn-ghost"
                disabled={payloads.length >= F.maxTakeoffs}
                onClick={() => setPayloads((current) => [...current, Math.round((current[current.length - 1]! + 1) * 10) / 10])}
              >
                Adicionar decolagem ({payloads.length}/{F.maxTakeoffs})
              </button>
              <p class="small muted">Cargas crescentes medem onde o avião deixa de levantar: cada voo vira um ponto no gráfico Hρ × carga.</p>
            </div>
            <label class="check-line">
              <input type="checkbox" checked={filmed} onChange={(event) => setFilmed(event.currentTarget.checked)} /> Filmar o voo (vale como o voo filmado do relatório)
            </label>
          </>
        ) : null}

        <div class="planner-summary">
          <span>
            {venue.name} · {formatDate(clockToDate(day * 24))}
          </span>
          <CostTag cost={cost} />
          <span class="small muted">Caixa: ◆ {n(credits)}</span>
        </div>
        {problem ? <p class="alert alert-warn">{problem}</p> : null}
        <div class="planner-actions">
          <button type="button" class="btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Voltar
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" class="btn-ghost" onClick={() => setStep(step + 1)}>
              Avançar
            </button>
          ) : null}
          <button type="button" class="btn-primary" disabled={problem !== null} onClick={schedule}>
            Agendar ensaio
          </button>
        </div>
      </div>
    </section>
  );
}
