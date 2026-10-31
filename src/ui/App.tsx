import { useEffect, useState } from "preact/hooks";
import { store } from "../app/store";
import { SPEEDS } from "../sim";
import { Central } from "./screens/Central";
import { TopBar } from "./TopBar";

// Telas do design §11. As que ainda não existem mostram um aviso.
const SCREENS = [
  { id: "central", label: "Central" },
  { id: "team", label: "Equipe" },
  { id: "drafting", label: "Prancheta" },
  { id: "tests", label: "Ensaios" },
  { id: "report", label: "Relatório" },
  { id: "finance", label: "Finanças" },
  { id: "rules", label: "Regulamento" },
  { id: "competition", label: "Competição" }
] as const;

type ScreenId = (typeof SCREENS)[number]["id"];

export function App() {
  const [screen, setScreen] = useState<ScreenId>("central");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.code === "Space") {
        event.preventDefault();
        store.togglePause();
        return;
      }
      const speedIndex = ["Digit1", "Digit2", "Digit3"].indexOf(event.code);
      if (speedIndex >= 0) store.setSpeed(SPEEDS[speedIndex + 1]!);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const current = SCREENS.find((item) => item.id === screen)!;

  return (
    <div class="shell">
      <TopBar />
      <nav class="nav" aria-label="Telas">
        {SCREENS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={item.id === screen ? "page" : undefined}
            onClick={() => setScreen(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main class="main">
        {screen === "central" ? (
          <Central />
        ) : (
          <div class="placeholder">
            <div>
              <h2>{current.label}</h2>
              <p>Tela da Fase 2. Ver docs/design/ano-1.md §11.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
