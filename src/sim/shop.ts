// Pedidos nas lojas do navegador (design §8.4). Frente: Simulação (Fase 3).
// Checkout debita na hora; o prazo real é sorteado e fica escondido; importado pode parar na
// fiscalização; na entrega a peça aparece no hangar com qualidade sorteada pela loja.

import { BALANCE } from "./content/balance";
import { findListing, findProduct, findShop, LISTINGS, listingId, SHOPS, type Listing } from "./content/shops";
import { nextRandom } from "./rng";
import { addMessage, warn } from "./tasks";
import { clamp } from "./team";
import type { GameState, Order, OrderLine, Part, PauseReason, ShippingMode, ShopsState } from "./types";

const S = BALANCE.shop;

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

/** Sorteador local que avança o rngState do estado. */
function roller(rngState: number) {
  let current = rngState;
  return {
    next: () => {
      const roll = nextRandom(current);
      current = roll.state;
      return roll.value;
    },
    get state() {
      return current;
    }
  };
}

const orderLabel = (order: Order) =>
  order.lines.map((line) => `${line.quantity > 1 ? `${line.quantity}× ` : ""}${findProduct(line.productId)?.label ?? line.productId}`).join(", ");

const subtotal = (lines: readonly OrderLine[]) => lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

/**
 * Checkout: debita ◆ (itens + frete), baixa estoque e cria o Order com prazo prometido e real.
 * Recusa: loja/produto inexistente, sem estoque, frete indisponível, caixa insuficiente.
 */
export function placeOrder(state: GameState, request: OrderRequest): GameState {
  const shop = findShop(request.shopId);
  if (!shop) return warn(state, "Loja não encontrada.");
  const shipping = shop.shipping[request.shipping];
  if (!shipping) return warn(state, `${shop.name} não oferece frete ${request.shipping === "express" ? "expresso" : "normal"}.`);

  // Junta linhas do mesmo produto.
  const quantities = new Map<string, number>();
  for (const line of request.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) return warn(state, "Quantidade inválida no carrinho.");
    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
  }
  if (quantities.size === 0) return warn(state, "O carrinho está vazio.");

  const listings: Listing[] = [];
  const lines: OrderLine[] = [];
  const stock = { ...state.shops.stock };
  for (const [productId, quantity] of quantities) {
    const listing = findListing(shop.id, productId);
    if (!listing) return warn(state, `${shop.name} não vende esse produto.`);
    const id = listingId(shop.id, productId);
    if (id in stock) {
      if (stock[id]! < quantity) {
        const label = findProduct(productId)?.label ?? productId;
        return warn(state, stock[id] === 0 ? `${label} esgotado na ${shop.name}.` : `Só restam ${stock[id]} de ${label} na ${shop.name}.`);
      }
      stock[id] = stock[id]! - quantity;
    }
    listings.push(listing);
    lines.push({ productId, quantity, unitPrice: listingPrice(state, shop.id, productId)! });
  }

  const total = subtotal(lines) + shipping.credits;
  if (state.credits < total) return warn(state, `Caixa insuficiente: faltam ◆ ${total - state.credits}.`);

  // Prazo: o pacote sai quando o item mais demorado fica pronto. Prometido = máximo da vitrine;
  // o real é sorteado na faixa e ainda pode atrasar (BALANCE.shop.lateness), como BALANCE.lead.
  const rng = roller(state.rngState);
  const min = Math.max(...listings.map((item) => item.leadDays.min));
  const max = Math.max(...listings.map((item) => item.leadDays.max));
  const lateness = S.lateness[shop.origin] ?? 0;
  const days = (min + (max - min) * rng.next()) * (1 + lateness * rng.next()) * shipping.leadFactor;
  const now = state.clock.hours;
  const order: Order = {
    id: `order-${state.nextId}`,
    shopId: shop.id,
    lines,
    shipping: request.shipping,
    placedAt: now,
    expectedAt: now + max * shipping.leadFactor * 24,
    arrivesAt: now + days * 24,
    status: "processing",
    customsDue: null,
    deliveredAt: null
  };
  return {
    ...state,
    rngState: rng.state,
    credits: state.credits - total,
    shops: { ...state.shops, stock },
    orders: [...state.orders, order],
    nextId: state.nextId + 1
  };
}

