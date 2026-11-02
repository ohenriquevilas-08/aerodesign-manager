// Triagem com o presidente (fase-9.md, ajustes do playtest): o botão "Enviar avaliação ao presidente"
// da planilha, o parecer dele e, nos nomes de que ele discorda, "Aceitar" ou "Manter a minha".

import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import { triageGateOf, triageSent } from "../../sim";

const GATE_TEXT = { lecture: "a palestra", dynamic: "a dinâmica" } as const;

export function Triage() {
  const campaign = useGame((state) => state.selection);
  const names = useGame((state) => Object.fromEntries((state.selection?.applicants ?? []).map((item) => [item.id, item.name])));
  const presidentName = useGame((state) => state.members.find((member) => member.role === "president")?.name ?? "O presidente");
  if (!campaign) return null;
  const gate = triageGateOf(campaign);
  const sent = gate !== null && triageSent(campaign, gate);
  const review = campaign.triage.review;

  return (
    <section class="triage" aria-label="Triagem com o presidente">
      {gate && !sent ? (
        <div class="triage-ask">
          <p>
            <strong>Triagem pendente.</strong> Marque a planilha e envie a avaliação ao presidente: sem isso {GATE_TEXT[gate]} não abre. Quem está em "chamar" e "talvez" segue.
          </p>
          <button type="button" class="btn-primary" onClick={() => store.dispatch({ type: "send-triage" })}>
            Enviar avaliação ao presidente
          </button>
        </div>
      ) : null}
      {review ? (
        <div class="triage-review">
          <p>
            <strong>{presidentName}:</strong> {review.opinion}
          </p>
          {review.disagreements.map((item) => (
            <div key={item.applicantId} class="triage-item">
              <span>
                <strong>{names[item.applicantId] ?? "?"}</strong>: eu marcaria "{item.suggested === "no" ? "não" : item.suggested === "maybe" ? "talvez" : "chamar"}". {item.reason}
              </span>
              {item.accepted === null ? (
                <span class="triage-buttons">
                  <button type="button" class="btn-ghost" onClick={() => store.dispatch({ type: "answer-triage", applicantId: item.applicantId, accept: true })}>
                    Aceitar
                  </button>
                  <button type="button" class="btn-ghost" onClick={() => store.dispatch({ type: "answer-triage", applicantId: item.applicantId, accept: false })}>
                    Manter a minha
                  </button>
                </span>
              ) : (
                <span class="muted small">{item.accepted ? "Aceito: marca trocada." : "Mantida a sua marca."}</span>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
