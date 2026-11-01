// Carrinho, prazo e risco das lojas do navegador (design §8.4). Puro (sem Preact) para ser testado em tests/ui/.

import type { Listing, RiskLevel, ShippingMode, ShopDef } from "../../sim";
import { formatNumber } from "../format";

/** Itens no carrinho de uma loja: productId → quantidade. */
export type Cart = Record<string, number>;

export interface DayRange {
  min: number;
  max: number;
}

export interface CartLine {
  listing: Listing;
  quantity: number;
  /** Preço da vitrine agora (com promoção). */
  unitPrice: number;
}

export interface CartSummary {
  items: number;
  /** ◆ dos itens. */
  subtotal: number;
  /** ◆ do frete (por pedido). */
  shipping: number;
  total: number;
  /** Faixa prometida do pedido inteiro (o item mais demorado manda); null sem itens. */
  lead: DayRange | null;
  risk: RiskLevel;
}

const RISK_ORDER: readonly RiskLevel[] = ["none", "low", "medium", "high"];

/** Prazo prometido com o fator do frete (expresso < 1). Nunca menos de 1 dia. */
export function shippedLead(lead: DayRange, factor: number): DayRange {
  const min = Math.max(1, Math.round(lead.min * factor));
  return { min, max: Math.max(min, Math.round(lead.max * factor)) };
}

/** "15–30 d" ou "3 d". */
export function rangeText(range: DayRange): string {
  return range.min === range.max ? `${formatNumber(range.min)} d` : `${formatNumber(range.min)}–${formatNumber(range.max)} d`;
}

/**
 * Risco do anúncio em um nível só, para o cartão de custo (⚠). Falsificação e usado em
 * estado muito incerto pesam mais que a fiscalização (essa só atrasa e cobra imposto).
 */
export function listingRisk(listing: Listing): RiskLevel {
  const used = listing.usedCondition;
  if (listing.counterfeitChance >= 0.2 || (used !== null && used.min < 40)) return "high";
  if (listing.counterfeitChance > 0 || used !== null || listing.customsChance >= 0.2 || listing.quality.spread >= 20) {
    return "medium";
  }
  if (listing.customsChance > 0 || listing.quality.spread >= 12) return "low";
  return "none";
}

const percent = (value: number) => `${formatNumber(Math.round(value * 100))}%`;

/** O risco em linguagem clara (pilar 5): uma frase por motivo. */
export function listingRiskNotes(listing: Listing, shop: ShopDef): string[] {
  const notes: string[] = [];
  if (listing.counterfeitChance > 0) {
    notes.push(
      listing.productId === "servos"
        ? `${percent(listing.counterfeitChance)} de chance de vir servo sem marca: reprova na inspeção de segurança.`
        : `${percent(listing.counterfeitChance)} de chance de vir fora da especificação.`
    );
  }
  if (listing.usedCondition) {
    notes.push(
      `Usado: condição entre ${listing.usedCondition.min}% e ${listing.usedCondition.max}%. Só dá para saber quando chegar.`
    );
  }
  if (listing.customsChance > 0) {
    notes.push(
      `${percent(listing.customsChance)} de chance de ficar retido na fiscalização; imposto de ${percent(shop.customsRate)} do pedido.`
    );
  }
  if (listing.quality.spread >= 20) notes.push("Qualidade muda muito de uma unidade para outra.");
  else if (listing.quality.spread <= 5) notes.push("Qualidade consistente: o que diz a ficha.");
  if (notes.length === 0) notes.push("Sem surpresas conhecidas.");
  return notes;
}

/** Totais do carrinho de uma loja com a modalidade de frete escolhida. */
export function cartSummary(shop: ShopDef, lines: readonly CartLine[], mode: ShippingMode): CartSummary {
  const option = shop.shipping[mode];
  const items = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const shipping = items > 0 && option ? option.credits : 0;
  let lead: DayRange | null = null;
  let risk: RiskLevel = "none";
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const range = shippedLead(line.listing.leadDays, option?.leadFactor ?? 1);
    lead = lead ? { min: Math.max(lead.min, range.min), max: Math.max(lead.max, range.max) } : range;
    const lineRisk = listingRisk(line.listing);
    if (RISK_ORDER.indexOf(lineRisk) > RISK_ORDER.indexOf(risk)) risk = lineRisk;
  }
  return { items, subtotal, shipping, total: subtotal + shipping, lead, risk };
}

/** Quantas unidades ainda cabem no carrinho (estoque null = sem limite). */
export function canAdd(cart: Cart, productId: string, stock: number | null): boolean {
  return stock === null || (cart[productId] ?? 0) < stock;
}

/** Soma (ou tira) unidades; zero remove a linha. */
export function changeQuantity(cart: Cart, productId: string, delta: number, stock: number | null): Cart {
  const current = cart[productId] ?? 0;
  const limit = stock ?? Number.POSITIVE_INFINITY;
  const next = Math.max(0, Math.min(limit, current + delta));
  const { [productId]: _removed, ...rest } = cart;
  return next === 0 ? rest : { ...rest, [productId]: next };
}
