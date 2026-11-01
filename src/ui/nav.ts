// Navegação entre telas pedida por outra tela (ex.: Relatório → Ações). Estado de apresentação,
// fora do GameState. A App assina e troca de tela; a tela de destino consome a intenção.

export interface ActionIntent {
  actionId: string;
  targetId?: string;
}

type Listener = (screen: string) => void;

let pending: ActionIntent | null = null;
const listeners = new Set<Listener>();

/** Vai para a tela `screen`; com `intent`, a tela Ações abre essa ação já preenchida. */
export function navigate(screen: string, intent?: ActionIntent) {
  pending = intent ?? null;
  listeners.forEach((listener) => listener(screen));
}

/** Lê e limpa a intenção pendente (uma só vez). */
export function takeIntent(): ActionIntent | null {
  const intent = pending;
  pending = null;
  return intent;
}

export function onNavigate(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
