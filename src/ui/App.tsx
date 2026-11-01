import type { FunctionComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import { store } from "../app/store";
import { SPEEDS } from "../sim";
import { Actions } from "./screens/Actions";
import { Browser } from "./screens/Browser";
import { Central } from "./screens/Central";
import { Competition } from "./screens/Competition";
import { Drafting } from "./screens/Drafting";
import { Finance } from "./screens/Finance";
import { Report } from "./screens/Report";
import { Rules } from "./screens/Rules";
import { Team } from "./screens/Team";
import { Tests } from "./screens/Tests";
import { onNavigate } from "./nav";
import { TopBar } from "./TopBar";
import { WarningToast } from "./WarningToast";

// Telas do design §11. As que ainda não existem mostram um aviso.
// Atalho: uma letra por tela (espaço e 1/2/3 ficam com o relógio).
const SCREENS: readonly { id: string; label: string; key: string; view?: FunctionComponent }[] = [
  { id: "central", label: "Central", key: "C", view: Central },
  { id: "actions", label: "Ações", key: "A", view: Actions },
  { id: "team", label: "Equipe", key: "E", view: Team },
  { id: "drafting", label: "Prancheta", key: "P", view: Drafting },
  { id: "tests", label: "Ensaios", key: "S", view: Tests },
  { id: "report", label: "Relatório", key: "R", view: Report },
  { id: "finance", label: "Finanças", key: "F", view: Finance },
  { id: "browser", label: "Navegador", key: "N", view: Browser },
  { id: "rules", label: "Regulamento", key: "G", view: Rules },
  { id: "competition", label: "Competição", key: "M", view: Competition }
];

const NON_TYPING_INPUTS = new Set(["range", "checkbox", "radio", "button"]);

/** Campos onde letras e espaço são digitação, não atalho. */
function isTyping(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !NON_TYPING_INPUTS.has(target.type);
  return target instanceof HTMLElement && target.isContentEditable;
}

export function App() {
  const [screen, setScreen] = useState("central");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (event.code === "Space") {
        // Espaço também "clicaria" o botão focado; aqui ele é só pausa.
        event.preventDefault();
        store.togglePause();
        return;
      }
      const speedIndex = ["Digit1", "Digit2", "Digit3"].indexOf(event.code);
      if (speedIndex >= 0) {
        store.setSpeed(SPEEDS[speedIndex + 1]!);
        return;
      }
      const target = SCREENS.find((item) => event.code === `Key${item.key}`);
      if (target) setScreen(target.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => onNavigate(setScreen), []);

  const current = SCREENS.find((item) => item.id === screen)!;
  const View = current.view;

  return (
    <div class="shell">
      <TopBar />
      <nav class="nav" aria-label="Telas">
        {SCREENS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={item.id === screen ? "page" : undefined}
            aria-keyshortcuts={item.key}
            title={`${item.label} (tecla ${item.key})`}
            onClick={() => setScreen(item.id)}
          >
            {item.label}
            <span class="nav-key">{item.key}</span>
          </button>
        ))}
      </nav>
      <main class="main">
        {View ? (
          <View />
        ) : (
          <div class="placeholder">
            <div>
              <h2>{current.label}</h2>
              <p>Tela da Fase 2. Ver docs/design/ano-1.md §11.</p>
            </div>
          </div>
        )}
      </main>
      <WarningToast />
    </div>
  );
}