/** Paga o imposto de um pedido retido; ele volta a andar depois da liberação. */
export function payCustoms(state: GameState, orderId: string): GameState {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order || order.status !== "held-customs" || order.customsDue === null) return warn(state, "Esse pedido não está retido na fiscalização.");
  if (state.credits < order.customsDue) return warn(state, `Caixa insuficiente: faltam ◆ ${order.customsDue - state.credits} para o imposto.`);
  const roll = nextRandom(state.rngState);
  const [minDays, maxDays] = S.customsReleaseDays;
  const release = (minDays + (maxDays - minDays) * roll.value) * 24;
  const now = state.clock.hours;
  const paid: Order = {
    ...order,
    status: "in-transit",
    customsPaid: order.customsDue,
    customsDue: null,
    arrivesAt: Math.max(order.arrivesAt, now + release),
    expectedAt: Math.max(order.expectedAt, now + S.customsReleaseDays[1] * 24)
  };
  return {
    ...state,
    rngState: roll.state,
    credits: state.credits - order.customsDue,
    orders: state.orders.map((item) => (item.id === orderId ? paid : item))
  };
}

/** Entrega: cada unidade vira peça (qualidade sorteada pela loja), estoque ou equipamento. */
function deliver(state: GameState, order: Order, at: number): GameState {
  const rng = roller(state.rngState);
  let next = state;
  const notes: string[] = [];
  for (const line of order.lines) {
    const product = findProduct(line.productId)!;
    const listing = findListing(order.shopId, line.productId)!;
    for (let unit = 0; unit < line.quantity; unit += 1) {
      const grant = product.grant;
      if (grant.kind === "part") {
        const counterfeit = rng.next() < listing.counterfeitChance;
        const quality = clamp(listing.quality.mean + listing.quality.spread * (2 * rng.next() - 1)) * (counterfeit ? S.counterfeitQuality : 1);
        const used = listing.usedCondition;
        const condition = used ? Math.round(used.min + (used.max - used.min) * rng.next()) : 100;
        const part: Part = { id: `part-${next.nextId}`, type: grant.part, label: grant.label, quality: Math.round(quality), condition };
        if (counterfeit) part.counterfeit = true;
        next = { ...next, parts: [...next.parts, part], nextId: next.nextId + 1 };
        if (used) notes.push(`${grant.label} usado chegou com condição ${condition}.`);
      } else if (grant.kind === "stock") {
        next = { ...next, stock: { ...next.stock, [grant.item]: (next.stock[grant.item] ?? 0) + grant.amount } };
      } else if (!next.equipment.includes(grant.item)) {
        next = { ...next, equipment: [...next.equipment, grant.item] };
      }
    }
  }
  next = {
    ...next,
    rngState: rng.state,
    orders: next.orders.map((item) => (item.id === order.id ? { ...item, status: "delivered" as const, deliveredAt: at } : item))
  };
  const shop = findShop(order.shopId)!;
  return addMessage(next, {
    from: shop.name,
    title: `Pedido entregue: ${orderLabel(order)}`,
    body: ["Chegou ao hangar.", ...notes].join(" ")
  }).state;
}

export interface Pending {
  reason: PauseReason;
  messageId: string;
}

/**
 * Pedidos e vitrines no relógio: processamento, fiscalização (pausa), entrega (pausa),
 * promoções relâmpago e reposição de estoque.
 */
