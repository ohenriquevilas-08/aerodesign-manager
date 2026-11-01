import { describe, expect, it } from "vitest";
import { step } from "../../src/sim/loop";
import { LISTINGS, SHOPS } from "../../src/sim/content/shops";
import { SELLER_REVIEWS, sellerRisk } from "../../src/sim/content/sellerReviews";
import {
  applyCommand,
  newsFeed,
  OFFICIAL_CALENDAR,
  promoEndsAt,
  sellerReview,
  listingId,
  type GameState
} from "../../src/sim";
import { dateToHours } from "../../src/sim/time";
import { startedGame } from "./helpers";

const game = (seed = 4): GameState => startedGame({ seed, teamName: "Notícias" });

function daysLater(state: GameState, days: number): GameState {
  let next = state;
  for (let i = 0; i < days; i += 1) next = step(next, 24);
  return next;
}

describe("notícias", () => {
  it("start empty and newsFeed lists the newest first", () => {
    const state = game();
    expect(state.news).toEqual([]);
    const later = daysLater(state, 90);
    const feed = newsFeed(later);
    expect(feed.length).toBeGreaterThan(1);
    expect(feed[0]!.at).toBeGreaterThanOrEqual(feed.at(-1)!.at);
  });

  it("a flash sale produces news with the listing and a countdown", () => {
    let state = game();
    let found: { at: number; listing: string } | null = null;
    for (let day = 0; day < 300 && !found; day += 1) {
      state = step(state, 24);
      const promo = state.news.find((item) => item.kind === "promo");
      if (promo) found = { at: promo.at, listing: promo.listingId! };
    }
    expect(found).not.toBeNull();
    const [shopId, productId] = found!.listing.split(":") as [string, string];
    const ends = promoEndsAt(state, shopId, productId);
    expect(ends).not.toBeNull();
    expect(ends!).toBeGreaterThan(state.clock.hours);
    expect(promoEndsAt(state, shopId, "produto-que-nao-existe")).toBeNull();
    expect(promoEndsAt(game(), shopId, productId)).toBeNull();
  });

  it("running low on a limited listing makes stock news", () => {
    let state = { ...game(), credits: 10_000 };
    state = applyCommand(state, {
      type: "place-order",
      shopId: "hangar-aeromodelista",
      lines: [{ productId: "thrust-stand", quantity: 1 }],
      shipping: "standard"
    });
    expect(state.shops.stock[listingId("hangar-aeromodelista", "thrust-stand")]).toBe(0);
    state = step(state, 24);
    const stock = state.news.find((item) => item.kind === "stock" && item.shopId === "hangar-aeromodelista");
    expect(stock?.title).toContain("esgotado");
  });

  it("a deadline coming up makes a deadline news item", () => {
    const report = OFFICIAL_CALENDAR.find((item) => item.id === "report")!;
    const warnAt = dateToHours(report.date) - 7 * 24;
    let state: GameState = { ...game(), clock: { hours: warnAt - 1, speed: 4 } };
    state = step(state, 2);
    expect(state.news.some((item) => item.kind === "deadline" && item.title.includes(report.title))).toBe(true);
  });

  it("is deterministic from the seed and independent of how the days are stepped", () => {
    expect(daysLater(game(7), 60).news).toEqual(daysLater(game(7), 60).news);
    expect(daysLater(game(7), 60).news).not.toEqual(daysLater(game(8), 60).news);
  });

  it("keeps only the latest items", () => {
    const state = daysLater(game(), 400);
    expect(state.news.length).toBeLessThanOrEqual(60);
  });
});

describe("avaliações de vendedor", () => {
  it("every shop has a rating and 2 or 3 parody comments", () => {
    for (const shop of SHOPS) {
      const review = sellerReview(shop.id)!;
      expect(review, shop.id).not.toBeNull();
      expect(review.rating).toBeGreaterThan(0);
      expect(review.rating).toBeLessThanOrEqual(5);
      expect(review.comments.length).toBeGreaterThanOrEqual(2);
      expect(review.comments.length).toBeLessThanOrEqual(3);
    }
    expect(Object.keys(SELLER_REVIEWS).sort()).toEqual(SHOPS.map((shop) => shop.id).sort());
  });

  it("riskier shops never have a better rating", () => {
    const shops = SHOPS.map((shop) => ({ id: shop.id, risk: sellerRisk(shop.id), rating: SELLER_REVIEWS[shop.id]!.rating }));
    for (const a of shops) {
      for (const b of shops) {
        if (a.risk > b.risk) expect(a.rating, `${a.id} vs ${b.id}`).toBeLessThanOrEqual(b.rating);
      }
    }
    // O pior risco do jogo (falsificado + atraso + fiscalização) tem a pior nota.
    const worst = [...shops].sort((a, b) => b.risk - a.risk)[0]!;
    expect(worst.id).toBe("aliexpresso");
    expect(worst.rating).toBe(Math.min(...shops.map((shop) => shop.rating)));
    expect(LISTINGS.some((item) => item.shopId === "aliexpresso" && item.counterfeitChance > 0)).toBe(true);
  });
});
