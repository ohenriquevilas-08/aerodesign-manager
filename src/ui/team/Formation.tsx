import { useState } from "preact/hooks";
import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import { BALANCE, formationView, type Discipline, type Member } from "../../sim";
import { DISCIPLINE_SHORT, formatNumber, motivationLabel } from "../format";
import { useDerived } from "../hooks";

// Escalação da equipe (U1): uma coluna por área, capitão no topo e membros embaixo, como a
// escalação do FIFA. Sem banco: quem chega da seletiva fica em "Sem área" até ser posto numa.
// O presidente (você) fica no cabeçalho, fora do campo. Arrastar a carta chama set-area.

type Drop = { area: Discipline | null; captain: boolean };

export function Formation() {
  const view = useDerived((state) => formationView(state), []);
  const members = useGame((state) => state.members);
  const tasks = useGame((state) => state.tasks);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const byId = (id: string | null) => members.find((member) => member.id === id) ?? null;
  const president = byId(view.presidentId);
  const dragged = byId(dragging);

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
  const cardOf = (member: Member, discipline: Discipline | null) => (
    <PlayerCard
      key={member.id}
      member={member}
      discipline={discipline}
      task={tasks.find((task) => task.id === member.taskId)?.label ?? null}
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
      <div class="formation-top">
        {president ? (
          <div class="formation-president">
            <span class="avatar" aria-hidden="true">
              {president.name.charAt(0)}
            </span>
            <div>
              <div class="member-name">{president.name}</div>
              <div class="member-role">Presidente · coordena, fica fora do campo</div>
            </div>
          </div>
        ) : null}
        <p class="muted small">
          Arraste uma carta para a vaga de uma área. Trocar de área custa {BALANCE.formation.changeAreaMotivation} de
          motivação (o conhecimento fica com a pessoa); quem ainda não tem área entra de graça.
        </p>
      </div>

      <div class="pitch">
        {view.areas.map((area) => {
          const captain = byId(area.captainId);
          const captainZone = { area: area.discipline, captain: true };
          const memberZone = { area: area.discipline, captain: false };
          return (
            <section key={area.discipline} class={`pitch-col${area.warning ? " is-empty" : ""}`}>
              <h3 class="pitch-col-title">{DISCIPLINE_SHORT[area.discipline]}</h3>
              <div class={`slot slot-captain${over === key(captainZone) ? " is-over" : ""}`} {...zone(captainZone)}>
                <span class="slot-tag">Capitão</span>
                {captain ? cardOf(captain, area.discipline) : <span class="slot-hole">Vaga de capitão</span>}
              </div>
              <div class={`slot-members${over === key(memberZone) ? " is-over" : ""}`} {...zone(memberZone)}>
                {area.memberIds.map((id) => {
                  const member = byId(id);
                  return member ? cardOf(member, area.discipline) : null;
                })}
                {Array.from({ length: area.openSlots }, (_, i) => (
                  <div key={i} class="slot-hole">
                    Vaga
                  </div>
                ))}
              </div>
              {area.warning ? <p class="pitch-warning">⚠ {area.warning}</p> : null}
            </section>
          );
        })}
      </div>

      <div class={`bench-strip${over === key({ area: null, captain: false }) ? " is-over" : ""}`} {...zone({ area: null, captain: false })}>
        <h3 class="pitch-col-title">Sem área</h3>
        <div class="bench-strip-cards">
          {view.unassigned.length === 0 ? (
            <span class="muted small">Todo mundo tem área. Novatos da seletiva chegam aqui.</span>
          ) : (
            view.unassigned.map((id) => {
              const member = byId(id);
              return member ? cardOf(member, null) : null;
            })
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerCard({
  member,
  discipline,
  task,
  dragging,
  onDragStart,
  onDragEnd
}: {
  member: Member;
  discipline: Discipline | null;
  task: string | null;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const rating = discipline ? member.knowledge[discipline] : Math.max(...Object.values(member.knowledge));
  return (
    <article
      class={`player${dragging ? " is-dragging" : ""}`}
      draggable
      data-member={member.id}
      onDragStart={(event) => {
        event.dataTransfer?.setData("text/plain", member.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <span class="player-rating" title={discipline ? "Conhecimento na área" : "Melhor conhecimento"}>
        {formatNumber(rating)}
      </span>
      <span class="player-name">{member.name}</span>
      <span class="player-meta">
        {motivationLabel(member.motivation)} · {task ? "em tarefa" : "livre"}
      </span>
    </article>
  );
}
