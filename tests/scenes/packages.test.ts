import { describe, expect, it } from "vitest";
import { OPENING_WINDOW_HOURS, packagesAtDoor, recentDeliveries } from "../../src/scenes/hangar/packages";
import { baseState, order } from "./fixtures";

describe("pacotes no hangar", () => {
  it("sem pedidos não há caixas", () => {
    const state = baseState();
    expect(packagesAtDoor(state)).toEqual([]);
    expect(recentDeliveries(state)).toEqual([]);
  });

  it("caixas na porta só para pedidos a caminho ou retidos", () => {
    const state = baseState();
    state.orders = [
      order({ id: "o1", status: "processing" }),
      order({ id: "o2", status: "in-transit" }),
      order({
        id: "o3",
        status: "held-customs",
        shopId: "aliexpresso",
        customsDue: 90,
        lines: [
          { productId: "servos", quantity: 1, unitPrice: 100 },
          { productId: "resin", quantity: 2, unitPrice: 50 }
        ]
      }),
      order({ id: "o4", status: "delivered", deliveredAt: 0 })
    ];
    expect(packagesAtDoor(state)).toEqual([
      { orderId: "o2", shopName: "HobbyKong", label: "Motor 600 W", held: false },
      { orderId: "o3", shopName: "AliExpresso", label: "Kit de servos comerciais +1", held: true }
    ]);
  });

  it("abre só o que foi entregue dentro da janela, do mais antigo ao mais novo", () => {
    const state = baseState();
    state.clock.hours = 100;
    state.orders = [
      order({ id: "old", status: "delivered", deliveredAt: 100 - OPENING_WINDOW_HOURS - 1 }),
      order({ id: "b", status: "delivered", deliveredAt: 99 }),
      order({ id: "a", status: "delivered", deliveredAt: 90 }),
      order({ id: "c", status: "in-transit" })
    ];
    expect(recentDeliveries(state).map((p) => p.orderId)).toEqual(["a", "b"]);
  });
});
