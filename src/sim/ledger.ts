// Extrato do caixa ◆ (Fase 4, S6): todo comando ou evento que mexe em créditos passa por aqui.

import { clockToDate } from "./time";
import type { GameState, LedgerEntry, LedgerKind } from "./types";

/** Anota uma entrada (credits > 0) ou saída (credits < 0) no extrato; zero não anota. O saldo não muda aqui. */
export function recordLedger(state: GameState, entry: { credits: number; kind: LedgerKind; label: string }): GameState {
  if (entry.credits === 0) return state;
  return { ...state, ledger: [...state.ledger, { at: state.clock.hours, ...entry }] };
}

export const LEDGER_LABELS: Record<LedgerKind, string> = {
  order: "Pedidos nas lojas",
  customs: "Impostos de importação",
  raffle: "Rifas",
  sponsor: "Patrocínios",
  action: "Custos de ações",
  dev: "Ajuste de desenvolvimento"
};

export interface FinanceBucket {
  income: number;
  expense: number;
}

export interface FinanceSummary {
  /** Caixa atual. */
  cash: number;
  income: number;
  expense: number;
  byKind: Partial<Record<LedgerKind, FinanceBucket>>;
  /** Por mês do calendário do jogo ("2026-03"), em ordem. */
  byMonth: { month: string; income: number; expense: number; net: number }[];
}

const monthOf = (at: number) => {
  const date = new Date(clockToDate(at));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

export function financeSummary(state: GameState): FinanceSummary {
  const byKind: Partial<Record<LedgerKind, FinanceBucket>> = {};
  const months = new Map<string, FinanceBucket>();
  let income = 0;
  let expense = 0;
  for (const entry of state.ledger as readonly LedgerEntry[]) {
    const gain = Math.max(0, entry.credits);
    const loss = Math.max(0, -entry.credits);
    income += gain;
    expense += loss;
    const bucket = (byKind[entry.kind] ??= { income: 0, expense: 0 });
    bucket.income += gain;
    bucket.expense += loss;
    const month = months.get(monthOf(entry.at)) ?? { income: 0, expense: 0 };
    month.income += gain;
    month.expense += loss;
    months.set(monthOf(entry.at), month);
  }
  const byMonth = [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, income: value.income, expense: value.expense, net: value.income - value.expense }));
  return { cash: state.credits, income, expense, byKind, byMonth };
}
