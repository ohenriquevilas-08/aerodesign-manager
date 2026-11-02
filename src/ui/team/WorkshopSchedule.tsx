import { useState } from "preact/hooks";
import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import { canWork, type GameState, type Member } from "../../sim";
import { EnergyBar } from "../components/Energy";
import { ROLE_LABEL } from "../format";
import {
  classSlotsOf,
  SHIFTS,
  slotKey,
  slotStatus,
  suggestSchedule,
  useWorkshop,
  WEEKDAYS,
  workshopCommand,
  type SlotKey,
  type SlotStatus,
  type SuggestedSchedule,
  type WorkshopState
} from "./workshop";

// Escala da oficina (design §5.5): grade semanal 7 dias × 4 turnos. Arraste uma pessoa para o
// turno, ou selecione a pessoa e clique nos turnos para ligar e desligar.

const STATUS_REASON: Record<Exclude<SlotStatus, "free">, string> = {
  class: "Aula neste turno",
  exam: "Semana de provas: sem turno livre",
  locked: "Turno indisponível"
};

/** Nome curto para os chips: "Ana Souza" → "Ana"; "Capitão de Estruturas" → "Estruturas". */
function firstName(member: Member): string {
  const words = member.name.split(" ");
  if (words.length > 2 && ["de", "da", "do"].includes(words[1]!)) return words[words.length - 1]!;
  return words[0] ?? member.name;
}

