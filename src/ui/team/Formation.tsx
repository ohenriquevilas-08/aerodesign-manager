import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import { BALANCE, findAgenda, formationView, traineeProgress, type Discipline, type FormationAreaView, type Member } from "../../sim";
import { EnergyBar, energyTitle } from "../components/Energy";
import { PixelAvatar } from "../components/PixelAvatar";
import { DISCIPLINE_SHORT, formatNumber, likesText, motivationLabel } from "../format";
import { useDerived } from "../hooks";

// Escalação da equipe (Fase 5, U1; Fase 8, U3): o campo é o avião visto de cima e cada área fica na
// parte que cuida. Cartas no estilo FIFA (retrato isométrico, overall da área, nome, motivação e
// energia); capitão com faixa. Área vazia = parte apagada, com o aviso só em tooltip. O campo tem
// tamanho fixo no desenho e escala para caber na área visível, sem rolagem. Para pôr alguém numa vaga:
// arrastar a carta, clicar na carta e depois na vaga, ou clicar na vaga e escolher numa lista
// (Tab e Enter funcionam; Esc cancela). Tudo chama set-area.

type Drop = { area: Discipline | null; captain: boolean };
type Place = { part: string; left: number; top: number; cols: number };

/** Tamanho do campo no desenho; o conjunto escala para caber na área visível. */
const STAGE_W = 1000;
const STAGE_H = 560;

/** Parte do avião de cada área e onde fica o cacho de cartas (% do palco). `cols`: cartas por linha. */
const PLACES: Partial<Record<Discipline, Place>> = {
  aerodynamics: { part: "Asa", left: 40, top: 19, cols: 3 },
  loads: { part: "Longarina", left: 40, top: 85, cols: 2 },
  structures: { part: "Fuselagem", left: 66, top: 52, cols: 2 },
  electrical: { part: "Motor", left: 11, top: 45, cols: 2 },
  stability: { part: "Empenagem", left: 89, top: 22, cols: 2 },
  performance: { part: "Trem", left: 88, top: 80, cols: 2 }
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

const sameTarget = (a: Drop, b: Drop) => a.area === b.area && a.captain === b.captain;
const targetLabel = (target: Drop) => `${target.captain ? "Capitão de" : "Vaga em"} ${target.area ? DISCIPLINE_SHORT[target.area] : "nenhuma área"}`;

/** Escala do campo: o maior que cabe na área visível, sem passar de 1,15. */
function useFitScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.8);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setScale(Math.max(0.4, Math.min(1.15, node.clientWidth / STAGE_W, node.clientHeight / STAGE_H)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, scale };
}

function chipTitle(member: Member, agenda: string | null, task?: string | null): string {
  return `${member.name}${agenda ? ` · Presidente (prioridade: ${agenda.toLowerCase()})` : ""} · ${motivationLabel(member.motivation)} · ${energyTitle(member)} · ${likesText(member)}${task ? ` · em tarefa: ${task}` : ""}`;
}

