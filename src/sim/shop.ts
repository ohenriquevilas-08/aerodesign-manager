// Pedidos nas lojas do navegador (design §8.4). Frente: Simulação (Fase 3).

import { findListing, LISTINGS, listingId } from "./content/shops";
import { warn } from "./tasks";
import type { GameState, ShippingMode, ShopsState } from "./types";

export function createShops(): ShopsState {
  const stock: Record<string, number> = {};
  for (const item of LISTINGS) {
    if (item.initialStock !== null) stock[listingId(item.shopId, item.productId)] = item.initialStock;
  }
  return { stock, sales: {} };
}

/** Preço da vitrine agora (promoção ativa ou preço base); null se a loja não vende o produto. */
export function listingPrice(state: GameState, shopId: string, productId: string): number | null {
  const item = findListing(shopId, productId);
  if (!item) return null;
  const sale = state.shops.sales[listingId(shopId, productId)];
  return sale && sale.until > state.clock.hours ? sale.price : item.price;
}

/** Unidades disponíveis; null = sem limite. */
export function listingStock(state: GameState, shopId: string, productId: string): number | null {
  const id = listingId(shopId, productId);
  return id in state.shops.stock ? state.shops.stock[id]! : null;
}

export interface OrderRequest {
  shopId: string;
  lines: { productId: string; quantity: number }[];
  shipping: ShippingMode;
}

/**
 * Checkout: debita ◆ (itens + frete), baixa estoque e cria o Order com prazo prometido e real.
 * Recusa: loja/produto inexistente, sem estoque, frete indisponível, caixa insuficiente.
 * STUB (contrato da Fase 3): a frente de Simulação implementa.
 */
export function placeOrder(state: GameState, request: OrderRequest): GameState {
  void request;
  return warn(state, "Compras pelo navegador ainda não disponíveis nesta versão.");
}

/**
 * Paga o imposto de um pedido retido; ele volta a andar.
 * STUB (contrato da Fase 3): a frente de Simulação implementa.
 */
export function payCustoms(state: GameState, orderId: string): GameState {
  void orderId;
  return warn(state, "Pagamento de imposto ainda não disponível nesta versão.");
}
