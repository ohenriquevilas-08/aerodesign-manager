// Pacotes das lojas do navegador (design §8.4) no hangar. Funções puras (testadas em tests/scenes/):
// pedidos a caminho ou retidos viram caixas na porta; pedido entregue há pouco é aberto uma vez.

import { findProduct, findShop, type GameState, type Order } from "../../sim";

/** Por quanto tempo de jogo depois da entrega a caixa ainda é aberta ao entrar no hangar (1 dia). */
export const OPENING_WINDOW_HOURS = 24;

export interface PackageView {
  orderId: string;
  shopName: string;
  /** Primeiro item do pedido, com "+N" se houver mais. */
  label: string;
  /** Retido na fiscalização: caixa com faixa de aviso. */
  held: boolean;
}

export function packageView(order: Order): PackageView {
  const [first, ...rest] = order.lines;
  const name = first ? (findProduct(first.productId)?.label ?? first.productId) : "Pedido";
  return {
    orderId: order.id,
    shopName: findShop(order.shopId)?.name ?? order.shopId,
    label: rest.length > 0 ? `${name} +${rest.length}` : name,
    held: order.status === "held-customs"
  };
}

/** Caixas esperando na porta: pedidos a caminho ou retidos, na ordem em que foram feitos. */
export function packagesAtDoor(state: GameState): PackageView[] {
  return state.orders.filter((order) => order.status === "in-transit" || order.status === "held-customs").map(packageView);
}

/** Pedidos entregues dentro da janela de abertura, do mais antigo ao mais novo. */
export function recentDeliveries(state: GameState, windowHours = OPENING_WINDOW_HOURS): PackageView[] {
  const now = state.clock.hours;
  return state.orders
    .filter((order) => order.status === "delivered" && order.deliveredAt !== null && now - order.deliveredAt <= windowHours && order.deliveredAt <= now)
    .sort((a, b) => a.deliveredAt! - b.deliveredAt!)
    .map(packageView);
}