export function Formation() {
  const view = useDerived((state) => formationView(state), []);
  const members = useGame((state) => state.members);
  const tasks = useGame((state) => state.tasks);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // Clicar na carta e depois na vaga (ou na vaga e escolher numa lista): alternativa ao arrastar.
  const [picked, setPicked] = useState<string | null>(null);
  const [listFor, setListFor] = useState<Drop | null>(null);
  const { ref: wrapRef, scale } = useFitScale();
  const byId = (id: string | null) => members.find((member) => member.id === id) ?? null;
  const dragged = byId(dragging);
  const pickedMember = byId(picked);
  const empty = (discipline: Discipline) => view.areas.find((area) => area.discipline === discipline)?.warning != null;

  const place = (memberId: string, target: Drop) => {
    store.dispatch({ type: "set-area", memberId, area: target.area, captain: target.area ? target.captain : undefined });
  };
  const drop = (target: Drop) => {
    setOver(null);
    setDragging(null);
    if (dragged) place(dragged.id, target);
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

  /** Clique numa vaga: com carta escolhida, põe ela ali; sem carta, abre a lista (vaga livre) ou escolhe a carta (vaga ocupada). */
  const activate = (target: Drop, occupant: Member | null) => {
    if (pickedMember) {
      if (occupant?.id === pickedMember.id) setPicked(null);
      else {
        place(pickedMember.id, target);
        setPicked(null);
      }
      setListFor(null);
      return;
    }
    if (occupant) {
      setPicked(occupant.id);
      setListFor(null);
    } else setListFor(listFor && sameTarget(listFor, target) ? null : target);
  };
  const choose = (memberId: string, target: Drop) => {
    place(memberId, target);
    setListFor(null);
  };
  const cancel = () => {
    setPicked(null);
    setListFor(null);
  };

  const agendaOf = (member: Member) => (member.role === "president" ? findAgenda(member.agenda ?? "balanced").label : null);
  const cardOf = (member: Member, discipline: Discipline | null) => (
    <PlayerCard
      key={member.id}
      member={member}
      discipline={discipline}
      task={tasks.find((task) => task.id === member.taskId)?.label ?? null}
      agenda={agendaOf(member)}
      dragging={dragging === member.id}
      selected={picked === member.id}
      onDragStart={() => setDragging(member.id)}
      onDragEnd={() => {
        setDragging(null);
        setOver(null);
      }}
    />
  );
  const benchTarget: Drop = { area: null, captain: false };
  const pickFromBench = (id: string) => {
    setPicked(picked === id ? null : id);
    setListFor(null);
  };

  return (
    <div class="formation" onKeyDown={(event) => event.key === "Escape" && cancel()}>
      <p class={`muted small fm-help${pickedMember ? " is-picking" : ""}`} aria-live="polite">
        {pickedMember ? (
          <>
            <strong>{pickedMember.name}</strong> escolhido(a): clique numa vaga para pôr a pessoa lá (Esc cancela).
          </>
        ) : (
          <>
            Arraste a carta para a parte do avião, ou clique na carta e depois na vaga (Tab e Enter também). Trocar de área custa{" "}
            {BALANCE.formation.changeAreaMotivation} de motivação; quem não tem área entra de graça.
          </>
        )}
      </p>

      <div class="fm-fit" ref={wrapRef}>
        <div class="fm-sizer" style={{ width: `${STAGE_W * scale}px`, height: `${STAGE_H * scale}px` }}>
          <div class="fm-stage" style={{ width: `${STAGE_W}px`, height: `${STAGE_H}px`, transform: `scale(${scale})` }}>
            <AirplaneBackdrop empty={empty} />
            {view.areas.map((area) => {
              const spot = PLACES[area.discipline];
              return spot ? (
                <AreaCluster
                  key={area.discipline}
                  area={area}
                  place={spot}
                  over={over}
                  zone={zone}
                  byId={byId}
                  cardOf={cardOf}
                  picking={pickedMember !== null}
                  listFor={listFor}
                  candidates={members.filter((member) => member.role !== "trainee")}
                  onActivate={activate}
                  onChoose={choose}
                />
              ) : null;
            })}

            {view.trainees.length > 0 ? (
              <div class="fm-corner fm-trainees" data-testid="trainee-strip" title="No fim da etapa (1/fev), cada trainee vira integrante ou desiste. Só então entram na escalação.">
                <h3 class="fm-corner-title">Trainees · treino até 1/fev</h3>
                <div class="fm-corner-chips">
                  {view.trainees.map((id) => {
                    const member = byId(id);
                    if (!member) return null;
                    return (
                      <span key={id} class="fm-chip" title={`${member.name}: ${Math.round(traineeProgress(member) * 100)}% do treinamento`}>
                        <PixelAvatar member={member} scale={1} />
                        <span>{member.name.split(" ")[0]}</span>
                        <EnergyBar member={member} />
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div
              class={`fm-corner fm-bench${over === key(benchTarget) ? " is-over" : ""}${pickedMember ? " is-target" : ""}`}
              {...zone(benchTarget)}
              onClick={() => {
                if (!pickedMember) return;
                place(pickedMember.id, benchTarget);
                setPicked(null);
              }}
            >
              <h3 class="fm-corner-title">Sem área</h3>
              <div class="fm-corner-chips">
                {view.unassigned.length === 0 ? <span class="muted small">Todos escalados.</span> : null}
                {view.unassigned.map((id) => {
                  const member = byId(id);
                  if (!member) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      class={`fm-chip${picked === id ? " is-picked" : ""}`}
                      draggable
                      data-member={id}
                      title={chipTitle(member, agendaOf(member))}
                      onDragStart={() => setDragging(id)}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        pickFromBench(id);
                      }}
                    >
                      <PixelAvatar member={member} scale={1} />
                      <span>{member.name.split(" ")[0]}</span>
                      <EnergyBar member={member} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AreaCluster({
  area,
  place,
  over,
  zone,
  byId,
  cardOf,
  picking,
  listFor,
  candidates,
  onActivate,
  onChoose
}: {
  area: FormationAreaView;
  place: Place;
  over: string | null;
  zone: (target: Drop) => Record<string, unknown>;
  byId: (id: string | null) => Member | null;
  cardOf: (member: Member, discipline: Discipline | null) => JSX.Element;
  picking: boolean;
  listFor: Drop | null;
  candidates: Member[];
  onActivate: (target: Drop, occupant: Member | null) => void;
  onChoose: (memberId: string, target: Drop) => void;
}) {
  const captain = byId(area.captainId);
  const isEmpty = area.warning !== null;
  const slot = (target: Drop, occupant: Member | null, k: string, hole: string) => {
    const hovered = over === `${area.discipline}:${target.captain ? "c" : "m"}`;
    const listing = listFor !== null && sameTarget(listFor, target) && listFor.area === area.discipline;
    return (
      <div
        key={k}
        class={`fm-slot${hovered ? " is-over" : ""}${picking ? " is-target" : ""}${listing ? " is-listing" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={occupant ? `${occupant.name}, ${targetLabel(target)}` : `${targetLabel(target)}, livre`}
        {...zone(target)}
        onClick={() => onActivate(target, occupant)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onActivate(target, occupant);
          }
        }}
      >
        {occupant ? cardOf(occupant, area.discipline) : <span class="fm-hole">{hole}</span>}
        {listing ? (
          <ul class={`fm-picker${place.top > 55 ? " is-up" : ""}`} role="listbox" aria-label={`Quem vai para ${targetLabel(target)}`} onClick={(event) => event.stopPropagation()}>
            {candidates
              .filter((member) => member.area !== area.discipline || (target.captain ? member.role !== "captain" : member.role === "captain"))
              .filter((member) => !(target.captain && member.role === "president"))
              .map((member) => (
                <li key={member.id}>
                  <button type="button" role="option" aria-selected="false" onClick={() => onChoose(member.id, target)}>
                    <span>{member.name}</span>
                    <small>{member.area ? DISCIPLINE_SHORT[member.area] : "Sem área"}</small>
                  </button>
                </li>
              ))}
          </ul>
        ) : null}
      </div>
    );
  };
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
        {slot({ area: area.discipline, captain: true }, captain, "captain", "Capitão")}
        {area.memberIds.map((id) => slot({ area: area.discipline, captain: false }, byId(id), id, "Vaga"))}
        {Array.from({ length: area.openSlots }, (_, i) => slot({ area: area.discipline, captain: false }, null, `hole-${i}`, "Vaga"))}
      </div>
    </section>
  );
}

/** Avião de cima (nariz à esquerda, como o blueprint). Cada parte apaga quando a área não tem ninguém. */
function AirplaneBackdrop({ empty }: { empty: (discipline: Discipline) => boolean }) {
  const cls = (discipline: Discipline) => `fm-part${empty(discipline) ? " is-empty" : ""}`;
  return (
    <svg class="fm-plane" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
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
  selected,
  onDragStart,
  onDragEnd
}: {
  member: Member;
  discipline: Discipline | null;
  task: string | null;
  /** Rótulo da agenda do presidente; null para os demais. */
  agenda: string | null;
  dragging: boolean;
  selected: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const rating = Math.round(discipline ? member.knowledge[discipline] : Math.max(...Object.values(member.knowledge)));
  const captain = member.role === "captain" && discipline !== null;
  return (
    <article
      class={`fm-card tier-${tier(rating)}${captain ? " is-captain" : ""}${agenda ? " is-president" : ""}${dragging ? " is-dragging" : ""}${selected ? " is-selected" : ""}`}
      draggable
      data-member={member.id}
      title={chipTitle(member, agenda, task)}
      onDragStart={(event) => {
        event.dataTransfer?.setData("text/plain", member.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <span class="fm-rating">{formatNumber(rating)}</span>
      <span class="fm-pos">{discipline ? DISCIPLINE_SHORT[discipline].slice(0, 3).toUpperCase() : "—"}</span>
      <PixelAvatar member={member} scale={2} class="fm-portrait" />
      <span class="fm-name">{member.name}</span>
      <span class="fm-likes">{member.statedLikes.length > 0 ? `♥ ${member.statedLikes.map((item) => DISCIPLINE_SHORT[item].slice(0, 5)).join(", ")}` : "♥ —"}</span>
      <span class="fm-mot" aria-hidden="true" title={`Motivação ${Math.round(member.motivation)}`}>
        <span class={`fm-mot-fill tone-${motivationTone(member.motivation)}`} style={{ width: `${Math.round(member.motivation)}%` }} />
      </span>
      <EnergyBar member={member} class="fm-energy" />
      {captain ? <span class="fm-captain">C</span> : null}
      {agenda ? (
        <span class="fm-president" title={`Prioridade: ${agenda.toLowerCase()}`}>
          Presidente
        </span>
      ) : null}
    </article>
  );
}
