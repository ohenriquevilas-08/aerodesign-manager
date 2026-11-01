import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import { BALANCE, findAgenda, formationView, traineeProgress, type Discipline, type FormationAreaView, type Member } from "../../sim";
import { Avatar } from "../components/Avatar";
import { DISCIPLINE_SHORT, formatNumber, motivationLabel } from "../format";
import { useDerived } from "../hooks";

// Escalação da equipe (Fase 5, U1): o campo é o avião visto de cima e cada área fica na parte que
// cuida. Cartas no estilo FIFA (retrato isométrico, overall da área, nome, motivação); capitão com
// faixa. Área vazia = parte apagada, com o aviso só em tooltip. O presidente é um aluno como os outros, com faixa.
// Arrastar a carta chama set-area.

type Drop = { area: Discipline | null; captain: boolean };
type Place = { part: string; left: number; top: number; cols: number };

/** Parte do avião de cada área e onde fica o cacho de cartas (% do palco). `cols`: cartas por linha. */
const PLACES: Partial<Record<Discipline, Place>> = {
  aerodynamics: { part: "Asa", left: 38, top: 17, cols: 3 },
  loads: { part: "Longarina", left: 38, top: 83, cols: 2 },
  structures: { part: "Fuselagem", left: 65, top: 50, cols: 2 },
  electrical: { part: "Motor", left: 9, top: 50, cols: 1 },
  stability: { part: "Empenagem", left: 89, top: 22, cols: 2 },
  performance: { part: "Trem", left: 87, top: 79, cols: 2 }
};

function tier(rating: number) {
  return rating >= 60 ? "gold" : rating >= 30 ? "silver" : "bronze";
}

function motivationTone(value: number) {
  if (value >= 75) return "ok";
  if (value >= 50) return "accent";
  if (value >= 25) return "warn";
  return "danger";
}

