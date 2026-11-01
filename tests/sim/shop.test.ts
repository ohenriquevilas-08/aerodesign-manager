import { describe, expect, it } from "vitest";
import { advanceShops } from "../../src/sim/shop";
import { applyCommand, ACTIONS, BALANCE, listingId, listingStock, type Command, type GameState } from "../../src/sim";
import { startedGame } from "./helpers";

const game = (credits = 2000, seed = 5): GameState => ({ ...startedGame({ seed, teamName: "T" }), credits });

const order = (state: GameState, command: Omit<Extract<Command, { type: "place-order" }>, "type">) =>
  applyCommand(state, { type: "place-order", ...command });

/** Joga em 4×, retomando depois de cada pausa, até a condição ou o limite de dias. */
function playUntil(state: GameState, done: (s: GameState) => boolean, maxDays = 120): GameState {
  let next = state;
  for (let i = 0; i < maxDays * 10 && !done(next); i += 1) {
    if (next.clock.speed === 0) next = applyCommand(next, { type: "set-speed", speed: 4 });
    next = applyCommand(next, { type: "tick", realSeconds: 0.25 });
  }
  return next;
}

describe("checkout", () => {
  it("debita itens + frete, baixa estoque e cria o pedido com prazo prometido e real", () => {
    const state = order(game(), { shopId: "hangar-aeromodelista", lines: [{ productId: "motor-600", quantity: 1 }], shipping: "standard" });
    expect(state.credits).toBe(2000 - 480 - 35);
    expect(listingStock(state, "hangar-aeromodelista", "motor-600")).toBe(1);
    const placed = state.orders[0]!;
    expect(placed).toMatchObject({ shopId: "hangar-aeromodelista", status: "processing", customsDue: null, deliveredAt: null });
    expect(placed.lines).toEqual([{ productId: "motor-600", quantity: 1, unitPrice: 480 }]);
    const now = state.clock.hours;
    expect(placed.expectedAt - now).toBe(6 * 24);
    expect(placed.arrivesAt - now).toBeGreaterThanOrEqual(3 * 24);
    expect(placed.arrivesAt - now).toBeLessThanOrEqual(6 * 24 * (1 + BALANCE.shop.lateness.national!));
  });

  it("expresso encurta o prazo pelo leadFactor da loja", () => {
    const normal = order(game(), { shopId: "mercadosolto", lines: [{ productId: "servos", quantity: 1 }], shipping: "standard" }).orders[0]!;
    const fast = order(game(), { shopId: "mercadosolto", lines: [{ productId: "servos", quantity: 1 }], shipping: "express" }).orders[0]!;
    const now = game().clock.hours;
    expect(fast.expectedAt - now).toBeCloseTo((normal.expectedAt - now) * 0.35);
    expect(fast.arrivesAt - now).toBeCloseTo((normal.arrivesAt - now) * 0.35);
  });

  it("usa o preço da promoção ativa", () => {
    const base = game();
    const onSale = { ...base, shops: { ...base.shops, sales: { [listingId("hobbykong", "servos")]: { price: 120, until: base.clock.hours + 100 } } } };
    const state = order(onSale, { shopId: "hobbykong", lines: [{ productId: "servos", quantity: 2 }], shipping: "standard" });
    expect(state.orders[0]!.lines[0]!.unitPrice).toBe(120);
    expect(state.credits).toBe(2000 - 240 - 40);
  });

  it("recusa sem estoque, frete indisponível, produto que a loja não vende e sem caixa", () => {
    const cases: [GameState, string][] = [
      [order(game(), { shopId: "hangar-aeromodelista", lines: [{ productId: "motor-600", quantity: 3 }], shipping: "standard" }), "Só restam 2"],
      [order(game(), { shopId: "aliexpresso", lines: [{ productId: "servos", quantity: 1 }], shipping: "express" }), "expresso"],
      [order(game(), { shopId: "balsa-leve", lines: [{ productId: "motor-600", quantity: 1 }], shipping: "standard" }), "não vende"],
      [order(game(100), { shopId: "hobbykong", lines: [{ productId: "motor-600", quantity: 1 }], shipping: "standard" }), "Caixa insuficiente"],
      [order(game(), { shopId: "hobbykong", lines: [], shipping: "standard" }), "vazio"]
    ];
    for (const [state, text] of cases) {
      expect(state.orders).toHaveLength(0);
      expect(state.warning?.text).toContain(text);
    }
  });

  it("compras saíram do catálogo de ações", () => {
    expect(ACTIONS.some((action) => action.id.startsWith("buy-") || action.id === "express-shipping")).toBe(false);
  });
});

