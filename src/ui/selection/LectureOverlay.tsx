// Palestra de apresentação em tela cheia (Fase 9, U2): a LectureScene com a plateia dos que vieram.
// Abre sozinha quando a simulação para o relógio por causa da palestra e pode ser revista pela
// aba Seletiva. A cena só anima; quem veio e quem faltou já foi sorteado pela simulação.

import { useEffect, useMemo, useState } from "preact/hooks";
import { applicantViews } from "../../sim";
import { useGame } from "../../app/useGame";
import { LectureScene } from "../../scenes/LectureScene";
import { lectureChannel } from "../../scenes/lecture/channel";
import { lectureViewFromApplicants } from "../../scenes/lecture/contract";
import { PhaserStage } from "../PhaserStage";

type Listener = () => void;
const listeners = new Set<Listener>();
// A palestra já mostrada sozinha (por campanha); sobrevive à troca de tela, não é estado do jogo.
let autoShown: string | null = null;

/** Pede a palestra em tela cheia (botão "Rever a palestra" da aba Seletiva). */
export function openLecture() {
  listeners.forEach((listener) => listener());
}

export function LectureOverlay() {
  const campaign = useGame((state) => state.selection);
  const pauseReason = useGame((state) => state.pause?.reason ?? null);
  const members = useGame((state) => state.members);
  const teamName = useGame((state) => state.teamName);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const listener = () => setOpen(true);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // A palestra acabou de acontecer: a simulação pausou com o motivo "selection".
  useEffect(() => {
    if (pauseReason === "selection" && campaign?.stage === "dynamic" && autoShown !== campaign.id) {
      autoShown = campaign.id;
      setOpen(true);
    }
  }, [pauseReason, campaign?.stage, campaign?.id]);

  const view = useMemo(() => {
    if (!open || !campaign) return null;
    const speaker = members.find((member) => member.role === "president") ?? members[0];
    const onStage = speaker ? [{ id: speaker.id, name: speaker.name, look: speaker.look }] : [];
    return lectureViewFromApplicants(campaign.id, applicantViews({ selection: campaign }), onStage, teamName);
  }, [open, campaign, members, teamName]);

  // A cena lê o canal ao criar: a leitura entra antes de a cena existir.
  if (view) lectureChannel.show(view);
  useEffect(() => {
    if (!open) lectureChannel.show(null);
  }, [open]);
  useEffect(() => {
    if (open && !campaign) setOpen(false);
  }, [open, campaign]);

  if (!open || !view) return null;
  const came = view.attendees.length;
  return (
    <div class="event-mode lecture-overlay" role="dialog" aria-label="Palestra de apresentação">
      <div class="event-canvas">
        <PhaserStage scene={LectureScene} sceneKey="lecture" />
      </div>
      <footer class="event-bottom">
        <p class="event-headline">
          Palestra de apresentação: {came} de {view.registered} inscritos vieram. Quem faltou saiu do processo.
        </p>
        <button type="button" class="btn-primary event-go" onClick={() => setOpen(false)}>
          Continuar
        </button>
      </footer>
    </div>
  );
}
