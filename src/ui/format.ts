// Formatação e rótulos da interface. Puro (sem Preact) para poder ser testado em tests/ui/.

import type { Cost, Discipline, RiskLevel, Role } from "../sim";

/** Número no padrão pt-BR com casas fixas: 1234.5 → "1.234,50". */
export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  none: "nenhum",
  low: "baixo",
  medium: "médio",
  high: "alto"
};

export type CostKind = "hours" | "credits" | "lead" | "risk";

export interface CostPart {
  kind: CostKind;
  icon: string;
  text: string;
  title: string;
}

/**
 * Partes de um custo na ordem fixa do design §8: horas ⏱, créditos ◆, prazo ⌛, risco ⚠.
 * Omite o que for zero (ou risco "none"); custo todo zero devolve lista vazia.
 */
export function costParts(cost: Cost): CostPart[] {
  const parts: CostPart[] = [];
  if (cost.hours > 0) {
    parts.push({ kind: "hours", icon: "⏱", text: `${formatNumber(cost.hours)} h`, title: "Horas-pessoa da equipe" });
  }
  if (cost.credits > 0) {
    parts.push({ kind: "credits", icon: "◆", text: formatNumber(cost.credits), title: "Créditos do caixa" });
  }
  if (cost.leadDays > 0) {
    parts.push({
      kind: "lead",
      icon: "⌛",
      text: `${formatNumber(cost.leadDays)} d`,
      title: "Espera no calendário, sem ocupar ninguém"
    });
  }
  if (cost.risk !== "none") {
    parts.push({ kind: "risk", icon: "⚠", text: RISK_LABEL[cost.risk], title: "Desgaste e risco de dano" });
  }
  return parts;
}

/** Nomes completos das disciplinas, como no relatório 2026 (11.1). */
export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  conceptual: "Projeto conceitual e preliminar",
  aerodynamics: "Aerodinâmica",
  performance: "Desempenho",
  stability: "Estabilidade e controle",
  loads: "Cargas e aeroelasticidade",
  structures: "Estruturas e ensaios estruturais",
  electrical: "Projeto elétrico e safety assessment"
};

/** Nomes curtos para barras e etiquetas. */
export const DISCIPLINE_SHORT: Record<Discipline, string> = {
  conceptual: "Conceitual",
  aerodynamics: "Aerodinâmica",
  performance: "Desempenho",
  stability: "Estabilidade",
  loads: "Cargas",
  structures: "Estruturas",
  electrical: "Elétrica"
};

export const ROLE_LABEL: Record<Role, string> = {
  president: "Presidente",
  captain: "Capitania",
  member: "Membro"
};

/** Faixa de motivação em palavras (design §5.1: Baixa → Alta). */
export function motivationLabel(value: number): string {
  if (value >= 75) return "Alta";
  if (value >= 50) return "Média";
  if (value >= 25) return "Baixa";
  return "Muito baixa";
}