export function advanceShops(state: GameState, t0: number, t1: number): { state: GameState; pauses: Pending[] } {
  const dt = t1 - t0;
  const pauses: Pending[] = [];
  let next = state;

  for (const original of state.orders) {
    let order = next.orders.find((item) => item.id === original.id)!;
    if (order.status === "delivered") continue;
    if (order.status === "held-customs") {
      // Parado na fiscalização: o relógio do pedido não anda.
      const held = { ...order, arrivesAt: order.arrivesAt + dt, expectedAt: order.expectedAt + dt };
      next = { ...next, orders: next.orders.map((item) => (item.id === order.id ? held : item)) };
      continue;
    }
    const lead = order.arrivesAt - order.placedAt;
    if (order.status === "processing" && t1 >= order.placedAt + Math.min(S.processingDays * 24, lead * S.processingShare)) {
      order = { ...order, status: "in-transit" };
      next = { ...next, orders: next.orders.map((item) => (item.id === order.id ? order : item)) };
    }
    const shop = findShop(order.shopId)!;
    const checkpoint = order.placedAt + lead * S.customsPoint;
    if (shop.origin === "import" && order.customsPaid === undefined && t0 < checkpoint && checkpoint <= t1) {
      const chance = Math.max(...order.lines.map((line) => findListing(order.shopId, line.productId)!.customsChance));
      const roll = nextRandom(next.rngState);
      next = { ...next, rngState: roll.state };
      if (roll.value < chance) {
        const due = Math.round(subtotal(order.lines) * shop.customsRate);
        const held: Order = { ...order, status: "held-customs", customsDue: due };
        next = { ...next, orders: next.orders.map((item) => (item.id === order.id ? held : item)) };
        const added = addMessage(next, {
          from: "Receita Federal",
          title: `Retido na fiscalização: ${orderLabel(order)}`,
          body: `Pague ◆ ${due} de imposto para liberar o pedido da ${shop.name}. Enquanto isso, ele fica parado.`
        });
        next = added.state;
        pauses.push({ reason: "order", messageId: added.id });
        continue;
      }
    }
    if (t1 >= order.arrivesAt) {
      next = deliver(next, order, t1);
      pauses.push({ reason: "order", messageId: next.inbox.at(-1)!.id });
    }
  }

  // Uma vez por dia de jogo: promoções vencidas saem, novas podem aparecer, estoque repõe.
  if (Math.floor(t1 / 24) > Math.floor(t0 / 24)) next = dailyShops(next, t1);
  return { state: next, pauses };
}

function dailyShops(state: GameState, now: number): GameState {
  const rng = roller(state.rngState);
  const sales = Object.fromEntries(Object.entries(state.shops.sales).filter(([, sale]) => sale.until > now));
  const stock = { ...state.shops.stock };
  const announcements: { shop: string; text: string }[] = [];

  for (const shopId of S.sale.shops) {
    if (rng.next() >= S.sale.chancePerDay) continue;
    const options = LISTINGS.filter((item) => item.shopId === shopId && !(listingId(item.shopId, item.productId) in sales));
    if (options.length === 0) continue;
    const item = options[Math.floor(rng.next() * options.length)]!;
    const [low, high] = S.sale.discount;
    const price = Math.round(item.price * (1 - (low + (high - low) * rng.next())));
    sales[listingId(item.shopId, item.productId)] = { price, until: now + S.sale.days * 24 };
    const shop = SHOPS.find((entry) => entry.id === shopId)!;
    announcements.push({ shop: shop.name, text: `${findProduct(item.productId)!.label} por ◆ ${price} (era ◆ ${item.price}), só por ${S.sale.days} dias.` });
  }

  for (const item of LISTINGS) {
    if (item.initialStock === null) continue;
    const id = listingId(item.shopId, item.productId);
    if ((stock[id] ?? 0) < item.initialStock && rng.next() < S.restockChancePerDay) stock[id] = (stock[id] ?? 0) + 1;
  }

  let next: GameState = { ...state, rngState: rng.state, shops: { stock, sales } };
  for (const sale of announcements) {
    next = addMessage(next, { from: sale.shop, title: `Promoção relâmpago na ${sale.shop}`, body: sale.text }).state;
  }
  return next;
}

/** Peças falsificadas que a equipe tem (para a inspeção e o relatório final). */
export function counterfeitParts(state: GameState): Part[] {
  return state.parts.filter((part) => part.counterfeit);
}