describe("entrega", () => {
  it("anda processando → a caminho → entregue, pausa e põe a peça no hangar", () => {
    let state = order(game(), { shopId: "hangar-aeromodelista", lines: [{ productId: "servos", quantity: 1 }], shipping: "standard" });
    state = playUntil(state, (s) => s.orders[0]!.status === "in-transit");
    expect(state.orders[0]!.status).toBe("in-transit");
    state = playUntil(state, (s) => s.orders[0]!.status === "delivered");
    expect(state.pause?.reason).toBe("order");
    expect(state.inbox.find((m) => m.id === state.pause?.messageId)?.title).toBe("Pedido entregue: Kit de servos comerciais");
    expect(state.orders[0]!.deliveredAt).not.toBeNull();
    const servo = state.parts.find((p) => p.type === "electronics")!;
    expect(servo.quality).toBeGreaterThanOrEqual(80);
    expect(servo.quality).toBeLessThanOrEqual(90);
    expect(servo.condition).toBe(100);
  });

  it("material vira estoque e equipamento entra no inventário", () => {
    let state = order(game(), {
      shopId: "balsa-leve",
      lines: [
        { productId: "balsa", quantity: 2 },
        { productId: "balsa-hard", quantity: 1 }
      ],
      shipping: "express"
    });
    state = order(state, { shopId: "mercadosolto", lines: [{ productId: "scale", quantity: 1 }], shipping: "express" });
    state = playUntil(state, (s) => s.orders.every((o) => o.status === "delivered"));
    expect(state.stock).toMatchObject({ balsa: 2, "balsa-hard": 1 });
    expect(state.equipment).toContain("scale");
  });

  it("usado chega com condição sorteada na faixa do anúncio", () => {
    let state = order(game(), { shopId: "desapega-aero", lines: [{ productId: "motor-600", quantity: 1 }], shipping: "standard" });
    state = playUntil(state, (s) => s.orders[0]!.status === "delivered");
    const motor = state.parts[0]!;
    expect(motor.condition).toBeGreaterThanOrEqual(30);
    expect(motor.condition).toBeLessThanOrEqual(90);
  });

  it("servo do AliExpresso às vezes vem falsificado e marcado", () => {
    const flags = Array.from({ length: 30 }, (_, seed) => {
      let state = order(game(2000, seed + 1), { shopId: "aliexpresso", lines: [{ productId: "servos", quantity: 1 }], shipping: "standard" });
      state = playUntil(state, (s) => s.orders[0]!.status === "delivered" || s.orders[0]!.status === "held-customs", 200);
      if (state.orders[0]!.status === "held-customs") state = applyCommand(state, { type: "pay-customs", orderId: state.orders[0]!.id });
      state = playUntil(state, (s) => s.orders[0]!.status === "delivered", 200);
      return state.parts[0]?.counterfeit === true;
    });
    expect(flags.some(Boolean)).toBe(true);
    expect(flags.some((flag) => !flag)).toBe(true);
  });
});

describe("fiscalização", () => {
  /** Primeiro seed em que o motor da HobbyKong fica retido. */
  function heldOrder(): GameState {
    for (let seed = 1; seed < 200; seed += 1) {
      let state = order(game(2000, seed), { shopId: "hobbykong", lines: [{ productId: "motor-600", quantity: 1 }], shipping: "standard" });
      state = playUntil(state, (s) => s.orders[0]!.status === "held-customs" || s.orders[0]!.status === "delivered", 200);
      if (state.orders[0]!.status === "held-customs") return state;
    }
    throw new Error("nenhum pedido retido");
  }

  it("importado retido pausa, cobra imposto e fica parado até pagar", () => {
    const held = heldOrder();
    expect(held.pause?.reason).toBe("order");
    expect(held.inbox.at(-1)!.title).toContain("Retido na fiscalização");
    const due = held.orders[0]!.customsDue!;
    expect(due).toBe(Math.round(300 * 0.6));
    const arrives = held.orders[0]!.arrivesAt;
    const waited = playUntil(held, () => false, 10);
    expect(waited.orders[0]!.status).toBe("held-customs");
    expect(waited.orders[0]!.arrivesAt).toBeGreaterThan(arrives);

    expect(applyCommand({ ...waited, credits: 10 }, { type: "pay-customs", orderId: waited.orders[0]!.id }).warning?.text).toContain("Caixa");
    const paid = applyCommand(waited, { type: "pay-customs", orderId: waited.orders[0]!.id });
    expect(paid.credits).toBe(waited.credits - due);
    expect(paid.orders[0]).toMatchObject({ status: "in-transit", customsDue: null, customsPaid: due });
    const delivered = playUntil(paid, (s) => s.orders[0]!.status === "delivered", 60);
    expect(delivered.orders[0]!.status).toBe("delivered");
    expect(delivered.inbox.filter((m) => m.title.includes("Retido"))).toHaveLength(1);
  });

  it("recusa pagar imposto de pedido que não está retido", () => {
    const state = order(game(), { shopId: "hobbykong", lines: [{ productId: "motor-600", quantity: 1 }], shipping: "standard" });
    expect(applyCommand(state, { type: "pay-customs", orderId: state.orders[0]!.id }).warning?.text).toContain("não está retido");
  });
});

describe("vitrine no relógio", () => {
  it("promoções relâmpago aparecem na HobbyKong e vencem", () => {
    let state = game();
    let found = false;
    for (let day = 0; day < 120 && !found; day += 1) {
      state = advanceShops(state, day * 24, (day + 1) * 24).state;
      state = { ...state, clock: { ...state.clock, hours: (day + 1) * 24 } };
      found = Object.keys(state.shops.sales).length > 0;
    }
    expect(found).toBe(true);
    const [id, sale] = Object.entries(state.shops.sales)[0]!;
    expect(id.startsWith("hobbykong:")).toBe(true);
    expect(state.inbox.at(-1)!.title).toContain("Promoção relâmpago");
    const later = advanceShops(state, sale.until + 24, sale.until + 48).state;
    expect(later.shops.sales[id]).toBeUndefined();
  });

  it("estoque esgotado volta aos poucos, até o estoque inicial", () => {
    let state = order(game(), { shopId: "hangar-aeromodelista", lines: [{ productId: "motor-600", quantity: 2 }], shipping: "standard" });
    expect(listingStock(state, "hangar-aeromodelista", "motor-600")).toBe(0);
    for (let day = 0; day < 120; day += 1) state = advanceShops({ ...state, orders: [] }, day * 24, (day + 1) * 24).state;
    expect(listingStock(state, "hangar-aeromodelista", "motor-600")).toBe(2);
  });
});