export function WorkshopSchedule() {
  const { workshop, now } = useWorkshop();
  const members = useGame((state) => state.members).filter(canWork);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<SuggestedSchedule | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const state = store.getState();
  const byId = new Map(members.map((member) => [member.id, member]));
  const selectedMember = selected ? byId.get(selected) : undefined;

  const onCell = (slot: SlotKey) => {
    if (!selected) return;
    const on = !(workshop.schedule[slot] ?? []).includes(selected);
    workshopCommand({ type: "set-shift", memberId: selected, slot, on });
  };
  const onDrop = (slot: SlotKey) => {
    if (dragging) workshopCommand({ type: "set-shift", memberId: dragging, slot, on: true });
    setDragging(null);
  };

  const nowPeople = now.present.map((id) => byId.get(id)).filter((member): member is Member => !!member);

  return (
    <div class="workshop-grid">
      <section class="panel workshop-panel">
        <h2 class="panel-title">
          Escala da oficina <span class="panel-count">{workshop.capacity} lugares</span>
        </h2>
        <div class="panel-body stack-tight">
          <div class={`workshop-now${now.blocked ? " is-blocked" : now.open ? " is-open" : ""}`}>
            <span class="stat-label">Agora</span>
            <strong>{now.slot ? slotLabel(now.slot) : "Entre turnos"}</strong>
            <span>
              {now.blocked
                ? now.blocked
                : now.slot
                  ? nowPeople.length > 0
                    ? `Oficina ${now.open ? "aberta" : "trancada"} com ${nowPeople.map(firstName).join(", ")}.`
                    : "Ninguém escalado."
                  : "Oficina fechada."}
            </span>
          </div>
          <p class="muted small">
            {selectedMember
              ? `Clique nos turnos para escalar ou tirar ${firstName(selectedMember)}. Cinza listrado: ${firstName(selectedMember)} não pode.`
              : "Selecione alguém ao lado (ou arraste para um turno). Só tarefas de oficina dependem da escala."}
          </p>
          <table class="schedule">
            <thead>
              <tr>
                <th />
                {SHIFTS.map((shift) => (
                  <th key={shift.id} class={shift.id === "overnight" ? "is-night" : undefined}>
                    {shift.label}
                    <small>{shift.hours}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((day) => (
                <tr key={day.id}>
                  <th scope="row">{day.short}</th>
                  {SHIFTS.map((shift) => {
                    const slot = slotKey(day.id, shift.id);
                    return (
                      <ScheduleCell
                        key={slot}
                        slot={slot}
                        state={state}
                        workshop={workshop}
                        members={byId}
                        selected={selected}
                        current={now.slot === slot}
                        night={shift.id === "overnight"}
                        dropping={dragging !== null}
                        onClick={() => onCell(slot)}
                        onDrop={() => onDrop(slot)}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div class="stack scroll-col">
        <section class="panel">
          <h2 class="panel-title">Escala do capitão</h2>
          <div class="panel-body stack-tight">
            {preview ? (
              <SuggestionPreview
                preview={preview}
                members={byId}
                onAccept={() => {
                  workshopCommand({ type: "apply-suggested-schedule" });
                  setPreview(null);
                }}
                onDiscard={() => setPreview(null)}
              />
            ) : (
              <>
                <p class="muted small">O capitão monta a escala com quem está nas tarefas de oficina. Você revisa antes de valer.</p>
                <button type="button" class="btn-primary" onClick={() => setPreview(suggestSchedule(store.getState()))}>
                  Pedir sugestão
                </button>
              </>
            )}
          </div>
        </section>

        <section class="panel">
          <h2 class="panel-title">Pessoas</h2>
          <div class="panel-body stack-tight">
            {members.map((member) => {
              const shifts = Object.values(workshop.schedule).filter((ids) => ids?.includes(member.id)).length;
              const hasKey = workshop.keyHolders.includes(member.id);
              return (
                <div
                  key={member.id}
                  class={`roster-row${selected === member.id ? " is-selected" : ""}`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer?.setData("text/plain", member.id);
                    setDragging(member.id);
                  }}
                  onDragEnd={() => setDragging(null)}
                >
                  <button type="button" class="roster-pick" onClick={() => setSelected(selected === member.id ? null : member.id)}>
                    <span class="roster-chip">{member.name.charAt(0)}</span>
                    <span class="roster-name">
                      {member.name}
                      <small>
                        {ROLE_LABEL[member.role]} · {shifts} {shifts === 1 ? "turno" : "turnos"}
                      </small>
                    </span>
                    <EnergyBar member={member} showValue class="roster-energy" />
                  </button>
                  {hasKey ? (
                    <span class="key-badge" title="Tem a chave da oficina">
                      <KeyIcon /> chave
                    </span>
                  ) : (
                    <button
                      type="button"
                      class="btn-ghost key-give"
                      onClick={() => workshopCommand({ type: "grant-key", memberId: member.id })}
                    >
                      Dar chave
                    </button>
                  )}
                </div>
              );
            })}
            {selectedMember ? <ClassGrid member={selectedMember} /> : null}
          </div>
        </section>

        <NightPanel />
      </div>
    </div>
  );
}

function ScheduleCell({
  slot,
  state,
  workshop,
  members,
  selected,
  current,
  night,
  dropping,
  onClick,
  onDrop
}: {
  slot: SlotKey;
  state: GameState;
  workshop: WorkshopState;
  members: Map<string, Member>;
  selected: string | null;
  current: boolean;
  night: boolean;
  dropping: boolean;
  onClick: () => void;
  onDrop: () => void;
}) {
  const ids = workshop.schedule[slot] ?? [];
  const full = ids.length >= workshop.capacity;
  const status = selected ? slotStatus(state, selected, slot) : "free";
  const unavailable = status !== "free";
  const hasKey = ids.some((id) => workshop.keyHolders.includes(id));
  const free = [...members.keys()].filter((id) => slotStatus(state, id, slot) === "free").length;
  const reason = unavailable ? STATUS_REASON[status as Exclude<SlotStatus, "free">] : null;
  const title = [
    reason,
    ids.length > 0 ? `Escalados: ${ids.map((id) => members.get(id)?.name ?? id).join(", ")}` : null,
    ids.length > 0 && !hasKey ? "Ninguém com chave: oficina não abre" : null,
    ids.length === 1 ? "Uma pessoa só não lamina nem usa máquina" : null,
    !selected ? `${free} ${free === 1 ? "pessoa livre" : "pessoas livres"} neste turno` : null
  ]
    .filter(Boolean)
    .join(" · ");
  const classes = [
    "slot",
    night ? "is-night" : "",
    current ? "is-current" : "",
    unavailable ? `is-${status}` : "",
    selected && ids.includes(selected) ? "is-mine" : "",
    full ? "is-full" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <td
      class={classes}
      title={title || undefined}
      onClick={selected && !(unavailable && !ids.includes(selected)) ? onClick : undefined}
      onDragOver={(event) => {
        if (dropping && !full) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
    >
      <div class="slot-people">
        {ids.map((id) => {
          const member = members.get(id);
          return (
            <span key={id} class={`slot-chip${workshop.keyHolders.includes(id) ? " has-key" : ""}`}>
              {member ? firstName(member) : id}
              <button
                type="button"
                class="slot-remove"
                aria-label={`Tirar ${member?.name ?? id} do turno`}
                onClick={(event) => {
                  event.stopPropagation();
                  workshopCommand({ type: "set-shift", memberId: id, slot, on: false });
                }}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
      <span class="slot-meta">
        {unavailable && ids.length === 0 ? (
          <span class="slot-reason">{status === "class" ? "aula" : status === "exam" ? "provas" : "fechado"}</span>
        ) : (
          <span class={`slot-count${full ? " is-full" : ""}`}>
            {ids.length}/{workshop.capacity}
          </span>
        )}
        {ids.length > 0 && hasKey ? <KeyIcon /> : null}
      </span>
    </td>
  );
}

function SuggestionPreview({
  preview,
  members,
  onAccept,
  onDiscard
}: {
  preview: SuggestedSchedule;
  members: Map<string, Member>;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  const slots = Object.entries(preview.schedule).filter(([, ids]) => ids && ids.length > 0) as [SlotKey, string[]][];
  return (
    <>
      <ul class="suggestion-notes">
        {preview.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      {slots.length > 0 ? (
        <ul class="suggestion-slots">
          {slots.map(([slot, ids]) => (
            <li key={slot} class={slot.endsWith("overnight") ? "is-night" : undefined}>
              <strong>{slotLabel(slot)}</strong>
              <span>{ids.map((id) => (members.get(id) ? firstName(members.get(id)!) : id)).join(", ")}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p class="muted small">Aceitar substitui a escala atual.</p>
      <div class="confirm-row">
        <button type="button" class="btn-ghost" onClick={onDiscard}>
          Descartar
        </button>
        <button type="button" class="btn-primary" disabled={slots.length === 0} onClick={onAccept}>
          Aceitar escala
        </button>
      </div>
    </>
  );
}

function NightPanel() {
  return (
    <section class="panel night-panel">
      <h2 class="panel-title">Madrugada · 22h–3h</h2>
      <div class="panel-body stack-tight">
        <p class="small">
          O único turno em que todo mundo está livre: é onde cabem a integração e as laminações grandes. A oficina é da equipe e a chave está com vocês. Mas cobra:
        </p>
        <ul class="night-costs">
          <li>Quem vira a noite perde o turno da manhã seguinte.</li>
          <li>Motivação cai, mais ainda com madrugadas seguidas (na semana de prazo, une a equipe).</li>
          <li>Cansaço baixa a qualidade, pior depois da 1h. "Caprichado" compensa.</li>
        </ul>
      </div>
    </section>
  );
}

/** Grade de aulas de uma pessoa (seg–sex, manhã a noite). */
function ClassGrid({ member }: { member: Member }) {
  const slots = new Set(classSlotsOf(member));
  const days = WEEKDAYS.filter((day) => day.id >= 1 && day.id <= 5);
  return (
    <div class="class-grid">
      <span class="stat-label">Aulas de {firstName(member)}</span>
      <table>
        <thead>
          <tr>
            <th />
            {days.map((day) => (
              <th key={day.id}>{day.short}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SHIFTS.filter((shift) => shift.id !== "overnight").map((shift) => (
            <tr key={shift.id}>
              <th scope="row">{shift.label}</th>
              {days.map((day) => {
                const has = slots.has(slotKey(day.id, shift.id));
                return <td key={day.id} class={has ? "has-class" : undefined} title={has ? "Aula" : "Livre"} />;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function slotLabel(slot: SlotKey): string {
  const [day, shift] = slot.split("-");
  const dayLabel = WEEKDAYS.find((item) => String(item.id) === day)?.label ?? day;
  const shiftLabel = SHIFTS.find((item) => item.id === shift)?.label ?? shift;
  return `${dayLabel} · ${shiftLabel}`;
}

function KeyIcon() {
  return (
    <svg class="key-icon" width="12" height="12" viewBox="0 0 12 12" aria-label="chave">
      <circle cx="3.5" cy="6" r="2.5" />
      <path d="M6 6 H11 M9 6 V8 M10.5 6 V7.5" />
    </svg>
  );
}
