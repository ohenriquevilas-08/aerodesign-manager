import { describe, expect, it } from "vitest";
import {
  applyCommand,
  createGame,
  DEFAULT_DESIGN,
  findProduct,
  findShop,
  LISTINGS,
  listingId,
  listingPrice,
  listingStock,
  PRODUCTS,
  SHOPS
} from "../../src/sim";

const game = () => createGame({ seed: 7, teamName: "Equipe Teste" });

describe("estado inicial da Fase 3", () => {
  it("começa sem avião, sem pedidos, sem competição e com relatório vazio", () => {
    const state = game();
    expect(state.version).toBe(5);
    expect(state.aircraft).toBeNull();
    expect(state.orders).toEqual([]);
    expect(state.competition).toBeNull();
    expect(state.report.submittedAt).toBeNull();
    expect(state.report.chapters.aerodynamics).toEqual({ hours: 0, testsCited: 0 });
  });

  it("estoque das lojas nasce do initialStock dos anúncios", () => {
    const state = game();
    expect(listingStock(state, "hangar-aeromodelista", "motor-600")).toBe(2);
    expect(listingStock(state, "balsa-leve", "balsa")).toBeNull();
  });
});

describe("set-design", () => {
  it("cria o avião com desvios escondidos sorteados uma vez só", () => {
    const first = applyCommand(game(), { type: "set-design", design: DEFAULT_DESIGN });
    expect(first.aircraft?.design).toEqual(DEFAULT_DESIGN);
    expect(first.rngState).not.toBe(game().rngState);
    const changed = applyCommand(first, { type: "set-design", design: { ...DEFAULT_DESIGN, span: 3.5 } });
    expect(changed.aircraft?.design.span).toBe(3.5);
    expect(changed.aircraft?.hidden).toEqual(first.aircraft?.hidden);
  });

  it("recusa envergadura fora da prancheta", () => {
    const state = applyCommand(game(), { type: "set-design", design: { ...DEFAULT_DESIGN, span: 1 } });
    expect(state.aircraft).toBeNull();
    expect(state.warning?.text).toContain("Envergadura");
  });
});

describe("set-predictions", () => {
  it("grava o rascunho e mantém o que não veio no comando", () => {
    const line = { a: -0.002, b: 13, cap: 12 };
    let state = applyCommand(game(), { type: "set-predictions", emptyWeightKg: 3.4 });
    state = applyCommand(state, { type: "set-predictions", payloadLine: line });
    expect(state.report.predictedEmptyWeightKg).toBe(3.4);
    expect(state.report.payloadLine).toEqual(line);
  });

  it("recusa depois do envio", () => {
    const base = game();
    const sent = { ...base, report: { ...base.report, submittedAt: 100 } };
    const state = applyCommand(sent, { type: "set-predictions", emptyWeightKg: 3 });
    expect(state.report.predictedEmptyWeightKg).toBeNull();
    expect(state.warning).not.toBeNull();
  });
});

describe("catálogo das lojas", () => {
  it("todo anúncio aponta para loja e produto existentes, sem duplicata", () => {
    const ids = LISTINGS.map((item) => listingId(item.shopId, item.productId));
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of LISTINGS) {
      expect(findShop(item.shopId)).toBeDefined();
      expect(findProduct(item.productId)).toBeDefined();
      expect(item.leadDays.min).toBeLessThanOrEqual(item.leadDays.max);
    }
  });

  it("todo produto é vendido em alguma loja e toda loja vende algo", () => {
    for (const product of PRODUCTS) expect(LISTINGS.some((item) => item.productId === product.id)).toBe(true);
    for (const shop of SHOPS) expect(LISTINGS.some((item) => item.shopId === shop.id)).toBe(true);
  });

  it("o mesmo motor tem preços diferentes em lojas diferentes", () => {
    const prices = LISTINGS.filter((item) => item.productId === "motor-600").map((item) => item.price);
    expect(new Set(prices).size).toBeGreaterThanOrEqual(3);
  });

  it("promoção ativa troca o preço da vitrine até acabar", () => {
    const base = game();
    const id = listingId("hobbykong", "motor-600");
    const onSale = { ...base, shops: { ...base.shops, sales: { [id]: { price: 250, until: 48 } } } };
    expect(listingPrice(onSale, "hobbykong", "motor-600")).toBe(250);
    const later = { ...onSale, clock: { ...onSale.clock, hours: 48 } };
    expect(listingPrice(later, "hobbykong", "motor-600")).toBe(300);
    expect(listingPrice(base, "hobbykong", "balsa")).toBeNull();
  });
});
