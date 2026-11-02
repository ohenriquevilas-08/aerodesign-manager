// Estrutura genérica de "site" do navegador (U4). Loja, portal de notícias e "Meus pedidos" são
// sites; redes sociais entram depois só registrando mais um aqui. Estado das abas é de apresentação.

import { findShop, SHOPS } from "../../sim";

export interface SiteInfo {
  id: string;
  title: string;
  url: string;
  /** Texto do favorito na página inicial. */
  blurb: string;
}

export const NEWS_SITE = "news";
export const ORDERS_SITE = "orders";
export const FORMS_SITE = "forms";

/** Sites fixos além das lojas. */
const EXTRA_SITES: SiteInfo[] = [
  { id: NEWS_SITE, title: "Portal Aero Notícias", url: "https://noticias.aeronet.app/", blurb: "Promoções, estoque e prazos do regulamento." },
  { id: ORDERS_SITE, title: "Meus pedidos", url: "aeronet://meus-pedidos", blurb: "Rastreio de todas as lojas e impostos da fiscalização." },
  // Paródia de formulários online (Fase 9, U1): a planilha de inscritos da seletiva.
  { id: FORMS_SITE, title: "Formulários Goggle", url: "https://formularios.goggle.app/seletiva", blurb: "Planilha de respostas da seletiva da equipe." }
];

export function siteInfo(id: string): SiteInfo | null {
  const shop = findShop(id);
  if (shop) return { id, title: shop.name, url: `https://${shop.domain}/`, blurb: shop.tagline };
  return EXTRA_SITES.find((site) => site.id === id) ?? null;
}

/** Favoritos da página inicial: as lojas e depois os sites fixos (os Formulários só com seletiva aberta). */
export function bookmarks(options: { forms?: boolean } = {}): SiteInfo[] {
  return [...SHOPS.map((shop) => siteInfo(shop.id)!), ...EXTRA_SITES.filter((site) => site.id !== FORMS_SITE || options.forms)];
}
