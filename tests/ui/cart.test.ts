import { describe, expect, it } from "vitest";
import { findListing, findShop, LISTINGS, SHOPS } from "../../src/sim";
import {
  canAdd,
  cartSummary,
  changeQuantity,
  listingRisk,
  listingRiskNotes,
  rangeText,
  shippedLead
} from "../../src/ui/browser/cart";

const shop = (id: string) => findShop(id)!;
const listing = (shopId: string, productId: string) => findListing(shopId, productId)!;

describe("prazo do frete", () => {
  it("expresso encurta a faixa e nunca dá menos de 1 dia", () => {
    expect(shippedLead({ min: 15, max: 30 }, 0.5)).toEqual({ min: 8, max: 15 });
    expect(shippedLead({ min: 2, max: 4 }, 0.1)).toEqual({ min: 1, max: 1 });
  });

  it("escreve a faixa", () => {
    expect(rangeText({ min: 15, max: 30 })).toBe("15–30 d");
    expect(rangeText({ min: 3, max: 3 })).toBe("3 d");
  });
});

describe("risco dos anúncios", () => {
  it("falsificação alta e usado muito incerto são risco alto", () => {
    expect(listingRisk(listing("aliexpresso", "servos"))).toBe("high");
    expect(listingRisk(listing("desapega-aero", "servos"))).toBe("high");
  });

  it("loja nacional confiável não tem risco", () => {
    expect(listingRisk(listing("hangar-aeromodelista", "motor-600"))).toBe("none");
  });

  it("todo anúncio tem pelo menos uma frase de risco", () => {
    for (const item of LISTINGS) {
      expect(listingRiskNotes(item, shop(item.shopId)).length).toBeGreaterThan(0);
    }
  });

  it("servo falsificado avisa da inspeção", () => {
    const notes = listingRiskNotes(listing("aliexpresso", "servos"), shop("aliexpresso"));
    expect(notes[0]).toContain("inspeção");
  });
});

describe("carrinho", () => {
  const kong = shop("hobbykong");
  const motor = listing("hobbykong", "motor-600");
  const servos = listing("hobbykong", "servos");

  it("soma itens, frete e pega o prazo do item mais demorado", () => {
    const summary = cartSummary(
      kong,
      [
        { listing: motor, quantity: 1, unitPrice: 300 },
        { listing: servos, quantity: 2, unitPrice: 170 }
      ],
      "standard"
    );
    expect(summary).toMatchObject({ items: 3, subtotal: 640, shipping: 40, total: 680, lead: { min: 15, max: 30 } });
    expect(summary.risk).toBe("medium");
  });

  it("carrinho vazio não cobra frete", () => {
    expect(cartSummary(kong, [], "express")).toMatchObject({ total: 0, lead: null, risk: "none" });
  });

  it("respeita o estoque", () => {
    let cart = changeQuantity({}, "motor-600", 1, 2);
    cart = changeQuantity(cart, "motor-600", 5, 2);
    expect(cart).toEqual({ "motor-600": 2 });
    expect(canAdd(cart, "motor-600", 2)).toBe(false);
    expect(changeQuantity(cart, "motor-600", -2, 2)).toEqual({});
  });

  it("toda loja tem frete normal", () => {
    for (const item of SHOPS) expect(item.shipping.standard).not.toBeNull();
  });
});