export function Formation() {
  const view = useDerived((state) => formationView(state), []);
  const members = useGame((state) => state.members);
  const tasks = useGame((state) => state.tasks);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const byId = (id: string | null) => members.find((member) => member.id === id) ?? null;
  const dragged = byId(dragging);
  const empty = (discipline: Discipline) => view.areas.find((area) => area.discipline === discipline)?.warning != null;

  const drop = (target: Drop) => {
    setOver(null);
    setDragging(null);
    if (!dragged) return;
    store.dispatch({ type: "set-area", memberId: dragged.id, area: target.area, captain: target.area ? target.captain : undefined });
  };
  const key = (target: Drop) => `${target.area ?? "none"}:${target.captain ? "c" : "m"}`;
  const zone = (target: Drop) => ({
    "data-drop": key(target),
    onDragOver: (event: DragEvent) => {
      if (!dragging) return;
      event.preventDefault();
      setOver(key(target));
    },
    onDragLeave: () => setOver((current) => (current === key(target) ? null : current)),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      drop(target);
    }
  });
  const agendaOf = (member: Member) => (member.role === "president" ? findAgenda(member.agenda ?? "balanced").label : null);
  const cardOf = (member: Member, discipline: Discipline | null) => (
    <PlayerCard
      key={member.id}
      member={member}
      discipline={discipline}
      task={tasks.find((task) => task.id === member.taskId)?.label ?? null}
      agenda={agendaOf(member)}
      dragging={dragging === member.id}
      onDragStart={() => setDragging(member.id)}
      onDragEnd={() => {
        setDragging(null);
        setOver(null);
      }}
    />
  );

  return (
    <div class="formation">
      <p class="muted small">
        Arraste uma carta para a parte do avião que a área cuida. Trocar de área custa {BALANCE.formation.changeAreaMotivation} de
        motivação (o conhecimento fica com a pessoa); quem ainda não tem área entra de graça.
      </p>

      <div class="fm-stage">
        <AirplaneBackdrop empty={empty} />
        {view.areas.map((area) => {
          const place = PLACES[area.discipline];
          return place ? (
            <AreaCluster key={area.discipline} area={area} place={place} over={over} zone={zone} byId={byId} cardOf={cardOf} />
          ) : null;
        })}
      </div>

      {view.trainees.length > 0 ? (
        <div class="trainee-strip" data-testid="trainee-strip">
          <h3 class="pitch-col-title">Trainees · etapa de treino até 1/fev</h3>
          <div class="trainee-cards">
            {view.trainees.map((id) => {
              const member = byId(id);
              if (!member) return null;
              const progress = traineeProgress(member);
              return (
                <article key={id} class="trainee-card" title={`${member.name}: ${Math.round(progress * 100)}% do treinamento`}>
                  <Avatar member={member} size={56} />
                  <div class="trainee-info">
                    <strong>{member.name}</strong>
                    <span class="small muted">
                      {tasks.find((task) => task.id === member.taskId)?.label ?? "Sem treino agora"} · {Math.round(member.trainingHours ?? 0)} h
                    </span>
                    <span class="fm-mot" aria-hidden="true">
                      <span class="fm-mot-fill tone-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
          <p class="small muted">No fim da etapa, cada trainee vira integrante ou desiste. Só então entram na escalação.</p>
        </div>
      ) : null}

      {view.unassigned.length > 0 ? (
        <div class={`bench-strip${over === key({ area: null, captain: false }) ? " is-over" : ""}`} {...zone({ area: null, captain: false })}>
          <h3 class="pitch-col-title">Sem área</h3>
          <div class="bench-strip-cards">
            {view.unassigned.map((id) => {
              const member = byId(id);
              return member ? cardOf(member, null) : null;
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AreaCluster({
  area,
  place,
  over,
  zone,
  byId,
  cardOf
}: {
  area: FormationAreaView;
  place: Place;
  over: string | null;
  zone: (target: Drop) => Record<string, unknown>;
  byId: (id: string | null) => Member | null;
  cardOf: (member: Member, discipline: Discipline | null) => JSX.Element;
}) {
  const captain = byId(area.captainId);
  const isEmpty = area.warning !== null;
  return (
    <section
      class={`fm-area${isEmpty ? " is-empty" : ""}`}
      style={{ left: `${place.left}%`, top: `${place.top}%` }}
      title={area.warning ?? undefined}
      data-area={area.discipline}
    >
      <h3 class="fm-area-title">
        {DISCIPLINE_SHORT[area.discipline]}
        <span class="fm-area-part">{place.part}</span>
      </h3>
      <div class="fm-cards" style={{ gridTemplateColumns: `repeat(${place.cols}, var(--card-w))` }}>
        <div class={`fm-slot${over === `${area.discipline}:c` ? " is-over" : ""}`} {...zone({ area: area.discipline, captain: true })}>
          {captain ? cardOf(captain, area.discipline) : <span class="fm-hole">Capitão</span>}
        </div>
        {area.memberIds.map((id) => {
          const member = byId(id);
          return member ? (
            <div key={id} class="fm-slot">
              {cardOf(member, area.discipline)}
            </div>
          ) : null;
        })}
        {Array.from({ length: area.openSlots }, (_, i) => (
          <div
            key={`hole-${i}`}
            class={`fm-slot${over === `${area.discipline}:m` ? " is-over" : ""}`}
            {...zone({ area: area.discipline, captain: false })}
          >
            <span class="fm-hole">Vaga</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Avião de cima (nariz à esquerda, como o blueprint). Cada parte apaga quando a área não tem ninguém. */
function AirplaneBackdrop({ empty }: { empty: (discipline: Discipline) => boolean }) {
  const cls = (discipline: Discipline) => `fm-part${empty(discipline) ? " is-empty" : ""}`;
  return (
    <svg class="fm-plane" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g class={cls("aerodynamics")}>
        <title>Asa</title>
        <path d="M255 20 H500 L520 40 V560 L500 580 H255 Z" />
      </g>
      <g class={cls("structures")}>
        <title>Fuselagem</title>
        <path d="M70 300 C70 262 110 252 150 252 L820 280 L990 292 L990 308 L820 320 L150 348 C110 348 70 338 70 300 Z" />
      </g>
      <g class={cls("stability")}>
        <title>Empenagem</title>
        <path d="M840 90 H965 L975 110 V490 L965 510 H840 Z" />
      </g>
      <g class={cls("electrical")}>
        <title>Motor e hélice</title>
        <rect x="22" y="270" width="52" height="60" rx="6" />
        <line x1="12" y1="205" x2="12" y2="395" class="fm-prop" />
      </g>
      <g class={cls("loads")}>
        <title>Longarina</title>
        <line x1="330" y1="30" x2="330" y2="570" class="fm-spar" />
      </g>
      <g class={cls("performance")}>
        <title>Trem de pouso</title>
        <rect x="770" y="228" width="44" height="22" rx="5" />
        <rect x="770" y="350" width="44" height="22" rx="5" />
        <line x1="792" y1="250" x2="792" y2="280" class="fm-strut" />
        <line x1="792" y1="320" x2="792" y2="350" class="fm-strut" />
      </g>
    </svg>
  );
}

function PlayerCard({
  member,
  discipline,
  task,
  agenda,
  dragging,
  onDragStart,
  onDragEnd
}: {
  member: Member;
  discipline: Discipline | null;
  task: string | null;
  /** Rótulo da agenda do presidente; null para os demais. */
  agenda: string | null;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const rating = Math.round(discipline ? member.knowledge[discipline] : Math.max(...Object.values(member.knowledge)));
  const captain = member.role === "captain" && discipline !== null;
  return (
    <article
      class={`fm-card tier-${tier(rating)}${captain ? " is-captain" : ""}${agenda ? " is-president" : ""}${dragging ? " is-dragging" : ""}`}
      draggable
      data-member={member.id}
      title={`${member.name}${agenda ? ` · Presidente (agenda ${agenda.toLowerCase()})` : ""} · ${motivationLabel(member.motivation)} · ${task ? `em tarefa: ${task}` : "livre"}`}
      onDragStart={(event) => {
        event.dataTransfer?.setData("text/plain", member.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <span class="fm-rating">{formatNumber(rating)}</span>
      <span class="fm-pos">{discipline ? DISCIPLINE_SHORT[discipline].slice(0, 3).toUpperCase() : "—"}</span>
      <Avatar member={member} size={78} class="fm-portrait" />
      <span class="fm-name">{member.name}</span>
      <span class="fm-mot" aria-hidden="true">
        <span class={`fm-mot-fill tone-${motivationTone(member.motivation)}`} style={{ width: `${Math.round(member.motivation)}%` }} />
      </span>
      {captain ? <span class="fm-captain">C</span> : null}
      {agenda ? (
        <span class="fm-president" title={`Agenda: ${agenda}`}>
          Presidente · {agenda}
        </span>
      ) : null}
    </article>
  );
}
