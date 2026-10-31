import { useEffect, useState } from "preact/hooks";
import { useGame } from "../app/useGame";

const VISIBLE_MS = 4500;

/** Mostra o último comando recusado pela simulação (GameState.warning) quando o id muda. */
export function WarningToast() {
  const warning = useGame((state) => state.warning);
  const [visibleId, setVisibleId] = useState<number | null>(null);

  useEffect(() => {
    if (!warning) return;
    setVisibleId(warning.id);
    const timer = setTimeout(() => setVisibleId((current) => (current === warning.id ? null : current)), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [warning?.id]);

  if (!warning || visibleId !== warning.id) return null;
  return (
    <div class="toast" role="alert">
      <span>{warning.text}</span>
      <button type="button" aria-label="Fechar aviso" onClick={() => setVisibleId(null)}>
        ×
      </button>
    </div>
  );
}
