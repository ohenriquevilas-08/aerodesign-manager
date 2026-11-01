// Notícias do Portal (Fase 4, S5): geradas por eventos do relógio (promoção começando, estoque
// acabando, prazo chegando, resultado de rival). Determinísticas: nascem de sorteios que a
// simulação já faz, sem consumir aleatoriedade própria.

import { BALANCE } from "./content/balance";
import { listingId } from "./content/shops";
import type { GameState, NewsItem } from "./types";

/** Anota uma notícia (sem repetir: mesma `listingId` e título dentro de BALANCE.news.dedupeHours). */
export function addNews(state: GameState, item: Omit<NewsItem, "id" | "at">): GameState {
  const now = state.clock.hours;
  const repeated = state.news.some((old) => old.title === item.title && old.listingId === item.listingId && now - old.at < BALANCE.news.dedupeHours);
  if (repeated) return state;
  const full: NewsItem = { ...item, id: `news-${state.nextId}`, at: now };
  const news = [...state.news, full].slice(-BALANCE.news.max);
  return { ...state, news, nextId: state.nextId + 1 };
}

/** Notícias da mais nova para a mais antiga. */
export function newsFeed(state: GameState): NewsItem[] {
  return [...state.news].reverse();
}

/** Fim da promoção relâmpago do anúncio (horas de jogo) para a contagem regressiva; null se não há. */
export function promoEndsAt(state: GameState, shopId: string, productId: string): number | null {
  const sale = state.shops.sales[listingId(shopId, productId)];
  return sale && sale.until > state.clock.hours ? sale.until : null;
}
